---
name: wa-start
description: Start work assistant — register all scheduled cron jobs for this session
---

# /wa-start — Initialize Work Assistant Session

Register all scheduled cron jobs for the current Claude Code session. Run this at the start of each work session.

## Scope

This command is scoped to the **work workspace only** (`/Volumes/d50-970p-1t/projects/work/` or `~/projects/work/`). If the current working directory is not under the work folder, respond: "This command is only available in the work workspace." and do not execute.

## Behavior

Create 5 CronCreate jobs with `recurring: true`:

1. **Morning briefing** — `43 7 * * 1-5` (7:43am weekdays)
   Prompt: Run `bash scripts/wa-briefing-data.sh`, generate briefing markdown, update wa_config.

2. **Pre-standup** — `28 10 * * 1-5` (10:28am weekdays)
   Prompt: Run `bash scripts/wa-briefing-data.sh`, generate standup script, insert standup_entries.

3. **EOD review** — `17 17 * * 1-5` (5:17pm weekdays)
   Prompt: Run `bash scripts/wa-briefing-data.sh`, generate EOD summary, insert auto-eod journal entry.

4. **Jira sync** — `7 8,10,12,14,16 * * 1-5` (every 2h weekdays)
   Prompt: Run `bash scripts/wa-sync.sh all`.

5. **Weekly patterns** — `3 20 * * 0` (Sunday 8:03pm)
   Prompt: Query all tables for 7 days, detect patterns, write weekly report.

All jobs use the CronCreate tool. They are session-scoped (die when session ends, auto-expire after 7 days) — run `/wa-start` in each new session.

After creating jobs, run `CronList` to confirm and show the user the registered schedule.

## Project Path

All scripts at `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/`
