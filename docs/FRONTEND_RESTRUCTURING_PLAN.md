# Frontend restructuring plan

Status: approved by the user on 16 October 2026. Stage 1 (period accounting) is implemented with source checks and deployed desktop/mobile review completed; the parent coordinates final isolated workflow acceptance and release of subsequent stages. Existing defect repairs in authentication, plan units/navigation and dependency maintenance are separate work.

## Recommendation

Start with period accounting, then month close. Both contain several distinct jobs on one long page. Reuse the existing RCA workspace navigation pattern and the existing page, section, table and feedback components. Validate one complete workflow before applying the pattern elsewhere.

The application is a production assurance system: production events, versioned plans and rates, reconciled shift accounting, quality decisions, production-day/month close, RCA and action verification, connectivity, finance and plant administration. This description comes from current route/component behavior and the seeded HDPE application, not an assumed domain model.

## Evidence and audit boundaries

- Source inventory: **94 production route declarations: 62 static and 32 parameterized/wildcard routes**, plus one development route. `src/App.tsx` adds the root redirect and global fallback. The RCA wildcard has ten explicit nested child paths plus its index/fallback; these are listed below separately.
- Fresh browser run: 51 captures under `test-results/hdpe-followup/{discovery,priority,details,defect,discovery-two}`. Desktop 1440×900; mobile 390×844. Screenshot and DOM/API response records were captured together. No previous audit screenshot was reused. See `HDPE_DETAIL_PAGE_REVIEW.md` for explicit captured/inspected/pending coverage.
- The in-app browser timed out twice (inventory at 30 seconds, creation at 60 seconds); the previously authorized Playwright workflow was used as a fallback. Its read-only guard blocks non-read API commands after login. Login/refresh and operational background heartbeats are not business edits.
- The final seeded HDPE records were inspected as Helena Fischer, a super administrator. This establishes layout and data presence, **not** all-role permission verification. Role regressions are an implementation acceptance requirement.
- Directly inspected fresh evidence includes plan desktop/mobile, period desktop/mobile, profile, RCA overview/actions/mobile, finance policy, published calendar, MQTT payload/quarantine/mobile, month close, measurement uncertainty and unit details. Other captured states are discovery evidence, not a claimed complete visual review.
- Loading/error/empty/keyboard/screen-reader paths are not comprehensively verified by these captures. Quarantine is populated; the inspected RCA evidence list is empty. No fake complete detail was created to fill a missing seed record.

| Priority | Existing workflow and evidence | Observed issue | Proposed intervention |
|---|---|---|---|
| 1 | `/plans/:planId/periods/:periodId`; `details/21-period-desktop.png` (1440×3322), `22-period-mobile.png` (390×4578) | Reconciliation, actuals corrections, quality, approval, day close, charts, value, history and exports form one stack. Workflow controls occur after two empty tables. | A shared period workspace with task-oriented subpages. |
| 2 | `/month-close`; `discovery/10-month-close.png` (1440×4132) | 50 pending periods, 50 uncertified days and 56 proposals push sign-offs to the bottom. Long lists have little scanning structure. | Close overview plus URL-backed prerequisite and history sections. |
| 3 | `/rca/:caseId` and `/rca/:caseId/actions`; `details/26-rca-overview.png` (1440×1972), `28-rca-actions.png` (1440×1477) | Overview is also the full definition/team editor. Actions show evidence editing, baseline, effectiveness and a new-action form at once, even for the inspected closed case. | Preserve the existing five-part workspace; separate definition editing and progressively reveal action details. |
| 4 | `/connectivity/connections/:connectionId?tab=profile`; `details/33-mqtt-profile.png` (1440×1377) | One configuration form mixes identity, timing, field overrides and two mapping editors; save sits after all groups. Subscription technical identifiers dominate mobile status. | Cohesive collapsible groups and a clear save/status area within the existing tab. No replacement integration console. |
| 5 | `/master-data/units/:unitId`; `details/36-unit-detail.png` | Editing identity, browsing eleven assets and technical mappings share one page. Secondary content already collapses; the basic editor is coherent. | After higher priorities, optional URL-backed Details/Assets/Attributes sections; retain a single create form. |

These are design recommendations. Screenshot height supports the observed workflow problems; it is not the selection criterion by itself. The orange plan-header “unit unknown” is a separate confirmed clarity defect already assigned for repair.

## Stage 1 — period accounting pilot

Current implementation: `src/features/plan-dashboard/period-page.tsx` → `components/period-detail.tsx`. The latter mounts sixteen functional groups. `PeriodHistory` itself combines audit history, change proposals and export. `useDraftEditor` owns dirty lines, row-version checks, base-run checks and conflict rebase behavior.

### Proposed hierarchy

| URL, retained or added | Contents |
|---|---|
| Retain `/plans/:planId/periods/:periodId` | Reconciliation: compact totals, plan/capacity comparison, loss-line decisions and waterfall. This stays the existing bookmark's landing page. |
| Add `.../actuals` | Source provenance, measured-output adjustments and product dispositions; links to the existing creation forms. |
| Add `.../review` | Submit/approve/revise controls, bridge review, stop coding gate, SLA/hold state, restatement and production-day certification. A persistent status summary links here when action is needed. |
| Add `.../value` | Valuation totals, currency/basis context and existing breakdown. |
| Add `.../history` | Revision history, change proposals/corrections and approved exports. Preserve correction workflows; make their location explicit in the period navigation. |
| Retain `.../adjustments/new`, `.../dispositions/new` | Existing dedicated forms, validators, commands and refusal behavior. Return to the actuals section with relevant revision context. |
| Retain `/plans/:planId` | Period grid and plan summary; no duplicated plan editor. |

Shared layout: period title/date/unit/engineering-unit/status header; current-versus-approved and plan-versus-capacity controls; navigation with active state and visible keyboard focus. A small `PeriodWorkspace` context owns the loaded record and selections. Reuse `Page`, `PageHeader`, `ScopeHeader`, `DataState`, `Section`, `DataTable`, `Quantity` and `PlantTime`; use the existing RCA `CaseNav` behavior as the navigation reference.

Candidate components: `period-workspace.tsx`, `period-section-nav.tsx`, section-level reconciliation/actuals/review/value/history components, and a small URL-state parser. Extract history/proposals/export composition without duplicating commands. Do not create a generic workflow engine or wrap every existing child in a trivial new component.

### State and contract preservation

- Keep `usePlanContext`, `useReconciliation`, `usePeriodAccounting` and tenant-scoped React Query keys. Never invent figures in the UI or recalculate accounting values.
- Encode `view=current|approved` and `ledger=plan|capacity` in query state, preserving unrelated parameters. Defaults must match today's current/plan view. Invalid values fall back predictably. All section links carry these selections.
- The dirty loss editor survives navigation within the same period/revision. Its draft owner and editor subtree remain mounted while panels change. Manual input still being entered is also part of the retained draft; an incomplete manual entry must be added or cancelled before atomic save.
- Approved implementation adjustment for the existing `BrowserRouter`: SPA Back/Forward and other navigation may leave freely, but user/plant/authority/period/revision-keyed memory retains the draft and offers explicit Restore/Discard on return. Browser reload/close triggers a native unsaved warning even after leaving the period. Confirming reload loses this session-memory draft; no persistent browser storage or global history interception was introduced. Save/discard clears an entry; identity, plant, role/grant changes and logout clear the entire store. Retention caps at twenty drafts without eviction and prevents editing a further period until capacity is released. Approved or replaced revisions never restore edits into another revision; their retained entries can be explicitly discarded.
- A revision or server-run change must preserve current `useDraftEditor` rebase/conflict behavior. Keep `rowVersion`, `If-Match`, `baseRunId`, candidate identities and refusal payload handling untouched.
- Preserve lifecycle and capability gates: `canWritePeriods`, `canApproveRevisions`, `canProposeCorrections`, same-author exclusions, approved-read-only view, held states and closed-month refusals. UI sections are navigation, not new permission boundaries.
- Keep the same endpoints and payloads. Only the visible section's secondary reads should be mounted when safe; do not drop subscriptions/cache invalidation required to warn about stale inputs.
- Existing period links from queue, month close, RCA and exports remain valid. Adding a wildcard layout must not shadow the existing adjustment/disposition routes. No API or database change is proposed.

### Acceptance for the pilot

Direct load, refresh and browser Back/Forward work for every section and old base URL. Selection survives section navigation and refresh. An isolated draft-line edit survives navigation and a rejected save; approved views expose no editable draft. Current/approved figures, both ledgers, calculations, quality quantities, decision states and exports match pre-change evidence. Accountant, independent approver, quality approver, manager and viewer tests preserve their existing controls/refusals. Tab/Shift+Tab reaches navigation and actions; mobile controls fit without whole-page horizontal scrolling. Console/API errors are investigated, not waived.

Implementation evidence: the final focused source campaign passed **16 files / 80 tests** (`period-pilot-tests-final.log`); full typecheck passed (`period-pilot-typecheck-final.log`), and area lint had no errors (`period-pilot-lint-final.log`). New tests cover five-section grouping, query/Back/Forward, old specific form routing, invalid-section fallback, approved-fetch placeholders, rejected saves, manual input retention, explicit restore/discard, original concurrency metadata after a changed run, rebase when the newest view was already cached, successful-save cleanup, authority isolation and non-evicting bounds. Ten fresh deployed captures cover all five sections on desktop/mobile. Five final captures verify the contained 390px writer, readable actuals empty states and explanatory ledger copy (`period-pilot-final/`). A separate guarded browser probe verifies partial manual input through a committed grid transition, browser Back, explicit Restore and dismissed reload (`period-retention-probe/`). The parent owns isolated real-API command/role tests and their final aggregate; screenshot review alone does not establish those contracts.

## Stage 2 — month close

Current files: `features/month-close/month-close-page.tsx`, `components/close-prerequisites.tsx`, `close-sign-offs.tsx`, `close-history.tsx`. All data comes from `useMonthClose(month)`. The backend supplies capped prerequisite samples and authoritative counts.

Retain `/month-close?month=YYYY-MM`. Add a `section` query parameter with `overview`, `periods`, `days`, `proposals`, `history`; use tabs because these are views of the same monthly close, not independent transaction forms. Default overview shows deadlines, three prerequisite counts/statuses, materiality state and sign-offs above the fold. Each count links to its section. Tables show date, unit, shift/status where available; proposals retain their existing period links and expose correction context. History remains read-only audit evidence.

Extract a cohesive `CloseOverview` and prerequisite tables. Reuse the same `MonthNav`, confirmation dialogs and mutation hooks. Do not duplicate `CloseSignOffs` across tabs or make a close command automatic. Preserve `month` when selecting a section and section when changing month, with invalid section fallback.

**Data limitation:** `PendingPeriodView` has no plan ID; uncertified days have unit/date but no period route. Do not construct guessed period links. Provide the existing queue navigation where appropriate, with only filters the queue actually supports. The API returns first-50 samples; a local table must explicitly say “first 50 of N” and cannot claim server pagination, a complete search or all-record export. If full list pagination becomes necessary, flag it as a separate API proposal requiring authorization.

Acceptance: current/open and previous/locked month; month/section Back/Forward/refresh; exact counts and sample truncation disclosure; linked proposals; independent quantity/finance roles; materiality review; same-author refusal; unchanged lock/reopen rules. Run business mutations only on isolated fixtures, then preserve the final HDPE seed.

## Stage 3 — targeted RCA refinement

Implementation status (16 October 2026): source is complete and awaiting the parent's rebuilt isolated frontend for real workflow and visual acceptance. Overview now contains progress, workflow and saved definition/team facts; `/rca/:caseId/definition` contains the existing scalar definition/team command. All five navigation sections and previous child paths remain; new definition/back and section links preserve query state. Action title, owner, due date, status and verification remain visible. Native “Evidence & effectiveness” and “Add action” disclosures retain their mounted inputs while closed.

The moved definition editor uses user/plant/authority-owned session memory, capped at twenty drafts without eviction. Section navigation and SPA leave/return offer explicit Restore/Discard. Original rowVersion and plant-timezone date interpretation remain attached to restored edits; stale saves retain the original If-Match and preserve fields when refused. Discard loads current server facts. Reload/close warns even after leaving the case; confirming it loses the memory-only draft. Save/discard clears the entry, and identity/plant/authority/logout changes clear all entries. Existing team-lock and RCA write capabilities remain unchanged. Action forms retain their original cross-route behavior; the new disclosures do not unmount fields during close/reopen.

Source validation: **9 files / 66 RCA tests passed**, including thirteen new navigation/draft/disclosure/isolation cases (`rca-stage-tests-final.log`). The final route review also passed its seven workspace tests, including trailing-slash active state (`rca-stage-final-route-review.log`). Area/App lint has **0 errors / 15 existing warnings** (`rca-stage-lint-final.log`). Two original definition/overview flow assertions now target the appropriate new screen; workflow commands and refusal tests remain in place. Full app/node/E2E typecheck **passed** (`rca-stage-typecheck-final.log`). Sandbox attempts that executed no tests because of temporary-cache EPERM errors are retained. No live HDPE business mutation was made by this source work.

Do not rebuild the RCA architecture: it already has nested Overview, Evidence, Analysis, Recommendations & actions, Links & outcome pages. Keep all existing routes, evidence forms and analysis-tool URLs.

- Keep `/rca/:caseId` as a concise overview of identity, progress, workflow and definition/team facts. Add `/rca/:caseId/definition` for its existing definition/team editor. A contextual “Edit definition” link opens it. Status transitions remain in `WorkflowPanel`; editing is never a new way to alter status.
- Keep `/rca/:caseId/actions`. Show recommendations and action summaries first, with due date, owner, completion and verification. Expand an action's evidence/baseline/effectiveness section on request; move the existing new-action form behind “Add action”. Use a dedicated action-detail child route only if a further multi-action capture demonstrates that collapsible content is insufficient.
- Keep analysis tools and evidence editors intact. An empty evidence list must not imply an incomplete or invalid closed case: these screens reflect stored records and established domain rules.

Source anchors: `case/overview/overview-page.tsx`, `case/actions/actions-page.tsx`, `actions/actions-tab.tsx`, `actions/action-row.tsx`, `case/case-workspace-page.tsx`, `case/case-nav.tsx`.

Dependencies/risks: case context normalization, `useCasePatch`, team freeze states, separate definition and workflow mutations, analysis-derived root cause, action evidence uploads, verification windows/baselines, unsaved form state. Preserve all present permissions even if an editable control appears surprising on a closed case; a redesign is not permission to change lifecycle rules. Add navigation/focus restoration and draft retention tests before moving the form.

## Stage 4 — integration and secondary detail refinements

Connectivity already has URL-backed Connections/Quarantine/Source mappings and dedicated connection, exception and mapping pages. MQTT connections already have Subscription/Payload profile/Quarantine; PI connections have Stages/Diagnostics/Discovery/Jobs/Signals. Preserve this structure.

- In `mqtt/profile-editor.tsx`, group Identity/schema, Timestamp/quality, Field overrides, and Value maps. Keep one draft/validation/save transaction; expandable advanced sections must not clear hidden fields. A persistent save/status region must not conceal field errors. Replace technical implementation wording only where it clarifies the same action.
- In subscription status, keep connection health and last observation prominent; collapse lease/client/filter details on narrow screens while retaining copy/accessibility. Preserve all counters and user-triggered pause/drain/stop commands.
- Keep exception raw payload and normalized preview in bounded, keyboard-scrollable regions. Audit populated jobs, replay details and exception resolution before making layout changes; no PI connection/job was present in the inspected final seed, so that evidence is pending.
- Unit/master-data details can gain URL-backed sections only after verifying create/edit draft handling. Existing collapsed legacy values/custom attributes/mappings are sensible; retain them where a new route would add needless navigation.

Risks: connection settings version, profile merge patch, subscription restarts, `useConsoleSession` diagnostics/discovery state, forced-mounted PI discovery content, replay boundaries, large raw JSON, write permissions and active-connection lifecycle. No source, transport or ingestion behavior changes belong in this stage.

## Keep or refine without splitting

| Area | Decision and reason |
|---|---|
| Plan/version detail | Coherent short read-only summary, slices and version history; repair unit context and preserve version links. No new section route justified by fresh evidence. |
| Production profile | Three rate rows and seven valuation rows are related, readable tables. Keep one page; preserve engineering units, effective dates and maker/checker actions. Mobile table affordance can improve without fragmenting the record. |
| Published calendar | A single chronological form with shifts, optional exclusions and preview. Keep cohesive; clearly group preview controls and immutable-state text. A wizard is not justified for reading published versions. |
| Finance policy detail | Compact settings grid, approved status and new-version action. No decomposition needed. Author display “Another user” is a context/label limitation to assess independently. |
| Measurement uncertainty | One populated boundary budget with contribution breakdown and adoption action fits on one desktop screen. Keep it; audit a large component/correlation budget before proposing new pages. |
| Tasks, audit entries and knowledge entries | Dedicated detail pages already exist. Validate content and return navigation; avoid gratuitous nested routes. |
| Event detail | Already uses URL-backed Values/History/Review/Evidence/Repair/Related/Periods tabs. Preserve routes, `state.listSearch` return context and permission gates. A confirmed unavailable-tab defect is being repaired independently. Event forms must retain keyed draft state, restored/server-change warnings, the 400ms affected-period preview and 412 conflict dialog. Optional maintenance fields may collapse; no wizard is justified. |
| Admin hierarchy and attribute forms | Existing max-width forms have cohesive identity fields and conditional validation rules. Do not split by line count. The confirmed attribute return-level bug has a focused repair outside restructuring. |

## Shared architecture and design rules

Existing stack: React Router, React Query, feature-level hooks/models, capability hooks, shared Tailwind/Radix components and `features/ux-kit`. `App.tsx` protects feature routes and nests plant, currency and calendar providers. `V2SessionBridge`/`RealtimeBridge` bind API and realtime state. Authentication repair is a separate lane; restructuring must not change it.

Reuse `Page`/`PageHeader`/`Section` for one h1 and ordered headings; `DataTable` for contained overflow and empty/error/loading states; `DataState` for fetch states; existing field/dialog primitives for forms and confirmations. Reuse the `CaseNav` link pattern for true subpages and Radix tabs for same-record query sections. Avoid new dependencies and global design changes. Extract a shared section-navigation primitive only after period and RCA requirements prove the same behavior.

Make one primary task apparent, keep secondary/technical information collapsible, and use consistent parent links. Do not replace readable dense tables with excessive cards. Preserve all rows/fields when hiding secondary columns or creating mobile alternatives. Respect existing plant dates/digits, timezone, display currency and engineering units.

## Incremental verification and rollout

1. Review this plan and select the period pilot boundary; do not begin structural implementation before the requested review.
2. Add targeted pre-change fixtures/assertions for state retention, current/approved view, permissions and old links. Use isolated fixtures for successful mutations; read-only captures keep the final HDPE seed intact.
3. Implement only the period workspace, inspect diff, run focused unit/E2E tests, lint and complete frontend typechecks/build. Capture and inspect new desktop/mobile results and keyboard flow.
4. Review the pilot's rendered behavior; only then proceed to month close, RCA and optional refinements.
5. For each stage verify parent/subpage navigation, direct load/refresh, browser history, query preservation, cache invalidation, form validation and command outcomes, loading/error/empty states, all affected personas, responsive overflow and accessibility. Report exact executed checks and remaining gaps.
6. Preserve original failure evidence and distinguish functional defects from design preferences. No new backend schema/API contract is authorized by this plan. No deployment or commit is part of the browser audit lane until coordinated.

## Nested RCA route inventory

Under `/rca/:caseId/*`: index overview, `evidence`, `evidence/new`, `evidence/:evidenceId`, `evidence/:evidenceId/edit`, `analysis`, `analysis/:tool`, `actions`, `actions/recommendations/new`, `actions/recommendations/:recommendationId/edit`, `links`, and a wildcard redirect back to the case. These existing paths must remain compatible.


## Complete route inventory

This is a source inventory, not a claim that every route has been visually tested. New forms and read-only details share several page components.

### administration.tsx

- `/master-data`
- `/master-data/units`
- `/master-data/units/new`
- `/master-data/units/:unitId`
- `/master-data/assets`
- `/master-data/assets/new`
- `/master-data/assets/:assetId`
- `/master-data/products`
- `/master-data/products/new`
- `/master-data/products/:productId`
- `/master-data/hierarchy`
- `/master-data/rca/templates`
- `/master-data/rca/templates/new`
- `/master-data/rca/templates/:templateId`
- `/master-data/rca/causes`
- `/master-data/rca/checklists`
- `/master-data/rca/checklists/new`
- `/master-data/rca/checklists/:checklistId`
- `/master-data/failure-dictionary`
- `/master-data/plant-flow`
- `/master-data/stop-policy`
- `/master-data/standby-equipment`
- `/master-data/unit-impact-rules`
- `/master-data/work-orders`
- `/master-data/unit-state`
- `/codes-admin`
- `/codes-admin/rules/new`
- `/codes-admin/rules/:ruleId`
- `/codes-admin/:library/:codeId`
- `/finance`
- `/finance/policies/new`
- `/finance/policies/:policyId`
- `/finance/fx/:fxId`
- `/users`
- `/users/new`
- `/users/:userId`
- `/permissions`
- `/delegations`
- `/admin`
- `/admin/organizations/new`
- `/admin/plants/new`
- `/admin/attributes/new`
- `/admin/attributes/:attributeId`
- `/tasks`
- `/tasks/new`
- `/tasks/:taskId`
- `/audit`
- `/audit/:entryId`
- `/settings`

### dev.tsx

- `/dev/ux-kit`

### integration.tsx

- `/connectivity`
- `/connectivity/connections/new`
- `/connectivity/connections/:connectionId`
- `/connectivity/connections/:connectionId/edit`
- `/connectivity/connections/:connectionId/signals/new`
- `/connectivity/quarantine/:exceptionId`
- `/connectivity/mappings/new`
- `/connectivity/mappings/:mappingId`
- `/connectivity/source-status`
- `/connectivity/source-authority`
- `/enhanced-historian`

### overview.tsx

- `/dashboard`
- `/reports`

### production-planning.tsx

- `/production-plans`
- `/planning`
- `/planning/plans/new`
- `/planning/plans/:planId`
- `/planning/plans/:planId/versions/new`
- `/planning/plans/:planId/versions/:version/edit`
- `/planning/profiles/new`
- `/planning/profiles/import`
- `/planning/profiles/:profileId`
- `/planning/profiles/:profileId/edit`
- `/planning/calendars/new`
- `/planning/calendars/:versionId/edit`
- `/plans/:planId`
- `/plans/:planId/periods/:periodId`
- `/plans/:planId/periods/:periodId/adjustments/new`
- `/plans/:planId/periods/:periodId/dispositions/new`
- `/month-close`
- `/my-queue`
- `/measurement-uncertainty`

### production.tsx

- `/events`
- `/events/new`
- `/events/rca-triggers`
- `/events/:eventId`
- `/events/:eventId/edit`
- `/downtime`
- `/pla-analytics`

### reliability.tsx

- `/rca`
- `/rca/new`
- `/rca/:caseId/*`
- `/rca-knowledge-base`
- `/rca-knowledge-base/:entryId`
- `/reliability/bad-actors`


### Stage 3 final rendered check — 16 October 2026

RCA source restructuring and its responsive Workflow facts repair are rendered and accepted on the isolated stack. Fresh campaign `test-results/hdpe-followup/rca-stage-final/index.json`: 9/9 states passed, all nine PNGs directly inspected, no page/API errors or business writes, 390px and 1440px document widths match their viewports. Existing local horizontal scrolling of the Recommendations table is retained. Earlier raw failures remain preserved; the isolated initial mobile bootstrap delay was not reproduced and has no confirmed cause. The parent's real-API workflow results remain the authority for successful commands, conflict/refusal behavior, and permissions.
