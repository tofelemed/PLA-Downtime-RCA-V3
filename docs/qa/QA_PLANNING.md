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

## Re-test 19 Oct

Run: 19 Oct 2026, about 14:15–15:15 Tehran, after commit `dd04dd24` and deploy. Same method as the first round:
- Headless Playwright with its own browser per run, logged in through the UI.
- Every mutating API call was aborted except login and `POST /v2/exports`. The safety net was hit 0 times.
- Personas: Leila, Sara, Reza, Maryam, Neda, Omid, Kamran and admin, each now holding only their guide role.
- Viewports: 1440×900, plus a 768×1024 pass (Sara, 11 pages).

Evidence lives in the same folder (`…\scratchpad\qa\planning\`):
- `shots\rt-*.png`: screenshots;
- `results-retest.jsonl`: one capture per page;
- `rt-*.txt`: raw script output;
- `dl\`: the new exports `17d20be0…` (CSV) and `a6387cbc…` (PDF).

**FIXED 18 / PARTIAL 4 / OPEN 10 / NEW 9**

The figures still match:
- Grid: A 224 / 189 / gap 35, B 223 / 1, C 209 / 15; Unaccounted 0 everywhere.
- Review & close day panel: "Day total (approved shifts): 621.00 of 672.00 t" (35 + 1 + 15 = 51 lost).
- Value: Shift A 5,250.00 USD and 3,150,000,000 IRR, B 150.00 USD and C 2,250.00 USD, so the day is 7,650 USD.
- Coding gates: A 100 %, C 0 % with 1 uncoded, day 66.7 %.

The pages are clean:
- Across 188 captures (`results-retest.jsonl`) there are 0 console errors and 0 failed API requests.
- There are no raw UUIDs, no snake_case words and no "demo" on screen.
- No page scrolls horizontally at 768 px.
- axe found serious or critical violations only on the `/period-accounting` redirect toast (P-14, still open).

### Status of first-round findings

| # | Finding (first round) | Status | Evidence (re-test) |
|---|---|---|---|
| P-0 (High) | My work and Month close point to 18/19 Oct periods that have no plan | FIXED | Month close (Overview, Periods and Days) now says "5 production days have no approved plan. Their periods are not counted above and need no approval until a plan covers them… · Open Plans", and lists 2026-10-18 … 2026-10-22 with 3 shifts each. The counts read 3 of 3 approved and 1 of 1 certified. My work › Periods for Sara and Leila: "Nothing waiting for you". `rt-mc-reza.txt`, shots/rt-reza-mc-*.png, rt-sara-myq-periods.png |
| P-1 | Change proposal Before/After is a dump of internal fields | FIXED | The comparison is now grouped into Reconciliation (target, actual, gap, attributed, tolerance adjustment, Unaccounted), Plan ledger (calculated) and Capacity ledger (calculated). Each group has a caption, every figure has a unit, and "residual" no longer appears. C's newest proposal now shows "Loss value after (revision 4, approved, Contribution margin) 2,250.00 USD". See N3 for a leftover. `rt-sara-A.txt`, `rt-sara-C.txt` |
| P-2 | Restatement panel shows quantities only, so a value-only change reads "no change" | FIXED | A: "Loss value (Economic impact … → Contribution margin) 5,040.00 USD · 5,250.00 USD · 210.00 USD". C: "Loss value (Contribution margin) 2,250.00 · 2,250.00 · 0.00 USD". shots/rt-sara-periodA-review.png |
| P-3 | "Create new version" sent without a change reason; unit editable | FIXED | Save now shows "Say why this version changes the approved plan" on `changeReason` and nothing is sent. Unit and Scenario are locked: "A new version keeps the unit of the plan". `rt-validate-reza.txt`, `rt-dirty-*.txt` |
| P-4 | Operator sees a "Review & close" link and a breadcrumb that lead to "No access" | FIXED | Omid's controls on the period page are only "Events", "2026-10-17 B", "Record disposition" and "Correct this disposition…": no workflow link and no planning breadcrumb. There is no money anywhere on his page. `rt-roles-omid.txt`, `rt-omid.txt` |
| P-5 | No required markers and no unsaved-changes guard | PARTIAL | Required markers (`*` plus `required` / `aria-required`) are now on every form. The unsaved-changes guard works on New plan, Create new version, New profile version, New calendar version and Record/Correct disposition ("You have unsaved changes. Leave this page and discard them?", plus `beforeunload`). It is **missing on Import rates and Propose an actuals adjustment**: after typing, Cancel leaves without asking. `rt-dirty-reza.txt` |
| P-7 | Month close hides the finance steps from Kamran | FIXED | Kamran sees "Finance sign-off…[disabled]" ("Plant management closes the quantities first (every period approved, the month ended).") and "Lock month…[disabled]" ("Finance signs off the month first…"). `rt-mc-kamran.txt` |
| P-14 | Toast on the `/period-accounting` redirect fails axe | OPEN | Still: critical `button-name` (the toast close button `.right-2`), serious `aria-hidden-focus` (2) and serious `list` (`ol`). results-retest.jsonl `sara-period-accounting` |
| Posting | A decided restatement posting is still editable | FIXED | Kamran and admin on A: "posted on 2026-10-19 as a correction · decided by Kamran on 2026-10-19 01:32 (+03:30 Asia/Tehran)… The posting decision is final. To change it, propose a correction of this period". No inputs are shown. C (undecided) keeps the form, with "Save posting…" disabled until a date is chosen. `rt-kamran-restate.txt` |
| Case | Menu, h1 and title use different capitalisation | FIXED | The menu, h1, title, breadcrumb and no-access page now all read "Plans, profiles & calendars", "Month close", "Measurement uncertainty" and "My work" |
| Period h1 | The period h1 does not name the shift; "Calculated2026" has no space | FIXED | The h1 and title read "HDPE Extruder 1 — 2026-10-17 · Shift A" (B, C likewise); "Calculated 2026-10-18 19:39" |
| Op. mode | The profile list shows the raw value "normal" | OPEN | "HDPE Extruder 1 × HDPE grade A · normal"; the subtitle reads "Operating mode normal · version 1". shots/rt-leila-planning-profiles.png |
| Actions col | Read-only users see an empty "Actions" column | OPEN | Leila still sees an Actions header with empty cells on both rate tables. shots/rt-leila-profile-detail.png |
| Unit URL | The unit chosen on Transitions and Streams is not kept in the URL | FIXED | `?tab=transitions&unitId=…` and `?tab=streams&unitId=…` |
| Record run | "Record run" is disabled with no reason | FIXED | "Add a stream first: a run says which stream ran the product." |
| Calendar view | A published version opens on `/edit`; no Back; "Run preview" is disabled with no reason | PARTIAL | "Back to calendars" was added, and Run preview now gives a reason ("Choose “Preview” above first."). The URL is still `/planning/calendars/:id/edit` for a published, read-only version. shots/rt-leila-calendar-version.png |
| Plan units | "Header target: 672.00" has no unit; the slice row shows Weight and Slice target "—" | OPEN | Unchanged. shots/rt-leila-plan-detail.png |
| Profile gate | `/planning/profiles/new` renders the full form for Leila | FIXED | "Profile editing — No access…". Same for `/planning/calendars/new` ("Calendar editing — No access") |
| Import form | "Import" is disabled with no reason; there is no Cancel | FIXED | "Choose a file and enter its document reference first." Cancel now goes to `?tab=profiles`. The missing dirty guard is counted under P-5 |
| New calendar | Non-writers get the editor; there is no Cancel | FIXED | Leila is refused; Reza has Cancel, which goes to `?tab=calendars` |
| Menu label | "Period accounting" is sentence case among Title Case items | FIXED | All items are sentence case (the entry is no longer in the PLA menu; the redirect still works) |
| Figures of | "Approved revision only" is not in the URL | FIXED | `?view=approved`, kept after a reload |
| Go to date | Dates outside the plan are accepted silently | OPEN | `?date=2026-09-01` shows "From plan start" and the same 3 rows, with no message |
| Quality chip | A disposition-based quality line carries a "Not coded" chip | FIXED | A's quality line reads "No cause". C's "Not coded" is on the availability line from the uncoded 02:00 stop, which is correct |
| Capacity labels | In the capacity view, the equation says "Target" and the heading says "Loss lines (plan ledger)" | OPEN | Unchanged with `ledger=capacity` (only the waterfall says "Capacity at sustained rate"). `rt-sara-A.txt` |
| Verify reason | "Verify this shift's stops" is disabled with no reason | FIXED | On A (Leila, Reza, Maryam, admin): "Every coded stop of this shift is already verified." See N8 for C |
| Day tone | The day coding warning is grey text, unlike the shift card | OPEN | It is still a `p.text-xs` plain line under the day panel |
| Value note | Value does not mention the restatement | OPEN | The Value section shows only the frozen 5,250.00 USD. The 5,040 → 5,250 change is visible on Review & close (P-2) but not linked from Value. Low |
| Propose wording | The "Propose a correction" dialog text does not match the user's role or the month state | OPEN | Still "For a period of a closing or locked month… (SuperAdmin may decide their own proposal)", shown to Sara on an open month |
| CSV | `timezone,UTC`, `requested_by` is a uuid, and the reason is empty | PARTIAL | Added `requested_by_name,Sara`, `plant_timezone,Asia/Tehran` and a `plant_start` column. The availability row still has an empty `reason`, with only `reason_code_id`, so MECH-GEARBOX is not readable in the CSV. `dl/sara-A-…-17d20be0….csv` |
| PDF | Raw states; no reason on the availability line | FIXED | States now read "Accepted" / "In force", and the Reason column shows "MECH-GEARBOX · Gearbox failure" and "SPEED-LOSS · Reduced extrusion…". See N4 |
| Future month | Aban shows "Prerequisites need attention" with 0 of 0 | OPEN | Unchanged. It now also lists 30 no-plan days, which is useful |

### New findings

| # | Page / route | Role | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| N1 | `/month-close` Overview (Mehr 1405) | Reza | WARN | The banner reads "Prerequisites need attention. Select a count to inspect its records." Under Close quantities it says "Resolve the blocking prerequisites shown above before closing the quantities." Yet every count is 0 (3 of 3 approved, 1 of 1 certified, 0 proposals). The no-plan days are explicitly not blocking, and the only real blocker is "Month ends 2026-10-23 06:00 — not ended yet" | `rt-mc-reza.txt`, shots/rt-reza-mc-overview.png | Medium | Derive the banner and the second reason from the actual blockers; say "Prerequisites met — waiting for the month to end" |
| N2 | All guarded forms | Reza, Leila | WARN | The unsaved-changes guard is the browser's native `confirm()` dialog, not the app's AlertDialog, so it is unstyled and cannot be tested with the app's dialog patterns | `rt-dirty-*.txt` ("NATIVE DIALOG confirm") | Low | Use the shared AlertDialog for in-app navigation; keep `beforeunload` for tab close |
| N3 | History › Change proposals | Sara, Maryam | WARN | In the Capacity ledger (calculated) block, "Actual (good)" shows "—" before and after, while the Plan ledger block shows 189.00 t / 209.00 t | `rt-sara-A.txt`, `rt-sara-C.txt` | Low | Fill the capacity actual from the snapshot, or drop the row |
| N4 | Export PDF | Sara | WARN | In the Reason column, the availability reason "MECH-GEARBOX · Gearbox failure" wraps and overprints the performance row's "SPEED-LOSS · …", so both rows are unreadable there | `dl/sara-A-…-a6387cbc….pdf` | Low | Give the row height to the wrapped cell, or truncate with the full text below |
| N5 | Grid vs period page | all | WARN | The grid h1 and title read "Extruder1 HD5502 — 17 Oct 2026 · period accounting". The period page's breadcrumb for the same grid reads "Extruder1 HD5502 — 17 Oct 2026 · periods". The period h1 names the unit ("HDPE Extruder 1 — 2026-10-17 · Shift A") and its date format differs from the plan-name date ("17 Oct 2026") | results-retest.jsonl `*-roles-grid`, `*-roles-pA` | Low | One label for the grid page in the breadcrumb |
| N6 | `/month-close?section=periods` | Reza | WARN | The link reads "Open my queue for your recent assigned work"; the page is called "My work" everywhere else | `rt-mc-reza.txt` | Low | "Open My work" |
| N7 | `/measurement-uncertainty` | all | WARN | The intro text ends "…residuals are always published"; the glossary term is Unaccounted (the first round removed "residual" elsewhere) | `rt-myq-sara.txt` | Low | "Unaccounted figures are always published" |
| N8 | Review & close C | Reza | WARN | "Verify this shift's stops" is **enabled** on C, whose only stop is uncoded (coded stop time 0 %). It was not clicked, so whether the server refuses is unknown. On A the button is disabled with a reason | `rt-probe7` output | Low (Medium if the server accepts it) | Disable it with "Code the stop first" while stops are uncoded |
| N9 | My work › Periods (empty) | Sara, Leila | WARN | The empty state draws the table header row ("To do · Period · Due · Status") above "Nothing waiting for you" | shots/rt-sara-myq-periods.png | Low | Render only the empty state |

Also noted (not counted):
- Reza, Maryam and admin now see "Start investigation" (the glossary term) on loss lines, but the RCA chip on the availability line still reads "RCA completed (open the investigation)".
- C's undecided posting still offers lower-case treatments ("a correction", "another adjustment") in its form.

### Role matrix (re-test)

| Control | Seen by | Not seen by |
|---|---|---|
| Reopen for revision… | Sara, Reza, Maryam, admin | — |
| Start investigation | Reza, Maryam, admin | — |
| Propose a correction… | Sara, Reza, Maryam, admin | Leila, Neda, Kamran |
| Propose adjustment | Leila, Sara, Reza, Maryam, admin | Neda, Kamran |
| Record disposition | Leila, Sara, Reza, Maryam, Neda, Omid, admin | Kamran |
| Finance sign-off… / Lock month… (disabled, with reasons) | Kamran | Sara (and Reza) |
| Restatement posting | read-only for everyone once decided | — |

Omid is refused on Plans, Period accounting, Month close and Measurement uncertainty. He gets Actuals & quality only, without money. His My work shows only RCA actions and Tasks.

### Data created in the re-test

None by this audit's actions:
- No approve, submit, reopen, certify, close, post, verify, edit or code action was sent.
- 0 mutating requests were blocked, because none was attempted.
- Two read-only export jobs were created through `POST /v2/exports` (CSV `17d20be0…` and PDF `a6387cbc…` for Shift A, revision 3, requested by Sara), plus the same pair for Shift C.

## Round 3 re-test (19 Oct 2026)

Run 19 Oct 2026, about 16:50–17:25 Tehran, against the freshly rebuilt Docker stack (frontend :8070, API :4004).
- **Method:** headless Chromium, logged in through the UI. Every non-GET API call was blocked except login, refresh and export jobs, and no write was attempted. Forms were only typed into, then left with "Stay on this page" or by closing the browser.
- **Personas:** Sara, Reza, Leila, Kamran, Maryam, Shirin, Farid, Omid and admin.
- **Viewports:** 1440×900, plus 768×1024 for Sara (18 pages).
- **Evidence:** `…\scratchpad\qa\r3\` holds `p*.txt`, the `k1` and `o1` outputs, `*.png`, `results.jsonl` and `dl\`.

**Figures unchanged:**
- Grid: A 224 / 189 / 35, B 224 / 223 / 1, C 224 / 209 / 15, with Unaccounted 0.
- Day panel: "621.00 of 672.00 t".
- Value: A 5,250, B 150 and C 2,250 USD, so 7,650 USD for the day.
- The same figures appear on PLA, Reports and the Dashboard (see QA_PLA_ANALYTICS).

**Clean pages:**
- No console errors and no failed requests, apart from the expected 404 on a decided approval's deep link (R3-6).
- No raw IDs, snake_case words, "demo" or "training" on screen. Units have a space.
- No horizontal scroll at 768 px.
- axe found no serious or critical issues, except on the `/period-accounting` redirect (R3-5).

### Verified fixed

- **Plan:**
  - The header reads "Header target: 672.00 t".
  - The slice row shows Weight "Not used" and Slice target "Header target".
- **Profiles:**
  - The operating mode reads "Normal".
  - Leila sees no Actions column.
- **Calendars:** a published calendar opens at `/planning/calendars/:id` (read-only, with "Back to calendars").
- **Go to date:** a date outside the plan says "2026-09-01 is outside this plan (2026-10-17 – 2026-10-18): showing it from the plan start."
- **Period labels:**
  - The h1 and title name the shift ("HDPE Extruder 1 — 2026-10-17 · Shift A/B/C").
  - The grid h1 and the period back link both read "Extruder1 HD5502 — 17 Oct 2026 · period accounting".
- **Restatement panel:**
  - Decided postings are read-only. A reads "posted on 2026-10-19 as a correction · decided by Kamran…".
  - Kamran sees "The posting decision is final…" and no inputs.
  - On C (not decided), the treatments are sentence case. "Save posting…" stays disabled until a date is chosen.
  - Value-only changes are shown: A 5,040.00 → 5,250.00 USD (+210.00), B 80.00 → 150.00 USD, C 2,250.00 → 2,250.00 USD.
- **Value section:** it names the restatement: "Restated from approved revision 2: loss value was 5,040.00 USD, now 5,250.00 USD. See the restatement in Review & close".
- **Change proposals:**
  - Before/after is grouped into Reconciliation, Plan ledger and Capacity ledger, and every figure has a unit.
  - The capacity "Actual (good)" now shows 189.00 t and 209.00 t (N3 fixed).
  - The value before and after is shown, e.g. C "1,350,000,000 IRR · 2,250.00 USD".
- **Correcting an approved period:** in the open month, History says "The month is open: correct this approved period with “Reopen for revision…” in Review & close". "Propose a correction" is no longer offered there.
- **Month close (Mehr):**
  - The banner reads "Prerequisites met — waiting for the month to end." and "Close quantities…" is disabled with "Month not ended yet." (N1 fixed).
  - Aban reads "This month has not started yet." on the banner and on the button.
  - The no-plan days 18–22 Oct are listed with "Open Plans".
  - The link now reads "Open My work" (N6 fixed).
  - Kamran's finance buttons are disabled and give their reasons.
- **Day certification:** "Day certified" with A / B / C Approved. The day coding warning now looks like the shift card.
- **Verify this shift's stops:**
  - On C it is disabled with "Code the stop first: only stops with a reason or “investigation pending” are verified." (N8 fixed).
  - On A it is disabled with "Every coded stop of this shift is already verified."
- **Unsaved-changes guard** (N2 and the rest of P-5 fixed):
  - Tested on New plan version, Import rates, Propose adjustment and Record disposition.
  - An in-app link, the form's Cancel and browser Back (after in-app navigation) all ask through the app dialog: "Leave this page? … Stay on this page / Leave and discard".
  - "Stay" keeps the URL and the typed text.
  - Only reload and tab close use the native prompt.
- **My work:**
  - No 18–22 Oct (no-plan) period is listed for Sara, Leila, Reza, Maryam, Shirin, Farid or admin.
  - The Periods tab shows only "Nothing waiting for you", without a table header (N9 fixed).
  - The RCA actions Status filter works: each choice sends its own query (open and in progress, done, all) and changes the empty-state text.
  - None of these personas owns an RCA action, so rows could not be checked.
- **Measurement uncertainty:** "Unaccounted figures are always published" (N7 fixed).
- **Operator (Omid):**
  - The period page opens on Actuals & quality only; `/value`, `/review` and `/history` redirect there.
  - No money is shown.

### Remaining problems

| # | Page | Persona | What is wrong | Expected | Severity |
|---|---|---|---|---|---|
| R3-1 | Period › Review & close, restatement posting (C, not decided) | Kamran (finance approver) | "Posting date" is the browser's native date picker (`input type=date`), so it shows the browser's locale format and calendar, not the plant format (YYYY-MM-DD). It is the only native date input left in planning, period accounting and month close | The plant date field used on Reports and PLA: text YYYY-MM-DD with "Use YYYY-MM-DD, e.g. 2026-10-17" | Medium |
| R3-2 | Period › Review & close, stop coding card | all | "1 stops: 1 with a reason, 0 investigation pending, 0 uncoded" | "1 stop: …" (singular) | Low |
| R3-3 | Approval inbox › change set; restatement panel | Reza | The "Availability loss line · <reason>" labels could not be checked live: no approval with changed loss lines is pending, and a decided item's link says "No longer pending". The restatement panel's own line rows (`restatement-panel.tsx`) still build "Loss line · ${kind} · reason …" and "… · ${kind} loss line" from the raw kind (`availability`). These rows do not show today because the Marun restatements change no lines | The same words as the inbox: "Availability loss line · Gearbox failure" | Low |
| R3-4 | Export PDF (period loss lines, Reports loss lines) | Leila | Rows no longer overprint, but page breaks are poor. A period's heading and metadata sit at the bottom of one page while its table starts on the next ("(continued)"). Page 1 leaves half a page empty and pushes the next row to page 2 | Keep a period heading with at least its first rows; fill the page before breaking | Low |
| R3-5 | `/period-accounting` redirect | Sara | axe still reports 1 serious issue: `list` on the Sonner `.toaster` (`ol`). The old critical `button-name` and `aria-hidden-focus` issues are gone | No serious axe issue | Low |
| R3-6 | `/approvals/period-review/<decided revision>` | Reza | The page correctly reads "No longer pending", but the console logs a 404 error for `GET /api/v2/approval-inbox/…` | Handle "no longer pending" without a console error | Low |
| R3-7 | History › Export approved loss lines (CSV) | Leila | The file name carries the raw export id (`traverse-forge-loss-lines-d9d6fdef-….csv`), while Reports exports use the date (`…-loss_lines-2026-10-17.csv`) | Plant, unit or period date in the file name | Low |

Still open from earlier rounds (re-checked, but outside the round-3 scope):
- "Run preview" on the read-only calendar still needs "Choose “Preview” above first".
- Revision-history reasons contain the word "residual". This is text users typed, not product copy.

### Data created in round 3

None in the plant records. Two read-only export jobs were created through the UI for Shift C: loss lines CSV and PDF, requested by Leila. QA_PLA_ANALYTICS lists the Reports exports.
