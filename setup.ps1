# Aura — one-command dev environment setup (Windows)
$ErrorActionPreference = "Stop"

function Write-OK   { Write-Host "[OK]  $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Info { Write-Host "[..]  $args" -ForegroundColor Cyan }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "  Aura — Dev Environment Setup"
Write-Host ""

# Step 1: Python + uv + dependencies
Write-Info "Step 1/5: Python environment..."
& "$ScriptDir\scripts\bootstrap.ps1"
Write-OK "Python environment ready"

# Step 2: Docker services
Write-Info "Step 2/5: Starting MongoDB + Redis..."
try {
    docker compose up -d mongodb redis 2>$null
    Write-OK "Docker services"
} catch {
    Write-Warn "Docker not available — skip MongoDB/Redis"
}

# Step 3: .env
Write-Info "Step 3/5: Environment config..."
if (Test-Path .env) {
    Write-OK ".env exists"
} else {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-OK ".env created from .env.example"
    } else {
        Write-Warn ".env.example not found — create .env manually"
    }
}

# Step 4: Frontend deps
Write-Info "Step 4/5: Frontend dependencies..."
if (Test-Path frontend\package.json) {
    Set-Location frontend; npm install --silent; Set-Location $ScriptDir
    Write-OK "Frontend ready"
} else {
    Write-Warn "frontend\package.json not found — skip"
}

# Step 5: Admin user
Write-Info "Step 5/5: Admin user..."
try {
    uv run python scripts\create_admin.py 2>$null
    Write-OK "Admin user ready"
} catch {
    Write-Warn "Admin user already exists"
}

Write-Host ""
Write-Host "  Setup complete!"
Write-Host ""
Write-Host "  Start dev:      cd frontend; npx tauri dev"
Write-Host "  Backend only:   uv run python -m app"
Write-Host "  Stop services:  docker compose down"
Write-Host ""
