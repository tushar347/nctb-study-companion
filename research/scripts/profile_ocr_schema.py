from __future__ import annotations

import argparse
import csv
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


TEXT_FIELD_NAMES = {
    "text",
    "cleantext",
    "clean_text",
    "ocrtext",
    "ocr_text",
    "passage",
    "content",
    "sourcetext",
    "source_text",
    "linetext",
    "line_text",
    "paragraph",
    "description",
    "title",
}

METADATA_FIELDS = {
    "bookid",
    "book_id",
    "bookkey",
    "book_key",
    "book",
    "class",
    "classlevel",
    "class_level",
    "grade",
    "lessonno",
    "lesson_no",
    "lesson",
    "pagenumber",
    "page_number",
    "page",
    "unit",
    "unitno",
    "unit_no",
    "subject",
    "language",
}

EXCLUDED_TEXT_PATTERNS = (
    "<!doctype html",
    "<html",
    "require stack:",
    "node_modules",
    "internal server error",
)


def normalize_key(value: Any) -> str:
    return str(value).strip().lower()


def text_is_candidate(
    key: str,
    value: str,
) -> bool:
    clean = re.sub(
        r"\s+",
        " ",
        value,
    ).strip()

    if len(clean) < 25:
        return False

    lower = clean.lower()

    if any(
        pattern in lower
        for pattern in EXCLUDED_TEXT_PATTERNS
    ):
        return False

    alphabetic = sum(
        character.isalpha()
        for character in clean
    )

    alpha_ratio = (
        alphabetic /
        max(
            1,
            len(clean),
        )
    )

    named_text_field = (
        normalize_key(key)
        in TEXT_FIELD_NAMES
    )

    return (
        named_text_field
        or (
            len(clean) >= 50
            and alpha_ratio >= 0.45
        )
    )


def summarize_value(
    value: Any,
) -> str:
    if isinstance(
        value,
        dict,
    ):
        return (
            "object:"
            + ",".join(
                sorted(
                    str(key)
                    for key in value.keys()
                )[:20]
            )
        )

    if isinstance(
        value,
        list,
    ):
        return (
            f"array:{len(value)}"
        )

    return type(
        value,
    ).__name__


def walk_json(
    value: Any,
    path: str,
    key_counts: Counter[str],
    field_path_counts: Counter[str],
    array_lengths: dict[str, list[int]],
    text_lengths: dict[str, list[int]],
    metadata_values: dict[str, set[str]],
    samples: list[dict[str, Any]],
    file_path: str,
    depth: int = 0,
) -> None:
    if depth > 10:
        return

    if isinstance(
        value,
        dict,
    ):
        for key, nested in value.items():
            key_text = str(key)
            normalized_key = normalize_key(
                key_text,
            )

            nested_path = (
                f"{path}.{key_text}"
            )

            key_counts[
                normalized_key
            ] += 1

            field_path_counts[
                nested_path
            ] += 1

            if (
                normalized_key
                in METADATA_FIELDS
                and isinstance(
                    nested,
                    (
                        str,
                        int,
                        float,
                    ),
                )
            ):
                metadata_values[
                    normalized_key
                ].add(
                    str(nested).strip(),
                )

            if isinstance(
                nested,
                str,
            ):
                clean = re.sub(
                    r"\s+",
                    " ",
                    nested,
                ).strip()

                if clean:
                    text_lengths[
                        nested_path
                    ].append(
                        len(clean),
                    )

                if (
                    len(samples) < 200
                    and text_is_candidate(
                        key_text,
                        clean,
                    )
                ):
                    samples.append(
                        {
                            "source_file":
                                file_path,
                            "field_path":
                                nested_path,
                            "text":
                                clean[:2000],
                        },
                    )

            walk_json(
                nested,
                nested_path,
                key_counts,
                field_path_counts,
                array_lengths,
                text_lengths,
                metadata_values,
                samples,
                file_path,
                depth + 1,
            )

    elif isinstance(
        value,
        list,
    ):
        array_lengths[
            path
        ].append(
            len(value),
        )

        for index, item in enumerate(
            value[:2000],
        ):
            walk_json(
                item,
                f"{path}[]",
                key_counts,
                field_path_counts,
                array_lengths,
                text_lengths,
                metadata_values,
                samples,
                file_path,
                depth + 1,
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

    ocr_rows = [
        row
        for row in inventory
        if row.get(
            "category",
        ) == "TEXTBOOK_OCR"
    ]

    root_shapes: Counter[str] = Counter()
    key_counts: Counter[str] = Counter()
    field_path_counts: Counter[str] = Counter()

    array_lengths: dict[
        str,
        list[int],
    ] = defaultdict(list)

    text_lengths: dict[
        str,
        list[int],
    ] = defaultdict(list)

    metadata_values: dict[
        str,
        set[str],
    ] = defaultdict(set)

    samples: list[
        dict[str, Any]
    ] = []

    file_profiles: list[
        dict[str, Any]
    ] = []

    parse_errors: list[
        dict[str, str]
    ] = []

    for row in ocr_rows:
        relative_path = row[
            "relative_path"
        ]

        file_path = (
            root /
            relative_path
        )

        try:
            with file_path.open(
                "r",
                encoding="utf-8-sig",
            ) as handle:
                value = json.load(
                    handle,
                )

            shape = summarize_value(
                value,
            )

            root_shapes[
                shape
            ] += 1

            file_profiles.append(
                {
                    "relative_path":
                        relative_path,
                    "root_shape":
                        shape,
                    "estimated_records":
                        row.get(
                            "estimated_records",
                            "0",
                        ),
                    "size_bytes":
                        row.get(
                            "size_bytes",
                            "0",
                        ),
                },
            )

            walk_json(
                value=value,
                path="$",
                key_counts=key_counts,
                field_path_counts=
                    field_path_counts,
                array_lengths=
                    array_lengths,
                text_lengths=
                    text_lengths,
                metadata_values=
                    metadata_values,
                samples=samples,
                file_path=
                    relative_path,
            )

        except Exception as error:
            parse_errors.append(
                {
                    "relative_path":
                        relative_path,
                    "error":
                        (
                            f"{type(error).__name__}: "
                            f"{error}"
                        ),
                },
            )

    candidate_text_paths = []

    for path, lengths in (
        text_lengths.items()
    ):
        candidate_text_paths.append(
            {
                "path": path,
                "count":
                    len(lengths),
                "minimum_length":
                    min(lengths),
                "maximum_length":
                    max(lengths),
                "average_length":
                    round(
                        statistics.mean(
                            lengths,
                        ),
                        2,
                    ),
            },
        )

    candidate_text_paths.sort(
        key=lambda item: (
            item["count"],
            item["average_length"],
        ),
        reverse=True,
    )

    array_profile = []

    for path, lengths in (
        array_lengths.items()
    ):
        array_profile.append(
            {
                "path": path,
                "occurrences":
                    len(lengths),
                "minimum_items":
                    min(lengths),
                "maximum_items":
                    max(lengths),
                "average_items":
                    round(
                        statistics.mean(
                            lengths,
                        ),
                        2,
                    ),
            },
        )

    array_profile.sort(
        key=lambda item:
            item["occurrences"],
        reverse=True,
    )

    output = {
        "files_profiled":
            len(file_profiles),
        "parse_errors":
            parse_errors,
        "root_shapes":
            dict(root_shapes),
        "most_common_keys":
            key_counts.most_common(
                100,
            ),
        "most_common_paths":
            field_path_counts.most_common(
                100,
            ),
        "array_profile":
            array_profile[:100],
        "text_field_profile":
            candidate_text_paths[:100],
        "metadata_values": {
            key:
                sorted(values)
            for key, values
            in metadata_values.items()
        },
        "representative_files":
            file_profiles[:50],
        "text_samples":
            samples,
    }

    reports_directory = (
        root /
        "research" /
        "reports"
    )

    processed_directory = (
        root /
        "research" /
        "data" /
        "processed"
    )

    reports_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    processed_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    json_report = (
        reports_directory /
        "ocr_schema_profile.json"
    )

    json_report.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    sample_path = (
        processed_directory /
        "ocr_text_samples.jsonl"
    )

    with sample_path.open(
        "w",
        encoding="utf-8",
    ) as handle:
        for sample in samples:
            handle.write(
                json.dumps(
                    sample,
                    ensure_ascii=False,
                )
                + "\n"
            )

    markdown_lines = [
        "# OCR Dataset Schema Profile",
        "",
        (
            f"- OCR files profiled: "
            f"{len(file_profiles)}"
        ),
        (
            f"- Parse errors: "
            f"{len(parse_errors)}"
        ),
        (
            f"- Candidate text samples: "
            f"{len(samples)}"
        ),
        "",
        "## Root JSON Shapes",
        "",
        "| Shape | Files |",
        "|---|---:|",
    ]

    for shape, count in (
        root_shapes.most_common()
    ):
        markdown_lines.append(
            f"| `{shape}` | {count} |",
        )

    markdown_lines.extend(
        [
            "",
            "## Most Common JSON Keys",
            "",
            "| Key | Occurrences |",
            "|---|---:|",
        ],
    )

    for key, count in (
        key_counts.most_common(
            40,
        )
    ):
        markdown_lines.append(
            f"| `{key}` | {count} |",
        )

    markdown_lines.extend(
        [
            "",
            "## Candidate Text Fields",
            "",
            (
                "| JSON path | Count | "
                "Average length | "
                "Minimum | Maximum |"
            ),
            "|---|---:|---:|---:|---:|",
        ],
    )

    for item in (
        candidate_text_paths[:40]
    ):
        markdown_lines.append(
            (
                f"| `{item['path']}` | "
                f"{item['count']} | "
                f"{item['average_length']} | "
                f"{item['minimum_length']} | "
                f"{item['maximum_length']} |"
            ),
        )

    markdown_lines.extend(
        [
            "",
            "## Array Structures",
            "",
            (
                "| JSON path | "
                "Occurrences | "
                "Average items | "
                "Minimum | Maximum |"
            ),
            "|---|---:|---:|---:|---:|",
        ],
    )

    for item in (
        array_profile[:30]
    ):
        markdown_lines.append(
            (
                f"| `{item['path']}` | "
                f"{item['occurrences']} | "
                f"{item['average_items']} | "
                f"{item['minimum_items']} | "
                f"{item['maximum_items']} |"
            ),
        )

    markdown_lines.extend(
        [
            "",
            "## Metadata Values",
            "",
        ],
    )

    for key in sorted(
        metadata_values,
    ):
        values = sorted(
            metadata_values[key],
        )

        preview = ", ".join(
            values[:50],
        )

        if len(values) > 50:
            preview += (
                f", ... "
                f"({len(values)} total)"
            )

        markdown_lines.append(
            f"- **{key}:** {preview}",
        )

    markdown_lines.extend(
        [
            "",
            "## Research Decision",
            "",
            (
                "- This profile describes the "
                "source structure only."
            ),
            (
                "- No training examples have "
                "been generated yet."
            ),
            (
                "- Student and operational "
                "data are excluded."
            ),
            (
                "- The next script will "
                "normalize OCR content into "
                "one passage record per "
                "book/page/lesson."
            ),
        ],
    )

    markdown_report = (
        reports_directory /
        "ocr_schema_profile.md"
    )

    markdown_report.write_text(
        "\n".join(
            markdown_lines,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "OCR SCHEMA PROFILE COMPLETE",
    )

    print("=" * 60)

    print(
        "Files profiled:",
        len(file_profiles),
    )

    print(
        "Parse errors:",
        len(parse_errors),
    )

    print(
        "Text samples:",
        len(samples),
    )

    print()
    print("Root shapes:")

    for shape, count in (
        root_shapes.most_common()
    ):
        print(
            f"  {shape}: {count}",
        )

    print()
    print(
        "Most common keys:",
    )

    for key, count in (
        key_counts.most_common(
            20,
        )
    ):
        print(
            f"  {key}: {count}",
        )

    print()
    print(
        "Most common text paths:",
    )

    for item in (
        candidate_text_paths[:15]
    ):
        print(
            "  "
            f"{item['path']} "
            f"count={item['count']} "
            f"avg_length="
            f"{item['average_length']}",
        )

    print()
    print(
        "Markdown report:",
        markdown_report,
    )

    print(
        "Full JSON:",
        json_report,
    )

    print(
        "Text samples:",
        sample_path,
    )


if __name__ == "__main__":
    main()
