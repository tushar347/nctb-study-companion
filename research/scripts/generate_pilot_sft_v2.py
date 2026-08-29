from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROMPT_VERSION = "pilot-grounded-v2"

SYSTEM_PROMPT = """
You create educational questions from NCTB English textbook passages.

Use only the supplied passage for the correct answer.
Return valid JSON only.
Do not include markdown, reasoning, commentary, or extra fields.
""".strip()


def load_jsonl(
    path: Path,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    if not path.exists():
        return records

    with path.open(
        "r",
        encoding="utf-8-sig",
    ) as handle:
        for line_number, line in enumerate(
            handle,
            start=1,
        ):
            line = line.strip()

            if not line:
                continue

            try:
                value = json.loads(line)

            except json.JSONDecodeError as error:
                raise ValueError(
                    f"Invalid JSONL in {path} "
                    f"at line {line_number}: {error}",
                ) from error

            if not isinstance(
                value,
                dict,
            ):
                raise ValueError(
                    f"Expected a JSON object at "
                    f"{path}:{line_number}",
                )

            records.append(value)

    return records


def write_jsonl(
    path: Path,
    records: list[dict[str, Any]],
) -> None:
    with path.open(
        "w",
        encoding="utf-8",
    ) as handle:
        for record in records:
            handle.write(
                json.dumps(
                    record,
                    ensure_ascii=False,
                )
                + "\n"
            )


def append_jsonl(
    path: Path,
    record: dict[str, Any],
) -> None:
    with path.open(
        "a",
        encoding="utf-8",
    ) as handle:
        handle.write(
            json.dumps(
                record,
                ensure_ascii=False,
            )
            + "\n"
        )


def sha256_file(
    path: Path,
) -> str:
    digest = hashlib.sha256()

    with path.open(
        "rb",
    ) as handle:
        for chunk in iter(
            lambda: handle.read(
                1024 * 1024,
            ),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def stable_hash(
    value: str,
) -> str:
    return hashlib.sha256(
        value.encode("utf-8"),
    ).hexdigest()


def normalized(
    value: Any,
) -> str:
    text = unicodedata.normalize(
        "NFKC",
        str(value or ""),
    )

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def normalized_lower(
    value: Any,
) -> str:
    return normalized(value).casefold()


def locate_answer(
    passage: str,
    answer: str,
) -> re.Match[str] | None:
    answer = normalized(answer)

    if not answer:
        return None

    escaped = re.escape(answer)

    escaped = escaped.replace(
        r"\ ",
        r"\s+",
    )

    return re.search(
        escaped,
        passage,
        flags=re.IGNORECASE,
    )


def derive_evidence_quote(
    passage: str,
    answer: str,
) -> str:
    match = locate_answer(
        passage,
        answer,
    )

    if match is None:
        raise ValueError(
            "Answer cannot be located in passage.",
        )

    start = match.start()
    end = match.end()

    previous_boundaries = [
        passage.rfind(
            character,
            0,
            start,
        )
        for character in (
            ".",
            "?",
            "!",
            "\n",
        )
    ]

    previous_boundary = max(
        previous_boundaries,
    )

    quote_start = (
        previous_boundary + 1
        if previous_boundary >= 0
        else 0
    )

    next_boundaries = [
        position
        for position in (
            passage.find(
                ".",
                end,
            ),
            passage.find(
                "?",
                end,
            ),
            passage.find(
                "!",
                end,
            ),
            passage.find(
                "\n",
                end,
            ),
        )
        if position >= 0
    ]

    quote_end = (
        min(next_boundaries) + 1
        if next_boundaries
        else len(passage)
    )

    quote = passage[
        quote_start:
        quote_end
    ].strip()

    if len(quote) > 320:
        left = max(
            0,
            start - 100,
        )

        right = min(
            len(passage),
            end + 180,
        )

        quote = passage[
            left:
            right
        ].strip()

    return quote


def post_json(
    payload: dict[str, Any],
    timeout: int = 300,
) -> dict[str, Any]:
    request = urllib.request.Request(
        "http://localhost:11434/api/chat",
        data=json.dumps(
            payload,
        ).encode("utf-8"),
        headers={
            "Content-Type":
                "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=timeout,
        ) as response:
            result = json.loads(
                response.read().decode(
                    "utf-8",
                ),
            )

    except urllib.error.HTTPError as error:
        body = error.read().decode(
            "utf-8",
            errors="replace",
        )

        raise RuntimeError(
            f"Ollama HTTP {error.code}: "
            f"{body}",
        ) from error

    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Could not contact Ollama: {error}",
        ) from error

    if not isinstance(
        result,
        dict,
    ):
        raise RuntimeError(
            "Unexpected Ollama API response.",
        )

    return result


def select_pages(
    records: list[dict[str, Any]],
    per_book: int,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []

    for book_id in (
        "class6-english",
        "class7-english",
    ):
        candidates = [
            record
            for record in records
            if str(
                record.get(
                    "book_id",
                    "",
                ),
            )
            == book_id
            and bool(
                record.get(
                    "include_for_sft",
                    True,
                ),
            )
            and 50
            <= int(
                record.get(
                    "word_count",
                    0,
                )
                or 0
            )
            <= 400
        ]

        candidates.sort(
            key=lambda record: (
                bool(
                    record.get(
                        "manual_review_required",
                        False,
                    ),
                ),
                abs(
                    int(
                        record.get(
                            "word_count",
                            0,
                        )
                        or 0
                    )
                    - 170
                ),
                stable_hash(
                    str(
                        record.get(
                            "record_id",
                            "",
                        ),
                    ),
                ),
            ),
        )

        selected.extend(
            candidates[:per_book],
        )

    return selected


def mcq_prompt(
    source: dict[str, Any],
    retry_note: str = "",
) -> str:
    retry_section = ""

    if retry_note:
        retry_section = f"""
The previous response failed because:
{retry_note}

Correct the problem while keeping the exact structure below.
"""

    return f"""
Class: {source["class_level"]}

PASSAGE:
{source["text"]}

Create exactly one multiple-choice question.

Rules:

- Ask about an important fact or idea in the passage.
- Use exactly four unique options.
- Copy the correct answer exactly from the passage.
- correct_answer must exactly match one option.
- Do not ask about the page number, publisher, edition, OCR,
  copyright, or formatting.
- Make the language suitable for Class {source["class_level"]}.
{retry_section}
Return exactly:

{{
  "question": "string",
  "options": [
    "string",
    "string",
    "string",
    "string"
  ],
  "correct_answer": "exact passage phrase"
}}
""".strip()


def short_qa_prompt(
    source: dict[str, Any],
    retry_note: str = "",
) -> str:
    retry_section = ""

    if retry_note:
        retry_section = f"""
The previous response failed because:
{retry_note}

Correct the problem while keeping the exact structure below.
"""

    return f"""
Class: {source["class_level"]}

PASSAGE:
{source["text"]}

Create exactly one short-answer question.

Rules:

- Ask about an important fact or idea in the passage.
- Copy the answer exactly from the passage.
- The answer must be a continuous phrase.
- The answer must contain 1 to 20 words.
- Do not ask about the page number, publisher, edition, OCR,
  copyright, or formatting.
- Make the language suitable for Class {source["class_level"]}.
{retry_section}
Return exactly:

{{
  "question": "string",
  "answer": "exact passage phrase"
}}
""".strip()


def validate_mcq(
    value: Any,
    passage: str,
) -> list[str]:
    errors: list[str] = []

    if not isinstance(
        value,
        dict,
    ):
        return [
            "response is not a JSON object",
        ]

    question = normalized(
        value.get(
            "question",
            "",
        ),
    )

    options = value.get(
        "options",
    )

    correct_answer = normalized(
        value.get(
            "correct_answer",
            "",
        ),
    )

    if len(question) < 8:
        errors.append(
            "question is too short",
        )

    if (
        not isinstance(
            options,
            list,
        )
        or len(options) != 4
    ):
        errors.append(
            "options must contain exactly four items",
        )

        options = []

    option_texts = [
        normalized(option)
        for option in options
    ]

    option_keys = [
        option.casefold()
        for option in option_texts
    ]

    if (
        option_keys
        and len(set(option_keys)) != 4
    ):
        errors.append(
            "options are not unique",
        )

    if (
        correct_answer.casefold()
        not in option_keys
    ):
        errors.append(
            "correct_answer does not match an option",
        )

    if locate_answer(
        passage,
        correct_answer,
    ) is None:
        errors.append(
            "correct_answer is not an exact passage phrase",
        )

    return errors


def validate_short_qa(
    value: Any,
    passage: str,
) -> list[str]:
    errors: list[str] = []

    if not isinstance(
        value,
        dict,
    ):
        return [
            "response is not a JSON object",
        ]

    question = normalized(
        value.get(
            "question",
            "",
        ),
    )

    answer = normalized(
        value.get(
            "answer",
            "",
        ),
    )

    if len(question) < 8:
        errors.append(
            "question is too short",
        )

    answer_words = answer.split()

    if not answer_words:
        errors.append(
            "answer is empty",
        )

    if len(answer_words) > 20:
        errors.append(
            "answer contains more than 20 words",
        )

    if locate_answer(
        passage,
        answer,
    ) is None:
        errors.append(
            "answer is not an exact passage phrase",
        )

    return errors


def generate_task(
    *,
    source: dict[str, Any],
    task: str,
    model: str,
    retries: int,
) -> tuple[
    dict[str, Any] | None,
    dict[str, Any],
    list[str],
    str,
]:
    retry_note = ""
    final_errors: list[str] = []
    raw_response = ""
    final_metadata: dict[str, Any] = {}

    for attempt in range(
        1,
        retries + 2,
    ):
        if task == "generate_mcq":
            prompt = mcq_prompt(
                source,
                retry_note,
            )

        else:
            prompt = short_qa_prompt(
                source,
                retry_note,
            )

        response = post_json(
            {
                "model":
                    model,
                "stream":
                    False,
                "think":
                    False,
                "format":
                    "json",
                "keep_alive":
                    "10m",
                "messages": [
                    {
                        "role":
                            "system",
                        "content":
                            SYSTEM_PROMPT,
                    },
                    {
                        "role":
                            "user",
                        "content":
                            prompt,
                    },
                ],
                "options": {
                    "temperature":
                        0,
                    "seed":
                        (
                            1000
                            + attempt
                            + (
                                100
                                if task
                                == "short_extractive_qa"
                                else 0
                            )
                        ),
                    "num_ctx":
                        2048,
                    "num_predict":
                        180,
                },
            },
        )

        raw_response = normalized(
            response.get(
                "message",
                {},
            ).get(
                "content",
                "",
            ),
        )

        try:
            parsed = json.loads(
                raw_response,
            )

        except json.JSONDecodeError as error:
            parsed = None

            final_errors = [
                f"invalid JSON: {error}",
            ]

        else:
            if task == "generate_mcq":
                final_errors = validate_mcq(
                    parsed,
                    str(
                        source["text"],
                    ),
                )

            else:
                final_errors = (
                    validate_short_qa(
                        parsed,
                        str(
                            source["text"],
                        ),
                    )
                )

        final_metadata = {
            "attempt":
                attempt,
            "prompt_eval_count":
                response.get(
                    "prompt_eval_count",
                ),
            "eval_count":
                response.get(
                    "eval_count",
                ),
            "total_duration_ns":
                response.get(
                    "total_duration",
                ),
            "temperature":
                0,
            "think":
                False,
        }

        if (
            isinstance(parsed, dict)
            and not final_errors
        ):
            return (
                parsed,
                final_metadata,
                [],
                raw_response,
            )

        retry_note = "; ".join(
            final_errors,
        )

        print(
            f"    RETRY {task} "
            f"attempt={attempt}: "
            f"{retry_note}",
            flush=True,
        )

        time.sleep(1)

    return (
        None,
        final_metadata,
        final_errors,
        raw_response,
    )


def make_example(
    *,
    source: dict[str, Any],
    task: str,
    generated: dict[str, Any],
    model: str,
    generation_metadata:
        dict[str, Any],
) -> dict[str, Any]:
    passage = str(
        source["text"],
    )

    if task == "generate_mcq":
        answer = normalized(
            generated[
                "correct_answer"
            ],
        )

        output = {
            "question":
                normalized(
                    generated[
                        "question"
                    ],
                ),
            "options": [
                normalized(option)
                for option
                in generated[
                    "options"
                ]
            ],
            "correct_answer":
                answer,
            "evidence_quote":
                derive_evidence_quote(
                    passage,
                    answer,
                ),
        }

        instruction = (
            "Generate one passage-grounded "
            "multiple-choice question with "
            "four options and an answer."
        )

    else:
        answer = normalized(
            generated[
                "answer"
            ],
        )

        output = {
            "question":
                normalized(
                    generated[
                        "question"
                    ],
                ),
            "answer":
                answer,
            "evidence_quote":
                derive_evidence_quote(
                    passage,
                    answer,
                ),
        }

        instruction = (
            "Generate one passage-grounded "
            "short-answer question with an "
            "extractive answer."
        )

    return {
        "example_id": (
            f"{source['record_id']}-"
            f"{task}-v2"
        ),
        "task":
            task,
        "source_record_id":
            source[
                "record_id"
            ],
        "book_id":
            source[
                "book_id"
            ],
        "class_level":
            source[
                "class_level"
            ],
        "page_number":
            source[
                "page_number"
            ],
        "lesson_number":
            source.get(
                "lesson_number",
            ),
        "split_group":
            source.get(
                "split_group",
            ),
        "source_text_sha256":
            source.get(
                "text_sha256",
            ),
        "prompt_version":
            PROMPT_VERSION,
        "generated_by":
            model,
        "generation":
            generation_metadata,
        "instruction":
            instruction,
        "input":
            passage,
        "output":
            output,
        "messages": [
            {
                "role":
                    "system",
                "content":
                    SYSTEM_PROMPT,
            },
            {
                "role":
                    "user",
                "content": (
                    f"Passage:\n{passage}\n\n"
                    f"Task:\n{instruction}"
                ),
            },
            {
                "role":
                    "assistant",
                "content":
                    json.dumps(
                        output,
                        ensure_ascii=False,
                    ),
            },
        ],
        "review_status":
            "pending_human_review",
        "created_at":
            datetime.now(
                timezone.utc,
            ).isoformat(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    parser.add_argument(
        "--model",
        default="gemma3:latest",
    )

    parser.add_argument(
        "--per-book",
        type=int,
        default=5,
    )

    parser.add_argument(
        "--retries",
        type=int,
        default=2,
    )

    arguments = parser.parse_args()

    root = Path(
        arguments.root,
    ).resolve()

    train_path = (
        root
        / "research"
        / "data"
        / "splits"
        / "train_pages_v1.jsonl"
    )

    test_path = (
        root
        / "research"
        / "data"
        / "splits"
        / "test_pages_v1_locked.jsonl"
    )

    lock_path = (
        root
        / "research"
        / "reports"
        / "test_split_v1_lock.txt"
    )

    processed_directory = (
        root
        / "research"
        / "data"
        / "processed"
    )

    reports_directory = (
        root
        / "research"
        / "reports"
    )

    logs_directory = (
        root
        / "research"
        / "logs"
    )

    for directory in (
        processed_directory,
        reports_directory,
        logs_directory,
    ):
        directory.mkdir(
            parents=True,
            exist_ok=True,
        )

    for required_path in (
        train_path,
        test_path,
        lock_path,
    ):
        if not required_path.exists():
            raise FileNotFoundError(
                f"Missing required file: "
                f"{required_path}",
            )

    lock_text = lock_path.read_text(
        encoding="utf-8",
    )

    lock_match = re.search(
        r"SHA256:\s*([0-9a-fA-F]{64})",
        lock_text,
    )

    if not lock_match:
        raise RuntimeError(
            "Test-set SHA256 was not "
            "found in the lock file.",
        )

    expected_hash = (
        lock_match.group(1).lower()
    )

    actual_hash = (
        sha256_file(test_path).lower()
    )

    if expected_hash != actual_hash:
        raise RuntimeError(
            "Locked test-set hash mismatch.",
        )

    train_records = load_jsonl(
        train_path,
    )

    test_records = load_jsonl(
        test_path,
    )

    train_ids = {
        str(
            record[
                "record_id"
            ],
        )
        for record in train_records
    }

    test_ids = {
        str(
            record[
                "record_id"
            ],
        )
        for record in test_records
    }

    overlap = train_ids & test_ids

    if overlap:
        raise RuntimeError(
            "Train/test overlap detected.",
        )

    selected_pages = select_pages(
        train_records,
        arguments.per_book,
    )

    expected_pages = (
        arguments.per_book * 2
    )

    if len(selected_pages) != expected_pages:
        raise RuntimeError(
            f"Expected {expected_pages} pages, "
            f"selected {len(selected_pages)}.",
        )

    source_path = (
        processed_directory
        / "pilot_source_pages_v2.jsonl"
    )

    write_jsonl(
        source_path,
        selected_pages,
    )

    candidate_path = (
        processed_directory
        / "pilot_sft_candidates_v2.jsonl"
    )

    invalid_path = (
        processed_directory
        / "pilot_sft_invalid_v2.jsonl"
    )

    review_path = (
        processed_directory
        / "pilot_sft_review_v2.csv"
    )

    candidate_path.touch(
        exist_ok=True,
    )

    invalid_path.touch(
        exist_ok=True,
    )

    existing_records = load_jsonl(
        candidate_path,
    )

    existing_ids = {
        str(
            record.get(
                "example_id",
                "",
            ),
        )
        for record in existing_records
    }

    successes = 0
    failures = 0
    skipped = 0

    for page_index, source in enumerate(
        selected_pages,
        start=1,
    ):
        source_id = str(
            source[
                "record_id"
            ],
        )

        print(
            f"[{page_index}/"
            f"{len(selected_pages)}] "
            f"{source_id}",
            flush=True,
        )

        for task in (
            "generate_mcq",
            "short_extractive_qa",
        ):
            example_id = (
                f"{source_id}-"
                f"{task}-v2"
            )

            if example_id in existing_ids:
                skipped += 1

                print(
                    f"  SKIP {task}",
                    flush=True,
                )

                continue

            generated, metadata, errors, raw = (
                generate_task(
                    source=source,
                    task=task,
                    model=arguments.model,
                    retries=arguments.retries,
                )
            )

            if generated is None:
                failures += 1

                append_jsonl(
                    invalid_path,
                    {
                        "example_id":
                            example_id,
                        "source_record_id":
                            source_id,
                        "task":
                            task,
                        "book_id":
                            source.get(
                                "book_id",
                            ),
                        "page_number":
                            source.get(
                                "page_number",
                            ),
                        "validation_errors":
                            errors,
                        "raw_response":
                            raw,
                        "created_at":
                            datetime.now(
                                timezone.utc,
                            ).isoformat(),
                    },
                )

                print(
                    f"  FAIL {task}",
                    flush=True,
                )

                continue

            example = make_example(
                source=source,
                task=task,
                generated=generated,
                model=arguments.model,
                generation_metadata=
                    metadata,
            )

            append_jsonl(
                candidate_path,
                example,
            )

            existing_ids.add(
                example_id,
            )

            successes += 1

            print(
                f"  PASS {task} "
                f"attempt="
                f"{metadata['attempt']} "
                f"tokens="
                f"{metadata.get('eval_count')}",
                flush=True,
            )

    candidate_records = load_jsonl(
        candidate_path,
    )

    unique_records = {
        str(
            record[
                "example_id"
            ]
        ):
            record
        for record in candidate_records
    }

    candidate_records = sorted(
        unique_records.values(),
        key=lambda record:
            str(
                record[
                    "example_id"
                ],
            ),
    )

    write_jsonl(
        candidate_path,
        candidate_records,
    )

    review_fields = [
        "example_id",
        "task",
        "book_id",
        "class_level",
        "page_number",
        "question",
        "options",
        "answer",
        "evidence_quote",
        "review_decision",
        "reviewer",
        "notes",
    ]

    with review_path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=
                review_fields,
        )

        writer.writeheader()

        for record in candidate_records:
            output = record[
                "output"
            ]

            writer.writerow(
                {
                    "example_id":
                        record[
                            "example_id"
                        ],
                    "task":
                        record[
                            "task"
                        ],
                    "book_id":
                        record[
                            "book_id"
                        ],
                    "class_level":
                        record[
                            "class_level"
                        ],
                    "page_number":
                        record[
                            "page_number"
                        ],
                    "question":
                        output.get(
                            "question",
                        ),
                    "options":
                        json.dumps(
                            output.get(
                                "options",
                                [],
                            ),
                            ensure_ascii=False,
                        ),
                    "answer":
                        (
                            output.get(
                                "correct_answer"
                            )
                            or output.get(
                                "answer"
                            )
                        ),
                    "evidence_quote":
                        output.get(
                            "evidence_quote",
                        ),
                    "review_decision":
                        "",
                    "reviewer":
                        "",
                    "notes":
                        "",
                },
            )

    task_counts = Counter(
        str(
            record[
                "task"
            ],
        )
        for record
        in candidate_records
    )

    book_counts = Counter(
        str(
            record[
                "book_id"
            ],
        )
        for record
        in candidate_records
    )

    summary = {
        "model":
            arguments.model,
        "prompt_version":
            PROMPT_VERSION,
        "test_hash_verified":
            True,
        "test_sha256":
            actual_hash,
        "selected_source_pages":
            len(selected_pages),
        "successful_examples_this_run":
            successes,
        "failed_examples_this_run":
            failures,
        "skipped_examples_this_run":
            skipped,
        "candidate_examples_total":
            len(candidate_records),
        "task_counts":
            dict(task_counts),
        "book_counts":
            dict(book_counts),
        "finished_at":
            datetime.now(
                timezone.utc,
            ).isoformat(),
    }

    summary_path = (
        reports_directory
        / "pilot_sft_generation_summary_v2.json"
    )

    summary_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "PILOT SFT V2 GENERATION COMPLETE",
    )

    print("=" * 60)

    print(
        "Selected source pages:",
        len(selected_pages),
    )

    print(
        "Successful examples this run:",
        successes,
    )

    print(
        "Failed examples this run:",
        failures,
    )

    print(
        "Skipped examples this run:",
        skipped,
    )

    print(
        "Candidate examples total:",
        len(candidate_records),
    )

    print(
        "Task counts:",
        dict(task_counts),
    )

    print(
        "Book counts:",
        dict(book_counts),
    )

    print(
        "Test hash verified:",
        actual_hash,
    )

    print()
    print(
        "Candidates:",
        candidate_path,
    )

    print(
        "Review CSV:",
        review_path,
    )

    print(
        "Invalid outputs:",
        invalid_path,
    )

    print(
        "Summary:",
        summary_path,
    )


if __name__ == "__main__":
    main()
