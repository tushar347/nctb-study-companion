from __future__ import annotations

import argparse
import csv
import gc
import hashlib
import json
import re
import statistics
import time
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

EVALUATION_VERSION = "qwen3-1p7b-base-vs-nctb-qlora-v1"
FRONT_MATTER_PATTERNS = (
    "table of contents",
    "lesson list",
    "all rights reserved",
    "first publication",
    "revised edition",
    "for free distribution",
    "prescribed by the national curriculum",
)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not path.exists():
        return records
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSONL at {path}:{line_number}: {error}") from error
            if not isinstance(value, dict):
                raise ValueError(f"Expected JSON object at {path}:{line_number}")
            records.append(value)
    return records


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def normalize_key(value: Any) -> str:
    return normalize(value).casefold()


def contained_in(full_text: Any, fragment: Any) -> bool:
    full = normalize_key(full_text)
    part = normalize_key(fragment)
    return bool(part) and part in full


def extract_hash(lock_path: Path, label: str = "SHA256") -> str:
    text = lock_path.read_text(encoding="utf-8-sig")
    pattern = rf"{re.escape(label)}:\s*([0-9a-fA-F]{{64}})"
    match = re.search(pattern, text)
    if not match:
        raise RuntimeError(f"{label} not found in {lock_path}")
    return match.group(1).lower()


def select_evaluation_pages(test_pages: list[dict[str, Any]], per_book: int) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []

    for book_id in ("class6-english", "class7-english"):
        candidates: list[dict[str, Any]] = []

        for record in test_pages:
            if str(record.get("book_id", "")) != book_id:
                continue

            text = normalize(record.get("text", ""))
            if not text:
                continue

            words = int(record.get("word_count", 0) or len(text.split()))
            if words < 70 or words > 400:
                continue

            if any(pattern in text.casefold() for pattern in FRONT_MATTER_PATTERNS):
                continue

            candidate = dict(record)
            candidate["_selection_text"] = text
            candidate["_selection_words"] = words
            candidates.append(candidate)

        candidates.sort(
            key=lambda record: (
                bool(record.get("manual_review_required", False)),
                abs(int(record["_selection_words"]) - 180),
                sha256_text(str(record.get("record_id", ""))),
            )
        )

        if len(candidates) < per_book:
            raise RuntimeError(
                f"Not enough eligible locked-test pages for {book_id}. "
                f"Needed {per_book}, found {len(candidates)}."
            )

        selected.extend(candidates[:per_book])

    manifest: list[dict[str, Any]] = []

    for record in selected:
        source_id = str(record["record_id"])
        text = str(record["_selection_text"])

        manifest.append(
            {
                "eval_id": f"eval-{source_id}",
                "evaluation_version": "locked-baseline-eval-v1",
                "source_record_id": source_id,
                "book_id": record.get("book_id"),
                "class_level": record.get("class_level"),
                "page_number": record.get("page_number"),
                "lesson_number": record.get("lesson_number"),
                "source_text_sha256": record.get("text_sha256") or sha256_text(text),
                "source_manual_review_required": bool(record.get("manual_review_required", False)),
                "word_count": len(text.split()),
                "text": text,
                "split": "test_locked",
            }
        )

    manifest.sort(
        key=lambda record: (
            str(record["book_id"]),
            int(record.get("page_number", 0) or 0),
        )
    )
    return manifest


def prompt_for_task(source: dict[str, Any], task: str) -> list[dict[str, str]]:
    system_message = (
        "You create educational assessment items using only the supplied NCTB English "
        "textbook passage. Return valid JSON only. Do not include reasoning or markdown."
    )

    passage = str(source["text"])
    class_level = source.get("class_level", "")

    if task == "generate_mcq":
        instruction = f"""PASSAGE:
{passage}

Create exactly one multiple-choice question suitable for Class {class_level}.

Rules:
- Use only information in the passage.
- Provide exactly four unique options.
- correct_answer must exactly match one option.
- correct_answer must be copied exactly from the passage.
- evidence_quote must be an exact continuous quote from the passage.
- evidence_quote must contain the correct answer.
- Do not ask about formatting, OCR, page numbers, publishers, editions or copyright.

Return exactly:
{{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "correct_answer": "exact passage phrase",
  "evidence_quote": "exact passage quote"
}}"""
    elif task == "short_extractive_qa":
        instruction = f"""PASSAGE:
{passage}

Create exactly one short-answer question suitable for Class {class_level}.

Rules:
- Use only information in the passage.
- The answer must be copied exactly from the passage.
- The answer must be one continuous phrase containing no more than 20 words.
- evidence_quote must be an exact continuous quote from the passage.
- evidence_quote must contain the answer.
- Do not ask about formatting, OCR, page numbers, publishers, editions or copyright.

Return exactly:
{{
  "question": "string",
  "answer": "exact passage phrase",
  "evidence_quote": "exact passage quote"
}}"""
    else:
        raise ValueError(f"Unsupported task: {task}")

    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": instruction.strip()},
    ]


def validate_generated(task: str, parsed: Any, passage: str) -> tuple[list[str], bool, bool]:
    errors: list[str] = []

    if not isinstance(parsed, dict):
        return ["root response is not a JSON object"], False, False

    question = normalize(parsed.get("question", ""))
    schema_pass = True
    grounding_pass = True

    if len(question) < 8:
        errors.append("question is missing or too short")
        schema_pass = False

    if task == "generate_mcq":
        options = parsed.get("options")
        answer = normalize(parsed.get("correct_answer", ""))
        evidence = normalize(parsed.get("evidence_quote", ""))

        if not isinstance(options, list) or len(options) != 4:
            errors.append("MCQ must contain exactly four options")
            schema_pass = False
            options = []

        normalized_options = [normalize_key(option) for option in options]

        if normalized_options and len(set(normalized_options)) != len(normalized_options):
            errors.append("MCQ options are not unique")
            schema_pass = False

        if normalize_key(answer) not in normalized_options:
            errors.append("correct_answer does not match an option")
            schema_pass = False
    else:
        answer = normalize(parsed.get("answer", ""))
        evidence = normalize(parsed.get("evidence_quote", ""))

        if not answer:
            errors.append("answer is missing")
            schema_pass = False

        if len(answer.split()) > 20:
            errors.append("answer contains more than 20 words")
            schema_pass = False

    if not contained_in(passage, answer):
        errors.append("answer is not an exact passage phrase")
        grounding_pass = False

    if not contained_in(passage, evidence):
        errors.append("evidence_quote is not an exact passage quote")
        grounding_pass = False

    if answer and evidence and not contained_in(evidence, answer):
        errors.append("evidence_quote does not contain the answer")
        grounding_pass = False

    return sorted(set(errors)), schema_pass, grounding_pass


def get_manifest(data_root: Path, output_root: Path, per_book: int):
    test_path = data_root / "research/data/splits/test_pages_v1_locked.jsonl"
    test_lock = data_root / "research/reports/test_split_v1_lock.txt"

    if not test_path.exists() or not test_lock.exists():
        raise FileNotFoundError("Locked test file or its lock file is missing.")

    expected_test_hash = extract_hash(test_lock, "SHA256")
    actual_test_hash = sha256_file(test_path).lower()

    if expected_test_hash != actual_test_hash:
        raise RuntimeError("Locked test-set hash mismatch. Evaluation stopped.")

    existing_manifest = data_root / "research/data/evaluation/eval_manifest_v1.jsonl"
    existing_lock = data_root / "research/reports/eval_manifest_v1_lock.txt"

    if existing_manifest.exists() and existing_lock.exists():
        expected_manifest_hash = extract_hash(existing_lock, "Manifest SHA256")
        actual_manifest_hash = sha256_file(existing_manifest).lower()

        if expected_manifest_hash != actual_manifest_hash:
            raise RuntimeError("Existing evaluation manifest hash mismatch.")

        manifest = load_jsonl(existing_manifest)
        if len(manifest) != per_book * 2:
            raise RuntimeError(
                f"Existing manifest has {len(manifest)} pages; expected {per_book * 2}."
            )

        print("Using the original locked evaluation manifest.")
        return manifest, actual_test_hash, actual_manifest_hash

    manifest = select_evaluation_pages(load_jsonl(test_path), per_book)
    manifest_path = output_root / "research/data/evaluation/eval_manifest_v1.jsonl"
    write_jsonl(manifest_path, manifest)
    manifest_hash = sha256_file(manifest_path)

    print("Original manifest not supplied; rebuilt with the same deterministic selector.")
    return manifest, actual_test_hash, manifest_hash


def load_tokenizer(model_id: str):
    tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    return tokenizer


def load_model(model_id: str, adapter_dir: Path | None, device: int):
    quant = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    base = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=quant,
        device_map={"": device},
        dtype=torch.float16,
        low_cpu_mem_usage=True,
    )
    base.eval()

    if adapter_dir is None:
        return base

    model = PeftModel.from_pretrained(base, str(adapter_dir))
    model.eval()
    return model


def generate(model, tokenizer, messages, max_new_tokens: int) -> str:
    inputs = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        enable_thinking=False,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)

    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    new_tokens = output[0, inputs["input_ids"].shape[-1]:]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


def evaluate_system(
    system_name: str,
    model,
    tokenizer,
    manifest,
    manifest_hash: str,
    result_path: Path,
    max_new_tokens: int,
):
    existing = load_jsonl(result_path)
    existing_keys = {
        (str(r.get("system", "")), str(r.get("eval_id", "")), str(r.get("task", "")))
        for r in existing
        if r.get("eval_manifest_sha256") == manifest_hash
    }

    total = len(manifest) * 2
    current = 0

    for source in manifest:
        for task in ("generate_mcq", "short_extractive_qa"):
            current += 1
            key = (system_name, str(source["eval_id"]), task)

            if key in existing_keys:
                print(f"[{current}/{total}] SKIP {system_name} {source['eval_id']} {task}")
                continue

            print(f"[{current}/{total}] {system_name} {source['eval_id']} {task}", flush=True)

            started = time.perf_counter()
            raw = ""
            parsed = None
            errors: list[str] = []
            schema_pass = False
            grounding_pass = False
            json_valid = False

            try:
                raw = normalize(
                    generate(
                        model,
                        tokenizer,
                        prompt_for_task(source, task),
                        max_new_tokens,
                    )
                )
                parsed = json.loads(raw)
                errors, schema_pass, grounding_pass = validate_generated(
                    task, parsed, str(source["text"])
                )
                json_valid = True
            except json.JSONDecodeError as error:
                errors = [f"invalid JSON: {error}"]
            except Exception as error:
                errors = [f"{type(error).__name__}: {error}"]

            duration = time.perf_counter() - started
            automatic_pass = (
                json_valid and schema_pass and grounding_pass and not errors
            )

            append_jsonl(
                result_path,
                {
                    "evaluation_version": EVALUATION_VERSION,
                    "eval_manifest_sha256": manifest_hash,
                    "system": system_name,
                    "eval_id": source["eval_id"],
                    "source_record_id": source["source_record_id"],
                    "book_id": source["book_id"],
                    "class_level": source["class_level"],
                    "page_number": source["page_number"],
                    "task": task,
                    "json_valid": json_valid,
                    "schema_pass": schema_pass,
                    "grounding_pass": grounding_pass,
                    "automatic_pass": automatic_pass,
                    "validation_errors": errors,
                    "parsed_output": parsed,
                    "raw_response": raw,
                    "duration_seconds": round(duration, 4),
                    "evaluated_at": datetime.now(timezone.utc).isoformat(),
                },
            )

            existing_keys.add(key)
            status = "PASS" if automatic_pass else "FAIL"
            print(f"  {status} time={duration:.2f}s errors={len(errors)}", flush=True)


def summarize(result_path: Path, manifest_hash: str, locked_test_hash: str, output_root: Path):
    all_results = [
        r for r in load_jsonl(result_path)
        if r.get("eval_manifest_sha256") == manifest_hash
    ]

    unique = {}
    for r in all_results:
        unique[(str(r["system"]), str(r["eval_id"]), str(r["task"]))] = r
    all_results = sorted(unique.values(), key=lambda r: (r["system"], r["eval_id"], r["task"]))
    write_jsonl(result_path, all_results)

    grouped = defaultdict(list)
    for r in all_results:
        grouped[(str(r["system"]), str(r["task"]))].append(r)

    group_results = []
    for (system, task), rows in sorted(grouped.items()):
        total = len(rows)
        durations = [float(r.get("duration_seconds", 0) or 0) for r in rows]

        def count(key: str) -> int:
            return sum(bool(r.get(key)) for r in rows)

        j = count("json_valid")
        s = count("schema_pass")
        g = count("grounding_pass")
        p = count("automatic_pass")

        group_results.append(
            {
                "system": system,
                "task": task,
                "total_examples": total,
                "json_valid": j,
                "json_valid_rate_percent": round(j / total * 100, 2),
                "schema_pass": s,
                "schema_pass_rate_percent": round(s / total * 100, 2),
                "grounding_pass": g,
                "grounding_pass_rate_percent": round(g / total * 100, 2),
                "automatic_pass": p,
                "automatic_pass_rate_percent": round(p / total * 100, 2),
                "mean_duration_seconds": round(statistics.mean(durations), 3) if durations else 0,
            }
        )

    systems = ["qwen3-1.7b-base-hf", "nctb-qwen3-1.7b-qlora-v1"]
    by_key = {(g["system"], g["task"]): g for g in group_results}
    deltas = []

    for task in ("generate_mcq", "short_extractive_qa"):
        base = by_key.get((systems[0], task))
        tuned = by_key.get((systems[1], task))
        if base and tuned:
            deltas.append(
                {
                    "task": task,
                    "json_valid_delta_pp": round(
                        tuned["json_valid_rate_percent"] - base["json_valid_rate_percent"], 2
                    ),
                    "schema_pass_delta_pp": round(
                        tuned["schema_pass_rate_percent"] - base["schema_pass_rate_percent"], 2
                    ),
                    "grounding_pass_delta_pp": round(
                        tuned["grounding_pass_rate_percent"] - base["grounding_pass_rate_percent"], 2
                    ),
                    "automatic_pass_delta_pp": round(
                        tuned["automatic_pass_rate_percent"] - base["automatic_pass_rate_percent"], 2
                    ),
                }
            )

    summary = {
        "evaluation_version": EVALUATION_VERSION,
        "locked_test_sha256": locked_test_hash,
        "evaluation_manifest_sha256": manifest_hash,
        "systems": systems,
        "completed_result_records": len(all_results),
        "group_results": group_results,
        "fine_tuning_effect": deltas,
        "fairness_note": (
            "Both systems use Qwen/Qwen3-1.7B, the same 4-bit quantization, "
            "Transformers backend, prompts, locked pages, and validator. "
            "The NCTB QLoRA adapter is the model-side difference."
        ),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    summary_path = output_root / "research/reports/qwen3_1p7b_base_vs_finetuned_summary_v1.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("\nQWEN3 1.7B BASE VS FINE-TUNED EVALUATION COMPLETE")
    print("=" * 76)
    print("Locked test SHA256:", locked_test_hash)
    print("Evaluation manifest SHA256:", manifest_hash)
    print("Result records:", len(all_results))
    print()

    for group in group_results:
        print(f"{group['system']} | {group['task']}")
        print(f"  JSON valid: {group['json_valid']}/{group['total_examples']} ({group['json_valid_rate_percent']}%)")
        print(f"  Schema pass: {group['schema_pass']}/{group['total_examples']} ({group['schema_pass_rate_percent']}%)")
        print(f"  Grounding pass: {group['grounding_pass']}/{group['total_examples']} ({group['grounding_pass_rate_percent']}%)")
        print(f"  Full automatic pass: {group['automatic_pass']}/{group['total_examples']} ({group['automatic_pass_rate_percent']}%)")
        print(f"  Mean time: {group['mean_duration_seconds']}s")
        print()

    print("FINE-TUNING EFFECT")
    print("-" * 76)
    for item in deltas:
        print(item["task"])
        print(f"  Full-pass delta: {item['automatic_pass_delta_pp']:+.2f} percentage points")
        print(f"  Grounding delta: {item['grounding_pass_delta_pp']:+.2f} percentage points")
        print()

    print("Results:", result_path)
    print("Summary:", summary_path)


def unload(model):
    del model
    gc.collect()
    torch.cuda.empty_cache()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--output-root", default="/kaggle/working/nctb_finetune_eval_v1")
    parser.add_argument("--model-id", default="Qwen/Qwen3-1.7B")
    parser.add_argument(
        "--adapter-dir",
        default="/kaggle/working/nctb-qwen3-1.7b-qlora-v1/final_adapter",
    )
    parser.add_argument("--per-book", type=int, default=5)
    parser.add_argument("--max-new-tokens", type=int, default=260)
    parser.add_argument("--device", type=int, default=0)
    args = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU not detected.")

    data_root = Path(args.root).resolve()
    output_root = Path(args.output_root).resolve()
    adapter_dir = Path(args.adapter_dir).resolve()

    if not adapter_dir.exists():
        raise FileNotFoundError(f"Adapter directory not found: {adapter_dir}")

    manifest, locked_test_hash, manifest_hash = get_manifest(
        data_root, output_root, args.per_book
    )

    print("NCTB QWEN3 1.7B BASE VS FINE-TUNED LOCKED EVALUATION")
    print("=" * 76)
    print("GPU:", torch.cuda.get_device_name(args.device))
    print("Base model:", args.model_id)
    print("Adapter:", adapter_dir)
    print("Locked pages:", len(manifest))
    print("Manifest SHA256:", manifest_hash)
    print()

    tokenizer = load_tokenizer(args.model_id)
    result_path = (
        output_root
        / "research/data/evaluation/qwen3_1p7b_base_vs_finetuned_results_v1.jsonl"
    )

    print("PHASE 1/2: BASE QWEN3-1.7B")
    base = load_model(args.model_id, None, args.device)
    evaluate_system(
        "qwen3-1.7b-base-hf",
        base,
        tokenizer,
        manifest,
        manifest_hash,
        result_path,
        args.max_new_tokens,
    )
    unload(base)

    print("\nPHASE 2/2: NCTB QLORA ADAPTER")
    tuned = load_model(args.model_id, adapter_dir, args.device)
    evaluate_system(
        "nctb-qwen3-1.7b-qlora-v1",
        tuned,
        tokenizer,
        manifest,
        manifest_hash,
        result_path,
        args.max_new_tokens,
    )
    unload(tuned)

    summarize(
        result_path,
        manifest_hash,
        locked_test_hash,
        output_root,
    )


if __name__ == "__main__":
    main()
