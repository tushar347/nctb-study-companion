from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import datasets
import peft
import torch
import transformers
import trl
from datasets import load_dataset
from peft import LoraConfig, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    set_seed,
)
from trl import SFTConfig, SFTTrainer


def count_jsonl(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig") as handle:
        return sum(1 for line in handle if line.strip())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--model-id", default="Qwen/Qwen3-1.7B")
    parser.add_argument(
        "--output-dir",
        default="research/models/nctb-qwen3-1.7b-qlora-v1",
    )
    parser.add_argument("--max-steps", type=int, default=30)
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--learning-rate", type=float, default=1.0e-4)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    arguments = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU not detected. Run this training script on a Linux CUDA "
            "machine. Dataset preparation can still be done locally."
        )

    root = Path(arguments.root).resolve()
    train_path = (
        root / "research" / "data" / "training" / "qwen3_sft_train_v1.jsonl"
    )
    validation_path = (
        root
        / "research"
        / "data"
        / "training"
        / "qwen3_sft_validation_v1.jsonl"
    )
    output_dir = (root / arguments.output_dir).resolve()
    final_adapter_dir = output_dir / "final_adapter"

    for required in (train_path, validation_path):
        if not required.exists():
            raise FileNotFoundError(f"Required training split not found: {required}")

    set_seed(arguments.seed)

    gpu_name = torch.cuda.get_device_name(0)
    capability = torch.cuda.get_device_capability(0)
    supports_bf16 = torch.cuda.is_bf16_supported()
    compute_dtype = torch.bfloat16 if supports_bf16 else torch.float16

    print("NCTB QWEN3 QLORA SMOKE TRAINING")
    print("=" * 68)
    print(f"Model: {arguments.model_id}")
    print(f"GPU: {gpu_name}")
    print(f"CUDA capability: {capability}")
    print(f"Compute dtype: {compute_dtype}")
    print(f"Train examples: {count_jsonl(train_path)}")
    print(f"Validation examples: {count_jsonl(validation_path)}")
    print(f"Output: {output_dir}")

    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    tokenizer = AutoTokenizer.from_pretrained(
        arguments.model_id,
        use_fast=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        arguments.model_id,
        quantization_config=quantization_config,
        device_map={"": 0},
        torch_dtype=compute_dtype,
        low_cpu_mem_usage=True,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(
        model,
        use_gradient_checkpointing=True,
    )

    lora_config = LoraConfig(
        r=arguments.lora_r,
        lora_alpha=arguments.lora_alpha,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules="all-linear",
    )

    dataset = load_dataset(
        "json",
        data_files={
            "train": str(train_path),
            "validation": str(validation_path),
        },
    )

    use_max_steps = arguments.max_steps > 0

    training_args = SFTConfig(
        output_dir=str(output_dir),
        run_name="nctb-qwen3-1.7b-qlora-v1",
        max_steps=arguments.max_steps if use_max_steps else -1,
        num_train_epochs=arguments.epochs,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=arguments.gradient_accumulation_steps,
        learning_rate=arguments.learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.10,
        weight_decay=0.0,
        max_grad_norm=1.0,
        optim="paged_adamw_8bit",
        logging_strategy="steps",
        logging_steps=1,
        logging_first_step=True,
        eval_strategy="steps" if use_max_steps else "epoch",
        eval_steps=5 if use_max_steps else None,
        save_strategy="steps" if use_max_steps else "epoch",
        save_steps=5 if use_max_steps else None,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",
        seed=arguments.seed,
        data_seed=arguments.seed,
        fp16=not supports_bf16,
        bf16=supports_bf16,
        tf32=capability[0] >= 8,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        use_cache=False,
        max_length=arguments.max_length,
        packing=False,
        assistant_only_loss=True,
        dataset_num_proc=1,
        remove_unused_columns=True,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        processing_class=tokenizer,
        peft_config=lora_config,
    )

    trainer.model.print_trainable_parameters()

    train_result = trainer.train()
    evaluation_metrics = trainer.evaluate()

    final_adapter_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(final_adapter_dir))
    tokenizer.save_pretrained(str(final_adapter_dir))

    summary: dict[str, Any] = {
        "training_version": "nctb-qwen3-1.7b-qlora-v1",
        "model_id": arguments.model_id,
        "output_dir": str(output_dir),
        "final_adapter_dir": str(final_adapter_dir),
        "max_steps": arguments.max_steps,
        "epochs": arguments.epochs,
        "max_length": arguments.max_length,
        "learning_rate": arguments.learning_rate,
        "gradient_accumulation_steps": arguments.gradient_accumulation_steps,
        "lora_r": arguments.lora_r,
        "lora_alpha": arguments.lora_alpha,
        "seed": arguments.seed,
        "gpu": gpu_name,
        "cuda_capability": capability,
        "compute_dtype": str(compute_dtype),
        "train_metrics": train_result.metrics,
        "evaluation_metrics": evaluation_metrics,
        "versions": {
            "python": sys.version,
            "platform": platform.platform(),
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "datasets": datasets.__version__,
            "peft": peft.__version__,
            "trl": trl.__version__,
        },
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "warning": (
            "Pilot adapter trained on 75 approved examples. It must be compared "
            "against the locked baseline before any improvement claim."
        ),
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "training_summary.json"
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str) + "\n",
        encoding="utf-8",
    )

    print()
    print("TRAINING COMPLETE")
    print("=" * 68)
    print(f"Final adapter: {final_adapter_dir}")
    print(f"Training summary: {summary_path}")
    print(f"Final validation loss: {evaluation_metrics.get('eval_loss')}")


if __name__ == "__main__":
    main()
