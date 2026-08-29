from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any


COUNT_KEYS = {
    "pageCount",
    "totalPages",
    "totalPdfPages",
    "ocrPageCount",
    "ocrPages",
    "processedPages",
    "readyPages",
    "availablePageCount",
}


def load_json(path: Path) -> Any:
    return json.loads(
        path.read_text(
            encoding="utf-8-sig",
        ),
    )


def page_number(path: Path) -> int:
    match = re.search(
        r"page-(\d+)\.json$",
        path.name,
        flags=re.IGNORECASE,
    )

    if not match:
        raise ValueError(
            f"Invalid page filename: {path.name}",
        )

    return int(
        match.group(1),
    )


def replace_filename(
    existing: Any,
    filename: str,
    default_prefix: str,
) -> str:
    if isinstance(existing, str) and existing.strip():
        normalized = existing.replace(
            "\\",
            "/",
        )

        if "/" in normalized:
            prefix = normalized.rsplit(
                "/",
                1,
            )[0]

            return (
                f"{prefix}/{filename}"
            )

        return filename

    return (
        f"{default_prefix}/{filename}"
    )


def update_count_fields(
    value: dict[str, Any],
    count: int,
) -> None:
    for key in COUNT_KEYS:
        if key in value:
            value[key] = count


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    args = parser.parse_args()

    root = Path(
        args.root,
    ).resolve()

    books_root = (
        root /
        "public" /
        "ocr" /
        "books"
    )

    book_root = (
        books_root /
        "class8-english"
    )

    page_directory = (
        book_root /
        "pages"
    )

    page_files = sorted(
        page_directory.glob(
            "page-*.json",
        ),
        key=page_number,
    )

    if len(page_files) != 162:
        raise RuntimeError(
            "Expected 162 Class 8 page files, "
            f"but found {len(page_files)}.",
        )

    page_records: list[
        tuple[Path, dict[str, Any]]
    ] = []

    for page_file in page_files:
        value = load_json(
            page_file,
        )

        if not isinstance(
            value,
            dict,
        ):
            raise RuntimeError(
                f"{page_file} is not a JSON object.",
            )

        page_records.append(
            (
                page_file,
                value,
            ),
        )

    index_candidates: list[
        tuple[Path, dict[str, Any]]
    ] = []

    for candidate in books_root.rglob(
        "*.json",
    ):
        if page_directory in candidate.parents:
            continue

        if candidate.name == (
            "class8_ocr_run_summary.json"
        ):
            continue

        try:
            value = load_json(
                candidate,
            )
        except Exception:
            continue

        if not isinstance(
            value,
            dict,
        ):
            continue

        pages = value.get(
            "pages",
        )

        if not isinstance(
            pages,
            list,
        ):
            continue

        metadata = value.get(
            "metadata",
        )

        if not isinstance(
            metadata,
            dict,
        ):
            metadata = {}

        book_id = (
            value.get(
                "bookId",
            )
            or value.get(
                "book_id",
            )
            or metadata.get(
                "bookId",
            )
            or metadata.get(
                "book_id",
            )
        )

        if (
            str(book_id).lower()
            == "class8-english"
            or "class8-english"
            in candidate.as_posix().lower()
        ):
            index_candidates.append(
                (
                    candidate,
                    value,
                ),
            )

    if not index_candidates:
        raise RuntimeError(
            "Could not locate the Class 8 "
            "book index JSON file.",
        )

    index_candidates.sort(
        key=lambda item: (
            item[0].parent == book_root,
            "totalPdfPages" in item[1],
            len(
                item[1].get(
                    "pages",
                    [],
                ),
            ),
        ),
        reverse=True,
    )

    index_path, index_data = (
        index_candidates[0]
    )

    existing_pages = index_data.get(
        "pages",
        [],
    )

    template: dict[str, Any] = {}

    if (
        existing_pages
        and isinstance(
            existing_pages[0],
            dict,
        )
    ):
        template = dict(
            existing_pages[0],
        )

    rebuilt_pages: list[
        dict[str, Any]
    ] = []

    for page_file, page_data in page_records:
        entry = dict(
            template,
        )

        # Preserve any existing index-specific fields,
        # then overwrite them with current page data.
        entry.update(
            page_data,
        )

        entry["pageNumber"] = int(
            page_data.get(
                "pageNumber",
                page_number(
                    page_file,
                ),
            ),
        )

        entry["json"] = replace_filename(
            template.get(
                "json",
            ),
            page_file.name,
            "pages",
        )

        image_value = page_data.get(
            "image",
        )

        if image_value:
            image_filename = Path(
                str(image_value).replace(
                    "\\",
                    "/",
                ),
            ).name

            entry["image"] = (
                replace_filename(
                    template.get(
                        "image",
                    ),
                    image_filename,
                    "images",
                )
            )

        rebuilt_pages.append(
            entry,
        )

    timestamp = datetime.now().strftime(
        "%Y%m%d-%H%M%S",
    )

    backup_path = index_path.with_name(
        f"{index_path.stem}"
        f".before-162-pages-"
        f"{timestamp}"
        f"{index_path.suffix}",
    )

    shutil.copy2(
        index_path,
        backup_path,
    )

    index_data["bookId"] = (
        "class8-english"
    )

    index_data["pages"] = (
        rebuilt_pages
    )

    index_data["startPage"] = min(
        int(
            page[
                "pageNumber"
            ],
        )
        for page in rebuilt_pages
    )

    index_data["endPage"] = max(
        int(
            page[
                "pageNumber"
            ],
        )
        for page in rebuilt_pages
    )

    index_data["totalPdfPages"] = 162

    update_count_fields(
        index_data,
        162,
    )

    metadata = index_data.get(
        "metadata",
    )

    if isinstance(
        metadata,
        dict,
    ):
        metadata["bookId"] = (
            "class8-english"
        )

        update_count_fields(
            metadata,
            162,
        )

    index_path.write_text(
        json.dumps(
            index_data,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    relative_index_path = (
        index_path.relative_to(
            root,
        )
    )

    report_directory = (
        root /
        "research" /
        "reports"
    )

    report_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    (
        report_directory /
        "class8_index_path.txt"
    ).write_text(
        str(
            relative_index_path,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "CLASS 8 INDEX REBUILT",
    )

    print(
        "=" * 60,
    )

    print(
        "Index file:",
        relative_index_path,
    )

    print(
        "Old page entries:",
        len(
            existing_pages,
        ),
    )

    print(
        "New page entries:",
        len(
            rebuilt_pages,
        ),
    )

    print(
        "Start page:",
        index_data[
            "startPage"
        ],
    )

    print(
        "End page:",
        index_data[
            "endPage"
        ],
    )

    print(
        "Backup:",
        backup_path,
    )


if __name__ == "__main__":
    main()
