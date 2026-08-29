from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata

from collections import Counter
from pathlib import Path
from typing import Any

import fitz


def alpha_ratio(text: str) -> float:
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


def word_count(text: str) -> int:
    return len(
        re.findall(
            r"\b[\w’'-]+\b",
            text,
            flags=re.UNICODE,
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--pdf",
        required=True,
    )

    parser.add_argument(
        "--page-dir",
        required=True,
    )

    parser.add_argument(
        "--report-dir",
        required=True,
    )

    parser.add_argument(
        "--page-offset",
        type=int,
        default=0,
    )

    arguments = parser.parse_args()

    pdf_path = Path(
        arguments.pdf,
    ).resolve()

    page_directory = Path(
        arguments.page_dir,
    ).resolve()

    report_directory = Path(
        arguments.report_dir,
    ).resolve()

    report_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    document = fitz.open(
        pdf_path,
    )

    expected_numbers = {
        page_number
        +
        arguments.page_offset
        for page_number in range(
            1,
            document.page_count + 1,
        )
    }

    document.close()

    page_files = sorted(
        page_directory.glob(
            "page-*.json",
        ),
    )

    observed_numbers: list[int] = []
    review_rows: list[
        dict[str, Any]
    ] = []

    parse_errors: list[
        dict[str, str]
    ] = []

    source_counts: Counter[str] = Counter()

    for page_file in page_files:
        filename_match = re.search(
            r"page-(\d+)\.json$",
            page_file.name,
        )

        filename_number = (
            int(
                filename_match.group(
                    1,
                ),
            )
            if filename_match
            else None
        )

        try:
            value = json.loads(
                page_file.read_text(
                    encoding="utf-8-sig",
                ),
            )

            record_number = int(
                value.get(
                    "pageNumber",
                ),
            )

            observed_numbers.append(
                record_number,
            )

            text = str(
                value.get(
                    "aiReadyText",
                )
                or value.get(
                    "cleanText",
                )
                or value.get(
                    "rawText",
                )
                or ""
            ).strip()

            words = word_count(
                text,
            )

            current_alpha_ratio = (
                alpha_ratio(
                    text,
                )
            )

            source = str(
                value.get(
                    "source",
                    "unknown",
                ),
            )

            source_counts[
                source
            ] += 1

            reasons: list[str] = []

            if filename_number != record_number:
                reasons.append(
                    "filename/pageNumber mismatch",
                )

            if not text:
                reasons.append(
                    "empty page text",
                )

            if words < 20:
                reasons.append(
                    "fewer than 20 words",
                )

            if current_alpha_ratio < 0.40:
                reasons.append(
                    "low alphabetic ratio",
                )

            if "�" in text:
                reasons.append(
                    "replacement character present",
                )

            if any(
                marker in text
                for marker in (
                    "â€™",
                    "â€œ",
                    "â€",
                    "Â ",
                )
            ):
                reasons.append(
                    "possible encoding damage",
                )

            average_confidence = value.get(
                "averageConfidence",
            )

            if (
                source == "tesseract"
                and isinstance(
                    average_confidence,
                    (
                        int,
                        float,
                    ),
                )
                and average_confidence < 65
            ):
                reasons.append(
                    "low OCR confidence",
                )

            if reasons:
                review_rows.append(
                    {
                        "file":
                            str(
                                page_file,
                            ),
                        "page_number":
                            record_number,
                        "source":
                            source,
                        "word_count":
                            words,
                        "alpha_ratio":
                            current_alpha_ratio,
                        "average_confidence":
                            average_confidence,
                        "review_reasons":
                            " | ".join(
                                reasons,
                            ),
                        "text_preview":
                            re.sub(
                                r"\s+",
                                " ",
                                text,
                            )[:400],
                        "review_decision":
                            "",
                        "reviewer":
                            "",
                        "notes":
                            "",
                    },
                )

        except Exception as error:
            parse_errors.append(
                {
                    "file":
                        str(
                            page_file,
                        ),
                    "error":
                        (
                            f"{type(error).__name__}: "
                            f"{error}"
                        ),
                },
            )

    observed_set = set(
        observed_numbers,
    )

    missing_numbers = sorted(
        expected_numbers -
        observed_set,
    )

    unexpected_numbers = sorted(
        observed_set -
        expected_numbers,
    )

    duplicate_numbers = sorted(
        {
            number
            for number
            in observed_numbers
            if observed_numbers.count(
                number,
            )
            > 1
        },
    )

    review_csv_path = (
        report_directory
        /
        "class8_ocr_manual_review.csv"
    )

    review_fields = [
        "file",
        "page_number",
        "source",
        "word_count",
        "alpha_ratio",
        "average_confidence",
        "review_reasons",
        "text_preview",
        "review_decision",
        "reviewer",
        "notes",
    ]

    with review_csv_path.open(
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

    summary = {
        "expected_pdf_pages":
            len(
                expected_numbers,
            ),
        "json_page_files":
            len(
                page_files,
            ),
        "successfully_parsed":
            len(
                observed_numbers,
            ),
        "parse_errors":
            parse_errors,
        "missing_page_numbers":
            missing_numbers,
        "unexpected_page_numbers":
            unexpected_numbers,
        "duplicate_page_numbers":
            duplicate_numbers,
        "manual_review_pages":
            len(
                review_rows,
            ),
        "source_counts":
            dict(
                source_counts,
            ),
    }

    summary_json_path = (
        report_directory
        /
        "class8_ocr_validation.json"
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
        "# Class 8 OCR Validation",
        "",
        (
            f"- Expected PDF pages: "
            f"{len(expected_numbers)}"
        ),
        (
            f"- JSON page files: "
            f"{len(page_files)}"
        ),
        (
            f"- Successfully parsed: "
            f"{len(observed_numbers)}"
        ),
        (
            f"- Parse errors: "
            f"{len(parse_errors)}"
        ),
        (
            f"- Missing pages: "
            f"{len(missing_numbers)}"
        ),
        (
            f"- Unexpected pages: "
            f"{len(unexpected_numbers)}"
        ),
        (
            f"- Duplicate page numbers: "
            f"{len(duplicate_numbers)}"
        ),
        (
            f"- Manual-review pages: "
            f"{len(review_rows)}"
        ),
        "",
        "## Extraction Methods",
        "",
    ]

    for source, count in (
        source_counts.most_common()
    ):
        report_lines.append(
            f"- {source}: {count}",
        )

    report_lines.extend(
        [
            "",
            "## Missing Page Numbers",
            "",
            (
                ", ".join(
                    str(number)
                    for number
                    in missing_numbers
                )
                if missing_numbers
                else "None"
            ),
            "",
            "## Unexpected Page Numbers",
            "",
            (
                ", ".join(
                    str(number)
                    for number
                    in unexpected_numbers
                )
                if unexpected_numbers
                else "None"
            ),
            "",
            "## Duplicate Page Numbers",
            "",
            (
                ", ".join(
                    str(number)
                    for number
                    in duplicate_numbers
                )
                if duplicate_numbers
                else "None"
            ),
        ],
    )

    markdown_path = (
        report_directory
        /
        "class8_ocr_validation.md"
    )

    markdown_path.write_text(
        "\n".join(
            report_lines,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "CLASS 8 OCR VALIDATION COMPLETE",
    )

    print(
        "=" * 60,
    )

    print(
        "Expected PDF pages:",
        len(
            expected_numbers,
        ),
    )

    print(
        "JSON page files:",
        len(
            page_files,
        ),
    )

    print(
        "Successfully parsed:",
        len(
            observed_numbers,
        ),
    )

    print(
        "Parse errors:",
        len(
            parse_errors,
        ),
    )

    print(
        "Missing pages:",
        len(
            missing_numbers,
        ),
        missing_numbers,
    )

    print(
        "Unexpected pages:",
        len(
            unexpected_numbers,
        ),
        unexpected_numbers,
    )

    print(
        "Duplicate page numbers:",
        len(
            duplicate_numbers,
        ),
        duplicate_numbers,
    )

    print(
        "Manual-review pages:",
        len(
            review_rows,
        ),
    )

    print(
        "Extraction methods:",
        dict(
            source_counts,
        ),
    )

    print()
    print(
        "Validation report:",
        markdown_path,
    )

    print(
        "Manual review CSV:",
        review_csv_path,
    )

    if (
        parse_errors
        or missing_numbers
        or duplicate_numbers
    ):
        raise SystemExit(
            1,
        )


if __name__ == "__main__":
    main()
