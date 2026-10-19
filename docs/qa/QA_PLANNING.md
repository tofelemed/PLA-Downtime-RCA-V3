# QA audit: Plans, Profiles & Calendars, period accounting, month close (agent PLANNING)

Run: 19 Oct 2026, 12:10–13:00 Tehran (08:40–09:30Z), plant Marun › HDPE plant (HDPE-TRAIN).

Method:
- Headless Playwright (the repo's `playwright` and `@axe-core/playwright`). Each run used its own browser and logged in through the UI form.
- Personas: Leila, Sara, Reza, Maryam, Neda, Omid, Kamran and admin (SuperAdmin).
- Viewports: 1440×900, plus a 768×1024 pass as Sara (11 pages) and Reza (month close).
- Safety net: every script intercepted all mutating API calls (POST/PUT/PATCH/DELETE) and aborted them. Only login/refresh and `POST /v2/exports` were let through. The net was hit once, by the plan "Create version" check (see P-3); nothing else was sent.

Evidence lives in `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\planning\`:
- `shots\*.png`: screenshots;
- `results.jsonl`: one capture per page, with URL, title, h1, headings, axe, console, failed requests, uuids, snake_case words and horizontal scroll;
- `roles-pass.txt`: the 8-role matrix;
- `dl\`: the downloaded CSV and PDF exports.

Paths below are relative to that folder.

## Summary

| Result | Count |
|---|---|
| Pages / tabs / dialogs captured | 182 (8 roles; `results.jsonl`). The only console errors are 4 `net::ERR_FAILED` caused by this audit's own interception of the "Create version" POST |
| Table rows PASS (including the 9 data checks) | 50 |
| Table rows FAIL | 7 |
| Table rows WARN | 30 |
| Distinct findings: Critical | 0 |
| Distinct findings: High | 1 (P-0, which appears in 3 rows) |
| Distinct findings: Medium | 8 (P-1 change-proposal figures, P-2 restatement panel without money, P-3 new version without a reason, P-4 operator dead links, P-5 no required markers or dirty guard, P-7 hidden finance steps, P-14 toast a11y, editable decided posting) |
| Distinct findings: Low | about 22 |

The numbers are all correct:
- Grid: A 189 / gap 35, B 223 / 1, C 209 / 15; day 621 of 672, loss 51, Unaccounted 0 everywhere.
- Value: Shift A USD 5,250.00 and IRR 3,150,000,000; B USD 150; C USD 2,250; the day sums to USD 7,650.
- Derivations: the applied rate reads "Planning rate 28.00 t/h"; the RCA chip shows "RCA completed".
- Coding gates: Shift A 100 %, Shift C "0 % … 1 uncoded", day "2 stops, 1 uncoded · 66.7 %".
- Exports: the CSV and PDF hold approved revision 3 at contribution margin (450 + 4,200 + 600 = 5,250).

The pages are also clean:
- 0 console errors and 0 failed API requests (status 400 or higher) on every page in the area.
- axe found no serious or critical violations, except on the toast shown by the `/period-accounting` redirect (P-14).
- No "demo" text, no raw UUIDs and no snake_case words on screen.
- No horizontal page scroll at 768 px.

### Top findings

1. **High — The 18 and 19 Oct periods have no plan, so My work and Month close point to records nobody can open.** Sara's and Leila's My work lists "Prepare and submit · HDPE Extruder 1 · 2026-10-18 · A/B/C" (due today 18:00), but the rows have no link: `selected_plan_version_id` is null for every period after 17 Oct, and the only plan covers 17 Oct. Month close › Periods lists the same 4 periods (and Days lists 2 days) as blocking prerequisites, again without links. No screen says "no approved plan covers these periods: create a plan version". So the month cannot be closed from the UI, and the work items are dead ends.
2. **Medium — Change proposal Before/After is a dump of internal fields.** It shows about 40 rows such as "Reconciliation · uom t", "Reconciliation · unadjusted residual" (the glossary forbids "residual"), "Capacity ledger · exclusion" and "over accounted", with no units and no ordering. It also mixes ledgers: "Plan ledger · unaccounted 4" sits next to "Reconciliation · unaccounted 0" in the same snapshot.
3. **Medium — A value-only restatement shows "no change".** The Review & close restatement panel for Shift A ("Restatement of approved revision 2", posted as a correction) lists only quantities, all with change 0.00. The actual change (USD 5,040 economic default → USD 5,250 contribution margin) is shown nowhere. The same happens on B and C.
4. **Medium — Operators see links they cannot follow.** Omid's period page (Actuals & quality only) shows "Approval, holds and day certification: Review & close", which redirects back to Actuals. Its breadcrumb "Plans, Profiles & Calendars" ends on "No access".
5. **Medium — Forms have no required markers and no unsaved-changes guard.** This covers New plan, Create new version, New profile version, Record/Correct disposition, Propose adjustment and the calendar editor. After typing, Cancel leaves without asking. There are no asterisks and no `required` / `aria-required` attributes, although a missing name, unit, window and so on are rejected inline after Save.
6. **Medium — "Create new version" sends without a change reason or a confirmation.** The form is pre-filled from version 1 with an empty Change reason. "Create version" passed client validation and sent `POST /v2/production-plans/:id/versions`, which this audit's safety net intercepted. New plan, by contrast, validates.
7. **Medium — Month close hides the finance steps.** For Kamran (finance_approver) the Sign-offs card shows only "Finance sign-off: not yet"; there is no disabled "Sign off…" or "Lock…" button with a reason. Reza sees "Close quantities…" disabled with a clear reason ("Month ends 2026-10-23 06:00 … not ended yet" and "11 expected periods do not exist yet"), so gap G1 from the E2E report is fixed.
8. **Medium — A decided restatement posting stays editable.** Kamran and admin see an editable "Posting date / Treatment / Save posting" form on Shift A's posting, which is already decided. There is no confirmation and no "decided by" name, and the posting has already been overwritten once (row_version 2).
9. **Low/consistency.**
   - Title capitalisation drifts. The menu has "Plans, Profiles & Calendars", "Month Close" and "Measurement Uncertainty", but the page h1/title reads "Plans, profiles & calendars", "Month close" and "Measurement uncertainty". The no-access page uses the menu form, and the PLA menu item is "Period accounting".
   - The period h1 "Extruder1 HD5502 — 17 Oct 2026 · period" does not name the shift; several open tabs cannot be told apart.

## Results by page

Legend: PASS = all checks OK; WARN = works, with a usability or consistency defect; FAIL = wrong behaviour, a dead end or missing function.

### Plans, Profiles & Calendars (`/planning`)

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| `/planning?tab=plans` (also the `/production-plans` redirect) | Leila, Sara, Reza, Maryam, Neda, Kamran, admin | menu, h1/title, tabs in URL, filters, row → plan, axe, console, 768 | PASS | The list shows one plan, "Extruder1 HD5502 — 17 Oct 2026", version 1 Approved, with its window in plant time and a "Periods" link. "New plan" appears only for plan writers (`canWritePlans`). The tab is kept in `?tab=` | shots/leila-planning-plans.png | — | — |
| `/planning` (all tabs) | all | heading style | WARN | The h1 and title read "Plans, profiles & calendars", while the menu, breadcrumb and no-access page read "Plans, Profiles & Calendars" | results.jsonl `*-planning-*` | Low | One label source (`navigation-items.ts` vs `planning-page.tsx`) |
| `/planning` | Omid | refusal | PASS | No menu item; a direct URL shows "No access — Your roles in this plant do not include Plans, Profiles & Calendars." | shots/omid-roles-planning.png | — | — |
| `/planning?tab=profiles` | Leila, Reza | list, filters, row → profile | WARN | The Operating mode column shows the raw value "normal" (lower case; also in the profile subtitle "Operating mode normal · version 1") | shots/leila-planning-profiles.png | Low | Label the operating mode |
| `/planning/profiles/:id` | Leila, Reza | rates, valuation rates, versions, actions | PASS | Sustained and Planning 28.00 t/h (0.00777778 t/s); valuation: contribution margin 150.00 USD/t, downgrade 80.00 USD/t; all Approved. Reza gets "Add rate version" (inline form; Cancel closes it) and "Retire" (not clicked). Leila's Actions columns are empty | shots/leila-profile-detail.png, reza-wf-rate.png | — | — |
| `/planning/profiles/:id` | Leila | empty Actions column | WARN | A read-only user still sees the "Actions" header with empty cells | shots/leila-profile-detail.png | Low | Hide the column when the user has no actions |
| `/planning?tab=transitions` | Leila, Reza | unit picker, empty state, form open/cancel | PASS | "No transition standards — Every grade change of this unit counts as loss, flagged 'no transition standard'." Reza: "Add transition standard" opens an inline form with 10 labelled fields; Cancel closes it | shots/leila-planning-transitions-unit.png, reza-wf-transition.png | — | — |
| `/planning?tab=transitions` / `streams` | all | URL state | WARN | The chosen unit is not kept in the URL (`?tab=transitions` only), so a reload drops the selection | — | Low | Put `unit=` in the search params like the grid filters |
| `/planning?tab=streams` | Leila, Reza | empty states, form open/cancel, disabled reason | WARN | Empty states are worded well ("The unit is one stream…"). "Add stream" opens and cancels. **"Record run" is disabled with no reason** (no title or description; the cause is that there is no stream) | shots/reza-wf-stream.png | Low | Add a disabled reason ("Add a stream first") |
| `/planning?tab=calendars` | Leila, Reza | versions, crews, rotations | PASS | Version 1, Site calendar, Asia/Tehran, 2026-10-17 → open-ended, 3 shifts, Published. Crews A/B/C; rotation "A,B,C" from 2026-10-17. "Add crew" and "Add rotation" stay disabled until their inputs are filled (acceptable) | shots/leila-planning-calendars-crewA.png | — | — |
| `/planning/calendars/:id/edit` (published) | Leila | read-only view | WARN | A published version opens on an `/edit` URL as a read-only view ("Published versions cannot be changed…"). There is no Cancel/Back button, and "Run preview" is disabled with no reason until a unit is chosen | shots/leila-calendar-version.png | Low | Route `/planning/calendars/:id` for viewing; add a reason |
| `/planning/plans/:planId` | Leila, Reza | detail, versions, links | PASS | Version 1 Approved, quantity-based, header 672.00, window 06:00 → 06:00 (+03:30), approved 2026-10-18 16:00 by Reza with its reason. Links: Period accounting, Create new version | shots/leila-plan-detail.png | — | — |
| `/planning/plans/:planId` | all | units | WARN | "Header target: 672.00 (in the unit of each slice's profile)" has no unit, and the slice row shows Weight "—" and Slice target "—" | shots/leila-plan-detail.png | Low | Show "672.00 t" when all slices share a unit |
| `/planning/plans/new` | Leila, Reza | labels, validation, cancel | WARN | Inline validation works (name, unit, window start and end, header target, product). But no field is marked required, and Cancel leaves without asking after text was typed (no unsaved-changes guard) | shots/leila-form-new-plan.png, leila-validate-new-plan.png | Medium | Required markers and a dirty-form guard (shared form kit) |
| `/planning/plans/:id/versions/new` | Leila, Reza | validation | FAIL | (P-3) Pre-filled from version 1, with Change reason empty. "Create version" passed client validation at once and sent `POST /v2/production-plans/274b…/versions` (intercepted; nothing created). There is no confirmation and no required reason. The Unit select stays editable on a new version while Name is locked | console `BLOCKED ["POST …/versions"]`; shots/leila-validate-new-plan-version.png | Medium | Require a change reason on a new version; lock the unit |
| `/planning/profiles/new` | Leila (not a profile writer) | gate | WARN | The tab hides "New profile" from Leila, but the direct URL renders the full form with an enabled "Save draft". The server would refuse with 403 after the user fills it in | shots/leila-form-new-profile.png | Low | Route gate `canWriteProfiles` (as for periods) |
| `/planning/profiles/new` | Reza | validation, cancel | WARN | Inline errors for unit, product, quantity unit, timebase and start. No required markers; no dirty guard | shots/reza-validate-new-profile.png | Medium (with P-5) | as above |
| `/planning/profiles/import` | Leila, Reza | form | WARN | "Import" stays disabled until a file is chosen (no reason given), and there is no Cancel or Back other than the breadcrumb | shots/leila-form-rate-import.png | Low | Add a reason and Cancel |
| `/planning/calendars/new` | Leila, Reza | form | WARN | Leila (not a calendar writer) gets the full editor without a Save button and without saying why. For Reza, Save validates ("Enter the first operational date"). Neither has a Cancel | shots/leila-form-new-calendar.png, reza-wf-calendar.png | Low | Gate the route or show a read-only notice; add Cancel |

### Period accounting entry and period grid

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| `/period-accounting` | Leila, Sara, Reza, Maryam, Neda, Kamran | redirect | PASS | Redirects to `/planning?tab=plans` with the toast "No plan has an approved version valid today. Choose a plan and open its 'Periods'." This is correct: the only plan covers 17 Oct | shots/sara-period-accounting.png | — | — |
| `/period-accounting` | Sara | a11y | WARN | (P-14) axe on the page with the toast: critical `button-name` (the toast close button `.right-2` has no name), serious `aria-hidden-focus` (2) and `list` (the breadcrumb `ol`) | results.jsonl `sara-period-accounting` | Medium | Give the toast close button an aria-label; fix the list markup |
| `/period-accounting` | Omid | refusal | PASS | "No access … Period accounting" | shots/omid-roles-period-accounting.png | — | — |
| menu | all | label | WARN | The PLA section item reads "Period accounting" (sentence case) next to Title Case items ("Loss Valuation", "Month Close") | shots/sara-sidebar-expanded-pla.png | Low | One case style |
| `/plans/:planId` (grid) | Sara, Reza | figures | PASS | A 224 / 189 / gap 35 / attributed 35 / Unaccounted 0, B 224 / 223 / 1 / 1 / 0, C 224 / 209 / 15 / 15 / 0. All Balanced, Complete, Reconciled, Approved, with calculated times in plant time. The legend uses the glossary terms ("Unaccounted = gap − attributed − tolerance adjustment") | shots/sara-grid.png | — | — |
| grid filters | Sara | Workflow state / Unaccounted only / Above tolerance; URL; reload | PASS | `?state=draft`, `?state=in_review` and `?residual=unaccounted` / `above` each give "No periods — No production periods match these filters." `?state=approved` gives 3 rows. All survive a reload | shots/sara-grid-filter-Unaccounted_only.png, sara-grid-filter-Draft.png | — | — |
| grid "Figures of" | Sara | URL state | WARN | "Approved revision only" is not written to the URL (`useState` in `period-grid.tsx:71`), so a reload or a shared link loses it; the other filters persist | — | Low | Keep `view=` in search params, as the period page already does |
| grid "Go to date" | Sara | in / out of window | WARN | `?date=2026-10-17` works and shows "From plan start". Dates outside the plan (2026-09-01, 2026-10-25) are accepted silently with the same 3 rows and no message; the input's min/max only bind the picker | shots/sara-grid-goto.png | Low | Clamp the date or say it is outside the plan |
| grid paging | Sara | pager | n/a | 3 periods, less than one page of 20. The keyset "Show more" path could not be exercised live | — | — | — |
| grid "Plan" tab | Sara | content, URL | PASS | `?tab=plan` shows "Version 1 · Approved", the window, the basis and "Open the plan (versions, preview, approval)" | shots/sara-grid-plan-tab.png | — | — |
| grid | Omid | refusal | PASS | "No access" | roles-pass.txt | — | — |
| grid 768 px | Sara | layout | PASS | The table scrolls inside its container; no page scroll | shots/sara-768-grid.png | — | — |

### Period workspace, 17 Oct shifts A / B / C

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| Header (all sections) | all analysis roles | h1/title | WARN | The h1 and title read "Extruder1 HD5502 — 17 Oct 2026 · period" on every shift. A, B and C are named only in the h2 window and in the previous/next buttons. The chip "Calculated2026-10-18 19:39" has no space after the label | shots/sara-periodA-reconciliation.png | Low | Put "2026-10-17 · A" in the h1/title; add the space |
| Previous / next | Sara | A, B, C | PASS | A: Previous disabled, "2026-10-17 B ›". B: "‹ 2026-10-17 A" and "2026-10-17 C ›". C: "‹ 2026-10-17 B" and Next disabled. Each keeps the current section | results.jsonl `sara-period{A,B,C}-*` | — | — |
| Revision / ledger toggles | Sara | URL, reload | PASS | `?view=approved&ledger=capacity` are kept after a reload. The capacity waterfall reads "Capacity at sustained rate 224 → −28 −4 −3 → 189, Closes to actual" | shots/sara-periodA-recon-capacity-approved.png | — | — |
| Reconciliation A: equation | Sara, Reza, Leila | figures, glossary | PASS | Target 224.00 t − Actual (good) 189.00 t = Gap 35.00 t = Attributed 35.00 t + Tolerance adj. 0.00 t + Unaccounted 0.00 t. Checks: over-accounted, overproduction, tolerance threshold all 0 | shots/sara-periodA-reconciliation.png | — | — |
| Reconciliation A: loss lines | Sara | lines, derivation, rate, RCA chip | PASS | Quality 3.00 t (measured, "no rate (not a time-based loss)"). Availability 28.00 t, with derivation "Planning rate · Plan ledger · 08:00–09:00 (1 h) · Planning rate 28.00 t/h · Event 100.0 % share", reason MECH-GEARBOX, chip "RCA completed (open the investigation)" → `/rca/f58df7af…`. Manual performance 4.00 t SPEED-LOSS with its comment. The waterfall closes to actual | shots/sara-periodA-derivations.png | — | — |
| Reconciliation A/B/C: quality line chip | Sara | wording | WARN | A disposition-based quality line (no cause event) carries an amber "Not coded" chip. That chip belongs to stop coding; here it suggests a coding backlog that does not exist | shots/crop-deriv.png | Low | Hide the coding chip on lines without a cause event |
| Reconciliation, capacity ledger | Sara | labels | WARN | With `ledger=capacity`, the equation still reads "Target" and the list heading still reads "Loss lines (plan ledger)" | shots/sara-periodA-recon-capacity-approved.png | Low | Use "Capacity" in capacity view, or say the lines are always plan-ledger |
| Reconciliation B / C | Sara | figures | PASS | B: 224 − 223 = 1, quality 1 t. C: 224 − 209 = 15; availability 14 t "Not coded" (from the 02:00 stop) and quality 1 t; Unaccounted 0 | shots/sara-periodB-reconciliation.png, sara-periodC-reconciliation.png | — | — |
| Reconciliation: "Start RCA" | Reza, Maryam | RCA writers only | PASS | Reza and Maryam see "Start RCA" on the quality and manual lines; Sara, Leila and Neda do not. The RCA-completed line has no Start button | roles-pass.txt | — | — |
| Actuals & quality A | Leila, Sara | provenance groups | PASS | "Good 189.00 t · gross 192.00 t · from Counter readings · coverage 100 % · Complete"; first-pass good 189, downgrade 3. Grouped by signal: "EXT1-Throughput · counter difference, step interpolation, counted · coverage 100 % · 480 segments (480 measured)". "Note: Rejects taken from the approved lot dispositions". No raw key (G3 fixed) | shots/leila-periodA-actuals-expanded.png | — | — |
| Actuals A: dispositions | Leila, Sara, Neda, Reza, Omid | list, states, actions | PASS | Lot A01: 3.00 t Approved (LAB-…-A-002) with "Correct this disposition…", and 2.00 t "Corrected (superseded)" with no action. Recorded by Leila (a name, not an id) | shots/sara-periodA-actuals.png | — | — |
| "Correct this disposition…" form | Leila | open, pre-fill, cancel | PASS | Opens `…/dispositions/new?supersedes=6b1cbff6…`, titled "Correct a product disposition". Product is locked; lot A01, 3 t and 06:00–14:00 are pre-filled; it says "A Quality / Lab approver who is not you approves it". Cancel returns to `/actuals`. Not submitted | shots/leila-periodA-form_Correct_this_disposition_.png | — | — |
| Record disposition / Propose adjustment forms | Leila | open, cancel | WARN | Both open with clear approver text, and Cancel returns to `/actuals`. No required markers and no dirty guard (P-5) | shots/leila-periodA-form_Record_disposition_.png, …_Propose_adjustment_.png | Medium (P-5) | — |
| Operator access (Omid) | Omid | redirects | PASS | `/`, `/review`, `/value` and `/history` all redirect to `/actuals`. Omid sees Record disposition and Correct this disposition…; back goes to "Events" | roles-pass.txt; shots/omid-roles-pA-*.png | — | — |
| Operator access (Omid) | Omid | dead links | FAIL | (P-4) The workflow strip link "Approval, holds and day certification: Review & close" stays on Actuals. The breadcrumb "Plans, Profiles & Calendars" opens "No access" | probe7 output; shots/omid-roles-pA-actuals.png | Medium | Hide both for `!canViewAnalysis` (`period-page.tsx`, the workflow-strip component) |
| Review & close A | Sara, Reza, Maryam, Leila, Neda | workflow bar, sticky, coding gate | PASS | Sticky "Revision 3 · Approved". "Stop coding complete · 1 stops: 1 with a reason … coded stop time 100 % (target 95 %) · Verified by a supervisor: 1 … failure detail validated by maintenance: 1 of 1" | shots/sara-periodA-review.png | — | — |
| Review & close C | Sara | coding gate | PASS | "Stop coding incomplete — shown as a warning · 1 stops: 0 with a reason, 0 investigation pending, 1 uncoded · coded stop time 0 % (target 95 %)", with the two issue lines | results.jsonl `sara-periodC-review` | — | — |
| Review & close | all | "Verify this shift's stops" | WARN | Disabled with no reason on A (everything is verified), and on C, where 1 stop is waiting but uncoded | shots/sara-periodA-review-expanded.png | Low | Add a reason ("All stops verified" / "Code the stop first") |
| Review & close | Sara, Reza, Maryam | Reopen dialog | PASS | "Reopen for revision…" → "Reopen this approved period? … Reason* required" → Cancel; nothing sent. Leila and Neda do not get the button | shots/sara-periodA-review-dialog-_Reopen_for_revision.png | — | — |
| Review & close | all | SLA line | n/a | Not shown on approved periods (none is in review); "To approve · Data complete" could not be checked live | — | — | — |
| Review & close: restatement | Sara | content | FAIL | (P-2) A: "Restatement of approved revision 2 … posted on 2026-10-19 as a correction"; B: "… as another adjustment"; C: "posting not decided by finance yet". All 9 rows show Change 0.00. The restatement was a valuation change (A: economic 5,040 → contribution margin 5,250 USD), and the panel shows no money | shots/sara-768-pA-review.png | Medium | Add the approved loss value (default view) before/after to the restatement figures |
| Review & close: restatement posting | Kamran, admin | posting form | WARN | The A, revision 3 posting is already decided ("posted on 2026-10-19 as a correction"; `restatement_postings` row_version 2, so it has been overwritten once). It still shows an editable "Posting date / Treatment / Save posting" form, with no confirmation and no "decided by" name. Treatment options are lower case ("a correction", "no posting"), and the posting date is a Gregorian date input on a Solar Hijri plant (known from E2E 2.4) | shots/kamran-periodA-review.png | Medium | Show a decided posting read-only, with who and when, behind an explicit "Change posting…" that asks for confirmation |
| Review & close: day panel | Sara | figures | PASS | "Production day 2026-10-17 · Day certified · A/B/C Approved · Day total (approved shifts): 621.00 of 672.00 t (3 shifts) · Day stop coding incomplete — shown as a warning: 2 stops, 1 uncoded · coded stop time 66.7 % (daily target 99 %)" | shots/sara-768-pA-review.png | — | — |
| Review & close: day panel | Sara | tone | WARN | The day coding warning is plain grey text, while the shift card uses a warning style | shots/sara-768-pA-review.png | Low | Use the same warning tone |
| Value A | Sara, Reza, Leila | frozen view, toggle | PASS | "Loss value · Commercial opportunity (contribution margin) · Approved valuation view: Contribution margin, frozen at approval under valuation policy v2." **5,250.00 USD**; the IRR toggle gives **3,150,000,000 IRR**; "Valued · Not priced 0.00 t · Approved, reconciled value". No preference write was sent | shots/sara-periodA-value-irr.png | — | — |
| Value B / C | Sara | figures | PASS | B 150.00 USD; C 2,250.00 USD; day 5,250 + 150 + 2,250 = 7,650 USD | results.jsonl | — | — |
| Value | Sara | restatement note | WARN | The Value section has no note that revision 3 restated the value (5,040 → 5,250); Review & close shows quantities only (P-2) | — | Low | Link the restatement from Value |
| History A: revisions | Sara | names, reasons | PASS | 12 rows with plant-time stamps; By reads Reza / Maryam / "you" with full reasons. Nothing is lost | shots/sara-periodA-history.png | — | — |
| History: change proposals | Sara, Maryam | triggers, before/after | FAIL | (P-1) Triggers read "Accepted Rate changed" and "Accepted Recalculated" (A), and "Event changed" ×2 plus "Rate changed" (C). Before/After are a flat list of about 40 internal fields ("Reconciliation · uom", "unadjusted residual", "Capacity ledger · exclusion", "over accounted"), with no units, and "Plan ledger · unaccounted 4" next to "Reconciliation · unaccounted 0". C's newest proposal shows "Loss value before … 2,250.00 USD" and "Loss value after: Calculated when the proposal is accepted", although it is already accepted | shots/crop-hist.png, sara-periodA-history-expanded.png | Medium | Curate the figures (target, actual, gap, attributed, Unaccounted per ledger, with units); show the accepted revision's value after acceptance (`snapshot-figures.ts`) |
| History: "Propose a correction…" | Sara | dialog open/cancel | WARN | The dialog has required markers (What is wrong*, Evidence*, Reference*) and Cancel works. Its text says "For a period of a closing or locked month … (SuperAdmin may decide their own proposal)", but Mehr is open and Sara is not SuperAdmin | shots/sara-periodA-propose-correction.png | Low | Word it for the user's role and the month state |
| History: export CSV | Sara | job, download, content | PASS | "Export ready · 3 rows · available until 2026-10-26". The CSV has a UTF-8 BOM, `status approved`, revision 3 `6fd2da61…`, `valuation_view contribution_margin`; values 450 / 4,200 / 600 USD and 270,000,000 / 2,520,000,000 / 360,000,000 IRR (sum 5,250 USD / 3,150,000,000 IRR) | dl/sara-A-traverse-forge-loss-lines-5118e7da….csv | — | — |
| History: export CSV | Sara | content | WARN | The header has `timezone,UTC` and `requested_by` as a raw uuid. The availability row has `reason_code_id` but an empty `reason`, so MECH-GEARBOX is not readable | same | Low | Add the reason code and name and the requester's name |
| History: export PDF | Sara | content | WARN | 1 page: "APPROVED", revision 3, "Loss value basis Contribution margin (valuation policy version 2)", "Exchange rates: rates frozen in the approval snapshot", 3 lines with USD 450 / 4,200 / 600. G3 is partly fixed ("Selection 1 named approved revision"). But lines show raw states ("accepted", "in force", kind "quality"), and the availability line shows no reason code (Note "—") | dl/sara-A-traverse-forge-loss-lines-1d993d46….pdf | Low | Label the states and show the reason |
| Period workspace | Neda, Kamran, Maryam, Leila, Reza, admin | console / network / axe | PASS | 0 console errors, 0 failed requests and 0 axe serious/critical on all five sections for every role | roles-pass.txt | — | — |
| Period workspace 768 px | Sara | layout | PASS | No page scroll; the tabs wrap; tables scroll in place | shots/sara-768-pA*.png | — | — |

### Month close (`/month-close`)

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| Overview | Reza | month, counts, deadlines, step buttons | PASS | "Mehr 1405 · 2026-09-23 – 2026-10-22 (Solar Hijri month)". Periods not approved 4 (3 of 7), Days not certified 2 (1 of 3), Open proposals 0. Deadlines are working day 3 (2026-10-26) and working day 5 (2026-10-28), skipping Thursday and Friday. "Close quantities…" is disabled, with "Month ends 2026-10-23 06:00 (+03:30 Asia/Tehran) — not ended yet…" and "11 expected periods do not exist yet" listed by shift (gap G1 fixed) | shots/reza-mc-overview.png | — | — |
| Overview | Kamran | finance steps | FAIL | (P-7) Only "Finance sign-off: not yet" and "Locked: not yet" as text. There is no disabled "Sign off…" or "Lock…" button with a reason, so the finance approver cannot tell what is missing or that the step is theirs | `probe4` output (Kamran) | Medium | Show the finance step buttons disabled, with reasons ("quantities not closed yet") |
| Periods / Days | Reza | drill-down | FAIL | (P-0) It lists 2026-10-18 A/B/C Draft and 2026-10-19 A Not calculated, and days 18 and 19 Oct, but the rows have no links. The overview says "Select a count to inspect its records", so the trail ends here. These periods have no plan version (see High finding 1) | shots/reza-mc-periods.png, reza-mc-days.png | High | Link each period and day, or say "no plan covers this period" with a link to New plan / Create new version |
| Proposals / History | Reza | empty states | PASS | "0 open change proposals … No change proposal is open."; "No month-close actions recorded." | shots/reza-mc-proposals.png, reza-mc-history.png | — | — |
| Month navigation | Kamran, Sara | URL, reload | PASS | "Aban 1405 →" goes to `?month=1405-08` and survives a reload. Section tabs use `?section=` | `probe4` output | — | — |
| Future month | Kamran | wording | WARN | Aban 1405 shows "Prerequisites need attention" with every count at 0 ("0 of 0 approved") | shots/kamran-mc-aban.png | Low | "Month not started" state |
| h1 / menu | Reza vs Omid | labels | WARN | The h1 reads "Month close"; the menu and no-access page read "Month Close" | results.jsonl | Low | One case style |
| `/month-close` | Omid | refusal | PASS | "No access … Month Close" | shots/omid-roles-month-close.png | — | — |
| 768 px | Reza | layout | PASS | No page scroll | shots/reza-mc-768.png | — | — |

### My work › Periods, Measurement uncertainty

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| `/my-queue` Periods | Sara, Leila | rows, links, columns | FAIL | (P-0) "Due today (3): Prepare and submit · HDPE Extruder 1 · 2026-10-18 · C / A / B · due 2026-10-19 18:00". The rows are not links (`periodHref` returns null without a plan). The Status column is empty, and the order is C, A, B | shots/sara-myq-periods.png | High (with P-0) | Show "No plan covers this period" and a path to a plan; sort by shift when the due time is equal |
| `/my-queue` | Omid | access | PASS | Opens (RCA actions and Tasks for operators) | roles-pass.txt | — | — |
| `/measurement-uncertainty` | Sara, Leila, Reza, Maryam, Neda, Kamran | read, empty state, form open/cancel | PASS | "No uncertainty budget for this unit yet; its reconciliation tolerance stays at zero until one is approved and adopted." This matches "Tolerance: none" on the periods. "New budget" opens an inline form (components, correlations, Compute, evidence) and Cancel closes it. No axe issues | shots/sara-uncertainty.png, sara-uncertainty-new.png | — | — |
| `/measurement-uncertainty` | all | title case | WARN | The h1 reads "Measurement uncertainty"; the menu reads "Measurement Uncertainty" | results.jsonl | Low | One case style |
| `/measurement-uncertainty` | Omid | refusal | PASS | "No access" | shots/omid-roles-uncertainty.png | — | — |

## Data checks against `docs/MARUN_E2E_REPORT.md`

| Fact | Expected | Seen | Result |
|---|---|---|---|
| Shift A good / loss after the lab correction | 189 / 35 t | grid and Reconciliation 189.00 t / gap 35.00 t, Unaccounted 0.00 t | PASS |
| Shift A lines | quality 3, availability 28 (MECH-GEARBOX, RCA completed), performance 4 (SPEED-LOSS) | as expected; applied rate 28.00 t/h | PASS |
| Day | 621 / 51 of 672 | day panel 621.00 of 672.00 t; grid gaps 35 + 1 + 15 = 51 | PASS |
| Shift A value | USD 5,250 / IRR 3,150,000,000 | 5,250.00 USD / 3,150,000,000 IRR (frozen, policy v2, contribution margin) | PASS |
| Day value | USD 7,650 | 5,250 + 150 + 2,250 = 7,650 (sum of the three Value sections) | PASS |
| Coding gate | A 100 %; C 0 % (1 uncoded); day 66.7 % | as expected | PASS |
| Revisions | A rev 3, B rev 2, C rev 4 approved | as expected | PASS |
| Export basis | approved revision only, contribution margin | CSV and PDF: revision 3, `contribution_margin`, approval snapshot | PASS |
| Month close | Mehr 1405 not ended; close disabled | "Month ends 2026-10-23 06:00 — not ended yet"; Close quantities… disabled | PASS |

## Use cases verified

1. Every Plans, Profiles & Calendars tab, each list → record page, and the New plan / New version / New profile / Import rates / New calendar / Add rate version / Add transition standard / Add stream / New budget forms, each opened, validated where possible, and cancelled.
2. The `/period-accounting` redirect (analysis roles) and its refusal (operator).
3. Period grid: all filter values, "Unaccounted only", "Above tolerance", Go to date, the Plan tab, URL persistence and reload, and the 768 px layout.
4. Periods A, B and C: all five sections, previous/next navigation, revision and ledger toggles with deep-link reload, derivation disclosure, applied rate, RCA chip, provenance, dispositions, "Correct this disposition…" (open / cancel), the Reopen dialog (open / cancel), Value with the USD/IRR toggle, revision history, change proposals, and CSV and PDF export with content checked.
5. Operator (Omid): Actuals & quality only; the other sections redirect.
6. Month close: Overview, Periods, Days, Proposals, History, month navigation, disabled close with its reason (Reza), and the finance view (Kamran).
7. My work › Periods (Sara, Leila) and Measurement uncertainty (read, form open / cancel).
8. Role matrix: Leila, Sara, Reza, Maryam, Neda, Omid, Kamran and admin on the 11 key routes (`roles-pass.txt`):
   - Reopen appears for Sara, Reza, Maryam and admin.
   - Start RCA appears for Reza, Maryam and admin.
   - Save posting appears for Kamran and admin.
   - Leila and Neda get read-only Review & close.
   - Omid is refused everywhere except Actuals & quality and My work.

Verified only up to the confirmation step: Reopen for revision (dialog, then Cancel) and Propose a correction (dialog, then Cancel). Approve, Submit and Certify could not be seen live: every 17 Oct period is approved and the day is certified.

## Data created

None by this audit's actions:
- No approve, submit, reopen, certify, close, post, edit or code action was sent.
- Every mutating request except exports was aborted in the browser. The one attempt, the plan "Create version" check, was aborted, so no plan version was created.
- Two export jobs were created through `POST /v2/exports` (read-only artifacts, which the brief allows): CSV `5118e7da…` and PDF `1d993d46…` for Shift A revision 3, requested by Sara.
