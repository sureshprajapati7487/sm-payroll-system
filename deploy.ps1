
# ============================================================
# SM PAYROLL SYSTEM - ONE-CLICK DEPLOY SCRIPT
# Isko run karo aur sab kuch live ho jayega!
# Usage: .\deploy.ps1
# Usage with message: .\deploy.ps1 "Punch In ko ek hi kiya or Full Update kiya"
# ============================================================

param(
    [string]$message = "update: latest changes"
)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SM PAYROLL SYSTEM - DEPLOYING TO LIVE  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stage all changes
Write-Host "[1/3] Staging all changes..." -ForegroundColor Yellow
git add .

# Step 2: Commit with message
Write-Host "[2/3] Committing: $message" -ForegroundColor Yellow
git commit -m $message

# Step 3: Push to GitHub (this triggers Vercel + Render auto-deploy)
Write-Host "[3/3] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETE!                        " -ForegroundColor Green
Write-Host "  - Vercel (Frontend) ~1 min me live      " -ForegroundColor Green
Write-Host "  - Render (Backend)  ~2-3 min me live    " -ForegroundColor Green
Write-Host "  Site: https://sm-payroll-system.vercel.app" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
