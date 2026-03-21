#!/bin/bash
set -euo pipefail

# PostToolUse hook: Remind to run /audit-plugin when infra files are modified.
# Reads JSON from stdin, extracts file_path from tool_input.
# Always exits 0 (PostToolUse is informational only).

input=$(cat)

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

# Skip if editing plugin files themselves (avoid noisy self-referential reminders)
if [[ "$file_path" == *plugins/homelab-context/* ]]; then
  exit 0
fi

# Check if the edited file is an infra file
is_infra=false

if [[ "$file_path" == *docker-compose*.yml ]] || [[ "$file_path" == *docker-compose*.yaml ]]; then
  is_infra=true
elif [[ "$file_path" == *Caddyfile* ]]; then
  is_infra=true
elif [[ "$file_path" == *cloudflared/config.yml ]]; then
  is_infra=true
elif [[ "$file_path" == */docs/*.md ]]; then
  is_infra=true
fi

if [ "$is_infra" = true ]; then
  echo "Infra file modified: $(basename "$file_path"). Consider running /audit-plugin to check if plugin docs need updating."
fi

exit 0
