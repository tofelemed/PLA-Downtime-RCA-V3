# Test baseline — 7 Oct 2026 (Phase 0.1 step 4)

Run on the working tree over commit `044cc83` (baseline commit pending). Node v24.11.1, npm 11.6.2.

## Backend — Jest (`server/pro-act-backend`, `npx jest --ci`)
| Suites | Tests | Result | Time |
|---|---|---|---|
| 1 (`src/app.controller.spec.ts`) | 1 | **pass** | 120 s (ts-jest cold compile) |

Only the default Nest stub spec exists under `src/`. The other `*.spec.ts` / e2e files live under `test/` and are not matched by the Jest `rootDir: src` config. No domain logic is unit-tested.

## Frontend — Vitest (`npx vitest run`)
| File | Tests | Result | Cause |
|---|---|---|---|
| `src/services/StorageService.test.ts` | — | **fail to load** | IndexedDB not available in jsdom (legacy store; slated for removal, plan 3.1) |
| `src/components/historian/MultiAttributeSelector.test.tsx` | 10 | 9 pass, **1 fail** (`shows loading state while fetching data`) | timing-dependent assertion; component logs "Failed to load asset servers" from mocked PI client |
| `src/test/integration/master-data.integration.test.ts` | 5 | **5 fail** | hits the live backend `http://localhost:4004/api/organizations` without a token → backend returns **500 "No auth token"** (should be 401; plan 0.4). The test setup never logs in |

Totals: 3 files, 16 tests, 10 pass, 6 fail.

Observation: the integration test reached a running backend on `:4004` during this run (responses timestamped 2026-10-07T21:49Z), i.e. a backend was up at that moment. These "unit" tests depend on live services and belong in the integration layer (plan 0.3 Jest/Vitest project split).

## End-to-end — Playwright (`npm run test:e2e`)
Not run in this baseline pass (requires both servers in a known state; the Compose stack or dev servers). To be recorded before 0.1 is marked ✅. Known from code reading: 11 specs; `auth.spec.ts` expects `test@example.com` which now exists via `db:seed-demo-users`.

## Actions recorded for the plan
- 0.3: split test projects (unit / integration / fixtures / e2e); integration harness with real Postgres and an authenticated test user; move `master-data.integration.test.ts` there.
- 0.4: `JwtAuthGuard` must throw `UnauthorizedException` (401) instead of a plain `Error` (500).
- 3.1: delete `StorageService` and its test.
