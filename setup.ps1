# ==========================================
# NCTB Study Companion Setup Script
# ==========================================

Write-Host ""
Write-Host "================================="
Write-Host " NCTB Study Companion Setup"
Write-Host "================================="
Write-Host ""

# Move to project folder
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath


# Check Node.js
Write-Host "Checking Node.js..."

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install Node.js first."
    exit
}

node -v


# Check npm
Write-Host ""
Write-Host "Checking npm..."

npm -v


# Install dependencies
Write-Host ""
Write-Host "Installing packages..."

npm install


# Generate Prisma client
Write-Host ""
Write-Host "Generating Prisma client..."

npx prisma generate


# Database migration
Write-Host ""
Write-Host "Updating database..."

npx prisma db push


# Build check
Write-Host ""
Write-Host "Testing production build..."

npm run build


Write-Host ""
Write-Host "================================="
Write-Host " Setup Completed Successfully "
Write-Host "================================="

Write-Host ""
Write-Host "Run:"
Write-Host ".\start.ps1"

pause