#!/bin/bash

# PreToolUse hook: Block edits to .env, credentials, and secrets files.
# Reads JSON from stdin, extracts file_path from tool_input.
# Exit 0 = allow, Exit 2 = block.
#
# IMPORTANT: No set -e. PreToolUse hooks must only exit 0 (allow) or 2 (block).
# An accidental exit 1 from set -e would show as a non-blocking error.

input=$(cat)

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$file_path" ]; then
  exit 0
fi

# Block actual .env files, but only warn for .env.example / .env.template / .env.sample
if [[ "$file_path" == *.env ]] || [[ "$file_path" == *.env.* ]] || [[ "$file_path" == */.env ]]; then
  if [[ "$file_path" == *.example ]] || [[ "$file_path" == *.template ]] || [[ "$file_path" == *.sample ]]; then
    echo "WARNING: Editing env template file: $file_path. Ensure no real secrets are added." >&2
    exit 0
  fi
  echo "BLOCK: Refusing to edit .env file: $file_path. Manage secrets via macOS Keychain or SSH." >&2
  exit 2
fi

# Block credentials/masterkey/secret files (basename only to avoid false positives on docs/code)
file_basename=$(basename "$file_path")
if [[ "$file_basename" == *credentials* ]] || [[ "$file_basename" == *masterkey* ]] || [[ "$file_basename" == secrets.* ]] || [[ "$file_basename" == *.secret ]] || [[ "$file_basename" == .secrets ]]; then
  echo "BLOCK: Refusing to edit secrets file: $file_path. Use macOS Keychain: security add-generic-password -s <service> -a <account> -w <value> -U" >&2
  exit 2
fi

exit 0
