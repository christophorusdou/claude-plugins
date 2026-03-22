# Hook Best Practices

Hard-won lessons from auditing and debugging Claude Code plugin hooks across multiple plugins. Every issue here caused a real bug.

## Critical Rules

### Never use `set -euo pipefail` in hooks

**Why:** Any unexpected failure (jq parse error, missing command, sqlite error) causes exit 1. For PreToolUse hooks, exit 1 is a non-blocking error (tool proceeds but stderr shows in verbose mode). For SessionStart/PostToolUse hooks, exit 1 produces hidden error output. In all cases, the hook's intended logic is short-circuited.

**Instead:** Guard each step individually:
```bash
# BAD
set -euo pipefail
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# GOOD
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$file_path" ]; then
  exit 0
fi
```

### Always set explicit timeouts

**Why:** Default command hook timeout is 60 seconds. A hanging hook (infinite loop, network call, missing stdin) freezes Claude Code for up to 60 seconds — on every tool call that matches.

**The timeout field is in seconds** (not milliseconds). A value of `5000` means 5000 seconds (83 minutes), not 5 seconds.

```json
{
  "type": "command",
  "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.sh",
  "timeout": 5
}
```

**Recommended timeouts:**
| Hook type | Timeout | Rationale |
|-----------|---------|-----------|
| PreToolUse (pattern matching) | 5s | Just jq + string matching |
| PreToolUse (python/external) | 10s | Python startup + logic |
| PostToolUse (file checks) | 5s | Just jq + string matching |
| PostToolUse (docker/external) | 10s | Docker commands can be slow |
| SessionStart (light context) | 5s | Read a file, print output |
| SessionStart (scanning dirs) | 10s | May walk filesystem |

### Always use `trap` for temp files

**Why:** Without `set -e`, scripts don't crash on errors — but if they `exit 0` early (which they should), temp files created before the early exit are leaked.

```bash
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT  # Cleans up on any exit path
jq -r '.projects | keys[]' "$MAP" > "$tmpfile" 2>/dev/null || exit 0
```

### PreToolUse hooks: only exit 0 or 2

| Exit code | Meaning | When to use |
|-----------|---------|-------------|
| 0 | Allow | Tool proceeds normally |
| 2 | Block | Tool is denied, stderr shown to Claude |
| 1 (or other) | Non-blocking error | Tool proceeds, stderr only in verbose mode |

Exit 1 from a PreToolUse hook means "something went wrong in the hook itself" — it does NOT block the tool. If your hook accidentally exits 1 (e.g., from `set -e`), every edit silently produces an error that's invisible unless verbose mode is on.

## Common Bugs

### Infinite loop in path-walking

**The bug:** Walking path components with `${path%/*}` to find a project name. When `path="/Volumes"`, `${path%/*}` produces `""` (empty string), not `"/"`. The loop condition `"" != "/"` is always true — infinite loop at 100% CPU.

```bash
# BAD — infinite loop when path reaches single-depth
while [[ "$path" != "/" ]]; do
  path="${path%/*}"
done

# GOOD — also check for empty
while [[ -n "$path" && "$path" != "/" ]]; do
  path="${path%/*}"
done
```

### Variable shadowing commands

```bash
# BAD — shadows the `basename` command
basename=$(basename "$file_path")
# After this, `basename foo` tries to execute the variable value

# GOOD
file_basename=$(basename "$file_path")
```

### Missing dependency guards

```bash
# BAD — crashes if jq/docker/python3 not installed
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

# GOOD — exit gracefully
if ! command -v jq &>/dev/null; then exit 0; fi
if ! command -v docker &>/dev/null; then exit 0; fi
```

### SQL injection from path components

```bash
# BAD — directory name with ' breaks the query
PROJECT_NAME=$(basename "$PWD")
sqlite3 "$DB" "SELECT * FROM t WHERE project = '${PROJECT_NAME}'"

# GOOD — sanitize to safe chars
if [[ ! "$PROJECT_NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  PROJECT_NAME=""
fi
```

### macOS bash 3.2 incompatibilities

```bash
# BAD — mapfile doesn't exist in bash 3.2
mapfile -t KEYS < <(jq -r '.keys[]' file.json)

# GOOD — portable alternative
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT
jq -r '.keys[]' file.json > "$tmpfile"
KEYS=()
while IFS= read -r key; do
  KEYS+=("$key")
done < "$tmpfile"
```

Also: `grep -P` (PCRE) is not available on macOS. Use `grep -E` or `sed` instead.

## Monitoring Hooks

### Built-in tools

| Method | Command | What it shows |
|--------|---------|---------------|
| Verbose mode | `Ctrl+O` in session | Hook stderr, exit codes in real-time |
| Debug mode | `claude --debug` | Hook matching, execution, exit codes |
| List hooks | `/hooks` in session | All configured hooks, matchers, sources |

### Custom logging

The homelab-context plugin wraps hooks with `run-with-logging.sh` that logs to `~/.claude/hook-errors.log` when:
- Exit code is unexpected (not 0 or 2)
- Duration exceeds 10 seconds

See `plugins/homelab-context/hooks/run-with-logging.sh` for the pattern.

### Spotting stuck hooks

If Claude Code seems frozen after an edit, check for stuck hook processes:
```bash
ps aux | grep -E "hook|session-start|remind|validate|block-secrets" | grep -v grep
```

Any process at high CPU for more than a few seconds is likely a hung hook.

## Hook Template

```bash
#!/usr/bin/env bash

# <EventType> hook: <what it does>
# Always exits 0 (or 2 for intentional PreToolUse blocks).

# No set -e: hooks must handle errors gracefully, not crash.

input=$(cat)

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
if [ -z "$file_path" ]; then
  exit 0
fi

# Guard external dependencies
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Use trap for temp files
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# ... hook logic ...

exit 0
```

## Changelog

- **2026-03-22**: Initial version from audit of 8 hook-enabled plugins. Found and fixed: infinite loop in path-walking (3 hooks), `set -euo pipefail` in all custom hooks (5 scripts), timeout 5000s instead of 5s (2 plugins), missing timeouts (3 plugins), basename shadowing, SQL injection, temp file leaks, missing docker guard.
