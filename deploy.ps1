
# ============================================================
# SM PAYROLL SYSTEM - ONE-CLICK SAFE DEPLOY SCRIPT
# Pehle local build check karta hai — phir push karta hai
# Agar build fail ho toh ROKO — live me error nahi aayega
#
# Usage:          .\deploy.ps1
# Custom message: .\deploy.ps1 "feature: apna message"
# ============================================================

param(
    [string]$message = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SM PAYROLL SYSTEM - SAFE DEPLOY                        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# ── Auto-generate commit message if not provided ──────────────────────────────
if (-not $message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $message = "deploy: auto-update ($timestamp)"
}

# ── Step 1: Verify VITE_API_URL is NOT set locally (proxy handles dev) ────────
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow
$envFile = ".env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "VITE_API_URL") {
        Write-Host "  WARNING: VITE_API_URL found in .env" -ForegroundColor Red
        Write-Host "  This could cause /api/api/ double-prefix bug locally!" -ForegroundColor Red
        Write-Host "  Only set VITE_API_URL in Vercel Dashboard, not in .env" -ForegroundColor Red
    } else {
        Write-Host "  env OK - VITE_API_URL not in .env (correct)" -ForegroundColor Green
    }
} else {
    Write-Host "  No .env file found — OK for production" -ForegroundColor Green
}

# ── Step 2: Run TypeScript check ──────────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Running TypeScript check..." -ForegroundColor Yellow
try {
    $tscOutput = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  TypeScript errors found:" -ForegroundColor Red
        Write-Host $tscOutput -ForegroundColor Red
        Write-Host ""
        Write-Host "  Deploy BLOCKED — fix TypeScript errors first!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  TypeScript OK" -ForegroundColor Green
} catch {
    Write-Host "  TypeScript check skipped (tsc not available)" -ForegroundColor Yellow
}

# ── Step 3: Run Vite production build ─────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Building for production..." -ForegroundColor Yellow
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  BUILD FAILED:" -ForegroundColor Red
        Write-Host $buildOutput -ForegroundColor Red
        Write-Host ""
        Write-Host "  Deploy BLOCKED — fix build errors first!" -ForegroundColor Red
        Write-Host "  Run: npm run build" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  Build SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "  Build FAILED: $_" -ForegroundColor Red
    exit 1
}

# ── Step 4: Git add + commit ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Committing: $message" -ForegroundColor Yellow
git add .
$status = git status --porcelain
if (-not $status) {
    Write-Host "  Nothing to commit — already up to date" -ForegroundColor Green
} else {
    git commit -m $message
    Write-Host "  Committed OK" -ForegroundColor Green
}

# ── Step 5: Push to GitHub ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
Write-Host "  Pushed OK" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETE!                                         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend (Vercel)  -> https://sm-payroll-system.vercel.app" -ForegroundColor White
Write-Host "  Backend  (Render)  -> https://sm-payroll-system.onrender.com" -ForegroundColor White
Write-Host ""
Write-Host "  Vercel  live in ~1 min" -ForegroundColor Cyan
Write-Host "  Render  live in ~2-3 min" -ForegroundColor Cyan
Write-Host ""
Write-Host "  IMPORTANT: Vercel me VITE_API_URL must be set to:" -ForegroundColor Yellow
Write-Host "  https://sm-payroll-system.onrender.com" -ForegroundColor Yellow
Write-Host "  (Vercel Dashboard > Settings > Environment Variables)" -ForegroundColor Yellow
Write-Host ""
