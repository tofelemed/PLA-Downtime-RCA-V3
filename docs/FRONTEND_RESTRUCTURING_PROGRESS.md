# Frontend restructuring execution

The owner approved `FRONTEND_RESTRUCTURING_PLAN.md` on 16 October 2026. This file
tracks execution separately from the design proposal and the preceding HDPE defect
campaign.

| Stage | Owner | Current state |
| --- | --- | --- |
| Period accounting | UI subagent + parent verification | Implemented and validated; 80 focused tests and 26 browser tests, latest result per test |
| Month close | Session/UX subagent + backend visual repair | Source complete; 39 focused tests; isolated browser checks passed; 20 captures inspected; final proposal-width recapture accepted |
| RCA overview/actions | UI subagent + parent verification | Source complete; 66 focused tests; isolated browser checks passed; nine final captures inspected |
| MQTT profile/status | Backend/integration subagent + parent verification | Source complete; 49 focused tests; isolated browser checks passed; six final captures inspected; single draft/save owner retained |

All four approved source stages and the local release are complete. Isolated and
live read-only acceptance are recorded below. The five manuals are also complete.

## Approved pilot implementation detail

The application uses `BrowserRouter`, which does not support React Router's data
router blocker. The existing period editor also forbids browser-storage drafts.
Keep the editor mounted during section changes and retain pending drafts in memory,
keyed by user, plant, period and revision. Back/Forward can leave the page; returning
offers explicit restore/discard. Refresh/close must warn about pending drafts.
Restore must preserve the original server version/run and existing rebase/conflict
behavior. Identity/plant changes must not leak drafts. This resolves the plan's
unsaved-work requirement without a router migration, storage-policy change or
global history interception.

## RCA implementation boundaries

- Existing `OverviewPage` combines progress, workflow and definition/team fields.
  Move the unchanged definition command into a dedicated `/definition` child page,
  keep a compact read-only definition/team summary and workflow on the overview.
- Preserve the five existing section routes and every evidence, analysis and
  recommendation route. The new definition route needs a contextual back link and
  visible active-parent navigation.
- Keep definition drafts in the persistent case workspace, including original
  row-version context. A navigation/failed save must not silently discard changes
  or overwrite newer server content. The workflow remains the sole status writer.
- On the actions page keep title/type/owner/due/status/verification visible. Reveal
  evidence/baseline/effectiveness in accessible expandable content whose form state
  remains mounted. Keep new-action fields behind Add action; hiding them preserves
  entered values. Do not change closed-case/team locks or existing write gates.

## MQTT implementation boundaries

The payload editor already has a single `useProfileDraft` owner and one merge-patch
save; retain that transaction. Group identity/schema, timestamp/quality, overrides
and value maps. Hidden fields retain values and validation errors reveal the
affected group. Keep save/status visible and the exact patch/connection-version
semantics. Subscription health and last observation remain prominent; technical
identifiers can collapse. PI/job/replay changes require their own populated evidence.

## Rollout record

The first pilot established the shared pattern before the other high-priority pages
started. Subsequent pages have independent feature ownership and separate validation
and commits; each records focused tests, typecheck/build, desktop/mobile inspection
and affected persona checks before release. Successful business mutations use
isolated fixtures; read-only live checks retain the final HDPE plant.

Period validation: `period-pilot-tests-final.log` (16 files / 80 tests), full
typecheck, two Linux image builds and targeted lint with zero errors. Browser
campaign `ui-pilot.json` had 17 passes, three failures and six blocked tests. One
fixture connection closed during product creation; a stale Demo Org test label and
two automation navigation waits were repaired. The original failed evidence is
retained. `ui-pilot-fixed.json` passed 13 of 14 and `ui-pilot-draft-final.json` passed
the remaining draft test, establishing **26 unique affected checks passing** across
their latest executions. This is not described as a single clean 26-test run.

All ten section screenshots and five subsequent repair captures were inspected.
The editable evidence picker now fits 390px instead of expanding the page to 640px;
empty actuals messages remain readable. An independent browser probe confirms
section retention, committed grid navigation/Back/Restore and a dismissed reload.
Calculation-run figures are explicitly distinguished from reconciled saved lines.
The dense shared mobile header remains a presentation observation. A subsequent
DOM measurement traced the populated grid's 9px overflow to its revision selector;
its label and select now respect the available width, with a browser assertion
added to the retained-draft journey. The final isolated workflow and release
acceptance evidence are recorded below.

## Combined verification and rendered review

- Frontend combined regression: **161 files / 981 tests passed**, zero failed or
  skipped (`frontend-structural-final.json`). Full application, tooling and E2E
  typecheck passed. Full lint reports **0 errors / 228 warnings**
  (`frontend-lint-structural-final.json`). These warnings remain technical debt.
- The later structural browser campaigns establish **49 unique checks with their
  latest result passing** (`ui-structural-effective-summary.json`). This combines
  repair campaigns; it is not one clean 49-test run and is not added to the earlier
  26-check period pilot as an independent total.
- A continuation reused the fixture output directory and cleared the previous
  images/traces. The JSON report and extracted session-network summary were
  retained. Month-close and MQTT images were freshly captured in a separate
  directory; the missing original image/trace evidence is not claimed retained.
- All nine final RCA PNGs in `rca-stage-final/` were directly inspected. All 26 PNGs
  in `ui-final-visual-artifacts/` were also directly inspected: 20 month-close
  section states and six MQTT profile/subscription states at desktop/mobile sizes.
  The RCA mobile workflow repair and MQTT grouped editor/technical disclosure are
  accepted for those captured states.
- Month-close review found a squeezed proposal Reason column at 390px and
  pre-close instructions on a locked month. Scoped column widths and locked-month
  after-close guidance are repaired. **Three files / 39 tests**, full typecheck
  and changed-file lint pass (`month-close-visual-fixes-*`). The original
  `previous-390-proposals.png` is retained; the final 256px Reason-column
  recapture is accepted, with contained horizontal scrolling at 390px.

The backend dependency compatibility campaign is closed with **173/173 suites and
990/990 tests passing at their latest execution**. The original full run had seven
failed suites; those exact seven passed **35/35 tests** in a quiet rerun with no
product or assertion change. This is not a fresh full green run. See
`backend-integration-effective-summary.json` and `integration-diagnostics.md`.
The intermittent connection failures have no proven root cause.

## Manuals and release receipt

The five manuals and final source-inventory coverage are linked in
[HDPE_FOLLOWUP_REPORT.md](HDPE_FOLLOWUP_REPORT.md). The inventory covers
95 page groups, 2,080 field entries and all 95 route declarations. Structural and
visual acceptance is complete, with final hashes and review provenance below.

### Completed release receipt

Release completed from local commit `2f385d2`. The frontend image `proact-frontend:hdpe-structural-final-20261016` (`sha256:2f1f3dd39ab3c59aceaea056b7332c3f55098afa37fe237a96dd538fa7e79747`) was deployed to the live 8070 frontend; this release replaced only the frontend service. Build evidence: `structural-final-build.log`; image receipt: `deployed-frontend-image.txt`. Read-only hierarchy, permission, accounting, month-close and MQTT SQL/API acceptance passed in `acceptance-structural-release.log`.

The final month-close browser campaign passed **6/6 cases**, zero skipped/flaky (`structural-release-final.json`). Eight read-only captures in `release-copy/` (3), `release-orgadmin/` (3) and `release-final-details/` (2) passed with no errors or business writes; the parent directly inspected all eight and the previous-month 390px overview/proposals. The Reason column is 256px wide and readable after scrolling inside the table; the page remains 390px wide. Locked-month guidance, Audit/Tasks summary scope and explicit plant-grant wording are accepted. Three additional live 8070 organization-administrator captures in `release-live/` passed: plant form, audit and locked-month proposals, with no business writes. Evidence paths in this receipt are under `test-results/hdpe-followup/`.

All five manuals have completed structural, field-content and visual acceptance. The set contains 592 rendered pages, 95 page groups, 2,080 field/display entries and all 95 route declarations. The responsibility guide covers 52 named HDPE personas, 35 workflow families and nine worked handoffs. Every original page and every changed page body was individually inspected; unchanged body hashes retain their earlier review and every final PDF footer was checked. Final image evidence is under `test-results/manual-qa/accepted/`; committed document/source hashes and per-page review provenance are in `docs/manuals/verification.json` and `docs/manuals/verification-pages.json`.
