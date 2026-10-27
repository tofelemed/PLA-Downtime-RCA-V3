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
