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
