---
name: standup
description: Quick standup prep with yesterday/today/blockers
---

# /standup — Standup Prep

Generate or view concise standup talking points.

## Behavior

1. Check if `modules/standup/output/YYYY-MM-DD.md` exists
2. If exists and recent (generated within last 2 hours): present it
3. If stale or missing: invoke the `standup-prep` skill to generate fresh talking points
4. Output format: Yesterday / Today / Blockers — ~30 second speaking script

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
