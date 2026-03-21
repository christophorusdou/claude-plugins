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
| N100 (Debian 13) | 192.168.130.160 | `ssh n100` (root) | Primary Docker host, always-on |
| Mac Mini M4 | 192.168.130.170 | `ssh mac-mini-server` (chris) | Monitoring, macOS CI runner |
| TrueNAS | 192.168.130.230 | `ssh truenas` (chris) | Storage/backups, on-demand WoL |
| L40S Remote | 150.1.8.167 | `ssh l40s` (aitin) | GPU/ML workloads (shared server) |

## Domains
| Domain | Target |
|--------|--------|
| pointing.cdrift.com | Cloudflare Pages (frontend) |
| pointingapi.cdrift.com | Cloudflare Tunnel → Caddy → server:3001 |
| auth.cdrift.com | Cloudflare Tunnel → Caddy → zitadel:8080 |
| git.cdrift.com | Cloudflare Tunnel → Caddy → forgejo:3000 |
| vault.cdrift.com | Cloudflare Tunnel → Caddy → recordkeeper:8080 |
| tolgee.cdrift.com | Cloudflare Tunnel → Caddy → tolgee:8080 |
| vidarchive.cdrift.com | Cloudflare Tunnel → Caddy → vidarchive:5000 |

## Docker Stacks (N100) — 10 stacks
shared (Postgres 16, Redis 7.4, backup, watchtower) · auth (Zitadel) · ingress (Caddy, Cloudflared) · forgejo (Git, CI runner) · ticket-pointing · record-keeper · tolgee · claude-dash · homepage · vidarchive

## Shared Services
- **Postgres 16**: 6 databases (ticket_pointing, zitadel, forgejo, record_keeper, tolgee, claude_dash)
- **Redis 7.4**: sessions, caching, pub/sub
- **Zitadel OIDC**: SSO at auth.cdrift.com
- **Caddy + Cloudflare Tunnel**: reverse proxy + encrypted ingress for *.cdrift.com
- **Forgejo**: Git hosting + CI/CD at git.cdrift.com (container registry included)

## Credentials
Never hardcode secrets. Use macOS Keychain:
- Retrieve: `security find-generic-password -s "<service>" -a "<account>" -w`
- Store: `security add-generic-password -s "<service>" -a "<account>" -w "<value>" -U`

For detailed infrastructure reference, invoke the `homelab-infra` or `homelab-architect` skills.
