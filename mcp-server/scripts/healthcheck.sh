#!/usr/bin/env bash
# MCP Server Health Check Script
set -euo pipefail

MCP_HOST="${MCP_HOST:-localhost}"
MCP_PORT="${MCP_PORT:-3000}"
BASE_URL="http://${MCP_HOST}:${MCP_PORT}"

PASS=0
FAIL=0

check() {
    local name="$1"
    local url="$2"
    local expected="$3"

    if curl -sf --max-time 5 "$url" | grep -q "$expected" 2>/dev/null; then
        echo "✅ $name"
        ((PASS++)) || true
    else
        echo "❌ $name (failed)"
        ((FAIL++)) || true
    fi
}

echo "=== MCP Server Health Check ==="
echo "Target: $BASE_URL"
echo ""

check "Server Health" "$BASE_URL/health" "healthy"
check "Tool Registry" "$BASE_URL/mcp/tools" "tools"
check "Categories" "$BASE_URL/mcp/categories" "categories"
check "Resources" "$BASE_URL/mcp/resources" "resources"
check "Prompts" "$BASE_URL/mcp/prompts" "prompts"
check "Server Info" "$BASE_URL/mcp/info" "version"

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
    echo "Health check FAILED"
    exit 1
else
    echo "Health check PASSED"
    exit 0
fi
