# Docker Stacks Reference

## Shared Stack
**Path on N100:** `/opt/apps/shared/`

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
**Path on N100:** `/opt/apps/auth/`

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
**Path on N100:** `/opt/apps/ingress/`

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
**Path on N100:** `/opt/apps/forgejo/`

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
**Path on N100:** `/opt/apps/tolgee/`

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
**Path on N100:** `/opt/apps/claude-dash/`

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
**Path on N100:** `/opt/apps/homepage/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| homepage | ghcr.io/gethomepage/homepage:latest | 3002:3000 | — |
| dockerproxy | ghcr.io/tecnativa/docker-socket-proxy:latest | internal (2375) | dockerproxy |

**Database:** none
**Notes:**
- Config at `./config/` directory; tracked in `homelab` repo at `docker-compose/apps/homepage/`
- LAN-only dashboard (no `*.cdrift.com` domain). Inventories every running N100 stack,
  grouped Apps / Dev & Tooling / Core Services / Storage / Monitoring (Offline).
- Service cards link to public `*.cdrift.com`; `config/bookmarks.yaml` has a "LAN Direct"
  group with clickable `192.168.130.160:port` shortcuts for host-published ports.
- **Live container status/stats** via the `dockerproxy` sidecar (read-only:
  `CONTAINERS=1`, `POST=0`). `config/docker.yaml` → `n100: { host: dockerproxy, port: 2375 }`;
  each service tagged `server: n100` + `container: <name>` + `showStats: true`.
- **Do NOT mount `/var/run/docker.sock` directly into the homepage container** — gethomepage's
  PUID/PGID privilege-drop strips the `group_add` supplementary group, so the non-root
  process gets `connect EACCES /var/run/docker.sock`. The proxy avoids this without running
  Homepage as root. Docker API route order is `/api/docker/status/{container}/{server}`.

---

## Homelab Actions Stack (TrueNAS Power Control)
**Path on N100:** `/opt/apps/homelab-actions/`
**Source repo:** homelab (`docker-compose/apps/homelab-actions/`)

| Service | Image | Ports | Network |
|---------|-------|-------|---------|
| homelab-actions | locally built (`src/Dockerfile`) | 3005 (host) | network_mode: host |

**Database:** none
**Public:** none — LAN/Tailscale only (`192.168.130.160:3005`), no Cloudflare route
**Notes:**
- Wake-on-LAN + SSH-shutdown control for the TrueNAS appliance (192.168.130.230).
- `network_mode: host` is REQUIRED so the WoL magic packet reaches the LAN broadcast;
  it therefore can't join the `shared` bridge, so it reads mediavault/scraper state from
  the Docker socket (`/var/run/docker.sock:ro`) rather than HTTP-over-DNS.
- Exposes `/api/status` (truenas_up, scraper_running, smb_busy) + Wake/Shutdown endpoints —
  consumed by the Homepage dashboard's TrueNAS widget and power buttons.
- `ACTIONS_TOKEN` env required for auth; mounts the backup SSH key read-only.
- Watchtower disabled (locally built image, not from registry).

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

## Helix Stack (CloudBeaver SQL Web Client)
**Path on N100:** `/opt/apps/helix/`
**Local docs:** `homelab/docs/helix/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| cloudbeaver | dbeaver/cloudbeaver:26.0.5 | internal (8978), no host-published port | cloudbeaver |

**Database:** none external; CloudBeaver stores metadata in its workspace H2 database.
**Depends on:** shared Docker network, Cloudflare Access/Zitadel gate, N100 VPN/Tailscale routing for remote DB targets
**Auth:** Cloudflare Access with Zitadel SSO at the edge, then CloudBeaver local admin login
**Volumes:** `/opt/apps/helix/workspace` -> `/opt/cloudbeaver/workspace`, `/opt/apps/helix/logs` -> `/opt/cloudbeaver/logs`
**Notes:**
- Public URL: `https://helix.cdrift.com`
- Chosen over DbGate for stronger SQL Server driver support and DBeaver lineage.
- Uses a random codename hostname instead of `sql` to avoid advertising the service role.
- The route is direct from cloudflared to `http://cloudbeaver:8978`, not through Caddy.
- Direct routing avoids a LAN/Tailscale Host-header bypass through N100's published Caddy port 80.
- Workspace bind mount is included in `/opt/apps` TrueNAS stack-config backups.
- If first-run setup expires with `Server configuration time has expired`, restart only CloudBeaver:
  `ssh n100 "cd /opt/apps/helix && docker compose restart cloudbeaver"`
- Store the CloudBeaver admin password in macOS Keychain as service `helix-cloudbeaver-admin`, account `chris`.

---

## Opportunity Radar Stack
**Path on N100:** `/opt/apps/opportunity-radar/`
**Source repo:** `git.cdrift.com/chris/opportunity-radar` (deploys via `docker-compose.n100.yml` overlay)

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| api | forgejo:3000/chris/opp-radar-api:latest | 8091:8091 | — |
| web | forgejo:3000/chris/opp-radar-web:latest | 3004:3000 | — |
| crawl4ai | unclecode/crawl4ai:latest | internal | — |
| searxng | searxng/searxng:latest | internal (8080) | — |

**Database:** opp_radar (shared Postgres)
**Public:** none — LAN-only (`192.168.130.160:3004` web, `:8091` api)
**Notes:**
- Calls the **L40S Ollama** endpoint (HTTPS `:11435`) → requires Wood-Mizer VPN up on N100; Ollama calls time out at 120s if VPN drops.
- crawl4ai + searxng are local scraping/search helpers for the radar pipeline.

---

## Personal Historian Stack
**Path on N100:** `/opt/apps/personalhistorian/`
**Source repo:** `git.cdrift.com/chris/personalhistorian`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| personalhistorian-api | forgejo:3000/chris/personalhistorian:latest | internal (8000) | personalhistorian-api |

**Database:** personal_historian (shared Postgres)
**Public:** `personalhistorianapi.cdrift.com` → Caddy → `personalhistorian-api:8000`. The frontend
`personalhistorian.cdrift.com` is **not** tunneled through N100 (served elsewhere, e.g. Cloudflare Pages).

---

## Interior Design Stack
**Path on N100:** `/opt/apps/interior-design/`

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| api | interior-design-api:local (locally built, not registry) | internal (8000) | interior-design-api-1 |
| worker | interior-design-api:local (same image, worker entrypoint) | internal (8000) | — |
| minio | minio/minio:latest | internal (9000) | — |

**Database:** interior_design (shared Postgres)
**Public:** `interior.cdrift.com` → Caddy → `interior-design-api-1:8000`
**Notes:**
- Image is built locally on N100 (`:local` tag), not pulled from the Forgejo registry — rebuild on the host to update.
- MinIO provides S3-compatible object storage for generated assets.

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
| aperture.cdrift.com | mediavault-api:8080 | mediavault (alt frontend) |
| stele.cdrift.com | mediavault-api:8080 | mediavault (alt frontend) |
| personalhistorianapi.cdrift.com | personalhistorian-api:8000 | personalhistorian |
| interior.cdrift.com | interior-design-api-1:8000 | interior-design |
| second-brain.cdrift.com | second-brain-web:3000 | second-brain |

All routes: HTTP only (Caddy `auto_https off`), Cloudflare terminates SSL.

## Direct Cloudflared Route Table

| Domain | Target | Stack | Why direct |
|--------|--------|-------|------------|
| helix.cdrift.com | cloudbeaver:8978 | helix | DB admin surface; avoids LAN/Tailscale Caddy Host-header bypass |

> **Local-vs-production drift:** the Caddyfile and `cloudflared/config.yml` checked into the `homelab` repo may lag live N100 config. Known live-only routes include `mediavault.cdrift.com`, `mosaic.cdrift.com`, `vidarchive.cdrift.com`, and the direct `helix.cdrift.com -> cloudbeaver:8978` cloudflared route. Pull live config before editing or you'll regress production.

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
| second_brain | second_brain | second-brain | second-brain-inbox |
| opp_radar | opp_radar | opportunity-radar | opp-radar-api |
| personal_historian | personal_historian | personalhistorian | personalhistorian-api |
| interior_design | interior_design | interior-design | interior-design-api, interior-design-worker |

All on shared Postgres 16 (postgres:16-alpine) at `postgres:5432`.

**`mediavault` is the only DB with cross-repo writers** — scrapers-v2 INSERTs directly into `collections`, `media_items`, `scraper_sessions`, `ingest_jobs`. Schema is owned by `mediavault-api/migrations/`; do not run alembic from scrapers-v2 against it. See `mediavault/docs/SCRAPER_CONTRACT.md`.

---

## Second Brain Stack
**Path on N100:** `/opt/apps/second-brain-inbox/`, `/opt/apps/second-brain-telegram/`,
`/opt/apps/second-brain-web/` (three compose stacks, each `docker-compose.prod.yml`)

| Service | Image | Ports | Network Alias |
|---------|-------|-------|---------------|
| inbox | forgejo:3000/chris/second-brain-inbox:latest | 8095:8095 | second-brain-inbox |
| telegram | forgejo:3000/chris/second-brain-telegram:latest | — | second-brain-telegram |
| web | forgejo:3000/chris/second-brain-web:latest | 8096:3000 | second-brain-web |

**Database:** second_brain (user: second_brain) — inbox service only
**Depends on:** shared (Postgres); web + telegram reach the inbox over the `shared` network
**Repo/CI:** `chris/second-brain` → Forgejo Actions builds all three images → Watchtower auto-deploys
**Public:** `second-brain.cdrift.com` → Caddy → `second-brain-web:3000` (`header_up X-Forwarded-Proto https`);
Cloudflare Access in front + **Zitadel OIDC (Web+PKCE, no secret)** at the app
**Notes:**
- Personal knowledge system: capture (Telegram bot `@c_second_brain_bot` / web / `curl`) → inbox
  queue → `/sb process` in Claude Code → Markdown vault → web viewer (browse / 3D graph / research).
- inbox + telegram: Go (chi + pgx; long-poll listener → `POST /capture`). web: SvelteKit
  (adapter-node), `env_file: .env` (OIDC + proxy headers + `COOKIE_SECURE`).
- Vault is a **separate git repo** (`chris/second-brain` `entries/` + `research/`) baked into the
  web image at build (build context = repo root). The `second-brain` plugin (claude-plugins) drives
  `/sb` commands — not a homelab service.
- Web `.env` keys: `INBOX_URL/INBOX_TOKEN`, `SESSION_SECRET`, `OIDC_ISSUER/OIDC_CLIENT_ID/
  OIDC_REDIRECT_URI` (no secret — PKCE public), `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER`,
  `COOKIE_SECURE=true`. Inbox token also in Keychain (`second-brain-token`).

---

## Deployment Order

1. `docker network create shared` (first time only)
2. shared: `cd /opt/apps/shared && docker compose --profile init run --rm db-init && docker compose up -d`
3. auth: `cd /opt/apps/auth && docker compose up -d`
4. ingress: `cd /opt/apps/ingress && docker compose up -d`
5. Apps (any order, all depend on shared):
   - `cd /opt/apps/forgejo && docker compose up -d`
   - `cd /opt/apps/tolgee && docker compose up -d`
   - `cd /opt/apps/ticket-pointing && docker compose up -d`
   - `cd /opt/apps/record-keeper && docker compose up -d`
   - `cd /opt/apps/vidarchive && docker compose up -d`
   - `cd /opt/apps/mediavault && docker compose up -d` (api + worker; scraper is `--profile scraper`, fired by host systemd `scrapers.timer`)
   - `cd /opt/apps/claude-dash && docker compose up -d`
   - `cd /opt/apps/homepage && docker compose up -d` (homepage + dockerproxy sidecar)
   - `cd /opt/apps/helix && docker compose up -d`
   - `cd /opt/apps/opportunity-radar && docker compose -f docker-compose.n100.yml up -d` (needs Wood-Mizer VPN for L40S Ollama)
   - `cd /opt/apps/personalhistorian && docker compose up -d`
   - `cd /opt/apps/interior-design && docker compose up -d`
   - `cd /opt/apps/second-brain-inbox && docker compose -f docker-compose.prod.yml up -d`
   - `cd /opt/apps/second-brain-telegram && docker compose -f docker-compose.prod.yml up -d`
   - `cd /opt/apps/second-brain-web && docker compose -f docker-compose.prod.yml up -d`
