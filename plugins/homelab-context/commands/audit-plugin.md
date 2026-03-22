---
name: audit-plugin
description: Audit homelab plugin docs against live infrastructure for drift detection
disable-model-invocation: true
---

# Audit Plugin for Drift

Systematically compare what the homelab-context plugin documents against the actual infrastructure state. Report any discrepancies so they can be fixed.

## Audit Steps

Perform each audit below. For each, read the source of truth and compare against the plugin reference. Collect all findings before reporting.

### 1. Stack Audit

**Source of truth:** All `docker-compose/**/docker-compose.yml` files (use Glob)
**Compare against:**
- `plugins/homelab-context/skills/homelab-infra/references/stacks.md` — each compose file should have a corresponding stack section
- `plugins/homelab-context/CLAUDE.md` — stack list and count
- `plugins/homelab-context/skills/homelab-infra/SKILL.md` — stack count in architecture overview
- `plugins/homelab-context/commands/deploy-stack.md` — stack mapping table

Flag: missing stacks, wrong stack counts, stale stack paths.

### 2. Domain Audit

**Source of truth:** `docker-compose/networking/ingress/Caddyfile` (read it, extract `host` matchers)
**Compare against:**
- `plugins/homelab-context/CLAUDE.md` — domains table
- `plugins/homelab-context/skills/homelab-infra/references/stacks.md` — Caddy route table

Flag: domains in Caddyfile not in plugin docs, or vice versa.

### 3. Database Audit

**Source of truth:** `docker-compose/shared/docker-compose.yml` — look at db-init service or init SQL for database names
**Compare against:**
- `plugins/homelab-context/skills/homelab-infra/references/stacks.md` — database table

Flag: databases created but not documented, or documented but no longer created.

### 4. Architecture Audit

**Source of truth:** `docs/l40s.md` for L40S details, `docs/mac-mini-server.md` for Mac Mini
**Compare against:**
- `plugins/homelab-context/skills/homelab-architect/SKILL.md` — resource catalog table and L40S details section

Flag: running services, ports, or capabilities that have changed.

### 5. Deployment Pattern Audit

**Source of truth:** All compose files — look for patterns not covered in deployment-patterns.md
**Compare against:**
- `plugins/homelab-context/skills/homelab-architect/references/deployment-patterns.md`

Flag: new deployment patterns (e.g., new auth methods, new storage patterns) not yet documented.

### 6. Credential Audit

**Source of truth:** Check CLAUDE.md global instructions and memory for keychain entries
**Compare against:**
- `plugins/homelab-context/CLAUDE.md` — credentials section

Flag: known keychain entries not documented in the plugin.

### 7. Cross-Project Audit

**Source of truth:** `plugins/homelab-context/hooks/project-map.json` — all entries under `"projects"`

For each project key in `project-map.json`, check whether the project directory exists locally. Search these parent directories in order:
- `/Volumes/d50-970p-1t/projects/<project-name>/`
- `~/projects/<project-name>/`

For each project directory that exists, perform the following checks:

**Port check:**
- Find all `docker-compose*.yml` and `docker-compose*.yaml` files in the project directory (use Glob).
- In each file, look for `ports:` mappings. Extract the host-side port (the value before `:` in a `"HOST:CONTAINER"` mapping, or the sole value for container-only mappings).
- Compare against the `"port"` value in `project-map.json` for that project.
- Flag as WARNING if no port mapping matches the documented port (the container port in a HOST:CONTAINER pair is also acceptable as a match).

**Database check:**
- In each docker-compose file, look for `DATABASE_URL`, `DB_NAME`, `POSTGRES_DB`, or similar environment variable patterns that name a database.
- Extract the database name from the value (e.g., from `postgres://user:pass@host/dbname`, extract `dbname`).
- Compare against the `"database"` value in `project-map.json` for that project.
- If `"database"` is `null` in `project-map.json`, verify no database env var is present (or note it as INFO if one appears).
- Flag as WARNING if the database name does not match.

**CI pattern check:**
- Check whether `.forgejo/workflows/` exists in the project directory.
- If it does, list the workflow files and read each one. Look for patterns not covered in `plugins/homelab-context/skills/homelab-infra/references/forgejo-ci.md`:
  - Non-standard trigger events (anything other than `push` and `pull_request`)
  - Use of external services (e.g., `services:` block with images not listed in forgejo-ci.md)
  - Deployment targets other than N100 (e.g., SSH to a different IP)
- Flag as INFO for any CI patterns not documented in forgejo-ci.md.

For projects whose directory is not found in either search location, report as INFO (not an error — the project may live on a remote host only).

### 8. Self-Consistency

Check that the plugin's own documentation is internally consistent. These checks do not require reading live infrastructure — only plugin files.

**Compose directories vs stacks.md:**
- Use Glob to list all `docker-compose/**/docker-compose.yml` files in the homelab repo (relative to the repo root, e.g., `~/homelab/`).
- For each compose directory found, check that `plugins/homelab-context/skills/homelab-infra/references/stacks.md` contains a section for that stack.
- For each stack section in `stacks.md`, check that a corresponding compose directory exists.
- Flag as ERROR for any mismatch in either direction.

**CLAUDE.md domains vs stacks.md Caddy route table:**
- Read the domains table from `plugins/homelab-context/CLAUDE.md` (the `## Domains` section).
- Read the Caddy Route Table from `plugins/homelab-context/skills/homelab-infra/references/stacks.md` (the `## Caddy Route Table` section).
- Every domain in CLAUDE.md (except `pointing.cdrift.com`, which is Cloudflare Pages and has no Caddy route) should have a matching row in the Caddy Route Table.
- Every domain in the Caddy Route Table should appear in CLAUDE.md.
- Flag as ERROR for any domain present in one but absent from the other.

**project-map.json vs stacks.md:**
- Read all project keys from `plugins/homelab-context/hooks/project-map.json` (the `"projects"` object).
- For each project, confirm that a stack section exists in `stacks.md` matching the `"stack"` value for that project entry.
- Flag as ERROR for any project in `project-map.json` whose stack is not documented in `stacks.md`.
- Flag as WARNING for any stack in `stacks.md` that serves an application (i.e., has a domain or database) but is absent from `project-map.json`. Infra stacks (shared, auth, ingress, forgejo, homepage, monitoring) are exempt from this check.

**Database count cross-check:**
- Count the databases listed in the `## Database Table` section of `stacks.md`.
- Count the databases listed in the `db-init creates:` line in the Shared Stack section of `stacks.md`.
- Count the databases mentioned in the `## Shared Services` section of `plugins/homelab-context/CLAUDE.md` (the parenthetical after "Postgres 16:").
- All three counts must match.
- Flag as ERROR if any count differs from the others.

## Output Format

Present findings as a drift report:

```
## Plugin Drift Report

### No Issues Found
- [list categories with no drift]

### Issues Found

#### [Category] — [Severity: Error/Warning/Info]
- **What:** [description of the drift]
- **Source:** [file:line where the truth lives]
- **Plugin:** [file:line where the plugin is wrong/missing]
- **Fix:** [specific change needed]
```

If no drift is found in any category, report: "All plugin docs are in sync with infrastructure. No updates needed."

## Notes

- This command is read-only — it does NOT modify any files
- After reviewing the report, the user can make fixes manually or ask Claude to apply them
- Run this periodically (e.g., after adding a new service or changing infrastructure)
