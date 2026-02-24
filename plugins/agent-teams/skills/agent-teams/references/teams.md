# Agent Teams — Quick Reference

## Team Overview

| Team | Triggers | Phases | Key Checkpoints |
|------|----------|--------|-----------------|
| Feature | "build", "add", "implement", "create" | Explore → Architect → Implement → Verify | Every phase |
| Review | "review", PR context, diffs | Parallel Review → Fix → Final Verify | Every phase |
| Research | "how does", "explain", questions | Explore → Synthesize → Deep Dive | After Phase 1 and 3 |
| Debug | "bug", "failing", "broken", "error" | Reproduce → Investigate → Diagnose → Fix | After Phase 3 and 4 |
| Maintenance | "update deps", "refactor", "tech debt" | Audit → Plan → Execute → Verify | After Phase 2 and 4 |
| Architect | "rethink", "redesign", "step back" | Retrospective → Root Cause → Alternatives → Spec → Plan | After Phase 3 and 5 |

---

## Feature Team

**Purpose:** Build new features with full codebase understanding.

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| 1. Explore | 2-3 Explore agents | Parallel |
| 2. Architect | 1 Plan agent | Sequential |
| 3. Implement | Code-writing agents | Parallel (worktrees) for independent files |
| 4. Verify | Test runner + code-reviewer | Parallel |

**Key agent types:** `Explore`, `Plan`, `Bash`, `feature-dev:code-reviewer`

---

## Review Team

**Purpose:** Thorough multi-perspective code review.

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| 1. Parallel Review | 3-4 specialized reviewers | Parallel |
| 2. Fix Preparation | Code-writing agents | Sequential by severity |
| 3. Final Verification | Re-reviewer + test suite | Parallel |

**Key agent types:** `feature-dev:code-reviewer`, `Explore`, `Bash`

**Confidence threshold:** Only report findings at >= 80% confidence.

---

## Research Team

**Purpose:** Multi-source research with synthesis.

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| 1. Parallel Exploration | 2-3 search agents | Parallel |
| 2. Synthesize | Consolidation | Sequential |
| 3. Deep Dive | Focused follow-up agents | As needed |

**Key agent types:** `Explore`, `general-purpose`

**MCP integration:** Use Context7 for library documentation lookups.

---

## Debug Team

**Purpose:** Systematic bug diagnosis and TDD-based fix.

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| 1. Reproduce | Verify failure | Sequential |
| 2. Investigate | 3-4 investigators | Parallel |
| 3. Diagnose | Synthesize root cause | Sequential |
| 4. Fix | TDD: failing test → fix → verify | Sequential |

**Key agent types:** `Explore`, `Bash`

**Fix approach:** Always write a failing test before implementing the fix.

---

## Maintenance Team

**Purpose:** Dependency updates, refactoring, tech debt reduction.

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| 1. Audit | 2-3 audit agents | Parallel |
| 2. Plan | Prioritization | Sequential |
| 3. Execute | Batched changes | Parallel (independent batches) |
| 4. Verify | Test suite + diff review | Parallel |

**Key agent types:** `Bash`, `Explore`, `feature-dev:code-reviewer`

**Batch strategy:** Group independent changes for parallel execution; sequence dependent ones.

---

## Architect Team

**Purpose:** Step back and rethink the approach when stuck.

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| 1. Retrospective | Analyze history | Sequential |
| 2. Root Cause Analysis | 3-4 analysis agents | Parallel |
| 3. Alternative Designs | Propose approaches | Sequential |
| 4. Design Specification | Detail chosen approach | Sequential |
| 5. Implementation Plan | Break into steps | Sequential |

**Key agent types:** `Explore`, `Plan`

**Trigger signals:** Repeated failures, "keeps breaking", "tried everything", circular debugging.

---

## Auto-Detection Priority

```
1. Explicit argument       → Direct match
2. Request keywords        → Keyword table lookup
3. Git state              → PR branch → Review; new branch → Feature; test failures → Debug
4. Conversation context   → Repeated failures → Architect; questions → Research
5. Ambiguous              → Present top 2 candidates, let user choose
```

---

## Checkpoint Template

```
## [Team] — Phase N: [Phase Name] Complete

### Findings
- What agents discovered/did

### Decisions Needed (if any)
- Questions requiring human judgment

### Recommendation
Suggested next phase and reasoning.

### Options
→ Continue to Phase N+1: [name]
→ Adjust scope / re-run this phase
→ Switch to a different team
→ Abort
```
