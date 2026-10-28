# Traverse Forge — Preparation Log (TF-PREP-001)

Acceptance evidence for each phase. Commands were run on the development machine (Windows 11, Git Bash, Docker Desktop).

## Phase 1 — Analysis (2026-10-26)

| Step | Command / method | Result |
|---|---|---|
| 3.1 inventory | File reads, `rg`, two read-only code sweeps | `ANALYSIS-REPORT.md` §3.1, `analysis/env-vars.md` |
| 3.1 secrets | `git ls-files` key and env patterns; `git grep` for assignments; comparison of dev `.env` values against published values (lengths only, nothing printed) | Stop condition S1 hit: the dev `JWT_SECRET` equals a value in `docs archive/` |
| 3.2 old names | `rg -i` per pattern → `analysis/old-names.txt` | 1,782 lines; summary in report §3.2 |
| 3.3 dev DB | The §3.3 queries against `proact` on `proact-postgres` (read-only) | PG 15.18; schema `public`; extensions uuid-ossp, btree_gist, pg_stat_statements; 155 base tables (`analysis/dev-table-rows.txt`) |
| 3.3 schema dump | `docker exec proact-postgres pg_dump --schema-only --no-owner --no-privileges -d proact` | `analysis/dev-schema.sql` (15,184 lines) |
| 3.4 scratch | `docker run -d --name forge-pg15-scratch … -p 127.0.0.1:55432:5432 postgres:15-alpine`; `npm run migration:run` with `DB_*` pointed at it | 140/140 migrations applied |
| 3.4 diff | `pg_dump` of the scratch DB → `analysis/repo-schema.sql`; `diff -u` → `analysis/schema-drift.diff` | Only difference: runtime partition `measurement_samples_y2026m10` (expected). **No drift.** |
| 3.4 cleanup | `docker rm -f forge-pg15-scratch` | Removed |
| 3.5 / 3.6 | Per-tenant row counts (`analysis/dev-rows-by-tenant.txt`); hierarchy, rate and calendar queries | Report §3.5–3.6 |
| Structure checks | Catalogue queries: tables without PK, `timestamp without time zone` columns, FKs without an index | 1 table without PK (`typeorm_metadata`); 0 non-tz timestamps; 34 FKs without an index (`analysis/fk-without-index.txt`) |

Phase 1 is complete. **Stopped for approval** (TF-PREP-001 §0.1).

Approved by the owner on 2026-10-26, with the answers recorded in `plans/DECISIONS.md` ("First production installation, TF-PREP-001").

## Phase 2 — Naming and configuration (2026-10-26)

| Step | Change | Evidence |
|---|---|---|
| 2.1 names | npm names `traverse-forge-frontend` and `traverse-forge-backend` (package.json and lockfile roots). Images, containers, services and network get their §2 names in the new `deploy/` compose files (Phase 6). Dev tooling names stay (decision). | `npm run typecheck` prints `> traverse-forge-frontend@0.0.0 typecheck`, no errors |
| 2.2 connection | `src/database/connection-env.ts`: `DB_USER` (wins over `DB_USERNAME`), `DB_SCHEMA` (→ `-c search_path=`), `DB_SSL` (true verifies the certificate); `DB_POOL_MAX` already existed; default DB name `traverse_forge` | `connection-env.spec.ts` 5/5 |
| 2.3 schema | SQL stays unqualified and resolves via search_path. Retention partition names unqualified (`data-retention.service.ts`). The `public.` text inside migrations is rewritten to `forge` when V001 is generated (Phase 3). | retention suites pass |
| 2.4 health | `GET /api/health` + `version`, `commit` (`APP_VERSION`, `GIT_COMMIT`); new public `GET /api/health/ready` (200/503); added to `PUBLIC_ROUTE_ALLOWLIST` | `health.controller.spec.ts` 4/4 |
| 2.5 plant config | Time zone and shifts are site data. `FORGE_PLANT_TIMEZONE` is a seed parameter (decision). | — |
| 2.6 no migrations at start-up | `runMigrationsOnBoot` is opt-in (`DB_MIGRATIONS_RUN=true`). Nothing seeds at start-up (Phase 1). | `run-migrations-on-boot.spec.ts` 4/4 |
| extra | Swagger switch `FORGE_SWAGGER` (off by default in production; kept on in docker-compose.yml) | `swagger-enabled.spec.ts` 2/2 |
| 2.7 | `deploy/.env.example`: every variable, placeholders only | `CHANGE_ME` for every secret |
| S1 | Published credentials replaced by `<redacted>` in 9 stale docs | `git grep` for both values: 0 files |

Checks:
- Backend `npx tsc --noEmit -p tsconfig.json`: no errors.
- Frontend `npm run typecheck`: no errors.
- `npx eslint` on the changed files: clean. The one remaining error is older and sits in the applied migration `1794030000000-ProvisionalFxRates.ts`, which was not touched.
- Jest on the changed areas (database, health, common/http, retention, security): 7 suites, 27 tests passed.

Start-up against the dev database: `PORT=4099 PROCESS_ROLE=api DB_SCHEMA=public DB_MIGRATIONS_RUN=false APP_VERSION=0.0.0-phase2 GIT_COMMIT=961a1896 npx nest start`

```
GET /api/health        200 {"status":"healthy",…,"database":"connected","version":"0.0.0-phase2","commit":"961a1896"}
GET /api/health/ready  200 {"status":"ready","database":"connected"}
GET /api               200 (Swagger, outside production)
POST /api/auth/login   200 (admin@hdpe-train.mpc)
```

Old names: the remaining `proact` mentions are intentional (dev tooling, localStorage keys, MQTT topics owned by data engineering, the RLS role `proact_rls_user`, test data). See `ANALYSIS-REPORT.md` §3.2.

**Still open:** the dev `JWT_SECRET` in `server/pro-act-backend/.env` should be rotated by the owner, since `.env` files are not edited by the agent. Signing in again is needed afterwards.

## Phase 3 — Database: baseline, migration export, bootstrap (2026-10-28)

Commits `d448ba40`, `518b86e7`, `583129d9`, `bd856bf6`, `d13d20f2`, `3c9eeecb`, `a59901b4`, `01f100ab`, `7c17fc36`.

| Step | Command | Result |
|---|---|---|
| FK indexes migration | `FkIndexes1794242000000` (34 `CREATE INDEX IF NOT EXISTS`); `DB_MIGRATIONS_DIR` selects a staged migrations folder | `npx jest src/database` green (`fk-indexes.spec.ts`, `connection-env.spec.ts`) |
| V001 export | `bash deploy/db/export-baseline.sh --through 1794241400000` | `staged 144 migrations`, `executed 144 migrations`; `db/migrations/V001__baseline.sql` in schema `forge`, 144 ledger rows |
| V001 verify | V001 on a scratch PG 15 vs the migrations on another; `deploy/db/verify-schema.sh` | identical: tables 154, columns 2771, constraints 551, indexes 708, policies 144, functions 23, triggers 38 (`deploy/db/tests/evidence/v001-verify.txt`) |
| rewrite rules | `bash deploy/db/tests/test-rewrite-schema.sh` | `ok 25/25` |
| export guards | `bash deploy/db/tests/test-export-guards.sh` | `ok 8/8` |
| V002 export | `bash deploy/db/export-migration.sh --name FkIndexes1794242000000 --version 002 --slug fk_indexes` (logging path) | `applied 1, skipped 0`; `V002__fk_indexes.sql` (34 indexes, no `public`, no transaction control) |
| bootstrap + apply | `00-create-db-and-roles.sh` → `10-migrate.sh` (ledger `forge.deploy_migrations`, checksums, RLS grants) | `bash deploy/db/tests/test-migrate.sh` → `ok 16/16` (fresh apply, idempotent re-run, tampered file refused, RLS role reads `forge`) |
| checksums | `bash deploy/db/checksums.sh --check` | `ok` |

## Phase 4 — Reference seed (2026-10-28)

Commits `c46b70f7`, `ee727773`.

| Step | Command | Result |
|---|---|---|
| extraction | backend `scripts/deploy/extract/` against tenant `HDPE-TRAIN` of the dev database (read-only) | `db/seed/reference/R010…R060`, `db/seed/manifest.json`, git-ignored `db/seed/generated/U010__users.sql` |
| unit tests | `npx jest scripts/deploy` | `Tests: 18 passed` (FK order, SQL writer, table plan) |
| seed | `20-seed-reference.sh [--with-users]` on a scratch PG 15 after 00 → 10 | `bash deploy/db/tests/test-seed.sh` → `ok 11/11` (counts ≥ manifest, idempotent re-run, no dangling state mapping, extra rows tolerated) |
| connections | `integration_connections` seeded `is_active = false`, `secret_ref` NULL, with their signals (R060) | state and source mappings resolve; no secret in the repository |

## Phase 5 — Users (2026-10-28)

Commits `ab0ebb2f`, `3d39fb5d`.

| Step | Command | Result |
|---|---|---|
| CLI unit tests | `npx jest scripts/deploy/seed-users` | 7/7 (CSV parsing, `scope_role` validation, password generator) |
| CLI end to end | `bash deploy/db/tests/test-seed-users.sh` | `ok 12/12` (created 2 then skipped 2, scopes, no password on stdout; existing file, bad `scope_role`, `DB_NAME=proact` and an in-repo path refused) |
| VM wrapper | `deploy/db/30-seed-users.sh --csv <file> --out-dir $FORGE_HOME/private` (the CLI in the backend image on `PG_NETWORK`) | first run in the Phase 8 rehearsal |

## Phase 6 — Images and compose (2026-10-28)

Commit `466646f7`.

| Step | Command | Result |
|---|---|---|
| images | backend (Debian bookworm-slim) and frontend (`nginx-unprivileged`, uid 101, port 8080) with `APP_VERSION`, `GIT_COMMIT`, OCI labels | `bash deploy/tests/test-images.sh` → `ok 7/7` |
| nginx | security headers; `/piwebapi` answers 404 unless `PI_SERVER` is set | covered by `test-images.sh` |
| compose | `deploy/docker-compose.forge.yml` (project `traverse-forge`: backend, worker, frontend; volumes `forge-uploads`, `forge-exports`), `deploy/docker-compose.local.yml` (rehearsal postgres) | `docker compose config` renders with `deploy/tests/fixtures/forge.env` |
| variables | `deploy/BUILD-VARS.md` | build arguments, runtime variables, compose commands |

## Phase 7 — Build, bundle and VM scripts (2026-10-28)

Commits `095e3d1a`, `98884575`.

| Step | Command | Result |
|---|---|---|
| build + bundle + install | `bash deploy/tests/test-bundle.sh` (build `t1`, `package-bundle.sh`, `install.sh` into a temp `FORGE_HOME`, refusals of `load-and-start.sh`, `bash -n` on every script) | `ok 8/8` |
| VM procedure | `deploy/vm/VM-STEPS.template.md` (first install, update, rollback; expected last line per step) | exercised end to end in Phase 8 |
| backups | `backup-forge.sh`: `pg_dump -Fc -n forge` + uploads archive (frontend image's tar), mode 600 in a mode 700 folder, newest `BACKUP_KEEP` kept | exercised in Phase 8 |

## Phase 8 — Rehearsal on a scratch PostgreSQL 15 (2026-10-28)

`REHEARSAL_PASSWORD=… bash deploy/tests/rehearsal.sh --keep` (log: `deploy/tests/evidence/rehearsal-2026-10-28.log`;
no secret in it, checked against `deploy/.env.local` and the dev password). It runs the operator's scripts in the
order of `deploy/vm/VM-STEPS.template.md` (the database scripts from the installed release, as on the VM) against
the bundled `forge-rehearsal-pg` (`postgres:15-alpine`, 127.0.0.1:55436, network `forge-rehearsal-pgnet`), with a
temp `FORGE_HOME`, UI port 8096 and `FORGE_COMPOSE_EXTRA="-f deploy/docker-compose.local.yml"`.

| Step | Command | Result (last line) |
|---|---|---|
| env | generated `deploy/.env.local` (`openssl rand`, git-ignored, mode 600) | `wrote deploy/.env.local (values not shown)` |
| build | `build-images.sh --version rehearsal --allow-dirty` | `built traverse-forge-frontend:rehearsal` |
| bundle | `package-bundle.sh --version rehearsal --out <tmp>` | `bundle …/traverse-forge-rehearsal.tar.gz (148M)` |
| no local images | `docker rmi traverse-forge-*:rehearsal` (the VM has none) | removed; `load-and-start.sh` loads them from `images.tar` |
| A.2 install | `install.sh <bundle>` | `installed rehearsal at <FORGE_HOME>/releases/rehearsal` |
| A.3 env | `.env.local` copied to `$FORGE_HOME/.env` (the real flow edits the template) | copied |
| database up | `vm_compose rehearsal up -d postgres`, `pg_isready -h 127.0.0.1` | `postgres ready: forge-rehearsal-pg (127.0.0.1:55436)` |
| A.5 bootstrap | `$R/deploy/db/00-create-db-and-roles.sh --env $FORGE_HOME/.env` | `skip: pg_stat_statements not preloaded` |
| A.6 migrate | `$R/deploy/db/10-migrate.sh` | `migrations: applied 2, skipped 0` |
| A.7 seed | `$R/deploy/db/20-seed-reference.sh --with-users` | `seed ok` |
| A.8 start | `$R/deploy/vm/load-and-start.sh rehearsal` (docker load, compose up, `verify.sh`) | `verify ok rehearsal` |
| health | `GET :8096/api/health/ready`, `GET :8096/api/health` | `health: ready 200, version rehearsal (through :8096)` |
| sign-in | `POST :8096/api/auth/login` as admin and reza (password from `REHEARSAL_PASSWORD`, sent on stdin) | HTTP 200 each, tenant `433c1a69-…` |
| policy | `GET /api/v2/loss-accounting` + `GET /api/v2/units/<accountingUnitId>` | `loss accounting v3: grain day, lossBasis declared, unit HDPE Extruder 1` |
| events | `GET /api/v2/production-events?limit=1` as reza | `items []` |
| users | `$R/deploy/db/30-seed-users.sh --csv deploy/seed-users.csv.example --out-dir $FORGE_HOME/private` | `created 2, skipped 0`; passwords file in `$FORGE_HOME/private` |
| A.10 backup | `$R/deploy/vm/backup-forge.sh` | `…/backups/traverse-forge-uploads-<utc>.tar.gz` |
| A.10 restore | `$R/deploy/vm/restore-test.sh <dump>` | `restore ok: 155 tables (units 2 rows, users 16 rows) in traverse_forge_restore_…, dropped` |
| C rollback | `$R/deploy/vm/rollback.sh` | refused, exit 1: `no previous version recorded …; nothing to roll back to` |
| total | | `rehearsal ok (391s)` |

Fix found by the rehearsal (first real run of `30-seed-users.sh`): the image's entrypoint started the API with the
CLI arguments appended, so the container never exited; the script now runs `--entrypoint node`, and passes the CSV
and output folder to `docker run -v` in host form (`cygpath -w` under Git Bash, as `backup-forge.sh` does).

The screen check by role (admin, reza, omid, sara, leila, farid on `http://localhost:8096`) is recorded separately.
Teardown: `bash deploy/tests/rehearsal.sh --teardown <FORGE_HOME>` (compose `down -v`, the `:rehearsal` images,
the temp folder).

Full checks (2026-10-28, after the rehearsal):

```
npm run typecheck (root)                          no errors
npx tsc --noEmit -p tsconfig.json (backend)       no errors
npx jest src/database scripts/deploy (backend)    Test Suites: 10 passed, 10 total; Tests: 45 passed, 45 total
bash deploy/db/tests/test-rewrite-schema.sh       ok 25/25
bash deploy/db/tests/test-export-guards.sh        ok 8/8
bash deploy/db/tests/test-migrate.sh              ok 16/16
bash deploy/db/tests/test-seed.sh                 ok 11/11
bash deploy/db/tests/test-seed-users.sh           ok 12/12
bash deploy/tests/test-images.sh                  ok 7/7
bash deploy/tests/test-bundle.sh                  ok 8/8
```

### Phase 8 — on-screen check by role (2026-10-28, rehearsal stack on :8096)

| Role | Page | Result |
|---|---|---|
| admin | Admin panel → Settings | "Loss accounting: Daily accounting from 00:00 · declared by the OT production loss event · target: OT planned figure · unit: HDPE Extruder 1 · product: HDPE grade A" (`evidence/rehearsal-settings-admin.png`) |
| reza | Accounting statement | Opens, "No complete period to state in this selection", no error (`evidence/rehearsal-statement-reza.png`) |
| omid | Event Hub, Type = Production loss | "No events", "Production loss to code 0", Code/New event available (`evidence/rehearsal-events-omid.png`) |
| sara | Event Hub | Renders read-only for the role, no events |
| leila | Production loss analysis · Overview | Renders, "0 % of periods calculated" (no data yet) |
| farid | Event Hub | Renders, no events |

All six sign-ins used the seeded accounts (password hashes carried over from the development database).

### Phase 8 — rehearsal re-run after the final-review fixes (2026-10-28)

| Step | Command | Result |
|---|---|---|
| Full rehearsal on the fixed scripts (2f0ba565) | `bash deploy/tests/rehearsal.sh` | `rehearsal ok (251s)`; `restore ok: 155 tables (units 2 rows, users 16 rows)`; `rollback` refused as expected (no previous version); `teardown ok`. Log: `tests/evidence/rehearsal-2026-10-28-final.log` (no secret values present) |
