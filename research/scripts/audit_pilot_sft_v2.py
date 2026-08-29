from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata

from collections import Counter
from pathlib import Path
from typing import Any


META_PATTERNS = {
    "lesson list":
        "question is based on a lesson list",
    "table of contents":
        "question is based on contents",
    "page number":
        "question refers to a page number",
    "publisher":
        "question refers to publisher information",
    "copyright":
        "question refers to copyright information",
    "revised edition":
        "question refers to edition information",
    "first publication":
        "question refers to publication information",
    "ocr":
        "question refers to OCR",
}

SOURCE_FRONT_MATTER_PATTERNS = {
    "prescribed by the national curriculum":
        "prescription page",
    "all rights reserved":
        "copyright page",
    "first publication":
        "publication information",
    "revised edition":
        "publication information",
    "for free distribution":
        "distribution information",
    "lesson list":
        "lesson list",
    "table of contents":
        "table of contents",
    "contents":
        "possible contents page",
}

GRAMMAR_PATTERNS = (
    (
        r"\bwhere did\b.*\bheld\b",
        "possible grammar error: did + held",
    ),
    (
        r"\bwhere did\b.*\bwas\b",
        "possible grammar error: did + was",
    ),
    (
        r"\bwhere did\b.*\bwere\b",
        "possible grammar error: did + were",
    ),
    (
        r"\bwhat did\b.*\bwas\b",
        "possible grammar error: did + was",
    ),
    (
        r"\bdoes\b.*\bdoes\b",
        "possible repeated auxiliary verb",
    ),
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
                    f"Invalid JSONL in {path} "
                    f"at line {line_number}: {error}",
                ) from error

            if not isinstance(value, dict):
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


def normalize_lower(
    value: Any,
) -> str:
    return normalize(
        value,
    ).casefold()


def contains_text(
    full_text: Any,
    fragment: Any,
) -> bool:
    normalized_full = normalize_lower(
        full_text,
    )

    normalized_fragment = normalize_lower(
        fragment,
    )

    return (
        bool(normalized_fragment)
        and normalized_fragment
        in normalized_full
    )


def word_count(
    value: Any,
) -> int:
    return len(
        re.findall(
            r"\b[\w’'-]+\b",
            normalize(value),
            flags=re.UNICODE,
        ),
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

    candidate_path = (
        root
        / "research"
        / "data"
        / "processed"
        / "pilot_sft_candidates_v2.jsonl"
    )

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

    output_directory = (
        root
        / "research"
        / "data"
        / "processed"
    )

    report_directory = (
        root
        / "research"
        / "reports"
    )

    output_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    report_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    for required_path in (
        candidate_path,
        train_path,
        test_path,
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
        train_path,
    )

    test_pages = load_jsonl(
        test_path,
    )

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

    question_counts = Counter(
        normalize_lower(
            record.get(
                "output",
                {},
            ).get(
                "question",
                "",
            ),
        )
        for record in candidates
    )

    audit_rows: list[
        dict[str, Any]
    ] = []

    pass_records: list[
        dict[str, Any]
    ] = []

    review_records: list[
        dict[str, Any]
    ] = []

    reject_records: list[
        dict[str, Any]
    ] = []

    decision_counts: Counter[str] = Counter()
    issue_counts: Counter[str] = Counter()

    for record in candidates:
        example_id = str(
            record.get(
                "example_id",
                "",
            ),
        )

        task = str(
            record.get(
                "task",
                "",
            ),
        )

        source_id = str(
            record.get(
                "source_record_id",
                "",
            ),
        )

        source = train_by_id.get(
            source_id,
        )

        output = record.get(
            "output",
            {},
        )

        if not isinstance(output, dict):
            output = {}

        question = normalize(
            output.get(
                "question",
                "",
            ),
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

        options = output.get(
            "options",
            [],
        )

        hard_errors: list[str] = []
        warnings: list[str] = []

        if not example_id:
            hard_errors.append(
                "missing example_id",
            )

        if source_id in test_ids:
            hard_errors.append(
                "source record appears in locked test set",
            )

        if source is None:
            hard_errors.append(
                "source record is missing from training split",
            )

            source_text = ""

        else:
            source_text = normalize(
                source.get(
                    "text",
                    "",
                ),
            )

        if not question:
            hard_errors.append(
                "question is empty",
            )

        if not answer:
            hard_errors.append(
                "answer is empty",
            )

        if not evidence:
            hard_errors.append(
                "evidence quote is empty",
            )

        if source_text:
            if not contains_text(
                source_text,
                answer,
            ):
                hard_errors.append(
                    "answer is not contained in source passage",
                )

            if not contains_text(
                source_text,
                evidence,
            ):
                hard_errors.append(
                    "evidence is not contained in source passage",
                )

        if (
            answer
            and evidence
            and not contains_text(
                evidence,
                answer,
            )
        ):
            hard_errors.append(
                "evidence does not contain the answer",
            )

        if task == "generate_mcq":
            if not isinstance(
                options,
                list,
            ):
                hard_errors.append(
                    "MCQ options are not an array",
                )

                options = []

            if len(options) != 4:
                hard_errors.append(
                    "MCQ does not contain four options",
                )

            normalized_options = [
                normalize_lower(option)
                for option in options
            ]

            if (
                normalized_options
                and len(
                    set(normalized_options),
                )
                != len(normalized_options)
            ):
                hard_errors.append(
                    "MCQ contains duplicate options",
                )

            if (
                answer
                and normalize_lower(answer)
                not in normalized_options
            ):
                hard_errors.append(
                    "correct answer does not match an option",
                )

        question_words = word_count(
            question,
        )

        answer_words = word_count(
            answer,
        )

        evidence_words = word_count(
            evidence,
        )

        if not question.endswith("?"):
            warnings.append(
                "question does not end with a question mark",
            )

        if question_words < 4:
            warnings.append(
                "question contains fewer than four words",
            )

        if question_words > 35:
            warnings.append(
                "question contains more than 35 words",
            )

        if answer_words > 25:
            warnings.append(
                "answer contains more than 25 words",
            )

        if evidence_words > 70:
            warnings.append(
                "evidence quote is unusually long",
            )

        normalized_question = normalize_lower(
            question,
        )

        if (
            normalized_question
            and question_counts[
                normalized_question
            ]
            > 1
        ):
            warnings.append(
                "duplicate question text",
            )

        question_and_answer = (
            normalize_lower(
                question
                + " "
                + answer
            )
        )

        for pattern, description in (
            META_PATTERNS.items()
        ):
            if pattern in question_and_answer:
                hard_errors.append(
                    description,
                )

        if source:
            source_lower = normalize_lower(
                source_text,
            )

            page_number = int(
                source.get(
                    "page_number",
                    0,
                )
                or 0
            )

            for pattern, description in (
                SOURCE_FRONT_MATTER_PATTERNS.items()
            ):
                if pattern not in source_lower:
                    continue

                if (
                    pattern == "contents"
                    and page_number > 15
                ):
                    continue

                hard_errors.append(
                    f"source appears to be "
                    f"front matter: {description}",
                )

            if bool(
                source.get(
                    "manual_review_required",
                    False,
                )
            ):
                warnings.append(
                    "source page requires manual review",
                )

            curation_flags = source.get(
                "curation_flags",
                [],
            )

            if isinstance(
                curation_flags,
                list,
            ):
                for flag in curation_flags:
                    if flag in (
                        "OCR_REVIEW_NEEDED",
                        "MULTIPLE_OCR_VERSIONS",
                        "ENCODING_REPAIRED",
                    ):
                        warnings.append(
                            f"source flag: {flag}",
                        )

        for pattern, description in (
            GRAMMAR_PATTERNS
        ):
            if re.search(
                pattern,
                normalized_question,
                flags=re.IGNORECASE,
            ):
                warnings.append(
                    description,
                )

        hard_errors = sorted(
            set(hard_errors),
        )

        warnings = sorted(
            set(warnings),
        )

        if hard_errors:
            decision = "REJECT"

        elif warnings:
            decision = "REVIEW"

        else:
            decision = "PASS"

        decision_counts[
            decision
        ] += 1

        for issue in (
            hard_errors
            + warnings
        ):
            issue_counts[
                issue
            ] += 1

        audited_record = dict(
            record,
        )

        audited_record[
            "automatic_audit"
        ] = {
            "decision":
                decision,
            "hard_errors":
                hard_errors,
            "warnings":
                warnings,
        }

        audited_record[
            "review_status"
        ] = (
            "automatic_pass_pending_human_review"
            if decision == "PASS"
            else (
                "manual_review_required"
                if decision == "REVIEW"
                else "automatic_reject"
            )
        )

        if decision == "PASS":
            pass_records.append(
                audited_record,
            )

        elif decision == "REVIEW":
            review_records.append(
                audited_record,
            )

        else:
            reject_records.append(
                audited_record,
            )

        audit_rows.append(
            {
                "example_id":
                    example_id,
                "task":
                    task,
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
                    question,
                "options":
                    json.dumps(
                        options,
                        ensure_ascii=False,
                    ),
                "answer":
                    answer,
                "evidence_quote":
                    evidence,
                "automatic_decision":
                    decision,
                "hard_errors":
                    " | ".join(
                        hard_errors,
                    ),
                "warnings":
                    " | ".join(
                        warnings,
                    ),
                "human_decision":
                    "",
                "reviewer":
                    "",
                "corrected_question":
                    "",
                "corrected_output_json":
                    "",
                "notes":
                    "",
                "source_preview":
                    source_text[:400],
            },
        )

    audit_csv_path = (
        output_directory
        / "pilot_sft_quality_audit_v2.csv"
    )

    audit_fields = [
        "example_id",
        "task",
        "book_id",
        "class_level",
        "page_number",
        "question",
        "options",
        "answer",
        "evidence_quote",
        "automatic_decision",
        "hard_errors",
        "warnings",
        "human_decision",
        "reviewer",
        "corrected_question",
        "corrected_output_json",
        "notes",
        "source_preview",
    ]

    with audit_csv_path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=
                audit_fields,
        )

        writer.writeheader()
        writer.writerows(
            audit_rows,
        )

    pass_path = (
        output_directory
        / "pilot_sft_auto_pass_v2.jsonl"
    )

    review_path = (
        output_directory
        / "pilot_sft_needs_review_v2.jsonl"
    )

    reject_path = (
        output_directory
        / "pilot_sft_auto_reject_v2.jsonl"
    )

    write_jsonl(
        pass_path,
        pass_records,
    )

    write_jsonl(
        review_path,
        review_records,
    )

    write_jsonl(
        reject_path,
        reject_records,
    )

    candidate_count = len(
        candidates,
    )

    usable_before_human_review = (
        len(pass_records)
        + len(review_records)
    )

    automatic_pass_rate = (
        round(
            (
                len(pass_records)
                / candidate_count
                * 100
            ),
            2,
        )
        if candidate_count
        else 0
    )

    non_reject_rate = (
        round(
            (
                usable_before_human_review
                / candidate_count
                * 100
            ),
            2,
        )
        if candidate_count
        else 0
    )

    summary = {
        "candidate_examples":
            candidate_count,
        "automatic_pass":
            len(pass_records),
        "manual_review_required":
            len(review_records),
        "automatic_reject":
            len(reject_records),
        "automatic_pass_rate_percent":
            automatic_pass_rate,
        "non_reject_rate_percent":
            non_reject_rate,
        "decision_counts":
            dict(decision_counts),
        "issue_counts":
            dict(
                issue_counts.most_common(),
            ),
    }

    summary_json_path = (
        report_directory
        / "pilot_sft_quality_summary_v2.json"
    )

    summary_json_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    report_lines = [
        "# Pilot SFT Quality Audit v2",
        "",
        "## Summary",
        "",
        (
            f"- Candidate examples: "
            f"{candidate_count}"
        ),
        (
            f"- Automatic pass: "
            f"{len(pass_records)}"
        ),
        (
            f"- Manual review required: "
            f"{len(review_records)}"
        ),
        (
            f"- Automatic reject: "
            f"{len(reject_records)}"
        ),
        (
            f"- Automatic pass rate: "
            f"{automatic_pass_rate}%"
        ),
        (
            f"- Non-reject rate: "
            f"{non_reject_rate}%"
        ),
        "",
        "## Detected Issues",
        "",
    ]

    if issue_counts:
        for issue, count in (
            issue_counts.most_common()
        ):
            report_lines.append(
                f"- {issue}: {count}",
            )

    else:
        report_lines.append(
            "- No issues detected.",
        )

    report_lines.extend(
        [
            "",
            "## Research Decision",
            "",
            (
                "- Automatic PASS does not "
                "replace human review."
            ),
            (
                "- REVIEW records may be accepted "
                "after correction."
            ),
            (
                "- REJECT records must not enter "
                "the fine-tuning dataset."
            ),
            (
                "- The locked test split was not "
                "used during candidate generation."
            ),
        ],
    )

    report_path = (
        report_directory
        / "pilot_sft_quality_report_v2.md"
    )

    report_path.write_text(
        "\n".join(
            report_lines,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "PILOT SFT V2 QUALITY AUDIT COMPLETE",
    )

    print("=" * 60)

    print(
        "Candidate examples:",
        candidate_count,
    )

    print(
        "Automatic PASS:",
        len(pass_records),
    )

    print(
        "Needs REVIEW:",
        len(review_records),
    )

    print(
        "Automatic REJECT:",
        len(reject_records),
    )

    print(
        "Automatic pass rate:",
        f"{automatic_pass_rate}%",
    )

    print(
        "Non-reject rate:",
        f"{non_reject_rate}%",
    )

    print()
    print("Most common issues:")

    for issue, count in (
        issue_counts.most_common(
            15,
        )
    ):
        print(
            f"  {count} × {issue}",
        )

    print()
    print(
        "Audit CSV:",
        audit_csv_path,
    )

    print(
        "Auto-pass JSONL:",
        pass_path,
    )

    print(
        "Needs-review JSONL:",
        review_path,
    )

    print(
        "Rejected JSONL:",
        reject_path,
    )

    print(
        "Report:",
        report_path,
    )


if __name__ == "__main__":
    main()
