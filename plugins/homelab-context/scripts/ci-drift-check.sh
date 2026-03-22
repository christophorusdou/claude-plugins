#!/usr/bin/env bash
# ci-drift-check.sh — checks internal consistency of homelab repo docs vs actual files
# Runs from the repo root (CI checkout directory). Exits 0 if clean, 1 if drift found.
# Writes findings to /tmp/drift-report.txt and also prints to stdout.

set -uo pipefail

REPORT=/tmp/drift-report.txt
DRIFT=0

# Paths (relative to repo root)
COMPOSE_ROOT="docker-compose"
STACKS_MD="plugins/homelab-context/skills/homelab-infra/references/stacks.md"
CADDYFILE="docker-compose/networking/ingress/Caddyfile"
CLAUDE_MD="plugins/homelab-context/CLAUDE.md"
PROJECT_MAP="plugins/homelab-context/hooks/project-map.json"

: > "$REPORT"  # truncate/create

log() {
    echo "$*" | tee -a "$REPORT"
}

flag() {
    DRIFT=1
    log "  DRIFT: $*"
}

section() {
    log ""
    log "=== $* ==="
}

log "Homelab drift check — $(date -u '+%Y-%m-%d %H:%M UTC')"
log "Repo root: $(pwd)"

# ============================================================
# Check 1: Compose dirs vs stacks.md
# ============================================================
section "Check 1: Compose dirs vs stacks.md"

# Collect all dirs containing a docker-compose.yml or docker-compose.yaml
compose_dirs=()
while IFS= read -r f; do
    compose_dirs+=("$(dirname "$f")")
done < <(find "$COMPOSE_ROOT" -maxdepth 4 \( -name "docker-compose.yml" -o -name "docker-compose.yaml" \) | sort)

log "Found ${#compose_dirs[@]} compose directories:"
for d in "${compose_dirs[@]}"; do
    log "  $d"
done

log ""
log "Checking each compose dir appears in stacks.md..."
for d in "${compose_dirs[@]}"; do
    base="$(basename "$d")"
    if ! grep -qi "$base" "$STACKS_MD"; then
        flag "compose dir '$d' (basename: '$base') has no mention in $STACKS_MD"
    else
        log "  OK: $d"
    fi
done

# Check /opt/apps paths referenced in stacks.md
log ""
log "Checking /opt/apps paths in stacks.md (expected outside repo — informational)..."
while IFS= read -r opt_line; do
    # Extract the app name: /opt/apps/<name>
    name=$(echo "$opt_line" | sed 's|.*/opt/apps/||' | sed 's|[^a-z_-].*||')
    [ -z "$name" ] && continue
    found=0
    for d in "${compose_dirs[@]}"; do
        [ "$(basename "$d")" = "$name" ] && found=1 && break
    done
    if [ $found -eq 0 ]; then
        log "  NOTE: stacks.md references /opt/apps/$name (deployed outside repo — expected, no action needed)"
    fi
done < <(grep -o '/opt/apps/[a-z_-]*' "$STACKS_MD" | sort -u)

# ============================================================
# Check 2: Caddyfile routes vs CLAUDE.md domains
# ============================================================
section "Check 2: Caddyfile routes vs CLAUDE.md domain table"

# Extract domains from Caddyfile — lines like: @name host xxx.cdrift.com
# Use sed to grab the domain token after "host "
caddy_domains=()
while IFS= read -r line; do
    # line looks like: "    @api host pointingapi.cdrift.com"
    domain=$(echo "$line" | sed 's/.*host[[:space:]]*//' | sed 's/[[:space:]].*//' | grep 'cdrift\.com' || true)
    [ -n "$domain" ] && caddy_domains+=("$domain")
done < <(grep -E '[[:space:]]@[a-z]+ host ' "$CADDYFILE")

log "Domains in Caddyfile:"
for d in "${caddy_domains[@]}"; do
    log "  $d"
done

# Extract domains from CLAUDE.md domain table
# The table rows look like: | domain.cdrift.com | ... |
claude_domains=()
in_domain_table=0
while IFS= read -r line; do
    if echo "$line" | grep -qi '^## Domains'; then
        in_domain_table=1
        continue
    fi
    # Stop at the next ## section header
    if [ $in_domain_table -eq 1 ] && echo "$line" | grep -qE '^## '; then
        in_domain_table=0
    fi
    if [ $in_domain_table -eq 1 ]; then
        # Extract first cell of table row: | domain | ...
        domain=$(echo "$line" | sed 's/^|[[:space:]]*//' | sed 's/[[:space:]]*|.*//' | grep 'cdrift\.com' || true)
        [ -n "$domain" ] && claude_domains+=("$domain")
    fi
done < "$CLAUDE_MD"

log ""
log "Domains in CLAUDE.md domain table:"
for d in "${claude_domains[@]}"; do
    log "  $d"
done

# Check CLAUDE.md domains have Caddyfile routes (except pointing.cdrift.com — Cloudflare Pages)
log ""
log "Checking CLAUDE.md domains appear in Caddyfile..."
for cd in "${claude_domains[@]}"; do
    if [ "$cd" = "pointing.cdrift.com" ]; then
        log "  SKIP: $cd (Cloudflare Pages — no Caddy route needed)"
        continue
    fi
    found=0
    for cad in "${caddy_domains[@]}"; do
        [ "$cad" = "$cd" ] && found=1 && break
    done
    [ $found -eq 0 ] && flag "$cd is in CLAUDE.md domains but has no route in Caddyfile"
    [ $found -eq 1 ] && log "  OK: $cd"
done

# Check Caddyfile routes appear in CLAUDE.md
log ""
log "Checking Caddyfile routes appear in CLAUDE.md..."
for cad in "${caddy_domains[@]}"; do
    found=0
    for cd in "${claude_domains[@]}"; do
        [ "$cd" = "$cad" ] && found=1 && break
    done
    [ $found -eq 0 ] && flag "$cad is in Caddyfile but not in CLAUDE.md domain table"
    [ $found -eq 1 ] && log "  OK: $cad"
done

# ============================================================
# Check 3: Databases in db-init vs docs
# ============================================================
section "Check 3: Database init vs CLAUDE.md + stacks.md"

shared_compose="$COMPOSE_ROOT/shared/docker-compose.yml"

# Extract "CREATE DATABASE <name>" entries from the db-init command block
init_dbs=()
while IFS= read -r line; do
    db=$(echo "$line" | sed 's/.*CREATE DATABASE[[:space:]]*//' | sed 's/[[:space:]].*//')
    [ -n "$db" ] && init_dbs+=("$db")
done < <(grep 'CREATE DATABASE' "$shared_compose")

log "Databases created in db-init ($shared_compose):"
for db in "${init_dbs[@]}"; do
    log "  $db"
done

# Extract databases from CLAUDE.md — the Postgres "6 databases" parenthetical line
# e.g. "Postgres 16: 6 databases (ticket_pointing, zitadel, forgejo, ...)"
claude_dbs=()
while IFS= read -r line; do
    if echo "$line" | grep -qi 'postgres.*databases\|databases.*postgres'; then
        # Pull out the parenthesised list
        paren=$(echo "$line" | sed 's/.*(\([^)]*\)).*/\1/')
        if [ "$paren" != "$line" ]; then
            # Split on comma
            IFS=',' read -ra items <<< "$paren"
            for item in "${items[@]}"; do
                name=$(echo "$item" | tr -d ' ')
                [ -n "$name" ] && claude_dbs+=("$name")
            done
        fi
    fi
done < "$CLAUDE_MD"

log ""
log "Databases listed in CLAUDE.md:"
for db in "${claude_dbs[@]}"; do
    log "  $db"
done

# Extract databases from stacks.md database table
# Rows look like: | ticket_pointing | pointing | ticket-pointing |
stacks_dbs=()
in_db_table=0
while IFS= read -r line; do
    if echo "$line" | grep -qi '## Database Table'; then
        in_db_table=1
        continue
    fi
    if [ $in_db_table -eq 1 ] && echo "$line" | grep -qE '^## '; then
        in_db_table=0
    fi
    if [ $in_db_table -eq 1 ]; then
        # First cell: | ticket_pointing | ...
        db=$(echo "$line" | sed 's/^|[[:space:]]*//' | sed 's/[[:space:]]*|.*//' | grep '^[a-z][a-z_]*$' || true)
        [ -n "$db" ] && [ "$db" != "Database" ] && stacks_dbs+=("$db")
    fi
done < "$STACKS_MD"

log ""
log "Databases listed in stacks.md database table:"
for db in "${stacks_dbs[@]}"; do
    log "  $db"
done

# Compare init_dbs vs claude_dbs
log ""
log "Checking db-init databases appear in CLAUDE.md..."
if [ ${#claude_dbs[@]} -eq 0 ]; then
    log "  WARNING: could not parse database list from CLAUDE.md — skipping sub-check"
else
    for db in "${init_dbs[@]}"; do
        found=0
        for cdb in "${claude_dbs[@]}"; do [ "$cdb" = "$db" ] && found=1 && break; done
        [ $found -eq 0 ] && flag "db-init creates '$db' but it is not listed in CLAUDE.md postgres entry"
        [ $found -eq 1 ] && log "  OK: $db"
    done
    for cdb in "${claude_dbs[@]}"; do
        found=0
        for db in "${init_dbs[@]}"; do [ "$db" = "$cdb" ] && found=1 && break; done
        [ $found -eq 0 ] && flag "CLAUDE.md lists database '$cdb' but db-init does not create it"
        [ $found -eq 1 ] && log "  OK: $cdb"
    done
fi

# Compare init_dbs vs stacks_dbs
log ""
log "Checking db-init databases appear in stacks.md database table..."
if [ ${#stacks_dbs[@]} -eq 0 ]; then
    log "  WARNING: could not parse database table from stacks.md — skipping sub-check"
else
    for db in "${init_dbs[@]}"; do
        found=0
        for sdb in "${stacks_dbs[@]}"; do [ "$sdb" = "$db" ] && found=1 && break; done
        [ $found -eq 0 ] && flag "db-init creates '$db' but it is not in stacks.md database table"
        [ $found -eq 1 ] && log "  OK: $db"
    done
    for sdb in "${stacks_dbs[@]}"; do
        found=0
        for db in "${init_dbs[@]}"; do [ "$db" = "$sdb" ] && found=1 && break; done
        [ $found -eq 0 ] && flag "stacks.md database table lists '$sdb' but db-init does not create it"
        [ $found -eq 1 ] && log "  OK: $sdb"
    done
fi

# ============================================================
# Check 4: project-map.json vs stacks.md
# ============================================================
section "Check 4: project-map.json vs stacks.md"

if ! command -v jq &>/dev/null; then
    log "  WARNING: jq not available — skipping project-map check"
else
    stacks_md_content=$(cat "$STACKS_MD")

    log "Checking each project-map.json entry has a matching stack in stacks.md..."
    while IFS= read -r project; do
        stack=$(jq -r ".projects[\"$project\"].stack" "$PROJECT_MAP")
        log "  project '$project' -> stack '$stack'"
        if ! echo "$stacks_md_content" | grep -qi "$stack"; then
            flag "project '$project' maps to stack '$stack' but '$stack' not found in stacks.md"
        else
            log "    OK: '$stack' found in stacks.md"
        fi
    done < <(jq -r '.projects | keys[]' "$PROJECT_MAP")

    log ""
    log "Checking each project-map.json domain appears in Caddyfile (if set)..."
    while IFS= read -r project; do
        domain=$(jq -r ".projects[\"$project\"].domain // empty" "$PROJECT_MAP")
        [ -z "$domain" ] || [ "$domain" = "null" ] && continue
        found=0
        for cad in "${caddy_domains[@]}"; do
            [ "$cad" = "$domain" ] && found=1 && break
        done
        if [ $found -eq 0 ]; then
            if [ "$domain" = "pointing.cdrift.com" ]; then
                log "  SKIP: $domain (Cloudflare Pages)"
            else
                flag "project '$project' domain '$domain' is in project-map.json but not in Caddyfile"
            fi
        else
            log "  OK: $project -> $domain"
        fi
    done < <(jq -r '.projects | keys[]' "$PROJECT_MAP")
fi

# ============================================================
# Summary
# ============================================================
log ""
log "=================================================="
if [ "$DRIFT" -eq 0 ]; then
    log "RESULT: No drift found. All checks passed."
    log "=================================================="
    exit 0
else
    log "RESULT: Drift detected — see findings marked DRIFT above."
    log "=================================================="
    exit 1
fi
