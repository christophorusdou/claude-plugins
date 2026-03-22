# AI Efficiency Advisor Plugin

Claude Code plugin for AI tool efficiency coaching.

## Related Repos

| Repo | Local Path | Relationship |
|------|-----------|-------------|
| [ai-efficiency](https://git.cdrift.com/chris/ai-efficiency) | `~/projects/ai-efficiency` | Data repo — check-in history, action items, evolution log. This plugin is the **brain** (commands, agents, skills); that repo is the **memory** (data, docs). |

## Structure

```
commands/
  check-in.md       — /check-in [quick|full|research|portfolio]
  quick-stats.md    — /quick-stats (7-day summary)
agents/
  usage-analyzer.md — Computes metrics from session data
  research-scout.md — Discovers new features/tools/practices
  portfolio-scout.md — Assesses project portfolio health
skills/
  efficiency-metrics/   — Metric definitions, anti-patterns, feature checklist
  check-in-protocol/    — Check-in workflow, survey templates, cadence
hooks/
  hooks.json            — SessionStart nudge config
  session-start-nudge.sh — Reminds after 7+ days without check-in
```

## Data Paths Used

Agents read from:
- `~/.claude/cache/session-snapshots/*.json`
- `~/.claude/stats-cache.json`
- `~/.claude/history.jsonl`
- `~/.claude/settings.json`
- `http://192.168.130.160:8090/api/` (claude-dash, when available)

Commands write to:
- `/Volumes/d50-970p-1t/projects/ai-efficiency/data/`
