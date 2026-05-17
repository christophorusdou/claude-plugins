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
- N100: `ssh n100` (root) — primary TS gateway
- Pi 4 HA gateway: `ssh pi4-ha` (chris)
- TrueNAS: `ssh truenas` (chris)
- L40S: `ssh l40s` (aitin)
- All shortcuts work remotely via Tailscale (use `*.tail15b3e4.ts.net` as `HostName` in `~/.ssh/config` for off-LAN reachability — direct WireGuard P2P on-LAN, DERP fallback elsewhere)

### Tailscale Remote Access — HA pair (May 2026)
- **n100** (`100.72.109.30`, TS 1.96.4) — primary subnet router + exit node
- **pi4-ha** (`100.122.158.33`, TS 1.98.2) — secondary subnet router + exit node (warm standby)
- Both advertise `192.168.130.0/24` + `0.0.0.0/0` + `::/0`; key expiry disabled on both
- Sticky failover (~45s); when primary fails, secondary takes over and keeps role until *it* fails
- Tailnet suffix: `tail15b3e4.ts.net`
- Config (both, identical flag set — no `--accept-routes`): `tailscale up --advertise-routes=192.168.130.0/24 --advertise-exit-node --accept-dns=false`
- Pi 4 connects via RG-E5 LAN port (n100 has no spare NICs). UDP GRO tuning persisted via `/etc/networkd-dispatcher/routable.d/50-tailscale.sh` on Pi for ~2x exit-node throughput.

**Authoritative route state via API (older CLI clients show stale data):**
```bash
TOKEN=$(security find-generic-password -s tailscale-api -a chris -w)
curl -sH "Authorization: Bearer $TOKEN" https://api.tailscale.com/api/v2/tailnet/-/devices | jq '.devices[] | {hostname, id, nodeId}'
curl -sH "Authorization: Bearer $TOKEN" https://api.tailscale.com/api/v2/device/{id}/routes
```

**Critical gotcha — subnet routers must NOT use `--accept-routes`:** If a subnet router accepts the tailnet-advertised `/24` for its own LAN, the kernel picks `tailscale0` over `eth0` for reply traffic → asymmetric routing → ICMP/SSH from other LAN hosts silently times out (request arrives on eth0, reply goes out tailscale0). Diagnostic: `tcpdump -i any -nn icmp` on the router shows mismatched `In`/`Out` interfaces. Fix: `tailscale set --accept-routes=false`. IPv6 link-local works as a side-channel diagnostic — if v6 link-local works but v4 LAN doesn't, suspect this exact bug.

### Forgejo API
- Token in macOS Keychain: service `forgejo-api`, account `chris`
- Shell helper: `forgejo-token` (defined in ~/.zshenv)
- Usage: `curl -H "Authorization: token $(forgejo-token)" https://git.cdrift.com/api/v1/...`

### Cloudflare API
- Token in macOS Keychain: service `cloudflare-api`, account `chris`
- Usage: `curl -H "Authorization: Bearer $(security find-generic-password -s cloudflare-api -a chris -w)" https://api.cloudflare.com/client/v4/...`
- Verify token: `curl -H "Authorization: Bearer ..." https://api.cloudflare.com/client/v4/user/tokens/verify`
- Same token is mirrored in Forgejo Actions secrets (`CLOUDFLARE_API_TOKEN` on `chris/blog` and `chris/ticket-pointing`) for `wrangler deploy` to Cloudflare Pages — rotate all three together.

### Stack Management
- Deploy/restart: `ssh n100 "cd <stack-path> && docker compose pull && docker compose up -d"`
- View logs: `ssh n100 "cd <stack-path> && docker compose logs -f <service>"`
- Status: `ssh n100 "cd <stack-path> && docker compose ps"`

### Caddy Reload (after Caddyfile changes)
```bash
ssh n100 "cd /opt/apps/ingress && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
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
