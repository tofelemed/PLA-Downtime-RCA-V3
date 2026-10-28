# Traverse Forge — VM steps (release `<version>`)

Target: `<VM address>`, Linux with Docker Engine and Docker Compose v2, no internet. Run every command as the
deploy user (member of the `docker` group). `FORGE_HOME` is `/opt/traverse-forge` (export another path in
every shell if it differs). The database container (`DB_CONTAINER`, default `instrumental-postgres`) and its
network (`PG_NETWORK`) already run on the VM.

Each step gives the command and the **expected last line**. Stop at the first step whose last line differs.

Compose names the stack `traverse-forge`; its volumes are `traverse-forge_forge-uploads` (uploaded files,
backed up) and `traverse-forge_forge-exports` (report exports, regenerable), its private network
`traverse-forge_forge`.

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
   `ACTION: edit /opt/traverse-forge/.env ...` on the first install). Then remove the unpacked scripts
   (the installed copy lives under `releases/<version>/deploy/`):

   ```bash
   rm -rf ~/forge-inbox/traverse-forge-<version>
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

   Last line: `installed <version> at /opt/traverse-forge/releases/<version>`.

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

   Last line: `ok extension pg_stat_statements` or a `skip ... pg_stat_statements` line (optional), no `error:`.

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

   Last line: `verify ok <version>`.

9. Verify again at any time:

   ```bash
   bash $R/deploy/vm/verify.sh
   ```

   Last line: `verify ok <version>`. In a browser: `http://<VM address>:8095/` shows the sign-in page.

10. Take the first backup and prove it restores:

    ```bash
    bash $R/deploy/vm/backup-forge.sh
    bash $R/deploy/vm/restore-test.sh "$(ls -1 /opt/traverse-forge/backups/traverse-forge-*.dump | tail -1)"
    ```

    Last lines: `/opt/traverse-forge/backups/traverse-forge-uploads-<utc>.tar.gz`, then
    `restore ok: <n> tables (units <a> rows, users <b> rows) in traverse_forge_restore_<ts>, dropped`.

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

## C. Roll back

```bash
bash /opt/traverse-forge/releases/<version>/deploy/vm/rollback.sh
```

Last line: `rolled back to <previous version>` (after `verify ok <previous version>`).

The database stays on the newer schema: migrations are additive, so the previous release runs on it. A
release with a non-additive migration ships its own rollback plan; restore a backup only under that plan.

## Files on the VM

| Path | Content |
|---|---|
| `/opt/traverse-forge/.env` | runtime variables, mode 600, never overwritten by `install.sh` |
| `/opt/traverse-forge/releases/<version>/` | unpacked bundle: `images.tar`, `db/`, `deploy/db/`, `deploy/vm/`, compose file, `VERSION`, `MANIFEST.sha256` |
| `/opt/traverse-forge/current-version`, `previous-version` | running release and rollback target |
| `/opt/traverse-forge/private/` | generated passwords (mode 700) |
| `/opt/traverse-forge/backups/` | `traverse-forge-<db>-<utc>.dump`, `traverse-forge-uploads-<utc>.tar.gz`, `.sha256` files; newest `BACKUP_KEEP` (14) kept |
