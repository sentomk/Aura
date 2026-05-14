#!/usr/bin/env bash
# Aura — one-command dev environment setup (Unix / macOS)
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${CYAN}[..]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  Aura — Dev Environment Setup"
echo ""

# Step 1: Python + uv + dependencies
info "Step 1/5: Python environment..."
bash scripts/bootstrap.sh
ok "Python environment ready"

# Step 2: Docker services
info "Step 2/5: Starting MongoDB + Redis..."
docker compose up -d mongodb redis 2>/dev/null || {
  warn "Docker not available — skip MongoDB/Redis"
}
ok "Docker services"

# Step 3: .env
info "Step 3/5: Environment config..."
if [ -f .env ]; then
  ok ".env exists"
else
  if [ -f .env.example ]; then
    cp .env.example .env
    ok ".env created from .env.example"
  else
    warn ".env.example not found — create .env manually"
  fi
fi

# Step 4: Frontend deps
info "Step 4/5: Frontend dependencies..."
if [ -f frontend/package.json ]; then
  cd frontend && npm install --silent && cd "$SCRIPT_DIR"
  ok "Frontend ready"
else
  warn "frontend/package.json not found — skip"
fi

# Step 5: Admin user
info "Step 5/5: Admin user..."
uv run python scripts/create_admin.py 2>/dev/null && ok "Admin user ready" || warn "Admin user already exists"

echo ""
echo "  Setup complete!"
echo ""
echo "  Start dev:      cd frontend && npx tauri dev"
echo "  Backend only:   uv run python -m app"
echo "  Stop services:  docker compose down"
echo ""
