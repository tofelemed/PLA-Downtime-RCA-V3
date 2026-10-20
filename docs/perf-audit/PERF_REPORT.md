# Pro-Act backend performance audit: Phase 1 (measurement)

Date: 2026-10-20 · Branch `feat/downtime-area2-b` · Companion: [ENDPOINT_SCORECARD.md](ENDPOINT_SCORECARD.md) (every measured GET), DB audit [../db-audit/AUDIT_REPORT.md](../db-audit/AUDIT_REPORT.md).

No application code was changed. Everything below was measured on a **local throwaway copy** of the plant database. The tools live under `perf-audit/`:
- an instrumented API process, using a Node preload with no app changes;
- a GET sweep, a load test, page-flow replays and a write benchmark;
- a CPU profile.

The plant database (`proact`) and the running stack were only read (GETs, catalog queries).

## Stack and setup

| Item | Value |
|---|---|
| Runtime | Node 24.11, NestJS 11 on Express 5, TypeORM 0.3 → `pg` 8.16, PostgreSQL 15 |
| Other | Socket.IO (2 namespaces), in-process outbox (Kafka not used), MQTT + PI Web API adapters, `@nestjs/throttler` (in-memory). `redis` is a dependency but is never imported. |
| Deployment | nginx (:8070, gzip on) → API container (`PROCESS_ROLE=api`, pool 10) + worker container |
| Test bed | `proact-perf-postgres` (127.0.0.1:5435, copy of `proact`, same server settings, fsync on). The built API runs on :4014 with `NODE_ENV=production`, `PROCESS_ROLE=api` and `perf-audit/instrument.cjs` preloaded. The 14 plant users got a perf-only password **in the copy only**. |
| Data volume | One plant, about 2 days of live data: 180 events, 10 periods, 26k KPI rows. **Latency at higher volume is not measured** (§5). |
| Host | Windows 11, Docker Desktop (WSL2), 6 vCPU. Raw `SELECT 1` round trip from Node: p50 0.53 ms, p95 0.84 ms. |
| Targets | p95 < 300 ms for reads and < 800 ms for writes; list payloads < 100 KB; zero N+1 on hot paths |

## 1. Executive summary: top 10 by user-visible impact

1. **P01: Every request rebuilds the caller's identity from the database.**
   - Before the handler runs, each request loads the user, their scopes and their delegations: 3 statements plus 3 RLS bindings, **6 round trips, 6.8 ms of a 7.4 ms request** on a route with no data of its own.
   - Across a dashboard load (app shell + dashboard, 23 requests) that is about 138 of 358 statements.
   - Sockets pay the same on every subscribe.
2. **P02: RLS session binding costs an extra round trip on every pool checkout.**
   - **49% of all statements** executed during the sweep were `SET/RESET ROLE; set_config(…)`.
   - Statements outside a transaction each check out a connection, so they each pay it.
3. **P03: Throughput ceiling and tail latency under concurrency.**
   - One API process tops out at **about 300 req/s** on an identity-only route and **45–90 req/s on report endpoints**.
   - At 16 concurrent requests, four hot reads **miss the 300 ms p95 target**: downtime 445 ms, reconciliation-status 468 ms, period-summaries 307 ms, OEE 217 ms (passes).
   - At 32 concurrent: downtime 861 ms, reconciliation-status 859 ms, period-summaries 1.3 s. Period-summaries throughput *falls* from 70 to 37 req/s.
   - Causes: P01 + P02 round trips × a 10-connection pool (pinned at 10 throughout), and a Node main thread 74% busy.
4. **P04: v1 routes authenticate twice.**
   - A redundant `@UseGuards(JwtAuthGuard)` on 12 v1 controllers runs the identity load twice: **14 statements instead of 6, with 2 identical repeats**.
   - This includes `GET /api/auth/profile`, step 2 of every app start (20 statements, 3 repeats, p95 41 ms).
5. **P05: `pg_timezone_names` costs 45 ms on every call.**
   - `TIMEZONE_SQL` joins the system view `pg_timezone_names` to validate the plant timezone. Postgres builds that view by scanning the timezone files every time.
   - Affects `/reports/activity-summary` and the v2 audit-log list and summary (p50 37–47 ms, mostly this).
6. **P06: Report endpoints repeat the same work within one request.**
   - `reconciliation-status` loads the period states twice (62 statements).
   - `downtime` runs its `shown` CTE 4 times (38).
   - `rca-causes` repeats 10 identical statements (40).
   - These are the four slowest hot reads, and they are on the dashboard.
7. **P07: Oversized list payloads.**
   - `GET /production-periods/{id}/runs` returns **1 052 KB** (24 KB gzip): a default page of 100 runs, each with its full input fingerprint.
   - v1 `GET /api/audit-logs` returns **242 KB** (default 500 rows, no cap: DB audit F10).
   - `GET /production-events` without `limit` returns **172 KB**. The UI asks for 20, which gives 50 KB per Event Hub load.
8. **P08: Chatty page loads (frontend call map, §4).**
   - Dashboard data-ready = 9 shell requests + 14 dashboard requests: 161 ms warm and 338 ms cold, measured without the browser's 6-connection limit.
   - The bootstrap is a 3-step waterfall: refresh → profile → organization + tenant.
   - `/organizations` and `/tenants/{id}` are fetched twice each.
   - Realtime notices invalidate many active report queries, and unknown notice types refetch everything.
9. **P09: CPU spent outside the handler.**
   - **JWT verified twice per request**, and `jsonwebtoken` tries `createPublicKey` on the HMAC secret each time: 2.0% of CPU.
   - In-memory throttler pruning: 0.9%.
   - Text console logging of 2 lines per request: 0.6% plus a share of the `writev` 8%.
   - TypeORM hydration and query building: 9.6%.
10. **P10: Blocking or unbounded work reachable from HTTP (static review, not measured here).**
    - The production-events CSV export builds up to 50 000 rows into one buffer inline.
    - PI Web API test, discover and sample run synchronously: up to about 100 s per call with 3 × 30 s retries, a new `https.Agent` (no keep-alive) per operation, and no circuit breaker.

**Targets at current data volume, single user:**
- **Reads:** every one of 184 measured GET routes has a p95 under 120 ms. ✓
- **Writes:** event edit p95 111 ms, notification read p95 56 ms. ✓
- **Payloads:** 3 list routes are over 100 KB. ✗
- **Hot paths:** no per-row N+1 was observed (max 10 repeated statements, `rca-causes`), but the fixed identity and binding overhead dominates every hot path.

**Under concurrency:** 4 hot reads miss the p95 target at 16 concurrent requests. ✗

## 2. Endpoint scorecard (hot paths)

Single-user timings are server-side, from the sweep (Analyst role: RLS on, money redacted; 1 cold + 10 warm). Load columns are client-side p95 at 16 concurrent requests, closed loop for 10 s with the throttle raised. Every statement count includes the 6 identity/binding round trips. The full table of 184 routes is in [ENDPOINT_SCORECARD.md](ENDPOINT_SCORECARD.md).

| Endpoint (screen) | p50 | p95 | p99 | q (bind) | Payload raw / gzip | c=16 p95 · max req/s | Verdict |
|---|---|---|---|---|---|---|---|
| `GET /v2/reports/downtime` (dashboard ×2, Event Hub, reports) | 63 | 79 | 79 | 38 (19) | 8.0 / 2.1 KB | 445 ms · 49 | ⚠ p95 > 300 at c=16; 4× same CTE |
| `GET /v2/reports/reconciliation-status` (dashboard) | 50 | 76 | 76 | 62 (31) | 3.9 / 1.2 KB | 468 ms · 45 | ⚠ p95 > 300 at c=16; states loaded twice |
| `GET /v2/period-summaries` (plan grid) | 34 | 47 | 47 | 36 (18) | 11.6 / 1.9 KB | 307 ms · 70 (37 at c=32) | ⚠ degrades past c=16 |
| `GET /v2/reports/oee` (dashboard ×2, reports) | 44 | 59 | 59 | 20 (10) | 4.3 / 0.9 KB | 217 ms · 92 | ✓ (single) / near limit |
| `GET /v2/reports/rca-causes` | 89 | 105 | 105 | 40 (20) | 1.7 / 0.6 KB | – | ⚠ 10 repeated statements |
| `GET /v2/production-events?limit=20…` (Event Hub) | 18* | 26* | 34* | 12 (6) | 35 KB (limit 20); 50 KB per hub load | 188 ms · 151 | ✓ |
| `GET /v2/production-events` (no limit) | 25 | 30 | 30 | 12 (6) | **172 / 9 KB** | – | ⚠ payload |
| `GET /v2/production-events?isOpen=true…` (polled 30 s) | 18* | 25* | 42* | 12 (6) | small | 139 ms · 170 | ✓ |
| `GET /v2/approval-inbox` (polled 60 s) | 44 | 60 | 60 | 58 (29)† | 6.1 / 1.2 KB | 78 ms · 279 | ✓ |
| `GET /v2/rcas?limit=20` | 13* | 18* | 23* | ~10 | small | 90 ms · 243 | ✓ |
| `GET /v2/notifications/unread-count` | 9* | 14* | 17* | 8 (4) | < 1 KB | 164 ms · 312 | ✓ |
| `GET /api/auth/profile` (every app start) | 26 | 41 | 41 | 20 (10), 3 rep | 0.4 KB | 122 ms · 165 | ⚠ double identity (P04) |
| `GET /v2/field-catalog` (identity floor, no data) | 6 | 9 | 11 | 6 (3) | – | 88 ms · 310 | baseline |
| `GET /v2/production-periods/{id}/accounting` (period page) | 37 | 71 | 71 | 22 (11) | 15.2 / 5.1 KB | – | ✓ |
| `GET /v2/production-periods/{id}/runs` | 46 | 54 | 54 | 12 (6) | **1 052 / 24 KB** | – | ⚠ payload (P07) |
| `GET /api/audit-logs` (v1) | – | – | – | 14+ | **242 / 24 KB** | – | ⚠ payload, uncapped |
| `GET /v2/reports/activity-summary` | 37 | 43 | 43 | 12 (6) | 0.4 KB | – | ⚠ 45 ms in `pg_timezone_names` |
| `PATCH /v2/production-events/{id}` (write) | 76 | 111 | 115 | 28 (9) | – | – | ✓ |
| `POST /v2/notifications/{id}/read` (write) | 28 | 56 | 65 | 12 (6) | – | – | ✓ |

\* Client-side single-user (c=1) load numbers, which include about 1 ms of HTTP overhead. † The SuperAdmin figure; Analyst runs 4 + binding.

**Page data-ready time** (`perf-audit/flows.mjs`, Analyst, all calls of a step in parallel, no browser connection cap):

| Screen | Requests | Statements | Bytes | Cold | Warm |
|---|---|---|---|---|---|
| App shell (every page) | 9 (3 sequential steps) | 92 | 3 KB | 229 ms | 77 ms |
| Dashboard | 14 | 266 | 77 KB | 338 ms | 161 ms |
| Event Hub | 6 | 86 | 50 KB | 97 ms | 92 ms |
| Event detail | 6 (2 steps) | 68 | 8 KB | 64 ms | 63 ms |
| Reports | 5 (2 steps) | 68 | 14 KB | 81 ms | 57 ms |
| RCA case | 10 (2 steps) | 142 | 29 KB | 166 ms | 80 ms |
| Period page | 9 (4 steps) | 156 | 25 KB | 159 ms | 159–276 ms |
| RCA list / approvals / connectivity | 5 / 2 / 2 | 44 / 16 / 16 | ≤ 3 KB | 12–37 ms | 12–51 ms |

## 3. Findings

Severity is for production scale: many users and months of data. "Measured" items have numbers; "static" items come from code review with file references.

| ID | Area | Sev | Evidence (numbers) | Proposed fix | Expected gain | Risk | Breaking? | Effort |
|---|---|---|---|---|---|---|---|---|
| P01 | Auth / per-request DB | **High** | Identity = `users` + `user_scopes` + delegations, 3 statements + 3 bindings on **every** request (`request-context.factory.ts:58-115`). Identity-only route: 7.4 ms total, 6.8 ms DB. Dashboard load: 138 of 358 statements. | Cache the built identity per (user, tenant header) for 15 s in process. Invalidate on role / scope / delegation / active-flag change (same-process write + outbox notice); the key includes the tenant. | −3 statements and −3 RT per request (≈ −30 to −40% of statements on hot pages); higher throughput ceiling | Med: an authorization change can lag up to the TTL unless invalidated; needs tests | No | M |
| P02 | DB pool / RLS | **High** | `SET/RESET ROLE; set_config` = **49%** of statements (21 325 RESET + 6 566 SET in one run). One extra RT per checkout (`tenant-session-binding.ts:31-54`). | Remember the binding last applied to each pooled client and skip the statement when the next checkout needs the same one. A different tenant list (or anonymous) still re-binds. | Up to −49% of statements; most requests reuse a client bound to the same plant | **Med-High**: the RLS isolation path; covered by `tenant-rls` / `rls-policy-form` integration specs | No | S |
| P03 | Concurrency / pool | **High** | Max ≈ 300 req/s (identity only); reports 45–92 req/s. Pool pinned at 10 in 346 of 509 one-second samples (max 8 active in Postgres). c=16 p95: downtime 445, recon-status 468, period-summaries 307 ms. c=32 period-summaries 1.3 s at 37 req/s. Main thread 74% busy. | P01 + P02 + P06 first; then `DB_POOL_MAX` 20 (with PgBouncer if instances × pool > 80), and run more than one API replica. | Ceiling ×2–3 (estimated: statements −50%), tail latency back under target at c=16 | Low (config) | No | S (config) / M |
| P04 | Auth | **High** (cheap fix) | v1 controllers repeat the global `JwtAuthGuard` (asset, audit-log, hierarchy-mapping, organization, product, production-event, production-plan, task, tenant, unit, users, `auth.controller.ts:109`): **14 statements, 2 repeated**, versus 6 on v2. `/api/auth/profile`: 20 statements, 3 repeated, on every app start. | Remove the redundant `@UseGuards(JwtAuthGuard)` (the global guard already runs) | −6 statements (−12 RT) per v1 request; app start −6 | Low: route-guard coverage spec | No | XS |
| P05 | Query | Med | `pg_timezone_names` scan = **44.9 ms** per execution (`EXPLAIN ANALYZE`); `TIMEZONE_SQL` (`activity-summary.sql.ts:46-51`) mean 25–32 ms, max 120 ms per call | Read `sites.timezone` / `tenants.timezone` directly (validated when written), or cache per tenant with a TTL | −25 to −45 ms per call on activity-summary and the audit-log list/summary | Low | No | XS |
| P06 | Query (reports) | Med-High | recon-status: period states loaded twice (`reconciliation-status-report.ts:146` + section 2), 31 data statements. downtime: `shown` CTE ×4 (19). rca-causes: CTE ×6 + 3×3 lookups, 10 repeated. | Load once per request and share between sections; batch the per-cause lookups | −30 to −50% DB time on the 4 slowest dashboard reads | Low-Med (report numbers must be unchanged: fixture tests) | No | M |
| P07 | Payload | Med | `/production-periods/{id}/runs` 1 052 KB (100 runs × ~10 KB `inputFingerprint` …), serialize 7–9 ms. v1 `/api/audit-logs` 242 KB (limit up to unbounded). `/v2/production-events` default page 172 KB. | Runs list: summary view (drop the fingerprint, keep it on run detail) and default limit 20. v1 audit logs: cap the limit at 500 and use keyset (DB F10). Events: default `limit` 50. | Runs 1 MB → < 30 KB; audit ≤ cap | Low | **Yes**: response shape and defaults (flag + OpenAPI) | S |
| P08 | Call pattern | Med | Dashboard + shell = 23 requests / 358 statements. Bootstrap waterfall of 3 steps (229 ms cold). Duplicate `/organizations` (limit 100 + 500) and `/tenants/{id}` (×2). Full directories (`/assets`, `/reason-codes` all pages, `/users/directory?limit=500`) on most screens. Realtime invalidation refetches every active report on any event notice and the whole tenant for unmapped notice types (`invalidation.ts:95-113`). | Frontend: share the session's org/tenant through the query cache; map the missing notice types; scope report invalidation by window. Optional additive `GET /v2/session/bootstrap` (profile + org + tenant + flags + unread + branding) and `GET /v2/dashboard?from&to` aggregate. | −8 requests per app start; −1 waterfall step; fewer refetch storms | Low (frontend) / Med (new endpoints) | Additive only | M |
| P09 | CPU / middleware | Med | Profile (420 s under load): `createPublicKey` 2.0% (jsonwebtoken retries public-key parsing of the HMAC secret on every verify; tokens verified twice: `user-ip-throttler.guard.ts:43` + passport). Throttler `pruneExpiredHits` 0.9%. Console logger 0.6%. TypeORM 9.6%, `pg` 4.5%. | Verify the JWT once per request (reuse the throttler's decoded subject, or tracker from `req.user`), pass a `KeyObject` secret; use JSON logging at `warn` for 2xx in production (or sample); keep TypeORM `getRawMany` for hot lists | ≈ 3–5% CPU per request | Low | No | S |
| P10 | Blocking work (static) | Med | `GET /v2/production-events/export` builds ≤ 50 000 rows into one buffer inline (`production-events-export.ts:222-253`). PI `test` / `discover` / `sample` are synchronous: up to ≈100 s (3 × 30 s timeout + backoff), a new `https.Agent` without keep-alive per operation (`pi-client-factory.ts:47`, `pi-http-client.ts:97`), no breaker. | CSV via the existing export-job pipeline (202), or stream rows. PI: keep-alive agent per connection, a 10 s budget for interactive calls, discover/sample as jobs. | Event loop not blocked; bounded request time | Med | CSV: response becomes 202 + job (**breaking** if kept on the same route) | M |
| P11 | Throttling / proxy | Med | 300 req/min per user, **in memory per process**. `trust proxy` unset, so behind a load balancer all anonymous callers (login/refresh) share one IP bucket. `/api/health` is throttled. | `app.set('trust proxy', …)` from env; skip throttle for health; shared store (Redis is already a dependency) when more than one replica | Correct limits with several instances | Low | No | S |
| P12 | Realtime (static) | Low-Med | Socket handshake + every `/realtime` subscribe = full identity build (6 RT). The RealtimeFeed polls the outbox every 1 s per API process: 2 statements/s idle, about 172 800/day. The audit interceptor `save()` (SELECT + INSERT) broadcasts every audit row to all tenant sockets. | Reuse the P01 cache for sockets; LISTEN/NOTIFY or adaptive polling; audit insert via `insert()`, without the broadcast | Lower idle DB load and pool pressure | Low | No | S-M |
| P13 | Observability | Med | No metrics or latency histograms, no tracing. The request log is plain text without correlation id, user or tenant. The slow-query logger cannot see RLS binding or pool-wait time. Health returns 200 when the DB is down; `/api/health/detailed` is public and exposes the DB host. | `prom-client` (latency histogram per route, pool in-use / waiting, event-loop lag) or OpenTelemetry; correlation id in the request log; 503 on DB failure; protect `detailed` | Regressions become visible | Low | No (health status code changes) | S-M |
| P14 | HTTP server | Low | Node defaults: `keepAliveTimeout` 5 s (below the usual 60 s LB idle timeout → sporadic 502s), no request timeout. Express weak ETag computed for every body, but no client sends `If-None-Match`. `X-Powered-By` exposed. Node does not compress; nginx gzips (`/api-json` 191 → 42 KB), no Brotli. | `server.keepAliveTimeout` 65 s, `headersTimeout` 66 s, a request timeout; disable `x-powered-by`; Brotli at nginx optional | Fewer edge errors | Low | No | XS |
| P15 | Correctness | Low | v1 `GET /api/organizations/{id}`, `/api/tasks/{id}`, `/api/hierarchy-mappings/{id}` with a malformed id → **500** (`invalid input syntax for type uuid`); v2 returns 400 | `ParseUUIDPipe` on v1 `:id` params | Correct status, no error-log noise | Low | Status 500 → 400 | XS |

**Measured and fine:**
- **Event loop:** p99 lag stayed at 12–31 ms under load, with one 370 ms spike while the CPU profile was being written.
- **Memory:** heap 104–162 MB and RSS 288–303 MB, stable over 30 minutes; no leak visible in that window.
- **Boot:** Nest itself boots in about 1 s; the first requests are 2–3× slower than warm (JIT and new pool connections).
- **Serialization:** under 1 ms except the 1 MB runs list (7–9 ms).
- **Writes:** within target.
- **No N+1 per row on any measured hot list:** v2 lists batch their lookups (`?ids=` batching in the UI as well).
- **No external HTTP call inside a DB transaction** (static).

## 4. Proposed change plan

**Quick wins** (small, independent, no contract change):
1. **P04:** remove the duplicate `JwtAuthGuard`s on v1 controllers.
2. **P02:** skip re-binding a pooled connection that is already bound to the same tenant list. Prove it with the RLS integration specs.
3. **P05:** drop the `pg_timezone_names` join (or cache).
4. **P09:** verify the JWT once per request; pass a `KeyObject` secret.
5. **P14:** keep-alive and headers timeouts; disable `x-powered-by`.
6. **P15:** `ParseUUIDPipe` on v1 `:id`.
7. **P11:** `trust proxy` from env; `@SkipThrottle` on health.

**Needs refactor:**
1. **P01:** identity cache with invalidation, also used by the sockets (P12).
2. **P06:** one state load per report request; deduplicate `downtime` CTEs and the `rca-causes` lookups. Report fixtures must be unchanged.
3. **P10:** CSV export through jobs or streaming; PI keep-alive and an interactive time budget.
4. **P08 (frontend):** deduplicate bootstrap calls; complete the realtime invalidation map.
5. **P12:** audit insert without the broadcast; adaptive realtime polling.

**Needs API contract change or versioning** (flag and update the OpenAPI snapshot):
1. **P07:** a summary shape and default limit for `GET /production-periods/{id}/runs`; a smaller default page for `GET /production-events`; a cap on the v1 audit-log limit.
2. **P08 (optional, additive):** `GET /v2/session/bootstrap` and a dashboard aggregate endpoint.
3. **P10:** CSV export moved to the 202 + job pattern.

**Needs infrastructure change:**
1. **P03:** `DB_POOL_MAX` 20 per API process; 2+ API replicas behind nginx; PgBouncer (transaction mode) once replicas × pool > ~80.
   - Note: P02's session-level binding requires *session* pooling or switching to `SET LOCAL` inside transactions.
2. **P11:** a shared throttler store (Redis) when there is more than one replica.
3. **P13:** metrics endpoint plus a dashboard; JSON logs carrying the correlation id.
4. **P14:** optional Brotli at nginx.

## 5. Not measured, and why

- **Latency at production data volume.** The copy holds about 2 days of one plant. The report and list SQL is keyset/batched (DB audit), so growth should be gradual. Projected volumes are in DB audit F01/F04, but these latencies are measured at today's size only.
- **Browser behaviour.**
  - Rendering time and the 6-connections-per-origin limit (HTTP/1.1 through nginx) are not modelled. The page-flow numbers are API "data ready" times with unlimited parallelism, so the real dashboard is slower.
  - I did not drive a real browser through the screens. The call sets come from a static map of the frontend (file references in the findings) and were replayed.
- **The PI Web API** (no reachable server) and **MQTT**. P10 and P12 are static findings.
- **The CSV export and file downloads.** These were excluded from the sweep, and P10 is static.
- **Multi-instance behaviour, the socket fan-out, the realtime feed under real event rates, and the worker process.** Only one API process was measured.
- **Production network latency.** Here the RT is 0.53 ms (Docker Desktop on Windows). Lower RT on Linux would shrink P01/P02 in milliseconds but not in round trips or pool occupancy.
- **Long-run memory:** only about 30 minutes was observed.
- **Instrumentation overhead:** about 3.5% CPU (the `instrument.cjs` frames in the profile). Timings are server-side and include it.
- **Writes:** only 2 write paths were timed (notification read, event edit). Other mutations (approvals, bulk coding, recompute) enqueue worker jobs, and the worker was not run.
- **About 60 GET routes** returned 400/404/422 because the sweep could not supply a valid id or parameter, plus 14 routes refused for the role (403). See the scorecard footer.

## 6. Re-running the benchmarks

```bash
# 1. Throwaway database (copy of proact; never touches the plant database)
docker compose -p proact-perf -f perf-audit/docker-compose.perf.yml up -d --wait
bash perf-audit/clone-db.sh
#    set a perf-only password on the copy's users (bcryptjs hash) and export PERF_PASSWORD

# 2. Build and start the instrumented API on :4014 (API role, no schedulers, no migrations)
(cd server/pro-act-backend && npm run build)
PERF_OUT=perf-audit/out/sweep-server.jsonl PERF_SQL=1 bash perf-audit/start-api.sh &
#    for load tests add THROTTLE_LIMIT=100000000; for a CPU profile add PERF_PROFILE_DELAY_MS / PERF_PROFILE_MS

# 3. Measurements (each writes JSONL under perf-audit/out/)
node perf-audit/bench-sweep.mjs --roles SuperAdmin,Analyst --warm 10 --out perf-audit/out/sweep-client.jsonl
node perf-audit/report.mjs --client perf-audit/out/sweep-client.jsonl --server perf-audit/out/sweep-server.jsonl --json perf-audit/out/summary.json
bash perf-audit/load-top.sh 10          # 11 hot endpoints × concurrency 1/4/16/32
node perf-audit/flows.mjs --runs 6      # page data-ready time per screen
node perf-audit/writes.mjs --runs 20    # perf copy only
node perf-audit/profile-summary.mjs perf-audit/out/<run>.jsonl.cpuprofile

# 4. Tear down
docker compose -p proact-perf -f perf-audit/docker-compose.perf.yml down
```

`perf-audit/out/` holds this run's raw data (sweep, load, flows, writes, CPU profile, connection samples). It is generated output and should not be committed.
