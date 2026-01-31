# MindGuard Deployment Guide 🚀

Complete instructions to deploy MindGuard on a new PC.

---

## Prerequisites

1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
2. **Git** - [Download here](https://git-scm.com/downloads)
3. **Python 3.11** (for running backend with hardware access)
4. **Node.js 20+** (optional, for local frontend dev)

---

## Quick Start (Docker Only)

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/mindguard.git
cd mindguard
```

### Step 2: Start All Services
```bash
docker-compose up -d --build
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5433

### Step 3: Initialize Database
```bash
# Run database migrations (first time only)
docker-compose exec frontend npx prisma db push
```

### Check Status
```bash
docker-compose ps
docker-compose logs -f
```

### Stop Services
```bash
docker-compose down
```

---

## Recommended Setup (Hardware Access)

> ⚠️ **Important**: For webcam, microphone, and serial sensor access, run the backend **outside Docker** on the host machine.

### Step 1: Start Database Only
```bash
docker-compose up -d postgres
```

### Step 2: Run Backend Locally (Python)
```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
python mindguard_server.py
```

### Step 3: Run Frontend
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Initialize database
npx prisma db push

# Seed demo data (optional)
node prisma/seed.js

# Start development server
npm run dev
```

**Access the app at**: http://localhost:3000

---

## Environment Configuration

### Frontend (.env)
```env
DATABASE_URL="file:./dev.db"
```

### For PostgreSQL (optional)
```env
DATABASE_URL="postgresql://user:password@localhost:5433/mindguard"
```

---

## Hardware Requirements

| Component | Purpose | Required? |
|-----------|---------|-----------|
| Webcam | Facial stress analysis | Yes |
| Microphone | Voice/audio dB analysis | Yes |
| Heart Rate Sensor | BPM/HRV monitoring | Optional |
| Serial Port (USB) | Arduino/ESP32 sensor | Optional |

---

## Troubleshooting

### Docker Build Fails
```bash
# Clean build (no cache)
docker-compose build --no-cache
```

### Port Already in Use
```bash
# Check what's using port 3000/5000
netstat -ano | findstr :3000
netstat -ano | findstr :5000
```

### Backend Model Not Loading
Ensure `model_artifacts/` contains:
- `*.h5` - TensorFlow model
- `*_scaler.pkl` - Feature scaler
- `*_metadata.json` - Column metadata

### Database Connection Issues
```bash
# Reset database
rm prisma/dev.db
npx prisma db push
```

---

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────────┐
│   Browser   │ ◀─────────────────▶│  Backend (Flask)    │
│  Next.js    │                    │  - DeepFace (CV)    │
│  :3000      │     HTTP/WS        │  - ML Model (TF)    │
└─────────────┘                    │  - Audio Analysis   │
       │                           │  :5000              │
       │                           └──────────┬──────────┘
       │                                      │
       ▼                                      ▼
┌─────────────┐                    ┌─────────────────────┐
│   SQLite    │                    │  Hardware Sensors   │
│   Prisma    │                    │  - Webcam           │
│             │                    │  - Microphone       │
└─────────────┘                    │  - Serial (BPM)     │
                                   └─────────────────────┘
```

---

## Production Deployment

For production, consider:
1. Use PostgreSQL instead of SQLite
2. Enable HTTPS with reverse proxy (nginx)
3. Set secure environment variables
4. Use Docker secrets for credentials

```bash
# Production build
docker-compose -f docker-compose.prod.yml up -d
```

---

**Happy Monitoring! 🧠💚**
