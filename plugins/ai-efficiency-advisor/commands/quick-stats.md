---
description: Quick AI usage stats for the last 7 days — cost, sessions, top projects, anti-patterns
allowed-tools: ["Read", "Glob", "Grep", "Bash"]
---

# Quick Stats

Lightweight usage summary — no surveys, no research, no file writes. Read-only operation.

## Step 1: Gather Data

1. Read all session snapshots from `~/.claude/cache/session-snapshots/*.json`
2. Filter to files modified in the last 7 days using Bash: `find ~/.claude/cache/session-snapshots -name "*.json" -mtime -7`
3. Read `~/.claude/stats-cache.json` for aggregate context

## Step 2: Compute & Display

For each snapshot, extract: cost_usd, duration_ms, lines_added, lines_removed, total_input_tokens, total_output_tokens.

Present in this format:

### Last 7 Days Summary

| Metric | Value |
|--------|-------|
| Sessions | [count] |
| Total cost | $[total] |
| Avg cost/session | $[avg] |
| Total lines changed | +[added]/-[removed] |
| Lines per dollar | [ratio] |

### Model Usage
| Model | Sessions | Cost |
|-------|----------|------|
| opus | [n] | $[cost] |
| sonnet | [n] | $[cost] |

### Top Projects (by cost)
Derive from `~/.claude/history.jsonl` — read the last 1000 lines and group by project path.

| Project | Sessions | Cost |
|---------|----------|------|
| [name] | [n] | $[cost] |

### Anti-Patterns Detected
Flag any sessions matching:
- Cost > $50 (runaway)
- Zero lines changed but cost > $1 (zero-output)
- Duration > 3 hours (marathon)

If none found: "No anti-patterns detected."

## Step 3: Footer

> For a full review with action items, research, and portfolio analysis, run `/check-in`
