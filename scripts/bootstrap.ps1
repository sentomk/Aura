# Aura — uv environment bootstrap (Windows)
# Checks for uv, installs if missing, then syncs project dependencies.

$ErrorActionPreference = "Stop"

function Write-OK   { Write-Host "[OK]  $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err  { Write-Host "[ERR]  $args" -ForegroundColor Red }
function Write-Info { Write-Host "[.. ] $args" -ForegroundColor Cyan }

# Resolve project root (this script lives in scripts\)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Info "Aura bootstrap — project root: $ProjectRoot"
Set-Location $ProjectRoot

# --- Check for uv ---
$uv = Get-Command uv -ErrorAction SilentlyContinue
if ($uv) {
    $uvVer = uv --version 2>&1
    Write-OK "uv found: $uvVer"
}
else {
    Write-Warn "uv not found — installing via the official installer…"
    try {
        irm -Uri "https://astral.sh/uv/install.ps1" -UseBasicParsing | iex
    }
    catch {
        Write-Err "Failed to install uv: $_"
        Write-Err "Install manually: https://docs.astral.sh/uv/getting-started/installation/"
        exit 1
    }

    # Refresh PATH (uv lands in ~/.cargo/bin or %USERPROFILE%\.cargo\bin)
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
    $uvCheck = Get-Command uv -ErrorAction SilentlyContinue
    if ($uvCheck) {
        Write-OK "uv installed: $(uv --version)"
    }
    else {
        Write-Err "uv installed but not on PATH — restart your shell and re-run this script."
        exit 1
    }
}

# --- Sync dependencies ---
Write-Info "Running uv sync…"
uv sync

Write-OK "Bootstrap complete. Start the backend with: uv run python -m app"
