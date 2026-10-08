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

## End-to-end — Playwright (`npx playwright test --timeout=20000 --global-timeout=2400000 --reporter=line`)
Run against the live dev servers (Vite :8070, compiled backend :4004) on 7 Oct 2026 while five build/test agents were saturating the CPU.

| Result | Count |
|---|---|
| passed | **22** |
| skipped | 3 |
| did not run | 18 (40-minute global timeout reached) |
| failed | the remainder of the 43 attempted; see causes |

Failure causes (from the line reporter): `page.goto: Test timeout of 20000ms exceeded` ×6 (Vite dev-server first-load compile under load), `page.goto: Test ended / Target page closed / ERR_ABORTED` ×4 (cascades of the above), `TypeError: Cannot read properties of undefined (reading 'cleanup')` ×2 and `Cannot destructure property 'tokens' of 'fixture'` ×1 (`e2e/test-utils` fixture setup assumes a successful API login that returned 500 "No auth token"-style errors or timed out).

A first attempt with Playwright's default 30 s test timeout was stopped after 30 minutes with `auth`, `event-pull-and-rca` and `master-data` failures already on disk (`test-results/`).

**Reading:** the suite is not a reliable gate on this machine in its current form — it depends on live servers, slow first loads and a fixture that does not handle auth failures. Plan 0.3 moves it to CI against the Compose stack with a warmed frontend build (`vite preview`/nginx image), `continue-on-error` until stabilised; plan 0.4 fixes the 500→401 that confuses the fixtures.

## Lint — ESLint
| Project | Result |
|---|---|
| Frontend (`npm run lint`, `eslint .`) | **2,506 problems (2,422 errors, 84 warnings)**, exit 1 — mostly `@typescript-eslint/no-explicit-any`, unused vars, hooks rules in the large page files |
| Backend (`npm run lint`, type-checked config) | did not finish in 18 min on the saturated host; to be recorded |

CI's `lint` job is therefore `continue-on-error: true` until a policy is chosen: (a) fix the baseline in the 3.x screen rewrites and ratchet with a max-warnings budget per directory, or (b) gate only new/changed files (`eslint` on `git diff --name-only`). Recommendation: (b) now, (a) as screens migrate.

## Actions recorded for the plan
- 0.3: split test projects (unit / integration / fixtures / e2e); integration harness with real Postgres and an authenticated test user; move `master-data.integration.test.ts` there.
- 0.4: `JwtAuthGuard` must throw `UnauthorizedException` (401) instead of a plain `Error` (500).
- 3.1: delete `StorageService` and its test.
