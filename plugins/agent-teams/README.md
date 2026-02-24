# agent-teams

Automated agent team assembly and coordination for Claude Code.

## Installation

```bash
claude plugins add /path/to/agent-teams
```

Or for development/testing:

```bash
claude --plugin-dir ~/.claude/plugins/agent-teams
```

## Usage

The skill auto-detects the appropriate team from context, or you can specify explicitly:

```
/agent-teams feature   — Build a new feature
/agent-teams review    — Multi-perspective code review
/agent-teams research  — Research with synthesis
/agent-teams debug     — Systematic debugging
/agent-teams maintain  — Dependency updates and refactoring
/agent-teams architect — Rethink the approach
```

## Teams

| Team | Purpose | Phases |
|------|---------|--------|
| Feature | Build new features | Explore → Architect → Implement → Verify |
| Review | Thorough code review | Parallel Review → Fix → Final Verify |
| Research | Multi-source research | Explore → Synthesize → Deep Dive |
| Debug | Systematic debugging | Reproduce → Investigate → Diagnose → Fix |
| Maintenance | Deps and tech debt | Audit → Plan → Execute → Verify |
| Architect | Rethink architecture | Retrospective → Root Cause → Alternatives → Spec → Plan |

Each phase ends with a checkpoint where you choose how to proceed.

See `skills/agent-teams/references/teams.md` for full reference.
