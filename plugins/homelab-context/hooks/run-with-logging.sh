#!/bin/bash

# Wrapper that runs a hook script and logs errors or slow execution.
# Usage: run-with-logging.sh <script-name>
#
# Logs to ~/.claude/hook-errors.log when:
# - Hook exits non-zero
# - Hook takes longer than SLOW_THRESHOLD_MS (default: 10000ms = 10s)
#
# The wrapper is transparent: stdin is forwarded, stdout/stderr pass through,
# and the original exit code is preserved.

SCRIPT_NAME="${1:?Usage: run-with-logging.sh <script-name>}"
SCRIPT_PATH="${CLAUDE_PLUGIN_ROOT}/hooks/${SCRIPT_NAME}"
LOG_FILE="${HOME}/.claude/hook-errors.log"
SLOW_THRESHOLD_MS=10000

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Hook script not found: $SCRIPT_PATH" >&2
  exit 0
fi

# Capture stdin so we can forward it
input=$(cat)

# Record start time (milliseconds, portable)
start_ms=$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s%3N 2>/dev/null || echo 0)

# Run the actual hook, forwarding stdin
echo "$input" | bash "$SCRIPT_PATH"
exit_code=$?

# Record end time
end_ms=$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s%3N 2>/dev/null || echo 0)
duration_ms=$((end_ms - start_ms))

# Log if slow or errored
should_log=false
reason=""

if [[ $exit_code -ne 0 && $exit_code -ne 2 ]]; then
  should_log=true
  reason="exit_code=$exit_code"
fi

if [[ $duration_ms -gt $SLOW_THRESHOLD_MS ]]; then
  should_log=true
  reason="${reason:+${reason}, }duration=${duration_ms}ms (threshold=${SLOW_THRESHOLD_MS}ms)"
fi

if [[ "$should_log" == "true" ]]; then
  # Ensure log directory exists
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ${SCRIPT_NAME}: ${reason}" >> "$LOG_FILE"
fi

exit $exit_code
