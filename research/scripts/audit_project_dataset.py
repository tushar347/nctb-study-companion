from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import re
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXCLUDED_DIRECTORIES = {
    ".git",
    ".next",
    ".vercel",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    "backups",
    "backup",
    "dist",
    "build",
    "coverage",
    "research",
    "scoring-s1-package",
    "scoring-s1-v2-package",
}

IGNORED_FILENAMES = {
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "components.json",
    "next-env.d.ts",
}

DATA_EXTENSIONS = {
    ".json",
    ".jsonl",
    ".csv",
    ".txt",
}

SENSITIVE_KEYS = {
    "email",
    "phone",
    "phoneNumber",
    "password",
    "passwordHash",
    "studentId",
    "userId",
    "sessionId",
    "accessToken",
    "refreshToken",
    "name",
    "fullName",
    "address",
    "dateOfBirth",
}

METADATA_KEYS = {
    "class",
    "classLevel",
    "grade",
    "book",
    "bookKey",
    "bookId",
    "subject",
    "unit",
    "unitNo",
    "lesson",
    "lessonNo",
    "page",
    "pageNumber",
    "language",
    "task",
    "questionType",
}

COMMON_RECORD_ARRAY_KEYS = (
    "records",
    "items",
    "data",
    "pages",
    "questions",
    "lessons",
    "attempts",
    "entries",
    "results",
    "content",
)


def should_skip(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True

    if any(
        part.lower() in EXCLUDED_DIRECTORIES
        for part in relative.parts[:-1]
    ):
        return True

    return path.name.lower() in {
        name.lower()
        for name in IGNORED_FILENAMES
    }


def classify_file(path: Path) -> str:
    text = str(path).lower()

    if any(
        token in text
        for token in (
            "ocr",
            "textbook",
            "book-data",
            "book_data",
            "english-for-today",
            "english_for_today",
            "eft-c",
            "page-data",
            "page_data",
        )
    ):
        return "TEXTBOOK_OCR"

    if any(
        token in text
        for token in (
            "quiz",
            "question",
            "exam",
            "mcq",
            "fill-blank",
            "fill_blank",
        )
    ):
        return "ASSESSMENT"

    if any(
        token in text
        for token in (
            "spelling",
            "read-aloud",
            "read_aloud",
            "speaking",
            "voice",
            "transcript",
        )
    ):
        return "VOICE_PRACTICE"

    if any(
        token in text
        for token in (
            "game",
            "matching",
            "grammar-game",
        )
    ):
        return "GAME"

    if any(
        token in text
        for token in (
            "teacher",
            "gemini",
            "explain",
            "assistant",
            "prompt",
        )
    ):
        return "AI_TEACHER"

    if any(
        token in text
        for token in (
            "student",
            "progress",
            "wallet",
            "reward",
            "attempt",
            "tracking",
        )
    ):
        return "OPERATIONAL_STUDENT_DATA"

    return "OTHER"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


def collect_keys(
    value: Any,
    keys: set[str],
    depth: int = 0,
    maximum_depth: int = 8,
) -> None:
    if depth > maximum_depth:
        return

    if isinstance(value, dict):
        for key, nested in value.items():
            keys.add(str(key))

            collect_keys(
                nested,
                keys,
                depth + 1,
                maximum_depth,
            )

    elif isinstance(value, list):
        for item in value[:100]:
            collect_keys(
                item,
                keys,
                depth + 1,
                maximum_depth,
            )


def collect_metadata(
    value: Any,
    found: dict[str, set[str]],
    depth: int = 0,
    maximum_depth: int = 8,
) -> None:
    if depth > maximum_depth:
        return

    if isinstance(value, dict):
        for key, nested in value.items():
            key_text = str(key)

            if (
                key_text in METADATA_KEYS
                and isinstance(
                    nested,
                    (
                        str,
                        int,
                        float,
                        bool,
                    ),
                )
            ):
                found[key_text].add(
                    str(nested).strip(),
                )

            collect_metadata(
                nested,
                found,
                depth + 1,
                maximum_depth,
            )

    elif isinstance(value, list):
        for item in value[:200]:
            collect_metadata(
                item,
                found,
                depth + 1,
                maximum_depth,
            )


def estimate_json_records(value: Any) -> int:
    if isinstance(value, list):
        return len(value)

    if isinstance(value, dict):
        for key in COMMON_RECORD_ARRAY_KEYS:
            nested = value.get(key)

            if isinstance(nested, list):
                return len(nested)

        return 1

    return 0


def inspect_json(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "parse_status": "OK",
        "estimated_records": 0,
        "keys": [],
        "sensitive_keys": [],
        "metadata": {},
    }

    try:
        with path.open(
            "r",
            encoding="utf-8-sig",
        ) as handle:
            value = json.load(handle)

        keys: set[str] = set()
        metadata: dict[str, set[str]] = defaultdict(set)

        collect_keys(
            value,
            keys,
        )

        collect_metadata(
            value,
            metadata,
        )

        result["estimated_records"] = (
            estimate_json_records(value)
        )

        result["keys"] = sorted(keys)

        result["sensitive_keys"] = sorted(
            keys.intersection(
                SENSITIVE_KEYS,
            ),
        )

        result["metadata"] = {
            key: sorted(values)[:100]
            for key, values in metadata.items()
        }

    except Exception as error:
        result["parse_status"] = (
            f"ERROR: {type(error).__name__}: {error}"
        )

    return result


def inspect_jsonl(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "parse_status": "OK",
        "estimated_records": 0,
        "keys": [],
        "sensitive_keys": [],
        "metadata": {},
    }

    keys: set[str] = set()
    metadata: dict[str, set[str]] = defaultdict(set)
    records = 0
    errors = 0

    try:
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

                records += 1

                try:
                    value = json.loads(line)

                    if records <= 500:
                        collect_keys(
                            value,
                            keys,
                        )

                        collect_metadata(
                            value,
                            metadata,
                        )

                except json.JSONDecodeError:
                    errors += 1

        if errors:
            result["parse_status"] = (
                f"PARTIAL: {errors} invalid JSONL line(s)"
            )

        result["estimated_records"] = records
        result["keys"] = sorted(keys)

        result["sensitive_keys"] = sorted(
            keys.intersection(
                SENSITIVE_KEYS,
            ),
        )

        result["metadata"] = {
            key: sorted(values)[:100]
            for key, values in metadata.items()
        }

    except Exception as error:
        result["parse_status"] = (
            f"ERROR: {type(error).__name__}: {error}"
        )

    return result


def inspect_csv(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "parse_status": "OK",
        "estimated_records": 0,
        "keys": [],
        "sensitive_keys": [],
        "metadata": {},
    }

    try:
        with path.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as handle:
            reader = csv.DictReader(handle)

            fieldnames = (
                reader.fieldnames
                or []
            )

            count = 0
            metadata: dict[str, set[str]] = defaultdict(set)

            for row in reader:
                count += 1

                if count <= 500:
                    for key in METADATA_KEYS:
                        value = row.get(key)

                        if value:
                            metadata[key].add(
                                str(value).strip(),
                            )

        result["estimated_records"] = count
        result["keys"] = sorted(fieldnames)

        result["sensitive_keys"] = sorted(
            set(fieldnames).intersection(
                SENSITIVE_KEYS,
            ),
        )

        result["metadata"] = {
            key: sorted(values)[:100]
            for key, values in metadata.items()
        }

    except Exception as error:
        result["parse_status"] = (
            f"ERROR: {type(error).__name__}: {error}"
        )

    return result


def inspect_text(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "parse_status": "OK",
        "estimated_records": 0,
        "keys": [],
        "sensitive_keys": [],
        "metadata": {},
    }

    try:
        with path.open(
            "r",
            encoding="utf-8-sig",
            errors="replace",
        ) as handle:
            non_empty_lines = sum(
                1
                for line in handle
                if line.strip()
            )

        result["estimated_records"] = (
            non_empty_lines
        )

    except Exception as error:
        result["parse_status"] = (
            f"ERROR: {type(error).__name__}: {error}"
        )

    return result


def inspect_file(path: Path) -> dict[str, Any]:
    extension = path.suffix.lower()

    if extension == ".json":
        return inspect_json(path)

    if extension == ".jsonl":
        return inspect_jsonl(path)

    if extension == ".csv":
        return inspect_csv(path)

    return inspect_text(path)


def get_gpu_information() -> list[dict[str, str]]:
    command = [
        "nvidia-smi",
        "--query-gpu=name,memory.total,memory.free,driver_version",
        "--format=csv,noheader,nounits",
    ]

    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )

        devices: list[dict[str, str]] = []

        for line in result.stdout.splitlines():
            parts = [
                part.strip()
                for part in line.split(",")
            ]

            if len(parts) >= 4:
                devices.append(
                    {
                        "name": parts[0],
                        "memory_total_mb": parts[1],
                        "memory_free_mb": parts[2],
                        "driver_version": parts[3],
                    },
                )

        return devices

    except Exception as error:
        return [
            {
                "error": (
                    f"{type(error).__name__}: {error}"
                ),
            },
        ]


def extract_prisma_models(schema_path: Path) -> list[str]:
    if not schema_path.exists():
        return []

    source = schema_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    return re.findall(
        r"(?m)^\s*model\s+([A-Za-z0-9_]+)\s*\{",
        source,
    )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--root",
        default=".",
    )

    arguments = parser.parse_args()

    root = Path(
        arguments.root,
    ).resolve()

    research_root = (
        root /
        "research"
    )

    reports_directory = (
        research_root /
        "reports"
    )

    data_directory = (
        research_root /
        "data"
    )

    reports_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    data_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    files: list[Path] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        if should_skip(
            path,
            root,
        ):
            continue

        if path.suffix.lower() not in DATA_EXTENSIONS:
            continue

        files.append(path)

    file_rows: list[dict[str, Any]] = []
    hashes: dict[str, list[str]] = defaultdict(list)
    category_counts: Counter[str] = Counter()
    category_records: Counter[str] = Counter()
    parse_status_counts: Counter[str] = Counter()
    all_sensitive_fields: Counter[str] = Counter()
    all_metadata: dict[str, set[str]] = defaultdict(set)

    for index, path in enumerate(
        sorted(files),
        start=1,
    ):
        relative_path = str(
            path.relative_to(root),
        )

        category = classify_file(path)
        details = inspect_file(path)

        file_hash = sha256_file(path)

        hashes[file_hash].append(
            relative_path,
        )

        category_counts[category] += 1

        category_records[category] += int(
            details.get(
                "estimated_records",
                0,
            )
            or 0
        )

        parse_status = str(
            details.get(
                "parse_status",
                "UNKNOWN",
            ),
        )

        status_group = (
            "OK"
            if parse_status == "OK"
            else (
                "PARTIAL"
                if parse_status.startswith(
                    "PARTIAL",
                )
                else "ERROR"
            )
        )

        parse_status_counts[
            status_group
        ] += 1

        for sensitive_key in details.get(
            "sensitive_keys",
            [],
        ):
            all_sensitive_fields[
                sensitive_key
            ] += 1

        for key, values in details.get(
            "metadata",
            {},
        ).items():
            for value in values:
                all_metadata[key].add(
                    value,
                )

        file_rows.append(
            {
                "index": index,
                "relative_path": relative_path,
                "category": category,
                "extension": path.suffix.lower(),
                "size_bytes": path.stat().st_size,
                "estimated_records": details.get(
                    "estimated_records",
                    0,
                ),
                "parse_status": parse_status,
                "sensitive_keys": "|".join(
                    details.get(
                        "sensitive_keys",
                        [],
                    ),
                ),
                "observed_keys": "|".join(
                    details.get(
                        "keys",
                        [],
                    )[:100],
                ),
                "sha256": file_hash,
            },
        )

    duplicate_groups = [
        paths
        for paths in hashes.values()
        if len(paths) > 1
    ]

    prisma_models = extract_prisma_models(
        root /
        "prisma" /
        "schema.prisma",
    )

    generated_at = datetime.now(
        timezone.utc,
    ).isoformat()

    hardware = {
        "platform": platform.platform(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
        "gpu": get_gpu_information(),
    }

    inventory_csv = (
        data_directory /
        "project_data_inventory.csv"
    )

    with inventory_csv.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(
                file_rows[0].keys(),
            )
            if file_rows
            else [
                "index",
                "relative_path",
                "category",
                "extension",
                "size_bytes",
                "estimated_records",
                "parse_status",
                "sensitive_keys",
                "observed_keys",
                "sha256",
            ],
        )

        writer.writeheader()
        writer.writerows(file_rows)

    audit_json = {
        "generated_at": generated_at,
        "project_root": str(root),
        "hardware": hardware,
        "summary": {
            "files_scanned": len(file_rows),
            "category_file_counts": dict(
                category_counts,
            ),
            "category_estimated_records": dict(
                category_records,
            ),
            "parse_status_counts": dict(
                parse_status_counts,
            ),
            "duplicate_groups": len(
                duplicate_groups,
            ),
            "sensitive_field_occurrences": dict(
                all_sensitive_fields,
            ),
            "prisma_models": prisma_models,
        },
        "metadata_values": {
            key: sorted(values)
            for key, values in all_metadata.items()
        },
        "duplicate_file_groups": duplicate_groups,
        "files": file_rows,
    }

    audit_json_path = (
        reports_directory /
        "dataset_audit.json"
    )

    audit_json_path.write_text(
        json.dumps(
            audit_json,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    report_lines: list[str] = [
        "# NCTB Study Companion Dataset Audit",
        "",
        f"Generated: {generated_at}",
        "",
        "## Hardware",
        "",
        f"- Platform: {hardware['platform']}",
        f"- Processor: {hardware['processor'] or 'Not reported'}",
        f"- Python: {hardware['python_version']}",
    ]

    for gpu in hardware["gpu"]:
        if "error" in gpu:
            report_lines.append(
                f"- GPU detection: {gpu['error']}",
            )
        else:
            report_lines.extend(
                [
                    f"- GPU: {gpu['name']}",
                    (
                        "- GPU memory: "
                        f"{gpu['memory_total_mb']} MB total, "
                        f"{gpu['memory_free_mb']} MB free"
                    ),
                    (
                        "- NVIDIA driver: "
                        f"{gpu['driver_version']}"
                    ),
                ],
            )

    report_lines.extend(
        [
            "",
            "## File Inventory",
            "",
            f"- Data-like files scanned: {len(file_rows)}",
            f"- Successfully parsed: {parse_status_counts.get('OK', 0)}",
            f"- Partially parsed: {parse_status_counts.get('PARTIAL', 0)}",
            f"- Parse errors: {parse_status_counts.get('ERROR', 0)}",
            "",
            "## Data Categories",
            "",
            "| Category | Files | Estimated records |",
            "|---|---:|---:|",
        ],
    )

    all_categories = sorted(
        set(category_counts)
        | set(category_records),
    )

    for category in all_categories:
        report_lines.append(
            (
                f"| {category} | "
                f"{category_counts.get(category, 0)} | "
                f"{category_records.get(category, 0)} |"
            ),
        )

    report_lines.extend(
        [
            "",
            "## Observed Metadata",
            "",
        ],
    )

    if all_metadata:
        for key in sorted(all_metadata):
            values = sorted(
                all_metadata[key],
            )

            preview = ", ".join(
                values[:30],
            )

            if len(values) > 30:
                preview += (
                    f", ... ({len(values)} values)"
                )

            report_lines.append(
                f"- **{key}:** {preview}",
            )
    else:
        report_lines.append(
            "- No common textbook metadata fields were detected.",
        )

    report_lines.extend(
        [
            "",
            "## Prisma Models",
            "",
        ],
    )

    if prisma_models:
        for model in prisma_models:
            report_lines.append(
                f"- {model}",
            )
    else:
        report_lines.append(
            "- Prisma schema models were not detected.",
        )

    report_lines.extend(
        [
            "",
            "## Duplicate Files",
            "",
            (
                "- Exact duplicate groups: "
                f"{len(duplicate_groups)}"
            ),
        ],
    )

    for group_index, group in enumerate(
        duplicate_groups[:30],
        start=1,
    ):
        report_lines.append(
            f"- Group {group_index}: "
            + " | ".join(group),
        )

    report_lines.extend(
        [
            "",
            "## Sensitive-field Review",
            "",
        ],
    )

    if all_sensitive_fields:
        report_lines.append(
            "The following field names were detected. "
            "Their values must not be placed in a public training dataset "
            "without anonymization and approval:",
        )

        report_lines.append("")

        for key, count in sorted(
            all_sensitive_fields.items(),
        ):
            report_lines.append(
                f"- {key}: found in {count} file(s)",
            )
    else:
        report_lines.append(
            "- No configured sensitive field names were detected in parsed data files.",
        )

    report_lines.extend(
        [
            "",
            "## Preliminary Dataset Readiness",
            "",
            "- TEXTBOOK_OCR files may provide passages and source grounding.",
            "- ASSESSMENT files may provide question-generation and answer examples.",
            "- VOICE_PRACTICE files may provide transcript-based feedback examples.",
            "- AI_TEACHER data may contain useful instruction-response pairs, but outputs require quality review.",
            "- OPERATIONAL_STUDENT_DATA should not be copied directly into the public training dataset.",
            "- Raw OCR text is not automatically a supervised fine-tuning dataset.",
            "- Train, validation, and test splits should be separated by lesson, unit, or page group.",
            "",
            "## Generated Files",
            "",
            f"- Inventory CSV: {inventory_csv.relative_to(root)}",
            f"- Full audit JSON: {audit_json_path.relative_to(root)}",
            "- This report: research/reports/dataset_audit.md",
        ],
    )

    report_path = (
        reports_directory /
        "dataset_audit.md"
    )

    report_path.write_text(
        "\n".join(report_lines) + "\n",
        encoding="utf-8",
    )

    print()
    print("NCTB DATASET AUDIT COMPLETE")
    print("=" * 60)
    print(
        f"Files scanned: {len(file_rows)}",
    )

    for category in all_categories:
        print(
            f"{category}: "
            f"{category_counts.get(category, 0)} file(s), "
            f"{category_records.get(category, 0)} estimated record(s)",
        )

    print(
        f"Duplicate groups: {len(duplicate_groups)}",
    )

    print(
        f"Sensitive field types detected: "
        f"{len(all_sensitive_fields)}",
    )

    print()
    print(
        "Report:",
        report_path,
    )

    print(
        "Inventory:",
        inventory_csv,
    )

    print(
        "Full JSON:",
        audit_json_path,
    )


if __name__ == "__main__":
    main()
