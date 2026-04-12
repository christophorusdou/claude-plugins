# Work Assistant Claude Plugin

Automated work intelligence — the behavioral layer for the work-assistant-claude project.

## Related Repos

| Repo | Local Path | Relationship |
|------|-----------|-------------|
| work-assistant-claude | `/Volumes/d50-970p-1t/projects/work/work-assistant-claude` | Data repo — SQLite database, configuration, generated output. This plugin provides the workflows; that repo stores the data. |
| work | `/Volumes/d50-970p-1t/projects/work/` | Target workspace — 11 repos for Outdoor Rec Mgmt Platform |

## How It Works

This plugin provides commands, skills, hooks, and agents for the work-assistant-claude project. The project directory stores all data (SQLite, configs, output files). This plugin provides all behavior.

- **Commands** — user-invocable slash commands (/briefing, /standup, /journal, /meeting-prep, /wa-status, /wa-sync)
- **Skills** — workflow implementations that commands invoke
- **Hooks** — SessionStart hook shows ambient context when in work-assistant-claude/ or work/ directories
- **Agents** — scheduled RemoteTrigger definitions for unattended automation
