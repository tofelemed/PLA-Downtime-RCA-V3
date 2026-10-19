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
