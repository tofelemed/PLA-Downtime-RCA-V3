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
