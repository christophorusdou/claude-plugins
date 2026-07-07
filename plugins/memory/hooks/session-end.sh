#!/usr/bin/env bash
# SessionEnd hook: automatic maintenance — WAL truncate, cadence-gated aging,
# snapshot, git commit, debounced detached push. Everything best-effort; the
# durable work happens in server/dist/cli.js maintain.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLI="${PLUGIN_ROOT}/server/dist/cli.js"

if command -v node >/dev/null 2>&1 && [ -f "$CLI" ]; then
  node "$CLI" maintain >/dev/null 2>&1 || true
fi
exit 0
