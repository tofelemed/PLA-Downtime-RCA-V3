# QA audit: Event Hub, event pages and Downtime Analysis (agent DOWNTIME)

Run: 19 Oct 2026, 12:12–12:40 Tehran (08:42–09:10Z), plant Marun › HDPE plant (HDPE-TRAIN), unit HDPE Extruder 1.
Method: headless Playwright (repo `playwright` + `@axe-core/playwright`), one browser per run, UI login for each persona.
Personas: omid (operator), leila and shirin (production_engineer), farid (reliability_engineer), reza (manager_approver), sara (production_accountant) and admin (SuperAdmin).
Viewports: 1440×900, plus a 768×1024 pass as omid on all 10 pages.
Safety net: every non-GET API call was aborted in the browser. The exceptions were login and refresh, bulk-code calls with `preview: true`, and, for one run only, `POST /v2/exports`.
Evidence: scripts, JSON captures and screenshots are in the session scratchpad
`C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\downtime\`. Screenshots are in `shots\*.png`, captures in `*.json`, and CSV downloads in `dl-*.csv`. Paths below are relative to that folder.

## Summary

| Result | Count |
|---|---|
| Checks run (page/dialog × role × check) | ~380 |
| Table rows PASS | 27 |
| Table rows FAIL | 5 |
| Table rows WARN | 24 |
| Critical | 0 |
| High | 1 |
| Medium | 8 |
| Low | 20 |

Overall:
- **Every KPI in the guide matches.**
  - Shift A: 1 h, 87.5 %, 100 % coded, MTBF 7 h, MTTR 30 min, restore 1 h.
  - Day: 1 h 30 min, 93.8 % (93.75), 2 stops, 66.7 % coded.
  - Pareto: MECH-GEARBOX 1 h / 28 t, Not coded 30 min / 14 t.
  - Value: 4,200 + 2,100 = 6,300 USD; IRR 3,780,000,000.
- Every page loaded with no console errors.
- No failed requests, apart from one: the Previous-period comparison returns 422 (F1).
- axe found only 2 serious issues:
  - an unlabelled control in the Split dialog;
  - low colour contrast in the Recharts tooltip.
- No "demo" text, no raw UUIDs and no horizontal page scroll at 768 px. The 768 px navigation drawer works.

Top findings:
1. **F1 (High):** Trends & Comparisons › Previous-period comparison is broken.
   - The current-window side shows "Some values were not accepted · Views: Must contain at least 1 elements".
   - `GET /v2/reports/downtime-bundle` returns 422 because it is sent without any `views`.
2. **F2 (Medium):** The Schedule class filter does not change the Downtime summary.
   - With class=planned, the KPIs still read 1 h 30 min, 2 stops and 93.8 %, while the trend reads "No data".
   - Nothing on the page says the summary ignores the filter.
3. **F3 (Medium):** The New event form does not check that the end is after the start before saving.
   - Save sends the POST.
   - The only hint is a server error box with "Copy support reference" under "Impacted periods", far from the End field.
4. **F4 (Medium):** Raw keys appear on event pages and on RCA trigger settings.
   - Values tab: `TRIP_ALARM`, `CAUSE_PENDING`, `MECHANISM_PENDING`, `GEARBOX_FAILURE`, and lowercase `critical`.
   - History tab notes: `failure_validation`, `verification`.
   - RCA trigger settings: `five_why`, `logic_tree`, `fault_tree`, `fmea`.
5. **F5 (Medium):** A bulk-code **preview** is written to the audit log as `CREATE ProductionEvent "unknown"`.
   - Also, a preview where nothing changes reads "2 events change".
6. **The "Back to the analysis page" link works.** It names the source page ("‹ Causes & Pareto") and keeps every filter.
   - The breadcrumb next to it still points to the unfiltered "Event Hub".
   - The new page opens scrolled down: scrollY 412.

## Data correctness vs the guide (17 Oct 2026)

| Figure | Guide | Shown | Where | Result |
|---|---|---|---|---|
| Shift A total downtime | 1 h | 1 h | /downtime, window 06:00–14:00, and the `shifts=A` filter | PASS |
| Shift A availability | 87.5 % | 87.5 % (scheduled availability) | same | PASS |
| Shift A stop time coded | 100 % | 100.0 % | same | PASS |
| Shift A MTBF | 7 h | 7 h, 1 failure | /downtime/reliability, window 06:00–14:00 | PASS |
| Shift A MTTR | 30 min | "Mean active repair time (MTTR)" 30 min | same | PASS |
| Shift A mean time to restore | 1 h | "Mean time to restore production" 1 h (both columns shown) | same | PASS |
| Day total downtime | 1.5 h | 1 h 30 min | /downtime, day window | PASS |
| Day availability | 93.75 % | 93.8 % (data-value 0.9375) | same | PASS |
| Day coded | 66.7 % | 66.7 % | same | PASS |
| Day stops | 2 | 2 (carry-in 0; mean completed stop 45 min; onstream 93.8 %) | same | PASS |
| Day Pareto | MECH-GEARBOX 60 min, uncoded 30 min | Mechanical 1 h 66.7 % › Drive train › MECH-GEARBOX 1 h; Not coded 30 min 33.3 %; frequency 1 / 1 | /downtime/causes?analysis=reasons | PASS |
| Lost production | 28 t / 14 t | MECH-GEARBOX 28.00 t, Not coded 14.00 t, total 42.00 t; Approved, coverage 100 % | /downtime/causes | PASS |
| Lost value | 4,200 / 2,100 USD | 4,200.00 / 2,100.00 USD, total 6,300.00 USD; IRR 2,520,000,000 / 1,260,000,000 | /downtime/causes › Lost value | PASS |
| Event A | 08:00–09:00, 1 h, MECH-GEARBOX, verified by Shirin, validated by Farid, repair 08:10–08:40 | all shown as expected; Attributed losses 28.00 t / 4,200.00 USD, contribution margin; RCA completed | /events/67cc2c2a… | PASS |
| Event C | 02:00–02:30 (18 Oct plant time), 30 min, uncoded | Ended · Uncoded · No RCA · Accounting: approved · Not verified; 14.00 t / 2,100.00 USD | /events/3ea50fb2… | PASS |
| Event A History actors | names; "System (state engine)" | revisions 6–1: Maryam, Farid, Farid, Shirin, Omid, "System (state engine)" | History tab | PASS |
| Event C History actors | names; "System (data repair)" | revision 5 "System change by System (data repair)", revisions 4–2 Leila, revision 1 "System (state engine)" | History tab | PASS (wording, see L18) |

## Event Hub — `/events`

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| /events | all 7 | menu link, h1 "Event Hub", title "Event Hub · Traverse Forge", console, network, axe, demo, uuid | PASS | The menu has Event Hub and Downtime Analysis for every role. 0 errors and 0 axe issues | role-*-events.png, roles-*.json | — | — |
| /events window presets | omid | Last 8 h / 24 h / 7 days / 30 days; URL `window=24h`; reload keeps it | PASS | — | hub-omid.json | — | — |
| /events window select | omid | option list | WARN | The disabled placeholder repeats the current preset, so "Last 7 days" appears twice. Event Hub offers 8 h / 24 h / 7 d / 30 d, but Downtime offers 24 h / 7 d / 30 d / 90 d (L1) | hub-omid.json | Low | `event-hub/components/window-select.tsx`, `model/relative-window.ts` |
| /events custom range | omid | open popover, inputs (date + time), Cancel, Apply 17 Oct 06:00 → 18 Oct 06:00 | PASS | The URL takes `from`/`to`, and the list shows both stops | hub-omid-custom-range.png | — | — |
| /events custom range label | all | header text | WARN | A one-day past window reads "Custom range · 06:00–06:00", with no date. You cannot tell which day it is (L2) | x-omid-events-day.png | Low | `hooks/use-window-range-text.ts`: show the date when the window is not today |
| /events custom range invalid | leila | end before start | WARN | "The end must be after the start" is shown, but **Apply range stays enabled** (L3) | misc.json | Low | `custom-range-popover.tsx` (`ready` is computed from the stale state) |
| /events current shift | omid | one unit chosen → "Current shift (A)" → 06:00–14:00 today; empty state | PASS | Empty state: "No events — No event matches the filters in this window." The hint "Choose one unit to pick a shift." shows when no unit is chosen | hub-omid-current-shift.png | — | — |
| /events shift list | omid | shift options | WARN | Lists **2026-10-20 A** (tomorrow) as a choosable shift (L4) | hub-omid.json | Low | `hooks/use-shift-windows.ts`: stop at the current shift |
| /events shift 17 Oct A | omid | URL, rows | PASS | Shows only the 08:00 stop; label "2026-10-17 A · 06:00–14:00" | hub-omid.json | — | — |
| /events Units / Type / Reason filters | omid | options, URL `units=`, `kinds=downtime`, `reasons=` | PASS | The reason filter narrows the list to the 08:00 stop | hub-omid.json | — | — |
| /events More filters | omid | Event family, Schedule, Asset, Coding, Verification, RCA, State, Origin, Severity, min duration, duplicate and repeat flags | PASS | State: Ongoing / Ended / Superseded / Retracted; Coding: Uncoded / Coded / Reviewed; Verification: Verified / Not verified. `verified=verified` leaves only the 08:00 stop | hub-omid-more-filters.png, misc.json | — | — |
| /events min duration | omid | "≥ 30 min" → `minDuration=1800` | PASS | Both stops stay (≥ is inclusive) | hub-omid.json | — | — |
| /events sort | omid | Duration longest/shortest (`sort=longest`/`shortest`), aria-labels | PASS | The aria-label states the sort and the next action | hub-omid.json | — | — |
| /events To code | omid | `kinds=downtime&coding=uncoded` | PASS | Lists only the Shift C stop (R1 fix holds) | hub-omid-to-code.png | — | — |
| /events paging | omid | — | N/A | Only 2 events in the plant, so the paging controls are hidden | — | — | — |
| /events Export CSV | omid | download, file name, contents | WARN | `traverse-forge-production-events-2026-10-17.csv` has 2 rows and is correct. **Weaknesses (L5):** no UTF-8 BOM (the "–" in the description breaks in Excel); UTC times only (`start_utc`), with no plant-time column; enum values (`ProductionLoss`, `closed`, `uncoded`) instead of the screen labels | dl-omid-traverse-forge-production-events-2026-10-17.csv | Low | server `production-events/export`: add a BOM and plant-time columns, as the RCA CSV has |
| /events Current stops panel | all | heading, empty state | PASS | "Current stops (0) · No ongoing stops." | x-omid-events-default.png | — | — |
| /events Bulk code dialog | omid, leila | Bulk code disabled until a row is selected; dialog; Preview disabled with a reason (`aria-describedby=bulk-blocked`); Preview; Cancel | PASS | Title "Code 2 events"; "Preview first: nothing changes until you apply"; the "Why" field is required | hub-omid-bulk-dialog.png, misc-bulk-preview.png | — | — |
| /events Bulk code preview | leila | preview with schedule class Unplanned (unchanged for both) | FAIL | (F5a) The preview reads **"2 events change · 0 excluded"** and enables "Apply to 2", although Before = After for both rows. "Recalculates:" runs two windows together ("09:00HDPE Extruder 1") | misc-bulk-preview.png | Medium | `bulk-code-plan.ts`: count only rows whose coding differs, and disable Apply when 0; `bulk-preview-table.tsx`: separate the windows |
| /events Bulk code preview (audit) | leila | audit_logs after the preview | FAIL | (F5b) The read-only preview `POST /v2/production-events/bulk-code {preview:true}` is logged as **`CREATE ProductionEvent "unknown"`** (09:07:06Z) | SQL on `audit_logs` | Medium | the global audit interceptor (`server/.../common`): skip `preview: true` or record "PREVIEW" |
| /events Merge dialog | omid | open with 2 stops, text, Merge disabled until a reason is given, Cancel | PASS | "Merge 2 stops … One unit only." Times show "(+03:30 Asia/Tehran)" | hub-omid-merge-dialog.png | — | — |
| /events Code all matching | omid | dialog, summary, Cancel | PASS | "Code every matching event · Events 2 · From 2026-10-17 08:00 · To 2026-10-18 02:30 · Units HDPE Extruder 1 · Assets 1" | hub-omid.json | — | — |
| /events row Code dialog | omid | open on the Shift C stop, Save disabled, Cancel | WARN | Subtitle "HDPE Extruder 1, **since** 2026-10-18 02:00": "since" reads as an ongoing stop, but this stop ended at 02:30 (L6) | last-omid-code-dialog.png | Low | `code-event-dialog.tsx`: use "from … to …" for an ended stop |
| /events RCA trigger settings link | all 7 | visibility | PASS | Shown to reza and admin only (`canManageRcaPolicies`) | roles-*.json | — | — |
| /events/rca-triggers by direct URL | omid, leila, shirin, farid, sara | reachable, read-only | WARN | The page opens read-only for everyone (no menu link). For read-only roles it still shows a "New version" heading with no form and no "only … can change this" text. The summary shows raw keys `five_why`, `logic_tree`, `fault_tree`, `fmea` (F4c), and says "Recommend an RCA" instead of "investigation" (L7) | role-omid-rca-triggers.png | Medium (keys) / Low | `rca-policy/rca-policy-text.ts` (method labels), `rca-policy-page.tsx` (hide "New version" or explain who may edit) |
| /events role actions | sara | write actions | WARN | Sara (production_accountant) gets New event, Merge, Bulk code, Code, Edit / code and Split. `canWriteEvents` is true for every role except viewer. The brief treats Sara as "viewer-like". **Owner question** (Q1) | roles-*.json | Low | decision in `plans/DECISIONS.md`; `features/auth/capabilities.ts` |

## Event create form — `/events/new`

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| /events/new | omid (all roles: h1) | open from "New event", h1 "New event", title, breadcrumb "Event Hub › New event", axe | PASS | 0 axe issues | form-new.png | — | — |
| /events/new save empty | omid | inline validation | PASS | "Choose a unit", "Enter the start time"; Unit carries a "*" required marker | form-empty-errors.png | — | — |
| /events/new asset picker | omid | disabled before the unit is chosen ("Choose the unit first"), then lists "Main drive and gearbox" | PASS | — | form.json | — | — |
| /events/new Now | omid | the Now button fills the plant date and time (2026-10-19 12:21) | PASS | — | form.json | — | — |
| /events/new end before start | omid | Save with end 2026-10-01 08:00 < start | FAIL | (F3) There is no client-side check, so Save sent `POST /v2/production-events` (blocked by the QA net). The impacted-periods preview shows "The time range is not valid · Make sure the start is before the end · Copy support reference" as a server-error box under **Impacted periods**, not on the End field | form-end-before-start.png | Medium | `event-hub/model/event-form.ts` validate (~line 123): add `errors.endLocal = 'The end must be after the start'` |
| /events/new duration mode | omid | "End given as: End time / Duration"; invalid duration; hint | PASS | "Enter a duration such as 2h 30m, 2:30 or 150 (minutes)". In duration mode, the old "time range is not valid" box stays visible (L8) | form-duration-mode.png | Low | clear the impacted-periods error when the mode changes |
| /events/new Keep draft and close → reopen | omid | draft | PASS | Reopening restores the draft with "Unsaved changes restored from your last visit". There is no "Start new" choice: Discard is the way out | form-draft-offer.png | — | — |
| /events/new Discard | omid | confirmation dialog | PASS | "Discard your changes? … Discard changes"; returns to the list; no draft afterwards | form.json | — | — |
| /events/new leave by breadcrumb | omid | unsaved guard | WARN | No prompt: the form autosaves a draft, so nothing is lost, but nothing tells the user a draft was kept (L9) | form.json | Low | toast "Draft kept" |

## Event detail — `/events/:id` (both 17 Oct stops)

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| /events/67cc2c2a… (A), /events/3ea50fb2… (C) | all 7 | h1 "Downtime · HDPE Extruder 1", title, "Derived · revision 6 / 5" (matches History), chips, summary, axe, console | PASS | Chips: A "Ended · Coded · RCA completed · Accounting: approved · Verified by Shirin"; C "Ended · Uncoded · No RCA · Accounting: approved · Not verified" | x2-*-A-summary.png, x2-*-C-summary.png | — | — |
| Header actions by role | all 7 | Edit / code, Split; Create / link RCA (farid, reza, admin); Retract / Close stop | PASS / N/A | Retract shows only for manual events and Close stop only for open stops. **Neither exists** (both stops are derived and ended), so both dialogs were **not reachable without creating data** | roles-*.json | — | — |
| Create / link RCA on A | farid, reza, admin | — | WARN | Still offered on a stop whose investigation is closed. The label says "RCA" (Glossary: "investigation"), and so do "Similar past RCAs" and the history notes "RCA case linked / closed" (L10) | x2-farid-A-summary.png | Low | RCA panel of the event page; `revision-timeline.tsx` labels |
| Similar past RCAs (C) | leila | — | WARN | The entry shows a "Quality 80" badge (knowledge quality score). On an event page it reads like the OEE Quality figure (L11) | x2-leila-C-summary.png | Low | `rca-knowledge/components/quality-score.tsx`: "Entry quality 80" |
| Attributed losses card | all | period link, status, revision, t, USD/IRR toggle, basis | PASS | A: "2026-10-17 · A · Approved · revision 3 · Availability 28.00 t · 4,200.00 USD · Value basis: Contribution margin"; C: 14.00 t / 2,100.00 USD | x2-farid-A-summary.png | — | — |
| Values tab | leila, farid | 55 fields, paged 20 per page; "Changed by Omid" badges | FAIL | (F4a) Raw dictionary keys: Detection method `TRIP_ALARM`, Failure cause `CAUSE_PENDING`, Failure mechanism `MECHANISM_PENDING`, Failure mode `GEARBOX_FAILURE`; Failure severity `critical` (the summary reads "Critical"). Two rows are both labelled **"Event type"** (one "—", one "Production loss") | x2-farid-A-summary.png | Medium | `event-hub/model/fact-display.ts`: resolve failure-dictionary names (as the edit form does: "TRIP_ALARM — Trip alarm"); rename one "Event type" row |
| History tab | leila, farid | actors, notes | FAIL | (F4b) Revision notes show raw keys **`failure_validation`** (rev 4) and **`verification`** (rev 3), and lowercase "created". Rev 5 of C reads "System change by **System** (data repair)" (L18) | x2-farid-A-History.png | Medium | `components/revision-timeline.tsx`: map note keys to text ("Failure detail validated", "Coding verified") |
| Source conflicts tab | all | empty state | PASS | "No review items." | x2-*-Source_conflicts.png | — | — |
| Evidence tab | farid | source delivery, lineage | WARN | It lists every empty source field, with odd labels: "**Sol type**", "Limit type", and "Event type" twice (L12) | x2-farid-A-Evidence.png | Low | `evidence-panel.tsx`: hide empty fields; fix the labels in `model/source-facts.ts` |
| Repair tab | farid | A: active repair 30 min, waiting 0 s, 08:10–08:40, WO-EXT1-20261017-01 / 0010, CMMS; C: empty-state text | PASS | Small: the "Stop" column of A links "Open the stop" to the page you are on (L13) | x2-farid-A-Repair.png, x2-farid-C-Repair.png | Low | hide the self-link on the event page |
| Duplicates & repeats tab | all | text | PASS | "No other record of this stop was found." / "not part of a repeat-stop incident." | x2-*-Duplicates_repeats.png | — | — |
| Periods tab | omid, sara | links | WARN | It shows "2026-10-17 A" (no "·") and links without `?view=approved`, while the Attributed losses card shows "2026-10-17 · A" with `?view=approved` (L14). Omid lands on Actuals & quality as designed | last.json | Low | `components/period-link.tsx` / impacted-periods list |
| Coding verification panel | all | text | PASS | "Coding: verified by Shirin, 2026-10-18 16:42 · Failure detail: validated by Farid, 2026-10-18 16:43"; C: "Coding: not coded yet", RCA recommended "lost 14.00 t (limit 6.72 t)" | x2-leila-*.png | — | — |
| Deep link `?tab=history` etc. | leila | URL holds the tab; reload | PASS | — | explore2-*.json | — | — |
| Back from the event | leila | arrived from the list / Causes & Pareto / Stops & Timeline | PASS (with a note) | A "‹ Causes & Pareto" back link restores the exact URL (filters and reason path). Browser Back works too. **Notes (L15):** the breadcrumb below it still reads "Event Hub" → `/events` with no filters; the event page opens **scrolled down** (scrollY 412, inherited from the analysis page); the Pareto leaf drill-down list is not in the URL, so it is closed on return | back-event-top.png, back.json, dt3-leila-event-from-drill.png | Low | router scroll-to-top on navigation; put the drill selection in the URL (`model/reason-drill.ts`) |

## Edit / code — `/events/:id/edit`, and the Split dialog

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| /events/A/edit, /events/C/edit | leila | h1 "HDPE Extruder 1 · Stop from 2026-10-17 08:00", title, source notice, "Already overridden: Asset, Description, Failure mode", start/end read-only ("belong to the source"), 6 Override… buttons, 11 source-owned fields disabled, axe | PASS | 0 axe issues | edit-leila-A-edit.png | — | — |
| Override… | leila | inline unlock | PASS | Unlocks the field: "your change is recorded as an override of the source value" | edit-leila-override.png | — | — |
| Discard (cancel) | leila | confirmation, return | PASS | "Discard your changes?" → back to the event; browser Back then returns to the list (edit uses replace) | edit-leila.json | — | — |
| Breadcrumb / title wording | leila | consistency | WARN | The breadcrumb reads "Event Hub › **Event** › HDPE Extruder 1 · Stop from …". The middle crumb is the generic "Event", while the event page's h1 is "Downtime · HDPE Extruder 1", and this page says "Stop" (L16) | edit-leila-override.png | Low | `use-back-target.ts` `labelOfPath` → use the event title |
| Split dialog | leila | open, default split 08:30, two parts, reason required, Split disabled, Cancel | FAIL (a11y) | Works, but axe **serious `aria-input-field-name`**: the drag control (`.block`) has no accessible name (F6) | edit-leila-split-dialog.png | Medium | `components/split-dialog.tsx`: add `aria-label="Split at"` to the slider |
| Close-stop dialog | — | — | N/A | No open stop exists (Current stops 0) | — | — | — |
| Retract dialog | — | — | N/A | Shown for manual events only; the plant has none, and creating one is not allowed | `event-detail-actions.tsx` | — | — |

## Downtime Analysis — `/downtime`, `/stops`, `/causes`, `/trends`, `/reliability`

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| all 5 pages | leila (day, shift A, `shifts=A`) | h1 "Downtime Analysis · <page>", title, tabs carry filters, console, network, axe | PASS | All 5 tab links keep the query string | dt-leila-*-*.png, dt1-*.json | — | — |
| Overview KPIs (day, shift A) | leila | see "Data correctness" above; More downtime figures; Current stops | PASS | — | dt-leila-day-downtime.png, dt2-leila-more-figures.png | — | — |
| Overview: Schedule class | leila | class=planned | FAIL | (F2) The trend becomes "No data", but the **summary tiles stay 1 h 30 min / 66.7 % / 2 / 93.8 %**, and no note says the summary ignores schedule class | dt3-leila-planned.png | Medium | `components/kpi-summary.tsx`: pass `class`, or add "Summary is for all classes" to the note |
| Overview: controllable view | leila | toggle → "Controllable availability 93.8 %" tile; reload | WARN | Works. Not kept in the URL, so it resets on reload (L17) | dt2-leila-controllable.png | Low | `kpi-summary.tsx`: URL param |
| Overview: product / shift / crew filters | leila | options; `shifts=A` | PASS / WARN | Products HD5502, TRAIN-B; Shifts A/B/C; Crews A/B/C. `shifts=A` gives the Shift A figures. Label reads "Shifts: 1 selected" instead of "Shifts: A" (L19) | dt1-leila-shiftfilterA.json | Low | `multi-check-select.tsx`: name a single selection |
| Overview: date inputs | leila | Period dates | WARN | For one production day (17 Oct 06:00 → 18 Oct 06:00), the inputs read "From 17/10/2026 · To (inclusive) 18/10/2026", which suggests two operational days (L20) | dt3-leila-planned.png | Low | `downtime-filters-bar.tsx`: show the operational date (`to` minus 1 day) |
| Overview: unit chip | leila | header | WARN | The header chip says "Unit: time in h:mm", but durations are shown as "1 h 30 min" (L21) | dt-leila-day-downtime.png | Low | `downtime-header.tsx` |
| Overview: KPI help text | leila | wording | WARN | Internal references on screen: "SME D12 pilot targets", "(SME D4)" (L22) | dt2-leila.json | Low | `model/kpi-display.ts` |
| Export period summary | leila | disabled reason, start | WARN | Disabled until "Approved only" is ticked, and the reason is only in a `title` tooltip (not accessible on a disabled button). With approved=1: 202, toast "Export started — The period summary is being prepared…", but the toast gives no link to where the file is (L23) | misc-export.png | Low | `components/downtime-header.tsx`: visible hint plus a link to the export |
| Stops & Timeline | leila | list (same columns and chips as Event Hub), State timeline (2 segments with aria-labels "Stop 2026-10-17 08:00 · 1 h · Unplanned"), open → back | PASS | The scope note says which filters do not apply | dt2-leila-timeline.png | — | — |
| Causes & Pareto | leila | Lost production (qty/value), Downtime reasons drill 3 levels (breadcrumb "All reasons › MECHANICAL · Mechanical › DRIVE-TRAIN · Drive train"), leaf → "Stops · MECH-GEARBOX Gearbox failure" list, frequency, Assets / bad actors | PASS | Bad actors: Main drive and gearbox 1 h 66.7 %, "No asset" 30 min 33.3 % | dt2-leila-pareto-l1.png, dt2-leila-pareto-drill.png, dt2-leila-bad-actors.png | — | — |
| Causes / Stops / Reliability with `shifts=A` | leila | filter scope | WARN | These pages ignore product, shift and crew, and say so in a note, but the `shifts=A` filter stays in the URL. Going from Overview (Shift A: 1 h) to Causes shows the whole day (42 t) and Reliability shows MTBF 22 h 30 min. Shift-A MTBF is only available by choosing the 06:00–14:00 window (as in the 18 Oct report) (L24) | dt1-leila-shiftfilterA.json | Low | show an "ignored here" chip on the filter |
| Trends: time trend | leila | Day / Shift buckets, table | PASS / WARN | Shift table: "2026-10-17 A unplanned 1 h", "2026-10-17 C 30 min". Legend shows raw lowercase "planned unplanned external unknown" (the table says "Not classified"), and the axis reads "1 h 15min" (missing space). The subtitle repeats the Overview's "What is down, why…" (L25) | dt2-leila-trend-shift.png | Low | `components/charts/trend-chart.tsx` |
| Trends: tooltip contrast | leila | axe | FAIL (a11y) | serious `color-contrast` on `.recharts-tooltip-item` (4 nodes) | dt-leila-day-trends.png | Low | tooltip text colour tokens |
| Trends: Crew comparison | leila | table | PASS | "No crew 1 h 30 min 100 % 2 periods": the 17 Oct periods have no crew rotation. Data, not a bug | dt2-leila-trends-Crew.png | — | — |
| Trends: Previous-period comparison | leila | both sides | **FAIL** | (F1) The current side shows "**Some values were not accepted** · Views: Must contain at least 1 elements · Retry · Copy support reference". Network: `422 GET /api/v2/reports/downtime-bundle?from=…&to=…` with no `views` | dt3-leila-calendar-comparison.png | **High** | `components/calendar-comparison.tsx` / `hooks/use-downtime-bundle.ts`: send the views the KPI cards need |
| Reliability | leila | day and shift windows; Details | PASS / WARN | Values correct (see the table above). The definition line reads "**D13 default: FailureWO event** or unplanned stop…", an internal code and a raw key (L26) | dt-leila-day-reliability.png | Low | `components/reliability-card.tsx` |
| Layout 768×1024 | omid | 10 pages, drawer | PASS | No page-level horizontal scroll (wide tables scroll inside their own container). "Open navigation" opens the drawer | l768-*.png, layout.json | — | — |

## Owner questions

- **Q1.** Should production_accountant (Sara) be able to code, edit, split, merge and bulk-code stops? Today every role except viewer can (`canWriteEvents`).
- **Q2.** Should the Downtime summary follow the Schedule class filter (F2), or should it say that it does not?

## Use cases verified

Event Hub:
- window presets;
- custom range (apply, cancel, invalid);
- current shift and named shifts;
- Units, Type, Reason, State, Coding, Verification and min-duration filters;
- sort by start and duration;
- To code;
- Reset filters;
- URL deep link and reload;
- CSV export;
- Current stops panel;
- Bulk code (open, preview, cancel);
- Code all matching (open, cancel);
- Merge (open, cancel);
- row Code dialog (open, cancel);
- RCA trigger settings link by role, and the page by direct URL for 7 roles.

Event create:
- open;
- required-field validation;
- asset picker gated by unit;
- Now;
- end before start;
- duration mode;
- Keep draft and close;
- draft restore;
- Discard confirmation;
- leave without saving.

Event detail (both stops):
- summary chips;
- Attributed losses (USD and IRR);
- coding verification panel;
- RCA panel and links;
- all 7 tabs;
- deep-link tabs;
- period and investigation links (omid, sara);
- back target from the list, Causes & Pareto and Stops & Timeline.

Edit page:
- open;
- source-owned fields read-only;
- Override;
- Discard;
- Back.

Dialogs:
- Split dialog (open, cancel).
- Close stop and Retract: **not reachable**. No open stop or manual event exists.

Downtime Analysis (all 5 pages, day and Shift A windows plus the `shifts=A` filter):
- KPIs vs the guide;
- More figures;
- controllable view;
- product, shift and crew filters;
- schedule class;
- window presets;
- export;
- 3-level Pareto drill to stops and back;
- frequency;
- bad actors;
- lost value;
- state timeline;
- trend by shift;
- crew comparison;
- previous-period comparison;
- Reliability.

Roles: omid, leila, shirin, farid, reza, sara, admin. Layout pass at 768 px.

## Data created

- **1 export job**: Leila, `POST /v2/exports` (period summary, 17 Oct, approved only). The audit log has `CREATE Exports` at 09:05:59Z. This was allowed by the brief ("you MAY trigger exports").
- **1 audit-log row** from the bulk-code preview: `CREATE ProductionEvent "unknown"` at 09:07:06Z (F5b). It was a read-only preview: no event changed.
- **Nothing else.** The two 17 Oct stops are unchanged:
  - `67cc2c2a…`: row_version 7, coded, updated 2026-10-18 14:41Z.
  - `3ea50fb2…`: row_version 5, uncoded, updated 2026-10-18 17:44Z.
- The event-form drafts were discarded, and every browser context was thrown away.
- Two other things were blocked in the browser and never reached the server: one `POST /v2/production-events` (the end-before-start test) and one earlier export attempt.
