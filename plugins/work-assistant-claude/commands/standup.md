---
name: standup
description: Quick standup prep with yesterday/today/blockers
---

# /standup — Standup Prep

Generate concise standup talking points.

## Scope

This command is scoped to the **work workspace only** (`/Volumes/d50-970p-1t/projects/work/` or `~/projects/work/`). If the current working directory is not under the work folder, respond: "This command is only available in the work workspace." and do not execute.

## Behavior

1. Gather data by running:
   ```bash
   bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-briefing-data.sh
   ```

2. From the output, extract:
   - **Yesterday:** sessions worked, journal entries from yesterday, Jira tickets moved
   - **Today:** in-progress tickets, today's calendar meetings, planned focus
   - **Blockers:** tickets with Blocked status, journal blocker entries

3. Format as a ~30-second speaking script:
   ```
   **Yesterday:**
   - [2-3 bullet points]

   **Today:**
   - [2-3 bullet points]

   **Blockers:**
   - [blockers or "None"]
   ```

4. Write to `modules/standup/output/YYYY-MM-DD.md` and insert into standup_entries table.

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
