#!/usr/bin/env bash
# second-brain — SessionStart nudge.
#
# Prints "N unprocessed captures" if the inbox has anything waiting. DB/network calls are
# fragile, so this FAILS COMPLETELY SILENT: any error, timeout, missing config, or non-numeric
# response prints nothing and exits 0 (never blocks a session). Count is TTL-cached so rapid
# session restarts don't hammer the service.
#
# No set -e: SessionStart hooks must always exit 0.

SERVICE_URL="${SECOND_BRAIN_SERVICE_URL:-http://192.168.130.160:8095}"
TOKEN="${SECOND_BRAIN_TOKEN:-}"
CACHE_DIR="$HOME/.claude/cache"
CACHE="$CACHE_DIR/second-brain-count.cache"
CACHE_TTL=120

count=""

# 1. Use a fresh cached count if available.
if [ -f "$CACHE" ]; then
  now=$(date +%s)
  mod=$(stat -f %m "$CACHE" 2>/dev/null || echo 0)
  if (( now - mod < CACHE_TTL )); then
    count=$(cat "$CACHE" 2>/dev/null)
  fi
fi

# 2. Otherwise fetch from the service (short timeout, bearer auth). Any failure → silent exit.
if [ -z "$count" ]; then
  resp=$(curl -fsS --max-time 1 -H "Authorization: Bearer ${TOKEN}" "${SERVICE_URL}/count" 2>/dev/null) || exit 0
  count=$(printf '%s' "$resp" | sed -n 's/.*"count"[[:space:]]*:[[:space:]]*\([0-9]\{1,\}\).*/\1/p')
  [ -n "$count" ] || exit 0
  mkdir -p "$CACHE_DIR" 2>/dev/null
  printf '%s' "$count" > "$CACHE" 2>/dev/null
fi

# 3. Only nudge when there's something to process.
case "$count" in
  ''|*[!0-9]*) exit 0 ;;
esac

if [ "$count" -eq 1 ]; then
  echo "📥 second-brain: 1 unprocessed capture waiting. Run /sb process to discuss it."
elif [ "$count" -gt 1 ]; then
  echo "📥 second-brain: ${count} unprocessed captures waiting. Run /sb process to discuss them."
fi

exit 0
