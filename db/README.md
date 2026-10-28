# db/ — production database SQL (TF-PREP-001)

Production applies these files, in version order, to database `traverse_forge`, schema `forge`, on the
shared PostgreSQL 15 server. TypeORM migrations under `server/pro-act-backend/src/database/migrations`
remain the authoring tool; the files here are exported from them and never edited by hand.

| Path | Content |
|------|---------|
| `migrations/V001__baseline.sql` | Schema built by the TypeORM migrations through `1794241400000` (144 files), plus their `migrations` / `typeorm_metadata` rows, in schema `forge` |
| `migrations/V002__fk_indexes.sql` | TypeORM migration `FkIndexes1794242000000`: 34 foreign-key indexes |
| `seed/reference/R0x0__*.sql` | Reference seed of plant `HDPE-TRAIN` / organisation `MPC-TRAIN`, extracted from the dev database by `deploy/db/extract-reference-from-dev.sh` (never hand-edited) |
| `seed/reference/R060__connections_signals.sql` | The plant's integration connections and signals. Connections are seeded inactive without secrets; set the broker/PI endpoints and credentials in Settings → Integrations on the VM and activate them. |
| `seed/manifest.json` | Source tenant / organisation ids, row count per seeded table, tables per seed file |
| `seed/generated/U010__users.sql` | **Git-ignored.** The plant's accounts with their dev password hashes; carried to the VM by hand |
| `CHECKSUMS.sha256` | SHA-256 of every `*.sql` under `db/` except `seed/generated/` (`<sha256>  <path relative to db/>`) |

## Conventions

- Objects live in `forge`; the files set `search_path = forge, public`. Extensions (`uuid-ossp`,
  `btree_gist`, optional `pg_stat_statements`) stay in `public` and are created by
  `deploy/db/00-create-db-and-roles.sh`, as is the role `proact_rls_user`. No `CREATE ROLE` in `db/`.
- Grants to `proact_rls_user`: schema USAGE and per-table grants come from the migration files;
  default privileges for new objects come from `deploy/db/00-create-db-and-roles.sh`, which runs
  `ALTER DEFAULT PRIVILEGES FOR ROLE "$DB_USER" IN SCHEMA "$DB_SCHEMA"` (tables: SELECT, INSERT, UPDATE,
  DELETE; sequences: USAGE, SELECT, UPDATE) before V001 is applied, so tables created by V001 and by every
  later migration get their grants. The dev login's `ALTER DEFAULT PRIVILEGES` lines are not exported.
- An applied file never changes. A schema change is a new TypeORM migration exported as the next `V<nnn>`.
- Line endings are LF (`.gitattributes`), so checksums match on every checkout.

## Tooling (`deploy/db/`)

```bash
# Re-export the baseline (throwaway postgres:15-alpine container forge-export-pg on 127.0.0.1:55432)
bash deploy/db/export-baseline.sh --through 1794241400000 --out db/migrations/V001__baseline.sql
# Refresh / verify the checksums
bash deploy/db/checksums.sh
bash deploy/db/checksums.sh --check
# Object counts of one schema (compare TypeORM-built public with SQL-built forge)
DB_CONTAINER=<container> DB_USER=<user> DB_PASSWORD=<password> bash deploy/db/verify-schema.sh <db> <schema>
# Rewrite-rule unit test; bootstrap + migrate end to end (forge-migrate-pg on 127.0.0.1:55434)
bash deploy/db/tests/test-rewrite-schema.sh
bash deploy/db/tests/test-migrate.sh
# Re-extract the seed from dev (read-only) and refresh the checksums; seed end to end (forge-seed-pg, :55435)
bash deploy/db/extract-reference-from-dev.sh
bash deploy/db/tests/test-seed.sh
```

Verification of V001: `deploy/db/tests/evidence/v001-verify.txt`.

## Release recipe (schema change)

In the repository:

1. Author a TypeORM migration in `server/pro-act-backend/src/database/migrations`. Keep names
   unqualified (no `public.`, no schema literal) so the same SQL runs in `public` (dev) and `forge`
   (production). No query parameters (`queryRunner.query(sql, [params])`): the export refuses them.
   No `BEGIN` / `COMMIT` in the SQL.
2. Run it on the dev database (`npm run migration:run`) and test the feature.
3. Export it as the next version, then refresh the checksums:
   ```bash
   bash deploy/db/export-migration.sh --name <MigrationClassName> --version <nnn> --slug <slug>
   bash deploy/db/checksums.sh
   ```
   The exporter bootstraps a throwaway container (`forge-export-pg`, 127.0.0.1:55432), applies the
   existing `V*.sql` with `10-migrate.sh`, refuses unless `<MigrationClassName>` is the only pending
   migration, runs it with `DB_SCHEMA=forge DB_LOGGING=true` and writes the logged statements plus the
   `forge.migrations` row. Read the file before committing.
4. Commit the TypeORM migration, `db/migrations/V<nnn>__<slug>.sql` and `db/CHECKSUMS.sha256` together.

On the VM (env file with `DB_CONTAINER`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA=forge`: `--env
<file>`, else `./.env`, else `$FORGE_HOME/.env`):

```bash
bash deploy/db/00-create-db-and-roles.sh      # first install; idempotent, ok|skip per step
bash deploy/db/10-migrate.sh --dry-run        # apply|skip per file
bash deploy/db/10-migrate.sh                  # before load-and-start.sh
bash deploy/db/20-seed-reference.sh --with-users   # first install; re-run is a no-op, ends with `seed ok`
```

`10-migrate.sh` verifies `CHECKSUMS.sha256`, then applies each pending file in one transaction with its
row in `forge.deploy_migrations` (version, file, checksum, applied_at, applied_by) and the
`proact_rls_user` table/sequence grants. A file whose checksum differs from the one recorded when it
was applied stops the run before anything is applied: never edit an applied file, export a new version.
