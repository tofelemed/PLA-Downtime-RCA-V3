# Security, tenant isolation and performance — evidence (plan 3.11, 10 Oct 2026)

Scope: plan [3.11](../phase-3/3.11-security-isolation-and-performance.md) under D15 (Docker Compose + local JWT; OIDC dropped). Decisions: [DECISIONS.md](../DECISIONS.md) §D rows "3.11 …". Test runs and counts: "Plan 3.11 verification" in [phase0-verification.md](phase0-verification.md).

## 1. T14 tenant-attack matrix

Tenant B identity (or a unit-limited / read-only identity) against tenant A data. All rows are automated integration tests on `proact_test`.

| Attack surface | Expected | Test(s) |
|---|---|---|
| Path ids (v2 GET / PATCH / commands of A's rows) | 404, no existence leak | `tenancy.int-spec.ts` (T14 tenant attack), `code-libraries`, `plans-scope`, `periods-scope`, `reconciliation-scope`, `rca-cases` |
| List filters (`unitIds` of A, `tenantId` query) | empty / 422 `INVALID_REFERENCE`; `tenantId` query 400 | `tenancy`, `kpi-reports-scope`, `accounting-scope`, `feature-flags` |
| Joins (period → events of A, body ids of A) | 422 / 404 | `periods-scope`, `reconciliation-scope`, `accounting-scope` |
| Replay / jobs on A's connection | 404 / 403; a job keeps the requester's scope | `intake-replay`, `intake-api`, `accounting-scope`, `reconciliation-scope` |
| Export of A's report / download | 422 / 404; download re-authorized | `exports-scope` |
| `X-Tenant-Id` of A | 403 `TENANT_NOT_ALLOWED`, audited | `tenancy` |
| Socket rooms (`/realtime`) | foreign credentials refused; messages only to own tenant / unit | `realtime-scope` |
| **Socket rooms (v1 `/socket.io`)** — new | anonymous / refresh-token / foreign-tenant handshakes refused; broadcasts only to the entity's tenant / unit rooms; no client room join | `legacy-realtime-scope.int-spec.ts` (3) |
| **`app_settings`** — new | other users' / tenants' keys invisible (empty) and 403 on write; global keys SuperAdmin-only | `app-settings-scope.int-spec.ts` (3) |
| **Deliberately unscoped repository call / v1 route without tenant filter** — new | 0 foreign rows with the RLS binding; foreign update affects 0 rows; control without binding shows the v1 leak | `tenant-rls.int-spec.ts` (5) |
| **Read-only role on every mutating route** — new | 403 for every POST / PUT / PATCH / DELETE except 9 reviewed routes | `write-access-coverage.int-spec.ts` (3), `write-access.int-spec.ts` |
| **Token misuse** — new | refresh token as bearer 401; expired / foreign-issuer / untyped 401; replayed refresh revokes the family; downgrade → 403 next request | `auth-tokens.int-spec.ts` (6) |
| Cached endpoint warmed by A | n/a — the API has no server-side cache (Redis not built); client caches are cleared per tenant (3.1) | — |

**Known gaps (not closed in 3.11):** v1 REST controllers (e.g. `GET /api/production-events/:id`, the RCA analysis CRUD) do not filter by tenant themselves; the RLS binding closes them (proved in `tenant-rls.int-spec.ts`); it is **on** since the owner decision of 10 Oct (Q1). `/connectivity` connection / protocol rooms are authenticated but not tenant-checked (no frontend consumer). Upload downloads need a token and tenant membership (Q3); files stored before that at the `uploads/` root are not served any more (none on dev).

## 2. ASVS-lite checklist (OWASP ASVS 4.0 level 1 subset)

| Area | Status | Notes |
|---|---|---|
| V2 Authentication | ✅ partial | bcrypt passwords; 15-min access tokens; refresh rotation + reuse detection; login / refresh rate-limited (global throttler). No MFA / SSO (D15) |
| V3 Session management | ✅ | logout revokes the refresh family; deactivation / downgrade effective on the next request; sockets cut at token expiry |
| V4 Access control | ✅ / ⚠️ | global guard chain, route-guard and write-access enumerations, scope guards; v1 tenant filtering depends on RLS (off by default) |
| V5 Validation / encoding | ✅ | global `ValidationPipe` (whitelist + forbid), 1 MiB bodies, CSV injection-safe exports (2.9), upload type allowlist, uploads served `nosniff` + CSP sandbox |
| V6 Cryptography | ✅ | AES-256-GCM credentials with named keys and rotation; separate JWT signing keys (refresh key derived when not set — owner to set) |
| V7 Errors / logging | ✅ | no stack traces / SQL in responses; tokens, credentials, `enc:` values redacted in HTTP, error and slow-query logs; FK / RLS refusals 4xx |
| V8 Data protection | ✅ / ⚠️ | uploads per tenant, token-protected download (`GET /api/uploads/files/:tenantId/:name`, members only, others 404); virus scanning deferred by the owner |
| V9 Communications | ⚠️ host | TLS at nginx / host (not in this repo's dev setup); PI client verifies TLS by default |
| V10 Malicious code / dependencies | ⚠️ | **After the owner decision (Q4):** `npm audit fix` in both projects + `sqlite3` 6 + `node-opcua` `~2.170.1` (CommonJS line; `overrides.hexy`) → production audit backend **8** (1 critical `tar` / high `@mapbox/node-pre-gyp`: install-time chain of `sqlite3`; high `js-yaml`, `lodash` need `@nestjs/swagger` 12), frontend **4** (moderate, 0 high). **Before:** `npm audit --omit=dev` (10 Oct): backend 57 (3 critical: `jsrsasign`, `proxy-addr`, `tar`; 33 high incl. `typeorm` SQL-injection advisory, `multer`, `ws`, `socket.io-parser`, `axios`, `node-opcua`); frontend 13 (11 high: `react-router`, `postcss`, `lodash`, `socket.io-parser`, …). Several fixes need major versions — not changed here (no dependency changes without the owner) |
| V12 Files | ✅ / ⚠️ | 25 MiB, one file, random names, extension allowlist; scanning hook not built |
| V13 API | ✅ | idempotency, ETags, keyset pagination (earlier phases); egress allowlist for connectors |
| V14 Configuration | ⚠️ owner | secrets from env; `JWT_REFRESH_SECRET`, keyring, egress allowlist and `AUTH_ALLOW_PUBLIC_REGISTRATION=false` must be set per environment |

## 3. Performance

**Method.** `scripts/perf/event-load.ts` (no dependency): 200 open events created on one unit, each read (ETag), closed with `If-Match`, then 400 first-page list reads, all with 20 parallel callers; server = the built API on :4014 against `proact_perf` (a fresh `pg_dump` copy of dev `proact` per run), throttle raised. Host: Windows 11 dev box, Postgres 15 in Docker Desktop, shared with the owner's running API and other containers — numbers are indicative, not a staging measurement.

| Run (20 callers) | create p50 / p95 ms | get p95 ms | **close p50 / p95 / max ms** | list p95 ms |
|---|---|---|---|---|
| before 3.11, `PROCESS_ROLE=all`, run A | 883 / 2330 | 361 | 954 / **11 156** / 11 318 | 2138 |
| before, all, r1 | 674 / 1723 | 193 | 567 / **6 843** / 7 173 | 1060 |
| before, all, r2 | 467 / 760 | 216 | 381 / 508 / 582 | 614 |
| before, api, r1 | 380 / 737 | 102 | 390 / 550 / 667 | 449 |
| before, api, r2 | 489 / 897 | 150 | 636 / 1 093 / 1 631 | 374 |
| after, all, r1 | 717 / 1172 | 216 | 505 / 841 / 904 | 480 |
| after, all, r2 | 1052 / 2145 | 192 | 485 / 661 / 719 | 628 |
| after, api, r1 | 403 / 892 | 160 | 437 / 538 / 617 | 382 |
| after, api, r2 | 498 / 998 | 181 | 405 / 687 / 914 | 430 |

Single caller (before 3.11, all): close p50 56 ms / p95 113 ms, get 16 / 29 ms, list 8 / 13 ms.

**Close latency findings.** Every statement of a close is 0.05–2 ms (log of one close: lock the event, update, coding / revision / outbox inserts, commit 1.5–6 ms). The multi-second stalls came from (a) `ExclusiveLock on extension of relation` waits > 1 s on `production_events` / `event_revisions` inserts and COMMITs up to 7.5 s — storage latency of the Docker Desktop volume — and (b) the in-process worker (role `all`: KPI / period recomputes triggered by each change share the event loop and the pool). No run with `PROCESS_ROLE=api` stalled. No query-shape or index fix applies to the close path; Compose already runs API and worker separately. 3.11 adds no measurable cost per request (one extra `users` primary-key read for the current role).

**EXPLAIN review.**

| Query | Before | After |
|---|---|---|
| v2 event list, one unit, first page | index scan `IDX_production_events_tenant_unit_start`, 16 ms cold | unchanged |
| v2 / v1 event list, whole tenant, first page (`ORDER BY start_time DESC, id DESC LIMIT 101`), 50 000 events | parallel seq scan + top-N sort, **158 ms** | backward index scan on new `IDX_production_events_tenant_start (tenant_id, start_time, id)`, **1.2 ms** |
| close path (event by id FOR UPDATE, `MAX(revision)` by `event_id`, review items by event) | PK / `UQ_event_revisions_event_revision` / `IDX_event_review_items_event`, < 0.5 ms | unchanged |

**Targets.** Event first page p95 < 2 s: met in every run (≤ 2.1 s only in the stalled run A, ≤ 0.63 s otherwise). Simple scoped reads p95 < 200 ms: met for a single caller (16–29 ms); at 20 parallel callers on this host get-by-id p95 is 100–216 ms (CPU-bound event loop). T40 (1000 obs/s, burst, worker kill, replicas) not run — needs staging.

**N+1 guard.** `query-budget.int-spec.ts`: v2 event list, v1 event list and v2 units list run the same number of statements with 6 and 36 events and stay ≤ 12.

**Database runtime.** Pool 10 per process, `statement_timeout` 30 s, connect timeout 10 s, slow-query warning > 500 ms (redacted SQL, no parameters).

## 4. Operations

- **RLS:** on by default for the API (owner decision); `DB_RLS_TENANT_BINDING=false` turns it off for diagnosis. Login role `postgres` needs nothing; another login role needs `GRANT proact_rls_user TO <role>`. Check: as a non-SuperAdmin of tenant B, `GET /api/production-events/<id of A>` returns an empty body.
- **Credential rotation:** add the new key to `CREDENTIAL_ENCRYPTION_KEYS`, set `CREDENTIAL_ENCRYPTION_KEY_ID`, restart, `npx ts-node scripts/security/rotate-credentials.ts` (dry run), then `--apply --confirm-database <db>`, restart, remove the old key.
- **Load script:** `npx ts-node scripts/perf/event-load.ts --base <api> --email … --password … --unit <id> [--events 200 --concurrency 20 --reads 400]` against a disposable copy (it writes events).
