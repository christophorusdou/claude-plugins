---
name: briefing
description: View today's morning briefing or regenerate it
argument-hint: "[view|regenerate]"
---

# /briefing — Morning Briefing

View or regenerate today's morning intelligence briefing.

## Behavior

### `view` (default)

Check if today's briefing exists:
```bash
ls /Volumes/d50-970p-1t/projects/work/work-assistant-claude/modules/briefing/output/$(date +%Y-%m-%d).md
```

If exists: read and present it. If not: generate (same as `regenerate`).

### `regenerate`

1. Gather all data by running:
   ```bash
   bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-briefing-data.sh
   ```

2. The script outputs structured sections: SESSIONS, JIRA SPRINT STATUS, MY TICKETS, GIT STATUS, CALENDAR TODAY, CALENDAR TOMORROW, EMAIL, PATTERNS, JOURNAL YESTERDAY.

3. Format the data into a morning briefing markdown file with sections:
   - Yesterday's Sessions (table)
   - Sprint Status (counts by status)
   - My Tickets (grouped by status)
   - Git Status (dirty repos only)
   - Meetings Today (from calendar, deduplicated, skip cancelled)
   - Tomorrow Preview (meetings needing prep)
   - Email Highlights (unread count + notable messages)
   - Today's Focus (inferred priorities)
   - Patterns & Suggestions (new unreviewed)

4. Write to: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/modules/briefing/output/YYYY-MM-DD.md`

5. Update wa_config:
   ```bash
   sqlite3 /Volumes/d50-970p-1t/projects/work/work-assistant-claude/data/assistant.db "INSERT OR REPLACE INTO wa_config (key, value, module) VALUES ('last_briefing', datetime('now'), 'briefing');"
   ```

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
