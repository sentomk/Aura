# Aura — AI-Powered Stock Analysis

A-share market analysis desktop app built with Tauri v2 + FastAPI + Vue 3.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | Vue 3 + TypeScript + Vite |
| Backend | FastAPI (Python) + Uvicorn |
| Database | MongoDB 4.4 + Redis 7 |
| AI Models | DeepSeek / Qwen / OpenAI-compatible |
| Data Sources | AKShare / Tushare / BaoStock |
| Package Mgmt | uv (Python) + npm (Frontend) |

## Quick Start

### Prerequisites

- **Docker** — for MongoDB and Redis
- **uv** — Python package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Node.js 22+** — frontend toolchain (`brew install node` or https://nodejs.org)

### One-Command Setup

```bash
./setup.sh
```

This handles:
1. Prerequisite checks
2. Docker services (MongoDB + Redis)
3. `.env` config file
4. Python dependencies
5. Frontend dependencies
6. Default admin user

### Start Dev

```bash
cd frontend && npm run tauri dev
```

This launches both:
- Backend at http://localhost:8000
- Frontend at http://localhost:1420

### Login

Default credentials: **admin** / **admin123** (change after first login).

## Manual Setup

If you prefer not to use Tauri or the setup script:

```bash
# 1. Start Docker services
docker run -d --name aura-mongo -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=tradingagents123 \
  mongo:4.4

docker run -d --name aura-redis -p 6379:6379 \
  redis:7-alpine redis-server --requirepass tradingagents123

# 2. Install dependencies
uv sync
cd frontend && npm install && cd ..

# 3. Create admin user
uv run python -c "
import asyncio
from app.core.database import init_db, close_db
from app.services.user_service import user_service
async def main():
    await init_db()
    await user_service.create_admin_user()
    await close_db()
asyncio.run(main())
"

# 4. Start
uv run python -m app          # backend → :8000
cd frontend && npm run dev    # frontend → :1420
```

## API Keys

Edit `.env` and set at least one LLM API key:

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
```

Or configure via the web UI: **Settings → LLM Providers**.

## Docker Deploy (Backend Only)

For VPS deployment use the `deploy/backend` branch:

```bash
git clone -b deploy/backend https://github.com/<user>/Aura.git
cd Aura
docker compose up -d
```

## Frontend-Only Deploy

Use the `deploy/frontend` branch when the backend is already running on a VPS:

```bash
git clone -b deploy/frontend https://github.com/<user>/Aura.git
cd Aura/frontend
nvm use
npm install
npm run build
```

The built browser assets are in `frontend/dist`. The Tauri shell in this branch does not start a Python backend; it only reads the backend address configured by the user.

Backend URL resolution order:

1. User setting in `localStorage` (`aura_backend_url`)
2. Build-time default `VITE_AURA_BACKEND_URL`
3. Tauri runtime env `AURA_BACKEND_URL`
4. `http://localhost:8000`

To bake in a default remote backend for browser builds:

```bash
VITE_AURA_BACKEND_URL=https://api.example.com npm run build
```

Users can still change the backend address on the login page before signing in, or later from **Settings → Backend connection**. Changing the backend address clears the current login token and requires signing in again.

The remote backend must allow the frontend origin in CORS. For local/Tauri development, include:

```text
http://localhost:1420
tauri://localhost
http://tauri.localhost
https://tauri.localhost
```

## Project Structure

```
Aura/
├── app/                    # FastAPI backend
│   ├── api/                # API routes
│   ├── core/               # Database, config, middleware
│   ├── models/             # Pydantic models
│   └── services/           # Business logic
├── frontend/               # Vue 3 frontend
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── stores/         # Reactive state
│   │   ├── views/          # Page components
│   │   └── components/     # Reusable components
│   └── src-tauri/          # Tauri config
├── tradingagents/          # Analysis engine
│   ├── agents/             # AI analysts
│   ├── dataflows/          # Data fetching & caching
│   └── llm_adapters/       # LLM adapters
├── config/                 # Runtime config
├── scripts/                # Utility scripts
├── setup.sh                # One-command setup
├── .env.example            # Environment template
└── pyproject.toml
```

## Useful Commands

```bash
docker stop aura-mongo aura-redis   # Stop services
docker start aura-mongo aura-redis  # Start services
uv run python -m app                # Backend only
```
