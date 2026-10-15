# HDPE scoped authorization review

This review distinguishes permission to read a unit from permission to perform a particular action there. A tenant-wide viewer or accountant grant must not expand a different role held only on one unit. Legacy home-tenant roles retain their documented D06 mapping; mixed-role negative fixtures use legacy `Operator` so they do not accidentally receive legitimate manager authority.

## Confirmed defects and repairs

| Area | Actions covered by the repair | Evidence |
|---|---|---|
| Measurement uncertainty | Propose a budget, approve/reject a budget, adopt a tolerance | `metrology-scope-before.json` reproduced three negative cases as HTTP 200. `scope-boundaries-after.json` passes all six uncertainty tests, including same-unit controls. |
| Accounting workflow | Save/submit draft lines; cancel/recompute; approve/reject; bridge review; revise; propose/accept/dismiss a correction; decide restatement posting | `scope-boundaries-reproduction.json` demonstrated cross-unit approve/reject. The final expanded accounting/source-authority suite passes 18 tests in `scope-affected-integration-final.json`; refusal cases cover the listed accounting mutations, a local manager borrowing another unit's accountant capability for a bridge, and valid same-unit approval. |
| Source authority | Draft and approve/reject unit versions; draft/approve plant-wide versions | `scope-boundaries-reproduction.json` demonstrated seven accounting/source-authority negative failures in total, including five source-authority cases. The repaired suite verifies unit and plant role boundaries and valid same-unit approval. |
| Selected-tenant legacy authority | Do not reconstruct a home-tenant legacy role in a selected foreign tenant | Parent-owned factory regressions: three negative cases failed before the fix; four focused suites / 22 tests passed afterward. See `context-provenance-before` and `context-provenance-after` artifacts. |
| Quality disposition and month close | Propose/approve/reject lot dispositions; close quantities, review materiality, finance sign-off, lock and reopen a month | Audit-owned `quality-close-scope-before.json` reproduced nine negative failures with two valid controls. `quality-close-scope-after.json` passes all 11 new scope cases plus 16 existing workflow tests: **3 suites / 27 tests**, zero skips, 69.965 seconds. |

The live browser reproduced the metrology defect before deployment: Sara held a unit200 metrology delegation and approved a unit100 budget with HTTP 200. The exact token-free response is in `test-results/hdpe-audit/metrology-unit-boundary-response.json`. The test's cleanup revoked the delegation. Campaign 4 verified the repaired deployed image: the unit200 delegation received HTTP 403 for unit100, while valid same-unit approval, self-approval refusal and revocation checks passed. All three operational-governance browser cases passed.

Shared `requireUnitRole` / `hasUnitRole` resolve the affected unit inside the acting tenant and use its unit, site, tenant, or applicable legacy grants for the specific role. `requireTenantRole` requires the relevant role at plant scope. Existing visibility errors and separation-of-duties checks remain in place. Optional bridge capability keeps its domain refusal instead of borrowing an accountant role from another unit.

## Additional actuals coverage

`actuals-role-scope.int-spec.ts` covers adjustment proposal and decisions, the recompute service boundary, named/all-unit materialization, JSON/CSV external report imports, source-status mapping authorship/approval, and valid controls. The valid-fixture reproduction (`actuals-scope-before-valid.json`) produced **11 negative failures and 3 positive passes**: unauthorized adjustment proposals/decisions, period creation, report import/enqueue, and source-status changes succeeded. The whole-plant materialization created six periods. The earlier `actuals-scope-before.json` additionally preserves a test-fixture error (an invalid adjustment basis enum); it is not the authoritative adjustment reproduction.

The repaired actuals suite passes **14/14** in `scope-repair-final.json`. Actuals adjustments now require the appropriate role on the period unit; recompute checks its own service boundary and records only the affected unit in the job. Materialization checks every named unit in one batch, or requires a plant-wide writer role for an omitted unit list. Interactive JSON and queued CSV report imports require a plant-wide importer role in the service. Source-status drafts and approvals require the appropriate plant-wide author/owner role. Existing trusted ingestion and worker entry points continue to use their established importer identity.

## Verification boundaries

The figures below describe the authorization repair campaign. Later quantity-unit
and seed-tooling work brings the final whole-application totals to **220 suites /
2,540 backend unit/fixture tests** and **172 suites / 978 integration tests** using
the latest result per integration suite. See [HDPE_E2E_REPORT.md](HDPE_E2E_REPORT.md)
for the final manifests and rerun provenance; these are not additional test totals.

- `scope-affected-integration-final.json/.log` records the final compatibility campaign: **18 suites / 115 tests passed**, zero failures or skips, 441.502 seconds. It covers the expanded accounting scope regression plus existing reconciliation, actuals, source-authority, restatement/source-status, delegation, bridge-limit, and tenant-RLS suites.
- Combined with the successful quality/month-close campaign and the successful actuals/uncertainty scope suites, the latest post-fix evidence is **23 distinct suites / 162 tests passed**. The four new scope suites contain 49 tests in total.
- `scope-repair-lint.log` and `scope-repair-typecheck.log` passed for the first repair set. They predate the additional actuals repair.
- The full backend unit and math-fixture run after the service repairs passed **217 suites / 2,510 tests**: 188 unit suites / 2,092 tests plus 29 fixture suites / 418 tests. Raw evidence is `backend-unit-fixtures-scope-final.json/.log`, with `backend-unit-fixtures-scope-final-summary.json`. Fixtures are included in the combined total. Latest typecheck and lint evidence is `scope-final-typecheck.log` and `actuals-scope-repair-lint-final.log`.
- `scope-repair-final.json` includes one failed accounting-suite setup caused by a lost PostgreSQL connection during migration; all 14 actuals and 6 uncertainty cases passed. The orphaned test transaction and bounded recovery are recorded in `scope-integration-disconnect.md`. This infrastructure failure remains preserved; the affected integration campaign is separate evidence.
- `integration-scope-effective-summary.json` combines the earlier 167-suite / 924-test baseline with the post-fix affected regressions and four new suites: **171 suites / 973 tests passed**, zero failures or skips in the latest result for each suite. Every suite retains its source artifact and `postFix` flag. This is a baseline plus focused reruns, not a fresh full integration run after these authorization changes; 23 suites / 162 tests were explicitly verified after the repairs.
- This is not proof that every `@Roles` route or every possible role/grant combination is correct. Plans, profiles, calendars, unit-impact rules, intake/replay, reliability workflows, and other manager-enabled siblings were identified as separate review surfaces; a role name appearing there is not itself a reproduced defect.
- New security regression tests run only against `proact_hdpe_test`. The integration harness checks the test database name and resets its connected database schema; there is no `pg_terminate_backend` call in the test harness.

Raw JSON and logs named above are under `test-results/hdpe-audit/` unless a full path is shown. They preserve failures as well as later passes.
