from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import statistics
import time
import unicodedata
import urllib.error
import urllib.request

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EVALUATION_VERSION = "locked-baseline-eval-v1"

FRONT_MATTER_PATTERNS = (
    "table of contents",
    "lesson list",
    "all rights reserved",
    "first publication",
    "revised edition",
    "for free distribution",
    "prescribed by the national curriculum",
)


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
                    f"Invalid JSONL at "
                    f"{path}:{line_number}: {error}",
                ) from error

            if not isinstance(value, dict):
                raise ValueError(
                    f"Expected a JSON object at "
                    f"{path}:{line_number}.",
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


def sha256_text(
    value: str,
) -> str:
    return hashlib.sha256(
        value.encode("utf-8"),
    ).hexdigest()


def normalize(
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


def normalize_key(
    value: Any,
) -> str:
    return normalize(value).casefold()


def contained_in(
    full_text: Any,
    fragment: Any,
) -> bool:
    full = normalize_key(full_text)
    part = normalize_key(fragment)

    return bool(part) and part in full


def stable_integer(
    value: str,
) -> int:
    return int(
        sha256_text(value)[:8],
        16,
    )


def extract_expected_hash(
    lock_path: Path,
) -> str:
    lock_text = lock_path.read_text(
        encoding="utf-8-sig",
    )

    match = re.search(
        r"SHA256:\s*([0-9a-fA-F]{64})",
        lock_text,
    )

    if not match:
        raise RuntimeError(
            "The test split SHA256 was not "
            "found in the lock file.",
        )

    return match.group(1).lower()


def select_evaluation_pages(
    test_pages: list[dict[str, Any]],
    per_book: int,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []

    for book_id in (
        "class6-english",
        "class7-english",
    ):
        candidates: list[
            dict[str, Any]
        ] = []

        for record in test_pages:
            if str(
                record.get(
                    "book_id",
                    "",
                ),
            ) != book_id:
                continue

            text = normalize(
                record.get(
                    "text",
                    "",
                ),
            )

            if not text:
                continue

            words = int(
                record.get(
                    "word_count",
                    0,
                )
                or len(text.split())
            )

            if words < 70 or words > 400:
                continue

            text_lower = text.casefold()

            if any(
                pattern in text_lower
                for pattern in FRONT_MATTER_PATTERNS
            ):
                continue

            candidate = dict(record)

            candidate["_selection_text"] = text
            candidate["_selection_words"] = words

            candidates.append(candidate)

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
                        record[
                            "_selection_words"
                        ],
                    )
                    - 180
                ),
                sha256_text(
                    str(
                        record.get(
                            "record_id",
                            "",
                        ),
                    ),
                ),
            ),
        )

        if len(candidates) < per_book:
            raise RuntimeError(
                f"Not enough eligible locked-test "
                f"pages for {book_id}. "
                f"Needed {per_book}, found "
                f"{len(candidates)}.",
            )

        selected.extend(
            candidates[:per_book],
        )

    manifest: list[
        dict[str, Any]
    ] = []

    for record in selected:
        source_id = str(
            record["record_id"],
        )

        text = str(
            record["_selection_text"],
        )

        manifest.append(
            {
                "eval_id":
                    f"eval-{source_id}",
                "evaluation_version":
                    EVALUATION_VERSION,
                "source_record_id":
                    source_id,
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
                "lesson_number":
                    record.get(
                        "lesson_number",
                    ),
                "source_text_sha256":
                    record.get(
                        "text_sha256",
                    )
                    or sha256_text(text),
                "source_manual_review_required":
                    bool(
                        record.get(
                            "manual_review_required",
                            False,
                        ),
                    ),
                "word_count":
                    len(text.split()),
                "text":
                    text,
                "split":
                    "test_locked",
            },
        )

    manifest.sort(
        key=lambda record: (
            str(
                record["book_id"],
            ),
            int(
                record.get(
                    "page_number",
                    0,
                )
                or 0
            ),
        ),
    )

    return manifest


def post_chat(
    *,
    model: str,
    messages: list[dict[str, str]],
    seed: int,
    timeout: int = 300,
) -> dict[str, Any]:
    payload = {
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
        "messages":
            messages,
        "options": {
            "temperature":
                0,
            "seed":
                seed,
            "num_ctx":
                2048,
            "num_predict":
                260,
        },
    }

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

    if not isinstance(result, dict):
        raise RuntimeError(
            "Unexpected Ollama response.",
        )

    return result


def prompt_for_task(
    *,
    source: dict[str, Any],
    task: str,
) -> list[dict[str, str]]:
    system_message = (
        "You create educational assessment items "
        "using only the supplied NCTB English "
        "textbook passage. Return valid JSON only. "
        "Do not include reasoning or markdown."
    )

    passage = str(
        source["text"],
    )

    class_level = source.get(
        "class_level",
        "",
    )

    if task == "generate_mcq":
        instruction = f"""
PASSAGE:
{passage}

Create exactly one multiple-choice question suitable for Class {class_level}.

Rules:

- Use only information in the passage.
- Provide exactly four unique options.
- correct_answer must exactly match one option.
- correct_answer must be copied exactly from the passage.
- evidence_quote must be an exact continuous quote from the passage.
- evidence_quote must contain the correct answer.
- Do not ask about formatting, OCR, page numbers, publishers,
  editions or copyright.

Return exactly:

{{
  "question": "string",
  "options": [
    "string",
    "string",
    "string",
    "string"
  ],
  "correct_answer": "exact passage phrase",
  "evidence_quote": "exact passage quote"
}}
""".strip()

    elif task == "short_extractive_qa":
        instruction = f"""
PASSAGE:
{passage}

Create exactly one short-answer question suitable for Class {class_level}.

Rules:

- Use only information in the passage.
- The answer must be copied exactly from the passage.
- The answer must be one continuous phrase containing no more than 20 words.
- evidence_quote must be an exact continuous quote from the passage.
- evidence_quote must contain the answer.
- Do not ask about formatting, OCR, page numbers, publishers,
  editions or copyright.

Return exactly:

{{
  "question": "string",
  "answer": "exact passage phrase",
  "evidence_quote": "exact passage quote"
}}
""".strip()

    else:
        raise ValueError(
            f"Unsupported task: {task}",
        )

    return [
        {
            "role":
                "system",
            "content":
                system_message,
        },
        {
            "role":
                "user",
            "content":
                instruction,
        },
    ]


def validate_generated(
    *,
    task: str,
    parsed: Any,
    passage: str,
) -> tuple[
    list[str],
    bool,
    bool,
]:
    errors: list[str] = []

    if not isinstance(parsed, dict):
        return (
            [
                "root response is not a JSON object",
            ],
            False,
            False,
        )

    question = normalize(
        parsed.get(
            "question",
            "",
        ),
    )

    schema_pass = True
    grounding_pass = True

    if len(question) < 8:
        errors.append(
            "question is missing or too short",
        )

        schema_pass = False

    if task == "generate_mcq":
        options = parsed.get(
            "options",
        )

        answer = normalize(
            parsed.get(
                "correct_answer",
                "",
            ),
        )

        evidence = normalize(
            parsed.get(
                "evidence_quote",
                "",
            ),
        )

        if (
            not isinstance(options, list)
            or len(options) != 4
        ):
            errors.append(
                "MCQ must contain exactly four options",
            )

            schema_pass = False
            options = []

        normalized_options = [
            normalize_key(option)
            for option in options
        ]

        if (
            normalized_options
            and len(
                set(normalized_options),
            )
            != len(normalized_options)
        ):
            errors.append(
                "MCQ options are not unique",
            )

            schema_pass = False

        if normalize_key(
            answer,
        ) not in normalized_options:
            errors.append(
                "correct_answer does not match an option",
            )

            schema_pass = False

    else:
        answer = normalize(
            parsed.get(
                "answer",
                "",
            ),
        )

        evidence = normalize(
            parsed.get(
                "evidence_quote",
                "",
            ),
        )

        if not answer:
            errors.append(
                "answer is missing",
            )

            schema_pass = False

        if len(answer.split()) > 20:
            errors.append(
                "answer contains more than 20 words",
            )

            schema_pass = False

    if not contained_in(
        passage,
        answer,
    ):
        errors.append(
            "answer is not an exact passage phrase",
        )

        grounding_pass = False

    if not contained_in(
        passage,
        evidence,
    ):
        errors.append(
            "evidence_quote is not an exact passage quote",
        )

        grounding_pass = False

    if (
        answer
        and evidence
        and not contained_in(
            evidence,
            answer,
        )
    ):
        errors.append(
            "evidence_quote does not contain the answer",
        )

        grounding_pass = False

    return (
        sorted(set(errors)),
        schema_pass,
        grounding_pass,
    )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    parser.add_argument(
        "--per-book",
        type=int,
        default=5,
    )

    parser.add_argument(
        "--models",
        nargs="+",
        default=[
            "gemma3:latest",
            "qwen3:latest",
        ],
    )

    arguments = parser.parse_args()

    root = Path(
        arguments.root,
    ).resolve()

    evaluation_directory = (
        root
        / "research"
        / "data"
        / "evaluation"
    )

    reports_directory = (
        root
        / "research"
        / "reports"
    )

    evaluation_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    reports_directory.mkdir(
        parents=True,
        exist_ok=True,
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

    for required_path in (
        test_path,
        test_lock_path,
    ):
        if not required_path.exists():
            raise FileNotFoundError(
                f"Required file not found: "
                f"{required_path}",
            )

    expected_test_hash = (
        extract_expected_hash(
            test_lock_path,
        )
    )

    actual_test_hash = sha256_file(
        test_path,
    ).lower()

    if expected_test_hash != actual_test_hash:
        raise RuntimeError(
            "Locked test-set hash mismatch. "
            "Evaluation stopped.",
        )

    test_pages = load_jsonl(
        test_path,
    )

    manifest = select_evaluation_pages(
        test_pages,
        arguments.per_book,
    )

    manifest_path = (
        evaluation_directory
        / "eval_manifest_v1.jsonl"
    )

    write_jsonl(
        manifest_path,
        manifest,
    )

    manifest_hash = sha256_file(
        manifest_path,
    )

    manifest_lock_path = (
        reports_directory
        / "eval_manifest_v1_lock.txt"
    )

    manifest_lock_path.write_text(
        "\n".join(
            [
                "NCTB Study Companion",
                "Locked Baseline Evaluation Manifest v1",
                "",
                (
                    f"Source test SHA256: "
                    f"{actual_test_hash}"
                ),
                (
                    f"Manifest records: "
                    f"{len(manifest)}"
                ),
                (
                    f"Manifest SHA256: "
                    f"{manifest_hash}"
                ),
                (
                    "File: research/data/evaluation/"
                    "eval_manifest_v1.jsonl"
                ),
                "",
                (
                    "This manifest must never be used "
                    "for fine-tuning."
                ),
            ],
        )
        + "\n",
        encoding="utf-8",
    )

    result_path = (
        evaluation_directory
        / "baseline_eval_results_v1.jsonl"
    )

    result_path.touch(
        exist_ok=True,
    )

    existing_results = load_jsonl(
        result_path,
    )

    valid_existing_results = [
        record
        for record in existing_results
        if record.get(
            "eval_manifest_sha256",
        )
        == manifest_hash
    ]

    existing_keys = {
        (
            str(
                record.get(
                    "model",
                    "",
                ),
            ),
            str(
                record.get(
                    "eval_id",
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
        for record in valid_existing_results
    }

    total_calls = (
        len(arguments.models)
        * len(manifest)
        * 2
    )

    current_call = 0

    for model in arguments.models:
        for source in manifest:
            for task in (
                "generate_mcq",
                "short_extractive_qa",
            ):
                current_call += 1

                key = (
                    model,
                    str(
                        source["eval_id"],
                    ),
                    task,
                )

                if key in existing_keys:
                    print(
                        f"[{current_call}/{total_calls}] "
                        f"SKIP {model} "
                        f"{source['eval_id']} "
                        f"{task}",
                        flush=True,
                    )

                    continue

                print(
                    f"[{current_call}/{total_calls}] "
                    f"{model} "
                    f"{source['eval_id']} "
                    f"{task}",
                    flush=True,
                )

                raw_response = ""
                parsed_output: Any = None
                errors: list[str] = []
                schema_pass = False
                grounding_pass = False
                response: dict[str, Any] = {}

                started = time.perf_counter()

                try:
                    seed = (
                        stable_integer(
                            f"{source['eval_id']}|"
                            f"{task}"
                        )
                        % 2_147_483_647
                    )

                    response = post_chat(
                        model=model,
                        messages=prompt_for_task(
                            source=source,
                            task=task,
                        ),
                        seed=seed,
                    )

                    raw_response = normalize(
                        response.get(
                            "message",
                            {},
                        ).get(
                            "content",
                            "",
                        ),
                    )

                    parsed_output = json.loads(
                        raw_response,
                    )

                    (
                        errors,
                        schema_pass,
                        grounding_pass,
                    ) = validate_generated(
                        task=task,
                        parsed=parsed_output,
                        passage=str(
                            source["text"],
                        ),
                    )

                    json_valid = True

                except json.JSONDecodeError as error:
                    json_valid = False

                    errors = [
                        f"invalid JSON: {error}",
                    ]

                except Exception as error:
                    json_valid = False

                    errors = [
                        f"{type(error).__name__}: "
                        f"{error}",
                    ]

                duration_seconds = (
                    time.perf_counter()
                    - started
                )

                automatic_pass = (
                    json_valid
                    and schema_pass
                    and grounding_pass
                    and not errors
                )

                result_record = {
                    "evaluation_version":
                        EVALUATION_VERSION,
                    "eval_manifest_sha256":
                        manifest_hash,
                    "model":
                        model,
                    "eval_id":
                        source["eval_id"],
                    "source_record_id":
                        source[
                            "source_record_id"
                        ],
                    "book_id":
                        source["book_id"],
                    "class_level":
                        source["class_level"],
                    "page_number":
                        source["page_number"],
                    "task":
                        task,
                    "json_valid":
                        json_valid,
                    "schema_pass":
                        schema_pass,
                    "grounding_pass":
                        grounding_pass,
                    "automatic_pass":
                        automatic_pass,
                    "validation_errors":
                        errors,
                    "parsed_output":
                        parsed_output,
                    "raw_response":
                        raw_response,
                    "duration_seconds":
                        round(
                            duration_seconds,
                            4,
                        ),
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
                    "evaluated_at":
                        datetime.now(
                            timezone.utc,
                        ).isoformat(),
                }

                append_jsonl(
                    result_path,
                    result_record,
                )

                existing_keys.add(key)

                status = (
                    "PASS"
                    if automatic_pass
                    else "FAIL"
                )

                print(
                    f"  {status} "
                    f"time={duration_seconds:.2f}s "
                    f"errors={len(errors)}",
                    flush=True,
                )

    all_results = [
        record
        for record in load_jsonl(
            result_path,
        )
        if record.get(
            "eval_manifest_sha256",
        )
        == manifest_hash
    ]

    unique_results: dict[
        tuple[str, str, str],
        dict[str, Any],
    ] = {}

    for record in all_results:
        key = (
            str(
                record["model"],
            ),
            str(
                record["eval_id"],
            ),
            str(
                record["task"],
            ),
        )

        unique_results[key] = record

    all_results = sorted(
        unique_results.values(),
        key=lambda record: (
            str(
                record["model"],
            ),
            str(
                record["eval_id"],
            ),
            str(
                record["task"],
            ),
        ),
    )

    write_jsonl(
        result_path,
        all_results,
    )

    human_review_path = (
        evaluation_directory
        / "baseline_eval_human_review_v1.csv"
    )

    review_fields = [
        "model",
        "eval_id",
        "task",
        "book_id",
        "class_level",
        "page_number",
        "question",
        "options",
        "answer",
        "evidence_quote",
        "automatic_pass",
        "validation_errors",
        "human_relevance_rating_1_to_5",
        "human_grammar_rating_1_to_5",
        "human_grounding_decision",
        "reviewer",
        "notes",
    ]

    with human_review_path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=review_fields,
        )

        writer.writeheader()

        for record in all_results:
            output = record.get(
                "parsed_output",
            )

            if not isinstance(output, dict):
                output = {}

            writer.writerow(
                {
                    "model":
                        record.get(
                            "model",
                        ),
                    "eval_id":
                        record.get(
                            "eval_id",
                        ),
                    "task":
                        record.get(
                            "task",
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
                            "",
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
                                "answer",
                                "",
                            )
                        ),
                    "evidence_quote":
                        output.get(
                            "evidence_quote",
                            "",
                        ),
                    "automatic_pass":
                        record.get(
                            "automatic_pass",
                        ),
                    "validation_errors":
                        " | ".join(
                            record.get(
                                "validation_errors",
                                [],
                            ),
                        ),
                    "human_relevance_rating_1_to_5":
                        "",
                    "human_grammar_rating_1_to_5":
                        "",
                    "human_grounding_decision":
                        "",
                    "reviewer":
                        "",
                    "notes":
                        "",
                },
            )

    grouped: dict[
        tuple[str, str],
        list[dict[str, Any]],
    ] = defaultdict(list)

    for record in all_results:
        grouped[
            (
                str(
                    record["model"],
                ),
                str(
                    record["task"],
                ),
            )
        ].append(record)

    group_summaries: list[
        dict[str, Any]
    ] = []

    for (
        model,
        task,
    ), records in sorted(
        grouped.items(),
    ):
        total = len(records)

        json_count = sum(
            bool(
                record.get(
                    "json_valid",
                ),
            )
            for record in records
        )

        schema_count = sum(
            bool(
                record.get(
                    "schema_pass",
                ),
            )
            for record in records
        )

        grounding_count = sum(
            bool(
                record.get(
                    "grounding_pass",
                ),
            )
            for record in records
        )

        pass_count = sum(
            bool(
                record.get(
                    "automatic_pass",
                ),
            )
            for record in records
        )

        durations = [
            float(
                record.get(
                    "duration_seconds",
                    0,
                )
                or 0
            )
            for record in records
        ]

        group_summaries.append(
            {
                "model":
                    model,
                "task":
                    task,
                "total_examples":
                    total,
                "json_valid":
                    json_count,
                "json_valid_rate_percent":
                    round(
                        json_count
                        / total
                        * 100,
                        2,
                    ),
                "schema_pass":
                    schema_count,
                "schema_pass_rate_percent":
                    round(
                        schema_count
                        / total
                        * 100,
                        2,
                    ),
                "grounding_pass":
                    grounding_count,
                "grounding_pass_rate_percent":
                    round(
                        grounding_count
                        / total
                        * 100,
                        2,
                    ),
                "automatic_pass":
                    pass_count,
                "automatic_pass_rate_percent":
                    round(
                        pass_count
                        / total
                        * 100,
                        2,
                    ),
                "mean_duration_seconds":
                    round(
                        statistics.mean(
                            durations,
                        ),
                        3,
                    )
                    if durations
                    else 0,
            },
        )

    summary = {
        "evaluation_version":
            EVALUATION_VERSION,
        "locked_test_sha256":
            actual_test_hash,
        "evaluation_manifest_sha256":
            manifest_hash,
        "evaluation_pages":
            len(manifest),
        "tasks_per_page":
            2,
        "models":
            arguments.models,
        "expected_result_records":
            total_calls,
        "completed_result_records":
            len(all_results),
        "group_results":
            group_summaries,
        "completed_at":
            datetime.now(
                timezone.utc,
            ).isoformat(),
    }

    summary_path = (
        reports_directory
        / "baseline_evaluation_summary_v1.json"
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
        "BASELINE EVALUATION V1 COMPLETE",
    )

    print("=" * 72)

    print(
        "Locked test SHA256:",
        actual_test_hash,
    )

    print(
        "Evaluation manifest SHA256:",
        manifest_hash,
    )

    print(
        "Evaluation pages:",
        len(manifest),
    )

    print(
        "Result records:",
        len(all_results),
    )

    print()

    for group in group_summaries:
        print(
            f"{group['model']} | "
            f"{group['task']}"
        )

        print(
            "  JSON valid: "
            f"{group['json_valid']}/"
            f"{group['total_examples']} "
            f"({group['json_valid_rate_percent']}%)"
        )

        print(
            "  Schema pass: "
            f"{group['schema_pass']}/"
            f"{group['total_examples']} "
            f"({group['schema_pass_rate_percent']}%)"
        )

        print(
            "  Grounding pass: "
            f"{group['grounding_pass']}/"
            f"{group['total_examples']} "
            f"({group['grounding_pass_rate_percent']}%)"
        )

        print(
            "  Full automatic pass: "
            f"{group['automatic_pass']}/"
            f"{group['total_examples']} "
            f"({group['automatic_pass_rate_percent']}%)"
        )

        print(
            "  Mean time: "
            f"{group['mean_duration_seconds']}s"
        )

    print()
    print(
        "Manifest:",
        manifest_path,
    )

    print(
        "Manifest lock:",
        manifest_lock_path,
    )

    print(
        "Results:",
        result_path,
    )

    print(
        "Human review CSV:",
        human_review_path,
    )

    print(
        "Summary:",
        summary_path,
    )


if __name__ == "__main__":
    main()
