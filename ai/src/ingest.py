import fitz  # PyMuPDF
from pathlib import Path
import json
import pytesseract
from PIL import Image
import io

# If tesseract isn't on PATH, uncomment and set this to your install path:
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

PDF_FOLDER = Path("data/raw/books")
OUTPUT_FILE = Path("data/processed/raw_pages.jsonl")

# Minimum characters before we trust the native text layer.
# Below this we assume the page is a scanned image and OCR it instead.
NATIVE_TEXT_MIN_CHARS = 40

# Higher zoom = sharper render = better OCR accuracy, but slower.
OCR_ZOOM = 2.0

# Use "eng" if pages are English only, "eng+ben" if Bangla instructions/labels
# are mixed in and you've installed the Bangla traineddata for Tesseract.
OCR_LANG = "eng"


def ocr_page(page) -> str:
    mat = fitz.Matrix(OCR_ZOOM, OCR_ZOOM)
    pix = page.get_pixmap(matrix=mat)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(img, lang=OCR_LANG)


def extract_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    pages = []

    for page_number, page in enumerate(doc):
        native_text = page.get_text().strip()

        if len(native_text) >= NATIVE_TEXT_MIN_CHARS:
            text = native_text
            method = "native"
        else:
            text = ocr_page(page).strip()
            method = "ocr"

        if text:
            pages.append({
                "book": pdf_path.stem,
                "page": page_number + 1,
                "text": text,
                "method": method,
            })
            print(f"  page {page_number + 1}: {method}, {len(text)} chars")

    doc.close()
    return pages


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    all_pages = []

    for pdf in PDF_FOLDER.glob("*.pdf"):
        print("Processing:", pdf.name)
        pages = extract_pdf(pdf)
        all_pages.extend(pages)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for item in all_pages:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Saved {len(all_pages)} pages")


if __name__ == "__main__":
    main()