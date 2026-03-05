---
description: Start all MindGuard servers (Next.js + MindGuard Backend + Flask + Vite)
---

# Start All Servers

Run the combined startup script to launch all 4 servers at once:

// turbo
1. Run the startup script:
```powershell
powershell -ExecutionPolicy Bypass -File "d:\nethmini\start_all.ps1"
```

This will open 4 terminal windows:
- **Next.js** (MindGuard Frontend) → http://localhost:3000 (Landing Page)
- **MindGuard Backend** (Flask + SocketIO) → http://localhost:5005
- **new-one- Flask** (AI Risk Assessment API) → http://localhost:5004
- **Vite** (AI Risk Assessment UI) → http://localhost:5173

The browser will auto-open to http://localhost:3000 after 5 seconds.
