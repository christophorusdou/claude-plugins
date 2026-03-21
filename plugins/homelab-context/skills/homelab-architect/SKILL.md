---
name: homelab-architect
description: >
  Use when planning a new project, discussing deployment strategy, choosing
  where to run a service, or answering questions about available resources,
  compute, storage, or connectivity.
user-invocable: false
---

# Homelab Architecture Advisor

Use this reference when planning where and how to deploy a new project on the homelab.

## Resource Catalog

| Resource | Specs | Running Services | Best For |
|----------|-------|-----------------|----------|
| **N100** (always-on) | 4C Intel N100, 32GB DDR5, 488GB NVMe | 7 Docker stacks, 14+ containers, Postgres 16 (6 DBs), Redis 7.4 | Always-on APIs, web services, Git/CI |
| **Mac Mini M4** (sleeps 8pm-8am) | 8C ARM64, 16GB, 256GB SSD | Prometheus, Grafana, Uptime Kuma, OTel Collector, Traefik, Forgejo macOS runner | Monitoring, dashboards, macOS CI (Swift/xcodebuild) |
| **TrueNAS** (on-demand WoL) | 20C i7-14700K, 64GB DDR5, 21TB RAIDZ1 | SMB, NFS shares | Storage, backups, media serving |
| **L40S Remote** (shared server) | 8C CPU, 128GB RAM, NVIDIA L40S 48GB VRAM, 3.5TB (2.3TB free) | Speaches TTS (:8000), Qwen3 TTS (:8100), TensorBoard (:6006), Dapr, K8s (kind), Redis 6 | GPU/ML training, TTS/STT, AI experiments |

## Shared Services (available to any new project)

| Service | Details | How to Use |
|---------|---------|-----------|
| **Postgres 16** | 6 databases on shared instance | Create new DB via db-init or manual SQL |
| **Redis 7.4** | Append-only mode | Connect at `redis:6379` on shared network |
| **Zitadel OIDC** | SSO at auth.cdrift.com | Create OAuth2 app in Zitadel admin |
| **Forgejo** | Git + CI/CD + container registry | Push code, add workflow in `.forgejo/workflows/` |
| **Caddy + Cloudflare Tunnel** | Reverse proxy + encrypted ingress | Add Caddyfile route + tunnel config |
| **Cloudflare Pages** | Static frontend hosting | Deploy via `wrangler pages deploy` |

## Decision Trees

| Need | Recommendation | Notes |
|------|---------------|-------|
| Always-on backend/API | **N100 Docker stack** | Add to existing shared network, ~6-10W total |
| GPU / ML training | **L40S remote** | 48GB VRAM, SSH only, shared server (be careful with resources) |
| macOS / Swift CI | **Mac Mini M4** | Sleeps 8pm-8am, queued jobs run at wake |
| Monitoring / dashboards | **Mac Mini M4** | Grafana/Prometheus already there |
| Storage / NAS | **TrueNAS** | On-demand WoL, 21TB RAIDZ1, SMB/NFS |
| Public domain | **Cloudflare Tunnel → Caddy** | Pattern: `<name>.cdrift.com` |
| Static frontend | **Cloudflare Pages** | Free tier, automatic deploys |
| Auth / SSO | **Zitadel OIDC** | Already running at auth.cdrift.com |
| Database | **Shared Postgres 16** | New DB on same instance |
| Cache / sessions / pub-sub | **Redis 7.4** | Already running on N100 |
| Git / CI/CD | **Forgejo** | At git.cdrift.com, two runners (Linux + macOS) |
| Container registry | **Forgejo registry** | Internal: forgejo:3000, external: git.cdrift.com |

## L40S Remote Server Details

- **SSH:** `ssh l40s` (user: aitin, key: ~/.ssh/id_ed25519_l40s)
- **Docker:** Ready, no sudo needed
- **GPU:** NVIDIA L40S 48GB VRAM (currently ~8GB used)
- **Storage:** 3.5TB /shared (2.3TB free), 30+ projects in /shared/projects/
- **Running services:** Speaches TTS (:8000), Qwen3 TTS (:8100), TensorBoard (:6006), Dapr runtime, K8s (kind cluster), Redis 6
- **Project categories:** AI/ML, LLM/RAG (graphrag, ollama, autogen), Speech/Audio (ChatTTS, MeloTTS, CoquiTTS), microservices (Dapr)
- **Warning:** Shared server — be careful with resources, check GPU memory before launching large models

## Common Architecture Patterns

See [deployment-patterns.md](references/deployment-patterns.md) for detailed templates.
