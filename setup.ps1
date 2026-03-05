# ============================================
# MindGuard - Full Setup Script
# Run this on a new PC after git pull
# ============================================

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host " MindGuard - Full Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# ─── 1. MindGuard (Next.js) ───
Write-Host "`n[1/3] Installing MindGuard frontend dependencies..." -ForegroundColor Yellow
Set-Location "d:\nethmini\mindguard"

# Remove old node_modules and lock file to avoid version conflicts
if (Test-Path "node_modules") {
    Write-Host "  Removing old node_modules..." -ForegroundColor DarkYellow
    Remove-Item -Recurse -Force "node_modules"
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
}

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: npm install failed for mindguard!" -ForegroundColor Red
}
else {
    Write-Host "  MindGuard dependencies installed" -ForegroundColor Green
}

# Generate Prisma client
Write-Host "  Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "  Prisma client ready" -ForegroundColor Green

# ─── 2. new-one- Frontend (Vite + React) ───
Write-Host "`n[2/3] Installing AI Risk Assessment frontend dependencies..." -ForegroundColor Yellow
Set-Location "d:\nethmini\new-one-\frontend"

if (Test-Path "node_modules") {
    Write-Host "  Removing old node_modules..." -ForegroundColor DarkYellow
    Remove-Item -Recurse -Force "node_modules"
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
}

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: npm install failed for new-one- frontend!" -ForegroundColor Red
}
else {
    Write-Host "  AI Risk Assessment frontend dependencies installed" -ForegroundColor Green
}

# ─── 3. new-one- Backend (Python + Flask) ───
Write-Host "`n[3/3] Installing AI Risk Assessment backend dependencies..." -ForegroundColor Yellow
Set-Location "d:\nethmini\new-one-"

if (Test-Path "requirements.txt") {
    pip install -r requirements.txt
} 
if (Test-Path "backend\requirements.txt") {
    pip install -r backend\requirements.txt
}
Write-Host "  Python dependencies installed" -ForegroundColor Green

# ─── Done ───
Write-Host "`n=====================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`nRun start_all.ps1 to launch all servers:" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy Bypass -File `"d:\nethmini\start_all.ps1`"" -ForegroundColor Cyan
Write-Host ""
