# Database migrations

The schema is versioned with TypeORM migrations in `src/database/migrations/`. `synchronize` is off everywhere; the application applies pending migrations on boot (`DB_MIGRATIONS_RUN`, default `true`). The connection definition shared by the app and the CLI is `src/database/data-source.ts`.

## Commands (run in `server/pro-act-backend`)

```bash
npm run migration:show                                        # applied / pending
npm run migration:generate -- src/database/migrations/<Name>  # diff entities vs the database in .env → new file
npm run migration:create  -- src/database/migrations/<Name>   # empty migration for data moves / manual SQL
npm run migration:run                                         # apply pending
npm run migration:revert                                      # revert the last applied
```

TypeORM names files `<timestamp>-<Name>.ts` with class `<Name><timestamp>`; keep `<Name>` in PascalCase and descriptive (`EventIntervalModel`, not `Update1`). Plan documents refer to migrations by that name.

## Rules

1. **Every migration has a working `down()`.** Reverting on an empty scratch database is part of CI (`migrations.int-spec.ts`).
2. **Expand and contract** (spec MIG02). A change that could break running code is split into: *expand* (add nullable columns/tables, dual-write) → backfill job → switch reads behind a flag → *contract* (drop old) in a **later** migration/release. Never rename or drop a column that the previous release still reads.
3. **Generate, then read.** `migration:generate` output is a starting point: remove noise, add `CREATE EXTENSION IF NOT EXISTS` where needed, add indexes TypeORM cannot infer (partial, GiST, composite), and make long backfills batched (`UPDATE … WHERE id IN (SELECT … LIMIT 5000)`).
4. **Conventions for new tenant-scoped tables** (spec DB01–DB03): extend `TenantScopedEntity` (`src/common/entities/tenant-scoped.entity.ts`) — UUID `id`, `tenant_id`, audit columns, `row_version`; composite indexes start with `tenant_id`; `CHECK (end_time IS NULL OR end_time > start_time)` on intervals; enums as Postgres `enum` types or checked `varchar`.
5. **Never edit an applied migration.** Fix forward with a new one. Local scratch databases may be dropped and recreated freely.
6. **Data migrations** that depend on business rules (remediation, backfills) are worker jobs with reports, not SQL inside a migration, unless they are trivially idempotent.

## Baseline

`*-Baseline.ts` was generated from the entities against an empty database and **faked** as applied on databases that already carried the synchronize-created schema:

```bash
npm run migration:run -- --fake     # one-time, on an existing database
npm run migration:show              # must list Baseline as applied
npm run migration:generate -- src/database/migrations/DriftCheck   # must report "No changes in database schema were found"
```

Fresh databases (new Compose stacks, CI) get the schema by running the baseline normally on boot.

## Scratch database

```bash
docker exec instrumental-postgres psql -U postgres -c "CREATE DATABASE proact_scratch"
docker exec instrumental-postgres psql -U postgres -d proact_scratch -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'
DB_NAME=proact_scratch npm run migration:run
```

## Integration tests

`npm run test:int` runs the Jest `integration` project (`test/integration/*.int-spec.ts`) against `proact_test` on the server from `.env` (`TEST_DB_NAME` overrides the name; it must end in `_test`). `test/integration/harness.ts` creates the database if missing, recreates the `public` schema per test file, applies all migrations and offers `truncateAll()` between tests. `migrations.int-spec.ts` is the round-trip and entity-parity check that must pass for every new migration.
