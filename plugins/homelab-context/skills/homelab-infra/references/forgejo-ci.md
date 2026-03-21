# Forgejo CI/CD Reference

## Workflow Basics

- Workflow files go in `.forgejo/workflows/*.yml`
- Compatible with GitHub Actions syntax (most reusable actions work)
- Checkout action: `uses: https://code.forgejo.org/actions/checkout@v4`

Example minimal workflow:

```yaml
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: https://code.forgejo.org/actions/checkout@v4
      - name: Build
        run: make build
```

## Runner Labels

| Label | Host | Use Case |
|---|---|---|
| `ubuntu-latest` | N100 Docker runner | General CI, sibling containers via docker.sock |
| `macos-arm64:host` | Mac Mini native runner | Swift, xcodebuild, codesign |

- Mac Mini runner sleeps 8pm–8am daily; queued jobs execute when it wakes at 8am.
- The `ubuntu-latest` runner runs as a Docker container on the N100 and has access to the Docker socket for sibling container workflows.

## Critical Gotchas

These are hard-won lessons — ignore at your peril.

### Artifact Upload: v3 ONLY

Use `upload-artifact@v3`, NOT v4:

```yaml
- uses: https://code.forgejo.org/actions/upload-artifact@v3
  with:
    name: my-artifact
    path: dist/
```

v4 uses GitHub's proprietary artifact API and **fails on Forgejo/GHES** with a 404 or auth error.

### Services Use Hostname, Not localhost

When defining services in a job, reference them by their service name (hostname), not `localhost`. No port mapping is needed:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: test
steps:
  - name: Wait for postgres
    run: pg_isready -h postgres -U postgres
```

### Cache Requires Fixed Host Ports

For the Forgejo Actions cache to work with sibling containers, ports 8088 and 8089 must be published to the host from the runner container. This is configured at the runner level in `/opt/forgejo-runner/config.yaml`.

### Container Registry Access During CI

To reach the internal Forgejo registry (`forgejo:3000`) from within a job container, add the host mapping:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: ubuntu:22.04
      options: --add-host=forgejo:host-gateway
```

## Container Registry

### Internal vs External

| Registry | URL Pattern | Notes |
|---|---|---|
| Internal | `forgejo:3000/chris/<repo>` | No size limit, used by CI on N100 |
| External | `git.cdrift.com/chris/<repo>` | 100MB per-layer limit (Cloudflare) |

Use the internal registry for CI image pushes to avoid Cloudflare's 100MB layer limit.

### N100 Configuration

- `/etc/hosts`: `127.0.0.1 forgejo` — allows Docker daemon to resolve `forgejo` hostname
- `/etc/docker/daemon.json`: `"insecure-registries": ["forgejo:3000"]` — allows plain HTTP push

### Pushing from a CI Workflow

```yaml
- name: Login to registry
  run: echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login forgejo:3000 -u chris --password-stdin

- name: Build and push
  run: |
    docker build -t forgejo:3000/chris/myapp:${{ github.sha }} .
    docker push forgejo:3000/chris/myapp:${{ github.sha }}
```

## macOS Runner

### Building the Binary

There are no official darwin binaries for the Forgejo runner. Build from source:

```bash
brew install go
git clone https://code.forgejo.org/forgejo/runner
cd runner
git checkout v12.7.1
make build
sudo cp forgejo-runner /usr/local/bin/forgejo-runner
```

### Paths

| Item | Path |
|---|---|
| Binary | `/usr/local/bin/forgejo-runner` (v12.7.1) |
| Config | `/opt/forgejo-runner/config.yaml` |
| LaunchAgent plist | `~/Library/LaunchAgents/com.forgejo.runner.plist` |

### Runs as LaunchAgent (User Agent)

The runner is managed as a launchd user agent, not a system daemon:

```bash
launchctl load ~/Library/LaunchAgents/com.forgejo.runner.plist
launchctl unload ~/Library/LaunchAgents/com.forgejo.runner.plist
```

### Must Use Public URLs

The macOS runner **must connect to Forgejo via public URL** (`https://git.cdrift.com`), not the internal IP (`192.168.130.160`). The Go network stack combined with OrbStack's virtual bridges and the launchd context blocks routes to internal `192.168.130.x` addresses. `curl` and `ping` work fine from a shell, but Go binaries in launchd cannot reach those IPs.

## GitHub Mirror Workflow

File: `.forgejo/workflows/mirror-to-github.yml`

Behavior:
- Pushes all branches and tags to GitHub (one-way sync, no deletion)
- Uses the `GITHUB_MIRROR_PAT` secret (stored in repo settings)
- Triggers on push to any branch and on an 8-hour schedule

```yaml
on:
  push:
  schedule:
    - cron: '0 */8 * * *'

jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: https://code.forgejo.org/actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Push to GitHub
        run: |
          git remote add github https://x-access-token:${{ secrets.GITHUB_MIRROR_PAT }}@github.com/christophorusdou/<repo>.git
          git push github --all
          git push github --tags
```

Note: Deleting branches on Forgejo does NOT delete them on GitHub — the mirror is additive only.

## Admin CLI

The Forgejo admin CLI must be run as the `git` user inside the container:

```bash
docker exec -u git forgejo-forgejo-1 forgejo admin <command>
```

### Common Commands

```bash
# List users
docker exec -u git forgejo-forgejo-1 forgejo admin user list

# Reset a user's password
docker exec -u git forgejo-forgejo-1 forgejo admin user change-password -u <username> -p <newpassword>

# Generate a runner token
docker exec -u git forgejo-forgejo-1 forgejo admin runner generate-registration-token
```

### 2FA Gotcha

If a user cannot log in, check whether 2FA is enabled before attempting a password reset — the password may be correct but TOTP is blocking access:

```bash
docker exec -u git forgejo-forgejo-1 forgejo admin user list
# Look for 2fa_enabled column
```

To remove 2FA from a user:

```bash
docker exec -u git forgejo-forgejo-1 forgejo admin user delete-2fa --username <username>
```
