---
name: homelab-infra
description: >
  Use when working with homelab infrastructure, N100 Docker host, Forgejo
  git/CI, Caddy reverse proxy, Cloudflare Tunnel, Tailscale VPN, TrueNAS
  backups, Postgres, Redis, Zitadel auth, Ollama, or any *.cdrift.com
  service. Triggers on: "N100", "Forgejo", "git.cdrift.com", "Caddy",
  "Caddyfile", "docker-compose", "deploy", "SSH n100", "SSH l40s",
  "push to Forgejo", "backup", "CI workflow", ".forgejo/workflows",
  "container registry", "192.168.130", "cdrift.com", "shared network",
  "Docker stack", "restart service", "connect to homelab", "access
  Forgejo", "Forgejo API", "Forgejo runner", or editing infrastructure
  files (compose, Caddyfile, workflow YAML).
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

### L40S Ollama + Caddy TLS Proxy

The L40S (150.1.8.167) runs Ollama on :11434, exposed via Caddy HTTPS reverse proxy on :11435.

**Caddyfile** (`/etc/caddy/Caddyfile` on L40S):
```
https://150.1.8.167:11435 {
    reverse_proxy localhost:11434
    tls internal
}
```

**Caddy internal PKI paths** (on L40S):
- Root CA: `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` (valid ~10 years)
- Intermediate: `.../intermediate.crt` (rotates weekly)
- Leaf cert: `.../certificates/local/150.1.8.167/150.1.8.167.crt` (rotates daily)

**If Caddy TLS fails (`tlsv1 alert internal error`):**
1. Verify Ollama is running: `ssh l40s "curl -s localhost:11434/api/tags | head -1"`
2. Test Caddy TLS: `ssh l40s "curl -vk https://150.1.8.167:11435/api/tags"` (must use IP, not localhost — SNI must match)
3. If TLS broken, restart Caddy: `ssh l40s "sudo systemctl restart caddy"`
4. If still broken after restart, nuke PKI and regenerate:
   ```bash
   ssh l40s "sudo systemctl stop caddy && sudo rm -rf /var/lib/caddy/.local/share/caddy/certificates /var/lib/caddy/.local/share/caddy/pki && sudo systemctl start caddy"
   ```
5. After PKI regeneration, update the root CA in any client that pins it:
   ```bash
   ssh l40s 'sudo cat /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt' > /path/to/project/certs/ollama-ca.crt
   ```
6. Recreate containers that mount the cert (restart alone won't pick up changed bind mount content in all cases)

**Gotcha:** Nuking Caddy PKI regenerates the root CA with a new serial number. All clients pinning the old root CA will get `certificate verify failed` until updated.

**VPN dependency:** The L40S is on a remote network (150.1.8.0/24). Services that call Ollama (e.g., Opportunity Radar on N100) require VPN connectivity. If VPN drops, Ollama calls timeout after 120s per request.

### Backup
```bash
ssh n100 /opt/apps/backup-all-to-truenas.sh --wol          # Wake TrueNAS, backup, shutdown
ssh n100 /opt/apps/backup-all-to-truenas.sh --wol --no-shutdown  # Keep TrueNAS on
```
