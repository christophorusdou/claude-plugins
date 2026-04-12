---
name: eod-review
description: Summarize the day and write automatic journal entry
schedule: "15 17 * * 1-5"
cwd: /Volumes/d50-970p-1t/projects/work-assistant-claude
---

# EOD Review Agent

Runs at 5:15pm CST, Monday through Friday.

## Prompt

Run the end-of-day review by invoking the `eod-review` skill. This is an unattended scheduled run — do not ask for user input.

Summarize today's work: sessions from both machines, git commits across work repos, Jira transitions, journal entries. Write an auto-eod journal entry and the summary to modules/eod-review/output/YYYY-MM-DD.md. Flag any incomplete work or follow-ups for tomorrow.
