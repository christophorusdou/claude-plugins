---
name: weekly-patterns
description: Weekly pattern detection and self-evolution analysis
schedule: "0 20 * * 0"
cwd: /Volumes/d50-970p-1t/projects/work-assistant-claude
---

# Weekly Patterns Agent

Runs at 8:00pm CST on Sundays.

## Prompt

Run weekly pattern detection by invoking the `pattern-detect` skill with a 7-day analysis window. This is an unattended scheduled run — do not ask for user input.

Analyze all accumulated data from the past week: sessions, Jira transitions, journal entries, standup data. Detect patterns across 6 categories: workflow, time, quality, sprint, blocker, and self-improvement. Insert findings into detected_patterns table and write a weekly report to modules/patterns/output/YYYY-WXX.md. Skip patterns similar to recently dismissed ones.
