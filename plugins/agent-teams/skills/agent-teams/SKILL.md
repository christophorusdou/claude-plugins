---
name: agent-teams
description: This skill should be used when the user invokes "/agent-teams", says "assemble a team", or when the task clearly maps to a team workflow — building features, reviewing code, researching questions, debugging failures, maintaining dependencies, or rethinking architecture. Activates on keywords like "build", "add", "implement", "create", "review", "how does", "explain", "bug", "failing", "broken", "error", "not working", "update deps", "refactor", "tech debt", "clean up", "upgrade", "rethink", "redesign", "step back", "keeps breaking", "tried multiple times", "before we continue".
version: 1.0.0
---

# Agent Teams

Assemble and coordinate specialized agent teams for complex tasks. Each team runs through defined phases with mandatory human checkpoints between them.

**Announce at start:** "Using agent-teams to assemble a [Team Name] team."

For a quick-reference summary of all teams, see `references/teams.md` in this skill's directory.

## Auto-Detection

Determine which team to assemble. Check in priority order:

### 1. Explicit Argument
If the user specified a team name (`feature`, `review`, `research`, `debug`, `maintain`, `architect`), use it directly.

### 2. Request Keywords

| Keywords | Team |
|----------|------|
| "build", "add", "implement", "create", new feature requests | Feature |
| "review", PR context, diff present, pre-merge | Review |
| "how does", "what's the best", "explain", questions, learning | Research |
| "bug", "failing", "broken", "error", "not working", test failures | Debug |
| "update deps", "refactor", "tech debt", "clean up", "upgrade" | Maintenance |
| "rethink", "redesign", "step back", "keeps breaking", "tried multiple times", "before we continue" | Architect |

### 3. Git State
- PR branch with changes → **Review**
- New branch with no commits → **Feature**
- Test failures in recent output → **Debug**

### 4. Conversation Context
- Repeated failed attempts at the same problem → **Architect**
- Question format without action intent → **Research**

### 5. Ambiguous
If unclear, present the top 2 candidates with reasoning and let the user choose. Do not guess.

## Team Execution

Each team follows its phase sequence with **mandatory checkpoints at key decision points** — marked with "CHECKPOINT" in each team's definition. Never skip past a checkpoint without user approval.

### Checkpoint Format

At each checkpoint, present:

```
## [Team Name] — Phase N: [Phase Name] Complete

### Findings
- Bullet summary of what agents discovered/did

### Decisions Needed (if any)
- Specific questions requiring human judgment

### Recommendation
What I suggest for the next phase and why.

### Options
→ Continue to Phase N+1: [phase name]
→ Adjust scope / re-run this phase
→ Switch to a different team
→ Abort
```

Wait for the user to choose before proceeding.

---

## Team 1: Feature

**When:** New features, "build", "add", "implement", "create"

### Phase 1: Explore
Launch 2-3 **Explore** agents in parallel. Each targets a different aspect:
- Similar features and patterns in the codebase
- Architecture and module boundaries relevant to the feature
- Test conventions and existing test patterns

Collect key file lists from each agent. Read the most important files to build context.

**CHECKPOINT** — present exploration findings and confirm scope before designing.

### Phase 2: Architect
Launch a **Plan** agent to design the approach based on Phase 1 findings. The plan should include:
- Files to create/modify
- Component design and data flow
- Implementation sequence
- Test strategy

**CHECKPOINT** — present the plan for approval before implementation begins.

### Phase 3: Implement
Write the code following the approved plan. For independent files, use **worktree isolation** (`isolation: "worktree"`) to avoid polluting the working directory. Use parallel Task agents for truly independent work.

**CHECKPOINT** — present what was implemented, any deviations from the plan.

### Phase 4: Verify
Launch in parallel:
- A **Bash** agent to run the test suite
- A **feature-dev:code-reviewer** agent to review the implementation

**CHECKPOINT** — present verification results.

---

## Team 2: Review

**When:** PR context, "review", diffs, pre-merge checks

### Phase 1: Parallel Review
Launch 3-4 agents in parallel:
- **feature-dev:code-reviewer** — bugs, logic errors, security, code quality (confidence >= 80)
- **Explore** agent — trace type correctness and API contract adherence
- **Explore** agent — analyze test coverage gaps and silent failure patterns

Each agent should report only findings at confidence >= 80%.

**CHECKPOINT** — present review findings, prioritized by severity.

### Phase 2: Fix Preparation
Address high-priority issues identified in Phase 1. Group by severity and fix the critical ones.

### Phase 3: Final Verification
- Re-run **feature-dev:code-reviewer** on the modified code
- Run the full test suite via **Bash**

**CHECKPOINT** — present clean/remaining issues.

---

## Team 3: Research

**When:** Questions, "how does", "what's the best", "explain", learning context

### Phase 1: Parallel Exploration
Launch 2-3 agents in parallel:
- **Explore** agent — search codebase for relevant patterns, implementations, and usage
- **general-purpose** agent — search documentation via Context7 MCP if a library is involved
- **general-purpose** agent — web search for broader context if needed

**CHECKPOINT** — present consolidated findings from all sources.

### Phase 2: Synthesize
Consolidate all findings. Identify:
- Points of consensus across sources
- Conflicts or contradictions
- Gaps that need deeper investigation

Present a structured summary.

### Phase 3: Deep Dive
Follow up on the most relevant threads from Phase 2. Launch focused agents for the specific areas the user wants to explore further.

**CHECKPOINT** — present final synthesis.

---

## Team 4: Debug

**When:** "bug", "failing", "broken", "error", test failures, "not working"

### Phase 1: Reproduce
Verify the failure. Run the failing test or reproduce the bug. Collect:
- Exact error output and stack traces
- Steps to reproduce
- Environment context

### Phase 2: Investigate
Launch 3-4 agents in parallel:
- **Explore** agent — trace the error origin through the code
- **Bash** agent — check recent changes via `git log` and `git blame` on affected files
- **Explore** agent — find related tests and similar past patterns
- **Explore** agent — check for similar issues in the codebase

### Phase 3: Diagnose
Synthesize investigation findings into a root cause hypothesis with evidence. Present:
- Root cause with supporting evidence
- Contributing factors
- Proposed fix approach

**CHECKPOINT** — present diagnosis and get approval before fixing.

### Phase 4: Fix
Implement the fix using TDD approach:
1. Write a failing test that captures the bug
2. Implement the fix
3. Verify the test passes
4. Run the full related test suite

**CHECKPOINT** — present fix results and test output.

---

## Team 5: Maintenance

**When:** "update deps", "refactor", "tech debt", "clean up", "upgrade"

### Phase 1: Audit
Launch 2-3 agents in parallel:
- **Bash** agent — check for outdated dependencies, security advisories
- **Explore** agent — scan for unused code, dead imports, code smells
- **Explore** agent — identify patterns that deviate from codebase conventions

### Phase 2: Plan
Prioritize changes by risk and impact. Identify:
- Safe parallel batches (independent changes)
- Sequential dependencies
- High-risk changes requiring careful review

**CHECKPOINT** — present prioritized plan for approval.

### Phase 3: Execute
Apply changes in approved batches. Use parallel agents for independent changes. Use **worktree isolation** for risky changes.

### Phase 4: Verify
- Run full test suite via **Bash**
- Launch **feature-dev:code-reviewer** to diff-review all changes

**CHECKPOINT** — present final state and verification results.

---

## Team 6: Architect

**When:** "rethink", "redesign", "step back", recurring failures, "keeps breaking", complex problems

### Phase 1: Retrospective
Analyze what's been tried and what failed. Collect:
- Error history and patterns from conversation context
- Previous approaches and why they failed
- Constraints discovered during failed attempts

### Phase 2: Root Cause Analysis
Launch 3-4 agents in parallel:
- **Explore** agent — examine architecture gaps and missing abstractions
- **Explore** agent — identify assumption violations in current design
- **Explore** agent — analyze design debt and coupling issues
- **Plan** agent — assess whether the problem is architectural vs implementation

### Phase 3: Alternative Designs
Propose 2-3 fundamentally different approaches. For each:
- Core idea and how it differs from what was tried
- Trade-offs (complexity, performance, maintainability)
- Migration path from current state
- Risk assessment

**CHECKPOINT** — present approaches for user to choose.

### Phase 4: Design Specification
Detail the chosen approach:
- Component breakdown with responsibilities
- Data flow and interfaces
- Integration points with existing code
- Error handling strategy

### Phase 5: Implementation Plan
Break into ordered steps with dependencies. Each step should be small enough for a single agent batch. Include verification criteria for each step.

**CHECKPOINT** — approve plan before any implementation begins.

---

## Safety Rules

- **No destructive actions** without explicit user approval (force push, delete branches, drop tables)
- **Worktree isolation** for implementation phases — never write directly to working directory during parallel implementation
- **Checkpoints are mandatory** — agents must not skip ahead
- **Confidence thresholds** — review agents only report findings at >= 80% confidence
- **Scope constraints** — each dispatched agent gets a narrow, specific scope; prevent agents from making changes outside their assigned area
