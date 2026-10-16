# HDPE detail page review

Fresh audit: 16 October 2026. The user approved [FRONTEND_RESTRUCTURING_PLAN.md](FRONTEND_RESTRUCTURING_PLAN.md) on this date. All four approved source stages are complete. The baseline below precedes that restructuring; later sections record isolated workflow and direct rendered acceptance. Final frontend deployment/read-only acceptance on 8070 and the repaired month-close proposal-width recapture have passed. Only final manual visual QA remains.

## Method and coverage

The in-app browser failed to connect twice, so the authorized Playwright workflow captured the deployed HDPE app. All evidence here was created in this follow-up run under `test-results/hdpe-followup`; none is reused from `hdpe-audit`. The saved screenshots below were opened and inspected directly. Captures used desktop 1440×900 and mobile 390×844.

There are **51 captured states** across five batches: discovery 16, priority 4, details 18, defect 4, discovery-two 9. Each has a JSON record with the route, accessible DOM, API responses and screenshot path. All 51 completed; their recorded API responses contained no HTTP 4xx/5xx, page errors or blocked writes. This is read-only discovery evidence, not 51 automated functional test passes. Login/refresh is permitted; successful business mutations were blocked. Browser navigation and open forms did not change HDPE business records.

Source inventory covers 94 production route declarations (62 static, 32 dynamic/wildcard), the development route, root/fallback and RCA nested paths. `route-inventory.json` and the restructuring plan contain every declaration. A captured route is not automatically an inspected or accepted screenshot; the accepted evidence is enumerated below. This audit used an actual super-administrator login, not forged UI roles. All-persona authorization and successful business transitions are outside this fresh visual pass.

## Numbered audit observations

| Step / fresh screenshot | Health | Observation and implication |
|---|---|---|
| 01. `priority/17-plan-detail-desktop.png` | Confirmed clarity defect | Version 2's 14,400 header target displays orange “unit unknown”. The parent has repaired this separately with honest profile-unit context; no unit was inferred. |
| 02. `priority/18-plan-detail-mobile-viewport.png` | Usable, dense | Header/actions fit; long dates remain in a contained scrolling table. Product cells wrap heavily. No whole-page overflow. Avoid splitting a short coherent version detail. |
| 03. `details/21-period-desktop.png` | High-priority restructuring | 1440×3322. Adjustment and disposition empty tables precede loss decisions and workflow. Day certification, waterfall, valuation, history, corrections and exports continue below. Distinct tasks need section navigation. |
| 04. `details/22-period-mobile-viewport.png`, full `22-period-mobile.png` | High-priority restructuring | Full page is 390×4578. The first viewport is almost entirely identity, status and totals. Controls fit, but the important tasks require substantial scrolling. |
| 05. `discovery/10-month-close.png` | High-priority restructuring | 1440×4132. Fifty pending periods, fifty uncertified days and fifty-six proposals precede sign-offs. Show close status and prerequisites as a summary with detail sections. Preserve capped-list disclosure. |
| 06. `details/24-profile.png` | Coherent | Engineering rates and valuation rates share version/effective-date context. Keep the related tables together. There is no evidence that this page needs multiple routes. |
| 07. `details/26-rca-overview.png` | Medium-priority restructuring | 1440×1972. Progress, workflow and a full definition/team editor share the overview. A summary with a definition-edit child page would clarify reading versus editing. Existing permissions/lifecycle remain unchanged. |
| 08. `details/28-rca-actions.png`, `29-rca-actions-mobile-viewport.png` | Medium-priority restructuring | Recommendations, evidence form, baseline, effectiveness and a new-action form are all exposed. Progressively reveal per-action details; keep existing RCA subpages. Mobile navigation wraps within the viewport. |
| 09. `details/31-finance-policy.png` | Coherent | Compact approved-policy settings and version action. “Another user” is a limited author label, not evidence of a missing person or incorrect permission. No decomposition needed. |
| 10. `details/32-calendar-published.png` | Coherent with affordance refinement | Published fields are disabled and immutability is explained. Two preview-related control groups need clearer grouping, but the chronological calendar form belongs together. No preview command was submitted. |
| 11. `details/33-mqtt-profile.png` | Medium-priority form refinement | Identity/time/quality, field overrides and two value maps form one 1377px configuration page. Keep one validated save transaction and group advanced settings; save/status should remain easy to find. |
| 12. `details/35-mqtt-mobile-viewport.png` | Usable, technical density | Health is visible, but client ID, lease and topic filters dominate a narrow viewport. Collapse technical details while keeping health, last observation and counters prominent. |
| 13. `details/34-mqtt-quarantine.png` | Coherent populated list | One seeded malformed payload is visible with problem, connection, occurrences and last-seen fields. Exception/raw-payload detail was not yet opened in this pass. |
| 14. `discovery/16-measurement.png` | Coherent | One in-force uncertainty budget fits in one desktop viewport with contributions, evidence and independent approval context. No split justified by this record. |
| 15. `details/36-unit-detail.png` | Lower-priority refinement | Identity form precedes eleven assets. Legacy/custom/mapping details already collapse. Optional URL-backed sections may help larger units, after draft handling is traced. |
| 16. `defect/39-nonstop-repair-before.png` | Confirmed functional defect | A quality-loss event opened at `?tab=repair` has no selected visible tab and an empty details pane. The same happens for `related`. Values/history content exists; the requested tab is simply unavailable to this event type. |
| 17. `defect/42-attribute-cancel-before.png` | Confirmed navigation defect | Cancelling a new Asset attribute returns to the Units attribute list. The form's level is lost by the hard-coded return URL. |

## Approved period pilot: first rendered review

Ten fresh captures in `period-pilot/` inspect the same seeded approved period through all five sections on the isolated `8071/4006` stack. They completed with zero captured HTTP 4xx/5xx, page errors or business-write attempts. All five mobile documents remained 390px wide. The desktop screenshots and mobile full/viewport screenshots were directly inspected; these are layout observations, separate from the parent's real workflow tests.

| Evidence | Rendered finding |
|---|---|
| `58-period-reconciliation-desktop.png` | Reconciliation, run comparison, loss decisions and waterfall form one task page. Its height is 1626px, versus 3322px before restructuring. The distinct run residual and reconciled residual are intentional: the former is the calculation baseline, the latter includes decisions/manual lines. A visible explanation was added after this capture. |
| `59-period-actuals-desktop.png`, `64-period-actuals-mobile.png` | Provenance and correction/quality commands are grouped coherently. Confirmed inherited mobile defect: wide empty tables center the message beyond the visible viewport. Local successful-empty states now render outside those tables; final desktop/mobile captures below verify readable messages. |
| `60-period-review-desktop.png`, `65-period-review-mobile.png` | Approval/revision and day certification are immediately discoverable. The approved desktop review fits one 900px viewport; mobile actions wrap within the page. |
| `61-period-value-desktop.png`, `66-period-value-mobile.png` | The same 907.68 USD approved value and currency/basis context remain available on a focused page. |
| `62-period-history-desktop.png`, `67-period-history-mobile.png` | History, proposal action and approved exports are retained. Mobile history uses contained table scrolling; export buttons wrap. |
| `63-period-reconciliation-mobile-viewport.png` | Section navigation fits and exposes all five links. The shared period date/status header remains dense; the first viewport reaches navigation rather than accounting rows. This remains an affordance refinement, not a claim of an ideal mobile information density. |
| `period-writer/68-period-writer-mobile-before.png` | A local unsaved manual form expanded the document from 390 to 640px. The evidence-picker fieldset's intrinsic minimum width prevented its table from scrolling within the form. The scoped repair adds `min-w-0` and wraps editor heading/actions; final capture verifies a 390px document with contained table scrolling. No server write was made. |

The pilot's final focused source campaign passed **16 files / 80 tests**, including draft restoration with original rowVersion/baseRunId after changed server inputs, unchanged candidate identities until an explicit rebase, and manual input retention. Full typecheck passed. The later mobile CSS/empty-state/copy repair passes full typecheck and targeted lint (0 errors, one existing editor-complexity warning).

Five final repair captures in `period-pilot-final/` were directly inspected: `58-period-reconciliation-desktop-final`, `59-period-actuals-desktop-final`, `63-period-reconciliation-mobile-final`, `64-period-actuals-mobile-final`, and `68-period-writer-mobile-after`. All five have zero captured API 4xx/5xx, page errors or attempted business writes. Desktop document widths equal 1440px and mobile widths equal 390px. The actuals empty messages are fully visible; the writer's evidence table scrolls inside its fieldset; the ledger explanation is visible on both sizes. The mobile header remains dense and chart-axis labels are cramped, with the accompanying waterfall data table retaining readable values; these are remaining presentation refinements.

An independent guarded browser probe in `period-retention-probe/` confirms unfinished quantity/reason fields survive section changes, committed navigation to the period grid, browser Back and explicit Restore. Dismissing the native reload warning leaves both fields intact. Playwright's reload navigation promise waits after dismissal and reaches its bounded 10-second timeout; this is recorded separately from the successful UI retention assertions. `result.json`, six stage screenshots/DOM snapshots and `trace.zip` retain the evidence. The parent's isolated business-flow campaign supplies the separate command/role acceptance; its final outcome is reported by the parent.

## Secondary populated details

The parent captured and directly inspected nine additional states in
`secondary-details/` (70–78): quarantine detail, source mapping and Extruder1
asset detail on desktop/mobile, plus approved FX, active rule and user detail on
desktop. All nine documents fit their 1440px/390px viewport and report no page
errors or HTTP error responses. No business command was submitted.

Quarantine has a clear problem/resolution/technical-detail hierarchy. Its raw
payload disclosure was subsequently opened in `raw-detail/81-quarantine-raw-mobile`
and remains contained at 390px. Source mapping is one cohesive rule form with
secondary test resolution collapsed; asset identity and equipment fields likewise
remain one task, with attributes/mappings collapsed. FX detail is short and clear.
None of these captures justifies another route split.

The rule capture initially blocked the automatic `POST /v2/rules/validate` in the
read-only browser guard. The controller explicitly marks this operation read-only
and stores nothing. `secondary-recheck/79-rule-validated` allows only that endpoint,
returns 200 and visibly reports three valid conditions. The initial spinner was a
capture restriction, not a product failure. A first raw-payload click used the
wrong role locator; the successful retry used the observed native summary element.
Both original failures remain in the evidence.

Two smaller clarity observations are separate from decomposition: the rule's Unit
condition currently displays comma-separated UUIDs (a future entity-picker task),
and an empty user-scope table incorrectly implied no access despite a system role.
The latter copy is changed to “No plant roles listed”, explaining that organization
or system roles may still provide access. This does not alter authorization.

## Confirmed repairs, separately from design recommendations

### Approved RCA restructuring: rendered review

The overview now retains progress and workflow with saved definition/team facts; `/rca/:caseId/definition` holds the existing editor. Five case sections and all former child routes remain. New definition/back/section links preserve query parameters. The definition's retained memory keeps its original rowVersion and plant timezone, offers explicit restore/discard and survives SPA leave/return. Reload/close warning, scope cleanup and capacity bounds match the approved period approach. Existing team locks and write/transition capabilities remain unchanged.

Action summary metadata and status/verification controls remain visible. “Evidence & effectiveness” and “Add action” use native disclosures; their fields stay mounted through close/reopen. This does not add cross-route persistence to action forms. A pre-existing invalid paragraph/Badge nesting warning in Workflow was also removed with a layout-equivalent container.

Source checks pass: **9 files / 66 RCA tests**, full frontend typecheck, area/App lint **0 errors / 15 existing warnings**, plus a focused **7/7** route recheck after the final trailing-slash normalization. Logs are `rca-stage-tests-final.log`, `rca-stage-typecheck-final.log`, `rca-stage-lint-final.log`, `rca-stage-final-route-review.log`.

All nine intended states were freshly captured and directly inspected on the isolated stack: five successful captures in `rca-stage/` and four in `rca-expanded/`. Latest outcomes are **9 passed, 0 failed**; all have zero API 4xx/5xx, page errors or business-write attempts. Mobile documents remain 390px wide. The initial `rca-stage/` attempt retains three summary-selector failures and one bounded 15-second plant-banner timeout. Native summaries were subsequently selected through their actual `summary` element. The banner timeout recorded profile200 and tenant200 but no completed organizations response; the unchanged-wait recheck passed, and no root cause is established from that limited capture. The helper now saves failure DOM/PNG for future diagnostic attempts.

| Fresh evidence | Direct visual finding |
|---|---|
| `rca-stage/70-rca-overview-desktop.png` | Desktop overview is 1380px tall versus the previous1972px. Progress, workflow, definition/team facts remain visible; edit controls are reached through the dedicated link. |
| `rca-stage/71-rca-overview-mobile.png` | Shared navigation and facts fit390px. Confirmed inherited readability defect: the workflow's fixed12rem label column squeezed values into narrow lines. A scoped responsive list repair now stacks label/value at mobile widths; the final nine-state review below confirms the repair. |
| `rca-stage/72-rca-definition-desktop.png`, `rca-expanded/73-rca-definition-mobile.png` | Definition fields, plant-date input, charter/root cause and locked team are preserved on a focused editor. The unchanged case has Save disabled; the locked-team explanation is explicit. |
| `rca-stage/74-rca-actions-desktop.png`, `75-rca-actions-mobile.png` | Desktop action summary fits900px versus1477px before. The title, owner, due date, status and verification remain visible, with clear disclosures for details and creation. |
| `rca-expanded/76-rca-action-expanded-desktop.png`, `77-rca-action-expanded-mobile.png` | Expanded completion evidence, baseline criteria, correction entry point, effectiveness and realized values remain readable. Mobile form controls fit the page. |
| `rca-expanded/78-rca-add-action-mobile.png` | New-action fields remain within390px. The disclosure reveals the complete existing form rather than splitting its atomic command. |

The responsive WorkflowFacts repair passes targeted lint with no errors (`rca-mobile-fix-lint.log`). Final `rca-stage-final/` captures subsequently verified that repair; see the final acceptance section below. Parent-owned real-API role/command tests remain separate from these read-only layout assertions.

### Unavailable event tab

Files: `src/features/event-hub/components/event-detail-tabs.tsx` and its new `.test.tsx`.

The selected tab now falls back to Values when a non-downtime event receives `repair` or `related`. Downtime deep links still select their existing panes. Changing tabs continues to preserve unrelated query parameters. No endpoint, event classification, permission, or URL-state contract changed.

Six focused component cases pass: three invalid/unavailable values, two valid downtime links, and preserved query state when leaving fallback. After deployment, `after/54-nonstop-repair-after.png` and `after/55-nonstop-related-after.png` show Values selected with populated source/effective columns on desktop and mobile. Both full screenshots were directly inspected; the before screens are retained.

### Attribute return level

Files: `src/features/admin/attributes/attribute-form-page.tsx`, `attribute-navigation.test.tsx`.

Back and Cancel use the original form/entity level; direct edit links use the stored attribute's level. Delete return uses that same entity level. Successful save behavior was already level-aware and remains so. Invalid create-level parameters retain the existing Unit default.

Six focused component cases pass: four supported hierarchy levels, a direct stored-Asset edit link and an invalid-level fallback. After deployment, `after-recheck/56-attribute-cancel-after.png` shows the Assets list and `57-attribute-back-after.png` shows Organizations. Both were directly inspected, with matching destination URL, settled heading and empty-list text. No attribute was saved or deleted during the audit.

The initial six after captures passed five content checks and failed one because the capture read the outgoing form DOM immediately after client navigation. Both original attribute PNGs already show the correct destination, and the API returned the correct entity-level list. The capture helper now waits for the destination heading, outgoing heading removal and list content. The two rechecks passed unchanged product behavior. Original `after/56-attribute-cancel-after.json` retains that harness timing failure. Latest outcomes across the six intended checks: **6 passed, 0 failed**. Recorded API responses have no 4xx/5xx, no page errors or business-write attempts. Mobile whole-page widths remain 390px. `after/52-plan-summary-after.png` and `53-plan-mobile-after-viewport.png` show the corrected 14,400.00 target with explicit profile-unit context and no misleading unknown-unit warning; both were directly inspected.

Validation: **12/12 focused tests passed**, `detail-navigation-unit.log`; targeted ESLint **0 errors**, with the existing `AttributeEditor` complexity warning. Complete frontend typecheck (app, node and E2E projects) **passed**, `detail-navigation-typecheck.log`. The initial attribute test attempt failed because JSDOM lacks `ResizeObserver`; adding the standard local stub resolved the test-environment error. This was not a product runtime failure.

## Dynamic-route inspection status

| Existing pattern | Current follow-up evidence |
|---|---|
| `/events/:eventId` | Fresh downtime detail, quality-loss invalid-tab states; latter directly inspected. |
| `/events/:eventId/edit` | Source dependency review only; preserve local draft, restored/server-change warnings, 400ms affected-period preview and 412 conflict dialog. |
| `/planning/plans/:planId` | Fresh desktop/mobile, inspected. |
| `/planning/plans/:planId/versions/new` | Source inventory only; no new version created. |
| `/planning/plans/:planId/versions/:version/edit` | Source inventory only. |
| `/planning/profiles/:profileId` | Fresh desktop/mobile, desktop inspected. |
| `/planning/profiles/:profileId/edit` | Source inventory only. |
| `/planning/calendars/:versionId/edit` | Fresh published version, inspected. |
| `/plans/:planId` | Fresh populated period grid captured. |
| `/plans/:planId/periods/:periodId` | Fresh approved desktop/mobile, inspected. |
| `/plans/:planId/periods/:periodId/adjustments/new` | Source inventory only; existing form retained in plan. |
| `/plans/:planId/periods/:periodId/dispositions/new` | Source inventory only; existing form retained in plan. |
| `/rca/:caseId/*` | Final overview, dedicated definition and collapsed/expanded action desktop/mobile states inspected (nine captures). Earlier evidence list is empty. Other analysis/evidence/recommendation editor states remain outside this visual pass. |
| `/rca-knowledge-base/:entryId` | Fresh populated entry captured. |
| `/connectivity/connections/:connectionId` | Fresh MQTT subscription/profile/quarantine and mobile; inspected. MQTT job status is present. |
| `/connectivity/connections/:connectionId/edit` | Source inventory only. |
| `/connectivity/connections/:connectionId/signals/new` | Source inventory only; no PI connection in final seed. |
| `/connectivity/quarantine/:exceptionId` | Populated desktop/mobile detail and expanded mobile raw payload inspected in secondary-details/raw-detail. |
| `/connectivity/mappings/:mappingId` | Populated desktop/mobile mapping detail inspected in secondary-details. |
| `/master-data/units/:unitId` | Fresh populated unit detail, inspected. |
| `/master-data/assets/:assetId` | Extruder1 desktop/mobile detail inspected; expanded custom-attribute states remain unverified. |
| `/master-data/products/:productId` | Source inventory only. |
| `/master-data/rca/templates/:templateId` | No active template in fresh list response; populated detail unverified. |
| `/master-data/rca/checklists/:checklistId` | No active checklist in fresh list response; populated detail unverified. |
| `/codes-admin/rules/:ruleId` | Detail and completed nonpersisting validation inspected; UUID-list input remains an optional clarity task. |
| `/codes-admin/:library/:codeId` | Populated reason-code parent list captured; detail outside this visual pass. |
| `/finance/policies/:policyId` | Fresh approved version, inspected. |
| `/finance/fx/:fxId` | Approved FX detail inspected on desktop; mobile/retirement state remains unverified. |
| `/users/:userId` | Desktop user detail inspected; explicit-grant empty-state wording repaired. Final release recheck passed in `release-final-details/`. |
| `/admin/attributes/:attributeId` | No Asset definition in fresh list response. Real create/Cancel issue verified; edit route tested with an isolated component fixture. |
| `/tasks/:taskId` | Fresh cancelled task detail captured. |
| `/audit/:entryId` | Fresh login audit entry captured. |

The plan also inventories every static route, including create forms and governance/settings pages. Source-status and source-authority lists were freshly captured in batch `discovery-two`; their dialogs and maker/checker transitions were not exercised here. The review does **not** claim every dynamic record, drawer, loading/error state or user persona has been visually verified.

## Completed acceptance and remaining coverage limits

The source stages and isolated workflow campaigns are complete. The later structural browser campaigns establish **49 unique checks with their latest result passing**, not one clean run (`ui-structural-effective-summary.json`). A continuation reused the fixture output directory and cleared prior images/traces; its JSON report and extracted session-network summary remain. The month-close/MQTT images were freshly recaptured separately. Do not claim the lost original visual/trace evidence was preserved.

Combined frontend regression passed **161 files / 981 tests**, full typecheck and lint **0 errors / 228 warnings**. Later scoped month-close repairs passed 39 focused tests and the organization-administrator gate repair passed 69 focused tests; these are separate focused campaigns. Backend compatibility is **173/173 suites / 990/990 tests passing at their latest execution** after the exact seven-suite / 35-test rerun, not a fresh full green run. See the [follow-up report](HDPE_FOLLOWUP_REPORT.md) for provenance and limitations.

The [five manuals](HDPE_FOLLOWUP_REPORT.md#manual-set-and-source-coverage) cover 95 page groups, 2,080 field entries and all 95 current route declarations. Final document structural and visual acceptance is complete, including the 52-person responsibility guide. Source coverage does not prove every runtime or accessibility state.

**Release receipt complete:** frontend commit `2f385d2` deployed on 8070; SQL/API acceptance passed; six final month-close browser cases passed. Parent inspected eight release captures and previous-month 390px overview/proposals; the Reason column is 256px and readable after local horizontal scrolling. Three additional live organization-administrator screens passed read-only checks. See the [full release receipt](HDPE_FOLLOWUP_REPORT.md#completed-release-receipt) for image digest, build and evidence paths. Final manual visual QA is complete. No additional structural work is implied. Accessibility conclusions cover the tested structure/layout and recorded keyboard cases, not a complete WCAG or assistive-technology audit.

### Final RCA rendered acceptance — 16 October 2026

The refreshed isolated frontend (image digest prefix `86fd4dc1`, port 8071) was checked in a new nine-state campaign: `test-results/hdpe-followup/rca-stage-final/index.json`. All nine states passed with the unchanged 15-second readiness bound. Each saved PNG was opened and visually inspected: overview desktop/mobile, definition desktop/mobile, actions collapsed desktop/mobile, action evidence expanded desktop/mobile, and Add action expanded mobile.

The repaired Workflow facts now stack labels above values at 390px; desktop retains aligned columns. Definition controls, locked team presentation, action summaries, completion fields, baseline/effectiveness content, and the Add action form remain readable. Document width equals viewport width in all nine states (390px mobile, 1440px desktop). Recommendations retain the existing locally scrollable table; descendants beyond that table's viewport are intentional local horizontal scrolling, not page overflow. All nine captures recorded zero JavaScript page errors, zero API HTTP errors, and zero business writes. Final trace: `test-results/hdpe-followup/rca-stage-final/trace.zip`.

Earlier attempts and their evidence remain in `rca-stage` and `rca-expanded`; the earlier mobile definition readiness timeout has not reproduced in this final campaign, and no root cause is asserted. Native disclosure selectors were corrected in the capture helper; that was a capture-selector issue. This rendered acceptance covers the nine recorded seeded states, not every role or possible RCA business transition; the parent's independent real-API workflow campaign supplies mutation/permission evidence.

### Final month-close and MQTT rendered review — 16 October 2026

All **26 PNGs** from `ui-final-visual-artifacts/` were directly opened: 20 month-close states (current/previous month × five sections × desktop/mobile) and six MQTT states (collapsed/expanded profile and subscription × desktop/mobile). The corresponding `ui-final-visual.json` campaign passed eight cases with no skips or flaky results.

The MQTT editor preserves one draft/save transaction across its four groups; health remains prominent and subscription technical facts are disclosed separately. The six captured states have no actionable visual defect. The isolated connector's inactive/expired-lease state is explicit; these screenshots do not certify an active external feed.

Month-close review found two concrete defects: the previous month's proposal Reason column was squeezed to near-character width at 390px, and locked-month guidance still instructed users to resolve proposals before closing. The source now supplies bounded column widths inside the existing scrolling table and directs locked-month proposals through the after-close correction workflow. Three focused files / 39 tests, full typecheck and changed-file lint pass (`month-close-visual-fixes-*`). The before image `previous-390-proposals.png` is retained; final rendered width acceptance is complete in `release-final-details/proposal-reason-mobile.png`: Reason is 256px wide and readable after scrolling within the table, while the document stays 390px wide. Locked-month copy is also accepted. These repaired findings are not concealed by the earlier passing layout checks.
