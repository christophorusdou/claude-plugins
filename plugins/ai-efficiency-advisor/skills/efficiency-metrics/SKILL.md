---
name: efficiency-metrics
description: Metric definitions, formulas, and data source mappings for AI usage efficiency analysis. Load this skill when computing or interpreting efficiency metrics.
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

See `references/anti-patterns.md` for detection rules.

## Feature Tracking

See `references/feature-checklist.md` for known features and adoption status.

## Interpreting Metrics

- Trending **down** on cost_per_session and cost_per_line = getting more efficient
- Trending **up** on zero_output_rate = sessions are becoming less productive
- model_selection_ratio near 100% Opus = potential cost savings
- context_exhaustion_rate > 20% = need more plan mode or /compact usage
