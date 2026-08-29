Set-Location "D:\nctb-study-companion-starter"

$ErrorActionPreference = "Stop"

$requiredFiles = @(
    ".\research\data\splits\test_pages_v1_locked.jsonl",
    ".\research\reports\test_split_v1_lock.txt",
    ".\research\scripts\run_qwen3_1p7b_finetune_comparison_v1.py"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Missing required locked-evaluation file: $file"
    }
}

$stage = ".\research\training\kaggle_locked_eval_bundle_v1"
$zipPath = ".\research\training\nctb_locked_eval_kaggle_bundle_v1.zip"

if (Test-Path $stage) {
    Remove-Item $stage -Recurse -Force
}
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

New-Item -ItemType Directory -Force -Path `
    "$stage\research\data\splits", `
    "$stage\research\data\evaluation", `
    "$stage\research\reports", `
    "$stage\research\scripts" | Out-Null

Copy-Item ".\research\data\splits\test_pages_v1_locked.jsonl" `
    "$stage\research\data\splits\test_pages_v1_locked.jsonl"

Copy-Item ".\research\reports\test_split_v1_lock.txt" `
    "$stage\research\reports\test_split_v1_lock.txt"

Copy-Item ".\research\scripts\run_qwen3_1p7b_finetune_comparison_v1.py" `
    "$stage\research\scripts\run_qwen3_1p7b_finetune_comparison_v1.py"

if (Test-Path ".\research\data\evaluation\eval_manifest_v1.jsonl") {
    Copy-Item ".\research\data\evaluation\eval_manifest_v1.jsonl" `
        "$stage\research\data\evaluation\eval_manifest_v1.jsonl"
}

if (Test-Path ".\research\reports\eval_manifest_v1_lock.txt") {
    Copy-Item ".\research\reports\eval_manifest_v1_lock.txt" `
        "$stage\research\reports\eval_manifest_v1_lock.txt"
}

@'
from pathlib import Path
import zipfile

stage = Path(r"research/training/kaggle_locked_eval_bundle_v1")
zip_path = Path(r"research/training/nctb_locked_eval_kaggle_bundle_v1.zip")

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(stage.rglob("*")):
        if file.is_file():
            archive.write(file, arcname=file.relative_to(stage).as_posix())

with zipfile.ZipFile(zip_path, "r") as archive:
    names = archive.namelist()
    for name in names:
        if "\\" in name:
            raise RuntimeError(f"Invalid Windows path inside ZIP: {name}")

print("LOCKED EVALUATION KAGGLE ZIP CREATED")
print(zip_path.resolve())
print()
for name in names:
    print(name)
print()
print("PASS: Kaggle-compatible paths verified.")
'@ | python

if ($LASTEXITCODE -ne 0) {
    throw "Locked evaluation bundle creation failed."
}

Write-Host "`nLOCKED EVALUATION BUNDLE READY" -ForegroundColor Green
Write-Host (Resolve-Path $zipPath)
