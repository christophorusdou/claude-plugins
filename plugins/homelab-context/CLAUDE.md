# Homelab Infrastructure

## Git Platform: Forgejo (NOT GitHub)

**Forgejo at git.cdrift.com is the primary git hosting platform.** Do NOT use `gh` CLI — it only works with GitHub. Use the Forgejo REST API instead.

- **API base:** `https://git.cdrift.com/api/v1`
- **Swagger docs:** `https://git.cdrift.com/api/swagger`
- **Owner:** `chris`
- **Auth token:** stored in macOS Keychain (service: `forgejo-api`, account: `chris`)
- **Retrieve token:** `security find-generic-password -s "forgejo-api" -a "chris" -w`
- **Shell helper:** `forgejo-token` (defined in ~/.zshenv)

### You CAN do all of the following via the Forgejo API:

- **Create repos:** `POST /api/v1/user/repos` with `{"name":"...","auto_init":true,"default_branch":"main"}`
- **Create PRs:** `POST /api/v1/repos/chris/{repo}/pulls` with `{"title":"...","head":"branch","base":"main"}`
- **Create/list issues:** `POST /api/v1/repos/chris/{repo}/issues`, `GET .../issues?state=open`
- **Manage CI secrets:** `PUT /api/v1/repos/chris/{repo}/actions/secrets/{name}` with `{"data":"..."}`
- **Dispatch workflows:** `POST /api/v1/repos/chris/{repo}/actions/workflows/{file}/dispatches`
- **Search repos:** `GET /api/v1/repos/search?q=keyword`

### Auth pattern for all API calls:

```bash
curl -H "Authorization: token $(forgejo-token)" https://git.cdrift.com/api/v1/...
```

### Git remotes

- **Primary (Forgejo HTTPS):** `https://git.cdrift.com/chris/{repo}.git`
- **Primary (Forgejo SSH):** `forgejo-git:chris/{repo}.git` (SSH alias, port 2222 on N100 direct IP)
- **Mirror (GitHub):** one-way sync via Forgejo CI workflow, not a primary remote
- HTTPS credentials stored in macOS Keychain via `git credential-osxkeychain`

## Network
| Device | IP | SSH | Role |
|--------|----|-----|------|
| N100 (Debian 13) | 192.168.130.160 | `ssh n100` (root) | Primary Docker host + primary Tailscale gateway, always-on |
| Pi 4 (Ubuntu 26.04) | 192.168.130.161 | `ssh pi4-ha` (chris) | Secondary Tailscale gateway (HA standby), always-on |
| Mac Mini M4 | 192.168.130.170 | `ssh mac-mini-server` (chris) | (powered off since 2026-04-14) |
| TrueNAS | 192.168.130.230 | `ssh truenas` (chris) | Storage/backups, on-demand WoL |
| L40S Remote | 150.1.8.167 | `ssh l40s` (aitin) | GPU/ML workloads (shared server) |

**Tailscale HA:** n100 and pi4-ha both advertise `192.168.130.0/24` + exit-node. Sticky primary failover (~45s detection). Tailnet suffix: `tail15b3e4.ts.net` — prefer `Host*.tail15b3e4.ts.net` in `~/.ssh/config` for off-LAN reachability.

## Domains
| Domain | Target |
|--------|--------|
| pointing.cdrift.com | Cloudflare Pages (frontend) |
| pointingapi.cdrift.com | Cloudflare Tunnel → Caddy → server-go:3002 (Node server:3001 fallback) |
| auth.cdrift.com | Cloudflare Tunnel → Caddy → zitadel:8080 |
| git.cdrift.com | Cloudflare Tunnel → Caddy → forgejo:3000 |
| vault.cdrift.com | Cloudflare Tunnel → Caddy → recordkeeper:8080 |
| tolgee.cdrift.com | Cloudflare Tunnel → Caddy → tolgee:8080 |
| vidarchive.cdrift.com | Cloudflare Tunnel → Caddy → vidarchive:5000 |
| mediavault.cdrift.com | Cloudflare Tunnel → Caddy → mediavault-api:8080 |
| mosaic.cdrift.com | Cloudflare Tunnel → Caddy → mediavault-api:8080 (+ static frontend) |
| aperture.cdrift.com | Cloudflare Tunnel → Caddy → mediavault-api:8080 (+ static frontend) |
| stele.cdrift.com | Cloudflare Tunnel → Caddy → mediavault-api:8080 (+ static frontend) |
| personalhistorianapi.cdrift.com | Cloudflare Tunnel → Caddy → personalhistorian-api:8000 (frontend on CF Pages) |
| interior.cdrift.com | Cloudflare Tunnel → Caddy → interior-design-api-1:8000 |
| helix.cdrift.com | Cloudflare Access/Zitadel -> Cloudflare Tunnel -> cloudbeaver:8978 (direct, not Caddy) |
| second-brain.cdrift.com | Cloudflare Access -> Cloudflare Tunnel -> Caddy -> second-brain-web:3000 (Zitadel OIDC at the app too) |

## Docker Stacks (N100)
Documented core stacks: shared (Postgres 16, Redis 7.4, backup, watchtower), auth (Zitadel), ingress (Caddy, Cloudflared), forgejo (Git, CI runner), ticket-pointing, record-keeper, tolgee, claude-dash, homepage, vidarchive, mediavault, helix.

Live N100 also has additional app stacks such as personalhistorian, opportunity-radar,
interior-design, and **second-brain** (three stacks: `second-brain-inbox`, `second-brain-telegram`,
`second-brain-web`). Always verify live state before broad infra edits:

```bash
ssh n100 "find /opt/apps -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort"
ssh n100 "docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | sort"
```

**Helix:** CloudBeaver SQL web client at `helix.cdrift.com`, runtime path `/opt/apps/helix`, image `dbeaver/cloudbeaver:26.0.5`, container `helix-cloudbeaver`, Docker alias `cloudbeaver`, no host-published ports. It routes directly from cloudflared to `cloudbeaver:8978` to avoid Caddy Host-header bypass for DB admin access.

## Shared Services
- **Postgres 16**: shared instance; db-init creates core databases (ticket_pointing, zitadel, forgejo, record_keeper, tolgee, claude_dash, personal_historian). Live also includes app/manual databases such as mediavault, interior_design, opp_radar, and second_brain.
- **Redis 7.4**: sessions, caching, pub/sub
- **Zitadel OIDC**: SSO at auth.cdrift.com
- **Caddy + Cloudflare Tunnel**: reverse proxy + encrypted ingress for *.cdrift.com
- **Forgejo**: Git hosting + CI/CD at git.cdrift.com (container registry included)

## Credentials
Never hardcode secrets. Use macOS Keychain:
- Retrieve: `security find-generic-password -s "<service>" -a "<account>" -w`
- Store: `security add-generic-password -s "<service>" -a "<account>" -w "<value>" -U`

### Stored tokens (account is `chris` for all)

| Service | Use | Retrieve |
|---|---|---|
| `forgejo-api` | Forgejo REST API at git.cdrift.com | `security find-generic-password -s forgejo-api -a chris -w` (or shell helper `forgejo-token`) |
| `cloudflare-api` | Cloudflare REST API (Pages deploys, DNS, account info) | `security find-generic-password -s cloudflare-api -a chris -w` |
| `tailscale-api` | Tailscale REST API (devices, routes, ACL) — authoritative for route state when CLI shows stale data | `security find-generic-password -s tailscale-api -a chris -w` |
| `forgejo-registry_token_ci_all` | Forgejo container registry login (`docker login forgejo:3000`) for CI — `package` scope only, NOT usable for Forgejo API calls. Shared across repos as each repo's `REGISTRY_TOKEN` Actions secret (Forgejo has no cross-repo secret inheritance — each repo needs its own copy). | `security find-generic-password -s forgejo-registry_token_ci_all -w` |

Cloudflare API auth pattern: `curl -H "Authorization: Bearer $(security find-generic-password -s cloudflare-api -a chris -w)" https://api.cloudflare.com/client/v4/...`

Forgejo registry vs. API token — see `skills/homelab-infra/references/forgejo-ci.md` § "Registry Token Failures" for the two distinct failure modes and why one token can't substitute for the other.

The same Cloudflare token is also set as the `CLOUDFLARE_API_TOKEN` Forgejo Actions secret on `chris/blog` and `chris/ticket-pointing` for `wrangler deploy` to Cloudflare Pages — when rotating, update keychain AND both Forgejo repo secrets.

For detailed infrastructure reference, invoke the `homelab-infra` or `homelab-architect` skills.
