---
name: journal
description: Work journal — add entries, view by date, or search
argument-hint: "[add|view|search] [content or query]"
---

# /journal — Work Journal

Manage work journal entries.

## Modes

### `add "content"` (default when content provided)

Add a manual journal entry. Default type: `work`.

**Usage:**
- `/journal add "Decided to use FastEndpoints for permits API"` — type: work
- `/journal add --type decision "Switched to RTK Query v2"` — type: decision
- `/journal add --type blocker "Waiting on Okta admin for RECD-792"` — type: blocker
- `/journal add --type learning "Squidex webhooks need retry config"` — type: learning

**Behavior:**
1. Parse content and optional type flag
2. Insert into `journal_entries` table with today's date and `source = 'manual'`
3. Append to `modules/journal/output/YYYY-MM-DD.md`
4. Confirm entry saved

### `view [date]`

View journal entries for a date (default: today).

**Usage:**
- `/journal view` — today's entries
- `/journal view 2026-04-10` — specific date
- `/journal view yesterday` — yesterday's entries

**Behavior:**
1. Query `journal_entries` for the specified date
2. Present entries grouped by type

### `search "query"`

Search journal entries by content or tags.

**Usage:** `/journal search "permits"` or `/journal search "RECD-456"`

**Behavior:**
1. Query `journal_entries WHERE content LIKE '%query%' OR tags LIKE '%query%'`
2. Present matching entries with dates

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
