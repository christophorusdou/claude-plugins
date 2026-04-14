---
name: journal
description: Work journal — add entries, view by date, or search
argument-hint: "[add|view|search] [content or query]"
---

# /journal — Work Journal

Manage work journal entries.

## Behavior

Run the journal script:
```bash
bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-journal.sh <mode> <args>
```

### Modes

- **add** `"content"` `[type]` — Add entry. Types: work (default), decision, blocker, learning
  ```bash
  wa-journal.sh add "Decided to use FastEndpoints for permits API" decision
  ```

- **view** `[date]` — View entries for a date. Supports: `today`, `yesterday`, `YYYY-MM-DD`
  ```bash
  wa-journal.sh view yesterday
  ```

- **search** `"query"` — Search entries by content
  ```bash
  wa-journal.sh search "permits"
  ```

Present the script output to the user. For `add`, confirm the entry was saved.

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
