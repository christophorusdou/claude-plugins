---
name: wa-status
description: Work Assistant system status — sync freshness, agent health, data quality
---

# /wa-status — System Status

Show the health of the work-assistant-claude system.

## Behavior

Run the status script:

```bash
bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-status.sh
```

Present the output to the user. If any section shows RED/STALE status, suggest remediation:
- Jira stale → run `/wa-sync jira`
- Sessions stale → run `/wa-sync sessions`
- Briefing missing → run `/briefing regenerate`
- Agent not loaded → `launchctl load ~/Library/LaunchAgents/com.work-assistant-claude.<name>.plist`
- Calendar binary missing → `swiftc -O -o scripts/get-calendar scripts/get-calendar.swift -framework EventKit -framework Foundation`

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
