# HDPE follow-up fixes and frontend review — 16 October 2026

This follow-up preserves the single HDPE organization/plant, unit100/Extruder1 and
unit200/Extruder2 scenario. The original seed and validation campaign are recorded
in [HDPE_E2E_REPORT.md](HDPE_E2E_REPORT.md). Evidence below belongs to a new run in
`test-results/hdpe-followup/`; historical and intermediate results are not added
together as if they were independent passing tests.

## Repairs

- Cleared every previously reported production dependency advisory in both npm
  projects. Backend development dependencies also audit clean. One unpatched
  frontend development-only `braces` advisory remains through six package entries;
  no Tailwind major migration was forced. See
  [dependency remediation](HDPE_DEPENDENCY_REMEDIATION.md).
- Bounded session startup and body reads, preserved valid credentials through
  infrastructure failure, added explicit retry/sign-out, removed cached-permission
  fallback and guarded stale identity/plant responses. Deterministic failure tests
  establish these repairs; the historical intermittent delay remains unattributed.
  See [session recovery](HDPE_SESSION_RECOVERY.md).
- Fixed legacy plan create/update accepting an end date before its start. The
  effective interval is checked before persistence, including partial updates.
  Equal endpoints preserve the existing v1 contract. See
  [isolated reproduction and validation](HDPE_LEGACY_PLAN_VALIDATION.md).
- Fixed unavailable Repair/Related event deep links showing an empty pane, and
  attribute Back/Cancel losing the hierarchy level. Event return destinations now
  accept only supported internal paths while retaining list query/filter state.
- Replaced the misleading plan-header “unit unknown” with a localized target and
  explicit profile-unit context. The API does not expose a frozen header UOM;
  historical units are not guessed from current product/profile settings.
- Removed frontend lint errors and corrected ten legacy API assertions that could
  falsely pass when a request succeeded. Generated component files were preserved;
  their existing single-extends interfaces have a narrowly scoped ESLint rule.
- Completed the four approved frontend stages: period sections with retained
  drafts, month-close sections and sign-off overview, a dedicated RCA definition
  editor with progressive action detail, and grouped MQTT profile/status controls.
- Repaired the month-close proposal table's squeezed mobile Reason column and
  misleading pre-close guidance on locked months. Locked records now direct users
  to the after-close correction workflow. The final mobile recapture confirms a
  readable 256px Reason column within the existing horizontal table scroll.
- Aligned the organization-administrator frontend gate with existing backend
  authorization. Three focused files / 69 tests pass after three red reproductions;
  no API contract changed (`org-admin-gate-final.json`). Audit and Tasks labels
  now explain the scope of their summaries.

## Frontend architecture review

The UI subagent inventoried all 94 production route declarations and collected 51
fresh states with desktop/mobile evidence. The audit distinguishes captured routes
from directly inspected screens and lists all dynamic-route coverage gaps. See
[detail-page review](HDPE_DETAIL_PAGE_REVIEW.md).

The [restructuring plan](FRONTEND_RESTRUCTURING_PLAN.md) prioritizes period accounting
and month close, then targeted RCA and integration form refinements. It preserves
existing URLs, API contracts, calculations, permissions, query state and unsaved
drafts. The owner approved the plan on 16 October 2026. All four source stages are
complete, with isolated workflow and rendered checks recorded in
[execution progress](FRONTEND_RESTRUCTURING_PROGRESS.md) and the
[page task breakdown](HDPE_PAGE_TASK_BREAKDOWN.md). Final frontend deployment and read-only
acceptance on the preserved HDPE stack have passed, as recorded below.

## Verification status

Latest completed source and isolated-stack checks:

- Frontend: **161 files / 981 tests passed**, zero failed/skipped, in
  `frontend-structural-final.json`. Application, tooling and E2E TypeScript checks
  passed. Full lint: **0 errors / 228 warnings** in
  `frontend-lint-structural-final.json`. The subsequent narrow month-close visual
  repairs passed three focused files / 39 tests, typecheck and changed-file lint;
  this focused run is separate from the combined 981-test campaign.
- Backend: **220 suites / 2,540 unit and accounting-math tests passed**. Integration
  latest-per-suite evidence is **173/173 suites / 990/990 tests passing**, zero
  skips (`backend-integration-effective-summary.json`). The original full run was
  166 passing / seven failed suites, with 962 passing / 28 failed tests. The exact
  seven-suite rerun passed **35/35 tests** without product/assertion changes. This
  is not a fresh full green run. No root cause is proven for the original
  intermittent connection failures; see `integration-diagnostics.md`.
- Structural browser checks: **49 unique checks with their latest result passing**,
  across the campaigns named in `ui-structural-effective-summary.json`, not one
  clean run. The earlier period pilot's 26 latest passing checks and the baseline
  121 route/persona/responsive checks, four session-recovery checks and six
  navigation/units checks are separate historical campaigns; their counts are not
  summed into an inflated total.
- Direct visual review: **nine final RCA captures** and **26 month-close/MQTT
  captures** (20 month-close, six MQTT), plus the earlier period and detail-page
  evidence. The final 390px proposal-width after capture is accepted.
- Linux container builds passed during staged validation. The final frontend
  deployment and read-only acceptance on 8070 have passed; see the receipt below.

All evidence paths above are under `test-results/hdpe-followup/`. Failed JSON runs
remain available. One browser continuation reused the fixture output directory
and cleared its previous images/traces; its report and extracted session-network
summary were retained. Month-close and MQTT final images were recaptured in a
separate directory. Those lost original images/traces cannot be independently
reviewed and are not described as preserved.

The before-deployment read-only SQL/API acceptance passed for hierarchy, scope
grants, accounting, month close and the finite MQTT snapshot
(`acceptance-before.log`). No new seed/reset or live business mutation was used for
this follow-up. The backend integration harness operates on `proact_hdpe_test`.
Structural UI mutation tests use a separately restored `proact_ui_followup_test`
database, API port 4006 and frontend port 8071. Its copied integration connections,
PI jobs and stream connections are disabled before starting its worker. The clean
HDPE database remains on the existing API/frontend ports 4004/8070. A fresh restore
snapshot is retained as `hdpe-ui-baseline.dump`.

## Manual set and source coverage

The requested manual set is generated at these destinations:

- [Page and Field Manual](manuals/01_Page_and_Field_Manual.docx): page/subpage
  purpose, roles, controls, defaults, validation, filters and commands.
- [Application Logic and Data Flows](manuals/02_Application_Logic_and_Data_Flows.docx):
  tenancy, ingestion, accounting, approval, valuation and audit behavior.
- [New Plant Setup Guide](manuals/03_New_Plant_Setup_Guide.docx): installation,
  configuration, master data, integrations and commissioning order.
- [Operations and Verification Guide](manuals/04_Operations_and_Verification_Guide.docx):
  operational workflows, verification evidence and known boundaries.
- [Persona Responsibilities and Approvals](manuals/05_Persona_Responsibilities_and_Approvals.docx):
  35 workflow families, nine named handoffs, independent approval/closure rules
  and the complete 52-person HDPE role and scope roster.

The frozen `test-results/manual-qa/coverage.json` inventory reconciles **95 page
groups, 2,080 field entries and 95/95 route declarations**, with no missing routes,
required properties or source paths. It combines administration, global,
integration and operations inventories. Inventory owners completed control
reconciliation and `audit-manual-coverage.py` confirmed the totals. Route/source
coverage is separate from runtime-state testing and document visual acceptance.
Final document acceptance is recorded below.

## Completed release receipt

Release completed from local commit `2f385d2`. The frontend image `proact-frontend:hdpe-structural-final-20261016` (`sha256:2f1f3dd39ab3c59aceaea056b7332c3f55098afa37fe237a96dd538fa7e79747`) was deployed to the live 8070 frontend; this release replaced only the frontend service. Build evidence: `structural-final-build.log`; image receipt: `deployed-frontend-image.txt`. Read-only hierarchy, permission, accounting, month-close and MQTT SQL/API acceptance passed in `acceptance-structural-release.log`.

The final month-close browser campaign passed **6/6 cases**, zero skipped/flaky (`structural-release-final.json`). Eight read-only captures in `release-copy/` (3), `release-orgadmin/` (3) and `release-final-details/` (2) passed with no errors or business writes; the parent directly inspected all eight and the previous-month 390px overview/proposals. The Reason column is 256px wide and readable after scrolling inside the table; the page remains 390px wide. Locked-month guidance, Audit/Tasks summary scope and explicit plant-grant wording are accepted. Three additional live 8070 organization-administrator captures in `release-live/` passed: plant form, audit and locked-month proposals, with no business writes. Evidence paths in this receipt are under `test-results/hdpe-followup/`.

All five manuals have completed structural, field-content and visual acceptance. The set contains 592 rendered pages, 95 page groups, 2,080 field/display entries and all 95 route declarations. The responsibility guide covers 52 named HDPE personas, 35 workflow families and nine worked handoffs. Every original page and every changed page body was individually inspected; unchanged body hashes retain their earlier review and every final PDF footer was checked. Final image evidence is under `test-results/manual-qa/accepted/`; committed document/source hashes and per-page review provenance are in `docs/manuals/verification.json` and `docs/manuals/verification-pages.json`.

## Remaining boundaries

- All four structural source stages, the local release and all five manuals are complete.
  No optional redesign or additional seed campaign is part of this completed release.
- The development-only dependency advisory remains open until a compatible patch
  or separately scoped tooling migration is available.
- Lint warnings remain, mainly existing complexity/size checks and route/context
  Fast Refresh export patterns. Zero lint errors is not zero technical debt.
- No live SQL Server was supplied for the retained MSSQL maintenance scripts;
  dependency construction/parameter-binding checks do not establish connectivity.
- This visual pass does not claim complete screen-reader, keyboard, empty/error,
  every dynamic record, or every successful business transition coverage. Earlier
  broad persona/workflow evidence remains historical and is identified as such.
