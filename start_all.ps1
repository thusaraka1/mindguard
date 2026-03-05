# PowerShell script to start all MindGuard servers
# Works on any PC - auto-detects paths from script location
# Usage: Right-click > Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File start_all.ps1

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $ROOT) { $ROOT = (Get-Location).Path }

$MINDGUARD = Join-Path $ROOT "mindguard"
$NEWONE = Join-Path $ROOT "new-one-"
$NEWONE_FE = Join-Path $NEWONE "frontend"

# Use Python 3.11 for backends (TensorFlow requires Python <=3.12)
$PY311 = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
if (-not (Test-Path $PY311)) { $PY311 = (Get-Command python3.11 -ErrorAction SilentlyContinue).Source }
if (-not $PY311) { Write-Host "WARNING: Python 3.11 not found, falling back to default python" -ForegroundColor Red; $PY311 = "python" }

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host " MindGuard - Combined Startup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Root: $ROOT" -ForegroundColor DarkGray

# ─── 1. Start MindGuard Backend (Python Flask + SocketIO for IoT) ───
$serverPy = Join-Path $MINDGUARD "mindguard_server.py"
if (Test-Path $serverPy) {
    Write-Host "`nStarting MindGuard IoT Backend..." -ForegroundColor Yellow
    $cmd1 = "Write-Host '=== BACKEND (Port 5005) ===' -ForegroundColor Green; Set-Location '$MINDGUARD'; Write-Host 'Checking dependencies...'; & '$PY311' -m pip install -r requirements.txt; & '$PY311' mindguard_server.py"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd1
    Write-Host "  Backend starting on http://localhost:5005" -ForegroundColor Green
}
else {
    Write-Host "`n  [SKIP] mindguard_server.py not found" -ForegroundColor DarkGray
}

# ─── 2. Start Risk Assessment Flask Backend (new-one-) ───
$flaskApp = Join-Path $NEWONE "backend" | Join-Path -ChildPath "app.py"
if (Test-Path $flaskApp) {
    Write-Host "`nStarting Risk Assessment Backend (Flask)..." -ForegroundColor Yellow
    $cmd2 = "Write-Host '=== FLASK BACKEND (Port 5004) ===' -ForegroundColor Magenta; Set-Location '$NEWONE'; Write-Host 'Checking dependencies...'; & '$PY311' -m pip install -r requirements.txt; & '$PY311' -m pip install -r backend/requirements.txt; & '$PY311' backend/app.py"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd2
    Write-Host "  Flask backend starting on http://localhost:5004" -ForegroundColor Green
}
else {
    Write-Host "`n  [SKIP] new-one- backend not found" -ForegroundColor DarkGray
}

# ─── 3. Start Next.js Frontend (MindGuard) ───
$nextPkg = Join-Path $MINDGUARD "package.json"
if (Test-Path $nextPkg) {
    $nodeModules = Join-Path $MINDGUARD "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Host "`nInstalling Next.js dependencies first..." -ForegroundColor Yellow
        $cmd3 = "Write-Host '=== NEXT.JS FRONTEND (Port 3000) ===' -ForegroundColor Blue; Set-Location '$MINDGUARD'; npm install; npm run dev"
    }
    else {
        Write-Host "`nStarting MindGuard Frontend (Next.js)..." -ForegroundColor Yellow
        $cmd3 = "Write-Host '=== NEXT.JS FRONTEND (Port 3000) ===' -ForegroundColor Blue; Set-Location '$MINDGUARD'; npm run dev"
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd3
    Write-Host "  Next.js frontend starting on http://localhost:3000" -ForegroundColor Green
}
else {
    Write-Host "`n  [SKIP] mindguard/package.json not found" -ForegroundColor DarkGray
}

# ─── 4. Start Vite Frontend (new-one- assessment UI) ───
$vitePkg = Join-Path $NEWONE_FE "package.json"
if (Test-Path $vitePkg) {
    $viteModules = Join-Path $NEWONE_FE "node_modules"
    if (-not (Test-Path $viteModules)) {
        Write-Host "`nInstalling Vite frontend dependencies..." -ForegroundColor Yellow
        $cmd4 = "Write-Host '=== VITE FRONTEND (Port 5173) ===' -ForegroundColor DarkYellow; Set-Location '$NEWONE_FE'; npm install; npm run dev"
    }
    else {
        Write-Host "`nStarting Assessment Frontend (Vite)..." -ForegroundColor Yellow
        $cmd4 = "Write-Host '=== VITE FRONTEND (Port 5173) ===' -ForegroundColor DarkYellow; Set-Location '$NEWONE_FE'; npm run dev"
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd4
    Write-Host "  Vite frontend starting on http://localhost:5173" -ForegroundColor Green
}
else {
    Write-Host "`n  [SKIP] new-one-/frontend not found" -ForegroundColor DarkGray
}

# ─── Summary ───
Write-Host "`n=====================================" -ForegroundColor Green
Write-Host " All servers are starting!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`n  Landing Page:        http://localhost:3000" -ForegroundColor White
Write-Host "  Login Page:          http://localhost:3000/login" -ForegroundColor White
Write-Host "  Admin Panel:         http://localhost:3000/admin" -ForegroundColor White
Write-Host "  Assessment UI:       http://localhost:5173" -ForegroundColor White
Write-Host "  IoT Backend:         http://localhost:5005" -ForegroundColor White
Write-Host "  Risk Assessment API: http://localhost:5004" -ForegroundColor White
Write-Host "`nPress Ctrl+C in each terminal window to stop servers.`n" -ForegroundColor Yellow

Start-Sleep -Seconds 5
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"
