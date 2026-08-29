# NCTB Qwen3 QLoRA Pilot Package

This package prepares and smoke-trains the first real NCTB adapter.

## Model selected

`Qwen/Qwen3-1.7B`

This is deliberately smaller than the current 8B Ollama baseline. It is a practical first supervised fine-tuning target for the 75-example pilot dataset. The result is a research smoke model, not the final publication model.

## Files

- `research/scripts/prepare_qwen3_sft_v1.py`
- `research/scripts/train_qwen3_qlora_v1.py`
- `research/scripts/evaluate_qwen3_adapter_smoke_v1.py`
- `research/training/requirements-qwen3-qlora.txt`
- `research/training/make_cloud_training_bundle_v1.ps1`

## Step 1: Extract into the project

Extract this ZIP into:

`D:\nctb-study-companion-starter`

It should add files under `research/scripts` and `research/training`.

## Step 2: Prepare the split locally

Run from the project root:

```powershell
python `
  ".\research\scripts\prepare_qwen3_sft_v1.py" `
  --root "." `
  --validation-fraction 0.20 `
  --seed 42
```

The script:

- verifies the approved dataset SHA-256;
- rejects any locked-test overlap;
- keeps examples from the same textbook page in only one split;
- writes deterministic train and validation JSONL files.

## Step 3: Make the cloud bundle

```powershell
powershell `
  -ExecutionPolicy Bypass `
  -File ".\research\training\make_cloud_training_bundle_v1.ps1"
```

Upload the resulting ZIP to a Linux CUDA machine.

## Step 4: Run the smoke training

Install a CUDA-compatible PyTorch build appropriate for the GPU, then:

```bash
pip install -r research/training/requirements-qwen3-qlora.txt

python research/scripts/train_qwen3_qlora_v1.py \
  --root . \
  --model-id Qwen/Qwen3-1.7B \
  --max-steps 30 \
  --max-length 1024
```

The training script uses:

- 4-bit NF4 quantization;
- nested/double quantization;
- LoRA on all linear layers;
- assistant-only loss;
- gradient checkpointing;
- deterministic seeds;
- validation loss and checkpoint saving.

## Step 5: Test the trained adapter

```bash
python research/scripts/evaluate_qwen3_adapter_smoke_v1.py \
  --root . \
  --limit 5
```

## Expected output

`research/models/nctb-qwen3-1.7b-qlora-v1/final_adapter`

## Research warning

Do not claim improvement from training loss alone. The adapter must later be evaluated on the existing locked benchmark and compared against the recorded base-model results.
