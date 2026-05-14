# Aura — AI-Powered Financial Analysis

Multi-market stock analysis desktop app built with Tauri v2 + FastAPI + Vue 3.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | Vue 3 + TypeScript + Vite |
| Backend | FastAPI (Python) + Uvicorn |
| Database | MongoDB + Redis |
| AI Models | DeepSeek (primary) + multi-provider adapter layer |
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
```

Or configure via the web UI: **Settings → LLM Providers**.

## Project Structure

```
Aura/
├── app/                    # FastAPI backend
│   ├── routers/            # API routes (~39 modules)
│   ├── core/               # Database, config, middleware
│   ├── models/             # Pydantic models
│   ├── services/           # Business logic (~48 modules)
│   ├── worker/             # Background sync workers
│   └── middleware/         # Request/response middleware
├── frontend/               # Vue 3 frontend
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── stores/         # Reactive state
│   │   ├── views/          # Pages & shell
│   │   └── components/     # Reusable components
│   └── src-tauri/          # Tauri config & Rust sidecar
├── tradingagents/          # Analysis engine
│   ├── agents/             # AI analysts
│   ├── dataflows/          # Data fetching & caching
│   └── llm_adapters/       # LLM provider adapters
├── cli/                    # CLI tools
├── web/                    # Streamlit web UI (legacy)
├── config/                 # Runtime config
├── scripts/                # Utility scripts
├── setup.sh                # One-command setup
├── .env.example            # Environment template
└── pyproject.toml
```

## Docker Deploy

```bash
docker compose up -d
```

## Useful Commands

```bash
docker stop aura-mongo aura-redis   # Stop services
docker start aura-mongo aura-redis  # Start services
uv run python -m app                # Backend only
```
