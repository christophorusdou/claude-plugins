# Anti-Pattern Detection Rules

## High Severity

### Thrashing
- **Detection**: output_tokens > 50,000 AND lines_changed < 10 AND context_pct > 80%
- **Indicates**: Spinning without progress — Claude is producing lots of text but not making meaningful code changes
- **Action**: Break the task into smaller, focused subtasks. Use plan mode to scope work before starting. Consider if the approach is fundamentally wrong — stop and rethink.
- **Data source**: Session snapshots + claude-dash heartbeats

### Runaway Session
- **Detection**: cost_usd > $50 for a single session
- **Indicates**: Unbounded exploration or scope creep within a single session
- **Action**: Set mental cost budgets per session. Use /clear to reset context when switching topics. Break marathon work into 1-2 hour focused sessions.
- **Data source**: Session snapshots

## Medium Severity

### Retry Storms
- **Detection**: 3+ sessions on the same project within 2 hours
- **Indicates**: The approach isn't working — starting new sessions hoping for different results
- **Action**: Step back and rethink the approach. Try plan mode to design a strategy before coding. Consider if you're fighting a fundamental misunderstanding.
- **Data source**: history.jsonl (timestamps + project paths)

### Zero-Output Sessions
- **Detection**: cost_usd > $1 AND lines_added + lines_removed = 0
- **Indicates**: Session produced no code changes despite meaningful cost. May be legitimate (research, planning) but consistently high rate signals waste.
- **Action**: Before starting a session, define what the concrete output should be. If exploring, keep sessions short. Use /quick-stats to track this rate.
- **Data source**: Session snapshots

### Context Stuffing
- **Detection**: context_pct > 90% AND plan mode not used
- **Indicates**: Trying to hold too much in context without structure
- **Action**: Use plan mode to organize work. Use /compact to compress context. Break work into focused sessions with clear scope.
- **Data source**: claude-dash heartbeats

## Low Severity

### Model Overuse
- **Detection**: Opus used AND total_output_tokens < 1,000
- **Indicates**: Using the most expensive model for tasks that Sonnet handles fine (quick lookups, simple edits, commit messages)
- **Action**: Use Sonnet (/model sonnet) for simple tasks. Reserve Opus for complex reasoning, architecture, and multi-file changes.
- **Data source**: Session snapshots + stats-cache

### Marathon Drift
- **Detection**: duration_ms > 10,800,000 (3 hours)
- **Indicates**: Session ran for an extended period, likely with scope creep. Later-session work tends to be lower quality as context gets stale.
- **Action**: Break into 1-2 hour focused sessions. Use /clear between topics. Start fresh sessions for new work streams.
- **Data source**: Session snapshots
