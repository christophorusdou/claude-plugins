#!/usr/bin/env bash
# Startup wrapper for memory MCP server
# Handles lazy install of node_modules on first run and repairs incomplete installs
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/server"

# Preserve the cwd Claude Code launched us with BEFORE cd-ing into the server
# dir — project auto-detection must see the session's directory, not the
# plugin's (the cd below is why v1 scoped every memory to "memory-server").
export MEMORY_SESSION_CWD="${MEMORY_SESSION_CWD:-$PWD}"

cd "$SERVER_DIR"

needs_install=0
if [ ! -d "node_modules" ]; then
  needs_install=1
elif ! node --input-type=module -e 'await import("@modelcontextprotocol/sdk/server/mcp.js"); await import("zod"); await import("better-sqlite3");' >/dev/null 2>&1; then
  needs_install=1
fi

if [ "$needs_install" -eq 1 ]; then
  pnpm install --prod >&2
fi

exec node dist/index.js
