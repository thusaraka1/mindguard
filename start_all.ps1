# PowerShell script to start all MindGuard servers at once
# Run from: d:\nethmini

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host " MindGuard - Combined Startup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# ─── 1. Start MindGuard AI Backend (Flask + SocketIO) ───
Write-Host "`nStarting MindGuard AI Backend (Flask + SocketIO)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Green
Write-Host ' MINDGUARD BACKEND (Port 5005)' -ForegroundColor Green
Write-Host '================================' -ForegroundColor Green
Set-Location 'd:\nethmini\mindguard'
py -3.11 mindguard_server.py
"@

Write-Host "  MindGuard backend starting on http://localhost:5005" -ForegroundColor Green

# ─── 2. Start new-one- Flask Backend (AI Risk Assessment) ───
Write-Host "`nStarting AI Risk Assessment Backend (Flask)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Magenta
Write-Host ' FLASK BACKEND (Port 5004)' -ForegroundColor Magenta
Write-Host '================================' -ForegroundColor Magenta
Set-Location 'd:\nethmini\new-one-'
python backend/app.py
"@

Write-Host "  Flask backend starting on http://localhost:5004" -ForegroundColor Green

# ─── 3. Start Next.js Frontend (MindGuard) ───
Write-Host "`nStarting MindGuard Frontend (Next.js)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Blue
Write-Host ' NEXT.JS FRONTEND (Port 3000)' -ForegroundColor Blue
Write-Host '================================' -ForegroundColor Blue
Set-Location 'd:\nethmini\mindguard'
npm run dev
"@

Write-Host "  Next.js frontend starting on http://localhost:3000" -ForegroundColor Green

# ─── 4. Start Vite Frontend (AI Risk Assessment UI) ───
Write-Host "`nStarting AI Risk Assessment Frontend (Vite)..." -ForegroundColor Yellow

if (-not (Test-Path "d:\nethmini\new-one-\frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Set-Location 'd:\nethmini\new-one-\frontend'
npm install
npm run dev
"@ 
}
else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor DarkYellow
Write-Host ' VITE FRONTEND (Port 5173)' -ForegroundColor DarkYellow
Write-Host '================================' -ForegroundColor DarkYellow
Set-Location 'd:\nethmini\new-one-\frontend'
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
Write-Host "  AI Assessment UI:    http://localhost:5173" -ForegroundColor White
Write-Host "  MindGuard Backend:   http://localhost:5005 (IoT + AI)" -ForegroundColor White
Write-Host "  Risk Assessment API: http://localhost:5004 (new-one-)" -ForegroundColor White
Write-Host "`nPress Ctrl+C in each terminal window to stop servers.`n" -ForegroundColor Yellow

# Open browser
Start-Sleep -Seconds 5
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"
