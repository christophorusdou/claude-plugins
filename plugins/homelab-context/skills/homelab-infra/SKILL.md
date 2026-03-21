---
name: homelab-infra
description: >
  Use when working with homelab infrastructure — Docker stacks, SSH,
  Forgejo CI, Caddy routing, deployments, backups, or adding new services
  to the N100 Docker host.
user-invocable: false
---

# Homelab Infrastructure Reference

This skill provides detailed reference for working on homelab infrastructure.

## Architecture Overview

The homelab runs a **7-stack Docker deployment** on the N100 (Debian 13, 192.168.130.160), with a separate monitoring stack on the Mac Mini M4 (192.168.130.170).

All stacks connect via the `shared` Docker network. Services communicate by hostname (e.g., `postgres`, `redis`, `zitadel`, `forgejo`).

## Deployment Order

1. Create shared network: `docker network create shared`
2. **shared** — Postgres, Redis, backup, watchtower (run `--profile init` for first deploy)
3. **auth** — Zitadel OIDC (depends on shared Postgres)
4. **ingress** — Caddy + Cloudflared (depends on caddy being able to reach services)
5. **Apps** (any order): forgejo, tolgee, ticket-pointing, record-keeper, claude-dash, homepage

## Detailed References

- **[stacks.md](references/stacks.md)** — Full details for every stack: services, images, ports, databases, environment variables, Caddy routes
- **[forgejo-ci.md](references/forgejo-ci.md)** — Forgejo Actions CI/CD: workflow patterns, runner labels, container registry, critical gotchas
- **[new-service.md](references/new-service.md)** — Step-by-step checklist for adding a new service to the homelab

## Quick Reference

### SSH Access
- N100: `ssh n100` (root)
- Mac Mini: `ssh mac-mini-server` (chris)
- TrueNAS: `ssh truenas` (chris)

### Stack Management
- Deploy/restart: `ssh n100 "cd <stack-path> && docker compose pull && docker compose up -d"`
- View logs: `ssh n100 "cd <stack-path> && docker compose logs -f <service>"`
- Status: `ssh n100 "cd <stack-path> && docker compose ps"`

### Caddy Reload (after Caddyfile changes)
```bash
ssh n100 "cd ~/homelab/docker-compose/networking/ingress && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
```

### Backup
```bash
ssh n100 /opt/apps/backup-all-to-truenas.sh --wol          # Wake TrueNAS, backup, shutdown
ssh n100 /opt/apps/backup-all-to-truenas.sh --wol --no-shutdown  # Keep TrueNAS on
```
