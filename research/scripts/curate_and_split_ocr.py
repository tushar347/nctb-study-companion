from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata

from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MOJIBAKE_REPLACEMENTS = {
    "â€™": "’",
    "â€˜": "‘",
    "â€œ": "“",
    "â€": "”",
    "â€“": "–",
    "â€”": "—",
    "â€¦": "…",
    "Â ": " ",
    "Â": "",
}

STRONG_FRONT_MATTER_PATTERNS = {
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
    "table of contents":
        "contents page",
    "isbn":
        "publication identifier",
}

SUPPORTING_FRONT_MATTER_PATTERNS = {
    "chairman":
        "administrative signature",
    "writers":
        "contributor listing",
    "editors":
        "contributor listing",
    "reviewers":
        "contributor listing",
    "illustrators":
        "contributor listing",
    "graphic designers":
        "contributor listing",
    "preface":
        "preface",
    "foreword":
        "foreword",
    "national education policy":
        "policy preface",
    "curriculum provides":
        "curriculum preface",
    "would like to thank":
        "acknowledgement",
    "contributed to the book":
        "acknowledgement",
}

KNOWN_OCR_WARNING_PATTERNS = {
    r"\beducationis\b":
        "possible joined words",
    r"\bgencration\b":
        "possible OCR spelling error",
    r"\bcxpericnced\b":
        "possible OCR spelling error",
    r"\bduc to\b":
        "possible OCR spelling error",
    r"\bicarning\b":
        "possible OCR spelling error",
    r"\blanguageskills\b":
        "possible joined words",
    r"\bthebook\b":
        "possible joined words",
    r"\bthetextbook\b":
        "possible joined words",
    r"\bacurriculum\b":
        "possible joined words",
}

INVALID_CONTENT_PATTERNS = {
    "<!doctype html":
        "HTML error content",
    "<html":
        "HTML content",
    "node_modules":
        "development output",
    "require stack:":
        "stack trace",
    "internal server error":
        "server error output",
}


def load_jsonl(
    path: Path,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

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
                    f"Invalid JSONL at line "
                    f"{line_number}: {error}",
                ) from error

            if not isinstance(
                value,
                dict,
            ):
                raise ValueError(
                    f"Line {line_number} is not "
                    "a JSON object.",
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


def sha256_file(
    path: Path,
) -> str:
    digest = hashlib.sha256()

    with path.open(
        "rb",
    ) as handle:
        while True:
            chunk = handle.read(
                1024 * 1024,
            )

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


def stable_hash(
    text: str,
) -> str:
    return hashlib.sha256(
        text.encode(
            "utf-8",
        ),
    ).hexdigest()


def normalize_text(
    value: Any,
) -> tuple[str, list[str]]:
    text = str(
        value or "",
    )

    changes: list[str] = []

    for old, new in (
        MOJIBAKE_REPLACEMENTS.items()
    ):
        if old in text:
            text = text.replace(
                old,
                new,
            )

            changes.append(
                f"encoding:{old!r}->{new!r}",
            )

    normalized = unicodedata.normalize(
        "NFKC",
        text,
    )

    if normalized != text:
        changes.append(
            "unicode-normalized",
        )

    text = normalized

    text = text.replace(
        "\u00a0",
        " ",
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    ).strip()

    text = re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        text,
    )

    text = re.sub(
        r"([,.;:!?])([A-Za-z])",
        r"\1 \2",
        text,
    )

    return (
        text,
        sorted(
            set(changes),
        ),
    )


def word_count(
    text: str,
) -> int:
    return len(
        re.findall(
            r"\b[\w’'-]+\b",
            text,
            flags=re.UNICODE,
        ),
    )


def alpha_ratio(
    text: str,
) -> float:
    if not text:
        return 0.0

    alphabetic = sum(
        character.isalpha()
        for character in text
    )

    return round(
        alphabetic /
        max(
            1,
            len(text),
        ),
        4,
    )


def detect_front_matter(
    text: str,
    page_number: int,
) -> tuple[bool, list[str]]:
    lower = text.lower()

    reasons: list[str] = []

    strong_matches = []

    for pattern, description in (
        STRONG_FRONT_MATTER_PATTERNS.items()
    ):
        if pattern in lower:
            strong_matches.append(
                description,
            )

    supporting_matches = []

    for pattern, description in (
        SUPPORTING_FRONT_MATTER_PATTERNS.items()
    ):
        if pattern in lower:
            supporting_matches.append(
                description,
            )

    if strong_matches:
        reasons.extend(
            strong_matches,
        )

        return (
            True,
            sorted(
                set(reasons),
            ),
        )

    if (
        page_number <= 15
        and len(
            supporting_matches,
        ) >= 2
    ):
        reasons.extend(
            supporting_matches,
        )

        return (
            True,
            sorted(
                set(reasons),
            ),
        )

    return (
        False,
        [],
    )


def detect_ocr_warnings(
    text: str,
) -> list[str]:
    warnings: list[str] = []

    if "�" in text:
        warnings.append(
            "replacement character present",
        )

    for pattern, description in (
        KNOWN_OCR_WARNING_PATTERNS.items()
    ):
        if re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        ):
            warnings.append(
                description,
            )

    repeated_space_merges = re.findall(
        r"\b[a-z]{14,}\b",
        text,
        flags=re.IGNORECASE,
    )

    if len(
        repeated_space_merges,
    ) >= 3:
        warnings.append(
            "several unusually long tokens",
        )

    return sorted(
        set(warnings),
    )


def detect_invalid_content(
    text: str,
) -> list[str]:
    lower = text.lower()

    reasons: list[str] = []

    for pattern, description in (
        INVALID_CONTENT_PATTERNS.items()
    ):
        if pattern in lower:
            reasons.append(
                description,
            )

    return sorted(
        set(reasons),
    )


def integer_value(
    value: Any,
) -> int | None:
    if value is None:
        return None

    try:
        return int(value)
    except (
        TypeError,
        ValueError,
    ):
        return None


def build_group_key(
    record: dict[str, Any],
) -> str:
    book_id = str(
        record["book_id"],
    )

    lesson_number = integer_value(
        record.get(
            "lesson_number",
        ),
    )

    if lesson_number is not None:
        return (
            f"{book_id}:lesson:"
            f"{lesson_number:03d}"
        )

    page_number = int(
        record["page_number"],
    )

    block_number = (
        (
            page_number -
            1
        )
        // 5
    ) + 1

    return (
        f"{book_id}:page-block:"
        f"{block_number:03d}"
    )


def assign_group_splits(
    records: list[dict[str, Any]],
) -> dict[str, str]:
    groups_by_book: dict[
        str,
        set[str],
    ] = defaultdict(set)

    for record in records:
        groups_by_book[
            str(
                record[
                    "book_id"
                ],
            )
        ].add(
            str(
                record[
                    "split_group"
                ],
            ),
        )

    assignments: dict[
        str,
        str,
    ] = {}

    for book_id, group_set in (
        groups_by_book.items()
    ):
        ordered_groups = sorted(
            group_set,
            key=lambda group:
                stable_hash(
                    group,
                ),
        )

        group_count = len(
            ordered_groups,
        )

        if group_count < 3:
            for group in ordered_groups:
                assignments[
                    group
                ] = "train"

            continue

        test_count = max(
            1,
            round(
                group_count *
                0.10,
            ),
        )

        validation_count = max(
            1,
            round(
                group_count *
                0.10,
            ),
        )

        while (
            test_count +
            validation_count
            >= group_count
        ):
            if validation_count > 1:
                validation_count -= 1
            elif test_count > 1:
                test_count -= 1
            else:
                break

        test_groups = set(
            ordered_groups[
                :test_count
            ],
        )

        validation_groups = set(
            ordered_groups[
                test_count:
                test_count +
                validation_count
            ],
        )

        for group in ordered_groups:
            if group in test_groups:
                assignments[
                    group
                ] = "test"

            elif group in validation_groups:
                assignments[
                    group
                ] = "validation"

            else:
                assignments[
                    group
                ] = "train"

    return assignments


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    parser.add_argument(
        "--manifest",
        default=(
            "research/data/processed/"
            "ocr_passage_manifest.jsonl"
        ),
    )

    arguments = parser.parse_args()

    root = Path(
        arguments.root,
    ).resolve()

    manifest_path = (
        root /
        arguments.manifest
    )

    if not manifest_path.exists():
        raise FileNotFoundError(
            f"Manifest not found: "
            f"{manifest_path}",
        )

    processed_directory = (
        root /
        "research" /
        "data" /
        "processed"
    )

    splits_directory = (
        root /
        "research" /
        "data" /
        "splits"
    )

    reports_directory = (
        root /
        "research" /
        "reports"
    )

    configs_directory = (
        root /
        "research" /
        "configs"
    )

    for directory in (
        processed_directory,
        splits_directory,
        reports_directory,
        configs_directory,
    ):
        directory.mkdir(
            parents=True,
            exist_ok=True,
        )

    source_records = load_jsonl(
        manifest_path,
    )

    curated_records: list[
        dict[str, Any]
    ] = []

    review_rows: list[
        dict[str, Any]
    ] = []

    flag_counts: Counter[str] = Counter()
    exclusion_counts: Counter[str] = Counter()

    for source_record in source_records:
        record = dict(
            source_record,
        )

        original_text = str(
            record.get(
                "text",
                "",
            ),
        )

        cleaned_text, encoding_changes = (
            normalize_text(
                original_text,
            )
        )

        page_number = int(
            record[
                "page_number"
            ],
        )

        class_level = integer_value(
            record.get(
                "class_level",
            ),
        )

        current_word_count = word_count(
            cleaned_text,
        )

        current_alpha_ratio = alpha_ratio(
            cleaned_text,
        )

        front_matter, front_reasons = (
            detect_front_matter(
                cleaned_text,
                page_number,
            )
        )

        invalid_reasons = (
            detect_invalid_content(
                cleaned_text,
            )
        )

        ocr_warnings = (
            detect_ocr_warnings(
                cleaned_text,
            )
        )

        text_conflict = (
            int(
                record.get(
                    "candidate_text_versions",
                    1,
                ),
            )
            > 1
        )

        curation_flags: list[str] = []

        if front_matter:
            curation_flags.append(
                "FRONT_MATTER",
            )

        if current_word_count < 40:
            curation_flags.append(
                "TOO_SHORT_FOR_SFT",
            )

        if current_word_count > 600:
            curation_flags.append(
                "TOO_LONG_FOR_SFT",
            )

        if current_alpha_ratio < 0.45:
            curation_flags.append(
                "LOW_ALPHA_RATIO",
            )

        if invalid_reasons:
            curation_flags.append(
                "INVALID_CONTENT",
            )

        if encoding_changes:
            curation_flags.append(
                "ENCODING_REPAIRED",
            )

        if ocr_warnings:
            curation_flags.append(
                "OCR_REVIEW_NEEDED",
            )

        if text_conflict:
            curation_flags.append(
                "MULTIPLE_OCR_VERSIONS",
            )

        if class_level == 8:
            curation_flags.append(
                "CLASS8_EXTERNAL_ONLY",
            )

        if class_level not in (
            6,
            7,
            8,
        ):
            curation_flags.append(
                "UNSUPPORTED_CLASS",
            )

        include_for_rag = (
            not front_matter
            and not invalid_reasons
            and current_word_count >= 20
            and current_alpha_ratio >= 0.35
            and class_level in (
                6,
                7,
                8,
            )
        )

        include_for_sft = (
            not front_matter
            and not invalid_reasons
            and 40 <=
                current_word_count
                <= 600
            and current_alpha_ratio
                >= 0.45
            and class_level in (
                6,
                7,
            )
        )

        record[
            "original_text_sha256"
        ] = record.get(
            "text_sha256",
        )

        record[
            "text"
        ] = cleaned_text

        record[
            "text_sha256"
        ] = stable_hash(
            cleaned_text.lower(),
        )

        record[
            "word_count"
        ] = current_word_count

        record[
            "character_count"
        ] = len(
            cleaned_text,
        )

        record[
            "alpha_ratio"
        ] = current_alpha_ratio

        record[
            "encoding_changes"
        ] = encoding_changes

        record[
            "front_matter_reasons"
        ] = front_reasons

        record[
            "invalid_content_reasons"
        ] = invalid_reasons

        record[
            "ocr_warnings"
        ] = ocr_warnings

        record[
            "curation_flags"
        ] = sorted(
            set(
                curation_flags,
            ),
        )

        record[
            "include_for_rag"
        ] = include_for_rag

        record[
            "include_for_sft"
        ] = include_for_sft

        record[
            "manual_review_required"
        ] = bool(
            ocr_warnings
            or text_conflict
            or encoding_changes
        )

        record[
            "split_group"
        ] = build_group_key(
            record,
        )

        record[
            "split"
        ] = None

        curated_records.append(
            record,
        )

        for flag in record[
            "curation_flags"
        ]:
            flag_counts[
                flag
            ] += 1

        if not include_for_sft:
            if front_matter:
                exclusion_counts[
                    "front matter"
                ] += 1

            if current_word_count < 40:
                exclusion_counts[
                    "fewer than 40 words"
                ] += 1

            if current_word_count > 600:
                exclusion_counts[
                    "more than 600 words"
                ] += 1

            if invalid_reasons:
                exclusion_counts[
                    "invalid content"
                ] += 1

            if class_level == 8:
                exclusion_counts[
                    "Class 8 external test only"
                ] += 1

        if (
            record[
                "manual_review_required"
            ]
            or not include_for_sft
        ):
            review_reasons = (
                record[
                    "curation_flags"
                ]
                + front_reasons
                + invalid_reasons
                + ocr_warnings
            )

            review_rows.append(
                {
                    "record_id":
                        record[
                            "record_id"
                        ],
                    "book_id":
                        record[
                            "book_id"
                        ],
                    "class_level":
                        class_level,
                    "page_number":
                        page_number,
                    "lesson_number":
                        record.get(
                            "lesson_number",
                        ),
                    "include_for_rag":
                        include_for_rag,
                    "include_for_sft":
                        include_for_sft,
                    "manual_review_required":
                        record[
                            "manual_review_required"
                        ],
                    "candidate_text_versions":
                        record.get(
                            "candidate_text_versions",
                            1,
                        ),
                    "review_reasons":
                        " | ".join(
                            sorted(
                                set(
                                    review_reasons,
                                ),
                            ),
                        ),
                    "text_preview":
                        cleaned_text[
                            :350
                        ],
                    "source_file":
                        record.get(
                            "source_file",
                        ),
                },
            )

    eligible_records = [
        record
        for record
        in curated_records
        if record[
            "include_for_sft"
        ]
    ]

    split_assignments = (
        assign_group_splits(
            eligible_records,
        )
    )

    train_records: list[
        dict[str, Any]
    ] = []

    validation_records: list[
        dict[str, Any]
    ] = []

    test_records: list[
        dict[str, Any]
    ] = []

    external_class8_records: list[
        dict[str, Any]
    ] = []

    for record in curated_records:
        class_level = integer_value(
            record.get(
                "class_level",
            ),
        )

        if (
            class_level == 8
            and record[
                "include_for_rag"
            ]
        ):
            record[
                "split"
            ] = "external_class8"

            external_class8_records.append(
                record,
            )

            continue

        if not record[
            "include_for_sft"
        ]:
            continue

        split = split_assignments[
            record[
                "split_group"
            ]
        ]

        record[
            "split"
        ] = split

        if split == "train":
            train_records.append(
                record,
            )

        elif split == "validation":
            validation_records.append(
                record,
            )

        elif split == "test":
            test_records.append(
                record,
            )

    split_files = {
        "train":
            splits_directory /
            "train_pages_v1.jsonl",
        "validation":
            splits_directory /
            "validation_pages_v1.jsonl",
        "test":
            splits_directory /
            "test_pages_v1_locked.jsonl",
        "external_class8":
            splits_directory /
            "external_class8_pages_v1.jsonl",
    }

    write_jsonl(
        split_files[
            "train"
        ],
        train_records,
    )

    write_jsonl(
        split_files[
            "validation"
        ],
        validation_records,
    )

    write_jsonl(
        split_files[
            "test"
        ],
        test_records,
    )

    write_jsonl(
        split_files[
            "external_class8"
        ],
        external_class8_records,
    )

    curated_manifest_path = (
        processed_directory /
        "ocr_curated_manifest_v1.jsonl"
    )

    write_jsonl(
        curated_manifest_path,
        curated_records,
    )

    review_path = (
        processed_directory /
        "ocr_manual_review_queue_v1.csv"
    )

    review_fields = [
        "record_id",
        "book_id",
        "class_level",
        "page_number",
        "lesson_number",
        "include_for_rag",
        "include_for_sft",
        "manual_review_required",
        "candidate_text_versions",
        "review_reasons",
        "text_preview",
        "source_file",
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
        writer.writerows(
            review_rows,
        )

    split_metadata_path = (
        splits_directory /
        "split_metadata_v1.csv"
    )

    split_metadata_fields = [
        "record_id",
        "book_id",
        "class_level",
        "page_number",
        "lesson_number",
        "split_group",
        "split",
        "word_count",
        "manual_review_required",
        "curation_flags",
        "text_sha256",
    ]

    with split_metadata_path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=
                split_metadata_fields,
        )

        writer.writeheader()

        for record in curated_records:
            if not record.get(
                "split",
            ):
                continue

            writer.writerow(
                {
                    "record_id":
                        record[
                            "record_id"
                        ],
                    "book_id":
                        record[
                            "book_id"
                        ],
                    "class_level":
                        record.get(
                            "class_level",
                        ),
                    "page_number":
                        record[
                            "page_number"
                        ],
                    "lesson_number":
                        record.get(
                            "lesson_number",
                        ),
                    "split_group":
                        record[
                            "split_group"
                        ],
                    "split":
                        record[
                            "split"
                        ],
                    "word_count":
                        record[
                            "word_count"
                        ],
                    "manual_review_required":
                        record[
                            "manual_review_required"
                        ],
                    "curation_flags":
                        "|".join(
                            record[
                                "curation_flags"
                            ],
                        ),
                    "text_sha256":
                        record[
                            "text_sha256"
                        ],
                },
            )

    test_hash = sha256_file(
        split_files[
            "test"
        ],
    )

    lock_path = (
        reports_directory /
        "test_split_v1_lock.txt"
    )

    generated_at = datetime.now(
        timezone.utc,
    ).isoformat()

    lock_path.write_text(
        "\n".join(
            [
                "NCTB Study Companion",
                "Locked Test Page Split v1",
                "",
                f"Generated: {generated_at}",
                (
                    "File: research/data/splits/"
                    "test_pages_v1_locked.jsonl"
                ),
                f"Records: {len(test_records)}",
                f"SHA256: {test_hash}",
                "",
                (
                    "Do not use these pages to "
                    "generate training examples."
                ),
                (
                    "Do not replace or edit this "
                    "test file after baseline "
                    "evaluation begins."
                ),
            ],
        )
        + "\n",
        encoding="utf-8",
    )

    counts_by_split = {
        "train":
            len(train_records),
        "validation":
            len(
                validation_records,
            ),
        "test":
            len(test_records),
        "external_class8":
            len(
                external_class8_records,
            ),
    }

    counts_by_book_split: dict[
        str,
        Counter[str],
    ] = defaultdict(Counter)

    for record in (
        train_records
        + validation_records
        + test_records
        + external_class8_records
    ):
        counts_by_book_split[
            str(
                record[
                    "book_id"
                ],
            )
        ][
            str(
                record[
                    "split"
                ],
            )
        ] += 1

    summary = {
        "generated_at":
            generated_at,
        "source_records":
            len(source_records),
        "rag_records":
            sum(
                int(
                    record[
                        "include_for_rag"
                    ],
                )
                for record
                in curated_records
            ),
        "sft_records":
            len(
                eligible_records,
            ),
        "manual_review_rows":
            len(review_rows),
        "counts_by_split":
            counts_by_split,
        "counts_by_book_split": {
            book:
                dict(counts)
            for book, counts
            in counts_by_book_split.items()
        },
        "curation_flag_counts":
            dict(flag_counts),
        "exclusion_counts":
            dict(
                exclusion_counts,
            ),
        "test_sha256":
            test_hash,
    }

    summary_json_path = (
        reports_directory /
        "curation_split_summary_v1.json"
    )

    summary_json_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    report_lines = [
        "# OCR Curation and Dataset Split v1",
        "",
        f"Generated: {generated_at}",
        "",
        "## Curation Results",
        "",
        (
            f"- Source canonical pages: "
            f"{len(source_records)}"
        ),
        (
            f"- RAG-eligible pages: "
            f"{summary['rag_records']}"
        ),
        (
            f"- SFT-eligible pages "
            f"(Classes 6 and 7): "
            f"{summary['sft_records']}"
        ),
        (
            f"- Manual-review queue rows: "
            f"{len(review_rows)}"
        ),
        "",
        "## Locked Splits",
        "",
        "| Split | Pages |",
        "|---|---:|",
    ]

    for split_name in (
        "train",
        "validation",
        "test",
        "external_class8",
    ):
        report_lines.append(
            f"| `{split_name}` | "
            f"{counts_by_split[split_name]} |",
        )

    report_lines.extend(
        [
            "",
            "## Pages by Book and Split",
            "",
            (
                "| Book | Train | Validation | "
                "Test | External Class 8 |"
            ),
            "|---|---:|---:|---:|---:|",
        ],
    )

    for book in sorted(
        counts_by_book_split,
    ):
        counts = (
            counts_by_book_split[
                book
            ]
        )

        report_lines.append(
            (
                f"| `{book}` | "
                f"{counts.get('train', 0)} | "
                f"{counts.get('validation', 0)} | "
                f"{counts.get('test', 0)} | "
                f"{counts.get('external_class8', 0)} |"
            ),
        )

    report_lines.extend(
        [
            "",
            "## Curation Flags",
            "",
        ],
    )

    for flag, count in (
        flag_counts.most_common()
    ):
        report_lines.append(
            f"- {flag}: {count}",
        )

    report_lines.extend(
        [
            "",
            "## Exclusion Reasons",
            "",
        ],
    )

    for reason, count in (
        exclusion_counts.most_common()
    ):
        report_lines.append(
            f"- {reason}: {count}",
        )

    report_lines.extend(
        [
            "",
            "## Leakage Prevention",
            "",
            (
                "- Pages with a lesson number "
                "were grouped by book and lesson."
            ),
            (
                "- Pages without lesson metadata "
                "were grouped into contiguous "
                "five-page blocks."
            ),
            (
                "- Every group was assigned wholly "
                "to train, validation, or test."
            ),
            (
                "- Class 8 was excluded from the "
                "main SFT split because only five "
                "canonical pages are available."
            ),
            (
                "- Class 8 is retained as a small "
                "exploratory external test set."
            ),
            "",
            "## Locked Test Set",
            "",
            (
                "- Test pages: "
                f"{len(test_records)}"
            ),
            (
                "- SHA256: "
                f"`{test_hash}`"
            ),
            (
                "- The test pages must not be sent "
                "to a model for training-data "
                "generation."
            ),
            "",
            "## Files",
            "",
            (
                "- Curated local manifest: "
                "`research/data/processed/"
                "ocr_curated_manifest_v1.jsonl`"
            ),
            (
                "- Manual review queue: "
                "`research/data/processed/"
                "ocr_manual_review_queue_v1.csv`"
            ),
            (
                "- Split metadata: "
                "`research/data/splits/"
                "split_metadata_v1.csv`"
            ),
            (
                "- Test lock: "
                "`research/reports/"
                "test_split_v1_lock.txt`"
            ),
        ],
    )

    report_path = (
        reports_directory /
        "curation_split_report_v1.md"
    )

    report_path.write_text(
        "\n".join(
            report_lines,
        )
        + "\n",
        encoding="utf-8",
    )

    config_path = (
        configs_directory /
        "curation_split_config_v1.json"
    )

    config_path.write_text(
        json.dumps(
            {
                "version": "v1",
                "minimum_sft_words": 40,
                "maximum_sft_words": 600,
                "minimum_sft_alpha_ratio": 0.45,
                "minimum_rag_words": 20,
                "page_block_size": 5,
                "main_sft_classes": [
                    6,
                    7,
                ],
                "external_test_classes": [
                    8,
                ],
                "test_sha256":
                    test_hash,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "OCR CURATION AND SPLIT COMPLETE",
    )

    print("=" * 60)

    print(
        "Source pages:",
        len(source_records),
    )

    print(
        "RAG-eligible pages:",
        summary[
            "rag_records"
        ],
    )

    print(
        "SFT-eligible pages:",
        summary[
            "sft_records"
        ],
    )

    print(
        "Manual-review rows:",
        len(review_rows),
    )

    print()
    print("Split counts:")

    for split_name, count in (
        counts_by_split.items()
    ):
        print(
            f"  {split_name}: {count}",
        )

    print()
    print(
        "Test split SHA256:",
        test_hash,
    )

    print()
    print(
        "Report:",
        report_path,
    )

    print(
        "Review queue:",
        review_path,
    )

    print(
        "Split metadata:",
        split_metadata_path,
    )

    print(
        "Test lock:",
        lock_path,
    )


if __name__ == "__main__":
    main()
