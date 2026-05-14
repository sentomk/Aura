# AGENTS.md — Aura

AI-powered multi-market stock analysis desktop app. Tauri v2 shell wrapping a Vue 3 frontend and a FastAPI Python backend.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | Vue 3.5 + TypeScript 5.6 + Vite 6 |
| Routing | Vue Router 4 (hash mode) |
| Backend | FastAPI (Python 3.10, `uv` for env + deps) |
| Database | MongoDB (motor async driver) |
| Cache | Redis |
| Auth | JWT (PyJWT) + bcrypt |
| LLM | langchain + multi-provider adapter layer (DeepSeek primary) |
| Data | akshare, baostock, tushare, yfinance |

## Project Layout

```
Aura/
├── app/                    # FastAPI backend
│   ├── main.py             # App factory, lifespan, CORS, scheduler
│   ├── core/               # config (pydantic-settings), database, logging
│   │   └── config_bridge.py    # Bridges app settings into tradingagents env config
│   ├── routers/            # HTTP route handlers (~40 modules)
│   ├── services/           # Business logic (~45 modules)
│   ├── models/             # Pydantic & DB models
│   ├── middleware/         # Request ID, operation logging
│   ├── worker/             # Background sync workers (tushare, akshare, baostock)
│   └── utils/              # api_key_utils, timezone, etc.
├── tradingagents/          # Analysis/dataflow engine, cache adapters, validators
├── frontend/
│   ├── src/
│   │   ├── api/index.ts    # HTTP client + all API method modules
│   │   ├── router/         # Hash router, auth guard
│   │   ├── stores/
│   │   │   ├── auth.ts       # JWT + localStorage auth state
│   │   │   └── analysis.ts   # Multi-task analysis state, polling, reportNav
│   │   └── views/
│   │       ├── Dashboard.vue   # Shell: sidebar nav + <KeepAlive> content area
│   │       ├── Login.vue
│   │       └── pages/          # Feature pages
│   │           ├── Overview.vue
│   │           ├── Analysis.vue         # Form + task tabs (submit, poll, track progress)
│   │           ├── Reports.vue          # Completed reports list + full detail view
│   │           ├── Stocks.vue           # Stock screening strategies
│   │           ├── DataManagement.vue   # Data source sync & history
│   │           └── Settings.vue         # Backend URL, LLM API keys, about
│   ├── components/
│   │   └── MarkdownRenderer.vue    # marked-based markdown → HTML rendering
│   └── src-tauri/
│       └── src/lib.rs       # Sidecar: spawns Python backend, kills on exit
├── scripts/
│   ├── bootstrap.sh / .ps1   # Python + uv environment sync
│   ├── create_admin.py       # Default admin user (admin/admin123)
│   └── mongo-init.js         # MongoDB collection/index init
├── .env.example             # Environment template (committed)
├── .env                     # Local config (gitignored, copy from .env.example)
├── setup.sh / setup.ps1     # One-command dev setup (cross-platform)
├── docker-compose.yml       # Full-stack Docker deployment
└── pyproject.toml           # Python dependencies (setuptools)
```

## Running the Project

### Prerequisites
- **uv** (Python package manager). Install: `curl -LsSf https://astral.sh/uv/install.sh | sh` (Unix) or `irm https://astral.sh/uv/install.ps1 | iex` (Windows).
- Python 3.10+ (uv will fetch the right version automatically)
- Node >= 22 (`.nvmrc` at `frontend/` root, run `nvm use` before `npm install`)
- MongoDB + Redis (Docker: `docker compose up -d mongodb redis`)
- Rust toolchain (for Tauri)

### Dev Commands

```bash
# One-command setup (Python + Node + Docker + .env + admin user)
./setup.sh                         # Unix / macOS
# .\setup.ps1                       # Windows

# Or step-by-step:
./scripts/bootstrap.sh             # Python + uv sync only
docker compose up -d mongodb redis  # Start databases
cd frontend && npm install          # Frontend dependencies
uv run python scripts/create_admin.py  # Default admin: admin / admin123

# Backend (separate terminal, or let Tauri spawn it)
uv run python -m app               # ← cross-platform, uv auto-finds Python

# Full Tauri app (frontend + spawns backend sidecar)
cd frontend && npx tauri dev

# Frontend only (browser dev, needs backend running separately)
cd frontend && npm run dev          # → http://localhost:1420
```

The Rust sidecar (`lib.rs`) auto-spawns the backend when the Tauri app starts. It tries `uv run` first (cross-platform), then direct `.venv` Python, then system Python. It checks `127.0.0.1:8000` first — if a backend is already running, it reuses it.

> **Windows note**: Avoid msys2/Git Bash Python on PATH — it may lack the required packages. Use `uv` (which manages its own Python) or install Python from python.org. The sidecar prefers `uv run` exactly to sidestep this problem.

### Default Login
- Username: `admin`
- Password: `admin123`

## Key Conventions

### Frontend

- **API client** (`src/api/index.ts`): All backend calls go through the `request()` helper which resolves `baseUrl` via localStorage → Tauri invoke → default `http://localhost:8000`. Each API domain is a named export (`api`, `auth`, `analysis`, `reports`, `config`, `health`).
- **Auth**: Access token is stored in `localStorage` under `token`; refresh token is stored under `refresh_token`; user JSON is stored under `user`. The `request()` helper attaches `Authorization: Bearer` automatically unless `skipAuth` is set. On 401 it attempts `/api/auth/refresh` once unless `skipRefresh` is set, then clears auth and redirects to `/#/login` if refresh fails.
- **Anonymous requests**: Use `skipAuth: true` and `skipRefresh: true` for endpoints that must work without login. `health.check()` is the canonical health probe and calls `/api/health` anonymously.
- **State management**: Module-level `reactive()` singletons (no Pinia). `stores/auth.ts` handles login state and refresh token persistence. `stores/analysis.ts` manages multi-task analysis with per-task polling, progress tracking, task hydration, and a `reportNav` relay to switch from Analysis → Reports view.
- **Analysis task hydration**: `Analysis.vue` calls `store.loadTasks()` on mount to load recent backend tasks (`limit: 50`). Existing tasks are merged by `task_id`; `pending`, `processing`, and `running` tasks resume polling. Polling runs immediately once before the 2s interval starts. Terminal tasks record `endedAt` so elapsed time stops moving after completion/failure/cancellation.
- **Analysis → Reports flow**: Analysis.vue is form + task cards only (no inline results). Completed tasks navigate to Reports.vue via `reportNav.taskId` — Dashboard watches this and switches to the Reports tab automatically.
- **Reports merge flow**: Reports.vue merges fetched report records with completed in-memory analysis tasks, sorts using normalized timestamps, and watches `reportNav.taskId` with `immediate: true` so navigation works even if the Reports view is mounted after the relay is set.
- **Routing**: Hash-mode (`createWebHashHistory`). Two routes: `/login` and `/` (Dashboard). Dashboard uses `<KeepAlive>` to preserve component state across tab switches.
- **Styling**: Scoped CSS in each `.vue` SFC, no UI framework. Warm paper-like palette: `#fdfcf9` bg, `#2c2a29` text, `#d5d0c5` borders.
- **Package manager**: npm (lock file is `package-lock.json`).

### Backend

- **Config**: `pydantic-settings` reads from `.env`. The `Settings` class is in `app/core/config.py`.
- **Config bridge**: `app/core/config_bridge.py` mirrors app settings into environment variables expected by `tradingagents`. It sets `MONGODB_ENABLED`/`REDIS_ENABLED` defaults, derives `MONGODB_CONNECTION_STRING` from `settings.MONGO_URI` when absent, and keeps both `MONGODB_DATABASE_NAME` and `MONGODB_DATABASE` aligned with `settings.MONGO_DB`. If bridge values change after `tradingagents` has initialized, reset the `tradingagents.config.database_manager` singleton before rebuilding clients.
- **Response format**: All routes return `ok(data=..., message=...)` from `app/core/response.py`. The standard envelope is `{ success: bool, data: T, message: string }`.
- **Auth**: `get_current_user` dependency in `app/routers/auth_db.py`. Most routes require it.
- **LLM providers**: Stored in MongoDB `llm_providers` collection. Fallback to `.env` variables if DB key is absent/invalid. API key handling in `app/utils/api_key_utils.py` (truncation, validation, skip-update detection).
- **Analysis request symbols**: Analysis code should use `request.get_symbol()` instead of reading only `request.stock_code`, because requests may arrive with either `symbol` or `stock_code`. Normalize back onto `request.stock_code` when downstream compatibility requires it, and use the normalized symbol for notifications, graph propagation, and result fields.
- **Data/cache integration**: `tradingagents` MongoDB cache adapters must honor `MONGODB_DATABASE_NAME`/`MONGODB_DATABASE` instead of hardcoding `tradingagents`. Data source order is DB-driven, but BaoStock is available as a default fallback when no BaoStock config row exists.
- **BaoStock fallback**: `app/worker/baostock_sync_service.py` supports `sync_single_historical_data()` for analysis-time data backfill. `StockDataPreparer` can use BaoStock for single-stock historical data; it intentionally skips BaoStock financial-data sync and uses AKShare for realtime quotes when the primary source is Tushare or BaoStock.
- **Logging**: Configured in `app/core/logging_config.py` (UTF-8). Uses `print()` with emoji for debug output — avoid adding emoji to `print()` calls if stdout might be latin-1.

### Git

- Branch `main` is the active development branch.
- Remote: `git@github.com:sentomk/Aura.git`.
- Commit style: conventional commits in English.

## Common Pitfalls

1. **CORS**: When adding Tauri/webview origins, update `ALLOWED_ORIGINS` in `.env`. Must include `tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost` plus the Vite dev port (1420).
2. **Port 8000 conflict**: Docker containers or other processes on 8000 prevent the sidecar from spawning. The Rust sidecar checks with `TcpStream::connect` before trying to start.
3. **API key persistence**: The backend `should_skip_api_key_update()` returns `False` for empty strings — empty string means "clear the key". The frontend must only send `api_key` when the user actually typed a new value. Truncated keys (containing `...`) and placeholders (`your_*`) are auto-skipped.
4. **HTTP header encoding**: HTTP headers are latin-1 only. API keys with non-ASCII characters (emoji, CJK) will crash the `requests` library. `_test_deepseek_api` validates ASCII before making the request.
5. **Node version**: Must use Node v22+. `.nvmrc` at `frontend/` root — run `nvm use` to auto-select. `engine-strict=true` in `.npmrc` makes npm fail on wrong versions.
6. **Markdown rendering**: Reports content is Markdown — use `<MarkdownRenderer>` component (wraps `marked` library) rather than `<p>` or raw interpolation.
7. **401 handling**: Do not manually clear auth on every 401 from feature code. Let the shared `request()` helper attempt refresh first. Only login/refresh and explicit anonymous endpoints should opt out with `skipRefresh`.
8. **Task status strings**: Treat `running` as an active analysis status alongside `pending` and `processing`; otherwise restored backend tasks can appear inactive while they are still executing.
9. **MongoDB database name drift**: App config may use split MongoDB fields while `tradingagents` expects env vars. Keep bridge output and cache adapter database selection aligned before debugging "missing cache" or "empty reports" symptoms.

## Architecture Decisions (refactor/tauri)

- **Sidecar pattern**: The Rust binary spawns Python as a child process via `beforeDevCommand` (start-dev.sh). The shell script uses process-group kill (`kill -TERM -$$`) to ensure all grandchildren die with the parent.
- **`<KeepAlive>`**: Dashboard tabs are kept alive so Analysis tasks continue polling and state survives tab switches.
- **Hash routing**: Required for Tauri's file:// protocol in production builds.
- **Multi-task analysis**: The analysis store holds a `Map<string, TaskState>` — users submit multiple stocks in parallel, each with independent polling and progress.
- **Task restore on page open**: Analysis tasks are restored from the backend when the Analysis page mounts, then merged into the in-memory map. This keeps task cards and Reports navigation usable after refresh/reopen.
- **Analysis/Reports split**: Analysis page has only the submission form + task status cards. All completed results are viewed in the Reports page, connected via `reportNav.taskId` relay.
- **`DESIRED_PROVIDERS` hardcoded in Settings.vue**: The frontend defines which LLM providers to show (currently only DeepSeek). The backend may have more providers configured; the frontend filters to its known list.
- **API key placeholder detection**: `_is_placeholder_api_key()` catches patterns like `your-*`, `*-here`, `...`, short keys — prevents placeholder values from overwriting real API keys in the DB.
- **API key masking**: The backend returns truncated keys (`sk-abc...xyz`) via `truncate_api_key()`. The frontend should treat `...`-containing values as "unchanged" when saving.
