# PowerShell script to start all Safe Kit Scan servers at once
# Works on any PC - auto-detects paths from script location

$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = (Get-Location).Path }

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host " Safe Kit Scan - Combined Startup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Root: $ROOT" -ForegroundColor DarkGray

# ─── 1. Start Backend (Flask + SocketIO) ───
Write-Host "`nStarting Safe Kit Scan Backend (Flask + SocketIO)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Green
Write-Host ' BACKEND (Port 5005)' -ForegroundColor Green
Write-Host '================================' -ForegroundColor Green
Set-Location '$ROOT'
py -3.11 mindguard_server.py
"@

Write-Host "  Backend starting on http://localhost:5005" -ForegroundColor Green

# ─── 2. Start new-one- Flask Backend ───
Write-Host "`nStarting Safe Kit Scan Risk Assessment Backend (Flask)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Magenta
Write-Host ' FLASK BACKEND (Port 5004)' -ForegroundColor Magenta
Write-Host '================================' -ForegroundColor Magenta
Set-Location '$ROOT\new-one-'
python backend/app.py
"@

Write-Host "  Flask backend starting on http://localhost:5004" -ForegroundColor Green

# ─── 3. Start Next.js Frontend ───
Write-Host "`nStarting Safe Kit Scan Frontend (Next.js)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Blue
Write-Host ' NEXT.JS FRONTEND (Port 3000)' -ForegroundColor Blue
Write-Host '================================' -ForegroundColor Blue
Set-Location '$ROOT'
npm run dev
"@

Write-Host "  Next.js frontend starting on http://localhost:3000" -ForegroundColor Green

# ─── 4. Start Vite Frontend ───
Write-Host "`nStarting Safe Kit Scan Assessment Frontend (Vite)..." -ForegroundColor Yellow

if (-not (Test-Path "$ROOT\new-one-\frontend\node_modules")) {
    Write-Host "  Installing frontend dependencies..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Set-Location '$ROOT\new-one-\frontend'
npm install
npm run dev
"@
}
else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor DarkYellow
Write-Host ' VITE FRONTEND (Port 5173)' -ForegroundColor DarkYellow
Write-Host '================================' -ForegroundColor DarkYellow
Set-Location '$ROOT\new-one-\frontend'
npm run dev
"@
}

Write-Host "  Vite frontend starting on http://localhost:5173" -ForegroundColor Green

# ─── Summary ───
Write-Host "`n=====================================" -ForegroundColor Green
Write-Host " All 4 servers are starting!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`n  Landing Page:        http://localhost:3000" -ForegroundColor White
Write-Host "  Login Page:          http://localhost:3000/login" -ForegroundColor White
Write-Host "  Admin Panel:         http://localhost:3000/admin" -ForegroundColor White
Write-Host "  Assessment UI:       http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:             http://localhost:5005 (IoT + AI)" -ForegroundColor White
Write-Host "  Risk Assessment API: http://localhost:5004" -ForegroundColor White
Write-Host "`nPress Ctrl+C in each terminal window to stop servers.`n" -ForegroundColor Yellow

Start-Sleep -Seconds 5
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"
