# Traverse Forge — VM steps (release `<version>`)

Target: `<VM address>`, Linux with Docker Engine and Docker Compose v2, no internet. Run every command as the
deploy user (member of the `docker` group). `FORGE_HOME` is `/opt/traverse-forge` (export another path in
every shell if it differs). The database container (`DB_CONTAINER`, default `instrumental-postgres`) and its
network (`PG_NETWORK`) already run on the VM.

Each step gives the command and the **expected last line**. Stop at the first step whose last line differs.

Compose names the stack `traverse-forge`; its volumes are `traverse-forge_forge-uploads` (uploaded files,
backed up) and `traverse-forge_forge-exports` (report exports, regenerable), its private network
`traverse-forge_forge`.

The bundle (`traverse-forge-<version>.tar.gz`) and every release folder contain the accounts' password
hashes: handle them like a backup, keep them owner-only, and delete the copied bundle once installed.

## Prerequisites

- The `DB_USER` login on the database server needs **SUPERUSER**, or **CREATEDB + CREATEROLE**; otherwise a
  DBA pre-creates the database `traverse_forge` (owner `DB_USER`), the role `proact_rls_user`
  (`NOLOGIN NOBYPASSRLS`) and the membership grant (`GRANT proact_rls_user TO <DB_USER>`).
- A login that is not a superuser also needs, once, from a superuser (PostgreSQL 15):
  `GRANT SET ON PARAMETER app.tenant_ids TO <DB_USER>;` (V001 defines functions that set it) and
  `ALTER ROLE <DB_USER> BYPASSRLS;` (`backup-forge.sh`'s pg_dump reads tables with forced row-level
  security; requests still run as `proact_rls_user`).
- `00-create-db-and-roles.sh` checks all of this and stops with what is missing named
  (`error: <user> lacks CREATEROLE ...` or `error: <user> lacks rights only a superuser grants; a superuser
  runs: <statements>`).
- `.env` values are unquoted and must not contain `$`, `"`, `'`, `#` or spaces (the scripts refuse them,
  naming the variable).

## A. First install

1. Copy the bundle from the build workstation:

   ```bash
   scp dist/bundle/traverse-forge-<version>.tar.gz <deploy user>@<VM address>:~/
   ```

   Last line: the scp progress line ending in `100%`.

2. On the VM, unpack the scripts only and install the bundle:

   ```bash
   sudo mkdir -p /opt/traverse-forge && sudo chown "$USER": /opt/traverse-forge
   mkdir -p ~/forge-inbox && tar xzf ~/traverse-forge-<version>.tar.gz -C ~/forge-inbox traverse-forge-<version>/deploy
   bash ~/forge-inbox/traverse-forge-<version>/deploy/vm/install.sh ~/traverse-forge-<version>.tar.gz
   ```

   Last line: `installed <version> at /opt/traverse-forge/releases/<version>` (preceded by
   `ACTION: edit /opt/traverse-forge/.env ...` on the first install; a `warn: .env lacks <NAME>` line names
   a variable of the new `.env.example` that an existing `.env` does not have yet: add it). Then remove the
   unpacked scripts and the copied bundle (the installed copy lives under `releases/<version>/`, mode 700;
   both hold password hashes):

   ```bash
   rm -rf ~/forge-inbox/traverse-forge-<version>
   rm ~/traverse-forge-<version>.tar.gz
   ```

   Last line: none.

   **Re-install a damaged release** (`install.sh` refuses a version that is already installed, and a
   failed `MANIFEST.sha256` check means the copied archive is damaged: copy it again first). Never remove
   the release that `/opt/traverse-forge/current-version` names while it runs:

   ```bash
   rm -rf /opt/traverse-forge/releases/<version>
   mkdir -p ~/forge-inbox && tar xzf ~/traverse-forge-<version>.tar.gz -C ~/forge-inbox traverse-forge-<version>/deploy
   bash ~/forge-inbox/traverse-forge-<version>/deploy/vm/install.sh ~/traverse-forge-<version>.tar.gz
   ```

   Last line: `installed <version> at /opt/traverse-forge/releases/<version>`. Then remove the unpacked
   scripts and the bundle as above (`rm -rf ~/forge-inbox/traverse-forge-<version>` and
   `rm ~/traverse-forge-<version>.tar.gz`).

3. Fill in the environment: `vi /opt/traverse-forge/.env` — replace every `CHANGE_ME` (database login and
   password, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDENTIAL_ENCRYPTION_KEYS`, `CORS_ORIGIN` =
   `http://<VM address>:8095`). Leave `FORGE_VERSION` alone. Check:

   ```bash
   grep -E '^[A-Z_]+=.*CHANGE_ME' /opt/traverse-forge/.env | grep -vc '^FORGE_VERSION='
   ```

   Last line: `0` (`FORGE_VERSION=CHANGE_ME` may stay: step 8 sets it).

4. Set the release folder for the next commands:

   ```bash
   cd /opt/traverse-forge && R=/opt/traverse-forge/releases/<version>
   ```

   Last line: none.

5. Create the database, the RLS role, the schema and the migration ledger:

   ```bash
   bash $R/deploy/db/00-create-db-and-roles.sh --env /opt/traverse-forge/.env
   ```

   First lines: `ok login-rights (superuser)` (or `(createdb+createrole)` / `(pre-created by a DBA)`) and
   `ok password`. Last line: `ok extension pg_stat_statements` or a `skip ... pg_stat_statements` line
   (optional), no `error:`. `error: DB_PASSWORD rejected by <container> for <user>`: correct `DB_PASSWORD`
   in `.env` and run the step again.

6. Apply the migrations:

   ```bash
   bash $R/deploy/db/10-migrate.sh --env /opt/traverse-forge/.env
   ```

   Last line: `migrations: applied <n>, skipped 0`.

7. Load the reference data and the generated users:

   ```bash
   bash $R/deploy/db/20-seed-reference.sh --env /opt/traverse-forge/.env --with-users
   ```

   Last line: `seed ok` (after one `seed: <table> <actual>/<manifest>` line per table).

8. Load the images and start the stack (runs `verify.sh` at the end):

   ```bash
   bash $R/deploy/vm/load-and-start.sh <version>
   ```

   Last line: `verify ok <version>`. When it stops earlier (health check timeout, backend restarting),
   read the backend's last lines: `docker logs traverse-forge-backend --tail 50`.

9. Connect the plant's data feeds. Sign in as `admin@hdpe-train.mpc` and open **Connectivity**
   (`http://<VM address>:8095/connectivity`; the seeded connections arrive inactive and without secrets):
   set the data-engineering MQTT broker / PI Web API endpoints and credentials on the connections the plant
   uses (`Edit`), then `Activate` each of them. The test and sample rows `E2E MQTT feeds (PLA + downtime)`,
   `Marun OT feeds (UI e2e)` and `SIM Marun PI (sample)` must not run in production: the console has no
   delete action, so leave them **Inactive** (never activate them).

   Result: every connection the plant uses shows `Active`, the three test/sample rows show `Inactive`.

10. Verify again at any time:

    ```bash
    bash $R/deploy/vm/verify.sh
    ```

    Last line: `verify ok <version>`. In a browser: `http://<VM address>:8095/` shows the sign-in page.

11. Take the first backup and prove it restores:

    ```bash
    bash $R/deploy/vm/backup-forge.sh
    bash $R/deploy/vm/restore-test.sh "$(ls -1 /opt/traverse-forge/backups/traverse-forge-*.dump | tail -1)"
    ```

    Last lines: `/opt/traverse-forge/backups/traverse-forge-uploads-<utc>.tar.gz`, then
    `restore ok: <n> tables (units <a> rows, users <b> rows) in traverse_forge_restore_<ts>, dropped`.

12. Optional — additional accounts (random passwords, written to `/opt/traverse-forge/private/`):

    ```bash
    cp $R/seed-users.csv.example /opt/traverse-forge/seed-users.csv && chmod 600 /opt/traverse-forge/seed-users.csv
    vi /opt/traverse-forge/seed-users.csv
    bash $R/deploy/db/30-seed-users.sh --csv /opt/traverse-forge/seed-users.csv --env /opt/traverse-forge/.env
    ```

    Last line: `passwords file: /opt/traverse-forge/private/passwords-<date>.txt (read it once, ...)`. Hand the
    passwords over, then delete that file.

## B. Update to a new release

1. Copy and install the new bundle (steps A.1 and A.2 with the new `<version>`).
   Last line: `installed <version> at /opt/traverse-forge/releases/<version>` (no `ACTION:` line: `.env` is kept).
2. Back up first: `bash /opt/traverse-forge/releases/<version>/deploy/vm/backup-forge.sh`.
   Last line: the path of the uploads archive.
3. Show the pending migrations, then apply them:

   ```bash
   R=/opt/traverse-forge/releases/<version>
   bash $R/deploy/db/10-migrate.sh --env /opt/traverse-forge/.env --dry-run
   bash $R/deploy/db/10-migrate.sh --env /opt/traverse-forge/.env
   ```

   Last lines: `dry run: would apply <n>, skip <m>`, then `migrations: applied <n>, skipped <m>`.
4. Switch the stack: `bash $R/deploy/vm/load-and-start.sh <version>`.
   Last line: `verify ok <version>`. `load-and-start.sh` exits 2 with `run deploy/db/10-migrate.sh first`
   when step 3 was skipped.
5. Prune old releases: keep the current and the previous one (`current-version`, `previous-version`):

   ```bash
   cat /opt/traverse-forge/current-version /opt/traverse-forge/previous-version
   ls /opt/traverse-forge/releases
   rm -rf /opt/traverse-forge/releases/<older version>
   ```

   Last line: none (`ls` then lists the two kept versions).

## C. Roll back

```bash
bash /opt/traverse-forge/releases/<version>/deploy/vm/rollback.sh
```

Last line: `rolled back to <previous version>` (after `verify ok <previous version>`).

The database stays on the newer schema: migrations are additive, so the previous release runs on it. A
release with a non-additive migration ships its own rollback plan; restore a backup only under that plan.

## D. Disaster restore (database lost or damaged)

Only when the database `traverse_forge` is gone (or a DBA has dropped the damaged one). `<current>` is the
content of `/opt/traverse-forge/current-version`, `<dump>` a `traverse-forge-traverse_forge-<utc>.dump` from
`/opt/traverse-forge/backups/` (check it first with `restore-test.sh`, step A.11).

```bash
R=/opt/traverse-forge/releases/<current>
docker stop traverse-forge-frontend traverse-forge-worker traverse-forge-backend
bash $R/deploy/db/00-create-db-and-roles.sh --env /opt/traverse-forge/.env
set -a && . /opt/traverse-forge/.env && set +a
PGPASSWORD="$DB_PASSWORD" docker exec -i -e PGPASSWORD "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -c 'DROP TABLE forge.deploy_migrations'
PGPASSWORD="$DB_PASSWORD" docker exec -i -e PGPASSWORD "$DB_CONTAINER" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" -n forge --no-owner --exit-on-error < /opt/traverse-forge/backups/<dump>
bash $R/deploy/vm/load-and-start.sh <current>
```

The empty ledger table that `00` creates is dropped because the dump brings its own. Last line:
`verify ok <current>`. Restore the uploads archive of the same time into the `traverse-forge_forge-uploads`
volume if files were lost too.

## Files on the VM

| Path | Content |
|---|---|
| `/opt/traverse-forge/.env` | runtime variables, mode 600, never overwritten by `install.sh` |
| `/opt/traverse-forge/releases/<version>/` | unpacked bundle (mode 700; holds password hashes): `images.tar`, `db/`, `deploy/db/`, `deploy/vm/`, compose file, `VERSION`, `MANIFEST.sha256`; keep current and previous only (B.5) |
| `/opt/traverse-forge/current-version`, `previous-version` | running release and rollback target |
| `/opt/traverse-forge/private/` | generated passwords (mode 700) |
| `/opt/traverse-forge/backups/` | `traverse-forge-<db>-<utc>.dump`, `traverse-forge-uploads-<utc>.tar.gz`, `.sha256` files; newest `BACKUP_KEEP` (14) kept |
