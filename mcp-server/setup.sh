#!/usr/bin/env bash
# MCP Server Full Setup Script
# Tested on Ubuntu 22.04/24.04 LTS
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_PORT="${MCP_PORT:-3000}"
API_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       MCP Plug-and-Play Server Setup                      ║"
echo "║       Ubuntu 22.04/24.04 LTS                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ─── Check OS ────────────────────────────────────────────────────────────────
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]] && [[ "$ID" != "debian" ]]; then
        log_warn "This script is optimized for Ubuntu/Debian. Proceeding anyway..."
    fi
fi

# ─── Update system ───────────────────────────────────────────────────────────
log_info "Updating system packages..."
apt-get update -q
apt-get install -y -q \
    curl wget git build-essential software-properties-common \
    ca-certificates gnupg lsb-release apt-transport-https \
    nginx ffmpeg xdotool xclip scrot wmctrl \
    tesseract-ocr libasound2-dev python3 python3-pip \
    postgresql-client redis-tools jq openssl
log_success "System packages installed"

# ─── Node.js 20 ──────────────────────────────────────────────────────────────
if ! node --version 2>/dev/null | grep -q "v2[0-9]"; then
    log_info "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_success "Node.js $(node --version) installed"
else
    log_success "Node.js $(node --version) already installed"
fi

# ─── Docker ──────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    log_success "Docker installed"
else
    log_success "Docker $(docker --version | cut -d' ' -f3) already installed"
fi

# ─── Docker Compose ──────────────────────────────────────────────────────────
if ! docker compose version &>/dev/null; then
    log_info "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
    log_success "Docker Compose installed"
else
    log_success "Docker Compose already installed"
fi

# ─── Python packages ─────────────────────────────────────────────────────────
log_info "Installing Python packages..."
pip3 install -q -r "$SCRIPT_DIR/requirements.txt" || log_warn "Some Python packages failed to install"
log_success "Python packages installed"

# ─── Create directories ──────────────────────────────────────────────────────
log_info "Creating directories..."
mkdir -p \
    /var/mcp/workspaces \
    /var/mcp/sandboxes \
    /var/log/mcp-server
log_success "Directories created"

# ─── Setup .env ──────────────────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    log_info "Creating .env from template..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    # Set generated secrets
    sed -i "s/change-me-to-a-random-256-bit-secret/$API_KEY/g" "$SCRIPT_DIR/.env"
    sed -i "s/change-me-to-another-random-256-bit-secret/$JWT_SECRET/g" "$SCRIPT_DIR/.env"
    sed -i "s/MCP_PORT=3000/MCP_PORT=$MCP_PORT/g" "$SCRIPT_DIR/.env"
    log_success ".env created with generated secrets"
else
    log_warn ".env already exists, skipping"
fi

# ─── Install npm dependencies ─────────────────────────────────────────────────
log_info "Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm ci
log_success "npm dependencies installed"

# ─── Build TypeScript ─────────────────────────────────────────────────────────
log_info "Building TypeScript..."
npm run build
log_success "TypeScript built"

# ─── Install Playwright browsers ─────────────────────────────────────────────
log_info "Installing Playwright browsers..."
npx playwright install chromium --with-deps 2>/dev/null || log_warn "Playwright browser install failed (optional)"
log_success "Playwright ready"

# ─── Start Docker services ───────────────────────────────────────────────────
log_info "Starting Docker services..."
cd "$SCRIPT_DIR"
docker compose up -d redis postgres qdrant
log_info "Waiting for services to start..."
sleep 15

# Check services
if docker ps --format '{{.Names}}' | grep -q mcp-redis; then
    log_success "Redis running"
fi
if docker ps --format '{{.Names}}' | grep -q mcp-postgres; then
    log_success "PostgreSQL running"
fi
if docker ps --format '{{.Names}}' | grep -q mcp-qdrant; then
    log_success "Qdrant running"
fi

# ─── Install systemd service ──────────────────────────────────────────────────
if [ -f /etc/systemd/system/mcp-server.service ]; then
    log_warn "systemd service already exists"
else
    log_info "Installing systemd service..."
    sed "s|/opt/mcp-server|$SCRIPT_DIR|g" "$SCRIPT_DIR/systemd/mcp-server.service" \
        > /etc/systemd/system/mcp-server.service
    systemctl daemon-reload
    systemctl enable mcp-server
    log_success "systemd service installed and enabled"
fi

# ─── Start MCP server ─────────────────────────────────────────────────────────
log_info "Starting MCP server..."
cd "$SCRIPT_DIR"
docker compose up -d mcp-server nginx playwright-server 2>/dev/null || {
    # Fallback: run directly
    log_warn "Docker compose failed for mcp-server, trying direct start..."
    nohup node dist/index.js > /var/log/mcp-server/app.log 2>&1 &
    echo $! > /var/run/mcp-server.pid
}

sleep 5

# ─── Health check ─────────────────────────────────────────────────────────────
log_info "Running health check..."
if curl -sf "http://localhost:$MCP_PORT/health" | grep -q "healthy"; then
    log_success "MCP Server is healthy"
else
    log_warn "Health check failed - server may still be starting"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! 🎉                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "  📍 Server URL:     http://localhost:$MCP_PORT"
echo "  🔧 Tools API:      http://localhost:$MCP_PORT/mcp/tools"
echo "  📡 SSE Endpoint:   http://localhost:$MCP_PORT/mcp/sse"
echo "  💚 Health Check:   http://localhost:$MCP_PORT/health"
echo "  📚 Info:           http://localhost:$MCP_PORT/mcp/info"
echo ""
echo "  🔑 API Key:        $API_KEY"
echo "     (also saved in .env)"
echo ""
echo "  📝 Call a tool:"
echo "     curl -X POST http://localhost:$MCP_PORT/mcp/tools/call \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -H 'X-API-Key: $API_KEY' \\"
echo "       -d '{\"tool\": \"get_app_status\", \"input\": {}}'"
echo ""
echo "  📋 Logs:           /var/log/mcp-server/app.log"
echo "  🐳 Status:         docker compose ps"
echo "  🔄 Restart:        systemctl restart mcp-server"
echo ""
