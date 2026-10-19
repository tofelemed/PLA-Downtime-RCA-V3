# QA audit: PLA analytics, Dashboard, Reports, Bad actors

Agent: PLA-ANALYTICS · run 2026-10-19 (plant time) · plant Marun / HDPE plant (HDPE-TRAIN), unit HDPE Extruder 1, production day 17 Oct 2026.

Method: headless Chromium (repo `@playwright/test`), UI login per user, every API write blocked by a route guard. The only writes allowed were login, refresh and export jobs. Each page was captured for URL, h1/title, h2/h3, console errors, failed requests (≥ 400), axe serious/critical, `demo` text, raw uuids/snake_case and a screenshot, at 1440×900 plus a 768×1024 pass. Server figures were cross-checked through `GET /api/v2/reports/*` as Leila.

Windows used: day = `2026-10-17T02:30Z → 2026-10-18T02:30Z` (06:00–06:00 plant time), shift A `02:30–10:30Z`, B `10:30–18:30Z`, C `18:30Z–02:30Z`, plus the rolling presets.

Evidence: screenshots, scripts, exports and `results.jsonl` (109 page captures) are in `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\pla\`. Evidence names below are files in that folder.

## Summary

| Result | Count |
|---|---|
| Checks PASS | 41 |
| FAIL | 0 Critical, 0 High, 6 Medium |
| WARN | 13 Low, 2 Medium questions |

- **Numbers are correct everywhere they appear.** For the day and every shift, both ledgers close to actual, and OEE, valuation, the exports and the Dashboard agree with the server.
- **No failures in the logs.** No console errors, failed requests or attempted writes on any page. There is no "demo" text and no raw uuid in page text.
- **Accessibility:** three axe serious violations.

### Key facts verified (server = UI)

| Figure | Day 17 Oct | Shift A | Shift B | Shift C |
|---|---|---|---|---|
| Waterfall, plan ledger | 672 − 42 − 4 − 5 = 621, closes | 224 − 28 − 4 − 3 = 189 | 224 − 1 = 223 | 224 − 14 − 1 = 209 |
| Waterfall, capacity ledger | 672 → 621, same steps, closes | same as plan | same | same |
| Loss by OEE component | A 42 / P 4 / Q 5 = 51 t | 28 / 4 / 3 = 35 | Q 1 | A 14 / Q 1 |
| OEE, operational = reconciled | A 93.75, P 99.3651, Q 99.2013, OEE 92.4107 % | A 87.5, P 97.9592, Q 98.4375, OEE 84.375 % | 100 / 100 / 99.5536 / 99.5536 % | 93.75 / 100 / 99.5238 / 93.3036 % |
| UI (1 decimal) | 93.8 / 99.4 / 99.2 / 92.4 % | 87.5 / 98.0 / 98.4 / 84.4 % | 100.0 / 100.0 / 99.6 / 99.6 % | 93.8 / 100.0 / 99.5 / 93.3 % |
| Value, contribution margin (default) | 7,650 USD = 4,590,000,000 IRR | 5,250 USD | 150 USD | 2,250 USD |
| Value, economic impact (alternative) | 7,300 USD = 6,900 lost contribution (46 t) + 400 downgrade (5 t); 4,380,000,000 IRR | 4,200 + 600 + 240 = 5,040 USD | — | — |

**Shift A quality after the correction.** The server gives 0.984375 = 189 good / 192 gross. Operational: 24,300 s / 24,685.71 s, which is the same ratio because both terms are at 28 t/h. Reconciled: 189 / 192.
- The 98.9583 % in `docs/MARUN_E2E_REPORT.md` §2 is the pre-restatement value (190 / 192).
- The late laboratory result moved 1 t from good to rejected: gross stays 192 and good becomes 189.
- So Q = 98.4375 % and OEE = 189 / 224 = 84.375 % (it was 84.8214 %). Availability (87.5 %) and performance (97.9592 %) are unchanged.
- The day changes the same way: Q 621/626 = 99.2013 % and OEE 621/672 = 92.4107 % (it was 92.5595 %).

**Valuation basis now in force.** The policy default is contribution margin: the loss tree's "Value (policy default view)" returns `contribution_margin` with `defaultView: true`, and the PDF says "Contribution margin (valuation policy version 2)". This resolves the "economic impact default" note in the Marun report. Economic impact is shown as a separate view and never added to margin.

## Top findings

1. **M1 (Medium): the window control shows a production day as two calendar days.** The day window (06:00–06:00) reads "Custom window · 2026-10-17 – 2026-10-18", and so do shift C and the Reports header. The date picker's "To (inclusive)" then shows 18 Oct. Re-picking 17→17 silently changes the window to midnight–midnight. The native date inputs show the browser locale (`17/10/2026`), not the plant format (`2026-10-17`) used on the button.
2. **M2 (Medium): Loss events "Lost quantity" is "—" for both stops.** The Shift A stop carries 28 t and the Shift C stop 14 t of approved loss. The column shows the event's own quantity, not the attributed loss.
3. **M3 (Medium): drill-downs that end in an empty list.** A quality bar or row leads to "No loss events in this window", because dispositions are not events. The SPEED-LOSS reason row opens Event Hub with nothing in it: it is a manual line with no event.
4. **M4 (Medium): the Dashboard "All repeat causes" link lands on the loss tree.** It points to `/pla-analytics/losses?window=7d#repeat-causes`, but the page reads `?breakdown=repeat-causes` and ignores the hash.
5. **M5 (Medium): a raw failure-mode key on Bad actors.** With "Asset and failure mode", the column reads `gearbox_failure`.
6. **M6 (Medium, a11y): Bad actors at 768 px.** The table's scroll region is not keyboard-focusable (axe serious `scrollable-region-focusable`).
7. **Q1 (Medium, question): operator access is inconsistent.** Omid (operator) sees all six PLA pages, including Loss Valuation with USD/IRR money and the CSV export. Reports and Bad actors show him "No access", yet every PLA page offers him a "Reports & exports" link that leads to that refusal.

## Results per page

### PLA Overview `/pla-analytics`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | Default load | PASS | Last 7 days: 672 → 621, "Provisional", "1 slice left out: No calculation run", "86 % of periods calculated" | leila-overview-default.png | — | — |
| Leila | Day window, plan ledger | PASS | 672 −42 −4 −5 = 621, "Closes to actual", "Approved" | leila-day_pla-analytics.png | — | — |
| Leila | Ledger switch | PASS | Capacity: "Waterfall · capacity ledger (capacity → good)", 672 → 621; `ledger=capacity` kept in the URL | leila-day-overview-capacity.png | — | — |
| Leila | Approved-only toggle, reload | PASS | `approved=1` persists after reload; same figures | leila-day-overview-approved.png | — | — |
| Leila | Bar drills and Back | PASS | Availability, Performance and Quality links go to Loss Breakdown › Loss events with `oee=` set; Back restores the overview | leila-drill-availability.png | — | — |
| Leila | Window control | FAIL | See M1: two calendar days for one production day; native inputs in browser locale | leila-window-panel.png | Medium | `window-range.ts` / `date-inputs`: label by operational day (start of the plant day boundary), or show times "06:00–06:00" as Event Hub does; use the plant-format date input |
| Leila | Window label wording | WARN | Deep links are labelled "Custom window"; the picker's own choice is "Chosen dates" | — | Low | Use one label |
| Leila | Export period summary (CSV) | PASS | Disabled with a reason until "Approved only" is ticked. Then: job "ready · 3 rows", file `traverse-forge-period_summary-2026-10-17.csv` with BOM. Rows A 224/189/35 5,250 USD, B 224/223/1 150 USD, C 224/209/15 2,250 USD; `contribution_margin`; status approved | export-overview-*.csv | — | — |
| Leila | Export file content | WARN | `requested_by` is a user uuid; header `timezone,UTC` while the UI shows plant time | export CSV | Low | Add the requester's name |
| Leila | Shifts A, B, C | PASS | 224→189, 224→223, 224→209; all close to actual | leila-shiftA.png … shiftC.png | — | — |
| Leila | 768 px | PASS | No horizontal scroll; axe clean | leila-768_pla-analytics.png | — | — |

### PLA Loss Breakdown `/pla-analytics/losses`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | Loss tree by reason, day | PASS | MECH-GEARBOX 28 t (54.9 %), "Not coded" 19 t (4 lines), SPEED-LOSS 4 t; total 51 t | leila-day_pla-analytics_losses.png | — | — |
| Leila | "Not coded" group | WARN | It holds 5 t of quality dispositions plus the 14 t uncoded stop. Dispositions are not stops to code, so "Not coded" overstates the coding gap. Event Hub and Dashboard say "Uncoded" | — | Medium | `loss-table.tsx:28`: split "No reason (quality disposition)" from "Uncoded stop", or label it "No reason code" |
| Leila | Group by OEE component | PASS | Availability 42 / Quality 5 / Performance 4 = 51 t; shift A 28/4/3 | leila-day-losses-oee.png | — | — |
| Leila | Heading capitalisation | WARN | "Lost quantity by oee component · plan ledger": "oee" is lower case | — | Low | Use the option label |
| Leila | Grammar | WARN | "Total (1 groups, 1 lines)", "over 1 periods" | — | Low | Pluralise |
| Leila | Row drills | FAIL | See M3. Quality row → "No loss events in this window". SPEED-LOSS row → empty Event Hub. MECH-GEARBOX row → Event Hub with the 08:00 stop (PASS) | leila-drill-quality-events.png, leila-drill-speedloss-events.png, leila-drill-gearbox-events.png | Medium | `model/links.ts` `lossGroupLink`/`waterfallBarLink`: link quality to the periods' dispositions, and manual-only reasons to the loss lines; or no link with a tooltip |
| Leila | Metric switch | PASS | Value (policy default) = margin 7,650 USD; Economic impact 7,300 USD, labelled "Valuation views are never added to each other"; IRR shown | leila-day-losses-metric-*.png | — | — |
| Leila | Top opportunities | PASS | 4,200 / 2,850 / 600 USD, total 7,650 | leila-day-losses-opportunities.png | — | — |
| Leila | Repeat causes | PASS (WARN) | Reason: gearbox 1, Not coded 1. The asset table calls the no-asset stop "Not coded"; Dashboard calls it "No asset recorded" | leila-day-losses-repeat-causes.png | Low | `repeat-causes-tab.tsx:20`: say "No asset recorded" for the asset grouping |
| Leila | Loss events | FAIL | See M2: "Lost quantity —" for both stops | leila-day-losses-loss-events.png | Medium | `tabs/loss-events.tsx:27` shows `e.quantity` (the event's own quantity). Show the attributed approved loss, or rename the column |
| Leila | Downtime drill and Back | PASS | "Drill into the stops of this scope" → `/downtime/stops` with the same window: both stops; Back works | leila-drill-downtime.png | — | — |

### PLA Trends `/pla-analytics/trends`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | OEE by day and by shift | PASS | Day 93.8/99.4/99.2/92.4; shift buckets A/B/C match the OEE table | leila-day_pla-analytics_trends.png, leila-trends-shift.png | — | — |
| Leila | Unaccounted, by unit, by product, reconciled | PASS | 0 t in every shift; unit and product 92.4 % | leila-trends-*.png | — | — |
| Leila | axe | FAIL | serious `color-contrast` on the Recharts tooltip (4th item) at both widths | results.jsonl | Medium (a11y) | `charts/series-chart.tsx`: tooltip item colours |
| Leila | OEE chart text alternative | WARN | The OEE line chart has no "view values" table (the Unaccounted chart does); option label "Reconciled PLA OEE (labelled)" is odd | — | Low | Add a values table; drop "(labelled)" |

### PLA OEE `/pla-analytics/oee`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | Day, both policies | PASS | Operational and reconciled both 93.8 / 99.4 / 99.2 / 92.4 % with formula captions | leila-day_pla-analytics_oee.png | — | — |
| Leila | Shifts | PASS | A 87.5/98.0/98.4/84.4, B 100/100/99.6/99.6, C 93.8/100/99.5/93.3 | leila-shiftA-oee.png | — | — |

### PLA Reconciliation & Data Quality `/pla-analytics/reconciliation`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | Counts, day | PASS | 3 periods: Approved 3, Balanced 3, Unaccounted 0, Overdue 0, "Nothing overdue." | leila-day_pla-analytics_reconciliation.png | — | — |
| Leila | Count → period list → Back | PASS | "Approved 3" → `?periods=approved` lists C/B/A (Approved, Balanced, Open link to `/plans/…/periods/…`). "Back to the counts" and browser Back both work | leila-day-recon-periodlist-approved.png | — | — |
| Leila | Period label | WARN | "2026-10-17 C (22:00 (+03:30 Asia/Tehran))": nested brackets | — | Low | Use "2026-10-17 C · 22:00" |
| Leila | Actuals quality coverage | PASS | 3 complete, coverage 100 %, measured 626 t | leila-day-recon-coverage.png | — | — |
| Leila | Rolling 7 days vs Dashboard | PASS | Not calculated 1, Draft 3, Approved 3: same as the Dashboard tiles | leila-recon-7d.png | — | — |

### PLA Loss Valuation `/pla-analytics/valuation`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | Default basis | PASS | Opens on Contribution margin: 7,650.00 USD (day), A 5,250, B 150, C 2,250 | leila-day_pla-analytics_valuation.png | — | — |
| Leila | Economic impact components | PASS | Lost contribution 6,900 USD (46 t) + downgrade 400 USD (5 t), a separate view, not added to margin | leila-day-valuation-economic.png | — | — |
| Leila | IRR toggle | PASS | Margin 4,590,000,000 IRR; economic 4,140,000,000 + 240,000,000 IRR (stored values, rate 600,000) | leila-day-valuation-*-IRR.png | — | — |
| Leila | Standard / operational cost | WARN | "— USD (not valued)" with a "Provisional" badge on an approved day, but no reason, although the page says missing inputs remain unvalued "with its reason" | leila-day-valuation-Standard-cost.png | Low | Show the reason (no standard cost / hourly rate in the policy); use "Not valued", not "Provisional" |
| Leila | Duplicate currency toggle | WARN | The page has its own "$ USD / IRR" toggle beside the header one (they stay in sync) | — | Low | Keep one |
| Leila | Capacity ledger | PASS | 7,650 USD | leila-day-valuation-capacity.png | — | — |

### Dashboard `/dashboard`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | 7 d tiles vs PLA, same window | PASS | OEE 92.4, A 93.8, P 99.4, Q 99.2, reconciled 92.4; workflow counts match Reconciliation | leila-dashboard-7d.png | — | — |
| Leila | Two availabilities on one page | WARN | Downtime "Scheduled availability 96.9 %" next to OEE availability 93.8 %. They are different scopes (calendar vs calculated periods, per MARUN report §2.5); the captions explain it only partly | leila-dashboard-7d.png | Low | Caption the downtime tile "all scheduled time in the window, incl. draft periods" |
| Leila | "Stops to code" tile | WARN | No count, only a link (by design: the list has no total). Every other tile has a number | — | Low | Show "1+" from the first page, as the other tiles do |
| Leila | "All repeat causes" link | FAIL | See M4 | links dump in s7 output | Medium | `dashboard-links.ts`: use `?breakdown=repeat-causes` |
| Leila | 24 h window | WARN | OEE tiles read "— Not available Not available No slices" (the text repeats) | leila-dashboard-24h.png | Low | One message |
| Leila | 30 d, 768 px, axe | PASS | — | leila-dashboard-30d.png, leila-768_dashboard.png | — | — |

### Reports `/reports`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | OEE and downtime | PASS | OEE by plant date 2026-10-17: 93.8/99.4/99.2/92.4; downtime by reason: MECH-GEARBOX 1 h 66.7 %, Not coded 30 min 33.3 % | leila-reports-day-production.png | — | — |
| Leila | Reconciliation | PASS | Same counts as the PLA page | leila-reports-day-reconciliation.png | — | — |
| Leila | Loss value | PASS (WARN) | Margin 7,650 USD and economic components 6,900 + 400, shown separately. The captions say "approved revision, else the open draft" while the page is "Approved revisions only" | leila-reports-day-value.png | Low | Make the caption follow the toggle |
| Leila | Exports | PASS | Period summary CSV (3 rows) and PDF (2 pages, "Contribution margin (valuation policy version 2)", values 5,250/150/2,250 USD). Loss lines CSV (6 rows) and PDF | export-reports-*.csv/.pdf | — | — |
| Leila | Loss lines export content | WARN | The PDF has no reason column, so MECH-GEARBOX does not appear. In the CSV, `reason` holds the manual line's comment and the coded line's `reason` is empty; there are only `reason_code_id` uuids | export-reports-2-*.csv | Medium | Add reason code and name columns to both formats |
| Leila | Header range | WARN | "2026-10-17 – 2026-10-18" for one production day (M1) | — | Low | — |

### Bad actors `/reliability/bad-actors`

| Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| Leila | October 2026 | PASS | #1 EXT1-Main Main drive and gearbox 28.00 t, 4,200.00 USD (2,520,000,000 IRR), 1 stop, 1 h, "Below the limit · 1 h of 8 h"; "4 of 7 periods not approved yet" | leila-bad-actors.png | — | — |
| Leila | Month picker | PASS | 24 Gregorian months; September 2026 → "No data"; URL persists across reload | leila-bad-actors-prev-month.png | — | — |
| Leila | Failure-mode grouping | FAIL | See M5: `gearbox_failure` shown raw | leila-bad-actors-fm-value.png | Medium | Show the failure-mode name |
| Leila | Copy and format | WARN | Raw server basis text starting in lower case ("approved plan lines … CA8 …"); "28.00t" / "4,200.00USD" with no space; window "2026-08-03 00:00 – 2026-11-01 00:00", exclusive end shown as the 1st | — | Low | Plain-language basis; `<Quantity>` spacing; inclusive end date |
| Leila | No drill | WARN | Rows are not links (to the asset's events or the RCA) | — | Low | Link the asset to Event Hub filtered by asset |
| Leila | 768 px | FAIL | See M6: table overflows into a non-focusable scroll region | leila-768_reliability_bad-actors.png | Medium | Add `tabIndex=0` and `role=region` with a label to the scroll container |
| Leila | Heading case | WARN | h1 "Bad actors"; menu and No-access page say "Bad Actors" | omid_reliability_bad-actors.png | Low | Use one case |
| API | `month=1405-07` | WARN | Accepted and read as Gregorian year 1405 (returns an empty result) instead of 400 | probe-leila.json | Low | Validate the year range |

### Roles

| Role | Sidebar (PLA-related) | PLA pages | Reports | Bad actors | Figures |
|---|---|---|---|---|---|
| Leila (production_engineer) | Dashboard, Reports, Plans, PLA, Bad Actors | all 6 | yes | yes | identical |
| Reza (manager_approver) | same | all 6 | yes | yes | identical |
| Sara (production_accountant) | same | all 6 | yes | yes | identical |
| Kamran (finance_approver) | same | all 6 | yes | yes | identical |
| SuperAdmin | same | all 6 | yes | yes | identical |
| Omid (operator) | Dashboard, PLA (no Reports, Bad Actors or Plans) | all 6, including Loss Valuation money and the CSV export | "No access · Your roles in this plant do not include Reports" | "No access" | identical |

Q1 (Medium, question): an operator can see loss value on `/pla-analytics/valuation` but not on `/reports?view=value`. Every PLA page shows Omid a "Reports & exports" link that leads to the refusal. Either hide the link when `canViewAnalysis` is false (`analytics-header.tsx`), or decide in `plans/DECISIONS.md` whether operators see money.

Omid can now open `/plans/…/periods/…` from the period list. The MARUN report's earlier "No access" for him there no longer applies.

## Use cases verified

- Waterfall closes to actual in both ledgers for the day and each shift (672 − 42 − 4 − 5 = 621; 224 → 189, 223, 209).
- Loss breakdown by OEE component, 42 / 4 / 5, and by reason.
- OEE operational and reconciled for the day and each shift. The Shift A Q change after the correction is explained above.
- Plan vs capacity ledger switch, approved-only toggle, URL persistence and reload.
- Window control: presets and plant dates (M1).
- Drill-downs: bars and rows to loss events, reason to Event Hub, scope to Downtime stops, counts to the period list, with Back.
- Valuation: contribution margin default, economic impact as a separate view never added, IRR toggle, standard and operational cost not valued.
- Exports: PLA period summary CSV; Reports period summary and loss lines in CSV and PDF, downloaded and content checked.
- Dashboard vs PLA consistency (7 d, 24 h, 30 d).
- Reports views: OEE by day, downtime by reason, reconciliation status, loss value.
- Bad actors: month picker, grouping, ranking, IRR.
- Roles: Leila, Reza, Sara, Kamran, Omid and SuperAdmin.
- Layout at 768 px.

## Data created

None in the plant records. Every non-GET API call was blocked except login, refresh and the export jobs. Export jobs were created through the UI (permitted, read-only): 1 PLA period summary CSV and 4 Reports exports. The display-currency choice is browser-local only.

## Re-test 19 Oct

Run 2026-10-19 15:00 plant time, after commit `dd04dd24` and its deploy. The method is the same as round 1: headless Chromium, UI login, every non-GET API call blocked except login, refresh and export jobs. Pages were captured at 1440×900 and 768×1024, and the server figures were re-probed through `GET /api/v2/reports/*`.

Evidence is in `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\pla\r2\`. That folder holds the scripts `omid.mjs`, `omid2.mjs`, `leila.mjs`, `leila2.mjs`, `roles.mjs`, `w768.mjs` and `draft.mjs`, plus `results.jsonl`, the `r2-*.png` screenshots, the `r2-export-*` files and `probe-leila.json` (`probe-leila-round1.json` is the round-1 copy).

**FIXED 19 / PARTIAL 5 / OPEN 4 / NEW 9**

**Figures are unchanged.** For the day and for shifts A, B and C, the waterfall, OEE, loss value, reconciliation and Bad actors responses match round 1:
- day: 672 − 42 − 4 − 5 = 621
- OEE 92.4 %
- contribution margin 7,650 USD (A 5,250, B 150, C 2,250)
- economic impact 6,900 + 400 USD
- Bad actors: 28.00 t, 4,200.00 USD

Only the loss tree's response changed, and the change is additive: `eventLines` and a `quality_dispositions` group. Its totals are still 51 t. The UI matches the server for Leila, Sara, Kamran, Reza, Farid, Neda and SuperAdmin. There are no console errors, no failed requests and no "demo" text, raw uuids or snake_case on any page. axe reports nothing serious or critical at either width.

### Round-1 findings

| # | Finding (round 1) | Status | Evidence (r2 folder) |
|---|---|---|---|
| M1 | A production day shown as two calendar days; date inputs in browser locale; re-picking dates switches to midnight | PARTIAL | The day window now reads "Chosen dates · 2026-10-17 (production day 06:00–06:00)", on Reports too. The inputs are text `YYYY-MM-DD` labelled From / To (inclusive). Re-picking 17→17 keeps 02:30Z → 02:30Z (`leila2.out`). **Still open:** a shift-C window (22:00–06:00) reads "Chosen dates · 2026-10-17 – 2026-10-18" (`leila.out`, "SHIFT C WINDOW") |
| M2 | Loss events "Lost quantity —" | FIXED | The column is "Lost quantity (attributed)": the 02:00 stop shows 14.00 t and the 08:00 stop 28.00 t (`r2-leila-loss-events.png`) |
| M3 | Drill-downs that end in an empty list | PARTIAL | Fixed: the quality bar and row open "Periods · quality losses from lot dispositions" with "Open dispositions" (`r2-leila-drill-quality.png`). The SPEED-LOSS row says "Manual loss lines with no event: nothing to open". **Still open:** the Performance bar on Overview and the Performance row of "by OEE component" link to `breakdown=loss-events&oee=performance`, which shows "No loss events in this window". The 4 t is the manual SPEED-LOSS line (`r2-leila-drill-performance.png`) |
| M4 | Dashboard "All repeat causes" lands on the loss tree | FIXED | The link is `?breakdown=repeat-causes` and opens Repeat causes (`r2-leila-dash-repeat.png`) |
| M5 | Raw `gearbox_failure` on Bad actors | FIXED | The column reads "Gearbox functional failure" (`r2-leila-ba-fm.png`) |
| M6 | Bad actors at 768 px: scroll region not focusable | FIXED | axe is clean at 768 for both groupings (`r2-leila-768_reliability_bad-actors*.png`) |
| Q1 | Operator sees money; "Reports & exports" link leads to a refusal | PARTIAL | See "Operator (Omid)" below. Money, the toggle, value metrics, Top opportunities, the export and the PLA Reports link are gone. The "Loss valuation" tab and the Dashboard "OEE and downtime report" link still lead Omid to "No access" |
| — | "Not coded" group includes quality dispositions | FIXED | Separate groups: "Not coded" 14.00 t and "Quality (dispositions)" 5.00 t |
| — | Trends tooltip color-contrast (axe serious) | FIXED | axe is clean on Trends at 1440 and 768 |
| — | Loss lines export without reason | FIXED | The CSV appends `reason_code`, `reason_name` and labels (MECH-GEARBOX / Gearbox failure). The PDF has a Reason column ("MECH-GEARBOX · Gearbox failure", "SPEED-LOSS · Reduced extrusion") (`r2-export-reports-2/3-*`) |
| L | "Custom window" vs "Chosen dates" | FIXED | Every deep link reads "Chosen dates" |
| L | Export `requested_by` uuid, `timezone,UTC` | FIXED | Adds `requested_by_name,Leila`, `plant_timezone,Asia/Tehran` and plant-time columns. The PDF shows "Requested by Leila · Time zone Asia/Tehran". BOM present |
| L | "by oee component" | FIXED | "Lost quantity by OEE component · plan ledger" |
| L | "1 groups", "1 periods" | FIXED | "Total (4 groups, 6 lines)", "over 1 period" |
| L | Repeat causes by asset says "Not coded" | FIXED | "No asset recorded" |
| L | OEE trend chart: no values table; "(labelled)" | PARTIAL | "(labelled)" was removed. There is still no "View values" table for the OEE line chart, only "Calculation details" |
| L | Period label with nested brackets | FIXED | "2026-10-17 C · 22:00" |
| L | Standard / operational cost "— Provisional" with no reason | FIXED | "Not valued in USD (No approved valuation rate)" and "(Impact code missing)" |
| L | Duplicate currency toggle on Loss valuation | FIXED | One toggle (header) on every PLA page and Reports. Bad actors still has two: see N4 |
| L | Dashboard: two availabilities without a clear caption | OPEN | "Scheduled availability 97.3 % · Run time ÷ scheduled time" next to OEE availability 93.8 %, with no scope caption |
| L | Dashboard "Stops to code" tile has no count | OPEN | Still only "View stops to code" |
| L | Dashboard 24 h repeated "Not available" | FIXED | "— · Not available · No slices" |
| L | Reports caption does not follow the revisions toggle | FIXED | "approved revisions only" and "approved revision, else the open draft (provisional)" follow the select |
| L | Reports header range shows two dates | FIXED | "2026-10-17 (production day 06:00–06:00)" |
| L | Bad actors copy and format | PARTIAL | Spacing fixed ("28.00 t", "4,200.00 USD"). Still shown: the raw lower-case server basis ("approved plan lines … CA8 cumulative same-mode downtime rule…") and an exclusive end "2026-08-03 00:00 – 2026-11-01 00:00" |
| L | Bad actors rows are not links | OPEN | No drill to the asset's events or the investigation |
| L | "Bad Actors" vs "Bad actors" | FIXED | h1, title and the No-access page all read "Bad actors" |
| L | API `month=1405-07` accepted | OPEN | Still 200, read as Gregorian year 1405 |

### Operator (Omid): no money

| Check | Result | Evidence |
|---|---|---|
| Loss valuation menu item | PASS: not offered | sidebar links: Dashboard and PLA only |
| `/pla-analytics/valuation` direct | PASS: "No access · Your roles in this plant do not include Loss valuation." | `r2-omid_pla-analytics_valuation.png` |
| USD / IRR toggle | PASS: absent on Dashboard, all PLA pages, Reports, Bad actors and the event page | toggle count 0 |
| Loss tree metric | PASS: "Lost quantity" only. `?metric=margin` falls back to quantity | `r2-omid_pla-analytics_losses_metric_margin.png` |
| Top opportunities | PASS: tab hidden. `?breakdown=opportunities` shows the loss tree | `r2-omid_pla-analytics_losses_breakdown_opportunities.png` |
| Period summary export | PASS: no export button on any PLA page | — |
| "Reports & exports" header link | PASS: gone from every PLA page | — |
| Reports, `/reports?view=value`, Finance, Bad actors | PASS: No access | `r2-omid_reports*.png` |
| Period page (from the period list) | PASS: opens on Actuals & quality only. `/value`, `/review` and `/history` redirect to `/actuals`. No money | `r2-omid-period*.png` |
| Event page, Attributed losses | PASS (WARN): "Availability: 28.00 t" with no amount, but the label "Value basis: Contribution margin" is still shown (N5) | `r2-omid-event-Losses.png` |
| Quantities | PASS: waterfall 672 → 621, loss tree 51 t, OEE 92.4 %, loss events 14 / 28 t, Dashboard tiles | `r2-omid_*.png` |
| PLA tab "Loss valuation" | **FAIL (N1)**: shown on every PLA page and leads to No access | `r2-omid-valuation-tab-click.png` |
| Dashboard "OEE and downtime report" | **FAIL (N2)**: `/reports?view=production`, No access | `omid2.mjs` output |
| Server | **WARN (N3)**: as Omid, `GET /v2/reports/loss-value`, `loss-tree?metric=margin` and `bad-actors` return 200 with USD/IRR values | API probe |

### New findings

| # | Page / route | Role | Result | Finding | Severity | Suggested fix |
|---|---|---|---|---|---|---|
| N1 | All PLA pages, tab bar | Omid | FAIL | The in-page PLA tab bar still lists "Loss valuation", which opens "No access". The menu and route are gated but the tab bar is not | Medium | Filter the tab bar's `PLA_PAGES` by the same capability as the menu (`canViewMoney` for `valuation`), e.g. in the PLA tab nav component |
| N2 | `/dashboard`, OEE section | Omid | FAIL | The header link "OEE and downtime report" → `/reports?view=production` is a refusal for operators | Low | Hide it without `canViewAnalysis` (Dashboard link builder) |
| N3 | API `/v2/reports/loss-value`, `loss-tree` (money metrics), `bad-actors` | Omid | WARN | No money is a UI-only rule: an operator's token still receives values, and also Bad actors data although its page refuses him. DECISIONS 19 Oct names server redaction as a follow-up | Medium | Server-side `canViewMoney` check: 403, or value fields redacted |
| N4 | `/reliability/bad-actors` | all | WARN | The page has its own "$ USD / IRR" toggle in addition to the header's (2 toggles), against "one display-currency toggle per screen" | Low | `bad-actor-page.tsx`: drop the in-page toggle |
| N5 | `/events/:id` Attributed losses | Omid | WARN | "Value basis: Contribution margin" is shown to an operator without any value | Low | `attributed-losses-card.tsx`: hide the basis line without `canViewMoney` |
| N6 | PLA Overview, rolling preset | Leila | WARN | "Last 7 days · 2026-10-12 – 2026-10-18 (production days 15:04–15:04)": a rolling now − 7 d window is described as production days with the current clock time, and the end date (18) is not the window's end (19 Oct 15:04) | Low | Apply the "production day" wording only when both bounds sit on the day boundary; otherwise show date and time |
| N7 | PLA Reconciliation period list (`?periods=draft`, 7 d) | Leila | WARN | Periods from 18 Oct on show "no plan" (lower case, terse) in "Period accounting", while elsewhere they read "No approved plan covers this period". Bad actors counts them in "5 of 8 periods not approved yet, so their loss is not included", although they cannot be approved | Low | Use the shared wording; leave uncovered periods out of the Bad actors "not approved" count, or name them |
| N8 | Window panel | Leila | WARN | Typing a date in another format (`17/10/2026`) shows no inline message; the panel keeps the old window silently | Low | Inline "Use YYYY-MM-DD" validation |
| N9 | Loss lines PDF / CSV | Leila | WARN | The uncoded Shift C availability line (14 t) has an empty Reason cell instead of "Not coded" | Low | `export-report.ts`: "Not coded" for cause-event lines without a reason |

### Pages swept (re-test)

All six PLA pages, Reports (all four views, with the revisions toggle), Dashboard (24 h, 7 d), Bad actors (both groupings), the window panel, drill-downs and Back, at 1440 and 768.
- **Leila:** full check list.
- **Omid:** money visibility.
- **Sara, Kamran, Reza, Farid, Neda and SuperAdmin:** access and figures. Each has PLA, Loss valuation, Reports and Bad actors, with identical figures. Their header badges show the guide role ("Production accountant", "Finance approver", "Manager (approver)", "Reliability engineer", "Quality / Lab approver").
- **Headings:** h1 and title follow the page-name source ("Production loss analysis · Loss breakdown", "Reports", "Bad actors"). No console errors, failed requests or axe serious/critical issues.

### Data created (re-test)

None in the plant records. Export jobs were created through the UI (permitted, read-only): 1 PLA period summary CSV and 4 Reports exports (period summary CSV/PDF, loss lines CSV/PDF).

## Round 3 re-test (19 Oct 2026)

Run 19 Oct 2026, about 17:00–17:25 Tehran, on the rebuilt Docker stack.
- **Method:** headless Chromium with UI login. Every non-GET call was blocked except login, refresh and export jobs, and no write was attempted.
- **Personas:** Leila (full pass at 1440×900 and 768×1024) and Omid (operator, 1440). Kamran and Reza were used for money and roles. The Bad actors API response was read as Leila.
- **Evidence:** `…\scratchpad\qa\r3\` holds `a1-*.txt`, `a2.txt`, `a3.txt`, `o1` output, `a1-*.png`, `a3-*.png` and `dl\rep-*`.

**17 Oct figures match on every page** (Planning, PLA, Reports and Dashboard):
- Plan 672 t − availability 42 − performance 4 − quality 5 = 621 t good.
- Loss tree 51 t: MECH-GEARBOX 28, Not coded 14, Quality (dispositions) 5, SPEED-LOSS 4.
- OEE 92.4 % (A 93.8 %, P 99.4 %, Q 99.2 %).
- Contribution margin 7,650.00 USD (A 5,250, B 150, C 2,250). Economic impact components 6,900 + 400 USD.
- Bad actors: 28.00 t, 4,200.00 USD.
- The same figures appear in the exported CSV and PDF.

**Clean pages:**
- 17 pages per persona and width: no console errors, no failed requests, no raw ids or snake_case words, no "demo" or "training".
- Units have a space. No horizontal scroll at 768 px.
- axe found no serious or critical issues at either width.

### Verified fixed

- **Production-day windows:**
  - Typing 2026-10-17 → 2026-10-17 in the PLA window panel gives `from=…17T02:30Z&to=…18T02:30Z&window=dates`, which reads "Chosen dates · 2026-10-17 (production day 06:00–06:00)". Reports gives the same.
  - A Shift C window reads "Chosen dates · Production day 2026-10-17 · 22:00–06:00", and Shift A reads "… · 06:00–14:00" (Shift C label fixed).
  - Typing "17/10/2026" or "17.10.2026" shows "Use YYYY-MM-DD, e.g. 2026-10-17" (N8 fixed).
- **Rolling windows show their real bounds:**
  - PLA: "Last 7 days · 2026-10-12 17:04 – 2026-10-19 17:04" and "Last 24 h · 2026-10-18 17:04 – 2026-10-19 17:04" (N6 fixed).
  - Reports covers whole production days: "2026-10-12 – 2026-10-18 (production days 06:00–06:00)", with URL `12T02:30Z → 19T02:30Z`, `window=7d`.
- **Reports, approved and provisional wording:**
  - Under "Approved revisions only" no card says Provisional. The coverage note reads "Incomplete data: only approved periods are counted (50 % of periods approved)."
  - With "Include open drafts (provisional figures)", the header and every card show "Provisional", and the caption reads "approved revision, else the open draft (provisional)".
  - The 18 Oct row reads "No approved plan covers this period · Open Plans" with "—" in its figures.
- **Performance drill-down (M3):**
  - The Overview "Performance loss" control and the "by OEE component" Performance row both open Loss events with "OEE component: Performance".
  - The page says "No loss events in this window: the loss is in the loss lines with no event below".
  - It then lists the manual line: "2026-10-17 A · 06:00 · Performance · 4.00 t · SPEED-LOSS Reduced extrusion rate", with its totalizer evidence.
- **Loss events:** "Loss lines with no event" lists the 4 t SPEED-LOSS line under the event list. The OEE-component grouping is now in the URL (`lossBy=oee`).
- **Bad actors:**
  - The value basis is the frozen approval view (API `viewSource: approved_snapshot`, `view: contribution_margin`; the UI reads "Value basis: Contribution margin", 4,200.00 USD).
  - The window shows inclusive plant dates: "Rolling 90 days: 2026-08-03 – 2026-10-31 (plant dates, both included)".
  - Periods without a plan are named apart: "5 periods not included: No approved plan covers these periods" (N7 fixed).
  - The basis is a sentence without rule codes.
  - An asset row opens its unplanned stops in the Event Hub.
- **Dashboard:**
  - The two availabilities have scope captions: "OEE component of the calculated periods (not the downtime scheduled availability)" and "Run time ÷ scheduled time, from the stop records of the window (not the OEE availability)".
  - "Stops to code" shows a count (1 for 7 and 30 days, 0 for 24 h).
  - The 24 h window says "No approved plan covers these periods".
- **Trends:** the OEE chart has "View values" (a table).
- **Exports:**
  - The Reports period summary and loss lines (CSV and PDF) and the period loss lines CSV all contain approved revisions only.
  - The uncoded Shift C line reads "Not coded" in the CSV `reason_name` and in the PDF Reason column (N9 fixed).
  - The PDF Reason cell wraps inside a taller row, so there is no overprint.
  - The CSV carries `reason_code` and `reason_name` (MECH-GEARBOX / Gearbox failure).
- **Operator (Omid), no money:**
  - The PLA tab bar has no "Loss valuation" (N1 fixed).
  - The Dashboard has no "OEE and downtime report" link (N2 fixed).
  - Reports, Bad actors and `/pla-analytics/valuation` show "No access".
  - There is no currency toggle and no value metric. The loss tree offers "Lost quantity" only.
  - The event page's Attributed losses shows "Availability: 28.00 t" without a "Value basis" line (N5 fixed).
- **Bad actors toggles:** one display-currency toggle on the page (N4 fixed).

### Remaining problems

| # | Page | Persona | What is wrong | Expected | Severity |
|---|---|---|---|---|---|
| R3-P1 | `/reports` (Approved revisions only, Last 7 days) | Leila | "Incomplete data: only approved periods are counted (50 % of periods approved)" counts the three 18 Oct periods in the denominator, although no approved plan covers them and they "need no approval until a plan covers them" (Month close). Bad actors now leaves such periods out and names them apart; Reports does not | Leave no-plan periods out of the approval share (3 of 3), or name them ("3 periods have no approved plan") | Low |
| R3-P2 | `/reports` with "Include open drafts" | Leila | The page subtitle still reads "Approved figures of the chosen units and plant dates, with exports." while the header and every card say Provisional | A subtitle that follows the Revisions choice | Low |
| R3-P3 | `/dashboard?window=24h` | Leila | The OEE tiles give different reasons for the same empty window: OEE, Performance, Quality and Reconciled OEE say "No approved plan covers these periods", while Availability says "No calculated periods" | One reason for the whole tile group | Low |
| R3-P4 | PLA window label for a midnight-to-midnight link | Leila | `from=2026-10-16T20:30Z&to=2026-10-17T20:30Z` (a calendar day, 00:00–00:00) reads "Chosen dates · 2026-10-17". That is the same text as a production day without its "(production day 06:00–06:00)", so the two windows are easy to confuse | Show the times when the bounds are not the production-day boundary ("2026-10-17 00:00 – 2026-10-18 00:00") | Low |
| R3-P5 | `/reliability/bad-actors` | Leila | The review month is Gregorian ("October 2026"; API `calendar: gregorian`), while the plant's month close works in Solar Hijri months (Mehr 1405). From a Bad actors row, the Event Hub reads "Custom window · 2026-08-03 00:00–2026-11-01 00:00" (exclusive end), while Bad actors says "2026-08-03 – 2026-10-31 (both included)" | Review months in the plant calendar; the Event Hub label in the same inclusive form (downtime owners) | Low |
| R3-P6 | Loss lines PDF (Reports and period) | Leila | No overprint, but page breaks are poor: a period heading and its metadata are left at the bottom of page 2 while its table starts on page 3, and page 1 is half empty | Keep headings with their first rows | Low |

Not verifiable live:
- The approval inbox's "Availability loss line · <reason>" labels. No approval with changed loss lines is pending (see QA_PLANNING R3-3).
- Rows of My work › RCA actions. No persona owns an action; the filter itself works.

### Data created in round 3

None in the plant records. Read-only export jobs were created through the UI by Leila: 4 Reports exports for 17 Oct (period summary CSV and PDF, loss lines CSV and PDF) and 2 period exports for Shift C (loss lines CSV and PDF).
