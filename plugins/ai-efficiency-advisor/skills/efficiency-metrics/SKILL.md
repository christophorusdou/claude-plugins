---
name: efficiency-metrics
description: This skill should be used when analyzing AI coding tool efficiency, interpreting usage metrics like cost-per-session or cost-per-line, understanding token ratios, detecting anti-patterns (thrashing, runaway sessions, context stuffing), reviewing feature adoption status, or mapping data sources for Claude Code usage analysis. Relevant when discussing spending, efficiency trends, wasted sessions, model selection, or context exhaustion.
---

# Efficiency Metrics

Core principle: **efficiency = better outcomes with less waste** (time, tokens, money), not more usage.

## Data Sources

| Source | Path | Contents |
|--------|------|----------|
| Session snapshots | `~/.claude/cache/session-snapshots/*.json` | Per-session: cost, tokens, duration, lines |
| Stats cache | `~/.claude/stats-cache.json` | Aggregate: daily activity, model usage, hourly dist |
| History | `~/.claude/history.jsonl` | Every prompt: timestamp, project, sessionId |
| claude-dash API | `http://192.168.130.160:8090/api/` | Real-time: heartbeats, session state, context_pct |

## Metric Categories

### Cost Efficiency
- **cost_per_session**: total_cost / session_count
- **cost_per_line**: total_cost / (lines_added + lines_removed)
- **wasted_cost**: sum(cost) where lines_changed = 0 AND cost > $1
- **daily/weekly/monthly totals**: aggregate from snapshots

### Token Efficiency
- **output_to_input_ratio**: output_tokens / input_tokens
- **context_exhaustion_rate**: sessions where context_pct > 90% / total sessions

### Time Efficiency
- **session_duration_distribution**: count by short (<30m), medium (30-120m), long (>120m)
- **api_to_wall_ratio**: api_duration_ms / duration_ms (how much is waiting vs active)

### Outcome Quality
- **lines_per_session**: (lines_added + lines_removed) / session_count
- **zero_output_rate**: sessions with 0 lines changed / total sessions
- **project_concentration**: unique projects / sessions (lower = more focused)

### Behavioral
- **model_selection_ratio**: opus_sessions / total_sessions (aim for <80% — use Sonnet for simple tasks)
- **feature_adoption_rate**: adopted_features / known_features
- **peak_hour_distribution**: sessions by hour of day

## Anti-Patterns

Detected patterns: thrashing, runaway sessions, retry storms, zero-output, context stuffing, model overuse, marathon drift. Each has severity (high/medium/low), detection rules, and recommended actions. See `references/anti-patterns.md` for full detection rules and thresholds.

## Feature Tracking

Live adoption data: `/Volumes/d50-970p-1t/projects/ai-efficiency/data/feature-adoption.json`
Feature catalog: `references/feature-checklist.md`

Key features tracked: /voice, model selection, /loop, /compact, channels, remote control, effort frontmatter, CLAUDE_PLUGIN_DATA, rate limits in statusline, and 15+ others. The catalog is static reference; the JSON file is the canonical live tracker updated by each check-in.

## Interpreting Metrics

- Trending **down** on cost_per_session and cost_per_line = getting more efficient
- Trending **up** on zero_output_rate = sessions are becoming less productive
- model_selection_ratio near 100% Opus = potential cost savings
- context_exhaustion_rate > 20% = need more plan mode or /compact usage

See `references/metrics-catalog.md` for full Good/Warning/Bad thresholds per metric.
