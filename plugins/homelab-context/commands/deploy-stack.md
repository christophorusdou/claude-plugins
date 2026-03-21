---
name: deploy-stack
description: Deploy or restart a Docker Compose stack on the N100
disable-model-invocation: true
---

# Deploy Stack

Deploy or restart a Docker Compose stack on the N100 (192.168.130.160).

## Arguments

`$ARGUMENTS` should be one of the stack names listed below. If no argument is provided, list the available stacks and ask the user which one to deploy.

## Stack Mapping

| Stack | Path on N100 |
|-------|-------------|
| shared | ~/homelab/docker-compose/shared/ |
| auth | ~/homelab/docker-compose/auth/ |
| ingress | ~/homelab/docker-compose/networking/ingress/ |
| forgejo | ~/homelab/docker-compose/apps/forgejo/ |
| tolgee | ~/homelab/docker-compose/apps/tolgee/ |
| ticket-pointing | /opt/apps/ticket-pointing/ |
| record-keeper | /opt/apps/record-keeper/ |
| claude-dash | ~/homelab/docker-compose/apps/claude-dash/ |
| homepage | ~/homelab/docker-compose/apps/homepage/ |
| vidarchive | /opt/apps/vidarchive/ |

## Execution

1. If `$ARGUMENTS` is empty, list the stacks above and ask which one to deploy
2. If stack is `shared`, **warn the user**: "Restarting the shared stack affects ALL dependent stacks (auth, forgejo, ticket-pointing, record-keeper, tolgee, claude-dash). Are you sure?"
3. Run the deploy via Bash tool:
   ```bash
   ssh n100 "cd <path> && docker compose pull && docker compose up -d"
   ```
4. Show container status:
   ```bash
   ssh n100 "cd <path> && docker compose ps"
   ```
5. If the stack is `ingress`, also reload Caddy:
   ```bash
   ssh n100 "cd ~/homelab/docker-compose/networking/ingress && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
   ```
