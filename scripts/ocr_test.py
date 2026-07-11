print("OCR SCRIPT STARTED")

import fitz
import pytesseract
from PIL import Image
from pytesseract import Output
from pathlib import Path
import json
import sys


# Tesseract location
pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


print("Checking Tesseract...")

try:
    version = pytesseract.get_tesseract_version()
    print("Tesseract version:", version)

except Exception as e:
    print("Tesseract ERROR:")
    print(e)
    sys.exit()


# Book PDF
PDF = "public/books/class6-english-for-today.pdf"


# Output folder
OUTPUT = Path("public/ocr/books/test")

OUTPUT.mkdir(
    parents=True,
    exist_ok=True
)


print("Opening PDF...")


try:
    doc = fitz.open(PDF)

except Exception as e:
    print("PDF ERROR:")
    print(e)
    sys.exit()


print("Total PDF pages:", len(doc))


# Test page
page_number = 18


print("Processing page:", page_number)


page = doc[page_number - 1]


# High quality rendering
zoom = 3

matrix = fitz.Matrix(
    zoom,
    zoom
)


pix = page.get_pixmap(
    matrix=matrix
)


image_path = OUTPUT / f"page-{page_number}.png"


pix.save(
    str(image_path)
)


print("Image created:")
print(image_path)


# Open image

img = Image.open(image_path)


print("Starting OCR...")


ocr_data = pytesseract.image_to_data(
    img,
    lang="eng",
    output_type=Output.DICT,
    config="--psm 6"
)


print("OCR extraction finished")


lines = []


total_words = len(ocr_data["text"])

print("Words detected:", total_words)


for i, text in enumerate(ocr_data["text"]):

    text = text.strip()

    if text:

        lines.append(
            {
                "text": text,
                "x": ocr_data["left"][i],
                "y": ocr_data["top"][i],
                "width": ocr_data["width"][i],
                "height": ocr_data["height"][i],
                "confidence": ocr_data["conf"][i]
            }
        )


print("Valid OCR items:", len(lines))


json_path = OUTPUT / f"page-{page_number}.json"


with open(
    json_path,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        lines,
        f,
        indent=2,
        ensure_ascii=False
    )


print("==========================")
print("OCR DONE SUCCESSFULLY")
print("==========================")

print("Image:")
print(image_path)

print("JSON:")
print(json_path)

print("Lines saved:")
print(len(lines))