#!/bin/bash
set -euo pipefail

# PostToolUse hook: Validate Docker Compose YAML syntax after edits.
# Reads JSON from stdin, extracts file_path from tool_input.
# Always exits 0 (PostToolUse is informational only).

input=$(cat)

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

# Only validate docker-compose files
if [[ "$file_path" != *docker-compose*.yml ]] && [[ "$file_path" != *docker-compose*.yaml ]]; then
  exit 0
fi

# Check if file exists locally
if [ ! -f "$file_path" ]; then
  exit 0
fi

# Validate compose syntax
if ! docker compose -f "$file_path" config -q 2>/tmp/compose-validate-err; then
  echo "WARNING: Docker Compose validation failed for $file_path:" >&2
  cat /tmp/compose-validate-err >&2
fi

exit 0
