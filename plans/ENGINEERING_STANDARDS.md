# Engineering Standards — performance and code quality

Applies to every sub-phase in `plans/`. These are checkable rules; CI and 3.11 verify them. Adapted to this stack: React 18 + Vite SPA served by nginx (no SSR framework), NestJS 11 + TypeORM on PostgreSQL, Kafka/MQTT, optional Redis.

## Backend

**Database**
- Index every column used in `WHERE`, `JOIN`, `ORDER BY` and every FK; composite indexes start with `tenant_id`; time-range queries use `(tenant_id, scope, start_time)` or GiST range indexes. Verify new query shapes with `EXPLAIN (ANALYZE, BUFFERS)` and paste the plan in the PR when > 10 ms on fixture data.
- No N+1: load relations with joins or batched `IN` queries. Integration tests for list endpoints assert a maximum query count per request.
- Select only needed columns in read models (`QueryBuilder.select`), never `SELECT *` on wide/raw tables.
- Every list endpoint is paginated; v2 uses **keyset (cursor)** pagination, never `OFFSET` on large tables (API01).
- Bulk writes use `insert().values([...])` / `upsert` with `ON CONFLICT`, in chunks of ≤ 1 000 rows; never row-by-row loops for ingestion or backfills.
- Connection pooling configured per process (`pg` pool `max`), `statement_timeout` 30 s, `maxQueryExecutionTime` 500 ms slow-query logging.
- Decimals are `numeric(24,8)` and `decimal.js`/string in code; no floating-point money or quantities (§3.3).

**Caching**
- Cache-aside (Redis) only for hot, read-heavy, rarely changing data: code libraries, profile/rate resolution, calendars/shift instances, feature flags. Keys include `tenant_id`.
- Every cache entry has a TTL (default 5 min) **and** a stated invalidation path (outbox event → bust). Never cache calculation results, period views or anything revision-bound; they are already immutable per run and served by id.
- Cache layer must degrade to miss-only when Redis is unavailable.

**API**
- Batch endpoints for bulk operations return per-item success/failure (`bulk-code`, replays, imports); ≤ 500 items atomic, larger → async job (DT10/API04).
- Lists support field selection where payloads are wide (`?fields=`) and always pagination.
- Response compression on the API (`compression` middleware) for direct clients; nginx brotli/gzip in front of the SPA.
- Timeouts and retries with jittered backoff on **every** outbound call (PI, brokers, webhooks); bounded retries; circuit-break noisy connections.

**Async**
- Slow work (exports, replays, recomputes, webhooks, imports, backfills) runs in the worker via jobs and returns `202 Accepted` + job id.
- Independent downstream calls run in parallel (`Promise.all` with per-call timeouts).
- Services are stateless: locks are DB leases/advisory locks, never in-memory sets; sessions are tokens.

**Measure**
- Targets (from spec §17.1 and this file): simple scoped reads p95 < 200 ms; event first page / indexed lists p95 < 2 s at target load; 30-day unit dashboard p95 < 3 s; period recompute p95 < 60 s; intake 1 000 obs/s sustained.
- Slow-query logging on in all environments; k6 load test before each release (3.11); Prometheus histograms per route and job kind (3.12).

## Frontend

**Loading**
- Code-split by route (`React.lazy` + `Suspense`); lazy-load heavy components: recharts charts, React Flow diagrams, react-chrono timelines, editors, large dialogs.
- Bundle budget: initial JS ≤ 300 kB gzip; check with `rollup-plugin-visualizer` (`npm run build:analyze`) in CI; remove unused dependencies (e.g. the duplicate `react-flow-renderer`/`reactflow`); import submodules (`date-fns/format`), not whole libraries.
- The app is a SPA: there is no SSR. Equivalent wins come from nginx serving hashed, immutable assets with long cache headers, brotli/gzip, HTTP/2 at the TLS terminator, and a small first bundle.

**Images, fonts, assets**
- Few images in this app; any added image uses modern formats (WebP/AVIF), explicit `width`/`height` (no layout shift), lazy loading below the fold.
- Preload the critical font, `font-display: swap`, subset to used glyphs.

**Rendering**
- Keep state local; memoize (`useMemo`/`React.memo`) only when profiling shows a problem.
- Virtualize long lists/tables (`@tanstack/react-virtual`): events, periods, state segments, quarantine.
- Debounce search inputs (300 ms) and resize/scroll handlers.

**Data fetching**
- TanStack Query is the only data layer for v2: dedupes, caches, revalidates; query keys include tenant/scope/window/tz/filters/ledger/revision (UX02).
- Fetch in parallel, not in waterfalls; paginate or infinite-scroll; prefetch the next page/likely action on hover or near-end.
- Never download a tenant's full event list to compute anything in the browser; KPIs come from server read models.

**Perceived performance**
- Skeleton loaders (`<DataState loading>`) instead of blank screens; the seven UX states (UX03) are standard components.
- Optimistic updates only for low-risk coding actions with server confirmation and rollback; **never** for submit/approve/revise or anything revision-sensitive (412 handling instead).

**Measure**
- Lighthouse CI budgets on Event Hub, Plan Dashboard, Downtime Analysis: performance ≥ 85, LCP < 2.5 s (LAN profile); `web-vitals` reported to metrics in production.

## Code quality (summarised in CLAUDE.md; enforced by lint/CI)
- Files ≤ 400 lines (hard stop 500), functions ≤ 40 lines and ≤ 4 parameters, React components ≤ 150 lines, nesting ≤ 3 with early returns — unless splitting makes the code harder to follow. `eslint` `max-lines`, `max-lines-per-function`, `max-params`, `max-depth`, `complexity` rules check this in the frontend `eslint.config.js` (400 lines; 40 per function, 150 in `.tsx` for components; 4 parameters; depth 3; complexity 10) as **warnings**, because about 1,250 pre-existing warnings would otherwise break CI. `npm run lint:changed` (`scripts/lint-changed.mjs`) lints only the files changed against the main branch (committed, staged, unstaged and untracked; `LINT_BASE` overrides the base), each with its own project config (frontend at the root, backend in `server/pro-act-backend`); it fails on errors and prints the size warnings of the touched files so they can be split while there. The full `npm run lint` stays non-blocking for these rules.
- TypeScript strict; no `any` (use `unknown` + narrowing); named exports; no commented-out code, unused imports or stray `console.log` (`no-console` except logger).
- Layering: controller → service → repository; DTO validation at the boundary; standard error envelope; config only via env.
- Tests accompany logic: fixtures for mathematics, integration tests with real Postgres for queries, e2e for journeys.

## How these are verified
| Rule | Check | Where |
|---|---|---|
| Indexes / plans | migration review + `EXPLAIN` in PR | every migration PR; 3.11 |
| N+1 | query-count assertion in integration tests | 0.3 harness; each list endpoint |
| Pagination | OpenAPI lint: every list route has `cursor`/`limit` | 0.4 contract CI |
| Cache TTL + invalidation | cache module requires both at registration | 3.11 |
| 202 for slow work | contract test on job routes | 1.4, 1.5, 2.9 |
| Timeouts/retries | adapter contract tests | 1.6, 1.8, 1.9 |
| Bundle budget | `size-limit`/visualizer in CI | 3.1 |
| Lazy routes | static check: `pages/*` imported via `React.lazy` | 3.1 |
| Virtualization | code review checklist for lists > 100 rows | 3.x |
| Size/style rules | eslint size rules warn; `npm run lint:changed` fails on errors in touched files | 0.3 |
| Load targets | k6 + Lighthouse CI | 3.11 |
