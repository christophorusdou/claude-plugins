# project-awareness

Claude Code plugin that auto-generates a project catalog on session start, giving Claude cross-project awareness across all `~/projects/` repositories.

## How It Works

A `SessionStart` hook runs `scan-projects.sh` which:

1. Scans every directory in `/Volumes/d50-970p-1t/projects/`
2. Extracts metadata: descriptions (from CLAUDE.md, package.json, go.mod), tech stack, git remote origin, Docker Compose ports/databases
3. Classifies projects as **own** (remote contains "chris") or **reference/forked**
4. Generates `/Volumes/d50-970p-1t/projects/CLAUDE.md` — a structured project catalog

Claude Code's parent-directory CLAUDE.md inheritance makes this catalog automatically available in every child project session. No database, no runtime overhead after generation.

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Projects directory | `/Volumes/d50-970p-1t/projects` | `scan-projects.sh` line 4 |
| Cache TTL | 300 seconds (5 min) | `scan-projects.sh` line 6 |
| Hook trigger | `startup` only | `hooks/hooks.json` |
| Hook timeout | 5000ms | `hooks/hooks.json` |

The script skips regeneration if the output file is less than 5 minutes old. This prevents redundant scans on rapid session starts while ensuring fresh data for new sessions.

## Generated Catalog Structure

The output CLAUDE.md (~100 lines) contains:

- **My Projects** — name, description, tech stack (Go, TS, Py, JS, Rust)
- **Reference / Forked** — name, upstream source, tech stack
- **Infrastructure** — shared services, databases, port allocations

## Design Decisions

- **No database** — the CLAUDE.md file IS the catalog. Claude Code reads it natively.
- **Atomic writes** — uses temp file + `mv` to prevent truncated output if the hook times out.
- **YAML comment awareness** — `grep -v '^\s*#'` filters commented-out ports/databases.
- **YAML list item requirement** — port extraction requires `- ` prefix to avoid matching URLs or model names containing `number:number` patterns.
- **Pipe sanitization** — `|` in descriptions is replaced with `-` to prevent markdown table breakage.
- **Subdirectory tsconfig detection** — checks `web/`, `frontend/`, `client/`, `app/` for TypeScript in monorepos.

## Performance

~0.6-1.0s for 57 projects. Main cost is `git -C` calls (~one per project with a `.git` directory).
