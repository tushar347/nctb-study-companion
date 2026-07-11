import argparse
import json
import re
import sys
from pathlib import Path

import cv2
import fitz
import numpy as np
import pytesseract
from PIL import Image
from pytesseract import Output


pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


HEADER_FOOTER_PATTERNS = [
    r"^english for today$",
    r"^class six$",
    r"^2026$",
    r"^\d+$",
    r"^forma-\d+.*$",
    r"^national curriculum.*$",
]


INSTRUCTION_PREFIXES = [
    "after completing the lesson",
    "choose the best",
    "match a word",
    "look at the picture",
    "look at the pictures",
    "talk about",
    "discuss",
    "practise",
    "practice",
    "work in groups",
    "work with a partner",
    "answer the following",
    "write a paragraph",
    "write down",
    "listen to",
    "listen and",
    "read the following",
    "complete the",
    "fill in",
    "suppose you",
    "notice the",
    "imagine that",
]


def normalize_text(value):
    text = str(value or "")

    text = text.replace("**", "")
    text = text.replace("•", " ")
    text = text.replace("●", " ")
    text = text.replace("▪", " ")
    text = text.replace("◦", " ")

    text = re.sub(r"\s+", " ", text)
    text = text.strip()

    return text


def alphabet_ratio(text):
    if not text:
        return 0

    letters = len(re.findall(r"[A-Za-z]", text))
    visible = len(re.findall(r"\S", text))

    if visible == 0:
        return 0

    return letters / visible


def is_label_only(text):
    stripped = text.strip()

    patterns = [
        r"^\d+[\.\)]?$",
        r"^[A-Z][\.\)]?$",
        r"^[a-z][\.\)]?$",
        r"^[ivxlcdm]+[\.\)]?$",
        r"^[\.\,\:\;\!\?\-\(\)]+$",
    ]

    return any(
        re.fullmatch(pattern, stripped, re.IGNORECASE)
        for pattern in patterns
    )


def is_header_or_footer(text):
    lower = text.lower().strip()

    return any(
        re.fullmatch(pattern, lower, re.IGNORECASE)
        for pattern in HEADER_FOOTER_PATTERNS
    )


def should_keep_line(
    text,
    word_count,
    confidence,
    width,
    height,
    image_width,
    image_height,
):
    if not text:
        return False

    if is_label_only(text):
        return False

    if is_header_or_footer(text):
        return False

    if not re.search(r"[A-Za-z]", text):
        return False

    if alphabet_ratio(text) < 0.42:
        return False

    if confidence < 52:
        return False

    if word_count == 1 and len(text) < 8:
        return False

    if len(text) < 4:
        return False

    if width < max(24, image_width * 0.018):
        return False

    if height < 6:
        return False

    if height > image_height * 0.07:
        return False

    return True


def is_ai_ready(text):
    lower = text.lower().strip()

    if len(text) < 14:
        return False

    if is_label_only(text):
        return False

    if alphabet_ratio(text) < 0.55:
        return False

    if any(
        lower.startswith(prefix)
        for prefix in INSTRUCTION_PREFIXES
    ):
        return False

    return True


def clean_ai_text(text):
    value = normalize_text(text)

    value = re.sub(
        r"^\s*\d+[\.\)]\s+",
        "",
        value,
    )

    value = re.sub(
        r"^\s*[A-Da-d][\.\)]\s+",
        "",
        value,
    )

    value = re.sub(
        r"^\s*[ivxlcdm]+[\.\)]\s+",
        "",
        value,
        flags=re.IGNORECASE,
    )

    value = normalize_text(value)

    return value


def build_line(
    words,
    confidence,
    image_width,
    image_height,
    source,
):
    words = sorted(
        words,
        key=lambda item: item["x"],
    )

    text = normalize_text(
        " ".join(item["text"] for item in words)
    )

    left = min(item["x"] for item in words)
    top = min(item["y"] for item in words)

    right = max(
        item["x"] + item["width"]
        for item in words
    )

    bottom = max(
        item["y"] + item["height"]
        for item in words
    )

    width = right - left
    height = bottom - top

    if not should_keep_line(
        text=text,
        word_count=len(words),
        confidence=confidence,
        width=width,
        height=height,
        image_width=image_width,
        image_height=image_height,
    ):
        return None

    clean_text = clean_ai_text(text)

    return {
        "text": text,
        "cleanText": clean_text,
        "bbox": {
            "x": int(left),
            "y": int(top),
            "width": int(width),
            "height": int(height),
        },
        "confidence": round(float(confidence), 2),
        "source": source,
        "aiReady": is_ai_ready(clean_text),
    }


def extract_native_lines(
    page,
    zoom,
    image_width,
    image_height,
):
    native_words = page.get_text("words")

    if len(native_words) < 8:
        return []

    grouped = {}

    for word in native_words:
        x0, y0, x1, y1 = word[0:4]
        text = normalize_text(word[4])

        if not text:
            continue

        block_number = int(word[5])
        line_number = int(word[6])

        key = (
            block_number,
            line_number,
        )

        grouped.setdefault(key, [])

        grouped[key].append({
            "text": text,
            "x": int(x0 * zoom),
            "y": int(y0 * zoom),
            "width": int((x1 - x0) * zoom),
            "height": int((y1 - y0) * zoom),
        })

    lines = []

    for words in grouped.values():
        line = build_line(
            words=words,
            confidence=99,
            image_width=image_width,
            image_height=image_height,
            source="pdf-text",
        )

        if line:
            lines.append(line)

    lines.sort(
        key=lambda item: (
            item["bbox"]["y"],
            item["bbox"]["x"],
        )
    )

    return lines


def preprocess_for_ocr(image_path):
    image = cv2.imread(str(image_path))

    if image is None:
        raise RuntimeError(
            f"Cannot open rendered page image: {image_path}"
        )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    gray = cv2.bilateralFilter(
        gray,
        7,
        55,
        55,
    )

    _, binary = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    return binary


def extract_tesseract_lines(
    image_path,
    image_width,
    image_height,
):
    processed = preprocess_for_ocr(image_path)

    data = pytesseract.image_to_data(
        processed,
        lang="eng",
        output_type=Output.DICT,
        config=(
            "--oem 3 "
            "--psm 3 "
            "-c preserve_interword_spaces=1"
        ),
    )

    grouped = {}

    total = len(data["text"])

    for index in range(total):
        text = normalize_text(data["text"][index])

        if not text:
            continue

        try:
            confidence = float(data["conf"][index])
        except Exception:
            confidence = -1

        if confidence < 35:
            continue

        key = (
            int(data["block_num"][index]),
            int(data["par_num"][index]),
            int(data["line_num"][index]),
        )

        grouped.setdefault(
            key,
            {
                "words": [],
                "confidences": [],
            },
        )

        grouped[key]["words"].append({
            "text": text,
            "x": int(data["left"][index]),
            "y": int(data["top"][index]),
            "width": int(data["width"][index]),
            "height": int(data["height"][index]),
        })

        grouped[key]["confidences"].append(
            confidence
        )

    lines = []

    for group in grouped.values():
        confidences = group["confidences"]

        average_confidence = (
            sum(confidences) / len(confidences)
            if confidences
            else 0
        )

        line = build_line(
            words=group["words"],
            confidence=average_confidence,
            image_width=image_width,
            image_height=image_height,
            source="tesseract",
        )

        if line:
            lines.append(line)

    lines.sort(
        key=lambda item: (
            item["bbox"]["y"],
            item["bbox"]["x"],
        )
    )

    return lines


def remove_overlapping_noise(lines):
    final_lines = []

    for line in lines:
        text = line["cleanText"].lower()
        box = line["bbox"]

        duplicate = False

        for existing in final_lines:
            existing_text = (
                existing["cleanText"]
                .lower()
            )

            existing_box = existing["bbox"]

            same_text = (
                text == existing_text
                or (
                    len(text) > 12
                    and text in existing_text
                )
                or (
                    len(existing_text) > 12
                    and existing_text in text
                )
            )

            vertical_distance = abs(
                box["y"] - existing_box["y"]
            )

            if (
                same_text
                and vertical_distance
                < max(
                    box["height"],
                    existing_box["height"],
                )
            ):
                duplicate = True
                break

        if not duplicate:
            final_lines.append(line)

    return final_lines


def process_page(
    document,
    page_number,
    zoom,
    pages_directory,
    images_directory,
    book_id,
    force,
):
    image_name = (
        f"page-{page_number:03}.png"
    )

    json_name = (
        f"page-{page_number:03}.json"
    )

    image_path = (
        images_directory / image_name
    )

    json_path = (
        pages_directory / json_name
    )

    if (
        not force
        and image_path.exists()
        and json_path.exists()
    ):
        with open(
            json_path,
            "r",
            encoding="utf-8",
        ) as file:
            existing = json.load(file)

        print(
            f"SKIP page {page_number}: already processed"
        )

        return {
            "pageNumber": page_number,
            "json": (
                f"/ocr/books/{book_id}/pages/"
                f"{json_name}"
            ),
            "image": (
                f"/ocr/books/{book_id}/page-images/"
                f"{image_name}"
            ),
            "lineCount": len(
                existing.get("lines", [])
            ),
            "aiReadyLineCount": len(
                existing.get(
                    "aiReadyLines",
                    [],
                )
            ),
            "source": existing.get(
                "source",
                "unknown",
            ),
        }

    page_index = page_number - 1
    page = document.load_page(page_index)

    matrix = fitz.Matrix(
        zoom,
        zoom,
    )

    pixmap = page.get_pixmap(
        matrix=matrix,
        alpha=False,
    )

    pixmap.save(str(image_path))

    image_width = pixmap.width
    image_height = pixmap.height

    native_lines = extract_native_lines(
        page=page,
        zoom=zoom,
        image_width=image_width,
        image_height=image_height,
    )

    if len(native_lines) >= 5:
        lines = native_lines
        source = "pdf-text"
    else:
        lines = extract_tesseract_lines(
            image_path=image_path,
            image_width=image_width,
            image_height=image_height,
        )

        source = "tesseract"

    lines = remove_overlapping_noise(lines)

    final_lines = []

    for index, line in enumerate(
        lines,
        start=1,
    ):
        line["id"] = (
            f"page-{page_number:03}-"
            f"line-{index:03}"
        )

        line["lineNumber"] = index

        final_lines.append(line)

    ai_ready_lines = [
        {
            "id": line["id"],
            "lineNumber": line["lineNumber"],
            "text": line["cleanText"],
            "bbox": line["bbox"],
            "confidence": line["confidence"],
            "source": line["source"],
        }
        for line in final_lines
        if line["aiReady"]
    ]

    page_json = {
        "bookId": book_id,
        "pageNumber": page_number,
        "image": (
            f"/ocr/books/{book_id}/page-images/"
            f"{image_name}"
        ),
        "width": image_width,
        "height": image_height,
        "source": source,
        "lines": final_lines,
        "aiReadyLines": ai_ready_lines,
        "rawText": "\n".join(
            line["text"]
            for line in final_lines
        ),
        "cleanText": "\n".join(
            line["cleanText"]
            for line in final_lines
        ),
        "aiReadyText": "\n".join(
            line["text"]
            for line in ai_ready_lines
        ),
    }

    with open(
        json_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            page_json,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print(
        f"DONE page {page_number}: "
        f"{len(final_lines)} lines, "
        f"{len(ai_ready_lines)} AI-ready, "
        f"source={source}"
    )

    return {
        "pageNumber": page_number,
        "json": (
            f"/ocr/books/{book_id}/pages/"
            f"{json_name}"
        ),
        "image": (
            f"/ocr/books/{book_id}/page-images/"
            f"{image_name}"
        ),
        "lineCount": len(final_lines),
        "aiReadyLineCount": len(
            ai_ready_lines
        ),
        "source": source,
    }


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--pdf",
        required=True,
    )

    parser.add_argument(
        "--book",
        required=True,
    )

    parser.add_argument(
        "--start",
        type=int,
        default=1,
    )

    parser.add_argument(
        "--end",
        type=int,
        default=0,
    )

    parser.add_argument(
        "--zoom",
        type=float,
        default=2.2,
    )

    parser.add_argument(
        "--force",
        action="store_true",
    )

    arguments = parser.parse_args()

    pdf_path = Path(arguments.pdf)

    if not pdf_path.exists():
        print(
            f"PDF not found: {pdf_path}"
        )

        sys.exit(1)

    output_directory = (
        Path("public")
        / "ocr"
        / "books"
        / arguments.book
    )

    pages_directory = (
        output_directory / "pages"
    )

    images_directory = (
        output_directory / "page-images"
    )

    pages_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    images_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    document = fitz.open(str(pdf_path))

    total_pages = len(document)

    start_page = max(
        1,
        arguments.start,
    )

    end_page = (
        total_pages
        if arguments.end <= 0
        else min(
            total_pages,
            arguments.end,
        )
    )

    index_data = {
        "bookId": arguments.book,
        "title": (
            "English For Today — Class Six"
        ),
        "sourcePdf": (
            "/books/"
            "class6-english-for-today.pdf"
        ),
        "totalPdfPages": total_pages,
        "startPage": start_page,
        "endPage": end_page,
        "pages": [],
    }

    for page_number in range(
        start_page,
        end_page + 1,
    ):
        try:
            result = process_page(
                document=document,
                page_number=page_number,
                zoom=arguments.zoom,
                pages_directory=pages_directory,
                images_directory=images_directory,
                book_id=arguments.book,
                force=arguments.force,
            )

            index_data["pages"].append(
                result
            )

        except Exception as error:
            print(
                f"FAILED page {page_number}: "
                f"{error}"
            )

            index_data["pages"].append({
                "pageNumber": page_number,
                "error": str(error),
            })

    index_path = (
        output_directory / "index.json"
    )

    with open(
        index_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            index_data,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print("")
    print("============================")
    print("FULL BOOK OCR COMPLETED")
    print("============================")
    print(f"Pages: {start_page}-{end_page}")
    print(f"Output: {output_directory}")
    print(f"Index: {index_path}")


if __name__ == "__main__":
    main()
