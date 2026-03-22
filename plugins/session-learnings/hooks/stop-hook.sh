#!/bin/bash

# Session Learnings Stop Hook
# Blocks stopping on substantive sessions to prompt Claude to capture learnings.
# Trivial sessions (< 5 tool uses) pass through immediately.
# Uses a marker file to ensure we only prompt once per session.

# Guard dependencies
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Read hook input from stdin
HOOK_INPUT=$(cat)

TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""')

# No transcript or session ID? Allow stop.
if [[ -z "$TRANSCRIPT_PATH" ]] || [[ ! -f "$TRANSCRIPT_PATH" ]] || [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Only prompt once per session — check marker file
MARKER="/tmp/claude-learnings-${SESSION_ID}"
if [[ -f "$MARKER" ]]; then
  exit 0
fi

# Count tool uses in transcript as a complexity proxy
TOOL_COUNT=$(grep -c '"type":"tool_use"' "$TRANSCRIPT_PATH" 2>/dev/null || echo "0")

# Trivial session? Allow stop.
if [[ "$TOOL_COUNT" -lt 5 ]]; then
  exit 0
fi

# Mark that we prompted this session (prevents re-triggering after capture)
touch "$MARKER"

# Block and ask Claude to reflect on learnings
jq -n '{
  "decision": "block",
  "reason": "Before finishing, reflect on whether this session produced non-obvious learnings worth preserving.\n\nWorth capturing (use the capture-learnings skill):\n- Debugging discovery: root cause was non-obvious, fix contradicted assumptions, or error was misleading\n- Architectural decision with trade-offs weighed\n- Gotcha or pitfall that would waste time if hit again\n- Tool/API/library behaved unexpectedly vs documentation\n- Configuration or environment nuance\n- Integration between systems revealed undocumented behavior\n\nIf no non-obvious learnings exist, just say so briefly and stop. Do NOT force learnings where none exist.",
  "systemMessage": "Session learnings check triggered (session had significant activity)."
}'

exit 0
