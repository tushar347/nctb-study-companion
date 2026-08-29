from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from datasets import load_dataset
from peft import PeftModel
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--model-id", default="Qwen/Qwen3-1.7B")
    parser.add_argument(
        "--adapter-dir",
        default="research/models/nctb-qwen3-1.7b-qlora-v1/final_adapter",
    )
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--max-new-tokens", type=int, default=220)
    arguments = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU not detected.")

    root = Path(arguments.root).resolve()
    validation_path = (
        root
        / "research"
        / "data"
        / "training"
        / "qwen3_sft_validation_v1.jsonl"
    )
    adapter_dir = (root / arguments.adapter_dir).resolve()

    if not validation_path.exists():
        raise FileNotFoundError(validation_path)
    if not adapter_dir.exists():
        raise FileNotFoundError(adapter_dir)

    supports_bf16 = torch.cuda.is_bf16_supported()
    compute_dtype = torch.bfloat16 if supports_bf16 else torch.float16

    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    tokenizer = AutoTokenizer.from_pretrained(
        str(adapter_dir),
        use_fast=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    base_model = AutoModelForCausalLM.from_pretrained(
        arguments.model_id,
        quantization_config=quantization_config,
        device_map={"": 0},
        torch_dtype=compute_dtype,
        low_cpu_mem_usage=True,
    )
    model = PeftModel.from_pretrained(
        base_model,
        str(adapter_dir),
    )
    model.eval()

    dataset = load_dataset(
        "json",
        data_files={"validation": str(validation_path)},
    )["validation"]

    outputs: list[dict[str, Any]] = []

    for index, example in enumerate(dataset):
        if index >= arguments.limit:
            break

        messages = list(example["messages"])
        expected = messages[-1]["content"]
        prompt_messages = messages[:-1]

        inputs = tokenizer.apply_chat_template(
            prompt_messages,
            tokenize=True,
            add_generation_prompt=True,
            enable_thinking=False,
            return_tensors="pt",
        ).to(model.device)

        with torch.inference_mode():
            generated = model.generate(
                inputs,
                max_new_tokens=arguments.max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )

        new_tokens = generated[0, inputs.shape[-1]:]
        prediction = tokenizer.decode(
            new_tokens,
            skip_special_tokens=True,
        ).strip()

        try:
            json.loads(prediction)
            json_valid = True
        except json.JSONDecodeError:
            json_valid = False

        outputs.append(
            {
                "example_id": example["example_id"],
                "task": example["task"],
                "book_id": example["book_id"],
                "prediction": prediction,
                "expected": expected,
                "json_valid": json_valid,
            }
        )

        print()
        print(
            f"[{index + 1}/{min(arguments.limit, len(dataset))}] "
            f"{example['example_id']}"
        )
        print(f"JSON valid: {json_valid}")
        print("Prediction:")
        print(prediction)

    output_path = (
        root
        / "research"
        / "reports"
        / "qwen3_adapter_smoke_outputs_v1.json"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "model_id": arguments.model_id,
                "adapter_dir": str(adapter_dir),
                "records": outputs,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print("ADAPTER SMOKE INFERENCE COMPLETE")
    print("=" * 68)
    print(f"Outputs: {output_path}")


if __name__ == "__main__":
    main()
