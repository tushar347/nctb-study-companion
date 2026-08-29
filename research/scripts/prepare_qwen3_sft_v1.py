from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"Invalid JSONL at {path}:{line_number}: {error}"
                ) from error
            if not isinstance(value, dict):
                raise ValueError(
                    f"Expected a JSON object at {path}:{line_number}."
                )
            records.append(value)
    return records


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_key(value: str, seed: int) -> str:
    return hashlib.sha256(f"{seed}|{value}".encode("utf-8")).hexdigest()


def parse_lock_hash(lock_path: Path) -> str:
    text = lock_path.read_text(encoding="utf-8-sig")
    match = re.search(r"SHA256:\s*([0-9a-fA-F]{64})", text)
    if not match:
        raise RuntimeError(f"Could not find SHA256 in lock file: {lock_path}")
    return match.group(1).lower()


def normalize_messages(record: dict[str, Any]) -> list[dict[str, str]]:
    messages = record.get("messages")
    example_id = str(record.get("example_id", "<unknown>"))

    if not isinstance(messages, list) or len(messages) < 2:
        raise ValueError(f"{example_id}: missing messages.")

    clean: list[dict[str, str]] = []
    for item in messages:
        if not isinstance(item, dict):
            raise ValueError(f"{example_id}: invalid message.")
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role not in {"system", "user", "assistant"} or not content:
            raise ValueError(f"{example_id}: invalid role/content.")
        clean.append({"role": role, "content": content})

    if clean[-1]["role"] != "assistant":
        raise ValueError(f"{example_id}: last message is not assistant.")

    try:
        parsed_target = json.loads(clean[-1]["content"])
    except json.JSONDecodeError as error:
        raise ValueError(f"{example_id}: assistant target is not JSON.") from error

    if not isinstance(parsed_target, dict):
        raise ValueError(f"{example_id}: assistant target must be an object.")

    return clean


def select_validation_groups(
    records: list[dict[str, Any]],
    validation_fraction: float,
    seed: int,
) -> set[str]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[str(record["source_record_id"])].append(record)

    total_target = max(1, round(len(records) * validation_fraction))
    book_ids = sorted({str(record["book_id"]) for record in records})
    class_targets = {
        book_id: max(
            1,
            round(
                sum(1 for record in records if record["book_id"] == book_id)
                * validation_fraction
            ),
        )
        for book_id in book_ids
    }

    selected: set[str] = set()
    selected_count = 0

    for book_id in book_ids:
        class_groups = [
            (source_id, group_records)
            for source_id, group_records in groups.items()
            if str(group_records[0]["book_id"]) == book_id
        ]
        class_groups.sort(key=lambda item: stable_key(item[0], seed))

        current = 0
        for source_id, group_records in class_groups:
            if current >= class_targets[book_id]:
                break
            selected.add(source_id)
            current += len(group_records)
            selected_count += len(group_records)

    remaining = [
        (source_id, group_records)
        for source_id, group_records in groups.items()
        if source_id not in selected
    ]
    remaining.sort(key=lambda item: stable_key(item[0], seed + 1))

    for source_id, group_records in remaining:
        if selected_count >= total_target:
            break
        selected.add(source_id)
        selected_count += len(group_records)

    if len(selected) >= len(groups):
        largest = max(selected, key=lambda source_id: len(groups[source_id]))
        selected.remove(largest)

    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--validation-fraction", type=float, default=0.20)
    parser.add_argument("--seed", type=int, default=42)
    arguments = parser.parse_args()

    if not 0.05 <= arguments.validation_fraction <= 0.40:
        raise ValueError("--validation-fraction must be between 0.05 and 0.40.")

    root = Path(arguments.root).resolve()

    approved_path = (
        root / "research" / "data" / "processed" / "pilot_sft_approved_v2.jsonl"
    )
    approved_lock_path = (
        root / "research" / "reports" / "pilot_sft_approved_v2_lock.txt"
    )
    test_path = (
        root / "research" / "data" / "splits" / "test_pages_v1_locked.jsonl"
    )
    output_directory = root / "research" / "data" / "training"
    report_directory = root / "research" / "reports"

    for required in (approved_path, approved_lock_path, test_path):
        if not required.exists():
            raise FileNotFoundError(f"Required file not found: {required}")

    expected_approved_hash = parse_lock_hash(approved_lock_path)
    actual_approved_hash = sha256_file(approved_path).lower()
    if expected_approved_hash != actual_approved_hash:
        raise RuntimeError(
            "Approved SFT dataset hash mismatch. Preparation stopped."
        )

    approved_records = load_jsonl(approved_path)
    test_records = load_jsonl(test_path)
    test_ids = {str(record["record_id"]) for record in test_records}

    clean_records: list[dict[str, Any]] = []
    seen_example_ids: set[str] = set()

    for record in approved_records:
        example_id = str(record.get("example_id", "")).strip()
        source_id = str(record.get("source_record_id", "")).strip()
        book_id = str(record.get("book_id", "")).strip()
        task = str(record.get("task", "")).strip()

        if not example_id or example_id in seen_example_ids:
            raise RuntimeError(f"Missing or duplicate example_id: {example_id}")
        seen_example_ids.add(example_id)

        if source_id in test_ids:
            raise RuntimeError(
                f"Locked-test leakage detected for source: {source_id}"
            )
        if book_id not in {"class6-english", "class7-english"}:
            raise RuntimeError(f"Unsupported book_id: {book_id}")
        if task not in {"generate_mcq", "short_extractive_qa"}:
            raise RuntimeError(f"Unsupported task: {task}")
        if record.get("review_status") != "human_approved":
            raise RuntimeError(f"{example_id}: record is not human_approved.")

        clean_records.append(
            {
                "example_id": example_id,
                "source_record_id": source_id,
                "book_id": book_id,
                "class_level": int(record.get("class_level", 0)),
                "task": task,
                "messages": normalize_messages(record),
            }
        )

    validation_sources = select_validation_groups(
        clean_records,
        arguments.validation_fraction,
        arguments.seed,
    )

    training_records = [
        record
        for record in clean_records
        if record["source_record_id"] not in validation_sources
    ]
    validation_records = [
        record
        for record in clean_records
        if record["source_record_id"] in validation_sources
    ]

    train_sources = {
        str(record["source_record_id"]) for record in training_records
    }
    validation_source_ids = {
        str(record["source_record_id"]) for record in validation_records
    }
    overlap = train_sources & validation_source_ids
    if overlap:
        raise RuntimeError(
            f"Source leakage between train and validation: {sorted(overlap)}"
        )

    if not training_records or not validation_records:
        raise RuntimeError("Train or validation split is empty.")

    train_path = output_directory / "qwen3_sft_train_v1.jsonl"
    validation_path = output_directory / "qwen3_sft_validation_v1.jsonl"

    training_records.sort(
        key=lambda record: stable_key(record["example_id"], arguments.seed)
    )
    validation_records.sort(
        key=lambda record: stable_key(record["example_id"], arguments.seed)
    )

    write_jsonl(train_path, training_records)
    write_jsonl(validation_path, validation_records)

    summary = {
        "dataset_version": "nctb-qwen3-sft-v1",
        "source_approved_dataset": str(approved_path.relative_to(root)),
        "approved_dataset_sha256": actual_approved_hash,
        "seed": arguments.seed,
        "validation_fraction_requested": arguments.validation_fraction,
        "total_examples": len(clean_records),
        "train_examples": len(training_records),
        "validation_examples": len(validation_records),
        "train_source_groups": len(train_sources),
        "validation_source_groups": len(validation_source_ids),
        "source_group_overlap": 0,
        "train_task_counts": dict(Counter(record["task"] for record in training_records)),
        "validation_task_counts": dict(
            Counter(record["task"] for record in validation_records)
        ),
        "train_book_counts": dict(
            Counter(record["book_id"] for record in training_records)
        ),
        "validation_book_counts": dict(
            Counter(record["book_id"] for record in validation_records)
        ),
        "train_sha256": sha256_file(train_path),
        "validation_sha256": sha256_file(validation_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "warning": (
            "Pilot smoke-training split only. The locked test split remains "
            "separate and must never be used during fine-tuning."
        ),
    }

    report_directory.mkdir(parents=True, exist_ok=True)
    summary_path = report_directory / "qwen3_sft_split_summary_v1.json"
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print()
    print("QWEN3 SFT DATA PREPARATION COMPLETE")
    print("=" * 68)
    print(f"Approved dataset hash verified: {actual_approved_hash}")
    print(f"Total examples: {len(clean_records)}")
    print(f"Train examples: {len(training_records)}")
    print(f"Validation examples: {len(validation_records)}")
    print(f"Train source groups: {len(train_sources)}")
    print(f"Validation source groups: {len(validation_source_ids)}")
    print("Source overlap: 0")
    print(f"Train file: {train_path}")
    print(f"Validation file: {validation_path}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
