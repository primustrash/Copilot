#!/usr/bin/env bash
# MCP Server One-Liner Installer
# Usage: curl -fsSL https://your-domain.com/install.sh | bash

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/primustrash/Copilot.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/mcp-server}"
BRANCH="${BRANCH:-main}"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          MCP Plug-and-Play Server Installer               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script should be run as root or with sudo"
    echo "   Re-run: sudo bash install.sh"
    exit 1
fi

# Install git if not present
if ! command -v git &>/dev/null; then
    apt-get update -q && apt-get install -y -q git
fi

# Clone or pull repository
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "🔄 Updating existing installation..."
    git -C "$INSTALL_DIR" pull origin "$BRANCH"
else
    echo "📥 Cloning repository..."
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

# Run full setup
cd "$INSTALL_DIR/mcp-server"
bash setup.sh

echo ""
echo "✅ MCP Server installed successfully!"
