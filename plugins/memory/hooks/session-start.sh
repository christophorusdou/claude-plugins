#!/usr/bin/env bash
# SessionStart hook: inject ranked, lifecycle-filtered memories into context.
# Thin wrapper — all logic lives in server/dist/cli.js so injection and recall
# share one ranking implementation (rank.ts).
#
# No set -e: SessionStart hooks must always exit 0 to avoid blocking sessions.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLI="${PLUGIN_ROOT}/server/dist/cli.js"

if command -v node >/dev/null 2>&1 && [ -f "$CLI" ]; then
  node "$CLI" session-start 2>/dev/null
  exit 0
fi

# Server not built yet — never block the session over it.
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Memory plugin active (server not built — its first MCP start will install and build it)."}}
EOF
exit 0
