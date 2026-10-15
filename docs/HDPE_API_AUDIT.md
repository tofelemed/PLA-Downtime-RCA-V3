# HDPE API, query and seed audit

Reviewed on 15 October 2026. This report interprets the saved automated audit
and reviews its findings against the request builders, controllers, DTOs and
services. It is a companion to the final end-to-end report, not a claim that
every possible request, permission combination or filter combination passed.

The final requested topology is one organization named **HDPE**, one HDPE plant,
and two units: **unit100 / Extruder1** and **unit200 / Extruder2**. The automated
API run below predates the final removal of the other organizations and test
fixtures. Its tenant-visibility result must be read in that earlier context.

## Evidence and measured scope

Raw evidence is local and ignored by Git under `test-results/hdpe-audit/`:

| Evidence | What it establishes |
|---|---|
| `api-static.json`, `api-static.md` | TypeScript frontend call inventory matched against registered backend controllers and DTOs |
| `api-live.json`, `api-live.md` | Live read and validation-probe results at `2026-10-15T17:29:45.316Z` |
| `database-audit-initial.log` | Initial referential checks and four representative `EXPLAIN (ANALYZE, BUFFERS)` queries |
| `e2e/summary.json` and per-spec reports | First browser pass; use subsequent retest reports and the final report for resolved outcomes |
| `integration-full.json`, `integration-full.log` | Full backend integration run; use final retest evidence for failures subsequently corrected |

The saved live run reports the following. Counts are those of the audit tool,
with its limitations made explicit:

| Check | Observed result | Interpretation |
|---|---|---|
| Frontend call sites | 403: 5 v1 and 398 v2 | Static call sites, not 403 independent workflows |
| Registered backend routes | 509 | Includes legacy and API-only routes |
| Matched distinct routes | 344 | Approximate where a helper selects its path or body generically |
| Unmatched-by-frontend routes | 165 | Informational; dynamic notification and RCA paths prove this is not an exact unused-route inventory |
| Live GETs | 139 HTTP 200; one HTTP 404 | The 404 was a plant outside the chosen persona's visible memberships |
| Mutation probes | 178 validation/not-found responses; one HTTP 200 | The 200 was the documented stop-validation result with a skipped reason |
| Absent-ID GETs | 63 HTTP 404; two HTTP 422 | The two remaining requests failed input validation before lookup; neither returned an empty 2xx |
| Skipped live targets | 25 | 19 deliberately not sent or without a resolvable key, and 6 still requiring valid input |
| Create/read-back audit flows | Not run | This invocation used `--skip-creates`; browser and integration results supply separate workflow evidence |
| GETs slower than 1,000 ms | 0 in this run | One local sample per selected request; not a load or percentile benchmark |

The generated Markdown originally said the two non-404 absent-ID GETs returned
empty 2xx bodies. That is a report-writer wording error. The authoritative JSON
contains `422 VALIDATION_FAILED` for both:

- `GET /api/v2/connections/{id}/sample`: missing `scopeType`, `scopeId`, `from`
  and `to`.
- `GET /api/v2/production-days/{unitId}/{localDate}`: the synthetic path value
  `api-audit-absent` is not a `YYYY-MM-DD` date.

## Triage of all 13 generated flags

None of these 13 flags establishes a defect in the current frontend request
path. Eleven arise from generic or conditional request builders; the other two
match documented API behavior. This finding does **not** certify all APIs as
correct, and does not replace the live workflow tests.

| # | Generated flag | Source evidence and disposition |
|---|---|---|
| 1 | Notification helper allegedly omits production-event `startTime` and `unitId` | `src/api/v2/queries/notifications.ts` invokes the helper only for `/notifications/{id}/read` and `/notifications/read-all`, with `{}`. The analyzer's `/api/v2/{input}` match to production-event creation is incorrect. |
| 2 | Micro-stop policy allegedly omits `microStopSeconds` | `reliability-policies.ts` instantiates `usePolicyCommand<MicroStopPolicyBody, ...>`. The body aliases the generated `MicroStopPolicyCreateDto`, which requires the field. `features/master-data/reliability/policy/micro-stop-form-model.ts` supplies it explicitly. |
| 3 | Plan return allegedly omits `reason` | `use-plan-review.ts` instantiates `ReturnPlanInput`, which extends the submit input with `reason`. `approve-plan-version.tsx` sends the trimmed reason, and the rest destructuring removes only `planId`. |
| 4 | Transition-allowance policy allegedly omits `transitionAllowanceInPlan` | The specialized body aliases `TransitionAllowanceCreateDto`. `transition-allowance-control.tsx` explicitly submits `transitionAllowanceInPlan: choice`. |
| 5 | Quantity-close body allegedly includes `reason` | `month-close.ts` sends `{ comment }` or `{}` for non-reopen steps, matching `MonthCloseStepDto`. The analyzer merges the reopen branch into this path. |
| 6 | Finance-sign-off body allegedly includes `reason` | Same conditional request builder and DTO as #5. |
| 7 | Month-lock body allegedly includes `reason` | Same conditional request builder and DTO as #5. |
| 8 | Materiality-review body allegedly includes `reason` | Same conditional request builder and DTO as #5. |
| 9 | Month-reopen body allegedly includes `comment` | For `step === 'reopen'`, the builder sends only `{ reason }`, matching `MonthCloseReopenDto`. |
| 10 | Cancel revision allegedly includes `failedLines` | `period-workflow.ts` destructures `failedLines` out and adds it back only when `action === 'reject'` and the array is nonempty. Cancel matches `ReasonedRevisionDto`; reject matches `RejectRevisionDto`. |
| 11 | Every RCA tool body allegedly goes to Five Why | `rca-commands.ts` maps six tools to six endpoints using `TOOL_PATHS[input.tool]`; `RcaAnalysisBodies[K]` selects the corresponding body. The analyzer merges all tool bodies and matches them against Five Why alone. |
| 12 | `GET /tenants/{id}` returned 404 as Charlotte | The audit resolver chose Demo Plant 2 while the request used Charlotte's HDPE membership. `PlantsV2Controller.get` documents “One plant you may see (404 otherwise)”; `HierarchyV2Service.getPlant` applies `visiblePlants` before lookup. The refusal is expected scope isolation. |
| 13 | Missing stop ID returned 200 from `validate-failure` | `StopVerificationV2Controller.validate` documents skipped outcomes including `NOT_FOUND`. `StopVerificationService` returns `{ done, skipped, at }`, adding the missing event to `skipped`. This is the declared result contract, not silent successful validation. |

Sending an extra-field-only body and observing its rejection confirms that the
server forbids that field. It does not prove the actual UI sends that body. The
conditional request builders above are necessary to interpret those probes.

The separate real session-loading defect was an attempted nonexistent
`GET /v2/organizations/{id}`. The current
`src/features/auth/read-session-organization.ts` reads the paginated organization
directory, finds the session organization, and rejects a repeated pagination
cursor or an inaccessible organization. It is used by `AuthContext.tsx` and has
dedicated regression tests. It is not one of the 13 flags in the saved live run.

## Query, filter and permission coverage limits

`SmokeRunner.read` first makes a GET without filters, then retries a validation
failure using default values for known query fields. It picks one persona
allowed by the route's declared roles. Therefore HTTP 200 here proves basic
reachability with those parameters; it does not validate every filter's
semantics, pagination boundaries, every user's visibility, or the numerical
correctness of returned calculations.

The saved run used bounded date filters for downtime, OEE, reliability, scope
waterfall, loss-tree, reconciliation-trend, reconciliation-status, actuals-quality,
loss-value, activity-summary, standby metrics and event exports. Other explicit
query examples include event selection (`from`, `to`, `unitIds`), a period
waterfall (`periodIds`), state coverage (`unitId`, `from`, `to`), repair evidence
and similar RCA knowledge (`eventId`). These are one chosen request per route.

Deeper filter and workflow assertions belong to the dedicated suites, including:

- `e2e/downtime-analysis-an01.spec.ts`: shared widget filters and calculation-run
  provenance, drill-through, URL persistence, tablet and keyboard interaction.
- `e2e/plans-profiles-calendars-plan03.spec.ts`: DST preview, frozen published
  versions, overlapping rates, permission refusals and plan redistribution.
- `e2e/personas/admin-04-settings-audit.spec.ts`: branding, application-wide
  settings permissions and audit visibility.
- `e2e/finance-valuation.spec.ts`: finance roles, independent approval and
  overlapping FX windows.
- Persona suites and backend integration tests: cross-scope refusal,
  maker/checker, revision concurrency, ingestion mapping, reconciliation and
  specific settings behavior.

The final end-to-end report must give the actual pass/fail/skip results for these
suites. Merely locating a test is not execution evidence.

The audit skipped these target groups: logout/token validation, rate-import
detail, user lookup, custom-attribute definitions/values, failure-dictionary
import, branding deletion, PI sample retrieval, replay/backfill/job details,
source-authority creation, bulk stop verification, production-day detail,
restatement detail, month-close detail and its four write steps, downtime-bundle
and bad-actors reports. The complete 25-route list and reasons remain in
`api-live.md`. Other suites can cover these paths, but this audit did not.

The generated “no `@Roles()`” list also needs service-level interpretation.
For example, plant display settings document and enforce permissions beyond the
controller decorator. Absence of that decorator alone does not prove that every
authenticated user can perform the operation. Role-denial tests are the evidence.

## Database query observations

The initial SQL audit reported zero cross-tenant event/unit links, zero
cross-tenant period/unit links, zero unvalidated database constraints, zero
self-approved published shifts and zero overlapping production periods. These
checks describe the initial local dataset, not the final cleaned snapshot.

| Representative query | Initial execution time | Observed plan |
|---|---:|---|
| Event Hub unit plus seven-day window, 50 rows | 0.688 ms | Sequential scan and top-N sort over a small dataset |
| Period grid plus latest revision, 50 rows | 0.372 ms | `UQ_production_periods_unit_start` and `UQ_accounting_revisions_period_revision` indexes |
| Published loss ledger aggregation | 9.985 ms | Join and aggregate |
| One signal's last-day samples | 0.217 ms | Single telemetry partition |

These are representative SQL shapes in `scripts/hdpe-db-audit.sql`, not captured
SQL for every API. A fast sequential scan on about a thousand events cannot
establish production-scale indexing or concurrency performance.

The first audit exposed missing unit capacity/UOM values. The seeder was updated
to populate those fields for existing units as well as new units; final read-back
must show 32 t/h and 28 t/h. Its first balance query also incorrectly treated
overaccounted candidate values as an extra subtraction. The revised SQL reads
immutable approved snapshots and checks
`gap - attributed - toleranceAdjustment - residual = 0`, plus zero published
residual. Use the final rerun for acceptance; the initial “3 inconsistent slices”
is not evidence of three corrupt approved ledgers.

## Synthetic HDPE seed review

The scenario models two independent HDPE finishing trains, with extrusion,
pelletizing, drying and packing. It is an industry-informed application test
dataset. It does not reproduce a particular site's polymerization process,
vendor-certified capacity, calibration, laboratory release, operating history
or live financial inputs.

The unit reference capacities are 32 t/h and 28 t/h. Grade profiles apply a
deterministic factor to those references, then set planning to 92% of each
grade's sustained rate, rounded to 0.1 t/h. For `hdpe-petrochemical-2026`, unit100
has sustained/planning pairs 28.8/26.5 (PE100), 31.4/28.9 (F7000) and 30.2/27.8
(BL3), all in t/h; unit200 has 28.0/25.8 (F7000), 27.5/25.3 (IM55) and 25.6/23.6
(BL3). The fixed unit capacities are not the grade planning rates. The four illustrative
products cover pipe, film, blow-molding and injection applications. Their MFR
values include test temperature/load; they must not be compared without those
conditions. The pipe description explicitly disclaims product certification.
Source references and the distinction between examples and guarantees are in
`plans/HDPE_E2E_VALIDATION.md`.

The MQTT seed sends 126 timestamps on three signals: 378 numeric/digital samples.
The unit100 counter increases by 0.48 t per operating minute, corresponding to
28.8 t/h, and pauses for a 20-minute stop. Its matching event's 9.6 t loss is
`28.8 × 20 / 60`. The unit200 rate snapshot uses 28 t/h for 30 minutes, 21 t/h for
30, zero for 20 and 28 t/h for 45, giving **45.5 t** over 125 minutes with step
interpolation. The seed checks the API preview for that integral. It is a
completed morning snapshot, not a continuous live source; stale coverage later
in the day is expected. `isAuthority: false` keeps this example rate signal from
silently replacing authoritative production-output records.

The uncertainty example uses independent standard uncertainties 0.3 t and 0.4 t,
so combined standard uncertainty is 0.5 t and expanded uncertainty at `k = 2` is
1.0 t. Certificate references, evidence notes and adjustment records are marked
Demo/synthetic. The proposed off-grade reprocessing route remains a draft so it
does not turn independent finishing trains into a serial production system.

The seed orders RCA links and stop verification before historical accounting
approval. Month closing precedes the late-evidence change proposal. This keeps
the late correction visible without silently rewriting a locked month's figures.
Source-authority approval is effective at the approval instant by API contract;
the newly approved hierarchy must not be described as having governed all past
shift calculations.

Final acceptance must inspect actual records, not only seed exit status. Review
found that the earlier accounting seed tolerated up to 2% pending calculations,
and accounting/certification errors could be logged while the seed continued.
The current implementation requires all eligible calculations, throws for
failed accounting jobs and propagates certification failures. The locked-proposal
step also enforces the previous-month lock. Final read-back must still verify
expected approvals, correction drafts, source mappings, the telemetry integral,
and the absence of other organizations/children.

## Targeted role-scope regression findings

The broader persona review identified real authorization gaps beyond the generic
API analyzer's flags. A tenant-wide read/accounting grant was combined with a
unit-only quality or month-close role, and the original service checked broad
read access plus a union of roles rather than the scope of the acting role.

`test/integration/quality-close-role-scope.int-spec.ts` reproduced these against
the isolated `proact_hdpe_test` database. The before run had nine failed negative
assertions and two passing positive controls. Cross-unit quality creation,
approval and rejection succeeded incorrectly. Unit-only management/finance roles
could close quantities, sign off and lock a plant month. Materiality/reopen probes
reached state-machine refusals instead of the required permission refusal; those
responses alone do not establish a successful unauthorized state change.

The repair requires disposition writers/approvers on the disposition's unit and
the relevant month-close role at plant scope. The configured materiality reviewer
must also hold its role at plant scope. Existing separation-of-duties behavior,
404/422 unreadable-reference handling, `TENANT_SCOPE_REQUIRED` and policy-specific
`MATERIALITY_REVIEWER` contracts are retained.

Evidence: `quality-close-scope-before.json/.log` and
`quality-close-scope-after.json/.log` under `test-results/hdpe-audit/`. The after
campaign passed **three suites / 27 tests, zero skips**: all 11 new scope cases
plus the 16 existing quality/month-close tests. Targeted lint and full backend
TypeScript checks passed (`quality-close-scope-lint.log` and
`quality-close-scope-typecheck.log`). These are additional regressions, not 27 new
tests to add to a baseline that already includes the existing 16.

The accounting browser expansion separately passed seven cases in
`test-results/hdpe-audit/e2e-accounting-7/`: queue/drill-through, hold/release,
workflow/revision filters, independent approval, independent day certification
and revision reopening, available month navigation, correction refusal and viewer
restrictions. It does not claim successful UI month close/sign-off/lock or
after-close posting; see `HDPE_WORKFLOW_COVERAGE.md` for those remaining boundaries.

## Reproduction

From `server/pro-act-backend`, with the documented local stack and persona
accounts available:

```powershell
npm run api:audit -- --static-only --out ../../test-results/hdpe-audit/api-static-rerun.md --json ../../test-results/hdpe-audit/api-static-rerun.json
npm run api:audit -- --skip-creates --origin http://localhost:4004 --tenant 5f011848-1cb5-4b7c-b75a-8938b46260a9 --out ../../test-results/hdpe-audit/api-live-rerun.md --json ../../test-results/hdpe-audit/api-live-rerun.json
```

Preserve the original reports and give reruns different names. The probe runner
deliberately avoids successful business mutations, but requests can create
access/audit records. After final seeding, run the read-only SQL in
`scripts/hdpe-db-audit.sql` against `proact`; run integration suites only against
the separate `_test` database. Do not infer a successful browser workflow from
an API's expected validation refusal.
