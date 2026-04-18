---
name: patterns
description: View and manage detected work patterns — accept or dismiss suggestions
argument-hint: "[list|accept <id>|dismiss <id> \"reason\"|history]"
---

# /patterns — Pattern Management

View and act on detected patterns from the weekly intelligence analysis.

## Scope

This command is scoped to the **work workspace only** (`/Volumes/d50-970p-1t/projects/work/` or `~/projects/work/`). If the current working directory is not under the work folder, respond: "This command is only available in the work workspace." and do not execute.

## Behavior

Run the patterns script:
```bash
bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-patterns.sh <mode> [args]
```

### Modes

- **list** (default) — Show all new/unreviewed patterns with suggestions
- **accept** `<id>` — Mark a pattern as accepted (will inform future briefings)
- **dismiss** `<id>` `"reason"` — Dismiss with reason (future detection avoids similar patterns)
- **history** — Show all patterns with status (* new, + accepted, - dismissed)

Present the output to the user. For `list`, if there are actionable patterns, suggest next steps.

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
