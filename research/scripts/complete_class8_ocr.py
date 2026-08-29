from __future__ import annotations

import argparse
import io
import json
import math
import re
import statistics
import unicodedata

from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
import pytesseract

from PIL import Image
from pytesseract import Output


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


def clean_text(value: Any) -> str:
    text = str(value or "")

    for old, new in MOJIBAKE_REPLACEMENTS.items():
        text = text.replace(old, new)

    text = unicodedata.normalize(
        "NFKC",
        text,
    )

    text = text.replace(
        "\u00a0",
        " ",
    )

    text = re.sub(
        r"[ \t]+",
        " ",
        text,
    )

    text = re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        text,
    )

    return text.strip()


def alpha_ratio(text: str) -> float:
    if not text:
        return 0.0

    alphabetic = sum(
        character.isalpha()
        for character in text
    )

    return alphabetic / max(
        1,
        len(text),
    )


def is_ai_ready_line(text: str) -> bool:
    cleaned = clean_text(text)

    if not cleaned:
        return False

    if re.fullmatch(
        r"[\d\s\-–—.]+",
        cleaned,
    ):
        return False

    alphabetic = sum(
        character.isalpha()
        for character in cleaned
    )

    return alphabetic >= 2


def union_bbox(
    boxes: list[list[float]],
) -> list[float]:
    if not boxes:
        return [
            0.0,
            0.0,
            0.0,
            0.0,
        ]

    return [
        round(
            min(box[0] for box in boxes),
            2,
        ),
        round(
            min(box[1] for box in boxes),
            2,
        ),
        round(
            max(box[2] for box in boxes),
            2,
        ),
        round(
            max(box[3] for box in boxes),
            2,
        ),
    ]


def extract_native_lines(
    page: fitz.Page,
) -> list[dict[str, Any]]:
    document = page.get_text(
        "dict",
    )

    lines: list[
        dict[str, Any]
    ] = []

    for block in document.get(
        "blocks",
        [],
    ):
        for line in block.get(
            "lines",
            [],
        ):
            spans = line.get(
                "spans",
                [],
            )

            span_texts = [
                clean_text(
                    span.get(
                        "text",
                        "",
                    ),
                )
                for span in spans
            ]

            text = clean_text(
                " ".join(
                    item
                    for item in span_texts
                    if item
                ),
            )

            if not text:
                continue

            bbox = line.get(
                "bbox",
            )

            if not bbox:
                bbox = union_bbox(
                    [
                        list(
                            span.get(
                                "bbox",
                                [
                                    0,
                                    0,
                                    0,
                                    0,
                                ],
                            ),
                        )
                        for span in spans
                    ],
                )

            lines.append(
                {
                    "text": text,
                    "confidence": 100.0,
                    "bbox": [
                        round(
                            float(value),
                            2,
                        )
                        for value in bbox
                    ],
                    "source": "pdf-text",
                },
            )

    return lines


def extract_ocr_lines(
    image: Image.Image,
    dpi: int,
) -> list[dict[str, Any]]:
    data = pytesseract.image_to_data(
        image,
        lang="eng",
        config="--psm 6",
        output_type=Output.DICT,
    )

    grouped: dict[
        tuple[int, int, int],
        list[dict[str, Any]],
    ] = defaultdict(list)

    item_count = len(
        data.get(
            "text",
            [],
        ),
    )

    for index in range(
        item_count,
    ):
        text = clean_text(
            data["text"][index],
        )

        if not text:
            continue

        try:
            confidence = float(
                data["conf"][index],
            )
        except (
            TypeError,
            ValueError,
        ):
            confidence = -1.0

        if confidence < 0:
            continue

        key = (
            int(
                data["block_num"][index],
            ),
            int(
                data["par_num"][index],
            ),
            int(
                data["line_num"][index],
            ),
        )

        x = float(
            data["left"][index],
        )

        y = float(
            data["top"][index],
        )

        width = float(
            data["width"][index],
        )

        height = float(
            data["height"][index],
        )

        scale = 72.0 / float(
            dpi,
        )

        grouped[key].append(
            {
                "text": text,
                "confidence": confidence,
                "bbox": [
                    x * scale,
                    y * scale,
                    (
                        x +
                        width
                    ) *
                    scale,
                    (
                        y +
                        height
                    ) *
                    scale,
                ],
            },
        )

    lines: list[
        dict[str, Any]
    ] = []

    for _, words in sorted(
        grouped.items(),
        key=lambda item: (
            min(
                word["bbox"][1]
                for word in item[1]
            ),
            min(
                word["bbox"][0]
                for word in item[1]
            ),
        ),
    ):
        words.sort(
            key=lambda word:
                word["bbox"][0],
        )

        text = clean_text(
            " ".join(
                word["text"]
                for word in words
            ),
        )

        if not text:
            continue

        confidence_values = [
            float(
                word["confidence"],
            )
            for word in words
        ]

        lines.append(
            {
                "text": text,
                "confidence": round(
                    statistics.mean(
                        confidence_values,
                    ),
                    2,
                ),
                "bbox": union_bbox(
                    [
                        word["bbox"]
                        for word in words
                    ],
                ),
                "source": "tesseract",
            },
        )

    return lines


def make_line_objects(
    lines: list[dict[str, Any]],
    *,
    book_id: str,
    page_number: int,
) -> list[dict[str, Any]]:
    output: list[
        dict[str, Any]
    ] = []

    for index, line in enumerate(
        lines,
        start=1,
    ):
        text = clean_text(
            line.get(
                "text",
                "",
            ),
        )

        output.append(
            {
                "id": (
                    f"{book_id}-"
                    f"p{page_number:03d}-"
                    f"l{index:03d}"
                ),
                "lineNumber": index,
                "text": text,
                "cleanText": text,
                "aiReady":
                    is_ai_ready_line(
                        text,
                    ),
                "source":
                    line.get(
                        "source",
                    ),
                "confidence":
                    line.get(
                        "confidence",
                    ),
                "bbox":
                    line.get(
                        "bbox",
                        [
                            0,
                            0,
                            0,
                            0,
                        ],
                    ),
            },
        )

    return output


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--pdf",
        required=True,
    )

    parser.add_argument(
        "--output-dir",
        required=True,
    )

    parser.add_argument(
        "--image-dir",
        required=True,
    )

    parser.add_argument(
        "--book-id",
        default="class8-english",
    )

    parser.add_argument(
        "--page-offset",
        type=int,
        default=0,
    )

    parser.add_argument(
        "--dpi",
        type=int,
        default=250,
    )

    parser.add_argument(
        "--tesseract",
        required=True,
    )

    parser.add_argument(
        "--native-min-characters",
        type=int,
        default=80,
    )

    parser.add_argument(
        "--native-min-alpha-ratio",
        type=float,
        default=0.30,
    )

    arguments = parser.parse_args()

    pdf_path = Path(
        arguments.pdf,
    ).resolve()

    output_directory = Path(
        arguments.output_dir,
    ).resolve()

    image_directory = Path(
        arguments.image_dir,
    ).resolve()

    output_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    image_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    pytesseract.pytesseract.tesseract_cmd = (
        arguments.tesseract
    )

    document = fitz.open(
        pdf_path,
    )

    results: list[
        dict[str, Any]
    ] = []

    source_counts: Counter[str] = Counter()

    print()
    print(
        "CLASS 8 OCR STARTED",
    )

    print(
        "=" * 60,
    )

    print(
        "PDF:",
        pdf_path,
    )

    print(
        "PDF pages:",
        document.page_count,
    )

    print(
        "Page offset:",
        arguments.page_offset,
    )

    for pdf_index in range(
        document.page_count,
    ):
        pdf_page_number = (
            pdf_index +
            1
        )

        textbook_page_number = (
            pdf_page_number +
            arguments.page_offset
        )

        output_path = (
            output_directory
            /
            (
                f"page-"
                f"{textbook_page_number:03d}"
                f".json"
            )
        )

        if output_path.exists():
            print(
                f"[{pdf_page_number}/"
                f"{document.page_count}] "
                f"SKIP existing "
                f"page-{textbook_page_number:03d}.json",
            )

            results.append(
                {
                    "pdf_page":
                        pdf_page_number,
                    "page_number":
                        textbook_page_number,
                    "status":
                        "skipped_existing",
                    "output_file":
                        str(output_path),
                },
            )

            continue

        started_at = datetime.now(
            timezone.utc,
        )

        try:
            page = document.load_page(
                pdf_index,
            )

            native_lines = (
                extract_native_lines(
                    page,
                )
            )

            native_text = clean_text(
                " ".join(
                    line["text"]
                    for line
                    in native_lines
                ),
            )

            use_ocr = (
                len(native_text)
                <
                arguments.native_min_characters
                or alpha_ratio(
                    native_text,
                )
                <
                arguments.native_min_alpha_ratio
            )

            image_relative_path = None

            if use_ocr:
                scale = (
                    arguments.dpi /
                    72.0
                )

                pixmap = page.get_pixmap(
                    matrix=fitz.Matrix(
                        scale,
                        scale,
                    ),
                    alpha=False,
                )

                image_bytes = (
                    pixmap.tobytes(
                        "png",
                    )
                )

                image = Image.open(
                    io.BytesIO(
                        image_bytes,
                    ),
                ).convert(
                    "RGB",
                )

                image_path = (
                    image_directory
                    /
                    (
                        f"page-"
                        f"{textbook_page_number:03d}"
                        f".png"
                    )
                )

                image.save(
                    image_path,
                    format="PNG",
                    optimize=True,
                )

                image_relative_path = (
                    f"../images/"
                    f"{image_path.name}"
                )

                extracted_lines = (
                    extract_ocr_lines(
                        image,
                        arguments.dpi,
                    )
                )

                extraction_source = (
                    "tesseract"
                )

            else:
                extracted_lines = (
                    native_lines
                )

                extraction_source = (
                    "pdf-text"
                )

            line_objects = (
                make_line_objects(
                    extracted_lines,
                    book_id=
                        arguments.book_id,
                    page_number=
                        textbook_page_number,
                )
            )

            ai_ready_lines = [
                line
                for line
                in line_objects
                if line[
                    "aiReady"
                ]
            ]

            raw_text = "\n".join(
                line[
                    "text"
                ]
                for line
                in line_objects
            ).strip()

            clean_page_text = (
                clean_text(
                    " ".join(
                        line[
                            "cleanText"
                        ]
                        for line
                        in line_objects
                    ),
                )
            )

            ai_ready_text = (
                clean_text(
                    " ".join(
                        line[
                            "cleanText"
                        ]
                        for line
                        in ai_ready_lines
                    ),
                )
            )

            if not ai_ready_text:
                ai_ready_text = (
                    clean_page_text
                )

            confidence_values = [
                float(
                    line[
                        "confidence"
                    ],
                )
                for line
                in line_objects
                if line.get(
                    "confidence",
                )
                is not None
            ]

            average_confidence = (
                round(
                    statistics.mean(
                        confidence_values,
                    ),
                    2,
                )
                if confidence_values
                else None
            )

            output = {
                "bookId":
                    arguments.book_id,
                "pageNumber":
                    textbook_page_number,
                "pdfPage":
                    pdf_page_number,
                "textbookPage":
                    textbook_page_number,
                "width":
                    round(
                        float(
                            page.rect.width,
                        ),
                        2,
                    ),
                "height":
                    round(
                        float(
                            page.rect.height,
                        ),
                        2,
                    ),
                "image":
                    image_relative_path,
                "source":
                    extraction_source,
                "sourcePdf":
                    pdf_path.name,
                "rawText":
                    raw_text,
                "cleanText":
                    clean_page_text,
                "aiReadyText":
                    ai_ready_text,
                "lines":
                    line_objects,
                "aiReadyLines":
                    ai_ready_lines,
                "lineCount":
                    len(
                        line_objects,
                    ),
                "aiReadyLineCount":
                    len(
                        ai_ready_lines,
                    ),
                "averageConfidence":
                    average_confidence,
                "ocrMetadata": {
                    "generatedAt":
                        datetime.now(
                            timezone.utc,
                        ).isoformat(),
                    "extractor":
                        extraction_source,
                    "dpi":
                        (
                            arguments.dpi
                            if use_ocr
                            else None
                        ),
                    "tesseractLanguage":
                        (
                            "eng"
                            if use_ocr
                            else None
                        ),
                },
            }

            output_path.write_text(
                json.dumps(
                    output,
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )

            source_counts[
                extraction_source
            ] += 1

            finished_at = datetime.now(
                timezone.utc,
            )

            elapsed_seconds = (
                finished_at -
                started_at
            ).total_seconds()

            results.append(
                {
                    "pdf_page":
                        pdf_page_number,
                    "page_number":
                        textbook_page_number,
                    "status":
                        "created",
                    "source":
                        extraction_source,
                    "characters":
                        len(
                            ai_ready_text,
                        ),
                    "words":
                        len(
                            re.findall(
                                r"\b[\w’'-]+\b",
                                ai_ready_text,
                                flags=re.UNICODE,
                            ),
                        ),
                    "lines":
                        len(
                            line_objects,
                        ),
                    "average_confidence":
                        average_confidence,
                    "elapsed_seconds":
                        round(
                            elapsed_seconds,
                            2,
                        ),
                    "output_file":
                        str(
                            output_path,
                        ),
                },
            )

            print(
                f"[{pdf_page_number}/"
                f"{document.page_count}] "
                f"CREATED "
                f"page-{textbook_page_number:03d}.json "
                f"source={extraction_source} "
                f"chars={len(ai_ready_text)} "
                f"lines={len(line_objects)}",
            )

        except Exception as error:
            results.append(
                {
                    "pdf_page":
                        pdf_page_number,
                    "page_number":
                        textbook_page_number,
                    "status":
                        "error",
                    "error":
                        (
                            f"{type(error).__name__}: "
                            f"{error}"
                        ),
                },
            )

            print(
                f"[{pdf_page_number}/"
                f"{document.page_count}] "
                f"ERROR: "
                f"{type(error).__name__}: "
                f"{error}",
            )

    document.close()

    created = sum(
        result[
            "status"
        ]
        == "created"
        for result in results
    )

    skipped = sum(
        result[
            "status"
        ]
        ==
        "skipped_existing"
        for result in results
    )

    errors = [
        result
        for result in results
        if result[
            "status"
        ]
        == "error"
    ]

    summary = {
        "generatedAt":
            datetime.now(
                timezone.utc,
            ).isoformat(),
        "bookId":
            arguments.book_id,
        "sourcePdf":
            str(
                pdf_path,
            ),
        "pdfPageCount":
            len(
                results,
            ),
        "pageOffset":
            arguments.page_offset,
        "createdPages":
            created,
        "skippedExistingPages":
            skipped,
        "errorPages":
            len(
                errors,
            ),
        "sourceCounts":
            dict(
                source_counts,
            ),
        "results":
            results,
    }

    summary_path = (
        output_directory.parent
        /
        "class8_ocr_run_summary.json"
    )

    summary_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "CLASS 8 OCR COMPLETE",
    )

    print(
        "=" * 60,
    )

    print(
        "Created:",
        created,
    )

    print(
        "Skipped existing:",
        skipped,
    )

    print(
        "Errors:",
        len(
            errors,
        ),
    )

    print(
        "Extraction methods:",
        dict(
            source_counts,
        ),
    )

    print(
        "Summary:",
        summary_path,
    )

    if errors:
        raise SystemExit(
            1,
        )


if __name__ == "__main__":
    main()
