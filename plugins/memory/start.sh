#!/usr/bin/env bash
# Startup wrapper for memory MCP server
# Handles lazy install of node_modules on first run
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/server"

cd "$SERVER_DIR"

# Lazy install: only run if node_modules is missing
if [ ! -d "node_modules" ]; then
  npm install --production 2>/dev/null
fi

exec node dist/index.js
