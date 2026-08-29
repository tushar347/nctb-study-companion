# ==========================================
# NCTB Study Companion Launcher
# ==========================================

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $projectPath


Write-Host "Starting NCTB Study Companion..."


Start-Process "http://localhost:3000"


npm run dev