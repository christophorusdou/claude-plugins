#!/bin/bash

# PostToolUse hook: Remind to run /audit-plugin when infra files are modified.
# Reads JSON from stdin, extracts file_path from tool_input.
# Also detects infra-relevant edits in known homelab projects (cross-project awareness).
# Always exits 0 (PostToolUse is informational only).

# No set -e: this hook must never fail or produce errors.

input=$(cat)

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$file_path" ]; then
  exit 0
fi

# Skip if editing plugin files themselves (avoid noisy self-referential reminders)
if [[ "$file_path" == *plugins/homelab-context/* ]]; then
  exit 0
fi

# Check if the edited file is an infra file (homelab repo patterns)
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

# --- Cross-project detection ---
# Only proceed if jq is available and project-map.json exists
PROJECT_MAP="${CLAUDE_PLUGIN_ROOT}/hooks/project-map.json"

if [[ ! -f "$PROJECT_MAP" ]]; then
  exit 0
fi

if ! command -v jq &>/dev/null; then
  exit 0
fi

# Walk file_path components and check if any match a known project key
# Use a temp file to avoid process substitution (bash 3.2 compat + portable)
_KEYS_TMP=$(mktemp)
trap 'rm -f "$_KEYS_TMP"' EXIT
jq -r '.projects | keys[]' "$PROJECT_MAP" > "$_KEYS_TMP" 2>/dev/null || exit 0
PROJECT_KEYS=()
while IFS= read -r key; do
  PROJECT_KEYS+=("$key")
done < "$_KEYS_TMP"

MATCHED_KEY=""
path_component="$file_path"
while [[ -n "$path_component" && "$path_component" != "/" && -z "$MATCHED_KEY" ]]; do
  basename_part="${path_component##*/}"
  for key in "${PROJECT_KEYS[@]}"; do
    if [[ "$basename_part" == "$key" ]]; then
      MATCHED_KEY="$key"
      break
    fi
  done
  path_component="${path_component%/*}"
done

if [[ -z "$MATCHED_KEY" ]]; then
  exit 0
fi

# File is in a known project — now check if it matches an infra pattern
file_basename="$(basename "$file_path")"
file_rel_path=""

# Build a relative-style path suffix for .forgejo/workflows matching
# Find the project dir boundary and take everything after it
proj_dir=""
tmp="$file_path"
while [[ -n "$tmp" && "$tmp" != "/" ]]; do
  if [[ "${tmp##*/}" == "$MATCHED_KEY" ]]; then
    proj_dir="$tmp"
    break
  fi
  tmp="${tmp%/*}"
done

if [[ -n "$proj_dir" ]]; then
  file_rel_path="${file_path#${proj_dir}/}"
fi

is_cross_infra=false

# docker-compose*.yml / docker-compose*.yaml
if [[ "$file_basename" == docker-compose*.yml ]] || [[ "$file_basename" == docker-compose*.yaml ]]; then
  is_cross_infra=true
# Dockerfile or Dockerfile.*
elif [[ "$file_basename" == Dockerfile ]] || [[ "$file_basename" == Dockerfile.* ]]; then
  is_cross_infra=true
# .forgejo/workflows/*.yml — match via relative path
elif [[ "$file_rel_path" == .forgejo/workflows/*.yml ]]; then
  is_cross_infra=true
fi

if [ "$is_cross_infra" = true ]; then
  STACK=$(jq -r --arg k "$MATCHED_KEY" '.projects[$k].stack' "$PROJECT_MAP")
  echo "[homelab] Changed ${file_basename} in ${MATCHED_KEY} (homelab stack: ${STACK}). If ports, databases, or domains changed, update homelab-context plugin."
fi

exit 0
