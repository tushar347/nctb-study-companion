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


PROMPT_VERSION = "pilot-grounded-v1"

SYSTEM_PROMPT = """
You create grounded educational examples from NCTB English textbook passages.

Use only the supplied passage.
Do not add outside facts.
Return valid JSON only.
Do not include markdown, reasoning, or commentary.
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

            if not isinstance(value, dict):
                raise ValueError(
                    f"Expected a JSON object in {path} "
                    f"at line {line_number}.",
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

    with path.open("rb") as handle:
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


def normalize_for_match(
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
    ).strip().lower()


def appears_in_passage(
    passage: str,
    value: Any,
) -> bool:
    needle = normalize_for_match(value)
    haystack = normalize_for_match(passage)

    return bool(needle) and needle in haystack


def post_json(
    url: str,
    payload: dict[str, Any],
    timeout: int = 300,
) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(
            payload,
        ).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
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
            f"Ollama HTTP {error.code}: {body}",
        ) from error

    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Could not reach Ollama: {error}",
        ) from error

    if not isinstance(result, dict):
        raise RuntimeError(
            "Ollama returned an unexpected response.",
        )

    return result


def select_pages(
    records: list[dict[str, Any]],
    per_book: int,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []

    target_books = (
        "class6-english",
        "class7-english",
    )

    for book_id in target_books:
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
            and 40
            <= int(
                record.get(
                    "word_count",
                    0,
                )
                or 0
            )
            <= 450
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
                    - 180
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


def make_prompt(
    source: dict[str, Any],
    retry_note: str = "",
) -> str:
    correction = ""

    if retry_note:
        correction = f"""
Previous output failed validation for these reasons:
{retry_note}

Correct every listed problem.
"""

    return f"""
Book: {source["book_id"]}
Class: {source["class_level"]}
Page: {source["page_number"]}

PASSAGE
{source["text"]}

Create exactly two educational items:

1. One multiple-choice question.
2. One short extractive question-answer item.

Rules:

- Use only the passage.
- The MCQ must have exactly four unique options.
- correct_answer must exactly match one option.
- correct_answer must appear exactly in the passage.
- Both evidence_quote values must be exact continuous quotes from the passage.
- The short answer must be an exact continuous phrase from the passage.
- The short answer must contain no more than 25 words.
- Do not ask about publishers, copyright, editions, page numbers,
  OCR, formatting, or document layout.
- Make both questions appropriate for Class {source["class_level"]}.
{correction}
Return exactly this JSON structure:

{{
  "mcq": {{
    "question": "string",
    "options": [
      "string",
      "string",
      "string",
      "string"
    ],
    "correct_answer": "string",
    "evidence_quote": "exact quote"
  }},
  "short_qa": {{
    "question": "string",
    "answer": "exact phrase",
    "evidence_quote": "exact quote"
  }}
}}
""".strip()


def validate_generated(
    generated: Any,
    passage: str,
) -> list[str]:
    errors: list[str] = []

    if not isinstance(generated, dict):
        return [
            "root response is not a JSON object",
        ]

    mcq = generated.get("mcq")
    short_qa = generated.get(
        "short_qa",
    )

    if not isinstance(mcq, dict):
        errors.append(
            "missing mcq object",
        )

    if not isinstance(short_qa, dict):
        errors.append(
            "missing short_qa object",
        )

    if errors:
        return errors

    mcq_question = str(
        mcq.get(
            "question",
            "",
        ),
    ).strip()

    options = mcq.get("options")

    correct_answer = str(
        mcq.get(
            "correct_answer",
            "",
        ),
    ).strip()

    mcq_evidence = str(
        mcq.get(
            "evidence_quote",
            "",
        ),
    ).strip()

    if len(mcq_question) < 8:
        errors.append(
            "MCQ question is too short",
        )

    if (
        not isinstance(options, list)
        or len(options) != 4
    ):
        errors.append(
            "MCQ must contain exactly four options",
        )

        options = []

    normalized_options = [
        normalize_for_match(option)
        for option in options
    ]

    if (
        normalized_options
        and len(
            set(normalized_options),
        )
        != 4
    ):
        errors.append(
            "MCQ options are not unique",
        )

    if normalize_for_match(
        correct_answer,
    ) not in normalized_options:
        errors.append(
            "correct_answer does not exactly match an option",
        )

    if not appears_in_passage(
        passage,
        correct_answer,
    ):
        errors.append(
            "correct_answer is not found in the passage",
        )

    if not appears_in_passage(
        passage,
        mcq_evidence,
    ):
        errors.append(
            "MCQ evidence_quote is not an exact passage quote",
        )

    if (
        mcq_evidence
        and correct_answer
        and normalize_for_match(
            correct_answer,
        )
        not in normalize_for_match(
            mcq_evidence,
        )
    ):
        errors.append(
            "MCQ evidence_quote does not contain the correct answer",
        )

    qa_question = str(
        short_qa.get(
            "question",
            "",
        ),
    ).strip()

    qa_answer = str(
        short_qa.get(
            "answer",
            "",
        ),
    ).strip()

    qa_evidence = str(
        short_qa.get(
            "evidence_quote",
            "",
        ),
    ).strip()

    if len(qa_question) < 8:
        errors.append(
            "short-answer question is too short",
        )

    if not appears_in_passage(
        passage,
        qa_answer,
    ):
        errors.append(
            "short answer is not an exact passage phrase",
        )

    if len(qa_answer.split()) > 25:
        errors.append(
            "short answer contains more than 25 words",
        )

    if not appears_in_passage(
        passage,
        qa_evidence,
    ):
        errors.append(
            "short-answer evidence_quote is not an exact passage quote",
        )

    if (
        qa_evidence
        and qa_answer
        and normalize_for_match(
            qa_answer,
        )
        not in normalize_for_match(
            qa_evidence,
        )
    ):
        errors.append(
            "short-answer evidence_quote does not contain the answer",
        )

    return errors


def make_example(
    source: dict[str, Any],
    task: str,
    output: dict[str, Any],
    model: str,
    generation: dict[str, Any],
) -> dict[str, Any]:
    if task == "generate_mcq":
        instruction = (
            "Generate one passage-grounded multiple-choice "
            "question with four options, the correct answer, "
            "and an exact supporting quote."
        )

    else:
        instruction = (
            "Generate one short passage-grounded question "
            "with an extractive answer and an exact "
            "supporting quote."
        )

    return {
        "example_id": (
            f"{source['record_id']}-"
            f"{task}-v1"
        ),
        "task": task,
        "source_record_id":
            source["record_id"],
        "book_id":
            source["book_id"],
        "class_level":
            source["class_level"],
        "page_number":
            source["page_number"],
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
        "source_manual_review_required":
            bool(
                source.get(
                    "manual_review_required",
                    False,
                ),
            ),
        "prompt_version":
            PROMPT_VERSION,
        "generated_by":
            model,
        "generation":
            generation,
        "instruction":
            instruction,
        "input":
            source["text"],
        "output":
            output,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Use only the supplied NCTB "
                    "textbook passage."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Passage:\n{source['text']}\n\n"
                    f"Task:\n{instruction}"
                ),
            },
            {
                "role": "assistant",
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


def deduplicate_examples(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_id: dict[
        str,
        dict[str, Any],
    ] = {}

    for record in records:
        example_id = str(
            record.get(
                "example_id",
                "",
            ),
        )

        if example_id:
            by_id[example_id] = record

    return sorted(
        by_id.values(),
        key=lambda record: str(
            record.get(
                "example_id",
                "",
            ),
        ),
    )


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
        default=25,
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

    test_lock_path = (
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
        test_lock_path,
    ):
        if not required_path.exists():
            raise FileNotFoundError(
                f"Required file not found: "
                f"{required_path}",
            )

    lock_text = test_lock_path.read_text(
        encoding="utf-8",
    )

    hash_match = re.search(
        r"SHA256:\s*([0-9a-fA-F]{64})",
        lock_text,
    )

    if not hash_match:
        raise RuntimeError(
            "The expected test SHA256 was not "
            "found in the test lock file.",
        )

    expected_test_hash = (
        hash_match.group(1).lower()
    )

    actual_test_hash = (
        sha256_file(test_path).lower()
    )

    if expected_test_hash != actual_test_hash:
        raise RuntimeError(
            "Locked test file SHA256 mismatch. "
            "Training-data generation stopped.",
        )

    train_records = load_jsonl(
        train_path,
    )

    test_records = load_jsonl(
        test_path,
    )

    train_ids = {
        str(record["record_id"])
        for record in train_records
    }

    test_ids = {
        str(record["record_id"])
        for record in test_records
    }

    overlap = train_ids & test_ids

    if overlap:
        raise RuntimeError(
            "Train/test record overlap detected: "
            + ", ".join(
                sorted(overlap)[:10],
            ),
        )

    selected_pages = select_pages(
        train_records,
        arguments.per_book,
    )

    class6_count = sum(
        1
        for record in selected_pages
        if record.get("book_id")
        == "class6-english"
    )

    class7_count = sum(
        1
        for record in selected_pages
        if record.get("book_id")
        == "class7-english"
    )

    if (
        class6_count < arguments.per_book
        or class7_count < arguments.per_book
    ):
        raise RuntimeError(
            "Not enough eligible pages were selected. "
            f"Class 6: {class6_count}; "
            f"Class 7: {class7_count}.",
        )

    source_selection_path = (
        processed_directory
        / "pilot_source_pages_v1.jsonl"
    )

    write_jsonl(
        source_selection_path,
        selected_pages,
    )

    output_path = (
        processed_directory
        / "pilot_sft_candidates_v1.jsonl"
    )

    invalid_path = (
        processed_directory
        / "pilot_sft_invalid_v1.jsonl"
    )

    review_path = (
        processed_directory
        / "pilot_sft_review_v1.csv"
    )

    log_path = (
        logs_directory
        / "pilot_generation_v1.log"
    )

    output_path.touch(exist_ok=True)
    invalid_path.touch(exist_ok=True)

    existing_records = deduplicate_examples(
        load_jsonl(output_path),
    )

    write_jsonl(
        output_path,
        existing_records,
    )

    existing_tasks = {
        (
            str(
                record.get(
                    "source_record_id",
                    "",
                ),
            ),
            str(
                record.get(
                    "task",
                    "",
                ),
            ),
        )
        for record in existing_records
    }

    successful_pages = 0
    failed_pages = 0
    skipped_pages = 0

    started_at = datetime.now(
        timezone.utc,
    )

    with log_path.open(
        "a",
        encoding="utf-8",
    ) as log_handle:
        log_handle.write(
            f"\nSTART {started_at.isoformat()} "
            f"model={arguments.model} "
            f"selected_pages={len(selected_pages)}\n",
        )

        for index, source in enumerate(
            selected_pages,
            start=1,
        ):
            source_id = str(
                source["record_id"],
            )

            required_tasks = {
                "generate_mcq",
                "short_extractive_qa",
            }

            present_tasks = {
                task
                for current_source, task
                in existing_tasks
                if current_source
                == source_id
            }

            missing_tasks = (
                required_tasks
                - present_tasks
            )

            if not missing_tasks:
                skipped_pages += 1

                print(
                    f"[{index}/{len(selected_pages)}] "
                    f"SKIP {source_id}",
                    flush=True,
                )

                continue

            print(
                f"[{index}/{len(selected_pages)}] "
                f"{source_id}",
                flush=True,
            )

            final_errors: list[str] = []
            raw_response = ""
            generated: dict[
                str,
                Any,
            ] | None = None
            response: dict[
                str,
                Any,
            ] = {}

            retry_note = ""

            for attempt in range(
                1,
                arguments.retries + 2,
            ):
                try:
                    response = post_json(
                        (
                            "http://localhost:11434"
                            "/api/chat"
                        ),
                        {
                            "model":
                                arguments.model,
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
                                        make_prompt(
                                            source,
                                            retry_note,
                                        ),
                                },
                            ],
                            "options": {
                                "temperature":
                                    0,
                                "seed":
                                    42 + attempt,
                                "num_ctx":
                                    2048,
                                "num_predict":
                                    360,
                            },
                        },
                    )

                    raw_response = str(
                        response.get(
                            "message",
                            {},
                        ).get(
                            "content",
                            "",
                        ),
                    ).strip()

                    parsed = json.loads(
                        raw_response,
                    )

                    final_errors = (
                        validate_generated(
                            parsed,
                            str(
                                source["text"],
                            ),
                        )
                    )

                    if isinstance(parsed, dict):
                        generated = parsed
                    else:
                        generated = None

                except Exception as error:
                    generated = None

                    final_errors = [
                        (
                            f"{type(error).__name__}: "
                            f"{error}"
                        ),
                    ]

                if (
                    generated is not None
                    and not final_errors
                ):
                    generation_metadata = {
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
                        "settings": {
                            "temperature": 0,
                            "seed":
                                42 + attempt,
                            "num_ctx": 2048,
                            "num_predict": 360,
                            "think": False,
                        },
                    }

                    if (
                        "generate_mcq"
                        in missing_tasks
                    ):
                        example = make_example(
                            source,
                            "generate_mcq",
                            generated["mcq"],
                            arguments.model,
                            generation_metadata,
                        )

                        append_jsonl(
                            output_path,
                            example,
                        )

                        existing_tasks.add(
                            (
                                source_id,
                                "generate_mcq",
                            ),
                        )

                    if (
                        "short_extractive_qa"
                        in missing_tasks
                    ):
                        example = make_example(
                            source,
                            "short_extractive_qa",
                            generated[
                                "short_qa"
                            ],
                            arguments.model,
                            generation_metadata,
                        )

                        append_jsonl(
                            output_path,
                            example,
                        )

                        existing_tasks.add(
                            (
                                source_id,
                                "short_extractive_qa",
                            ),
                        )

                    successful_pages += 1

                    print(
                        "  PASS "
                        f"attempt={attempt} "
                        "tokens="
                        f"{response.get('eval_count', 0)}",
                        flush=True,
                    )

                    log_handle.write(
                        f"PASS {source_id} "
                        f"attempt={attempt}\n",
                    )

                    log_handle.flush()

                    break

                retry_note = "; ".join(
                    final_errors,
                )

                print(
                    "  RETRY "
                    f"attempt={attempt}: "
                    f"{retry_note}",
                    flush=True,
                )

                time.sleep(1)

            else:
                failed_pages += 1

                invalid_record = {
                    "source_record_id":
                        source_id,
                    "book_id":
                        source.get(
                            "book_id",
                        ),
                    "page_number":
                        source.get(
                            "page_number",
                        ),
                    "model":
                        arguments.model,
                    "validation_errors":
                        final_errors,
                    "raw_response":
                        raw_response,
                    "created_at":
                        datetime.now(
                            timezone.utc,
                        ).isoformat(),
                }

                append_jsonl(
                    invalid_path,
                    invalid_record,
                )

                print(
                    "  FAILED after all attempts",
                    flush=True,
                )

                log_handle.write(
                    f"FAIL {source_id} "
                    f"errors={final_errors}\n",
                )

                log_handle.flush()

    generated_records = (
        deduplicate_examples(
            load_jsonl(output_path),
        )
    )

    write_jsonl(
        output_path,
        generated_records,
    )

    review_fields = [
        "example_id",
        "task",
        "source_record_id",
        "book_id",
        "class_level",
        "page_number",
        "question",
        "options",
        "answer_or_correct_answer",
        "evidence_quote",
        "review_decision",
        "reviewer",
        "corrected_output_json",
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

        for record in generated_records:
            output = record.get(
                "output",
                {},
            )

            writer.writerow(
                {
                    "example_id":
                        record.get(
                            "example_id",
                        ),
                    "task":
                        record.get(
                            "task",
                        ),
                    "source_record_id":
                        record.get(
                            "source_record_id",
                        ),
                    "book_id":
                        record.get(
                            "book_id",
                        ),
                    "class_level":
                        record.get(
                            "class_level",
                        ),
                    "page_number":
                        record.get(
                            "page_number",
                        ),
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
                    "answer_or_correct_answer":
                        (
                            output.get(
                                "correct_answer",
                            )
                            or output.get(
                                "answer",
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
                    "corrected_output_json":
                        "",
                    "notes":
                        "",
                },
            )

    task_counts = Counter(
        str(
            record.get(
                "task",
            ),
        )
        for record in generated_records
    )

    book_counts = Counter(
        str(
            record.get(
                "book_id",
            ),
        )
        for record in generated_records
    )

    summary = {
        "model":
            arguments.model,
        "prompt_version":
            PROMPT_VERSION,
        "test_hash_verified":
            True,
        "test_sha256":
            actual_test_hash,
        "selected_source_pages":
            len(selected_pages),
        "selected_class6_pages":
            class6_count,
        "selected_class7_pages":
            class7_count,
        "successful_pages_this_run":
            successful_pages,
        "failed_pages_this_run":
            failed_pages,
        "skipped_pages_this_run":
            skipped_pages,
        "candidate_examples_total":
            len(generated_records),
        "task_counts":
            dict(task_counts),
        "book_counts":
            dict(book_counts),
        "started_at":
            started_at.isoformat(),
        "finished_at":
            datetime.now(
                timezone.utc,
            ).isoformat(),
    }

    summary_path = (
        reports_directory
        / "pilot_sft_generation_summary_v1.json"
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
        "PILOT SFT GENERATION COMPLETE",
    )

    print("=" * 60)

    print(
        "Model:",
        arguments.model,
    )

    print(
        "Selected source pages:",
        len(selected_pages),
    )

    print(
        "Class 6 source pages:",
        class6_count,
    )

    print(
        "Class 7 source pages:",
        class7_count,
    )

    print(
        "Successful pages this run:",
        successful_pages,
    )

    print(
        "Failed pages this run:",
        failed_pages,
    )

    print(
        "Skipped completed pages:",
        skipped_pages,
    )

    print(
        "Candidate examples total:",
        len(generated_records),
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
        actual_test_hash,
    )

    print()
    print(
        "Candidates:",
        output_path,
    )

    print(
        "Review CSV:",
        review_path,
    )

    print(
        "Invalid responses:",
        invalid_path,
    )

    print(
        "Summary:",
        summary_path,
    )


if __name__ == "__main__":
    main()
