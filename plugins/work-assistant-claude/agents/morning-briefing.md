---
name: morning-briefing
description: Generate daily morning intelligence briefing
schedule: "45 7 * * 1-5"
cwd: /Volumes/d50-970p-1t/projects/work/work-assistant-claude
---

# Morning Briefing Agent

Runs at 7:45am CST, Monday through Friday.

## Prompt

Generate today's morning briefing by invoking the `morning-briefing` skill. This is an unattended scheduled run — do not ask for user input. Complete the full workflow:

1. Sync session data from Claude Dash API and SMB incoming files
2. Sync Jira sprint data
3. Check git status across all work repos at /Volumes/d50-970p-1t/projects/work/
4. Check for new patterns in detected_patterns table
5. Determine today's meetings from sprint calendar
6. Generate the briefing and write to modules/briefing/output/YYYY-MM-DD.md

If any data source is unavailable (API down, no files, etc.), generate the briefing with available data and note what's missing.
