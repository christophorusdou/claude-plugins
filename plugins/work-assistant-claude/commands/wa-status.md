---
name: wa-status
description: Work Assistant system status — sync freshness, agent health, data quality
---

# /wa-status — System Status

Show the health of the work-assistant-claude system.

## Behavior

1. Read `wa_config` for last sync timestamps
2. Check data freshness:
   - Last Jira sync (warn if > 4h stale)
   - Last session sync (warn if > 24h stale)
   - Last briefing generated (warn if not today)
   - Last EOD review (warn if not yesterday)
3. Check database integrity: `PRAGMA integrity_check`
4. Count records: sessions, Jira snapshots, journal entries, patterns
5. Check unreviewed patterns count
6. Show sync directory status: files in incoming/, processed/ counts
7. Present formatted status dashboard

## Output Format

```
── Work Assistant Status ───────────────────
 Database: OK (7 tables, integrity passed)
 
 Data Freshness:
   Jira:     2h ago (OK)
   Sessions: 8h ago (OK)
   Briefing: today 7:45am (OK)
   EOD:      yesterday 5:15pm (OK)
 
 Records:
   Sessions: 142 | Jira snapshots: 890
   Journal:  45  | Patterns: 8 (3 new)
 
 Sync:
   incoming/: 0 files waiting
   processed/: 23 files
 
 Agents: [check RemoteTrigger status]
────────────────────────────────────────────
```

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work-assistant-claude/`
