---
name: new-service
description: Scaffold a new service into the homelab (compose, Caddy, tunnel, database)
disable-model-invocation: true
---

# Scaffold New Service

Guided interactive workflow to add a new service to the homelab.

## Arguments

`$ARGUMENTS` should be the service name. If not provided, ask the user for the service name.

## Workflow

Ask the user these questions one at a time:

1. "Does this service need a Postgres database?" (yes/no)
2. "Does this service need a public domain (`<name>.cdrift.com`)?" (yes/no)
3. "Does this service need Zitadel SSO?" (yes/no)
4. "What port does the service listen on?" (default: 8080)

## Actions

Based on the answers, create the following files:

### Always: Docker Compose file

Create `docker-compose/apps/<name>/docker-compose.yml`:

```yaml
services:
  <name>:
    image: <ask user or use placeholder>
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgres://<name>:${<NAME>_DB_PASSWORD}@postgres:5432/<name>
    networks:
      shared:
        aliases:
          - <name>

networks:
  shared:
    external: true
```

Remove the DATABASE_URL line if no database is needed.

### If database: Document SQL commands

Print the SQL commands for the user to run (do NOT execute them):
```bash
ssh n100 "docker exec -i shared-postgres-1 psql -U postgres" <<SQL
CREATE DATABASE <name>;
CREATE USER <name> WITH PASSWORD '<generate-or-ask>';
GRANT ALL PRIVILEGES ON DATABASE <name> TO <name>;
\c <name>
GRANT ALL ON SCHEMA public TO <name>;
SQL
```

### If public domain: Update Caddyfile

Add to `docker-compose/networking/ingress/Caddyfile` (before the `handle { respond "Not Found" 404 }` line):

```
  @<name> host <name>.cdrift.com
  handle @<name> {
    reverse_proxy <name>:<port>
  }
```

### If public domain: Note Cloudflare steps

Print instructions:
- Add `<name>.cdrift.com` to cloudflared config.yml ingress rules
- Add CNAME DNS record in Cloudflare dashboard

### Update README

Add a row to the N100 services table in `README.md`.

### Final message

Print: "Review the files above, then run `/deploy-stack <name>` to deploy."

**Do NOT deploy anything.** This command only creates/modifies files.
