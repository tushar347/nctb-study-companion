from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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
                    f"{path}:{line_number}: "
                    f"{error}",
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
    return normalize(
        value,
    ).casefold()


def contained_in(
    full_text: Any,
    fragment: Any,
) -> bool:
    full = normalize_key(
        full_text,
    )

    part = normalize_key(
        fragment,
    )

    return bool(part) and part in full


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


def validate_output(
    *,
    task: str,
    output: dict[str, Any],
    source_text: str,
) -> list[str]:
    errors: list[str] = []

    question = normalize(
        output.get(
            "question",
            "",
        ),
    )

    if len(question) < 8:
        errors.append(
            "question is missing or too short",
        )

    answer = normalize(
        output.get(
            "correct_answer",
        )
        or output.get(
            "answer",
            "",
        ),
    )

    evidence = normalize(
        output.get(
            "evidence_quote",
            "",
        ),
    )

    if not answer:
        errors.append(
            "answer is missing",
        )

    elif not contained_in(
        source_text,
        answer,
    ):
        errors.append(
            "answer is not grounded in source text",
        )

    if not evidence:
        errors.append(
            "evidence quote is missing",
        )

    elif not contained_in(
        source_text,
        evidence,
    ):
        errors.append(
            "evidence quote is not grounded "
            "in source text",
        )

    if (
        answer
        and evidence
        and not contained_in(
            evidence,
            answer,
        )
    ):
        errors.append(
            "evidence quote does not contain "
            "the answer",
        )

    if task == "generate_mcq":
        options = output.get(
            "options",
        )

        if not isinstance(
            options,
            list,
        ):
            errors.append(
                "MCQ options are not an array",
            )

            options = []

        if len(options) != 4:
            errors.append(
                "MCQ must contain four options",
            )

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

        if (
            answer
            and normalize_key(answer)
            not in normalized_options
        ):
            errors.append(
                "correct answer does not match "
                "an MCQ option",
            )

    elif task == "short_extractive_qa":
        if len(answer.split()) > 25:
            errors.append(
                "short answer exceeds 25 words",
            )

    else:
        errors.append(
            f"unsupported task: {task}",
        )

    return sorted(
        set(errors),
    )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    arguments = parser.parse_args()

    root = Path(
        arguments.root,
    ).resolve()

    processed_directory = (
        root
        / "research"
        / "data"
        / "processed"
    )

    splits_directory = (
        root
        / "research"
        / "data"
        / "splits"
    )

    reports_directory = (
        root
        / "research"
        / "reports"
    )

    candidate_path = (
        processed_directory
        / "pilot_sft_candidates_v2.jsonl"
    )

    review_path = (
        processed_directory
        / "pilot_sft_quality_audit_v2.csv"
    )

    train_pages_path = (
        splits_directory
        / "train_pages_v1.jsonl"
    )

    test_pages_path = (
        splits_directory
        / "test_pages_v1_locked.jsonl"
    )

    for required_path in (
        candidate_path,
        review_path,
        train_pages_path,
        test_pages_path,
    ):
        if not required_path.exists():
            raise FileNotFoundError(
                f"Required file not found: "
                f"{required_path}",
            )

    candidates = load_jsonl(
        candidate_path,
    )

    train_pages = load_jsonl(
        train_pages_path,
    )

    test_pages = load_jsonl(
        test_pages_path,
    )

    candidate_by_id = {
        str(
            record[
                "example_id"
            ],
        ):
            record
        for record in candidates
    }

    train_by_id = {
        str(
            record[
                "record_id"
            ],
        ):
            record
        for record in train_pages
    }

    test_ids = {
        str(
            record[
                "record_id"
            ],
        )
        for record in test_pages
    }

    with review_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        review_rows = list(
            csv.DictReader(handle),
        )

    unreviewed = [
        row.get(
            "example_id",
            "",
        )
        for row in review_rows
        if not normalize(
            row.get(
                "human_decision",
                "",
            ),
        )
    ]

    if unreviewed:
        print()
        print(
            "HUMAN REVIEW IS INCOMPLETE",
        )

        print("=" * 60)

        print(
            "Unreviewed records:",
            len(unreviewed),
        )

        for example_id in unreviewed:
            print(
                f"  {example_id}",
            )

        raise SystemExit(2)

    approved_records: list[
        dict[str, Any]
    ] = []

    rejected_rows: list[
        dict[str, Any]
    ] = []

    errors: list[
        dict[str, Any]
    ] = []

    decision_counts: Counter[str] = Counter()
    task_counts: Counter[str] = Counter()
    book_counts: Counter[str] = Counter()

    for review in review_rows:
        example_id = normalize(
            review.get(
                "example_id",
                "",
            ),
        )

        decision = normalize(
            review.get(
                "human_decision",
                "",
            ),
        ).upper()

        decision_counts[
            decision
        ] += 1

        candidate = candidate_by_id.get(
            example_id,
        )

        if candidate is None:
            errors.append(
                {
                    "example_id":
                        example_id,
                    "error":
                        "candidate record not found",
                },
            )

            continue

        if decision == "REJECT":
            rejected_rows.append(
                {
                    "example_id":
                        example_id,
                    "automatic_decision":
                        review.get(
                            "automatic_decision",
                        ),
                    "reviewer":
                        review.get(
                            "reviewer",
                        ),
                    "notes":
                        review.get(
                            "notes",
                        ),
                },
            )

            continue

        if decision not in (
            "ACCEPT",
            "CORRECT",
        ):
            errors.append(
                {
                    "example_id":
                        example_id,
                    "error":
                        (
                            "unsupported human decision: "
                            f"{decision}"
                        ),
                },
            )

            continue

        automatic_decision = normalize(
            review.get(
                "automatic_decision",
                "",
            ),
        ).upper()

        if (
            automatic_decision == "REJECT"
            and decision == "ACCEPT"
        ):
            errors.append(
                {
                    "example_id":
                        example_id,
                    "error": (
                        "automatic REJECT cannot be "
                        "accepted without correction; "
                        "use CORRECT or REJECT"
                    ),
                },
            )

            continue

        finalized = dict(
            candidate,
        )

        output = dict(
            candidate.get(
                "output",
                {},
            ),
        )

        if decision == "CORRECT":
            corrected_output_text = normalize(
                review.get(
                    "corrected_output_json",
                    "",
                ),
            )

            corrected_question = normalize(
                review.get(
                    "corrected_question",
                    "",
                ),
            )

            if corrected_output_text:
                try:
                    corrected_output = json.loads(
                        corrected_output_text,
                    )

                except json.JSONDecodeError as error:
                    errors.append(
                        {
                            "example_id":
                                example_id,
                            "error": (
                                "invalid corrected_output_json: "
                                f"{error}"
                            ),
                        },
                    )

                    continue

                if not isinstance(
                    corrected_output,
                    dict,
                ):
                    errors.append(
                        {
                            "example_id":
                                example_id,
                            "error": (
                                "corrected_output_json "
                                "must be an object"
                            ),
                        },
                    )

                    continue

                output = corrected_output

            elif corrected_question:
                output[
                    "question"
                ] = corrected_question

            else:
                errors.append(
                    {
                        "example_id":
                            example_id,
                        "error": (
                            "CORRECT requires "
                            "corrected_question or "
                            "corrected_output_json"
                        ),
                    },
                )

                continue

        source_id = str(
            candidate.get(
                "source_record_id",
                "",
            ),
        )

        if source_id in test_ids:
            errors.append(
                {
                    "example_id":
                        example_id,
                    "error":
                        "source appears in locked test split",
                },
            )

            continue

        source = train_by_id.get(
            source_id,
        )

        if source is None:
            errors.append(
                {
                    "example_id":
                        example_id,
                    "error":
                        "source is missing from training split",
                },
            )

            continue

        task = str(
            candidate.get(
                "task",
                "",
            ),
        )

        validation_errors = validate_output(
            task=task,
            output=output,
            source_text=str(
                source.get(
                    "text",
                    "",
                ),
            ),
        )

        if validation_errors:
            errors.append(
                {
                    "example_id":
                        example_id,
                    "error":
                        " | ".join(
                            validation_errors,
                        ),
                },
            )

            continue

        finalized[
            "output"
        ] = output

        finalized[
            "messages"
        ][-1][
            "content"
        ] = json.dumps(
            output,
            ensure_ascii=False,
        )

        finalized[
            "review_status"
        ] = "human_approved"

        finalized[
            "human_review"
        ] = {
            "decision":
                decision,
            "reviewer":
                normalize(
                    review.get(
                        "reviewer",
                        "",
                    ),
                ),
            "notes":
                normalize(
                    review.get(
                        "notes",
                        "",
                    ),
                ),
            "original_automatic_decision":
                automatic_decision,
            "finalized_at":
                datetime.now(
                    timezone.utc,
                ).isoformat(),
        }

        approved_records.append(
            finalized,
        )

        task_counts[
            task
        ] += 1

        book_counts[
            str(
                finalized.get(
                    "book_id",
                    "",
                ),
            )
        ] += 1

    if errors:
        print()
        print(
            "FINALIZATION VALIDATION FAILED",
        )

        print("=" * 60)

        for error in errors:
            print(
                f"{error['example_id']}: "
                f"{error['error']}",
            )

        error_path = (
            reports_directory
            / "pilot_sft_finalization_errors_v2.json"
        )

        error_path.write_text(
            json.dumps(
                errors,
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        print()
        print(
            "Errors saved:",
            error_path,
        )

        raise SystemExit(1)

    approved_records.sort(
        key=lambda record:
            str(
                record[
                    "example_id"
                ],
            ),
    )

    approved_path = (
        processed_directory
        / "pilot_sft_approved_v2.jsonl"
    )

    write_jsonl(
        approved_path,
        approved_records,
    )

    chat_path = (
        processed_directory
        / "pilot_sft_chat_v2.jsonl"
    )

    chat_records = [
        {
            "example_id":
                record[
                    "example_id"
                ],
            "messages":
                record[
                    "messages"
                ],
        }
        for record in approved_records
    ]

    write_jsonl(
        chat_path,
        chat_records,
    )

    rejected_path = (
        processed_directory
        / "pilot_sft_human_rejected_v2.jsonl"
    )

    write_jsonl(
        rejected_path,
        rejected_rows,
    )

    dataset_hash = sha256_file(
        approved_path,
    )

    summary = {
        "candidate_examples":
            len(candidates),
        "review_rows":
            len(review_rows),
        "approved_examples":
            len(approved_records),
        "human_rejected_examples":
            len(rejected_rows),
        "decision_counts":
            dict(decision_counts),
        "task_counts":
            dict(task_counts),
        "book_counts":
            dict(book_counts),
        "approved_dataset_sha256":
            dataset_hash,
        "approved_dataset_file":
            str(
                approved_path.relative_to(
                    root,
                ),
            ),
        "created_at":
            datetime.now(
                timezone.utc,
            ).isoformat(),
    }

    summary_path = (
        reports_directory
        / "pilot_sft_final_summary_v2.json"
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

    lock_path = (
        reports_directory
        / "pilot_sft_approved_v2_lock.txt"
    )

    lock_path.write_text(
        "\n".join(
            [
                "NCTB Study Companion",
                "Human-Approved Pilot SFT Dataset v2",
                "",
                (
                    "Records: "
                    f"{len(approved_records)}"
                ),
                (
                    "SHA256: "
                    f"{dataset_hash}"
                ),
                (
                    "File: research/data/processed/"
                    "pilot_sft_approved_v2.jsonl"
                ),
                "",
                (
                    "This dataset contains only "
                    "human-approved Classes 6–7 "
                    "pilot examples."
                ),
            ],
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "PILOT SFT V2 FINALIZATION COMPLETE",
    )

    print("=" * 60)

    print(
        "Candidate examples:",
        len(candidates),
    )

    print(
        "Approved examples:",
        len(approved_records),
    )

    print(
        "Human rejected:",
        len(rejected_rows),
    )

    print(
        "Decision counts:",
        dict(decision_counts),
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
        "Approved dataset SHA256:",
        dataset_hash,
    )

    print()
    print(
        "Approved dataset:",
        approved_path,
    )

    print(
        "Chat-format dataset:",
        chat_path,
    )

    print(
        "Rejected records:",
        rejected_path,
    )

    print(
        "Dataset lock:",
        lock_path,
    )

    print(
        "Summary:",
        summary_path,
    )


if __name__ == "__main__":
    main()
