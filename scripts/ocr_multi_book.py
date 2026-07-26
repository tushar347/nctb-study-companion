import argparse
import json
import subprocess
import sys
from pathlib import Path


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
        "--title",
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

    args = parser.parse_args()

    project_root = (
        Path(__file__)
        .resolve()
        .parents[1]
    )

    pdf_path = Path(args.pdf)

    if not pdf_path.is_absolute():
        pdf_path = (
            project_root / pdf_path
        )

    if not pdf_path.exists():
        raise FileNotFoundError(
            f"PDF not found: {pdf_path}"
        )

    original_script = (
        project_root
        / "scripts"
        / "ocr_book_full.py"
    )

    command = [
        sys.executable,
        str(original_script),
        "--pdf",
        str(pdf_path),
        "--book",
        args.book,
        "--start",
        str(args.start),
        "--end",
        str(args.end),
        "--zoom",
        str(args.zoom),
    ]

    if args.force:
        command.append("--force")

    print("Running OCR:")
    print(" ".join(command))
    print()

    subprocess.run(
        command,
        cwd=project_root,
        check=True,
    )

    index_path = (
        project_root
        / "public"
        / "ocr"
        / "books"
        / args.book
        / "index.json"
    )

    with index_path.open(
        "r",
        encoding="utf-8-sig",
    ) as file:
        index_data = json.load(file)

    index_data["bookId"] = args.book
    index_data["title"] = args.title
    index_data["sourcePdf"] = (
        f"/books/{pdf_path.name}"
    )

    with index_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            index_data,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print()
    print("Book metadata updated:")
    print(f"Book: {args.book}")
    print(f"Title: {args.title}")
    print(f"Index: {index_path}")


if __name__ == "__main__":
    main()
