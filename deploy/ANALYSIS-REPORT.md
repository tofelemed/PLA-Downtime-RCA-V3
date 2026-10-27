# Traverse Forge — Phase 1 Analysis Report (TF-PREP-001 §3)

| Field | Value |
|---|---|
| Work package | TF-PREP-001 Rev A |
| Phase | 1 — Analysis (read-only) |
| Date | 2026-10-26 |
| Branch / commit | `feat/downtime-area2-b` @ `961a1896` (working tree has uncommitted changes from other work) |
| Dev database inspected | `proact` on container `proact-postgres` (PostgreSQL 15.18, host port 5432) |
| Status | **Approved 2026-10-26** (answers in `plans/DECISIONS.md`). Phase 2 done; see `PREP-LOG.md`. |

Evidence files are in `deploy/analysis/`:

| File | Content |
|---|---|
| `dev-schema.sql` | Schema dump of the dev database |
| `repo-schema.sql` | Schema dump after the 140 migrations ran on a scratch PostgreSQL 15 |
| `schema-drift.diff` | Diff of the two dumps |
| `dev-table-rows.txt` | Row count per table |
| `dev-rows-by-tenant.txt` | Row count per table and tenant |
| `old-names.txt` | Every old-name occurrence, with file and line |
| `env-vars.md` | Full environment-variable inventory |
| `fk-without-index.txt` | Foreign keys without a supporting index |

---

## 0. Summary — stop conditions hit (§0.6)

Four of the five stop conditions are hit. Each needs a decision before Phase 2.

| # | Stop condition | Finding | Detail |
|---|---|---|---|
| S1 | Secret committed | **Yes.** The dev backend's `JWT_SECRET` (in git-ignored `server/pro-act-backend/.env`) equals the 8-character value printed in the tracked file `docs archive/JWT_SECRET_MISMATCH_FIX.md`. The same folder holds a legacy SQL Server `sa` password (`docs archive/DATABASE_CREDENTIALS_UPDATED.md`). Tracked dev-only material: the MQTT CA and server private keys (`docker/mosquitto/certs/dev-*.key`), the broker `passwd` file, and the dev broker password as a script default (`server/pro-act-backend/scripts/marun-train/train-catalog-setup.ts:68`). | §3.1.8 |
| S2 | Code hard-codes `public` | **Yes.** 702 occurrences in 79 of 140 migrations. At runtime: `src/common/retention/data-retention.service.ts:42,48,120`. Inside database functions: `to_regclass('public.' …)` and `SET search_path = public, pg_temp` (partition helpers and the RLS functions). | §3.1.5 |
| S3 | Role model differs from §7.1 | **Yes.** There are 7 global "legacy" roles plus 12 plant-scoped roles. There is no Supervisor role and no global Viewer role. Plant scope is per tenant (= plant) through `user_scopes`. | §3.1.6 |
| S4 | Destructive change needed | **Yes, for one runtime path.** The retention job drops monthly partitions (`DROP TABLE`). This needs ownership, so it fails under the DML-only `traverse_forge_app`. No destructive schema change is needed. | §3.1.5 |
| S5 | Dev schema differs from repo `.sql` | **No real drift.** The repo `.sql` files are stale and nothing applies them. The real source is the 140 TypeORM migrations, and they reproduce the dev schema exactly. The only difference is one partition the app created at runtime. | §3.4 |

There is also a finding that rule §0.3 ("never invent plant data") makes blocking:

> **The dev HDPE data is training data, not plant data.** Organisation `MPC-TRAIN`, plant `HDPE-TRAIN` and everything under them were created by `scripts/marun-train/seed-marun-train.ts`. Its catalogue says: *"Teaching values only, not Marun operating data."* Phase 4 can extract it mechanically, but seeding it into production would put teaching rates, prices and codes into the production accounting. See Q1.

---

## 3.1 Repository inventory

### 3.1.1 Layout and stack

| Item | Value |
|---|---|
| Frontend (repo root) | React 18, Vite 5, TypeScript, Tailwind, shadcn/ui, TanStack Query. npm name `vite_react_shadcn_ts`. |
| Backend (`server/pro-act-backend/`) | NestJS 11, TypeORM 0.3, `pg`. npm name `pro-act-backend`. |
| Processes | One image runs two processes, chosen by `PROCESS_ROLE`. The **API** (HTTP and Socket.IO, port 4004) and the **worker** (schedulers, MQTT subscriber, PI sync, period and actuals sweeps, retention, exports; health on 4005). |
| Node.js | **24** (`node:24-alpine` frontend build, `node:24-bookworm` backend build). No `engines` field and no `.nvmrc`. Dev machine: v24.11.1. |
| Top two levels | `src/` (pages, components, features, services, contexts), `e2e/`, `docker/` (nginx, mosquitto), `server/pro-act-backend/{src,scripts,test,docker,openapi,legacy}`, `plans/`, `docs/`, `contracts/`, `scripts/`, plus many stale `*.md` and `start-*.ps1` files at the root. |

### 3.1.2 SQL files and how the schema is built

| Location | What it is | Used? |
|---|---|---|
| `server/pro-act-backend/src/database/migrations/*.ts` (140 files, `1791411016572-Baseline.ts` … `1794241101000-ExternalReportSourceFigures.ts`) | TypeORM migrations, ordered by timestamp prefix, tracked in table `public.migrations` | **Yes. This is the only schema source.** |
| `schema-complete.sql` (root) | Hand-written 2025 schema for "PostgreSQL 14+" | No (stale) |
| `server/pro-act-backend/new.sql` | SQL Server schema from 2025 | No (stale) |
| `server/pro-act-backend/legacy/mssql-*/*.sql` | SQL Server era | No |
| `plans/evidence/schema-baseline.sql`, `docs/db-audit/bench.sql`, `scripts/hdpe-*.sql` | Evidence and audit queries | No |

How migrations run today:
- At API start-up, `runMigrationsOnBoot()` (`src/database/run-migrations-on-boot.ts`, called from `main.ts:22`) runs them in one transaction (`transaction:'all'`) with the **same login as the runtime**. This is on unless `DB_MIGRATIONS_RUN=false`.
- The worker never migrates.
- No migration uses `CONCURRENTLY` or `transaction = false`.
- Nothing seeds data at start-up. Workflow policies are created lazily per tenant on first use, during a request.

### 3.1.3 Docker artefacts today

| File | Services, images and names |
|---|---|
| `docker-compose.yml` (`name: proact`) | `postgres` (postgres:16-alpine, host 5433); `backend` (image `proact-backend`, host 4004); `worker` (same image); `frontend` (built from the root `Dockerfile`, host 8070→80); `kafka` (cp-kafka 7.5.0); `kafka-ui` (profile `tools`); `mqtt` (mosquitto 2.1.2). Volumes: `postgres-data`, `uploads`, `exports`, `kafka-data`, `mqtt-data`. Network: default `proact_default`. |
| `docker-compose.devdb.yml` | Points backend and worker at `proact-postgres` through `host.docker.internal` |
| `docker-compose.external-db.yml` | Points them at `instrumental-postgres` on external network `instrumental-network`, database `proact` |
| `docker-compose.shared-infra.yml` | Uses the host's `instrumental-kafka-1` and `mosquitto` |
| `docker-compose.testdb.yml` | `proact-test-postgres` (postgres:15-alpine, 127.0.0.1:5434) |
| `perf-audit/docker-compose.perf.yml` | `proact-perf-postgres` |
| Root `Dockerfile` | Node 24 build, then `nginx:1.27-alpine` runtime on port 80, **running as root**. Template `docker/nginx/default.conf.template` proxies `/api`, `/socket.io` (WebSocket) and `/piwebapi`. |
| `server/pro-act-backend/Dockerfile` | `node:24-bookworm` build, then `node:24-bookworm-slim` runtime, `USER node`, ports 4004 and 4005, role-aware `HEALTHCHECK` (`docker/healthcheck.js`), entrypoint `docker/entrypoint.sh`. Build-time check that `dist/scripts/seed-demo-users.js` exists. |

Running dev containers: `proact-frontend-1`, `proact-backend-1`, `proact-worker-1`, `proact-postgres-1`, `proact-mqtt-1`, `proact-kafka-1`, `proact-postgres` (the dev database), `proact-test-postgres`, `proact-perf-postgres`.

### 3.1.4 Environment variables

The full table (about 110 variables with defaults and read locations) is in `deploy/analysis/env-vars.md`. These points affect the work package:

| Topic | Today | TF-PREP-001 wants | Gap |
|---|---|---|---|
| DB login | `DB_USERNAME` | `DB_USER` | Name differs (Q9) |
| DB schema | none; nothing sets `search_path` | `DB_SCHEMA` (default `forge`) | Add |
| DB TLS | none | `DB_SSL` (default off) | Add |
| Pool | `DB_POOL_MAX` 10, `DB_STATEMENT_TIMEOUT_MS` 30 s, `DB_CONNECT_TIMEOUT_MS` 10 s | `DB_POOL_MAX` 10 | Matches. The role's `statement_timeout` of 60 s is overridden per session by 30 s, which is fine. |
| API port | Code default `3000`; Dockerfile and compose set `4004` | `3000` | Set `PORT=3000` in production compose; no code change |
| Migrations at boot | On by default | Removed | Set `DB_MIGRATIONS_RUN=false` in images, or remove the hook (Q4) |
| Plant time zone | Data: `sites.timezone`, then `tenants.timezone`, then `UTC` | `FORGE_PLANT_TIMEZONE` | Use it as a **seed parameter only**. A runtime variable would duplicate and override per-site data (Q8). |
| Shift pattern | Data: `calendar_versions.shift_templates` | `FORGE_SHIFT_PATTERN` only if shifts were in config | Shifts are data, so not needed |
| Kafka / MQTT | `KAFKA_BROKERS` and `MQTT_URL` are set by compose but **never read** | — | Drop them. The MQTT broker URL and credentials are per-tenant rows (`integration_connections`, `secrets`), encrypted with `CREDENTIAL_ENCRYPTION_KEY(S)`. |
| Secrets the production `.env` must carry | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDENTIAL_ENCRYPTION_KEYS` + `CREDENTIAL_ENCRYPTION_KEY_ID`, DB passwords | — | `CREDENTIAL_ENCRYPTION_KEY` falls back to `JWT_SECRET`, then to a hard-coded string. Production must set it explicitly. |
| Frontend build | `VITE_API_BASE_URL` (Docker default `/api`) | Relative `/api` | Already relative |
| nginx runtime | `BACKEND_URL`, `PI_SERVER` (default `https://87.107.103.198:7443`), `CLIENT_MAX_BODY_SIZE` (25m) | — | The `PI_SERVER` default is a hard-coded IP (Q12) |

### 3.1.5 Database access layer

- **Library and config:** TypeORM 0.3 on `pg`. The single config is `src/database/data-source.ts`. It sets no `schema` option and uses the default naming strategy with explicit column names. `synchronize` is off.
- **Schema qualification:** mostly unqualified in services. It is **hard-coded `public`** in these places:
  - migrations: 702 occurrences in 79 files, mostly `public.uuid_generate_v4()`, enum types and partition DDL;
  - `data-retention.service.ts:42,48,120`;
  - the SQL bodies of `raw_observations_ensure_partition` / `measurement_samples_ensure_partition` (`to_regclass('public.' || …)`);
  - six `SECURITY DEFINER` functions created with `SET search_path = public, pg_temp`.
- **Row-level security (on by default):**
  - 144 tables have the policy `tenant_isolation`, with `FORCE ROW LEVEL SECURITY`.
  - On each connection checkout for a signed-in non-SuperAdmin request, the API runs `SET ROLE proact_rls_user` and sets `app.tenant_ids`. Otherwise it runs `RESET ROLE`.
  - `proact_rls_user` (NOLOGIN, NOBYPASSRLS) is **created by a migration**. Its name is hard-coded in `src/database/rls/rls-tenant-ids.ts:7`. PostgreSQL roles are **cluster-wide**, so on the shared `instrumental-postgres` this name could clash with an existing ProAct install (Q6).
  - The login role must be a member of that role: `GRANT proact_rls_user TO traverse_forge_app`. The runtime role does **not** need BYPASSRLS or ownership.
- **DDL at runtime:**
  - Monthly partitions are **created** through two `SECURITY DEFINER` functions. This works for a DML-only role as long as the functions are owned by `traverse_forge_owner`.
  - Expired partitions are **dropped** by `DROP TABLE "public"."<partition>"` (`data-retention.service.ts:120`). This **fails for a DML-only role** (S4, Q5). The job only acts when `RAW_RETENTION_DAYS` or `SAMPLE_RETENTION_DAYS` is set.
  - About 30 `pg_advisory_xact_lock` calls. These are fine for a DML role.
  - There is no TRUNCATE, `REFRESH MATERIALIZED VIEW` or `LISTEN/NOTIFY` at runtime.
- **Extensions:** `uuid-ossp`, `btree_gist` and `pg_stat_statements` (plus `plpgsql`).
  - `pg_stat_statements` only collects data with `shared_preload_libraries`, which is a server setting on a **shared** instance. No runtime code reads it (Q7).
  - `pgcrypto` and `pg_trgm` are not used.
- **Structure checks on the dev schema:**
  - Every table has a primary key except `typeorm_metadata`.
  - **No `timestamp without time zone` columns.**
  - **34 of 194 foreign keys have no supporting index** (`fk-without-index.txt`).
  - 97 enum types, 224 functions, 39 triggers, 6 views.
  - Two partitioned tables (`raw_observations`, `measurement_samples`).

### 3.1.6 Authentication

| Item | Implementation |
|---|---|
| Password hashing | `bcryptjs` 3, cost **10** hard-coded in `src/users/users.service.ts:79,105`. Scripts read `BCRYPT_ROUNDS` (default 10). |
| Tokens | `@nestjs/jwt` + `passport-jwt`, Bearer header. Access token 15 min (`JWT_ACCESS_TTL`). Refresh token 7 d (`JWT_REFRESH_EXPIRATION`), separate key, single-use rotation with family revocation, stored by `jti` in `auth_refresh_tokens`. The frontend keeps the session in `localStorage`. |
| Login identifier | **E-mail.** There is no username column. |
| Lockout / rate limit | **No account lockout.** A global in-memory throttler allows 300 requests/min per user, or per IP when anonymous. Login has no tighter limit. `TRUST_PROXY` must be set behind nginx. |
| Must-change-password | **Absent.** No column, no login check, no change-password route (unused DTOs `change-password.dto.ts`, `reset-password.dto.ts`). Only an admin can set a password, through `PUT /api/users/:id`. |
| Role model | Legacy roles on `users.role`: SuperAdmin, OrgAdmin (both global), TenantAdmin, Manager, Analyst, Engineer, Operator. Scope roles on `user_scopes(scope_kind tenant/site/unit, role)`: manager_approver, production_accountant, quality_approver, metrology_approver, finance_approver, finance_maintainer, production_engineer, reliability_engineer, integration_admin, master_data_admin, operator, viewer. Legacy roles map to scope roles (Manager/TenantAdmin → manager_approver, Analyst/Engineer → production_engineer, Operator → operator). An explicit grant in a plant replaces the legacy mapping there. The table `roles` is an unused orphan (0 rows). |
| Plant scoping | **Yes.** Tenant = plant. A `tenant` scope covers its sites and units. |
| Seed tooling | `scripts/bootstrap-admin.ts` (first SuperAdmin; refuses if users exist). `scripts/seed-demo-users.ts` **resets passwords on conflict** and holds demo credentials, so it must not ship as a production path. |

Proposed mapping of the §7.1 accounts (Q3):

| §7.1 account | `users.role` | Explicit `user_scopes` grant on plant `FORGE_PLANT_CODE` |
|---|---|---|
| `forge.admin` | SuperAdmin | — (global) |
| `forge.engineer` | Engineer | `production_engineer` |
| `forge.supervisor` | Manager | `manager_approver` |
| `forge.operator` | Operator | `operator` |
| `forge.viewer` | Analyst (a placeholder: no read-only legacy role exists) | `viewer`, which overrides the Analyst mapping in that plant |

Login is by e-mail, so the "usernames" become `forge.admin@<domain>`. Whether the DTO's `@IsEmail` accepts `invalid.local` must be checked in Phase 5.

### 3.1.7 Health endpoints

| Route | Auth | Checks | Response |
|---|---|---|---|
| `GET /api/health` | Public, not throttled | `SELECT 1` | `{status:'healthy'\|'unhealthy', timestamp, database}`, 503 when the DB is down |
| `GET /api/health/detailed` | SuperAdmin | DB | Adds uptime, `NODE_ENV`, memory, Node version |
| Worker `GET /health/live`, `/health/ready` on 4005 | Bare HTTP server, no prefix | ready = `SELECT 1` and not draining | 200 or 503 |

No application version or commit is reported anywhere. The global prefix `/api` applies to every controller, so TF-PREP-001's `GET /health` becomes `GET /api/health` behind nginx. The work package's `proxy_pass http://…:3000/;` (with a trailing slash) would **strip** `/api` and break every route, so it must be `proxy_pass http://traverse-forge-backend:3000;`. Swagger at `/api` is served without authentication (Q13).

### 3.1.8 Secrets in the repository (stop condition S1)

`.env` files were never committed: `git log --all` on `.env`, `.env.local` and `server/pro-act-backend/.env` is empty. Tracked items:

| File | Content | Risk |
|---|---|---|
| `docs archive/JWT_SECRET_MISMATCH_FIX.md:16,22` | A JWT secret value | **The dev backend still uses this exact value.** Anyone with the repo can mint dev tokens. Rotate the dev value; production gets a new random one anyway. |
| `docs archive/DATABASE_CREDENTIALS_UPDATED.md:8,47,80` | Legacy SQL Server `sa` password | Confirm it is not used on any reachable server |
| `docker/mosquitto/certs/dev-ca.key`, `dev-server.key`, `docker/mosquitto/passwd` | Self-signed dev CA and broker users `proact-test` / `proact-sim` | Dev only. Must never be trusted or mounted in production. |
| `scripts/marun-train/train-catalog-setup.ts:68` | Dev broker password as a default | Dev only |
| `.github/workflows/ci.yml:20` | `ci-only-jwt-secret-…` | Acceptable (CI only) |

Values are deliberately not reproduced in this report.

---

## 3.2 Old-name inventory

The full list (1,782 lines, file:line) is in `deploy/analysis/old-names.txt`. Counts by token:

| Token | Occurrences | Where | Phase 2 proposal |
|---|---|---|---|
| `server/pro-act-backend` (directory path) | ~1,250 | Docs, scripts, CI, imports in tests | **Keep the directory.** Renaming it touches ~1,250 paths for no runtime effect (Q2). |
| `pro-act-backend` (npm name), `vite_react_shadcn_ts` | 3 | `package.json` and lockfiles | Rename to `traverse-forge-backend` / `traverse-forge-frontend` |
| `proact-backend`, `proact-frontend`, compose `name: proact`, `proact_default` | ~15 | compose files, docs | Rename to the §2 names in the new `deploy/` compose files. Keep the dev compose files as they are (Q2). |
| `proact` (DB name, default in `data-source.ts:26`, compose defaults) | ~570 total `proact` tokens across all uses | Code default, compose, docs, tests | Change the code default to `traverse_forge` and set it by env |
| `proact_rls_user` | 26 | Migration, `rls-tenant-ids.ts:7`, tests | Rename to `traverse_forge_rls` through `FORGE_RLS_ROLE` (default kept for dev) (Q6) |
| `instrumental-postgres` / `instrumental-network` | 25 | Override compose files and docs | Keep. They are the real production names (§1). |
| `proact-postgres`, `proact-test-postgres`, `proact-perf-postgres`, `proact-mqtt-1` | ~75 | Dev scripts and docs | Keep (dev tooling) |
| `host.docker.internal`, `DB_HOST:-postgres`, `localhost:5432` | 23 | Compose overrides, data-source default | The production compose sets `DB_HOST=instrumental-postgres` |
| `:4004` / `localhost:4004` | 236 | Dev defaults, the frontend's dev `VITE_API_BASE_URL`, Dockerfile, healthcheck | Production uses `PORT=3000` and a relative `/api`. Keep 4004 for dev, as CLAUDE.md requires. |
| localStorage keys `proact_auth_state`, `proact.plantSelection`, `proact.nav.*`, `window.__PROACT_API_BASE_URL__` | ~50 | Frontend | **Keep.** These are not in §2, and renaming them silently resets sessions and preferences. |
| MQTT topic prefix `proact/v1/…`, client ids `proact-…` | ~40 | Ingestion profiles, simulators | **Keep.** The MQTT feed belongs to the data-engineering team (project rule). |
| `https://proact.local`, `proact.com`, `proactdb`, `proact_test` | ~250 | Tests and fixtures | Keep (test data) |

---

## 3.3 Development database inventory

| Query | Result |
|---|---|
| `version()` | PostgreSQL 15.18 on x86_64-pc-linux-musl (Alpine). The production server is 15.15, which is compatible. |
| `current_database(), current_user` | `proact`, `postgres`. **The dev app connects as superuser.** |
| Schemas | `public` only |
| Roles | `postgres` (super), `proact_rls_user` (NOLOGIN, no BYPASSRLS) |
| Extensions | plpgsql 1.0, uuid-ossp 1.1, btree_gist 1.7, pg_stat_statements 1.10 |
| Base tables | 155 (153 ordinary + 2 partitioned parents; 24 partitions are counted separately in the catalogue). Row counts are in `dev-table-rows.txt`. |
| Tenants | `HDPE-TRAIN` (org `MPC-TRAIN` "Marun"): all 14 users and all configuration. `HDPE1` (org `ASPC`): one site and one accounting policy, no users. This one looks abandoned (§3.6). |

---

## 3.4 Schema drift check

Method:
1. Started a disposable `postgres:15-alpine` (`forge-pg15-scratch`, 127.0.0.1:55432).
2. Ran `npm run migration:run` against it. All 140 migrations applied, with the same latest migration as dev.
3. Dumped both databases with `pg_dump --schema-only --no-owner --no-privileges` and diffed them.
4. Removed the container.

Result (`schema-drift.diff`, 125 lines): apart from pg_dump's random `\restrict` tokens, the **only** difference is partition `measurement_samples_y2026m10`. The app created it in dev at runtime through `measurement_samples_ensure_partition`, which is intended behaviour.

**Conclusion:** no drift. The agreed single source for `V001__baseline.sql` is "the 140 TypeORM migrations applied to an empty PostgreSQL 15", dumped and moved to schema `forge`. The repo `.sql` files listed in §3.1.2 must not be used.

---

## 3.5 Table classification

Counts are dev rows. Every tenant-scoped table also carries `tenant_id` (a UUID FK).

| Class | Tables |
|---|---|
| **S — structure only** | `migrations` (TypeORM history: needed if TypeORM is ever run against production, Q4), `typeorm_metadata` (1 structural row) |
| **R — reference / master** | `organizations`, `tenants` (= plants), `sites`, `units`, `assets`, `products`, `production_profiles`, `unit_product_rates`, `calendar_versions`, `crews`, `crew_rotations`, `reason_codes`, `code_versions`, `impact_codes`, `oee_codes`, `failure_code_groups`, `failure_dictionary_entries`, `loss_category_defs`, `verification_status_codes`, `rca_cause_codes`, `rca_templates`, `evidence_categories`, `evidence_locations`, `accounting_policies`, `valuation_rates`, `fx_rates`, `demand_statuses`, `unit_state_mappings`, `unit_impact_rules`, `transition_standards`, `uncertainty_budgets`, `custom_attribute_definitions`, `attribute_mapping_versions`, `code_mapping_rules`, `source_status_mappings`, `source_hierarchy_mappings`, `source_mappings`, `signals`, `unit_streams`, `plant_flow_routes`, `standby_equipment`, `rules`, `rule_versions`, `feature_flags`, `app_settings` (branding) |
| **R\* — site configuration, not copied** | `integration_connections`, `secrets`, `pi_connections`, `pi_mappings`, `af_bindings`. These hold endpoints and credentials encrypted with the **dev** key. On the VM they are configured through the UI after install. |
| **U — users and access** | `users`, `user_scopes`, `role_delegations`. `roles` is an unused orphan (0 rows). |
| **T — transactional (never seeded)** | `production_events`, `event_coding`, `event_revisions`, `event_impacts`, `event_relations`, `event_review_items`, `stop_incidents`, `stop_incident_members`, `stop_incident_breaks`, `stop_reconciliations`, `standby_records`, `raw_observations*`, `raw_identities`, `measurement_samples*`, `signal_summaries`, `signal_backfill_runs`, `source_objects`, `inbox`, `outbox`, `ingestion_jobs`, `ingestion_job_transitions`, `ingestion_exceptions`, `replay_runs`, `pi_sync_jobs`, `pi_sync_job_links`, `pi_sync_watermarks`, `pi_open_frames`, `pi_page_manifests`, `state_engine_cursors`, `stream_runs`, `shift_instances`, `shift_notes`, `production_periods`, `period_*`, `actuals_*`, `calculation_runs`, `kpi_results`, `loss_lines`, `loss_line_*`, `approved_*`, `accounting_revisions`, `restatement_postings`, `reconciliation_line_sets`, `reconciliation_lines`, `month_closes`, `month_close_actions`, `production_day_certifications`, `external_production_reports`, `lot_dispositions`, `production_plans`, `plan_*`, `rcas`, `rca_*` (analyses, actions, causes, links, votes, knowledge base, trigger evaluations), `tasks`, `work_order_operations`, `buffer_levels`, `custom_attribute_values`, `approval_actions`, `approval_snapshots`, `bulk_jobs`, `export_jobs`, `export_job_sources`, `rate_imports`, `rule_runs`, `audit_log`, `audit_logs`, `user_notifications`, `idempotency_keys`, `auth_refresh_tokens` |
| **X — dev or test only** | No table is X by design. The **rows** of tenant `HDPE1` / org `ASPC`, product `ple1` "ple" (no tenant), unit `EXT-Line2` and asset `EXT2` are X (§3.6). Whether all HDPE-TRAIN rows are X depends on Q1. |

---

## 3.6 HDPE hierarchy as configured in dev

Data model: organisation (`organizations.code`) → **tenant = plant** (`tenants.code`) → site (`sites`, **no code column**: business key is tenant + `name`) → unit (`units.code`) → asset (`assets.code`).

```
MPC-TRAIN  "Marun"                                organization
└── HDPE-TRAIN  "HDPE plant"                      tenant/plant  tz Asia/Tehran, gregorian, latin digits, week start Saturday
    └── "HDPE plant"                              site (default) tz Asia/Tehran, production day starts 06:00
        │   calendar v1 published: shifts A 06–14, B 14–22, C 22–06; crews A, B, C
        ├── Extruder1  "HDPE Extruder 1"          unit  uom t, capacity —, site_id NULL
        │   ├── EXT1-Main "Main drive and gearbox"  asset (Equipment, High)
        │   └── rates: HD5502 28 t/h (sustained, planning); TRAIN-B 24 t/h
        └── EXT-Line2  "EXT-Line2"                unit  uom t, capacity —, site_id NULL, own calendar v1, no profile/rates
            └── EXT2 "Extruder2"                  asset (Equipment, High)
ASPC "ASPC" → HDPE1 "HDPE" → site "HDPE" (Asia/Tehran, 06:00)   second org, empty
```

| Level | Business key | Name | Parent | Attributes | Origin |
|---|---|---|---|---|---|
| Organization | `MPC-TRAIN` | Marun | — | — | Training seeder |
| Plant (tenant) | `HDPE-TRAIN` | HDPE plant | MPC-TRAIN | Asia/Tehran, gregorian, latin, Saturday | Training seeder |
| Site | (HDPE-TRAIN, "HDPE plant") | HDPE plant | HDPE-TRAIN | Asia/Tehran, day start 06:00, default | Training seeder |
| Unit | `Extruder1` | HDPE Extruder 1 | HDPE-TRAIN (no site link) | uom `t`; capacity in rates | Training seeder |
| Unit | `EXT-Line2` | EXT-Line2 | HDPE-TRAIN (no site link) | uom `t`; no rates | **Manual, not in the seeder** |
| Asset | `EXT1-Main` | Main drive and gearbox | Extruder1 | Equipment, High | Training seeder |
| Asset | `EXT2` | Extruder2 | EXT-Line2 | Equipment, High | **Manual** |
| Product | `HD5502`, `TRAIN-B` | HDPE grade A / B | HDPE-TRAIN | — | Training seeder |
| Product | `ple1` | ple | none (global) | — | **Manual, looks like a test** |
| Organization / plant / site | `ASPC` / `HDPE1` / "HDPE" | — | — | Asia/Tehran | **Abandoned (no users, no units)** |

Other configured reference data in HDPE-TRAIN:
- 8 reason codes (MECHANICAL, DRIVE-TRAIN, MECH-GEARBOX, ELEC-TRIP, FEED-STARVED, SPEED-LOSS, GRADE-CHANGE, QUALITY-DOWNGRADE);
- 8 RCA cause codes;
- 11 failure-dictionary entries;
- 13 accounting policies;
- 3 valuation rates and 1 FX rate (illustrative 600,000 IRR/USD);
- 1 unit-state mapping and 1 unit-impact rule.

Flags:
1. **Training data.** Every HDPE-TRAIN value is a teaching value (Q1).
2. **Possible test or duplicate rows:** `EXT-Line2` / `EXT2` (generic name, no rates), `ple1` "ple", and the whole `ASPC`/`HDPE1` branch.
3. **Missing attributes for loss accounting:**
   - `units.capacity` is NULL. Capacity actually lives in `unit_product_rates` through `production_profiles`, which is correct for this model.
   - `units.site_id` is NULL for both units.
   - `EXT-Line2` has no rate, so loss valuation for it is impossible.
   - Time zone and shifts are present.
4. **Surrogate IDs:** every FK is a UUID.
   - `assets.unit_id` is a **varchar holding the unit UUID**, not a code.
   - `created_by` / `updated_by` hold **user UUIDs**. The work package asks for business keys; changing that is a functional change (recommendation R4).
   - Seeds must resolve parents by code: org code → tenant code → site name → unit code.
5. **Branding row** (`app_settings.branding`) already says "Traverse Forge" and is global (no tenant).

---

## 4. Open questions (answers needed before Phase 2)

| # | Question | Recommendation |
|---|---|---|
| **Q1** | Dev holds only the **training** plant. What is the source of real Marun HDPE reference data (units, design capacities, rates, products and prices, reason codes, shifts)? | Phase 4 builds the seed machinery and parameters from the **structure** of dev. Production values come from a plant-supplied CSV set that you approve. Until then, the seed ships with the training values clearly labelled, and the rehearsal (Phase 8) only uses them. |
| **Q2** | Rename the `server/pro-act-backend/` directory and the dev compose files too? | No. Rename only the §2 runtime names (packages, images, containers, services, network, database, roles) in new `deploy/` files. Leave the dev tooling alone. |
| **Q3** | Accept the account and role mapping in §3.1.6, including e-mail logins and the Analyst+viewer construction for `forge.viewer`? | Yes |
| **Q4** | Migration engine. TF-PREP-001 wants psql-applied SQL files. The app authors TypeORM migrations. | Keep TypeORM as the authoring tool. Generate `V001__baseline.sql` from the dump in §3.4, moved to `forge`, plus rows for the TypeORM `migrations` table so both histories agree. Each later TypeORM migration is exported to a `Vnnn` file by `deploy/db/export-migration.sh`, with a CI check that the two paths produce identical dumps. Images run with `DB_MIGRATIONS_RUN=false`. |
| **Q5** | Retention drops partitions (`DROP TABLE`), which the DML-only role cannot do. | Add a `SECURITY DEFINER` function `forge.drop_expired_partition(parent, name)`, owned by `traverse_forge_owner`, that validates the name pattern. The retention service calls it (a functional change in a V002 migration). Until then, leave `RAW_RETENTION_DAYS` and `SAMPLE_RETENTION_DAYS` unset in production. |
| **Q6** | `proact_rls_user` is cluster-wide. Does `instrumental-postgres` in production already contain a `proact` database or a `proact_rls_user` role? | Rename to `traverse_forge_rls` (env `FORGE_RLS_ROLE`) and `GRANT traverse_forge_rls TO traverse_forge_app` in `00-create-db-and-roles.sh`. Also check on the VM: `\du proact*` and `\l proact`. |
| **Q7** | `pg_stat_statements` needs `shared_preload_libraries` on the shared server. | Leave the server configuration alone. Have `00-…sh` create the extension only if it is already preloaded, otherwise skip it; nothing at runtime depends on it. |
| **Q8** | `FORGE_PLANT_TIMEZONE` as a runtime variable? | Seed parameter only. The time zone is per-site data used by every calculation. |
| **Q9** | `DB_USER` (work package) vs `DB_USERNAME` (code)? | Accept both, with `DB_USER` taking precedence. This is a small change and keeps dev `.env` files working. |
| **Q10** | The worker process is missing from §8.3. Without it there is no MQTT intake, no PI sync, no period or actuals calculation, no exports and no retention. | Add a third service, `traverse-forge-worker`: same image, `PROCESS_ROLE=worker`, networks `forge` and `pgnet`, health on 4005 (not published). Add volumes `uploads` and `exports` (shared by API and worker). §8.3 says "use exactly this structure", so this needs your approval. |
| **Q11** | Must-change-password does not exist. Adding it means a migration column, a login-flow check, a change-password route and a frontend page. That is a functional change of moderate size. | Implement it in Phase 5 as the work package asks, with a test per step. Also add a login-specific throttle (for example 10/min per IP), because there is no lockout today (OWASP ASVS V2.2). |
| **Q12** | nginx `PI_SERVER` defaults to a hard-coded IP, and `/piwebapi` is proxied. Is the PI Web API reached from the production VM, and from the browser or only from the backend? | Remove the default. Make `/piwebapi` opt-in through an env variable. |
| **Q13** | Swagger UI at `/api` is public. | Disable it in production (`FORGE_SWAGGER=false` by default). |
| **Q14** | 34 FKs have no supporting index (§3.1.5). The work package requires one per FK. | Add them in an additive `V002__fk_indexes.sql` (and the matching TypeORM migration). Production tables start empty, so this is cheap. |
| **Q15** | Backend base image: TF-PREP-001 says Alpine; the repo uses Debian bookworm-slim (chosen for ABI consistency with native modules). | Keep bookworm-slim unless you require Alpine. Both are non-root. |
| **Q16** | Rotate the dev `JWT_SECRET` (S1) and delete or redact the `docs archive/` credential files? | Yes, both. The dev change requires a dev re-login. |

## 5. Recommendations for functional changes (not to be made without approval)

- **R1** Must-change-password and a login throttle (Q11).
- **R2** A partition-drop function for the DML-only role (Q5).
- **R3** Configurable RLS role name (Q6).
- **R4** Audit columns (`created_by`/`updated_by`) hold user UUIDs, not business keys. Changing this touches every entity. I recommend **not** doing it now: UUIDs are stable and the audit trail resolves names.
- **R5** `GET /api/health` keeps its current response shape (a public contract). Add `version` and `commit` fields, and a new `GET /api/health/ready`. TF-PREP-001's `{"status":"ok"}` is met by the new route and not by changing the old one.

## 6. Proposed file list for Phases 2–8

| Phase | New or changed files |
|---|---|
| 2 | `package.json` names (both), `server/pro-act-backend/src/database/data-source.ts` (`DB_USER`, `DB_SCHEMA` → `search_path`/`schema`, `DB_SSL`, default DB name), `src/database/rls/rls-tenant-ids.ts` (role from env), `src/common/retention/data-retention.service.ts` (schema-agnostic), `src/health/health.controller.ts` / `health.service.ts` (`/ready`, version, commit), `src/main.ts` (Swagger switch), `src/database/run-migrations-on-boot.ts` (default off in production images), `deploy/.env.example` |
| 3 | `db/migrations/V001__baseline.sql`, `V002__fk_indexes.sql` (+ matching TypeORM migration), `deploy/db/00-create-db-and-roles.sh`, `deploy/db/10-migrate.sh`, `deploy/db/export-migration.sh` |
| 4 | `db/seed/reference/R010__org_hierarchy.sql`, `R020__codes.sql`, `R030__calendar.sql`, `R040__products_profiles_rates.sql`, `R050__policies.sql`, `hdpe-units.csv`, `deploy/db/20-seed-reference.sh`, `deploy/db/extract-reference-from-dev.sh` |
| 5 | Migration `must_change_password`, auth change-password route and login check, frontend change-password page, `server/pro-act-backend/src/cli/seed-users.ts`, `deploy/db/30-seed-users.sh`, `deploy/seed-users.csv.example` |
| 6 | `server/pro-act-backend/Dockerfile` (build args, OCI labels, `/app/db`, port 3000, `wget` healthcheck or keep `healthcheck.js`), root `Dockerfile` → `nginx-unprivileged` on 8080, `docker/nginx/default.conf.template` (headers, cache rules, `/api` without rewrite, `/socket.io` WebSocket), `deploy/docker-compose.forge.yml` (backend, **worker**, frontend), `deploy/docker-compose.local.yml`, `deploy/BUILD-VARS.md` |
| 7 | `deploy/build/build-images.sh`, `deploy/build/package-bundle.sh`, `deploy/vm/{install,load-and-start,verify,rollback,backup-forge,restore-test}.sh`, `deploy/vm/VM-STEPS.template.md` |
| 8 | `deploy/PREP-LOG.md` (rehearsal evidence) |

Decisions taken from these answers will be recorded in `plans/DECISIONS.md`.
