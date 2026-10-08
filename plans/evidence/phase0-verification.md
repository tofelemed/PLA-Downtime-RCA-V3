# Phase 0.3 / 0.4 part 1 — verification record (7 Oct 2026)

Run after all five sub-phase agents finished, over the combined working tree, on a host saturated by an orphaned `nest start --watch` (see BASELINE.md). Sequential job: `npm install` → `tsc` → Jest unit+fixtures → build to scratch outDir → Jest integration.

| Step | Result | Notes |
|---|---|---|
| `npm install --legacy-peer-deps` | ✅ | lockfile re-synced (`@nestjs/throttler`, `ajv`, `ajv-formats`) |
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | whole backend incl. worker, v2, tests |
| `npx jest --selectProjects unit fixtures` | ✅ **20 suites, 281 tests passed** (605 s under load) | includes scheduler gating, shutdown coordinator, exception filter, correlation id, throttler config, route-guard inventory, cursor codec, decimal transformer, query DTOs, pi-proxy policy, DTO fixes, fixtures T01–T46, policy schemas |
| `npx tsc -p tsconfig.build.json --outDir <scratch>` | ✅ | `dist/src/main.js` and `dist/src/worker.js` emitted (confirms `dist/src/` layout and the worker entry) |
| `npx jest --selectProjects integration --runInBand` | ⚠️ **not a valid run** | `migrations.int-spec.ts` passed 6/6 in an earlier isolated run (393 s). In the combined run all four new specs (`api-contract`, `production-events`, `pi-proxy`, `route-guard-coverage`) failed in `beforeAll` with 300 s hook timeouts or `read ECONNRESET` from Postgres — the Docker daemon was starved (docker CLI calls were timing out at the same time). No assertion failures were reached. **Re-run required on a quiet host.** |
| `docker compose up --no-deps --wait kafka mqtt` | ⚠️ partial | `mqtt` healthy; `kafka` never past "Configuring… KRaft" in 10 min (health exec timed out) — same starvation; no config errors |
| CI workflow / `npm run ci` | ⬜ not executed | files validated (YAML/bash/pwsh parse) only |
| ESLint | ⬜ | frontend baseline 2,506 problems (recorded in tests-baseline.md); backend typed lint never completed |

## What is therefore proven
- Migration workflow (baseline faked, drift-free, round-trip on empty DB).
- Worker/API role split compiles and its gating is unit-tested.
- Error contract, guards, query DTOs, cursor codec, pi-proxy policy — unit level.
- Policy schemas and fixtures.

## What is not yet proven (blocks ✅ on 0.3 / 0.4)
- Integration specs for B1/B2/B17/B18, T13 core, 401/429 envelopes, pi-proxy refusals, route-guard coverage (written, not executed to completion).
- Kafka container health; worker smoke run (`node dist/src/worker.js` + probes); CI end-to-end.

Commit: see `git log` — "feat(phase-0): decision register, migrations workflow, worker split, Compose/CI, API v2 foundation (part 1)".

---

# Phase 0.3 / 0.4 — verification record (8 Oct 2026, host `D:\HMI_Project_Usama\ProAct`)

Quiet host. This machine has no `instrumental-postgres`, so a dedicated `proact-postgres` (postgres:15-alpine, host 5432, volume `proact-postgres-data`, credentials from `server/pro-act-backend/.env`) was started for dev + `proact_test`.

| Step | Result | Notes |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | after fixing 4 errors in the uncommitted part-2 idempotency code (missing `PreconditionRequiredException`, `null` in TypeORM update types) |
| `npx jest --selectProjects unit fixtures` | ✅ **26 suites, 314 tests** | adds specs for role model, revision/ETag, scoped query, idempotency service, audit DTO, OpenAPI v2 snapshot |
| `npx jest --selectProjects integration --runInBand` | ✅ **6 suites, 60 tests** | migrations round-trip, api-contract, production-events (T13), pi-proxy, route-guard coverage, **tenancy (T14 core, scopes, X-Tenant-Id, SQL tenant predicate, ETag, idempotency, admin-only register)**. First run: 35 failures, all one cause — the test app factory lacked `AccessModule` (Nest DI error), fixed by mirroring AppModule's guard chain |
| `npm run migration:run` on empty `proact` | ✅ | Baseline + UserScopesAndIdempotency applied |
| `npm run build`; API `:4004` + worker `:4005` | ✅ | health `healthy`, worker `ready`; curl smoke: 401 envelope + echoed `X-Correlation-Id`, v2 list, 422 `limit>500`, 400 `tenantId` query, v1 400 `VALIDATION_FAILED` with `message[]`, `unmapped-events`/`rca-recommendations`/`dashboard-configurations` → 401, `/api/docs/v2` 200 |
| `docker compose up --wait kafka mqtt` | ✅ both healthy | MQTT tag fixed to `eclipse-mosquitto:2.1.2-alpine` |
| Frontend Vitest | = baseline | same 3 files fail as in tests-baseline.md; `master-data.integration.test.ts` now gets **401** (was 500) |
| Playwright `auth`, `production`, `event-pull-and-rca` | 14 passed, 5 failed, 1 skipped | see below; none caused by 0.3/0.4 |
| GitHub CI | ⬜ | no reachable remote (push failed at baseline) |

### e2e failures (all pre-existing test or UI drift)
- `EVENTHUB: should display events` and `WORKFLOW: full event pull → display → RCA`: tests navigate to `/eventhub`; the app route has been `/events` since the baseline (404 page in the screenshot).
- `RCA RULES: …trigger criteria`: expects `severity: 'Critical'` derived from `cost ≥ 100000`; no such derivation has ever existed in the backend.
- `RCA CREATE via API`: test sends `recommendations: []`, `evidence: []`; `CreateRcaDto` (unchanged since baseline) declares strings → 400.
- `Production Module › create plan via UI`: "Create Plan" opens the template picker; this empty DB has no templates, so the expected text input never appears.

### Bug fixed during the smoke run
- `POST /api/audit-logs` answered 400 for every field ("property userId should not exist", …): `CreateAuditLogDto` had no class-validator decorators, so the global whitelist pipe rejected all client audit writes (also at baseline). Decorators added; `userId`, `tenantId`, `organizationId` now come from the caller identity, not the body.

## Frontend-visible changes (0.4)
| Change | Effect on the current UI |
|---|---|
| Error body `{code, message, fieldErrors?, correlationId, retryable}` | `httpClient.ts` reads `message` (string or string[]): compatible |
| Missing/invalid token → 401 `UNAUTHENTICATED` (was 500) | AuthContext 401 handling now triggers as intended |
| Every route needs a token unless `@Public()` (global guard) | `unmapped-events`, `rca-recommendations`, `dashboard-configurations`, `uploads`, connectivity realtime, pi-proxy all require auth |
| `POST /auth/register` admin-only (public only with `AUTH_ALLOW_PUBLIC_REGISTRATION=true`) | sign-up from the login page works only in dev; first SuperAdmin via `npm run db:bootstrap-admin` |
| `X-Tenant-Id` must be a tenant the user belongs to | 403 `TENANT_NOT_ALLOWED` otherwise (the v1 UI does not send it) |
| v1 `GET /production-events`: filters ANDed, malformed params 400, optional paging | intersection instead of first-filter-wins |
| reconcile-form / loss-category PUT field names (B3/B4) | DTOs now match the entity columns |
| 300 requests/min per user (429 + `Retry-After`) | — |
| `POST /audit-logs` accepted again; identity fields server-side | client audit entries are stored |
| New: `GET /api/v2/production-events/:id` with `ETag`; `rowVersion` in v2 event views | additive |

---

# Plan 1.1 verification (8 Oct 2026)

| Step | Result | Notes |
|---|---|---|
| Migration on scratch | ✅ up → `migration:generate` finds **no changes** → down → up | `EventIntervalModel1791584000000` |
| `npx tsc --noEmit` | ✅ | |
| Unit + fixtures | ✅ **29 suites, 947 tests** | interval algebra (incl. 600 seeded property cases), classification, legacy status round-trip, DT08 validation, unit downtime T03/T29 |
| Integration | ✅ **8 suites, 91 tests** | `event-interval.int-spec.ts` (T01, T02, T03, T42, 422 codes, idempotent create, If-Match PATCH 428/412/200, SOURCE_OWNED, v1 adapter + B8 duration, DB CHECK) and `event-backfill.int-spec.ts` (SQL backfill = TS rules on 9 legacy shapes, PI sentinel, legacy durations, tenant_uuid trigger) |
| ESLint on authored source files | ✅ clean | test files keep the same `no-unsafe-*` findings as the existing specs (lint gate decision open, 0.3 step 7) |
| e2e auth / production / event-pull / rca-auto-create | 15 passed, 6 failed, 1 skipped | the 5 known pre-existing failures + `auth › login via API` (cold Vite start; **4/4 pass on re-run**). Cleanup DELETEs answered 500 because of the `rcas` ↔ `production_events` FK cycle (pre-existing, see 1.1 risks) |
| Backfill report | ⚠️ empty dev DB | [backfill-0002.md](backfill-0002.md); re-run on the data host |

---

# Plan 1.2 verification (8 Oct 2026)

| Step | Result | Notes |
|---|---|---|
| Migration on scratch | ✅ up → `migration:generate --dr` finds **no changes** → down → up (run twice) | `EventRevisions1791670400000`; reuses the 1.1 classification enum types in `event_coding` |
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | |
| `npx jest --selectProjects unit fixtures` | ✅ **31 suites, 963 tests** | new: `event-facts.spec.ts` (normalisation, change detection, field sets), `pi-event-pull.service.spec.ts` (B5/I1 bridge: no `status`, source revision, duplicate → `unchanged`, connector actor); OpenAPI v2 snapshot regenerated (additive: `/production-events/{id}/revisions`, `/event-review-items/{id}/resolve`, `ResolveReviewItemDto`) |
| `npx jest --selectProjects integration --runInBand` | ✅ **9 suites, 114 tests** | new `event-revisions.int-spec.ts` (10): T04 (PI event, v2 PATCH reason, v1 PUT RCA link, source end-time revision keeps coding/RCA/status, `GET` shows `sourceFacts` + effective), duplicate delivery (no revision, `duplicate_deliveries` +1, ETag unchanged), override conflict → open review item, `accept_source` / `keep_override`, 409 on re-resolve, foreign-tenant 404 (item and history), retraction (`retracted`, `Cancelled`, `EventRetracted` emitted, −3600 s in the unit downtime union, revision kind `retraction`), concurrent PATCH with the same If-Match → one 200 + one 412. `event-backfill.int-spec.ts` now reverts two migrations and pins the EventRevisions backfill to `factsOf()` on 9 legacy shapes plus a non-uuid-tenant row (no revisions) |
| ESLint (`prettier/prettier` off) on every created/changed file under `src/` | ✅ no findings, except `src/integration/pi-event-pull.service.ts`: 80 errors, identical count to HEAD (pre-existing `any` usage; none on changed lines) | integration specs keep the same `no-unsafe-*` findings as the existing specs (supertest bodies are `any`) |
| Size rules | ✅ new functions ≤ 40 lines, ≤ 4 params, files ≤ 400 lines | `production-event.entity.ts` grows to 437 lines (new columns only, as agreed); `toProductionEventV2View` (49 lines) unchanged from 1.1 |
| Backfill on dev DB `proact` | ⚠️ not run | dev DB is at EventIntervalModel with 1 event (0 without a uuid tenant); the app applies the migration on next boot |

---

# Plan 1.3 verification (8 Oct 2026)

| Step | Result | Notes |
|---|---|---|
| Migration on scratch | ✅ up → `migration:generate --dr` finds **no changes** → down → up → no changes | `HierarchyMappingAndCodeLibraries1791756800000`. Backfill checked on scratch with legacy rows: pattern `\AF\HDPE\*` → `af/hdpe/*`, identifier → `exact_id`, path → `exact_path`, tenant-target row skipped; reason code → `path = id`, `code_versions` v1. `down()` with a code shared by two tenants fails with "Cannot revert … a global UNIQUE(code) would lose data" (row removed → down/up succeed) |
| Cross-tenant duplicate check (dev DB `proact`) | ✅ nothing to migrate | 0 reason/impact/OEE codes, 0 products, 1 unit, 0 legacy hierarchy mappings, 0 AF bindings; the global UNIQUE(code) already excluded duplicates |
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | |
| `npx jest --selectProjects unit fixtures` | ✅ **35 suites, 1011 tests** | new: `mapping-resolver.spec.ts` (normalisation, glob escaping, precedence table, backslash pattern, AF chain, no substring, ambiguity, connection specificity), `attribute-mapper.spec.ts` (digital states, stream values, TimeSpan only under `timespan`, duration mismatch, unknown/required, per-field merge, legacy targets, rule validation), `code-library.spec.ts` (exact match only, suggestions, validity, ambiguity, foreign uuid, tree placement/cycle, failure levels, code defaults + override flag), `event-field-catalog.spec.ts` (drift vs `contracts/event-field-catalog.json` and the fact sets), `pi-frame-ingest.service.spec.ts` (replaces `pi-event-pull.service.spec.ts`: source revision without status, duplicate, typed create, ambiguous → quarantine); OpenAPI v2 snapshot regenerated (additive) |
| `npx jest --selectProjects integration --runInBand` | ✅ **13 suites, 139 tests** | new `typed-attribute-mapping.int-spec.ts` (T05: digital `{name: 'Bearing', value: 3}` in `source_facts.reason`, `00:15:00` → 900 s with `DURATION_MISMATCH` against 20 min timestamps, unit derived from the asset binding, reason resolved by Name; identical redelivery = duplicate; field catalog and merged rules; 422 `INVALID_FIELD_RULES`), `source-mapping.int-spec.ts` (precedence via preview, normalised paths, ambiguous patterns → `unmapped_events` and no event, foreign binding → `invalid_target`, tenant B lists nothing / 404 / 422 foreign target, 403 analyst, 409 duplicate, PUT If-Match 200/412, v1 mirror + 409 `LEGACY_MAPPING` + v1 `find-mapping` via the resolver), `code-libraries.int-spec.ts` (T18: 3-level tree reloads identically, cycle 422, subtree move re-paths, retire parent 409 with `details.references`, retire leaf, rule v1 row unchanged after rule v2 and code v3, `asOf` picks the version, event classified by the rule in force + user override flagged, `event_coding` points at code version 4; same code in two tenants, 409 duplicate, foreign 404/422, shared code 422, 403, 422 `FIELD_NOT_ALLOWED`), `failure-and-loss-libraries.int-spec.ts`. `event-backfill.int-spec.ts` now reverts three migrations to reach the pre-1.1 shape |
| ESLint (`prettier/prettier` off) on every created/changed file under `src/` and `test/` | ✅ no findings in authored code | 3 pre-existing `no-unsafe-enum-comparison` errors in `api-exception.filter.ts` (same lines at HEAD), 4 `no-unsafe-argument` warnings on `app.getHttpServer()` as in every spec; new specs type their response bodies |
| Size rules | ✅ new functions ≤ 40 lines, files ≤ 400 lines | exceptions: Nest DI constructors (`PiFrameIngestService` 7, `PIEventPullService` 7 — was 13, `ProductionEventsV2CommandService` 5); migration 478 lines (generated DDL) |
| Frontend | ✅ `vite build` passes | `PIMapper.ts` defaults derived from the catalog; its remaining `no-explicit-any` lint findings are in untouched functions |
| Backfill on dev DB `proact` | ⚠️ not run | dev DB has no codes or mappings; the app applies the migration on next boot |

# Plan 1.4 verification (8 Oct 2026)

| Step | Result | Notes |
|---|---|---|
| Migration on scratch | ✅ up → `migration:generate --dr` finds **no changes** → down → up | `EventOperations1791843200000`: `event_relations`, `bulk_jobs`, `production_events.occurrence_id` (backfill = id, NOT NULL, insert trigger) + `superseded_by_event_id`, review kind `pending_source_confirmation` (enum recreated both ways). `event-backfill.int-spec.ts` now reverts four migrations to reach the pre-1.1 shape |
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | |
| `npx jest --selectProjects unit fixtures` | ✅ **37 suites, 1053 tests** | new: `event-operations.spec.ts` (split inside/outside/open, property checks: duration conserved on split, split → merge restores the parent, amounts conserved; merge adjacency/overlap/gap policy/units/classification/coding conflicts; close rules), `bulk-code-plan.spec.ts` (exclusions, refusal codes, coding with defaults, affected windows), `unit-downtime.spec.ts` (KPI06: fragments of one occurrence count once), legacy status (superseded → Cancelled); OpenAPI v2 snapshot regenerated (additive: 5 routes, `occurrenceId`/`supersededByEventId`, history `relations`) |
| `npx jest --selectProjects integration --runInBand` | ✅ **16 suites, 165 tests** | new `event-operations.int-spec.ts` (T37: 10:00–12:00 split at 11:00 → two children with one `occurrence_id`, parent superseded/Cancelled, downtime 7200 s from the children only, occurrence count 1; merge back → one event, `merged_from` to both, quantity/cost conserved; system revisions + `split_child_of` lineage; idempotent replay returns the same children; split outside 422, retracted 409, stale If-Match 412, missing 428, different units 422, gap 422 / bridged with policy, stale merge 412 with details; v1 GET shows Cancelled, v1 PUT 409; tenant B split/close 404, merge with a foreign id 404), `event-close.int-spec.ts` (manual close user revision, 409 when closed, 422 end before start; source-owned close → override + pending item → same source end resolves it automatically, different end → conflict and override kept; source correction of a split parent → `late_correction`), `event-bulk-code.int-spec.ts` (preview with stale/foreign/duplicate exclusions and windows; 500 events atomic with an injected DB failure → none changed, then all 500 coded; 412/404 refusals; foreign reason 422; 501 events → 202 job, replay 202 same job, tenant B 404, worker → `partial` 400/101 with the failed chunk's `STALE_REVISION`; foreign id → 404 before queueing) |
| ESLint (`prettier/prettier` off) on created/changed files | ✅ no errors in authored code | `src/`: clean; 3 pre-existing unused-import errors in `production-event/dto/create-production-event.dto.ts` (untouched). New specs type their bodies; only the usual `no-unsafe-argument` warnings on `app.getHttpServer()` |
| Size rules | ⚠️ mostly | new functions ≤ 40 lines, files ≤ 400; `production-event.entity.ts` 453 lines (was 442), `applySourceIn` 45 lines |
| CI run / data host | ⚠️ not run | dev DB gets the migration on next boot (`occurrence_id` backfill is set-based) |

# Plan 1.5 verification (8 Oct 2026)

| Step | Result | Notes |
|---|---|---|
| Migration on scratch | ✅ up → `migration:generate --dr` finds **no changes** → down ×2 → up → no changes | `IntakeCore1791929600000` (connections, secrets, ingestion jobs + transitions, partitioned `raw_observations` with monthly partitions created for the previous, current and next two months, `raw_identities`, `source_objects`, `ingestion_exceptions`, `replay_runs`, `outbox`, `inbox`, `bulk_jobs` lease columns) and `PiConnectionsToIntegrationConnections1791929600001` (checked with a uuid-tenant PI row → mirrored with the same id and `secret_ref`, password ciphertext in `secrets`; a `legacy` tenant row skipped). TypeORM's schema diff accepts the partitioned table. `EXPLAIN` (seqscan off) uses `IDX_outbox_state_next_attempt` + `IDX_outbox_tenant_aggregate` for the relay claim, `IDX_ingestion_jobs_state_next_run` for the job claim, `UQ_source_objects_identity` for the replay keyset |
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | |
| `npx jest --selectProjects unit fixtures` | ✅ **40 suites, 1103 tests** | new: `canonical-event.schema.spec.ts` (contract copy = `contracts/canonical-event.schema.json`, TS shape = schema properties, 4 examples valid, violations reported, kind/operation rules, canonical hashing), `source-object-ordering.spec.ts` (ordering table + fast-check property: any delivery order with duplicates settles on the newest version, 300 runs), `job-transitions.spec.ts` (every state × action); OpenAPI v2 snapshot regenerated (additive: connections, ingestion-jobs, ingestion-exceptions, replay-runs) |
| `npx jest --selectProjects integration --runInBand` | ✅ **21 suites, 195 tests** | new `intake-core.int-spec.ts` (11: accept → raw row in the current month partition + source object + `RawAccepted`; repeated message id → no raw row, `duplicate_count`, retry only while not normalised; duplicate content / revision / stale / `order_conflict`; schema-invalid retained + `schema_invalid`; binding mismatch 403 with nothing stored; raw rows immutable; `no_handler` once per inbox key; **T10 inbox**: consumer crash before commit → no key, no effect → redelivery applies once → third delivery duplicate; 3 concurrent duplicates → one effect; **outbox**: each id published once, failed publish backs off and holds back its aggregate, then publishes in order; `failed` after `OUTBOX_MAX_ATTEMPTS`), `intake-jobs.int-spec.ts` (6: two runners → one lease, expired lease taken over + `lease_reclaimed` audit; **crash recovery**: abort after 3 of 10 accepts → cursor not advanced, retry 1 → restart commits, 10 source objects, 10 raw rows, 3 duplicate deliveries; dead worker (lease held) replaced after expiry; stop during an in-flight page → page commits, job stopped, no new page, audit create/start/stop; drain → stopped + `drained`; failing source → backoff → `failed` after 2 retries), `intake-api.int-spec.ts` (4: secret stored encrypted and never returned, 422 `SECRET_IN_CONFIG`, 403 analyst, job create/409 `JOB_SCOPE_EXISTS`/pause/409 `INVALID_TRANSITION`/404 unknown action/404 other tenant/transitions/list filters, adapter test + discover, 422 `ADAPTER_UNAVAILABLE`), `intake-pi-pipeline.int-spec.ts` (4: PI bridge created → unchanged re-read (no raw row) → updated, `EventChanged` r1/r2 in the outbox, relay redelivery has no effect; unplaceable frame → `unknown_unit` + `unmapped_events` mirror; failed revision (412) writes no outbox row; source retraction → `retracted` + `EventRetracted`), `intake-replay.int-spec.ts` (4: **T06** unknown path → `unknown_unit`, 403/404 guards, binding added → replay via `/resolve` and via `/connections/{id}/replays` → exactly one event on the new unit, exception resolved with the first run id, raw rows `accepted` + 2 × `replayed` pointing at the original; **replay invariance** fast-check property, 8 runs of 1–3 PI objects × 1–3 versions delivered shuffled with duplicates, then replayed: latest hashes, canonical end times and one event per object identical before and after replay). `event-bulk-code.int-spec.ts` +1: a bulk job whose worker hangs after chunk 0 is reclaimed after its lease expires and completes chunks 1–2 (attempts 2, 501 coded). `event-backfill.int-spec.ts` reverts 5 migrations; `harness.tableNames()` ignores partitions |
| ESLint (`prettier/prettier` off) on every created/changed file under `src/` | ✅ no findings | tests: only the usual `no-unsafe-argument` warnings on `app.getHttpServer()` |
| Prettier | ✅ `--write` on created files; `--check` clean | |
| Size rules | ✅ new functions ≤ 40 lines, files ≤ 400 lines | DI constructors over 4 parameters: `IntakeQueriesV2Service` (5 repositories), `PiIntervalHandler` (5); `PiFrameIngestService`/`PIEventPullService` unchanged at 7 |
| `npm run build` + worker smoke | ✅ | `DB_NAME=proact_scratch PROCESS_ROLE=worker WORKER_PORT=4005 node dist/src/worker.js` (scratch DB because dev `proact` is 4 migrations behind and the worker never migrates): `/health/ready` → `{"status":"ready","database":"connected"}`, `/health/live` → `{"status":"ok","role":"worker"}`; outbox relay (1 s), job runner, replay runner and bulk crons ran ~60 s with no error log; process stopped (Windows: `Stop-Process`, the SIGINT from `timeout` is not delivered to node) |
| Dev DB `proact` | ⚠️ not migrated | still at `EventIntervalModel`; the API applies EventRevisions … PiConnectionsToIntegrationConnections on next boot |

# Plan 1.6 verification (8 Oct 2026)

Against the in-process PI Web API simulator (`test/simulators/pi-web-api/`). **The real-PI certification run is ⛔ pending D02** (no credentials, scope, templates or sentinel confirmation yet); no real-system result is recorded here.

| Step | Result | Notes |
|---|---|---|
| Migration on scratch | ✅ up → `migration:generate --dr` finds **no changes** → revert → up → no changes | `PiCertifiedIntake1792016000000`: `pi_page_manifests` (unique job/window/page), `pi_open_frames` (unique connection/WebId, index connection + last poll), `pi_sync_job_links` (v1 job → ingestion job crosswalk), PI connection capabilities `deletions: true` (down restores `false` and drops `batch`). `event-backfill.int-spec.ts` now reverts 6 migrations; scratch DB dropped afterwards |
| `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0 | |
| `npx jest --selectProjects unit fixtures` | ✅ **43 suites, 1114 tests** | new: `pi-time.spec.ts` (sentinel ≥ 9999-01-01 → open, real ends kept), `pi-window-cursor.spec.ts` (lookback / checkpoint − overlap, T07 checkpoint only after the short page, in-progress window kept, rescan/inventory windows, 1.5 cursor shape, scope validation), `pi-http-client.spec.ts` (`Retry-After` seconds/date capped 60 s, full jitter capped 10 s, failure classification); scheduler specs updated for the crosswalk. OpenAPI v2 snapshot unchanged (no v2 route or schema change) |
| `npx jest --selectProjects integration --runInBand` | ✅ **25 suites, 214 tests** | new (19 tests): `pi-certified-paging.int-spec.ts` (**T07** 1201 frames / pages of 500 / page 3 → 500: no window checkpoint, retry → 1201 unique source objects and raw rows, manifest 3 pages with page 3 attempts 2, 5 batch calls and no per-frame reads; **lost auth** → `failed` at once, health `auth_failed`, cursor unchanged; **worker killed** after 30 of 50 accepts + dead lease holder → take-over audited, 120/120 objects, 30 duplicate deliveries), `pi-certified-frames.int-spec.ts` (open sentinel → end/duration NULL, raw sentinel kept, tracked; **T08** frame opened 10 days ago closes 3 days ago outside the window → captured by the `open_frames` job, `EventChanged` v2, tracker cleared; 7-day rescan revises a corrected closed frame and dedupes an unchanged one; digital state kept in `source_facts.reason`, missing `Quantity` NULL, asset binding → asset's unit; mixed separators + ancestor walk; batch controller missing → per-frame reads, `capabilities.batch=false`), `pi-certified-deletes.int-spec.ts` (**T46**: failed listing / failed lookup retract nothing; confirmed deletion → `deleted_confirmed`, event `retracted` with user edit and revisions kept, `EventRetracted`; frame in another database not deleted; repeat → no second retraction), `pi-certified-connection.int-spec.ts` (PI01 diagnostics ok + batch detected, revoked auth → auth failed / rest skipped, `.invalid` host → dns failed, discover; `pi-browser` request: allowlisted GET + POST `/batch` forwarded, `/system`, traversal, POST elsewhere 403, DELETE and unknown field 400, other tenant 403; v1 on-demand pull reads pages 0/2/4 with `maxCount` 2; v1 sync job → 5 linked ingestion jobs, link row, window from the v1 watermark reads all 5 frames, v1 status `success`) |
| ESLint (`prettier/prettier` off) on created/changed files under `src/` | ✅ no findings in authored code | remaining: 17 pre-existing `no-unsafe-*` findings in `pi-web-api.service.ts` (same count as HEAD) and 1 in the untouched `pi-browser` `eventframes` route (HEAD had 3 in that file); tests: only `no-unsafe-argument` warnings on `app.getHttpServer()` |
| Prettier | ✅ `--write` on created files; `--check` clean | |
| Size rules | ✅ new functions ≤ 40 lines, files ≤ 400 lines | DI constructors over 4 parameters: `PiWebApiAdapter` (5), `PIEventPullService` (8, was 7); `PISyncSchedulerService.executeJob` shortened (failure path extracted) |
| Real PI certification (§6.4 real-system column) | ⛔ pending D02 | the matrix in `plans/phase-1/1.6-pi-event-frames-certified.md` lists every row as "pending D02"; what the PI administrator must provide is in `plans/DECISIONS.md` → "Still needed from you" |
| Dev DB `proact` | ⚠️ not migrated | the API applies the pending migrations (now including `PiCertifiedIntake`) on next boot |


> Re-verification of 1.6 by the coordinating session (9 Oct): tsc clean; unit + fixtures 1114/1114; integration 214 — one full run had 5 failures in `intake-jobs.int-spec.ts` (lease/timing tests), the suite passes alone and two further full runs passed 214/214. **Known flake** in the lease-timing tests under full-suite load; to be hardened (deterministic clock) before CI gating.
