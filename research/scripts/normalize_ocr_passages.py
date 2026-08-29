from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


TEXT_PRIORITY = (
    "aiReadyText",
    "cleanText",
    "rawText",
)

PAGE_NUMBER_KEYS = (
    "pageNumber",
    "textbookPage",
    "textbook_page",
    "page",
    "pdfPage",
    "pdf_page",
)

BOOK_ID_KEYS = (
    "bookId",
    "book_id",
    "bookKey",
    "book_key",
)

LESSON_NUMBER_KEYS = (
    "lessonNo",
    "lesson_no",
    "lessonNumber",
    "lesson_number",
)

LESSON_TITLE_KEYS = (
    "lessonTitle",
    "lesson_title",
    "title",
)

CLASS_WORDS = {
    "six": 6,
    "seven": 7,
    "eight": 8,
    "6": 6,
    "7": 7,
    "8": 8,
}

INVALID_TEXT_MARKERS = (
    "<!doctype html",
    "<html",
    "node_modules",
    "require stack:",
    "internal server error",
    "webpack",
    "turbopack",
)


def clean_space(
    value: Any,
) -> str:
    return re.sub(
        r"\s+",
        " ",
        str(value or ""),
    ).strip()


def safe_integer(
    value: Any,
) -> int | None:
    if isinstance(
        value,
        bool,
    ):
        return None

    if isinstance(
        value,
        int,
    ):
        return value

    if isinstance(
        value,
        float,
    ):
        return int(value)

    text = clean_space(
        value,
    )

    match = re.search(
        r"\d+",
        text,
    )

    if not match:
        return None

    try:
        return int(
            match.group(0),
        )
    except ValueError:
        return None


def first_present(
    value: dict[str, Any],
    keys: tuple[str, ...],
) -> Any:
    for key in keys:
        candidate = value.get(
            key,
        )

        if candidate not in (
            None,
            "",
        ):
            return candidate

    return None


def infer_book_id_from_path(
    path: Path,
) -> str | None:
    text = str(
        path,
    ).lower()

    patterns = (
        r"class[-_ ]?([678])[-_ ]?english",
        r"english[-_ ]?class[-_ ]?([678])",
        r"eft[-_ ]?c([678])",
        r"class[-_ ]?([678])",
    )

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
        )

        if match:
            return (
                f"class{match.group(1)}-english"
            )

    return None


def normalize_book_id(
    value: Any,
    source_path: Path,
    class_value: Any = None,
) -> str | None:
    text = clean_space(
        value,
    ).lower()

    text = re.sub(
        r"[\s_]+",
        "-",
        text,
    )

    if text:
        class_match = re.search(
            r"class-?([678])",
            text,
        )

        if class_match:
            return (
                f"class{class_match.group(1)}-english"
            )

        if text in (
            "class6-english",
            "class7-english",
            "class8-english",
        ):
            return text

    class_text = clean_space(
        class_value,
    ).lower()

    if class_text in CLASS_WORDS:
        return (
            f"class{CLASS_WORDS[class_text]}-english"
        )

    return infer_book_id_from_path(
        source_path,
    )


def infer_class_level(
    book_id: str | None,
    class_value: Any = None,
) -> int | None:
    if book_id:
        match = re.search(
            r"class([678])",
            book_id,
        )

        if match:
            return int(
                match.group(1),
            )

    text = clean_space(
        class_value,
    ).lower()

    return CLASS_WORDS.get(
        text,
    )


def normalize_line_text(
    value: Any,
) -> str:
    if isinstance(
        value,
        str,
    ):
        return clean_space(
            value,
        )

    if not isinstance(
        value,
        dict,
    ):
        return ""

    for key in (
        "text",
        "cleanText",
        "clean_text",
        "aiReady",
        "ai_ready",
        "lineText",
        "line_text",
    ):
        text = clean_space(
            value.get(key),
        )

        if text:
            return text

    return ""


def extract_lines(
    value: dict[str, Any],
) -> tuple[list[str], str]:
    collections = (
        (
            "aiReadyLines",
            "aiReadyLines",
        ),
        (
            "cleanLines",
            "cleanLines",
        ),
        (
            "lines",
            "lines",
        ),
        (
            "rawLines",
            "rawLines",
        ),
    )

    for key, source_name in collections:
        collection = value.get(
            key,
        )

        if not isinstance(
            collection,
            list,
        ):
            continue

        result: list[str] = []

        for item in collection:
            text = normalize_line_text(
                item,
            )

            if text:
                result.append(
                    text,
                )

        if result:
            return (
                result,
                source_name,
            )

    return (
        [],
        "",
    )


def extract_text(
    value: dict[str, Any],
) -> tuple[
    str,
    str,
    list[str],
]:
    for key in TEXT_PRIORITY:
        text = clean_space(
            value.get(key),
        )

        if text:
            lines, _ = extract_lines(
                value,
            )

            return (
                text,
                key,
                lines,
            )

    lines, line_source = extract_lines(
        value,
    )

    if lines:
        return (
            clean_space(
                " ".join(lines),
            ),
            line_source,
            lines,
        )

    return (
        "",
        "",
        [],
    )


def text_hash(
    text: str,
) -> str:
    normalized = clean_space(
        text,
    ).lower()

    return hashlib.sha256(
        normalized.encode(
            "utf-8",
        ),
    ).hexdigest()


def calculate_alpha_ratio(
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


def invalid_text_reason(
    text: str,
) -> str | None:
    lower = text.lower()

    for marker in INVALID_TEXT_MARKERS:
        if marker in lower:
            return (
                f"contains:{marker}"
            )

    return None


def source_priority(
    *,
    depth: int,
    text_source: str,
    has_explicit_book: bool,
    has_explicit_page: bool,
) -> int:
    score = 0

    if depth == 0:
        score += 1000
    elif depth <= 2:
        score += 700
    else:
        score += 400

    text_scores = {
        "aiReadyText": 400,
        "cleanText": 300,
        "rawText": 200,
        "aiReadyLines": 150,
        "cleanLines": 125,
        "lines": 100,
        "rawLines": 75,
    }

    score += text_scores.get(
        text_source,
        0,
    )

    if has_explicit_book:
        score += 100

    if has_explicit_page:
        score += 100

    return score


def context_from_value(
    value: dict[str, Any],
    context: dict[str, Any],
    source_path: Path,
) -> dict[str, Any]:
    metadata = value.get(
        "metadata",
    )

    if not isinstance(
        metadata,
        dict,
    ):
        metadata = {}

    explicit_book = (
        first_present(
            value,
            BOOK_ID_KEYS,
        )
        or first_present(
            metadata,
            BOOK_ID_KEYS,
        )
    )

    class_value = (
        value.get("class")
        or value.get("classLevel")
        or value.get("class_level")
        or metadata.get("class")
        or metadata.get("classLevel")
        or metadata.get("class_level")
        or context.get(
            "class_value",
        )
    )

    book_id = normalize_book_id(
        explicit_book
        or context.get(
            "book_id",
        ),
        source_path,
        class_value,
    )

    lesson_number = safe_integer(
        first_present(
            value,
            LESSON_NUMBER_KEYS,
        )
        or context.get(
            "lesson_number",
        ),
    )

    lesson_title = clean_space(
        first_present(
            value,
            LESSON_TITLE_KEYS,
        )
        or context.get(
            "lesson_title",
        ),
    )

    return {
        "book_id": book_id,
        "class_value": class_value,
        "class_level":
            infer_class_level(
                book_id,
                class_value,
            ),
        "lesson_number":
            lesson_number,
        "lesson_title":
            lesson_title,
    }


def collect_candidates(
    value: Any,
    *,
    source_path: Path,
    relative_path: str,
    candidates: list[
        dict[str, Any]
    ],
    context: dict[str, Any] | None = None,
    depth: int = 0,
) -> None:
    if depth > 10:
        return

    if context is None:
        context = {}

    if isinstance(
        value,
        list,
    ):
        for item in value:
            if isinstance(
                item,
                (
                    dict,
                    list,
                ),
            ):
                collect_candidates(
                    item,
                    source_path=
                        source_path,
                    relative_path=
                        relative_path,
                    candidates=
                        candidates,
                    context=context,
                    depth=depth + 1,
                )

        return

    if not isinstance(
        value,
        dict,
    ):
        return

    local_context = context_from_value(
        value,
        context,
        source_path,
    )

    explicit_page_value = first_present(
        value,
        PAGE_NUMBER_KEYS,
    )

    page_number = safe_integer(
        explicit_page_value,
    )

    text, text_source, lines = extract_text(
        value,
    )

    if (
        page_number is not None
        and text
    ):
        book_id = local_context.get(
            "book_id",
        )

        class_level = local_context.get(
            "class_level",
        )

        invalid_reason = invalid_text_reason(
            text,
        )

        character_count = len(
            text,
        )

        word_count = len(
            re.findall(
                r"\b[\w'-]+\b",
                text,
                flags=re.UNICODE,
            ),
        )

        alpha_ratio = calculate_alpha_ratio(
            text,
        )

        quality_flags: list[str] = []

        if character_count < 80:
            quality_flags.append(
                "TOO_SHORT",
            )

        if character_count > 12000:
            quality_flags.append(
                "VERY_LONG",
            )

        if word_count < 15:
            quality_flags.append(
                "TOO_FEW_WORDS",
            )

        if alpha_ratio < 0.45:
            quality_flags.append(
                "LOW_ALPHA_RATIO",
            )

        if invalid_reason:
            quality_flags.append(
                "INVALID_CONTENT",
            )

        if book_id is None:
            quality_flags.append(
                "MISSING_BOOK_ID",
            )

        if class_level is None:
            quality_flags.append(
                "MISSING_CLASS_LEVEL",
            )

        candidate_score = source_priority(
            depth=depth,
            text_source=
                text_source,
            has_explicit_book=bool(
                first_present(
                    value,
                    BOOK_ID_KEYS,
                )
            ),
            has_explicit_page=(
                explicit_page_value
                is not None
            ),
        )

        candidate_score += min(
            150,
            character_count // 50,
        )

        candidates.append(
            {
                "book_id": book_id,
                "class_level":
                    class_level,
                "subject": "English",
                "page_number":
                    page_number,
                "lesson_number":
                    local_context.get(
                        "lesson_number",
                    ),
                "lesson_title":
                    local_context.get(
                        "lesson_title",
                    )
                    or None,
                "text": text,
                "text_source":
                    text_source,
                "lines": lines,
                "line_count":
                    len(lines),
                "character_count":
                    character_count,
                "word_count":
                    word_count,
                "alpha_ratio":
                    alpha_ratio,
                "text_sha256":
                    text_hash(text),
                "quality_flags":
                    quality_flags,
                "usable_for_rag": (
                    invalid_reason
                    is None
                    and character_count
                    >= 50
                    and alpha_ratio
                    >= 0.35
                    and book_id
                    is not None
                ),
                "training_candidate": (
                    invalid_reason
                    is None
                    and character_count
                    >= 120
                    and character_count
                    <= 8000
                    and word_count
                    >= 20
                    and alpha_ratio
                    >= 0.45
                    and book_id
                    is not None
                    and class_level
                    is not None
                ),
                "source_file":
                    relative_path,
                "source_depth":
                    depth,
                "candidate_score":
                    candidate_score,
            },
        )

    for key in (
        "pages",
        "lessons",
        "data",
        "items",
        "records",
    ):
        nested = value.get(
            key,
        )

        if isinstance(
            nested,
            (
                list,
                dict,
            ),
        ):
            collect_candidates(
                nested,
                source_path=
                    source_path,
                relative_path=
                    relative_path,
                candidates=
                    candidates,
                context=
                    local_context,
                depth=depth + 1,
            )


def choose_canonical_records(
    candidates: list[
        dict[str, Any]
    ],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    groups: dict[
        tuple[str, int],
        list[dict[str, Any]],
    ] = defaultdict(list)

    rejected: list[
        dict[str, Any]
    ] = []

    for candidate in candidates:
        book_id = candidate.get(
            "book_id",
        )

        page_number = candidate.get(
            "page_number",
        )

        if (
            not book_id
            or page_number is None
        ):
            rejected.append(
                {
                    **candidate,
                    "rejection_reason":
                        "missing canonical key",
                },
            )

            continue

        groups[
            (
                str(book_id),
                int(page_number),
            )
        ].append(
            candidate,
        )

    canonical: list[
        dict[str, Any]
    ] = []

    for (
        book_id,
        page_number,
    ), group in groups.items():
        ranked = sorted(
            group,
            key=lambda item: (
                int(
                    item[
                        "candidate_score"
                    ],
                ),
                int(
                    item[
                        "character_count"
                    ],
                ),
                int(
                    item[
                        "line_count"
                    ],
                ),
            ),
            reverse=True,
        )

        selected = dict(
            ranked[0],
        )

        alternate_files = sorted(
            {
                str(
                    item[
                        "source_file"
                    ],
                )
                for item in ranked[1:]
            },
        )

        lesson_numbers = sorted(
            {
                int(
                    item[
                        "lesson_number"
                    ],
                )
                for item in ranked
                if item.get(
                    "lesson_number",
                )
                is not None
            },
        )

        lesson_titles = sorted(
            {
                str(
                    item[
                        "lesson_title"
                    ],
                )
                for item in ranked
                if item.get(
                    "lesson_title",
                )
            },
        )

        if (
            selected.get(
                "lesson_number",
            )
            is None
            and lesson_numbers
        ):
            selected[
                "lesson_number"
            ] = lesson_numbers[0]

        if (
            not selected.get(
                "lesson_title",
            )
            and lesson_titles
        ):
            selected[
                "lesson_title"
            ] = lesson_titles[0]

        selected[
            "record_id"
        ] = (
            f"{book_id}-"
            f"page-{page_number:04d}"
        )

        selected[
            "alternate_candidate_count"
        ] = max(
            0,
            len(ranked) - 1,
        )

        selected[
            "alternate_source_files"
        ] = alternate_files

        selected[
            "candidate_text_hashes"
        ] = sorted(
            {
                item[
                    "text_sha256"
                ]
                for item in ranked
            },
        )

        selected[
            "candidate_text_versions"
        ] = len(
            selected[
                "candidate_text_hashes"
            ],
        )

        canonical.append(
            selected,
        )

    canonical.sort(
        key=lambda item: (
            int(
                item.get(
                    "class_level",
                )
                or 999
            ),
            str(
                item[
                    "book_id"
                ],
            ),
            int(
                item[
                    "page_number"
                ],
            ),
        ),
    )

    return (
        canonical,
        rejected,
    )


def write_jsonl(
    path: Path,
    records: list[
        dict[str, Any]
    ],
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


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    parser.add_argument(
        "--inventory",
        default=(
            "research/data/"
            "project_data_inventory.csv"
        ),
    )

    arguments = parser.parse_args()

    root = Path(
        arguments.root,
    ).resolve()

    inventory_path = (
        root /
        arguments.inventory
    )

    if not inventory_path.exists():
        raise FileNotFoundError(
            f"Inventory not found: "
            f"{inventory_path}",
        )

    with inventory_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        inventory = list(
            csv.DictReader(handle),
        )

    ocr_files = [
        root /
        row[
            "relative_path"
        ]
        for row in inventory
        if row.get(
            "category",
        ) == "TEXTBOOK_OCR"
    ]

    candidates: list[
        dict[str, Any]
    ] = []

    parse_errors: list[
        dict[str, str]
    ] = []

    for file_path in ocr_files:
        relative_path = str(
            file_path.relative_to(
                root,
            ),
        )

        try:
            with file_path.open(
                "r",
                encoding="utf-8-sig",
            ) as handle:
                value = json.load(
                    handle,
                )

            collect_candidates(
                value,
                source_path=
                    file_path,
                relative_path=
                    relative_path,
                candidates=
                    candidates,
            )

        except Exception as error:
            parse_errors.append(
                {
                    "source_file":
                        relative_path,
                    "error":
                        (
                            f"{type(error).__name__}: "
                            f"{error}"
                        ),
                },
            )

    canonical, rejected = (
        choose_canonical_records(
            candidates,
        )
    )

    processed_directory = (
        root /
        "research" /
        "data" /
        "processed"
    )

    reports_directory = (
        root /
        "research" /
        "reports"
    )

    processed_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    reports_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    manifest_path = (
        processed_directory /
        "ocr_passage_manifest.jsonl"
    )

    rejected_path = (
        processed_directory /
        "ocr_rejected_candidates.jsonl"
    )

    write_jsonl(
        manifest_path,
        canonical,
    )

    write_jsonl(
        rejected_path,
        rejected,
    )

    metadata_csv_path = (
        processed_directory /
        "ocr_passage_manifest_metadata.csv"
    )

    metadata_fields = [
        "record_id",
        "book_id",
        "class_level",
        "subject",
        "page_number",
        "lesson_number",
        "lesson_title",
        "text_source",
        "character_count",
        "word_count",
        "line_count",
        "alpha_ratio",
        "usable_for_rag",
        "training_candidate",
        "quality_flags",
        "source_file",
        "alternate_candidate_count",
        "candidate_text_versions",
        "text_sha256",
    ]

    with metadata_csv_path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=
                metadata_fields,
        )

        writer.writeheader()

        for record in canonical:
            row = {
                key:
                    record.get(key)
                for key in metadata_fields
            }

            row[
                "quality_flags"
            ] = "|".join(
                record.get(
                    "quality_flags",
                    [],
                ),
            )

            writer.writerow(row)

    book_counts: Counter[str] = Counter()
    class_counts: Counter[str] = Counter()
    text_source_counts: Counter[str] = Counter()
    quality_flag_counts: Counter[str] = Counter()

    word_counts: list[int] = []
    character_counts: list[int] = []

    training_candidates = 0
    rag_candidates = 0
    pages_with_lessons = 0
    pages_with_alternates = 0
    pages_with_text_conflicts = 0

    text_hash_groups: dict[
        str,
        list[str],
    ] = defaultdict(list)

    for record in canonical:
        book_counts[
            str(
                record[
                    "book_id"
                ],
            )
        ] += 1

        class_counts[
            str(
                record.get(
                    "class_level",
                )
                or "unknown"
            )
        ] += 1

        text_source_counts[
            str(
                record[
                    "text_source"
                ],
            )
        ] += 1

        for flag in record.get(
            "quality_flags",
            [],
        ):
            quality_flag_counts[
                flag
            ] += 1

        word_counts.append(
            int(
                record[
                    "word_count"
                ],
            ),
        )

        character_counts.append(
            int(
                record[
                    "character_count"
                ],
            ),
        )

        training_candidates += int(
            bool(
                record[
                    "training_candidate"
                ],
            ),
        )

        rag_candidates += int(
            bool(
                record[
                    "usable_for_rag"
                ],
            ),
        )

        pages_with_lessons += int(
            record.get(
                "lesson_number",
            )
            is not None
        )

        pages_with_alternates += int(
            int(
                record[
                    "alternate_candidate_count"
                ],
            )
            > 0
        )

        pages_with_text_conflicts += int(
            int(
                record[
                    "candidate_text_versions"
                ],
            )
            > 1
        )

        text_hash_groups[
            str(
                record[
                    "text_sha256"
                ],
            )
        ].append(
            str(
                record[
                    "record_id"
                ],
            ),
        )

    exact_text_duplicates = [
        records
        for records
        in text_hash_groups.values()
        if len(records) > 1
    ]

    summary = {
        "source_files":
            len(ocr_files),
        "candidate_records_found":
            len(candidates),
        "canonical_pages":
            len(canonical),
        "rejected_candidates":
            len(rejected),
        "parse_errors":
            len(parse_errors),
        "book_counts":
            dict(book_counts),
        "class_counts":
            dict(class_counts),
        "text_source_counts":
            dict(text_source_counts),
        "training_candidates":
            training_candidates,
        "rag_candidates":
            rag_candidates,
        "pages_with_lessons":
            pages_with_lessons,
        "pages_with_alternate_candidates":
            pages_with_alternates,
        "pages_with_text_conflicts":
            pages_with_text_conflicts,
        "exact_text_duplicate_groups":
            exact_text_duplicates,
        "quality_flag_counts":
            dict(quality_flag_counts),
        "word_count": {
            "minimum":
                min(word_counts)
                if word_counts
                else 0,
            "maximum":
                max(word_counts)
                if word_counts
                else 0,
            "average":
                round(
                    statistics.mean(
                        word_counts,
                    ),
                    2,
                )
                if word_counts
                else 0,
            "median":
                round(
                    statistics.median(
                        word_counts,
                    ),
                    2,
                )
                if word_counts
                else 0,
        },
        "character_count": {
            "minimum":
                min(
                    character_counts,
                )
                if character_counts
                else 0,
            "maximum":
                max(
                    character_counts,
                )
                if character_counts
                else 0,
            "average":
                round(
                    statistics.mean(
                        character_counts,
                    ),
                    2,
                )
                if character_counts
                else 0,
            "median":
                round(
                    statistics.median(
                        character_counts,
                    ),
                    2,
                )
                if character_counts
                else 0,
        },
        "parse_error_details":
            parse_errors,
    }

    summary_path = (
        reports_directory /
        "ocr_normalization_summary.json"
    )

    summary_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    report_lines = [
        "# Normalized OCR Passage Manifest",
        "",
        "## Summary",
        "",
        (
            f"- OCR source files: "
            f"{len(ocr_files)}"
        ),
        (
            f"- Candidate page records found: "
            f"{len(candidates)}"
        ),
        (
            f"- Canonical book/page records: "
            f"{len(canonical)}"
        ),
        (
            f"- Rejected candidates: "
            f"{len(rejected)}"
        ),
        (
            f"- Parse errors: "
            f"{len(parse_errors)}"
        ),
        (
            f"- RAG-ready pages: "
            f"{rag_candidates}"
        ),
        (
            f"- Fine-tuning source candidates: "
            f"{training_candidates}"
        ),
        (
            f"- Pages linked to a lesson: "
            f"{pages_with_lessons}"
        ),
        (
            f"- Pages with alternative source records: "
            f"{pages_with_alternates}"
        ),
        (
            f"- Pages with differing OCR text versions: "
            f"{pages_with_text_conflicts}"
        ),
        (
            f"- Exact duplicate text groups: "
            f"{len(exact_text_duplicates)}"
        ),
        "",
        "## Canonical Records by Book",
        "",
        "| Book | Pages |",
        "|---|---:|",
    ]

    for book_id, count in sorted(
        book_counts.items(),
    ):
        report_lines.append(
            f"| `{book_id}` | {count} |",
        )

    report_lines.extend(
        [
            "",
            "## Records by Class",
            "",
            "| Class | Pages |",
            "|---|---:|",
        ],
    )

    for class_level, count in sorted(
        class_counts.items(),
    ):
        report_lines.append(
            f"| {class_level} | {count} |",
        )

    report_lines.extend(
        [
            "",
            "## Selected Text Sources",
            "",
            "| Source field | Pages |",
            "|---|---:|",
        ],
    )

    for source, count in (
        text_source_counts.most_common()
    ):
        report_lines.append(
            f"| `{source}` | {count} |",
        )

    report_lines.extend(
        [
            "",
            "## Passage Length",
            "",
            (
                f"- Average words per page: "
                f"{summary['word_count']['average']}"
            ),
            (
                f"- Median words per page: "
                f"{summary['word_count']['median']}"
            ),
            (
                f"- Minimum words: "
                f"{summary['word_count']['minimum']}"
            ),
            (
                f"- Maximum words: "
                f"{summary['word_count']['maximum']}"
            ),
            (
                f"- Average characters per page: "
                f"{summary['character_count']['average']}"
            ),
            "",
            "## Quality Flags",
            "",
        ],
    )

    if quality_flag_counts:
        for flag, count in (
            quality_flag_counts.most_common()
        ):
            report_lines.append(
                f"- {flag}: {count}",
            )
    else:
        report_lines.append(
            "- No quality flags were assigned.",
        )

    report_lines.extend(
        [
            "",
            "## Research Use",
            "",
            (
                "- `ocr_passage_manifest.jsonl` "
                "contains the local canonical text."
            ),
            (
                "- `ocr_passage_manifest_metadata.csv` "
                "contains metadata without full passage text."
            ),
            (
                "- The metadata CSV is safer for "
                "version control and reporting."
            ),
            (
                "- Full textbook text should not be "
                "published publicly until copyright "
                "and dataset-release permission are confirmed."
            ),
            (
                "- No student records or operational "
                "request logs were included."
            ),
            "",
            "## Next Phase",
            "",
            (
                "- Review quality-flagged pages."
            ),
            (
                "- Assign lesson-aware train, "
                "validation, and test groups."
            ),
            (
                "- Lock a benchmark set before "
                "generating synthetic questions."
            ),
        ],
    )

    report_path = (
        reports_directory /
        "ocr_normalization_report.md"
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
        "OCR NORMALIZATION COMPLETE",
    )

    print("=" * 60)

    print(
        "Source files:",
        len(ocr_files),
    )

    print(
        "Candidate records:",
        len(candidates),
    )

    print(
        "Canonical pages:",
        len(canonical),
    )

    print(
        "RAG-ready pages:",
        rag_candidates,
    )

    print(
        "Training candidates:",
        training_candidates,
    )

    print(
        "Rejected candidates:",
        len(rejected),
    )

    print(
        "Parse errors:",
        len(parse_errors),
    )

    print()
    print("Pages by book:")

    for book_id, count in sorted(
        book_counts.items(),
    ):
        print(
            f"  {book_id}: {count}",
        )

    print()
    print("Selected text sources:")

    for source, count in (
        text_source_counts.most_common()
    ):
        print(
            f"  {source}: {count}",
        )

    print()
    print(
        "Pages with lesson number:",
        pages_with_lessons,
    )

    print(
        "Pages with OCR version conflicts:",
        pages_with_text_conflicts,
    )

    print(
        "Exact duplicate text groups:",
        len(exact_text_duplicates),
    )

    print()
    print(
        "Manifest:",
        manifest_path,
    )

    print(
        "Metadata CSV:",
        metadata_csv_path,
    )

    print(
        "Report:",
        report_path,
    )


if __name__ == "__main__":
    main()
