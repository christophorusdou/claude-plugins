---
name: backup-truenas
description: Run TrueNAS backup with optional WoL wake and auto-shutdown
disable-model-invocation: true
---

# Backup to TrueNAS

Run the unified N100 backup script that backs up all databases, Forgejo data, and stack configs to TrueNAS.

## Arguments

`$ARGUMENTS` can contain flags:
- (no flags) — default: wake TrueNAS via WoL, backup, auto-shutdown TrueNAS after
- `--no-shutdown` — wake TrueNAS, backup, keep TrueNAS running
- `--no-wol` — skip WoL wake (TrueNAS must already be on), backup only

## Execution

1. Build the SSH command based on `$ARGUMENTS`:
   - Default: `ssh n100 /opt/apps/backup-all-to-truenas.sh --wol`
   - With `--no-shutdown`: `ssh n100 /opt/apps/backup-all-to-truenas.sh --wol --no-shutdown`
   - With `--no-wol`: `ssh n100 /opt/apps/backup-all-to-truenas.sh`
2. Run the command via Bash tool and show the output
3. Report success or failure

## What Gets Backed Up

- Forgejo dump (repositories, config, LFS)
- All Postgres databases (ticket_pointing, zitadel, forgejo, record_keeper, tolgee, claude_dash)
- Stack configuration files
- Destination: `truenas:/mnt/main/backup/n100/{forgejo,postgres,configs}/`
- Retention: 30 days
