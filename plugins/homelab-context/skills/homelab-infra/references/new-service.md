# Adding a New Service to the Homelab

Step-by-step checklist for deploying a new service into the five-stack N100 architecture.

---

## 1. Database (if needed)

Create the database and user on the shared Postgres instance:

```bash
ssh n100 "docker exec -i shared-postgres-1 psql -U postgres" <<SQL
CREATE DATABASE <name>;
CREATE USER <user> WITH PASSWORD '<pw>';
GRANT ALL PRIVILEGES ON DATABASE <name> TO <user>;
\c <name>
GRANT ALL ON SCHEMA public TO <user>;
SQL
```

Add the password to the shared stack environment file:

- Edit `docker-compose/shared/.env`
- Add `<NAME>_DB_PASSWORD=<pw>`

---

## 2. Docker Compose File

Create `docker-compose/apps/<name>/docker-compose.yml`.

Rules:
- Use the `shared` network (external: true)
- Reference Postgres as `postgres:5432` and Redis as `redis:6379` (both on the shared network)
- Always set `restart: unless-stopped`

Minimal template:

```yaml
services:
  <name>:
    image: <image>
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgres://<user>:${<NAME>_DB_PASSWORD}@postgres:5432/<db>
    networks:
      shared:
        aliases:
          - <name>

networks:
  shared:
    external: true
```

Create a corresponding `.env` file in the same directory for service-specific secrets.

---

## 3. Caddy Route (if public)

Edit `docker-compose/networking/ingress/Caddyfile`.

Add a host matcher and reverse proxy block:

```
@<name> host <name>.cdrift.com
handle @<name> {
  reverse_proxy <service>:<port>
}
```

Pattern: matcher name matches the service name, hostname follows the `<name>.cdrift.com` convention.

---

## 4. Cloudflare Tunnel (if public)

Edit `docker-compose/networking/ingress/cloudflared/config.yml`.

Add an ingress rule (before the final catch-all):

```yaml
- hostname: <name>.cdrift.com
  service: http://caddy:80
```

Then in the Cloudflare dashboard:
- Go to DNS for the `cdrift.com` zone
- Add a CNAME record: `<name>` → `<tunnel-uuid>.cfargotunnel.com` (proxied)

---

## 5. Zitadel SSO (if auth needed)

- Open the Zitadel admin console at https://auth.cdrift.com
- Create a new OAuth2 application under your project
- Configure the redirect URI to `https://<name>.cdrift.com/callback` (or whatever the service expects)
- Copy the client ID and client secret
- Add OAuth2 env vars to the service's `.env`:
  ```
  OAUTH_CLIENT_ID=<client-id>
  OAUTH_CLIENT_SECRET=<client-secret>
  OAUTH_ISSUER=https://auth.cdrift.com
  ```

---

## 6. Deploy

Copy files to N100:

```bash
scp -r docker-compose/apps/<name> n100:~/homelab/docker-compose/apps/
```

If Caddy or tunnel config changed, copy ingress config and reload:

```bash
scp -r docker-compose/networking/ingress n100:~/homelab/docker-compose/networking/
ssh n100 "cd ~/homelab/docker-compose/networking/ingress && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
```

Start the service:

```bash
ssh n100 "cd ~/homelab/docker-compose/apps/<name> && docker compose up -d"
```

Verify it is running:

```bash
ssh n100 "docker ps | grep <name>"
```

---

## 7. Update Docs

- Add a row to the services table in `README.md`
- Add a widget to the Homepage config (if applicable)

---

## Notes

- All services connect via the `shared` Docker network — no port publishing needed for internal service-to-service communication.
- Watchtower (in the shared stack) will auto-update containers tagged with `latest`; pin images to a version tag if you want manual control.
- The `<NAME>_DB_PASSWORD` convention uses uppercase service name + `_DB_PASSWORD` suffix to keep shared stack `.env` consistent.
