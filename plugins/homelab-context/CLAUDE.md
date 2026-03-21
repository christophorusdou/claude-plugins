# Homelab Infrastructure

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

## Docker Stacks (N100)
shared (Postgres 16, Redis 7.4, backup, watchtower) · auth (Zitadel) · ingress (Caddy, Cloudflared) · forgejo (Git, CI runner) · ticket-pointing · record-keeper · tolgee · claude-dash · homepage

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

For detailed infrastructure reference, Claude can invoke the `homelab-infra` or `homelab-architect` skills.
