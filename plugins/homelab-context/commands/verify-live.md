---
name: verify-live
description: Verify homelab plugin docs against live running state via SSH to N100
disable-model-invocation: true
---

# Verify Live State

Compare what the homelab-context plugin documents against what is actually running on the N100. Requires `ssh n100` to work from your current machine.

## Prerequisites

This command SSHes to the N100 (192.168.130.160). Before proceeding, confirm connectivity:

```bash
ssh n100 "echo ok"
```

If that fails, stop and report: "Cannot reach N100 via SSH. Ensure you are on the LAN or connected via Tailscale."

## Checks to Perform

Run all four checks, collect findings, then produce a single drift report.

### Check 1: Running Containers vs Documented Stacks

Run on N100:

```bash
ssh n100 "docker ps --format '{{.Names}} {{.Image}} {{.Ports}} {{.Status}}'"
```

Compare the output against the stack documentation in `plugins/homelab-context/skills/homelab-infra/references/stacks.md`.

**Flag:**
- ERROR: A stack is documented but has no running containers (service is down or missing)
- ERROR: A container is running with no corresponding stack documentation
- WARNING: Container image tag differs from what is documented
- WARNING: A container shows a non-healthy or restarting status
- INFO: Container is running and matches documentation

Documented stacks (10 total): shared, auth, ingress, forgejo, ticket-pointing, record-keeper, tolgee, claude-dash, homepage, vidarchive

### Check 2: Databases vs Documented

Run on N100:

```bash
ssh n100 "docker exec shared-postgres-1 psql -U postgres -c '\l' --no-align"
```

Compare the list of databases against the six documented databases: `ticket_pointing`, `zitadel`, `forgejo`, `record_keeper`, `tolgee`, `claude_dash`.

**Flag:**
- ERROR: A documented database is missing from Postgres
- WARNING: A database exists in Postgres that is not documented
- INFO: All documented databases are present

### Check 3: Caddy Routes vs Documented Domains

Run on N100:

```bash
ssh n100 "cat ~/homelab/docker-compose/networking/ingress/Caddyfile"
```

Extract all host matchers (lines like `pointingapi.cdrift.com { ... }`) and compare against the domains table in `plugins/homelab-context/CLAUDE.md`.

Documented domains (7 total):
- pointing.cdrift.com (Cloudflare Pages — no Caddy route expected)
- pointingapi.cdrift.com → server:3001
- auth.cdrift.com → zitadel:8080
- git.cdrift.com → forgejo:3000
- vault.cdrift.com → recordkeeper:8080
- tolgee.cdrift.com → tolgee:8080
- vidarchive.cdrift.com → vidarchive:5000

**Flag:**
- ERROR: A documented domain (except pointing.cdrift.com) has no Caddy route
- WARNING: A Caddy route exists for a domain not in the plugin docs
- WARNING: A route's upstream port or service name differs from documentation
- INFO: All documented routes are present and correct

### Check 4: Shared Network Members

Run on N100:

```bash
ssh n100 "docker network inspect shared --format '{{range .Containers}}{{.Name}} {{end}}'"
```

Verify that all service containers from the shared, auth, ingress, forgejo, ticket-pointing, record-keeper, tolgee, claude-dash, homepage, and vidarchive stacks are connected to the `shared` Docker network.

**Flag:**
- ERROR: A documented service container is not on the shared network
- WARNING: An unrecognized container is on the shared network
- INFO: All expected containers are connected

## Output Format

Present all findings as a single drift report after running all four checks:

```
## Live State Drift Report
Generated: [timestamp from `date` on N100]

### Summary
- Checks run: 4
- Errors: N
- Warnings: N
- Info: N

### Check 1: Running Containers
[ERROR/WARNING/INFO items, or "All containers running as documented."]

### Check 2: Databases
[ERROR/WARNING/INFO items, or "All 6 databases present."]

### Check 3: Caddy Routes
[ERROR/WARNING/INFO items, or "All routes match documentation."]

### Check 4: Shared Network
[ERROR/WARNING/INFO items, or "All containers on shared network."]

### Recommended Actions
[List only if errors or warnings exist. One line per issue with a concrete fix suggestion.]
```

If no drift is found across all checks, report: "Live state matches plugin documentation. No drift detected."

## Notes

- This command is read-only — it does NOT modify any files or containers
- ERROR items mean the plugin docs or the live infrastructure need to be updated
- WARNING items may indicate stale docs or unexpected additions worth reviewing
- After reviewing, use `/audit-plugin` to check file-level doc drift, or ask Claude to apply fixes
