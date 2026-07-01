#!/usr/bin/env bash
# Memory plugin — SessionStart curation nudge.
# Reminds when the knowledge archive hasn't been curated in a while, so the
# consolidate/audit/age tools actually get run. Silent unless overdue.
#
# No set -e: SessionStart hooks must always exit 0 to avoid blocking sessions.

DB="$HOME/.claude-memory/memory.db"
STAMP="$HOME/.claude-memory/last-curation"
CURATE_DAYS=14
MIN_ENTRIES=25

# Nothing to curate yet, or no sqlite available → stay silent.
[ -f "$DB" ] || exit 0
command -v sqlite3 >/dev/null 2>&1 || exit 0

COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM memories" 2>/dev/null || echo 0)
case "$COUNT" in ''|*[!0-9]*) exit 0 ;; esac
[ "$COUNT" -ge "$MIN_ENTRIES" ] || exit 0

if [ -f "$STAMP" ]; then
  LAST_DATE=$(head -c 10 "$STAMP" 2>/dev/null)
  # BSD/macOS `date -jf` first, GNU/Linux `date -d` fallback.
  LAST_EPOCH=$(date -jf "%Y-%m-%d" "$LAST_DATE" +%s 2>/dev/null \
    || date -d "$LAST_DATE" +%s 2>/dev/null \
    || echo 0)
  # A stamp exists but can't be parsed → stay silent rather than nudge every session.
  [ "$LAST_EPOCH" -ne 0 ] || exit 0
  DAYS_AGO=$(( ( $(date +%s) - LAST_EPOCH ) / 86400 ))
  [ "$DAYS_AGO" -ge "$CURATE_DAYS" ] || exit 0
  echo "[memory] ${COUNT} entries, ${DAYS_AGO} days since last curation. Run /mem curate to review stale + duplicate memories."
  exit 0
fi

# No (valid) timestamp recorded yet — archive has grown but was never curated.
echo "[memory] ${COUNT} entries, not yet curated. Run /mem curate to review stale + duplicate memories."
exit 0
