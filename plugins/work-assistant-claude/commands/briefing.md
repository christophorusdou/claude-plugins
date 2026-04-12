---
name: briefing
description: View today's morning briefing or regenerate it
argument-hint: "[view|regenerate]"
---

# /briefing — Morning Briefing

View or regenerate today's morning intelligence briefing.

## Modes

### `view` (default)

Read and present today's briefing from `modules/briefing/output/YYYY-MM-DD.md`.

If no briefing exists for today, offer to generate one.

**Usage:** `/briefing` or `/briefing view`

### `regenerate`

Force regenerate today's briefing with fresh data. Invokes the `morning-briefing` skill.

**Usage:** `/briefing regenerate`

## Behavior

1. Determine today's date
2. Check if `modules/briefing/output/YYYY-MM-DD.md` exists in the work-assistant-claude project
3. If exists: read and present the briefing
4. If not: invoke the `morning-briefing` skill to generate it
5. For `regenerate`: always invoke the skill regardless of existing file

## Project Path

The work-assistant-claude data repo is at `/Volumes/d50-970p-1t/projects/work-assistant-claude/`.
Read data from there regardless of current working directory.
