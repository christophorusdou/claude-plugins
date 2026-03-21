#!/usr/bin/env bash
# AI Efficiency Advisor — SessionStart nudge
# Checks time since last check-in and outputs a reminder if overdue.
# Silent output = no context injection into Claude.

set -euo pipefail

CHECKIN_DIR="/Volumes/d50-970p-1t/projects/ai-efficiency/data/check-ins"
SNAPSHOT_DIR="$HOME/.claude/cache/session-snapshots"
NUDGE_DAYS=7

# Find latest check-in file
if [ ! -d "$CHECKIN_DIR" ]; then
  echo "[ai-efficiency] No check-in data found. Run /check-in in the ai-efficiency project to establish your baseline."
  exit 0
fi

LATEST=$(ls -t "$CHECKIN_DIR"/*.json 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "[ai-efficiency] No check-ins recorded yet. Run /check-in in the ai-efficiency project to get started."
  exit 0
fi

LAST_DATE=$(basename "$LATEST" .json)

# Calculate days since last check-in (macOS date)
LAST_EPOCH=$(date -jf "%Y-%m-%d" "$LAST_DATE" +%s 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)

if [ "$LAST_EPOCH" -eq 0 ]; then
  exit 0
fi

DAYS_AGO=$(( (NOW_EPOCH - LAST_EPOCH) / 86400 ))

if [ "$DAYS_AGO" -ge "$NUDGE_DAYS" ]; then
  # Single python3 invocation to count sessions and sum cost from all newer snapshots
  STATS=$(python3 -c "
import os, json, glob
snap_dir = os.path.expanduser('$SNAPSHOT_DIR')
ref_file = '$LATEST'
ref_mtime = os.path.getmtime(ref_file)
sessions = 0
total_cost = 0.0
for f in glob.glob(os.path.join(snap_dir, '*.json')):
    if os.path.getmtime(f) > ref_mtime:
        sessions += 1
        try:
            with open(f) as fh:
                total_cost += json.load(fh).get('cost_usd', 0)
        except Exception:
            pass
print(f'{sessions} {total_cost:.2f}')
" 2>/dev/null || echo "0 0.00")

  SESSIONS=$(echo "$STATS" | cut -d' ' -f1)
  TOTAL_COST=$(echo "$STATS" | cut -d' ' -f2)

  echo "[ai-efficiency] It's been ${DAYS_AGO} days since your last efficiency check-in (${LAST_DATE}). Since then: ${SESSIONS} sessions, \$${TOTAL_COST} spent. Consider running /check-in in the ai-efficiency project."
fi

exit 0
