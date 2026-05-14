#!/usr/bin/env bash
# Aura — uv environment bootstrap (Unix / macOS)
# Checks for uv, installs if missing, then syncs project dependencies.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_ok()  { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
print_err() { echo -e "${RED}[ERR]${NC} $1"; }
print_info(){ echo -e "${CYAN}[.. ]${NC} $1"; }

# Resolve project root (this script lives in scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Aura bootstrap — project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# --- Check for uv ---
if command -v uv &>/dev/null; then
    print_ok "uv found: $(uv --version 2>&1)"
else
    print_warn "uv not found — installing via the official installer…"
    if command -v curl &>/dev/null; then
        curl -LsSf https://astral.sh/uv/install.sh | sh
    elif command -v wget &>/dev/null; then
        wget -qO- https://astral.sh/uv/install.sh | sh
    else
        print_err "Neither curl nor wget available. Install uv manually: https://docs.astral.sh/uv/"
        exit 1
    fi
    # Source cargo env so uv lands on PATH for this session
    if [ -f "$HOME/.cargo/env" ]; then
        # shellcheck disable=SC1090
        source "$HOME/.cargo/env"
    fi
    if command -v uv &>/dev/null; then
        print_ok "uv installed: $(uv --version)"
    else
        print_err "uv installed but not on PATH — restart your shell and re-run this script."
        exit 1
    fi
fi

# --- Sync dependencies ---
print_info "Running uv sync…"
uv sync

print_ok "Bootstrap complete. Start the backend with: uv run python -m app"
