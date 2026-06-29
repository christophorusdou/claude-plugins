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
  Forgejo", "Forgejo API", "Forgejo runner", "Helix", "CloudBeaver",
  "GlobalProtect", "gp-connect", "openconnect", "vpntest", "Wood-Mizer VPN",
  or editing infrastructure
  files (compose, Caddyfile, workflow YAML).
user-invocable: false
---

# Homelab Infrastructure Reference

This skill provides detailed reference for working on homelab infrastructure.

## Architecture Overview

The homelab runs a **multi-stack Docker deployment** on the N100 (Debian 13, 192.168.130.160), with a separate monitoring stack on the Mac Mini M4 (192.168.130.170).

All stacks connect via the `shared` Docker network. Services communicate by hostname (e.g., `postgres`, `redis`, `zitadel`, `forgejo`).

Helix is the CloudBeaver SQL web client at `helix.cdrift.com`. It is an exception to the normal Caddy routing pattern: Cloudflare Access/Zitadel gates the hostname, then cloudflared routes directly to `cloudbeaver:8978` on the `shared` Docker network. This avoids a local Host-header bypass through N100's published Caddy port 80 for DB admin access.

## Deployment Order

1. Create shared network: `docker network create shared`
2. **shared** — Postgres, Redis, backup, watchtower (run `--profile init` for first deploy)
3. **auth** — Zitadel OIDC (depends on shared Postgres)
4. **ingress** — Caddy + Cloudflared (depends on caddy being able to reach services)
5. **Apps** (any order): forgejo, tolgee, ticket-pointing, record-keeper, claude-dash, homepage, vidarchive, mediavault, helix

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

### GlobalProtect VPN — Wood-Mizer corporate access (openconnect)

Access to corporate subnets (`10.10.0.0/16`, `150.1.0.0/16` incl. the **L40S at `150.1.8.167`**, etc.) goes through `vpntest.woodmizer.com` via openconnect. Full operational guide: `homelab/docs/gp-vpn.md` (+ `gp-vpn-mac.md`).

- **Working command (since 2026-06-03):**
  - N100: `sudo gp-connect-gwdirect`
  - macOS: `gp-connect-gwdirect-mac` (installed in `~/.local/bin`)
- **Why "gwdirect":** `vpntest` uses **two-stage portal→gateway SAML**. The old portal-based scripts (`gp-connect`, `gp-connect-mac.sh`) now get **HTTP 512** — the portal cookie isn't valid at the gateway. The fix authenticates directly at the gateway: SAML from `/ssl-vpn/prelogin.esp` + `--usergroup=gateway:prelogin-cookie`.
- **SAML flow:** script serves the SAML form on `:33580`; open it in a browser (remote: `ssh -L 33580:localhost:33580 n100` → `http://localhost:33580`), complete Okta, paste the callback. The HTTP server is **one-shot** — load the URL exactly once.
- **Gotchas:** N100 + Mac openconnect tunnels **coexist** (distinct sessions/IPs — not single-session; the only conflict is openconnect vs the official GlobalProtect.app on the same machine); ICMP is filtered corporate-side (test **TCP ports**, not ping); `vpn2.woodmizer.com` is **unreachable from N100**; don't hammer retries after auth failures (Palo Alto throttles the source IP). The N100 tunnel is monitored by `gp-vpn-monitor` (cron + Telegram).

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
- Token in macOS Keychain: service `forgejo-api`, account `chris` (broad scope — general API)
- Shell helper: `forgejo-token` (defined in ~/.zshenv)
- Usage: `curl -H "Authorization: token $(forgejo-token)" https://git.cdrift.com/api/v1/...`
- **Cloudflare gotcha:** `git.cdrift.com` is behind Cloudflare, which blocks non-browser User-Agents (e.g. `Python-urllib`) with HTTP 403 "error code: 1010". `curl` works; for scripts/urllib, hit Forgejo directly on the LAN at `http://192.168.130.160:3000/api/v1/...` to bypass Cloudflare.

### Forgejo CI registry token (`forgejo-ci`)
- Dedicated **package:write** token in macOS Keychain: service `forgejo-ci`, account `chris`
- Read: `security find-generic-password -s forgejo-ci -a chris -w`
- Purpose: the CI `REGISTRY_TOKEN` repo secret for pushing images to the internal registry `forgejo:3000` from `.forgejo/workflows/deploy.yml`. Reused across deploy workflows; keep it least-privilege (package scope only), separate from the broad `forgejo-api` token.
- Re-save / rotate: `security add-generic-password -U -s forgejo-ci -a chris -w` (prompts; token never hits shell history).

### Cloudflare API
- Token in macOS Keychain: service `cloudflare-api`, account `chris`
- Usage: `curl -H "Authorization: Bearer $(security find-generic-password -s cloudflare-api -a chris -w)" https://api.cloudflare.com/client/v4/...`
- Verify token: `curl -H "Authorization: Bearer ..." https://api.cloudflare.com/client/v4/user/tokens/verify`
- Same token is mirrored in Forgejo Actions secrets (`CLOUDFLARE_API_TOKEN` on `chris/blog` and `chris/ticket-pointing`) for `wrangler deploy` to Cloudflare Pages — rotate all three together.

### Stack Management
- Deploy/restart: `ssh n100 "cd <stack-path> && docker compose pull && docker compose up -d"`
- View logs: `ssh n100 "cd <stack-path> && docker compose logs -f <service>"`
- Status: `ssh n100 "cd <stack-path> && docker compose ps"`

### Helix / CloudBeaver SQL Client
- URL: `https://helix.cdrift.com`
- N100 path: `/opt/apps/helix`
- Local docs: `homelab/docs/helix/`
- Image: `dbeaver/cloudbeaver:26.0.5`
- Container: `helix-cloudbeaver`
- Docker alias: `cloudbeaver`
- Internal port: `8978`
- Host-published ports: none
- Route: Cloudflare Access/Zitadel -> cloudflared -> `http://cloudbeaver:8978` (direct, not Caddy)
- Admin password keychain service: `helix-cloudbeaver-admin`, account `chris`

Common commands:
```bash
ssh n100 "cd /opt/apps/helix && docker compose ps"
ssh n100 "cd /opt/apps/helix && docker compose logs --tail 120 cloudbeaver"
ssh n100 "cd /opt/apps/helix && docker compose restart cloudbeaver"
curl -I https://helix.cdrift.com  # should return Cloudflare Access 302 when unauthenticated
```

First-run gotcha: if the browser says `Server configuration time has expired`, restart only CloudBeaver:
```bash
ssh n100 "cd /opt/apps/helix && docker compose restart cloudbeaver"
```

### Caddy Reload (after Caddyfile changes)
```bash
ssh n100 "cd /opt/apps/ingress && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
```

### L40S Ollama + Caddy TLS Proxy

The L40S (150.1.8.167) runs Ollama on :11434, exposed via Caddy HTTPS reverse proxy on :11435.

**Caddyfile** (`/etc/caddy/Caddyfile` on L40S — as of 2026-05-22):
```
https://150.1.8.167:11435 {
    reverse_proxy localhost:11434
    tls /etc/ssl/ollama-l40s.crt /etc/ssl/ollama-l40s.key
}
```

**Cert specifics:**
- Stable self-signed ECC cert (prime256v1), 10y validity (expires 2036-05-19)
- SAN: `IP:150.1.8.167, DNS:150.1.8.167`
- Self-signed → it IS its own root; clients pin this cert as the trusted CA
- Cert+key files owned `caddy:caddy`, key mode `600`
- Backup: `truenas:/mnt/main/backup/l40s/ollama-l40s-stablecert.tar.gz`

**Why not `tls internal`?** Caddy's `tls internal` builds a private 2-tier PKI (root/intermediate/leaf) and rotates leaves daily, intermediates weekly. The root is supposed to last 10 years, but the documented "nuke PKI to fix TLS issues" recipe regenerated it on a fresh fingerprint — silently breaking every client that pinned the old root. Switching to a static self-signed cert eliminates that whole failure mode at the cost of giving up automatic rotation. Acceptable trade for this single-tenant, VPN-only endpoint. See [opportunity-radar/CLAUDE.md](../../../opportunity-radar/CLAUDE.md) "Layered failures hide each other" lesson.

**Legacy Caddy `tls internal` PKI** (no longer the source of truth, but still on disk; backup at `truenas:/mnt/main/backup/l40s/caddy-pki-*.tar.gz`):
- Root CA: `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`
- Intermediate: `.../intermediate.crt`
- Leaf cert: `.../certificates/local/150.1.8.167/150.1.8.167.crt`

**If Caddy TLS fails (`tlsv1 alert internal error` or `certificate verify failed`):**
1. Verify Ollama is running: `ssh l40s "curl -s localhost:11434/api/tags | head -1"`
2. Test Caddy TLS: `ssh l40s "curl -vk https://150.1.8.167:11435/api/tags"` (must use IP, not localhost — SNI must match)
3. If TLS broken, restart Caddy: `ssh l40s "sudo systemctl restart caddy"`
4. If client gets `x509: certificate signed by unknown authority`, the client's pinned root is stale. Refresh it:
   ```bash
   ssh l40s 'sudo cat /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt' > /path/to/project/certs/ollama-ca.crt
   ```
5. Recreate containers that mount the cert (restart alone won't pick up changed bind mount content in all cases).

**⛔ DO NOT `rm -rf` the Caddy PKI directory.** Doing so regenerates the root CA with a new fingerprint and breaks every client that pins the old root. This was the #1 source of "scans suddenly stopped working" outages (see 2026-05-21 incident). The PKI tree is backed up at `truenas:/mnt/main/backup/l40s/caddy-pki-*.tar.gz` — if it gets clobbered, **restore from backup** rather than letting Caddy regenerate:
```bash
ssh l40s 'sudo systemctl stop caddy'
scp truenas:/mnt/main/backup/l40s/caddy-pki-YYYYMMDD.tar.gz l40s:/tmp/
ssh l40s 'sudo tar xzf /tmp/caddy-pki-*.tar.gz -C /var/lib/caddy/.local/share/caddy/ && sudo chown -R caddy:caddy /var/lib/caddy/.local/share/caddy/pki && sudo systemctl start caddy'
```

If you genuinely need to regenerate the PKI (e.g., key compromise), update every client that pins the root in the same change — the radar app's `certs/ollama-ca.crt` is one of them.

**VPN dependency:** The L40S is on a remote network (150.1.8.0/24). Services that call Ollama (e.g., Opportunity Radar on N100) require VPN connectivity. If VPN drops, Ollama calls timeout after 120s per request.

### Backup
```bash
ssh n100 /opt/apps/backup-all-to-truenas.sh --wol          # Wake TrueNAS, backup, shutdown
ssh n100 /opt/apps/backup-all-to-truenas.sh --wol --no-shutdown  # Keep TrueNAS on
```
