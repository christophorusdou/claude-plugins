---
name: career-research
description: >-
  Use when running a periodic career research session. Executes a 7-phase workflow:
  context loading, industry research via WebSearch, personal growth scan via git log,
  checkpoint for review, report generation, recommendations, and discussion. Tracks
  trends in both markdown and SQLite. Self-evolves by evaluating source effectiveness
  and adjusting research focus after each session.
user-invocable: false
---

# Career Research Skill — 7-Phase Workflow

This skill executes a structured career research session. Follow all 7 phases in order. Do not skip phases. All file paths are relative to the project root (the current working directory when this skill is invoked).

---

## Phase 1: Context Load

Load all context before doing any research.

1. Read `profile/chris.md` — current career profile, concerns, direction
2. Read `profile/strategic-bets.md` — active strategic paths and confidence levels
3. Read `profile/skill-inventory.md` — current skills, levels, trajectories
4. Read `profile/project-portfolio.md` — active projects and their strategic alignment
5. Read the last 2-3 research session reports from `research/` (sorted by date, newest first, skip `_index.md`)
6. Read baseline trend trackers:
   - `trends/ai-capabilities.md`
   - `trends/job-market.md`
   - `trends/ai-tooling.md`
7. Read `skills/career-research/references/research-sources.md` for search strategies and trusted domains
8. Read `skills/career-research/references/analysis-framework.md` for the analysis approach

Summarize the current state before proceeding: What are Chris's active concerns? What were the key findings from the last session? What trends are we tracking?

---

## Phase 2: Industry Research

Launch WebSearch queries across 4 domains. Use search terms from `references/research-sources.md`. If the reference file lacks specific terms for a domain, use these defaults:

### AI Capabilities and Architecture
- "AI model breakthroughs [current year]"
- "transformer architecture alternatives [current year]"
- "AGI progress debate [current year]"
- "AI reasoning capabilities advances"

### Developer AI Tools
- "AI coding tools developer survey [current year]"
- "Claude Code updates [current month]"
- "AI IDE agent market [current year]"
- "Cursor Copilot Claude Code comparison"

### Job Market
- "software engineering jobs AI impact [current year]"
- "engineering team lead hiring trends"
- "AI engineer salary trends"
- "software engineer career AI disruption"

### AI Tool Building
- "MCP server adoption [current year]"
- "AI agent frameworks enterprise [current year]"
- "LLM tool use infrastructure"
- "AI developer platform market"

**For each domain:**
1. Run 2-3 WebSearch queries
2. WebFetch the 2-3 most relevant URLs from search results
3. Summarize findings with specific data points, dates, and sources
4. Note which sources were most/least useful

If the research is scoped to a specific topic (via `/research topic <name>`), focus all queries on that topic while still covering how it relates to each domain.

---

## Phase 3: Personal Growth Scan

Scan git activity across Chris's key projects for the last 2-4 weeks. The list of projects to scan is maintained in `references/research-sources.md` under "Personal Projects to Scan" — read that file for the current paths. Run a git log for each:

```bash
# Example — use actual paths from references/research-sources.md
git -C <project_path> log --since="4 weeks ago" --oneline --no-merges 2>/dev/null | head -10
```

After collecting git activity:
- Compare activity patterns to `profile/skill-inventory.md`
- Note any trajectory changes (skill growing faster/slower than expected)
- Identify skills being actively practiced vs. dormant
- Flag any new skills appearing in commit patterns

---

## Phase 4: CHECKPOINT

Present raw findings in a structured format for review before analysis:

```
## Research Session YYYY-MM-DD — Raw Findings

### AI Capabilities and Architecture
- [findings from Phase 2]

### Developer AI Tools
- [findings from Phase 2]

### Job Market Signals
- [findings from Phase 2]

### Personal Growth (since last session)
- [findings from Phase 3]

---
Ready to analyze? [Continue | Adjust scope | Add a topic]
```

**STOP and wait for user confirmation before proceeding.** If the user wants adjustments, run additional WebSearch queries as needed. Do not proceed to Phase 5 until the user says to continue.

---

## Phase 5: Report Generation

Generate the full research report and update all tracking systems.

### 5a: Write Research Report
Write the full report to `research/YYYY-MM-DD-<focus>.md` using the template from `templates/research-session.md`. The `<focus>` slug should reflect the primary topic or "full-scan" for comprehensive sessions.

### 5b: Update Research Index
Add the new entry to `research/_index.md` with date, focus, and key findings summary.

### 5c: Update Trend Trackers
Update each trend file with new entries:
- `trends/ai-capabilities.md` — new capability signals
- `trends/job-market.md` — new market signals
- `trends/ai-tooling.md` — new tooling signals

Each entry should include date, signal description, sentiment (positive/negative/neutral), and source.

### 5d: SQLite Tracking
Insert trend signals into the database:
```bash
sqlite3 data/career.db "INSERT INTO trend_signals (date, category, signal, sentiment, relevance, source, session_date) VALUES ('[date]', '[category]', '[signal]', '[sentiment]', [relevance], '[source]', '[session_date]');"
```

Insert research session metadata:
```bash
sqlite3 data/career.db "INSERT INTO research_sessions (date, focus_areas, key_findings, recommendations_count, decisions_made, meta_notes) VALUES ('[date]', '[focus]', '[findings]', [count], [decisions], '[notes]');"
```

---

## Phase 6: Recommendations

Generate 3-5 specific, actionable recommendations based on the analysis. Apply the analysis framework from `references/analysis-framework.md` — every recommendation must pass the "So What" rule.

Each recommendation must include:

| Field | Description |
|-------|-------------|
| **Action** | What to do — specific and concrete |
| **Rationale** | Why this matters based on today's findings |
| **Effort** | Low / Medium / High |
| **Urgency** | Now / Soon / Watch |
| **Aligns With** | Which strategic path(s) this supports |

Present recommendations in a table format in the report.

---

## Phase 7: Discussion + Decisions

### 7a: Present and Discuss
Present the recommendations for discussion. Ask Chris which ones to act on, defer, or dismiss.

### 7b: Record Decisions
For any decisions made during discussion:
1. Create a decision record using `templates/decision-record.md`
2. Write to `decisions/YYYY-MM-DD-<slug>.md`
3. Update `decisions/_index.md`

### 7c: Profile Updates
- If the growth scan revealed trajectory changes, update `profile/skill-inventory.md`
- If updating skills, offer to take an SQLite snapshot:
  ```bash
  sqlite3 data/career.db "INSERT INTO skill_snapshots (date, skill, level, trajectory, strategic_value) VALUES ('$(date +%Y-%m-%d)', '<skill>', <level>, '<trajectory>', <strategic_value>);"
  ```
- If strategic bets have new evidence, update `profile/strategic-bets.md`

### 7d: Self-Evolution
Run these self-improvement prompts:
1. "Were any research sources particularly useful or useless this session?" — update `references/research-sources.md` Source Effectiveness sections
2. "Should we adjust research focus areas for next session?" — note any changes needed
3. "Any improvements needed to the research template or workflow?" — capture meta feedback
4. Record all meta feedback in the research report under a Meta section

### 7e: Commit and Schedule
- Git commit all changes (stage specific directories, not `git add -A`):
  ```bash
  git add research/ trends/ decisions/ profile/ data/career.db && git commit -m "research session YYYY-MM-DD: [brief summary]"
  ```
- Suggest next session date (2-4 weeks out based on urgency of findings)
