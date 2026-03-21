# Metrics Catalog

Detailed definitions for all efficiency metrics.

## Cost Efficiency

| Metric | Formula | Unit | Source | Good | Warning | Bad |
|--------|---------|------|--------|------|---------|-----|
| Cost per session | total_cost / sessions | $/session | snapshots | <$5 | $5-$20 | >$20 |
| Cost per line | total_cost / lines_changed | $/line | snapshots | <$0.05 | $0.05-$0.20 | >$0.20 |
| Wasted session cost | sum(cost where lines=0, cost>$1) | $ | snapshots | <5% of total | 5-15% | >15% |
| Daily total | sum(cost) per day | $/day | snapshots | <$30 | $30-$80 | >$80 |
| Weekly total | sum(cost) per week | $/week | snapshots | <$150 | $150-$400 | >$400 |

## Token Efficiency

| Metric | Formula | Unit | Source | Good | Warning | Bad |
|--------|---------|------|--------|------|---------|-----|
| Output/input ratio | output_tokens / input_tokens | ratio | snapshots | >0.15 | 0.05-0.15 | <0.05 |
| Context exhaustion rate | sessions(ctx>90%) / total | % | claude-dash | <10% | 10-25% | >25% |

## Time Efficiency

| Metric | Formula | Unit | Source | Good | Warning | Bad |
|--------|---------|------|--------|------|---------|-----|
| Avg session duration | avg(duration_ms) | minutes | snapshots | 15-60m | 60-120m | >120m |
| API/wall ratio | api_duration / total_duration | ratio | snapshots | >0.5 | 0.3-0.5 | <0.3 |
| Short sessions % | sessions(<30m) / total | % | snapshots | 40-60% | <40% | <20% |

## Outcome Quality

| Metric | Formula | Unit | Source | Good | Warning | Bad |
|--------|---------|------|--------|------|---------|-----|
| Lines per session | lines_changed / sessions | lines | snapshots | >50 | 20-50 | <20 |
| Zero-output rate | sessions(lines=0) / total | % | snapshots | <10% | 10-25% | >25% |
| Project concentration | unique_projects / sessions | ratio | history | <0.5 | 0.5-0.8 | >0.8 |

## Behavioral

| Metric | Formula | Unit | Source | Good | Warning | Bad |
|--------|---------|------|--------|------|---------|-----|
| Opus usage ratio | opus_sessions / total | % | stats-cache | <80% | 80-95% | >95% |
| Feature adoption | adopted / known | % | feature-adoption.json | >60% | 40-60% | <40% |
| Plan mode usage | plan_sessions / long_sessions | % | history | >50% | 25-50% | <25% |

## Notes

- Thresholds are initial estimates — refine based on personal baselines after 3+ check-ins
- "Lines changed" is lines_added + lines_removed, a rough proxy for productive output
- Zero-output sessions aren't always bad (research, exploration) but consistently high rates signal waste
