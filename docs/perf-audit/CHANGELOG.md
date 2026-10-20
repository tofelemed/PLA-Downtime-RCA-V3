# Backend performance audit: change log and handoff

Companion to [PERF_REPORT.md](PERF_REPORT.md) (Phase 1 findings) and [ENDPOINT_SCORECARD.md](ENDPOINT_SCORECARD.md) (baseline per route). All numbers come from the local perf copy of `proact` and the instrumented API on :4014 (`perf-audit/`), at today's data volume (one plant, about 2 days).

Branch `feat/downtime-area2-b`, commits `96eface2..4176eeb4`. Each finding is its own commit, containing only the files of that change. Other work in progress on the branch stayed out of every commit.

## Overall, before → after

**GET sweep** (every v2 + v1 GET route, 1 cold + 10 warm calls each, server-side):

| | SuperAdmin (196 routes) | Analyst (183 routes, RLS on) |
|---|---|---|
| Statements per request (mean) | 12.8 → **4.1** | 12.5 → **6.0** |
| RLS binding statements per request | 6.3 → **0.0** | 6.2 → **2.0** |
| Repeated identical statements (all routes) | 55 → **4** | 47 → **4** |
| Median route p50 | 13.2 → **9.0 ms** | 12.3 → **10.5 ms** |
| Median route p95 | 17.3 → **11.9 ms** | 15.8 → **12.9 ms** |

Single slow samples (GC / host) make individual p95 values noisy with 10 samples. For example, `uncertainty-budgets` has p50 12 ms but one sample of 366 ms. Medians are the reliable comparison.

**Load** (closed loop, 10 s per level, client-side, `perf-audit/load-top.sh`):

| Endpoint | c=16 req/s | c=16 p95 | c=32 req/s | c=32 p95 |
|---|---|---|---|---|
| identity only (`/v2/field-catalog`) | 310 → **424** | 88 → **55 ms** | 304 → **432** | 145 → **102 ms** |
| `/api/auth/profile` (every app start) | 165 → **207** | 122 → **103** | 159 → **219** | 270 → **177** |
| unread count | 201 → **312** | 164 → **64** | 312 → 305 | 133 → 134 |
| Event Hub list | 118 → **146** | 188 → **137** | 151 → 145 | 275 → 273 |
| current stops (30 s poll) | 170 → **200** | 139 → **105** | 159 → **239** | 316 → **168** |
| downtime report | 45 → **51** | 445 → **370** | 49 → **52** | 861 → **668** |
| OEE report | 92 → **120** | 217 → **165** | 88 → **111** | 450 → **367** |
| reconciliation-status | 43 → **57** | 468 → **389** | 45 → **59** | 859 → **652** |
| approval inbox (60 s poll) | 276 → **424** | 78 → **50** | 279 → **402** | 166 → **108** |
| RCA list | 243 → **345** | 90 → **59** | 239 → **368** | 173 → **109** |
| period summaries | 70 → **80** | 307 → **259** | 37 → **84** | 1 300 → **450** |

No errors at any level. **Still above the 300 ms p95 read target at 16 concurrent:** the downtime and reconciliation-status reports (see Deferred).

**App shell** (every page load, `perf-audit/flows.mjs`, warm median): 9 → **4** requests, 50 → **34 ms** data-ready, 43 → **30** statements.

## Changes

| ID | Commit | Change | Before → after (measured) | Tests |
|---|---|---|---|---|
| P04 | `96eface2` | Removed the redundant `@UseGuards(JwtAuthGuard)` on 12 v1 controllers (the global guard already runs) | 23 v1 routes: 13.8 → 8.6 statements, p50 16.7 → 12.5 ms, repeated 41 → 1 | unit 2 575; route-guard / write-access coverage int |
| P02 | `e5ea2c21` | RLS session binding is skipped when the pooled connection already carries the same binding | statements 12.1 → 6.1 per request; c=16 req/s, median of 3 runs: downtime 45 → 55, recon-status 43 → 51, events 118 → 164 | unit (reuse / re-bind / re-bind after failure); new tenant-rls case on reused connections (a broken skip fails 4 of 6); 16 RLS suites |
| P05 | `92e849ca` | Plant timezone read directly; each zone name checked against `pg_timezone_names` once per process | activity-summary p50 40 → 14 ms (SuperAdmin), 38 → 9 ms (Analyst); audit-log summary 38 → 9 ms | unit; 3 int suites |
| P14 | `afc10e62` | keepAliveTimeout 65 s (headers 66 s), `X-Powered-By` removed | `Keep-Alive: timeout=5` → `65`; header gone | unit; guard int |
| P15 | `1bc42ec1` | `ParseUUIDPipe` on v1 organizations / tasks / hierarchy-mappings `:id` | malformed id: 500 → 400; unknown id still 404 | unit; built-API probe |
| P11 | `f389552e`, `63b5bc56` | `TRUST_PROXY` (compose: `loopback, uniquelocal`); health exempt from throttling; contract test now throttles failed logins | THROTTLE_LIMIT=5: health 10/10 200; login 401×5 then 429 | unit (setting + X-Forwarded-For); api-contract int |
| P01 | `5cec381d` | Request identity (user role/active, own scopes, delegations + delegator grants) read in **one** statement; still on every request (D15) | statements per request 6.4 → 4.5 (SuperAdmin), 8.5 → 6.3 (Analyst); identity-only route 3 → 1 | factory unit; role-delegations int checks `identityFor` = `grantsForUser`; integration in 8 chunks: 199/202 (3 failures exist without the change) |
| P08 | `324df66d` | `GET /v2/session/bootstrap` (branding, flags, unread, sites, acting plant, full plant directory); shell queries take their first load from one shared request, with every fallback kept | shell: 9 → 4 requests, 50 → 34 ms, 43 → 30 statements | service + batching unit; frontend 1 996 / 1 996; OpenAPI + types gain one path |
| P06 | `e91e8390` | rca-causes: one approved-impact read per distinct link set, in parallel | 40 → 10 statements (Analyst), repeated 10 → 0, p50 89 → 23 ms, p95 105 → 27 ms; same output | rca int suites (5) |
| P07 | `fefbe4b5` | v1 `GET /api/audit-logs` page size 1–500 (larger or `0` capped; default unchanged) | `limit=0` / `limit=100000`: 1 313 rows / 688 KB → 500 rows / 269 KB | unit; audit int |
| P12 | `ced9c921` | Audit rows written with `insert()` instead of `save()` | 40 audited writes: audit statements 81 → 41, BEGIN/COMMIT 120 → 40 | 8 audit int suites |
| P13 | `f53b8c7a` | `/api/health` answers **503** (same body) when the DB does not answer; `/api/health/detailed` SuperAdmin only | anonymous health 200, detailed 401, SuperAdmin 200 | controller spec (200 / 503); guard coverage int |
| guard | `e532e1c5`, `4176eeb4` | Per-request statement budgets in CI (`request-overhead-budget.int-spec.ts`). The existing N+1 guard (`query-budget.int-spec.ts`) was overwritten by mistake in `e532e1c5` and restored unchanged in `4176eeb4` | unread 4, flags 4, v1 events 6, bootstrap 14; undoing P02 fails it (22 > 14) | — |

**Contract changes** (all flagged in the commit messages):
- `GET /v2/session/bootstrap` is a new endpoint (additive).
- Health returns 503 while the database is down, and `/health/detailed` now needs auth.
- v1 malformed ids return 400 instead of 500.
- The v1 audit-log `limit` is capped at 500.

No existing response shape changed.

## Tried and not shipped (no measurable gain → reverted)

| Item | What was measured | Outcome |
|---|---|---|
| P09: JWT secret as `KeyObject` | `jwt.verify` 47 → 11 µs (microbenchmark), but end-to-end identity-floor throughput 340–384 req/s vs 402 before (noise ≥ the ≈1 % CPU saved) | reverted |
| P03: `DB_POOL_MAX` 20 | 4 report endpoints × 4 runs at c=16: no consistent gain (oee +62 %, recon-status −10 %) | kept 10; Node CPU, not the pool, is the limit now |
| P08: generic `POST /v2/batch` + client batching (behind a flag) | With a modelled 6-connection browser: no added latency, dashboard 121 → 121 ms and RCA case 65 → 223 ms; with a 40 ms round trip, dashboard 260 → 178 ms (first run) / 230 → 214 ms (second), small pages up to 10 % slower | reverted (endpoint, client, tests, OpenAPI). HTTP/2 at the TLS terminator lifts the browser connection limit for every request without app code |
| DB audit F03/F15 indexes | see `docs/db-audit/CHANGELOG.md` | not needed |

## Deferred (approved, not done; reason)

| ID | Item | Why deferred / next step |
|---|---|---|
| P06 | downtime report: 4× the `shown` CTE, run sequentially (`downtime-report.ts`) | The file carries another session's finished but uncommitted Tier 2 edits on the same lines. Parallelise the independent reads (cells, stats, summary, coverage, calendar basis) once that work is committed. Expected: about 4 sequential round trips → 1 wave. |
| P06 | reconciliation-status loads the overdue periods' states twice | Bounded (`OVERDUE_LIST_LIMIT`, about 7 statements) and does not grow with data; removing it means serialising the parallel fold. Low value. |
| P07 | `/production-periods/{id}/runs` 1 MB per page (about 5.5 KB `inputFingerprint` per run) | No frontend caller. Dropping the field is a breaking change with no run-detail endpoint to replace it. **Needs your decision.** |
| P10 | production-events CSV export built in memory (≤ 50 000 rows); PI test/discover/sample synchronous, no keep-alive | No CSV volume or reachable PI server here to measure. Stream the CSV rows; per-connection keep-alive agent and a 10 s budget for interactive PI calls. |
| P13 | metrics (latency histograms, pool, event-loop lag), JSON logs with correlation id | Needs a new dependency (`prom-client` or OpenTelemetry). **Needs your approval** (CLAUDE.md). |
| P12 | RealtimeFeed polls the outbox every 1 s per process; legacy `auditLogCreated` broadcast has no consumer in this repo | LISTEN/NOTIFY or adaptive polling; drop the broadcast once external consumers are ruled out |
| P08 | frontend: `/organizations` + `/tenants/{id}` still read in session restore (duplicates of the bootstrap); realtime invalidation fan-out | frontend refactor of the auth restore flow |
| infra | HTTP/2 (+ Brotli) at nginx/TLS; two API replicas; shared throttler store (Redis) with replicas | infrastructure changes |

**Integration failures that exist without these changes** (confirmed by running them with the change removed):
- `event-backfill`: its legacy fixture inserts text into a `uuid` column.
- `feature-flags`: one flag is not off by default.
- `write-access`: expects `READ_ONLY_ROLE` but gets `FORBIDDEN_ROLE` since `dd04dd24` added a roles check to event creation.

The other session fixed the same mismatch in `auth-tokens`.

## Regression protection

- `test/integration/request-overhead-budget.int-spec.ts`: statements per request for 4 routes (identity, v1 guard, shell bootstrap). It fails with the list of statements.
- `test/integration/query-budget.int-spec.ts` (existing): list statement counts do not grow with row count.
- `perf-audit/`: repeatable benchmarks, run against the throwaway copy only.
  - `remeasure.sh <label> <filter>`: sweep plus summary.
  - `load-top.sh`: hot endpoints at concurrency 1/4/16/32.
  - `flows.mjs [--browser6] [--rtt ms]`: page data-ready time per screen.
  - `writes.mjs`: write timings.
  - `probe.sh`: status and size of chosen URLs.
  - `int-chunk.sh n 8`: integration suite in chunks.
  - Steps are in PERF_REPORT §6.

## Monitoring checklist (after deploy)

| Signal | Where | Alert |
|---|---|---|
| API p95 per route | access log or a future metrics endpoint (P13 deferred) | reads > 300 ms, writes > 800 ms for 5 min |
| Top statements by total time | `pg_stat_statements` (enabled, DB audit F08) | a new entry in the top 5; any statement with mean > 100 ms and > 1 000 calls/day |
| Statements per request | CI: `request-overhead-budget` | any budget exceeded |
| RLS binding rate | `pg_stat_statements` calls of `SET ROLE` / `RESET ROLE` vs total | binding > 20 % of statements (P02 regressed) |
| DB pool | `pg_stat_activity` connections from the API | 10/10 in use with backends idle for > 1 min |
| Health | `/api/health` status code | any 503; Docker health "unhealthy" |
| 429s | access log | anonymous 429s from many clients at once (proxy trust missing) |
| Slow-query log | API log `[SlowQuery]` (> 500 ms) and Postgres `log_min_duration_statement` (500 ms) | > 10 per hour |
| Event loop | `perf-audit/instrument.cjs` runtime samples (diagnostic runs) | p99 lag > 100 ms under normal load |
