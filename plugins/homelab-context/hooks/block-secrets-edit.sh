#!/bin/bash
set -euo pipefail

# PreToolUse hook: Block edits to .env, credentials, and secrets files.
# Reads JSON from stdin, extracts file_path from tool_input.
# Exit 0 = allow, Exit 2 = block.

input=$(cat)

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

# Block .env files
if [[ "$file_path" == *.env ]] || [[ "$file_path" == *.env.* ]] || [[ "$file_path" == */.env ]]; then
  echo "BLOCK: Refusing to edit .env file: $file_path. Manage secrets via macOS Keychain or SSH." >&2
  exit 2
fi

# Block credentials/masterkey/secret files
if [[ "$file_path" == *credentials* ]] || [[ "$file_path" == *masterkey* ]] || [[ "$file_path" == *secret* ]]; then
  echo "BLOCK: Refusing to edit secrets file: $file_path. Use macOS Keychain: security add-generic-password -s <service> -a <account> -w <value> -U" >&2
  exit 2
fi

exit 0
