#!/usr/bin/env bash

# SessionStart hook: detect if the current working directory belongs to a known
# homelab project and print a brief context reminder to stderr.
# Always exits 0 — never blocks a session.

# No set -e: this hook must never fail. Guard each step individually.

PROJECT_MAP="${CLAUDE_PLUGIN_ROOT}/hooks/project-map.json"

if [[ ! -f "$PROJECT_MAP" ]]; then
  exit 0
fi

if ! command -v jq &>/dev/null; then
  exit 0
fi

# Build an array of project keys from the map (bash 3.2 compatible)
_KEYS_TMP=$(mktemp)
trap 'rm -f "$_KEYS_TMP"' EXIT
jq -r '.projects | keys[]' "$PROJECT_MAP" > "$_KEYS_TMP" 2>/dev/null || exit 0
PROJECT_KEYS=()
while IFS= read -r key; do
  PROJECT_KEYS+=("$key")
done < "$_KEYS_TMP"

# Walk $PWD components and check if any match a project key
MATCHED_KEY=""
path="$PWD"
while [[ -n "$path" && "$path" != "/" && -z "$MATCHED_KEY" ]]; do
  basename_part="${path##*/}"
  for key in "${PROJECT_KEYS[@]}"; do
    if [[ "$basename_part" == "$key" ]]; then
      MATCHED_KEY="$key"
      break
    fi
  done
  path="${path%/*}"
done

if [[ -z "$MATCHED_KEY" ]]; then
  exit 0
fi

# Extract all fields in one jq call
STACK=$(jq -r --arg k "$MATCHED_KEY" '.projects[$k].stack // empty' "$PROJECT_MAP" 2>/dev/null) || exit 0
PORT=$(jq -r --arg k "$MATCHED_KEY" '.projects[$k].port // empty' "$PROJECT_MAP" 2>/dev/null)
DATABASE=$(jq -r --arg k "$MATCHED_KEY" '.projects[$k].database // empty' "$PROJECT_MAP" 2>/dev/null)
DOMAIN=$(jq -r --arg k "$MATCHED_KEY" '.projects[$k].domain // empty' "$PROJECT_MAP" 2>/dev/null)

# Build the detail line from non-null fields
DETAILS=""
if [[ -n "$PORT" && "$PORT" != "null" ]]; then
  DETAILS="Port ${PORT}"
fi
if [[ -n "$DATABASE" && "$DATABASE" != "null" ]]; then
  DETAILS="${DETAILS:+${DETAILS}, }database ${DATABASE}"
fi
if [[ -n "$DOMAIN" && "$DOMAIN" != "null" ]]; then
  DETAILS="${DETAILS:+${DETAILS}, }domain ${DOMAIN}"
fi

echo "[homelab] This project runs as the \"${STACK}\" stack on N100." >&2
if [[ -n "$DETAILS" ]]; then
  echo "${DETAILS}." >&2
fi
echo "Changes to ports, databases, or domains here should be reflected in the homelab-context plugin." >&2

exit 0
