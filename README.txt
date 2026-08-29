NCTB Locked Evaluation Tools v1

Extract this ZIP into:
D:\nctb-study-companion-starter

Then run:
research\training\make_kaggle_locked_eval_bundle_v1.ps1

The helper creates:
research\training\nctb_locked_eval_kaggle_bundle_v1.zip

That Kaggle bundle contains:
- the locked test file
- its SHA256 lock
- the original locked evaluation manifest + lock when available
- the new base-vs-fine-tuned evaluation script

The evaluation compares:
Qwen/Qwen3-1.7B base
vs
Qwen/Qwen3-1.7B + the NCTB QLoRA adapter

Both use the same Transformers backend, prompts, locked pages, validator,
4-bit quantization and deterministic greedy generation.
