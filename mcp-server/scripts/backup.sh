#!/usr/bin/env bash
# MCP Server Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mcp-server}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

echo "=== MCP Server Backup ==="
echo "Backup directory: $BACKUP_PATH"

mkdir -p "$BACKUP_PATH"

# Backup PostgreSQL
if docker ps --format '{{.Names}}' | grep -q mcp-postgres; then
    echo "📦 Backing up PostgreSQL..."
    docker exec mcp-postgres pg_dump -U mcpuser mcpdb > "$BACKUP_PATH/postgres.sql"
    echo "✅ PostgreSQL backed up"
fi

# Backup Redis
if docker ps --format '{{.Names}}' | grep -q mcp-redis; then
    echo "📦 Backing up Redis..."
    docker exec mcp-redis redis-cli BGSAVE
    sleep 2
    docker cp mcp-redis:/data/dump.rdb "$BACKUP_PATH/redis.rdb"
    echo "✅ Redis backed up"
fi

# Backup config
if [ -d "/opt/mcp-server/config" ]; then
    echo "📦 Backing up config..."
    cp -r /opt/mcp-server/config "$BACKUP_PATH/config"
    cp /opt/mcp-server/.env "$BACKUP_PATH/.env.backup" 2>/dev/null || true
    echo "✅ Config backed up"
fi

# Backup workspaces
if [ -d "/var/mcp/workspaces" ]; then
    echo "📦 Backing up workspaces..."
    tar -czf "$BACKUP_PATH/workspaces.tar.gz" -C /var/mcp workspaces 2>/dev/null || true
    echo "✅ Workspaces backed up"
fi

# Compress backup
tar -czf "$BACKUP_DIR/${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$BACKUP_PATH"

echo ""
echo "✅ Backup completed: $BACKUP_DIR/${TIMESTAMP}.tar.gz"
echo "Size: $(du -sh "$BACKUP_DIR/${TIMESTAMP}.tar.gz" | cut -f1)"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
echo "🧹 Old backups cleaned up"
