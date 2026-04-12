---
name: pre-standup
description: Generate standup talking points before daily standup
schedule: "30 10 * * 1-5"
cwd: /Volumes/d50-970p-1t/projects/work/work-assistant-claude
---

# Pre-Standup Agent

Runs at 10:30am CST, Monday through Friday (30 minutes before 11am standup).

## Prompt

Generate today's standup talking points by invoking the `standup-prep` skill. This is an unattended scheduled run — do not ask for user input.

Read today's morning briefing and recent journal entries to produce a concise yesterday/today/blockers script. Write output to modules/standup/output/YYYY-MM-DD.md.
