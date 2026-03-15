# ============================================================
# SM PAYROLL SYSTEM - ONE-CLICK SAFE DEPLOY SCRIPT
# Usage:          .\deploy.ps1
# Custom message: .\deploy.ps1 "apna message"
# ============================================================

param(
    [string]$message = "production update"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SM PAYROLL - SAFE DEPLOY               " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Auto-generate commit message if not provided
if (-not $message) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm"
    $message = "deploy: auto-update ($ts)"
}

# ---- Step 1: Check .env for VITE_API_URL ----
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "VITE_API_URL") {
        Write-Host "  WARNING: VITE_API_URL found in .env file!" -ForegroundColor Red
        Write-Host "  Remove it from .env - only set it in Vercel Dashboard" -ForegroundColor Red
    } else {
        Write-Host "  env check OK" -ForegroundColor Green
    }
} else {
    Write-Host "  No .env file - OK" -ForegroundColor Green
}

# ---- Step 2: TypeScript check ----
Write-Host ""
Write-Host "[2/5] TypeScript check..." -ForegroundColor Yellow
& npx tsc --noEmit
if ($LASTEXITCODE -eq 0) {
    Write-Host "  TypeScript OK" -ForegroundColor Green
} else {
    Write-Host "  TypeScript errors found - fix them first!" -ForegroundColor Red
    Write-Host "  DEPLOY STOPPED." -ForegroundColor Red
    exit 1
}

# ---- Step 3: Production build ----
Write-Host ""
Write-Host "[3/5] Building for production..." -ForegroundColor Yellow
& npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Build SUCCESS" -ForegroundColor Green
} else {
    Write-Host "  BUILD FAILED - run 'npm run build' to see errors" -ForegroundColor Red
    Write-Host "  DEPLOY STOPPED." -ForegroundColor Red
    exit 1
}


# ---- Step 4: Sync to Android ----
Write-Host ""
Write-Host "[4/6] Syncing changes to Android App..." -ForegroundColor Yellow
if (Test-Path "android") {
    & npx cap sync android
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Android Sync SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "  Android Sync FAILED - warning only, continuing..." -ForegroundColor Red
    }
} else {
    Write-Host "  No Android folder found - skipping sync" -ForegroundColor Gray
}


# ---- Step 5: Git commit ----
Write-Host ""
Write-Host "[5/6] Committing: $message" -ForegroundColor Yellow
& git add .
$gitStatus = & git status --porcelain
if ($gitStatus) {
    & git commit -m $message
    Write-Host "  Committed OK" -ForegroundColor Green
} else {
    Write-Host "  Nothing new to commit" -ForegroundColor Green
}

# ---- Step 6: Push to GitHub ----
Write-Host ""
Write-Host "[6/6] Pushing to GitHub..." -ForegroundColor Yellow
& git push origin main
Write-Host "  Pushed OK" -ForegroundColor Green

# ---- Done ----
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETE!                        " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: https://sm-payroll-system.vercel.app" -ForegroundColor White
Write-Host "  Backend:  https://sm-payroll-system.onrender.com" -ForegroundColor White
Write-Host ""
Write-Host "  Vercel live in ~1 min" -ForegroundColor Cyan
Write-Host "  Render live in ~2-3 min" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NOTE: VITE_API_URL must be set in Vercel Dashboard:" -ForegroundColor Yellow
Write-Host "  https://sm-payroll-system.onrender.com" -ForegroundColor Yellow
Write-Host ""
