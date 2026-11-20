#!/usr/bin/env bash
# MCP Server Update Script
set -euo pipefail

MCP_DIR="${MCP_DIR:-/opt/mcp-server}"

echo "=== MCP Server Update ==="
cd "$MCP_DIR"

# Backup before update
echo "📦 Creating backup before update..."
bash scripts/backup.sh || true

# Pull latest changes
echo "🔄 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build
echo "🔨 Building..."
npm run build

# Restart services
echo "🔄 Restarting services..."
docker compose down
docker compose up -d --build

# Wait for health
echo "⏳ Waiting for server to become healthy..."
sleep 10
bash scripts/healthcheck.sh

echo ""
echo "✅ Update completed successfully!"
