# Docker Stacks Reference

## Shared Stack
**Path on N100:** `~/homelab/docker-compose/shared/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| postgres | postgres:16-alpine | internal only | postgres |
| redis | redis:7.4-alpine | internal only | redis |
| backup | ghcr.io/christophorusdou/ticket-pointing-backup:latest | — | — |
| watchtower | containrrr/watchtower | — | — |
| db-init | postgres:16-alpine (profile: init) | — | — |

**Database:** System — creates all app databases on first run
**Volumes:** postgres_data, redis_data, backup_data
**Notes:**
- First deploy requires `docker compose --profile init run --rm db-init`
- db-init creates: ticket_pointing, zitadel, forgejo, record_keeper, tolgee, claude_dash
- Watchtower: label-enabled (`--label-enable`), needs `DOCKER_API_VERSION=1.47` for Docker 29
- Backup: daily pg_dump at 3AM, configurable via BACKUP_HOUR env var
- Redis: append-only mode (`redis-server --appendonly yes`)

---

## Auth Stack (Zitadel)
**Path on N100:** `~/homelab/docker-compose/auth/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| zitadel | ghcr.io/zitadel/zitadel:v2.71.8 | internal (8080) | zitadel |

**Database:** zitadel (user: zitadel)
**Depends on:** shared (Postgres)
**Notes:**
- Command: `start-from-init --masterkeyFromEnv`
- ZITADEL_MASTERKEY must be 32+ chars and must match between source/target for data migration
- External domain: auth.cdrift.com (EXTERNALSECURE=true, EXTERNALPORT=443, TLS_ENABLED=false — Cloudflare handles SSL)
- Healthcheck: `/app/zitadel ready` (30s start period)

---

## Ingress Stack (Caddy + Cloudflared)
**Path on N100:** `~/homelab/docker-compose/networking/ingress/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| caddy | caddy:2.9-alpine | 80:80 | — |
| cloudflared | cloudflare/cloudflared:2025.1.0 | — | — |

**Database:** none
**Volumes:** caddy_data, caddy_config
**Notes:**
- Caddy: HTTP only (`auto_https off`) — Cloudflare terminates SSL
- Caddyfile: `/etc/caddy/Caddyfile`
- Cloudflared: tunnel config at `./cloudflared/config.yml`, credentials at `./cloudflared/credentials.json`
- Reload Caddy after changes: `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`

---

## Forgejo Stack (Git + CI/CD + Registry)
**Path on N100:** `~/homelab/docker-compose/apps/forgejo/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| forgejo | codeberg.org/forgejo/forgejo:14 | 2222:22 (SSH), 3000:3000 (HTTP+registry) | forgejo |
| forgejo-runner | code.forgejo.org/forgejo/runner:12 | 8088:8088 (cache), 8089:8089 (cache proxy) | — |

**Database:** forgejo (user: forgejo)
**Depends on:** shared (Postgres)
**Volumes:** forgejo_data, forgejo_runner_data
**Notes:**
- Root URL: https://git.cdrift.com
- SSH on port 2222
- LFS enabled, packages/registry enabled, Actions enabled
- SSO: Zitadel OAuth2 (external registration only, auto-registration enabled)
- Runner: sibling containers via docker.sock, privileged mode, capacity 1
- Cache: fixed ports 8088/8089 for `actions/cache` support
- Runner container options: `--add-host=forgejo:host-gateway`
- N100 /etc/hosts: `127.0.0.1 forgejo` (for Docker daemon to reach registry)
- N100 /etc/docker/daemon.json: `insecure-registries: ["forgejo:3000"]`

---

## Tolgee Stack (Localization)
**Path on N100:** `~/homelab/docker-compose/apps/tolgee/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| tolgee | tolgee/tolgee:latest | internal (8080) | tolgee |

**Database:** tolgee (user: tolgee)
**Depends on:** shared (Postgres)
**Volumes:** tolgee_data
**Notes:**
- Spring Boot app, uses JDBC URL to shared Postgres
- Zitadel OAuth2 SSO configured
- Google Cloud Translation API for machine translation (optional)
- Frontend URL: https://tolgee.cdrift.com

---

## Ticket-Pointing Stack
**Path on N100:** `/opt/apps/ticket-pointing/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| server | git.cdrift.com/chris/ticket-pointing-server | internal (3001) | server |

**Database:** ticket_pointing (user: pointing)
**Depends on:** shared (Postgres, Redis)
**Notes:**
- Node.js API + WebSocket server
- Uses Redis for Socket.IO adapter and sessions
- CI image pushed to Forgejo container registry
- Watchtower auto-updates via label

---

## Record-Keeper Stack
**Path on N100:** `/opt/apps/record-keeper/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| recordkeeper | forgejo:3000/chris/record-keeper | internal (8080) | recordkeeper |

**Database:** record_keeper (user: recordkeeper)
**Depends on:** shared (Postgres)
**Notes:**
- Go API + React SPA (single binary)
- CI image pushed to Forgejo container registry (internal)
- Uses L40S Ollama for document vision analysis (qwen3.5:27b via HTTPS :11435, CA cert at `/certs/ollama-ca.crt` in container)

---

## Claude-Dash Stack
**Path on N100:** `~/homelab/docker-compose/apps/claude-dash/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| claude-dash-api | custom build | 8090:8090 | — |
| claude-dash-web | custom build | 3003:3000 | — |

**Database:** claude_dash (user: claude_dash)
**Depends on:** shared (Postgres, Redis)
**Notes:**
- Custom Dockerfiles at `/opt/apps/claude-dash/src/`
- Watchtower disabled (no auto-update)
- API uses DATABASE_URL + REDIS_URL env vars

---

## Homepage Stack
**Path on N100:** `~/homelab/docker-compose/apps/homepage/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| homepage | ghcr.io/gethomepage/homepage:latest | 3002:3000 | — |

**Database:** none
**Notes:**
- Config at `./config/` directory
- Dashboard for all homelab services

---

## Monitoring Stack (Mac Mini M4)
**Path on Mac Mini:** `~/homelab/docker-compose/monitoring/`

| Service | Image | Ports |
|---------|-------|-------|
| prometheus | prom/prometheus:latest | 9090:9090 |
| grafana | grafana/grafana:latest | 3000:3000 |
| otel-collector | otel/opentelemetry-collector-contrib:latest | 4317:4317 (gRPC), 8889:8889 (metrics) |
| uptime-kuma | louislam/uptime-kuma:latest | 3001:3001 |

**Database:** none (uses file-based storage)
**Notes:**
- Runs on Mac Mini M4 (192.168.130.170), NOT on N100
- Sleeps 8pm-8am with Mac Mini
- Prometheus scrapes: self + otel-collector:8889
- OTel receives OTLP gRPC on port 4317, exports to Prometheus format on 8889
- Send metrics: set `OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.130.170:4317`
- Grafana provisioned with datasources and dashboards from YAML

---

## MediaVault Stack
**Path on N100:** `/opt/apps/mediavault/`
**Source repo:** `git.cdrift.com/chris/mediavault`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| mediavault-api | forgejo:3000/chris/mediavault-api | internal (8080) | mediavault-api |
| mediavault-worker | forgejo:3000/chris/mediavault-api (same image, worker entrypoint) | — | — |
| scraper | forgejo:3000/chris/scrapers-v2 (profile: scraper) | — | — |

**Database:** mediavault (user: mediavault) — bare `public` schema, no `search_path`
**Depends on:** shared (Postgres 16, Redis 7.4), TrueNAS NFS at `/mnt/truenas`
**Volumes:** mediavault_variants (256px JPEG thumbnails on NVMe, ~121GB projected)
**Frontend:** Mosaic (SvelteKit static, deployed at `mosaic.cdrift.com` via Caddy bind-mounted from `/opt/apps/mediavault/mosaic-build/`)
**Notes:**
- Go API + worker share one image; worker drains `ingest_jobs` table for thumbnail/poster generation
- `MEDIA_ROOT_DIR=/mnt/truenas` bind-mounted read-only into api + worker containers
- Auth: Zitadel OIDC (PKCE), `mediavault.cdrift.com/auth/callback`
- Asset serving: HMAC signed URLs; Caddy offloads variant serving from NVMe
- **Scraper** runs as opt-in profile: `docker compose --profile scraper run --rm scraper` — scheduled by host systemd timer `scrapers.timer` daily at 10:00 America/Chicago. Writes files to `/mnt/truenas/projects/scrapers_v2/...` and rows directly into the `mediavault` DB (NOT a separate scraper DB; see `mediavault/docs/SCRAPER_CONTRACT.md`)
- **Schema gotcha:** the committed `mediavault-api/migrations/` does NOT include columns/tables the scraper writes (`scraper_sessions`, `collections.source_url`, etc.). Production DB was hand-provisioned from `mediavault/docs/SCRAPER_REFACTOR_HANDOFF.md`. Re-provisioning requires applying that SQL by hand.

---

## Vidarchive Stack (YouTube Archiver)
**Path on N100:** `/opt/apps/vidarchive/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| vidarchive | forgejo:3000/chris/vidarchive | internal (5000) | vidarchive |

**Database:** none
**Depends on:** nothing (standalone)
**Auth:** Cloudflare Access (email OTP), not Zitadel
**Volumes:** /opt/vidarchive/downloads → /downloads, /opt/vidarchive/cookies → /cookies:ro
**Notes:**
- Python/Flask + yt-dlp + gunicorn (2 workers, 600s timeout)
- Downloads staged to N100 local disk, nightly cron rsyncs to TrueNAS
- `/opt/vidarchive/downloads` must be owned by UID 1000 (container user)
- Disk space guard: refuses downloads if < 20GB free
- CI: push to main → pytest → Docker build → push to Forgejo registry
- Sync script: `/opt/vidarchive/sync-to-nas.sh` (WoL → rsync → shutdown TrueNAS)

---

## Caddy Route Table

| Domain | Target | Stack |
|--------|--------|-------|
| pointingapi.cdrift.com | server:3001 | ticket-pointing |
| auth.cdrift.com | zitadel:8080 | auth |
| git.cdrift.com | forgejo:3000 | forgejo |
| vault.cdrift.com | recordkeeper:8080 | record-keeper |
| tolgee.cdrift.com | tolgee:8080 | tolgee |
| vidarchive.cdrift.com | vidarchive:5000 | vidarchive |
| mediavault.cdrift.com | mediavault-api:8080 | mediavault |
| mosaic.cdrift.com | Caddy file_server (static SvelteKit build at `/opt/apps/mediavault/mosaic-build/`) | mediavault |

All routes: HTTP only (Caddy `auto_https off`), Cloudflare terminates SSL.

> **Local-vs-production drift:** the Caddyfile and `cloudflared/config.yml` checked into the `homelab` repo do NOT include `mediavault.cdrift.com`, `mosaic.cdrift.com`, or `vidarchive.cdrift.com` — those routes were added directly on N100 and never backported. Pull live config before editing or you'll regress production.

---

## Database Table

| Database | User | Stack | Writers |
|----------|------|-------|---------|
| ticket_pointing | pointing | ticket-pointing | ticket-pointing-server |
| zitadel | zitadel | auth | zitadel |
| forgejo | forgejo | forgejo | forgejo |
| record_keeper | recordkeeper | record-keeper | recordkeeper |
| tolgee | tolgee | tolgee | tolgee |
| claude_dash | claude_dash | claude-dash | claude-dash-api |
| mediavault | mediavault | mediavault | mediavault-api, mediavault-worker, **scrapers-v2 (separate repo)** |

All on shared Postgres 16 (postgres:16-alpine) at `postgres:5432`.

**`mediavault` is the only DB with cross-repo writers** — scrapers-v2 INSERTs directly into `collections`, `media_items`, `scraper_sessions`, `ingest_jobs`. Schema is owned by `mediavault-api/migrations/`; do not run alembic from scrapers-v2 against it. See `mediavault/docs/SCRAPER_CONTRACT.md`.

---

## Deployment Order

1. `docker network create shared` (first time only)
2. shared: `cd ~/homelab/docker-compose/shared && docker compose --profile init run --rm db-init && docker compose up -d`
3. auth: `cd ~/homelab/docker-compose/auth && docker compose up -d`
4. ingress: `cd ~/homelab/docker-compose/networking/ingress && docker compose up -d`
5. Apps (any order, all depend on shared):
   - `cd ~/homelab/docker-compose/apps/forgejo && docker compose up -d`
   - `cd ~/homelab/docker-compose/apps/tolgee && docker compose up -d`
   - `cd /opt/apps/ticket-pointing && docker compose up -d`
   - `cd /opt/apps/record-keeper && docker compose up -d`
   - `cd /opt/apps/vidarchive && docker compose up -d`
   - `cd /opt/apps/mediavault && docker compose up -d` (api + worker; scraper is `--profile scraper`, fired by host systemd `scrapers.timer`)
   - `cd ~/homelab/docker-compose/apps/claude-dash && docker compose up -d`
   - `cd ~/homelab/docker-compose/apps/homepage && docker compose up -d`
