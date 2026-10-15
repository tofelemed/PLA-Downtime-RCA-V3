# HDPE application validation

**HDPE seeding and local validation are complete. Final data, route and visual checks passed.**
The application contains the requested single HDPE organization and plant.
Known startup observations, dependency advisories and coverage limits remain
documented below; this is not a claim that every possible workflow is certified.

## Scope and application structure

The owner requested application/schema analysis, cleanup of accumulated demo data,
realistic synthetic HDPE data and end-to-end testing of all personas, workflows,
UI, API calls, queries, filters and settings. A later clarification requires one
organization named HDPE and removal of all other organizations and their children.

The application uses a React 18 frontend, NestJS 11 API/worker, TypeORM and
PostgreSQL 15, with MQTT/Kafka ingestion infrastructure. The frontend is served on
8070, API on 4004, worker on 4005. The active development database is `proact` in
`proact-postgres` on host port 5432; a second bundled PostgreSQL on 5433 is unrelated.

The original inventory had 162 public parent tables; the final migrated schema
has 183. The guarded final reset selects 176 operational tables and retains schema/migrations,
roles, known demo identities, organizations/plants and feature flags until the
single-plant pruning step. Operational domains include master data and calendars,
plans/profiles/rates, events and revision history, measured actuals, immutable
accounting approvals and loss ledgers, quality dispositions, finance/close,
reliability/RCA, integration provenance, tenant scopes and audit trails.

Tenant selection, unit scopes and role guards are checked on the server. Decimal
accounting and business calculations remain on the backend. UI tests check rendered
state and call the API for evidence; independent database integration tests use
`proact_hdpe_test`, never the showcase database.

## Dataset and recovery

The requested final topology is HDPE organization → HDPE plant → unit100/Extruder1
and unit200/Extruder2, with finishing-train equipment, four HDPE grades, 60 days of
history and future planning. Rates and measurements use industrial engineering
units. All named persona accounts are rehomed to HDPE; viewers remain read-only.

The core SQL acceptance passed with **1 organization, 1 plant, 2 units, 23 assets,
4 products, 52 named personas and 70 scope grants**. The dataset has 1,401 events,
408 production periods, 341 approved accounting revisions, six lot dispositions,
five RCA records and 378 measurement samples. All 341 published slices balance
with zero residual; no cross-tenant event/period joins, self-approved shifts,
overlapping periods or invalid database constraints were found. Financial month
1405-06 (23 August–22 September 2026) is locked; the current month remains open.

See [HDPE_DEMO_GUIDE.md](HDPE_DEMO_GUIDE.md) for assumptions, source references,
seed order, accounts and walkthroughs. This is synthetic test data, not a live
plant import or process/vendor certification.

Backups and evidence are retained locally under `test-results/hdpe-audit/`:

- `pre-reset-proact.dump`: original data before cleanup, 81,798,960 bytes.
- `hdpe-before-ui.dump`: audited seed before destructive browser fixtures,
  14,704,187 bytes.
- `post-ui-before-final.dump`: data after disposable browser fixtures and before
  final cleanup, 16,553,607 bytes; restore listing verified.
- `final-acceptance.log`: all three SQL audits and authenticated API read-backs passed.
- `hdpe-final-validated.dump`: final validated dataset, **21,052,197 bytes**;
  `pg_restore --list` successfully read the archive. This is archive validation,
  not a separate full restore of the final snapshot.
- `final-acceptance-post-routes.log`: closing acceptance repeated after the final
  route sweep; all three SQL audits and authenticated API read-backs passed.
- `final-stack-health.json`: frontend HTTP 200, API healthy, API/worker/frontend
  containers healthy and direct database host verified.
- `final-evidence-sha256.json`: sizes and SHA-256 hashes for the database archives,
  export backup, cleanup evidence and final test manifests.

The first final restore attempt used `pg_restore --clean` and hit an inherited
partition primary-key dependency. Its single transaction rolled back. Recovery
used the verified dump in one transaction that rebuilt `public`, then the guarded
reset and `--hdpe-only` persona bootstrap removed the temporary organizations.
Both restore logs and all four database backups remain available. See the guide for the
exact recovery sequence.

The original database can be recovered from its dump. The owner's existing
`CLAUDE.md`, `.claude/` worktrees and prior `.playwright-mcp/` artifacts are preserved.

## Confirmed defects and repair status

| Defect | Effect | Repair / verification |
|---|---|---|
| Sign-in requested a nonexistent organization-detail GET | Organization loading issued a 404 | Use the paginated organization directory; tests cover lookup, pagination and missing organization |
| Startup forced a dark CSS class while the active palette was light | Badges and text could have poor contrast | Removed forced dark class; expanded axe scans exercise main screens |
| A completed code-mapping save cleared a newer selection | A second mapping selection could disappear during async refresh | Clear only the submitted selection; two deferred-save regressions |
| Plant selector loading skeleton used an unsupported ARIA label | Accessibility error during loading/reconnect | Give the loading indicator a status role; focused regression |
| Reconciliation flags rendered a paragraph directly inside a definition list | Invalid accessibility structure on period detail | Render a Status term/definition pair; all 19 expanded axe scans passed |
| Mobile header could hide the selected plant beside other controls | Current plant context was hard to see | Prioritize the current breadcrumb on narrow screens; retain the full accessible label; six strengthened desktop/mobile checks passed in campaign 4, with direct screenshot inspection |
| Queries ran before saved plant selection finished restoring | Notifications and sites briefly queried the home plant instead of the acting plant | Gate tenant-scoped queries during restoration; focused query/cache/notification regressions passed |
| RLS connection binding lacked a PostgreSQL error listener during checkout | A connection drop could terminate the API process | Guard errors through pool handoff/release; four disconnect regressions and tenant-isolation integration checks |
| Unexpected identity-lookup failures were converted to 401 | A PostgreSQL outage could refresh and then clear a valid browser session | Return retryable 503 for unexpected strategy failures; keep real credential failures at 401; guard/filter/client regressions and OpenAPI documentation updated |
| A home-plant legacy role survived in selected-plant context metadata | A matching narrow grant could be promoted to broad legacy authority and lose delegation audit attribution | Clear inapplicable legacy authority in the request context; five new regression tests plus adjacent tenant/delegation tests passed |
| Broad read grants combined with narrow specialist roles | Metrology, accounting, source authority/status, actuals, quality and month-close actions succeeded outside the required role's scope | Shared role-on-unit/plant enforcement; 49 new scope regressions and affected compatibility checks passed; deployed metrology browser refusal and same-unit controls passed in campaign 4 |
| Ingested quantity lost its explicit engineering unit | MQTT supplied 9.6 t but the canonical event stored a number with no unit | Preserve the selected attribute's explicit unit through MQTT/PI mapping and source revisions; 38 focused unit and five new integration cases passed. Deployed public replay repaired the single HDPE event to 9.6 t; final ingestion acceptance passed |
| Reconciled dashboard used a four-column grid for one tile | OEE and its denominator were unnecessarily squeezed | Single-column layout for the reconciled policy; lint/typecheck and all six strengthened visual checks passed; direct screenshots confirm the tile fills the card |

The connection guard prevents the fatal unhandled event; it does not establish
why the local PostgreSQL connection dropped. API and worker were rebuilt, then
the interrupted browser checks were scheduled for rerun against healthy services.
Later inspection found an abandoned local inbox transaction temporarily blocking
worker retries; it cleared without terminating a database session. PostgreSQL and
the API had zero restarts and no OOM signal. The database was attached to the app
network and a direct authenticated query succeeded. The rebuilt API and worker now
use `DEV_DB_HOST=proact-postgres`, verified after deployment, to remove the host-port round trip. This is a network
mitigation to validate, not a proven explanation of the original drops.

The audit also corrected seed/test tooling: stale fixture expectations, selector
timing/persisted filters, per-day idempotency keys, complete financial-month history,
RCA-before-accounting order, correct MQTT rates, explicit seed failures and more
accurate API-audit status reporting. These are distinguished from product defects.
The final seed also exposed missing evidence fields in its inventory-bridge draft
and a delayed automatic event-change proposal whose quantities were unchanged.
The bridge now supplies its required silo-transfer reason. The close seeder fails
explicitly when blocked; its narrow review helper dismisses only complete,
automatic proposals with exactly equal before/after slices and ledgers and no
preview issues, through the manager API with recorded attribution. Sixteen helper
tests passed in a focused run and are also included in the final backend total below.
Independent acceptance then caught two additional seed-cleanup issues: the
legacy asset payload omitted its optional organization field on 22 equipment
records, and the reset retained historical `p-mgr-operator-*` browser identities.
The asset seeder now supplies and backfills the organization through the existing
API, refusing an existing foreign organization. The fixture cleanup is constrained
to the recognized test identities; the original failed acceptance logs are retained.
The cleanup removed exactly 20 fixture accounts after a reference scan of all 183
tables. The 52 named personas, four bootstrap accounts and 70 grants were preserved;
all other table counts and retained user-row hashes were unchanged. A restoration
script and cleanup receipt are retained. The active export volume was backed up
and verified before deleting 34 unreferenced historical CSVs (496,256 bytes),
preserving both completed HDPE exports. Active uploads are empty; isolated dormant
host test storage was not used by the application and was left untouched.
Both retained exports were then downloaded through the authorized API with HTTP
200; their file sizes and SHA-256 hashes match the job records and response headers
(`final-export-downloads.json`).

The first ingestion verifier divided each minute's rate contribution before
summing, producing a negligible repeating-decimal rounding remainder. It now sums
rate-seconds before dividing by 3,600 and retains exact equality to 45.5 t.
Its event key was also aligned with the documented MQTT identity contract,
`equipment:event_id`. These verifier corrections are separate from the actual
missing canonical quantity-unit defect found in the same acceptance run.
A PL/pgSQL record/SQL alias collision in the subscriber assertion was also
corrected without changing its health requirements. The final runner passed all
three SQL audits and both authenticated signal previews. The public replay
normalized exactly one retained source object, with zero failures or quarantines;
it used the original event identity and did not republish or duplicate telemetry.

## Validation results

| Layer | Evidence / result |
|---|---|
| Frontend unit baseline / repair pass | Baseline 141 files/805 tests; repair pass 144 files/811 tests passed. Final run: 812/813 passed in 145 files; one static hygiene check failed after 7.9 s, then its unchanged 3-test file passed in a focused rerun |
| Backend unit tests | Final 190 suites, 2,106 tests passed |
| Backend mathematics fixtures | 29 suites, 418 tests passed |
| New UI regressions | Organization/mapping 5 tests; loading status 1 test passed |
| New backend regressions | PostgreSQL connection errors 4 tests passed |
| Backend integration | Latest result per suite: **172/172 suites, 978/978 tests passed, zero skipped**. Scope repairs: 23 suites / 162 tests; quantity-unit repair: nine suites / 70 tests. All use `proact_hdpe_test` |
| Browser workflows | Latest complete result per spec: **65 specs / 372 passed**, zero failures/skips/not-run. This combines retained campaigns and affected reruns, not a fresh all-spec run after every repair |
| Final static route surface | All **62/62** discovered static production routes passed with traces/screenshots, API error checks and an automatic-write guard; dynamic detail routes are covered only by their applicable workflow specs |
| All named persona browser sessions | Final HDPE-only run: all 52 form logins, identity/role/plant checks passed; no failures or skips |
| Accessibility | All 19 main-screen axe scans passed in campaign 3 after the markup repair |
| Desktop/mobile visual checks | All six strengthened checks passed after the final layout repair, with direct screenshot inspection of readable plant context, populated metrics and tile width |
| Locked-month UI acceptance | Final HDPE-only case passed: sign-offs/proposal visible; direct revision returned 409 without changing approved history |
| Final data and ingestion | `scripts/hdpe-verify.ps1` passed: hierarchy/permissions, approved snapshots/balances, locked month, SQL integrity/query audit, exact MQTT samples/event/provenance/subscriber health and API quantities |

The backend first pass had 160 passing / 7 failing suites (899 passing / 25 failing
tests). Five failures required fixture/expectation corrections; two were connection
failures during setup. The seven-suite rerun passed five, and an explicit IPv4
rerun passed the final two. `integration-effective-summary.json` records each
suite's source report; the 924 passing tests are not claimed as a single clean run.
`integration-scope-effective-summary.json` supersedes that baseline with four new
scope suites (49 tests) and the affected post-fix reruns. It records each suite's
source report; the unchanged baseline remainder was not rerun after scope repairs.
`integration-uom-effective-summary.json` is the final manifest, adding the five
source-unit cases and nine affected suites / 70 passing tests. It preserves the
source reports and separate scope/unit-fix provenance. A historical backfill
snapshot expectation needed to exclude a field added after that migration;
the failed run and unchanged-migration whole-file 23/23 rerun are retained.
The final combined backend run after the quantity-unit repair passed **220 suites /
2,540 tests**, zero skips: 190 unit suites / 2,106 tests, 29 mathematics fixture
suites / 418 tests, and one seed-review fixture suite / 16 tests. The seed-review
tests are included in 2,540 and must not be added again.

The first browser pass is retained rather than overwritten. Some failures were
stale assumptions; repeated API connection drops interrupted others. A passing
validation refusal is not a completed create/approve workflow.

The first final route sweep passed 60/62 routes. Opening the rule editor invoked
the documented read-only `POST /api/v2/rules/validate`; the sweep's write guard
incorrectly blocked it. The exact endpoint was allowlisted after checking its
read-only controller and service implementation. The other failure was a sign-in
stall before the finance-policy form: login returned 200 in 144 ms and the
organization directory returned 200 in 13 ms, but the authenticated shell did not
appear within the unchanged 15-second limit. Its screenshot/video and bounded
server logs are retained; no trace was captured because tracing was configured
for retries and this campaign had none. The same route passed on the rerun,
but the cause of the intermittent stall remains unconfirmed.

The second full sweep passed 61/62 routes, including both earlier failures. A
Downtime reload then missed the five-second plant-label readiness assertion;
its teardown screenshot already showed the loaded HDPE selector. Three focused
traced repetitions passed with the unchanged five-second plant-label and
15-second sign-in limits. Captured organization reads took 11–35 ms and plant
reads 13–326 ms, all returning HTTP 200. Only navigation cancellations were
observed. Those diagnostic repetitions are separate from the full-spec aggregate
and do not establish the earlier failure's cause.

The final full traced route sweep then passed **62/62 in 2.4 minutes**, without
changing either timeout or product code. `e2e-hdpe-routes-traced-final` retains its
screenshots and traces. The final `browser-latest-results.json/.csv` aggregate
contains **65 specs / 372 passing tests**, zero failures/skips/not-run, using the
latest complete result for each spec. The three diagnostic repetitions are not
added to that total. Earlier failed runs remain available; a passing rerun does
not explain the intermittent startup delays. `browser-final-review.md` records
direct screenshot observations and `browser-change-ledger.md` records assertion
changes and their reasons.

## API, queries and coverage limits

[HDPE_API_AUDIT.md](HDPE_API_AUDIT.md) contains the source-level triage. The audit
found 403 frontend call sites and 509 registered backend routes. Its live smoke
recorded 139/140 successful GETs, 178/179 expected mutation-validation responses,
and 63/65 absent-ID reads returning 404; the other two were 422 validation errors.
Thirteen automated flags were reviewed: generic/union request inference and
documented scoped/absent-ID behavior explained them. The independent organization
loading defect above was real and fixed.

Four representative filtered query plans were inspected, along with tenant/unit
consistency, approval separation and published-balance checks. These are small
dataset observations, not production capacity or load certification. Browser and
integration suites exercise filter families and permissions, but do not exhaust
every possible parameter combination, browser, screen size or external device.
The action-level mixed-role investigation is tracked separately in
[HDPE_SCOPE_AUTHORIZATION_REVIEW.md](HDPE_SCOPE_AUTHORIZATION_REVIEW.md), with
reproduced defects, repaired boundaries, negative/positive tests and areas not
covered by that review. [HDPE_WORKFLOW_COVERAGE.md](HDPE_WORKFLOW_COVERAGE.md)
maps all 66 handover items to UI, API/integration and seed evidence.

## Remaining limitations

- No actual site historian, PI installation, operational measurements, equipment
  specifications, lab certificates or production commercial rates were supplied.
  PI/MQTT scenarios use local fixtures/simulators.
- The finite telemetry snapshot naturally becomes stale; it is not an ongoing feed.
- Initial scoped frontend ESLint found 38 existing errors and 250 warnings outside
  the focused repairs. The first unrestricted lint also traversed the owner's
  large `.claude/` worktrees and was stopped; changed-file checks are tracked separately.
- The plan-version header currently displays “unit unknown” because that response
  lacks a header unit; generated period views carry their engineering units.
- Two route attempts exceeded startup readiness limits (one after sign-in, one
  after reload). Focused reruns passed without increasing timeouts; their causes
  remain unconfirmed.
- [HDPE_DEPENDENCY_AUDIT.md](HDPE_DEPENDENCY_AUDIT.md) records twelve vulnerable
  production package entries across both projects (eight moderate, three high,
  one critical), covering 24 advisory records across the two trees. No exploit path was confirmed in the inspected application
  call sites, but the advisories remain unresolved. No dependencies were changed.
- Production load/soak, external connector certification and business-owner sign-off
  remain outside the evidence established by this local test run.
- The 52 persona checks establish successful sessions and identity/scope display;
  representative role journeys provide deeper workflow coverage. Some advanced
  editors have API/integration coverage without a dedicated browser journey.
  The 66-item workflow matrix lists those UI gaps explicitly; route rendering
  does not substitute for exercising every editor or approval flow.

## Handover

Open `http://localhost:8070`. The named persona accounts use the local demonstration
password documented in [HDPE_DEMO_GUIDE.md](HDPE_DEMO_GUIDE.md); the same guide maps
roles to workflows and records the seed/recovery procedure. Operational records
remain the clean HDPE scenario after the final read-only checks. All task source,
test and documentation changes are committed locally; nothing was pushed.
