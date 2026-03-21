# homelab-context

Claude Code plugin providing infrastructure knowledge, deployment commands, and architecture guidance for a Docker-based homelab running on an N100 Debian host.

## Install

```bash
claude plugin add --from christophorusdou/claude-plugins --name homelab-context
```

## What's Included

### Skills (auto-triggered by Claude)
- **homelab-infra** — Detailed reference for Docker stacks, SSH, Forgejo CI, Caddy routing, deployments, and backups
- **homelab-architect** — Resource catalog and decision trees for planning where to deploy new services

### Commands (user-invocable)
- `/deploy-stack <name>` — Deploy or restart a Docker Compose stack on the N100
- `/backup-truenas` — Run TrueNAS backup with optional WoL wake and auto-shutdown
- `/new-service <name>` — Scaffold a new service (compose, Caddy, tunnel, database)
- `/audit-plugin` — Check plugin docs against live infrastructure for drift

### Agent
- **infra-reviewer** — Reviews compose files, Caddyfile, and workflows for common homelab mistakes

### Hooks
- **block-secrets-edit** (PreToolUse) — Blocks edits to `.env`, credentials, and secrets files
- **validate-compose** (PostToolUse) — Validates Docker Compose YAML syntax after edits
- **remind-plugin-audit** (PostToolUse) — Reminds to run `/audit-plugin` when infra files change

## Infrastructure Overview

- **N100** (always-on): 10 Docker stacks, Postgres 16, Redis 7.4, Forgejo Git/CI
- **Mac Mini M4** (8pm-8am sleep): Prometheus, Grafana, Uptime Kuma, macOS CI runner
- **TrueNAS** (on-demand WoL): 21TB RAIDZ1, backups, media storage
- **L40S Remote** (shared GPU): NVIDIA L40S 48GB, Ollama, TTS/STT, ML training
- **Tailscale**: Subnet router on N100 for full LAN access from anywhere
