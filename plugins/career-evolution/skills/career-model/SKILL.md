---
name: career-model
description: >-
  Use when viewing or updating career profile, skill inventory, strategic bets,
  or project portfolio. Provides structured methods for profile management,
  skill assessment with rubric, and strategic bet evaluation.
user-invocable: false
---

# Career Model Skill — Profile Management

This skill provides structured methods for viewing and updating career profile data. All file paths are relative to the project root (the current working directory).

---

## Reading and Presenting Profile

When presenting profile data, use a compact dashboard format:

```
=== Career Dashboard ===

Role: [current role from chris.md]
Experience: [years]
Focus: [current focus areas]

Strategic Direction: [current lean from chris.md, or "Exploring"]
Active Bets:
  [bet name] — [confidence]% confidence — [last reviewed date]

Top Skills (by strategic value):
  [skill] — Level [n]/5 [trajectory]
  [skill] — Level [n]/5 [trajectory]
  [skill] — Level [n]/5 [trajectory]

Active Projects: [count]
Last Research Session: [date]
Decisions Pending Review: [count]
```

Read these files:
- `profile/chris.md` — core profile
- `profile/skill-inventory.md` — skills table
- `profile/strategic-bets.md` — strategic paths
- `profile/project-portfolio.md` — active projects

---

## Updating Profile

When updating `profile/chris.md`:
1. Ask what has changed — do not assume
2. Present the current value of the field being changed
3. Confirm the new value before writing
4. Preserve file structure and sections not being updated
5. Add a "Last updated: YYYY-MM-DD" note

---

## Skill Assessment

Use the rubric in `references/skill-assessment.md` for consistent skill evaluation.

When assessing or updating skills:
1. Show current level, trajectory, and strategic value
2. Ask for specific evidence of change (project completed, course finished, etc.)
3. Apply the rubric definitions — do not inflate levels
4. Update trajectory based on recent activity patterns
5. Recalculate strategic value if career path weights have changed

### SQLite Snapshots

When skills are updated, always offer to take a snapshot for historical tracking:

```bash
sqlite3 data/career.db "INSERT INTO skill_snapshots (date, skill, level, trajectory, strategic_value) VALUES ('$(date +%Y-%m-%d)', '<skill>', <level>, '<trajectory>', <strategic_value>);"
```

This enables trend analysis over time (e.g., "How has my TypeScript level changed over 6 months?").

---

## Strategic Bet Evaluation

When reviewing strategic bets in `profile/strategic-bets.md`:

1. Present each bet with current confidence and evidence log
2. For each bet, ask: "Is there new evidence — positive or negative?"
3. **Require specific evidence** for confidence changes:
   - "I read an article that said X" — acceptable
   - "I just feel like it's going well" — not acceptable, probe for specifics
4. Update the evidence log with date, evidence, and impact on confidence
5. Recalculate confidence percentage based on cumulative evidence

### Evidence Quality Check
- Is the evidence specific and verifiable?
- Is it from a credible source?
- Does it actually relate to the strategic path, not just the topic in general?
- Is it new information, or a restatement of existing evidence?

---

## Project Portfolio

When updating `profile/project-portfolio.md`:
1. Check if any projects have been completed, paused, or started
2. Update strategic alignment if career direction has shifted
3. Note how each project contributes to skill development
