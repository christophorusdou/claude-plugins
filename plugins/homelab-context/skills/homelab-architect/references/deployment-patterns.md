# Common Deployment Patterns

## Pattern 1: API + Static Frontend

**Example:** ticket-pointing (pointingapi.cdrift.com + pointing.cdrift.com)

| Component | Where | How |
|-----------|-------|-----|
| Frontend | Cloudflare Pages | Static build, deploy via `wrangler pages deploy dist/` |
| Backend API | N100 Docker stack | New compose file in `docker-compose/apps/<name>/` |
| Database | Shared Postgres | New database on existing instance |
| Cache | Shared Redis | Connect at `redis:6379` |
| Auth | Zitadel OIDC | Create OAuth2 app, configure redirect URIs |
| Domain | Cloudflare | `<app>.cdrift.com` (Pages) + `<app>api.cdrift.com` (Tunnel) |

## Pattern 2: Full-Stack Self-Hosted

**Example:** record-keeper (vault.cdrift.com)

| Component | Where | How |
|-----------|-------|-----|
| Single container (API + SPA) | N100 Docker stack | One service serving both API and static files |
| Database | Shared Postgres | New database |
| Domain | Cloudflare Tunnel | `<app>.cdrift.com` → Caddy → service |

## Pattern 3: Background Worker / Cron

**Example:** backup container in shared stack

| Component | Where | How |
|-----------|-------|-----|
| Worker container | N100 Docker | No Caddy route needed, no public domain |
| Database access | Shared Postgres | Direct connection on shared network |
| Scheduling | Container-internal | Use cron inside container or Docker restart policy |

## Pattern 4: ML Training / GPU Workload

**Example:** ai-sim project on L40S

| Component | Where | How |
|-----------|-------|-----|
| Training code | L40S `/shared/projects/<name>/` | Docker compose or bare metal |
| GPU access | L40S NVIDIA L40S | 48GB VRAM, CUDA ready |
| Visualization | TensorBoard (:6006 already running) | Or launch custom on another port |
| Local access | SSH tunnel | `ssh -L 8080:localhost:8080 l40s` |
| Data storage | L40S `/shared/` | 2.3TB free |

## Pattern 5: Monitoring Integration

**Example:** Claude Code metrics → Grafana

| Component | Where | How |
|-----------|-------|-----|
| Metrics export | Application | Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.130.170:4317` |
| Collection | Mac Mini OTel Collector | Receives OTLP gRPC, exports to Prometheus |
| Storage | Mac Mini Prometheus | Scrapes OTel collector on :8889 |
| Dashboard | Mac Mini Grafana | Create dashboard at http://192.168.130.170:3000 |
| Note | | Mac Mini sleeps 8pm-8am — monitoring has overnight gaps |

## Pattern 6: Media Archival

**Example:** vidarchive (vidarchive.cdrift.com)

| Component | Where | How |
|-----------|-------|-----|
| Web UI + download worker | N100 Docker stack | Flask + yt-dlp + gunicorn, image from Forgejo registry |
| Staging storage | N100 local disk | `/opt/vidarchive/downloads` (UID 1000), disk guard refuses if <20GB free |
| Long-term storage | TrueNAS | Nightly rsync via `/opt/vidarchive/sync-to-nas.sh` (WoL → rsync → shutdown) |
| Auth | Cloudflare Access | Email OTP (not Zitadel) |
| Domain | Cloudflare Tunnel | `vidarchive.cdrift.com` → Caddy → vidarchive:5000 |
| CI | Forgejo Actions | Push to main → pytest → Docker build → push to Forgejo registry |

Key pattern: stage downloads to fast local disk, then batch-sync to NAS on a schedule. Keeps NAS powered off most of the time (WoL on demand).
