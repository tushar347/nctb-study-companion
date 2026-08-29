Set-Location "D:\nctb-study-companion-starter"

$ErrorActionPreference = "Stop"

$requiredFiles = @(
    ".\research\data\training\qwen3_sft_train_v1.jsonl",
    ".\research\data\training\qwen3_sft_validation_v1.jsonl",
    ".\research\reports\qwen3_sft_split_summary_v1.json",
    ".\research\scripts\train_qwen3_qlora_v1.py",
    ".\research\scripts\evaluate_qwen3_adapter_smoke_v1.py",
    ".\research\training\requirements-qwen3-qlora.txt"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Missing required file: $file"
    }
}

$bundleRoot = ".\research\training\cloud_bundle_v1"
$zipPath = ".\research\training\nctb_qwen3_qlora_cloud_bundle_v1.zip"

if (Test-Path -LiteralPath $bundleRoot) {
    Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}

New-Item -ItemType Directory -Path `
    "$bundleRoot\research\data\training", `
    "$bundleRoot\research\reports", `
    "$bundleRoot\research\scripts", `
    "$bundleRoot\research\training" `
    -Force | Out-Null

Copy-Item ".\research\data\training\qwen3_sft_train_v1.jsonl" `
    "$bundleRoot\research\data\training\qwen3_sft_train_v1.jsonl"
Copy-Item ".\research\data\training\qwen3_sft_validation_v1.jsonl" `
    "$bundleRoot\research\data\training\qwen3_sft_validation_v1.jsonl"
Copy-Item ".\research\reports\qwen3_sft_split_summary_v1.json" `
    "$bundleRoot\research\reports\qwen3_sft_split_summary_v1.json"
Copy-Item ".\research\scripts\train_qwen3_qlora_v1.py" `
    "$bundleRoot\research\scripts\train_qwen3_qlora_v1.py"
Copy-Item ".\research\scripts\evaluate_qwen3_adapter_smoke_v1.py" `
    "$bundleRoot\research\scripts\evaluate_qwen3_adapter_smoke_v1.py"
Copy-Item ".\research\training\requirements-qwen3-qlora.txt" `
    "$bundleRoot\research\training\requirements-qwen3-qlora.txt"

@'
1. Extract this ZIP on a Linux CUDA machine.
2. Open a terminal in the extracted folder.
3. Install a CUDA-compatible PyTorch build for that machine.
4. Run:
   pip install -r research/training/requirements-qwen3-qlora.txt
5. Start smoke training:
   python research/scripts/train_qwen3_qlora_v1.py --root . --max-steps 30
6. Test the adapter:
   python research/scripts/evaluate_qwen3_adapter_smoke_v1.py --root . --limit 5
7. Download the complete research/models/nctb-qwen3-1.7b-qlora-v1 folder.
'@ | Set-Content `
    -LiteralPath "$bundleRoot\CLOUD_TRAINING_STEPS.txt" `
    -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive `
    -Path "$bundleRoot\*" `
    -DestinationPath $zipPath `
    -CompressionLevel Optimal

Write-Host "`nCloud training bundle created:" -ForegroundColor Green
Write-Host (Resolve-Path -LiteralPath $zipPath)
