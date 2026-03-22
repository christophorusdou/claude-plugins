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

The homelab runs a **10-stack Docker deployment** on the N100 (Debian 13, 192.168.130.160), with a separate monitoring stack on the Mac Mini M4 (192.168.130.170).

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
- L40S: `ssh l40s` (aitin)
- All shortcuts work remotely via Tailscale subnet route (no config changes needed)

### Tailscale Remote Access
- N100 Tailscale IP: 100.72.109.30
- Subnet router: 192.168.130.0/24 (full LAN access from anywhere)
- Exit node: enabled (opt-in per client)
- Config: `tailscale up --advertise-routes=192.168.130.0/24 --advertise-exit-node --accept-dns=false`

### Forgejo Git Access (SSH)

All repos use the `forgejo-git:` SSH alias for git operations. **Never use HTTPS URLs or embed tokens in git remote URLs.**

**SSH config** (`~/.ssh/config`):
```
Host forgejo-git
  HostName 192.168.130.160
  Port 2222
  User git
  IdentityFile ~/.ssh/id_ed25519_homelab
```

**Convention for git remotes:**
- Remote name: `forgejo` (or `origin` if Forgejo is the only remote)
- URL format: `forgejo-git:chris/<repo>.git`
- Example: `git remote add forgejo forgejo-git:chris/my-repo.git`

**Creating a new Forgejo repo:**
```bash
curl -s -H "Authorization: token $(forgejo-token)" \
  -H "Content-Type: application/json" \
  -X POST "https://git.cdrift.com/api/v1/user/repos" \
  -d '{"name":"<repo-name>","private":true}'
git remote add forgejo forgejo-git:chris/<repo-name>.git
git push forgejo main
```

**SSH keys on Forgejo:**
- `mac-homelab` — ed25519 key (`~/.ssh/id_ed25519_homelab`) — used by `forgejo-git:` alias
- `mac-work-rsa` — RSA key (`~/.ssh/id_rsa`) — fallback for raw SSH URLs

**Note:** `git.cdrift.com:2222` does NOT work — Cloudflare doesn't proxy SSH. Always use the LAN IP (`192.168.130.160`) via the `forgejo-git:` alias, which works on LAN directly. Tailscale access to port 2222 is not currently configured.

### Forgejo API
- Token in macOS Keychain: service `forgejo-api`, account `chris`
- Shell helper: `forgejo-token` (defined in ~/.zshenv)
- Usage: `curl -H "Authorization: token $(forgejo-token)" https://git.cdrift.com/api/v1/...`

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
