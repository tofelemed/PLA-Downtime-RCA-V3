# Marun HDPE training plant: end-to-end report

Plant HDPE-TRAIN (Asia/Tehran, UTC+03:30), unit Extruder1, asset EXT1-Main. Production day 17 Oct 2026 06:00 → 18 Oct 2026 06:00 local = 2026-10-17T02:30Z → 2026-10-18T02:30Z. Source: `Marun_PLA_and_Downtime_Student_Guide.docx` and `plans/DECISIONS.md` (2026-10-18 entries). Screenshots are in `.playwright-mcp/marun-e2e-dt-*.png`, `marun-e2e-pla-*.png` and `marun-e2e-rca-*.png`.

## Summary of the three tests

All three tests ran with the guide's ordinary personas and separation of duties. SuperAdmin was not used. Nothing was reseeded or cleared. Every product bug found was fixed with a failing-first test and deployed: 7 product bugs and 1 seeder bug in total.

| Test | Outcome | Bugs fixed | Main open items |
|---|---|---|---|
| 1 Downtime | Complete; all checks pass. MQTT intake (2942 messages, none quarantined) gives exactly the 2 derived stops. Coding was verified and validated by independent users, the repair evidence was imported, and all KPIs match the guide: Shift A 1 h / 87.5 % / MTBF 7 h / MTTR 30 min; day 1.5 h / 93.75 % / 66.67 % coded | 2: state engine ignored late samples older than 24 h; coding a derived stop turned it into `source` | Mean time to restore is hidden once MTTR exists; label ambiguities |
| 2 PLA | Complete except month close. Dispositions, ledgers (224 / 28 / 4 / 2 / 190), OEE (84.82 % shift, 92.56 % day), valuation (USD 5,100 margin / 4,960 economic, IRR at 600,000), day certification, the late laboratory restatement (189 / 35 t) and exports all match. Month close is **blocked by design**: Mehr 1405 has not ended | 4 + 1 seeder: manual line without unit; empty change-proposal figures; CSV BOM lost; wrong export format offered; seeder approved the wrong valuation policy | Operators cannot record dispositions in the UI; no "correct disposition" action; the plant's default valuation basis is economic impact |
| 3 RCA | Complete. The case was created from the event and linked to the approved 28 t / USD 4,200 line. It has the guide's evidence package, timeline, fishbone, 5-Why, FMEA, a coded root cause ("the inspection process failed to detect progressive lubrication contamination"), and separate repair and prevention actions verified by a non-owner. Effectiveness is honestly **insufficient evidence** (17.7 of 720 run h). The outcome shows approved loss, claimed avoided loss and realized difference separately. Maryam closed the case independently; the event became RCA completed and a knowledge entry was written | 1: the 5-Why checklist accepted "Operator error" | Effectiveness exposure counts time without data as run time; action owners who are not RCA writers (Omid, Leila) cannot see or update their actions; exports incomplete |
| 4 Regression after the fixes (18 Oct) | 30 of 33 checks pass. Restoring the Shift C OEE component to availability went through the full flow: Leila (with a change reason), Maryam's proposal, Sara's submit, Maryam's Approve disabled as reopener, Reza's approval of revision 4 and re-certification through the new confirmation dialog. Figures unchanged: 621 / 51 / 0, USD 7,650, 1 uncoded stop (66.7 %). Downtime, PLA and RCA fixes visible; no errors and no "demo" text | none (check only) | **FAIL R1:** the Shift C stop still reads `coding_state = coded` with no reason (cleared before the fix, no backfill), so Event Hub "To code" misses it. Partial: the day coding line mixes bases while a shift is in review; done actions are missing from "My RCA actions". UI gaps: the month-close Overview does not show that the month has not ended; OEE-only proposals do not say what changed (section 4) |

## 1. Downtime

Status: **complete**. All checks pass. Two product bugs were found, fixed with tests, and deployed. The run paused once because the Docker engine stopped (Windows pagefile on C:); the coordinator restarted it, rebuilt backend, worker and frontend, and the run resumed at step 3c.

### 1.1 Setup (from `npm run db:seed-marun-train`)

| Item | Value |
|---|---|
| Organization / plant | MPC-TRAIN / HDPE-TRAIN, tenant `433c1a69-7a32-4b32-ab20-c4139423abd2` |
| Unit / asset | Extruder1 `da0560f4-2916-450d-9d30-4012e86fa17e` / EXT1-Main `dc043749-2060-4580-b70a-b464fb1b2f9f` |
| MQTT connection | "Extruder1 MQTT measurements" `466d5564-054c-4b56-8550-0c1fcd7f337d`, `mqtt://mqtt:1885` user `proact-test`, filter `proact/v1/HDPE/Polymer/Line1/Extruder1/measurements/#`, profile `measurement_json` (seq + boot_id, ISO `ts`, PI quality, max past 7 days) |
| Subscribe job | `13b853b7-2308-4373-83d2-171ef3ec5ed6`, running |
| Signals | EXT1-State `55e601b1-c448-4382-90d4-b919fff95204` (state); EXT1-Throughput `3ebbdace-1258-46b9-8f6b-ea0e653a9f1b` (counter, t, authority); both effective from 2026-10-17T02:00Z, 60 s cadence |
| State mapping | RUN → running, STOP → internal_stop, CHANGEOVER → planned_stop, STARVED → starved, BLOCKED → blocked; heartbeat 60 s, stale after 3 intervals |
| Stop policy | micro-stop 60 s, ELEC-TRIP trip exception; engine debounce 5 s, restart confirm 10 s (backdated to commissioning) |
| Impact rule | EXT1-Main full stop |
| Plan / periods | plan `274b143e-d004-45d9-96cc-5ea20c8493a2`; A `8919d301-98c4-4aea-a33b-48302e35647e`, B `0b817dec-e3eb-4bf7-83d5-93086ef21a26`, C `d82d6f24-dcf8-4ed8-ac1f-a9229d285595` |

### 1.2 Data published

`npm run db:publish-marun-day` (new: `server/pro-act-backend/scripts/marun-train/publish-production-day.ts` and `production-day-schedule.ts`) published 2942 messages. That is one state and one counter observation per minute, from 05:30 local (02:00Z) to 06:00 the next day (02:30Z) inclusive.

- **Connection:** host port 1885, user `proact-sim`, QoS 1, not retained, paced at 100 msg/s.
- **Identity:** boot_id `marun-gw-01-boot-20261017`; seq = 2 × (minute + 30), +1 for the counter. A re-run delivers only duplicates.
- **Built-in check:** before publishing, the script asserts the guide's checkpoints. The counter reads 1000 / 1056 / 1192 / 1416 / 1528 / 1626, and STOP covers [08:00, 09:00) and [02:00, 02:30).

### 1.3 Checks

| Step | Expected (guide) | Actual | Result | Evidence |
|---|---|---|---|---|
| Subscription counters | all received and accepted, none quarantined | received 2942, accepted 2942; duplicate, quarantined and stale all 0 | PASS | `GET /v2/ingestion-jobs?connectionId=…` |
| Quarantine / exceptions | empty | `ingestion_exceptions` 0; all 2942 `raw_observations` accepted | PASS | SQL |
| Samples | both signals cover the day | 1471 per signal, 02:00Z → 02:30Z next day, all good quality | PASS | SQL on `measurement_samples` |
| State timeline | RUN, STOP 04:30–05:30Z, RUN, STOP 22:30–23:00Z, RUN | exactly these 5 segments; coverage 1.0, unknown 0 s, stopped 5400 s, availability 0.9375 | PASS | `GET /v2/unit-state-mappings/coverage` |
| Derived stops | exactly 2 (60 min and 30 min); no false stop, none from missing data | `67cc2c2a-1a52-441f-aeb0-1a72d8a41c5e` 04:30–05:30Z (3600 s) and `3ea50fb2-b2c8-4e25-8673-5ad40c233a27` 22:30–23:00Z (1800 s); unplanned, closed; no other events; nothing after the feed ends | PASS (needed fix 1) | SQL; Event Hub |
| Derived-stop preview | the same 2 stops | the same 2 stops, no slowdowns | PASS | `GET /v2/derived-stops/preview` |
| Periods recalculated | all three periods use the data | A 12:47Z, B 12:50Z (the 5-minute sweep picked up late samples), C 12:48Z | PASS | SQL on `actuals_runs` |
| 3a Event Hub (Omid) | both stops; "Ended", never "Ongoing"; "1 h" / "30 min"; asset and origin columns | both Ended · Uncoded, 1 h / 30 min, Downtime · Unplanned, origin "Derived"; Current stops 0 | PASS | dt-01 |
| 3a To code | both stops | both listed | PASS | dt-02 |
| 3b Omid codes the Shift A stop | MECH-GEARBOX (Mechanical › Drive train), asset EXT1-Main, origin Extruder1 / EXT1-Main, Unplanned, Availability, full stop from the impact rule, GEARBOX_FAILURE, trip alarm, mechanism pending, description | saved and Coded with all of these (details below the table) | PASS (needed fix 2) | dt-03; SQL |
| 3c Omid cannot verify his own coding | refused | UI shows no "Verify coding" or "Validate" action for Omid. API returns 403 `FORBIDDEN_ROLE` for both verification ("Requires one of: manager_approver, production_engineer") and validate-failure ("Requires one of: reliability_engineer") | PASS | dt-04; API |
| 3c Shirin verifies | verified by an independent production_engineer | "Coding: verified by Shirin, 2026-10-18 16:42" | PASS | dt-05; `verified_by` = shirin |
| 3c Farid validates failure detail | validated by the reliability_engineer | "Failure detail: validated by Farid, 2026-10-18 16:43" | PASS | `validated_by` = farid |
| 3d Repair tab before evidence | no active repair | "No diagnosis, repair or test operation … linked … its restore time is the stop itself" | PASS | UI |
| 3d Work-order import (Farid) | active repair 08:10–08:40 on EXT1-Main, linked to the stop | Master data › Work-order operations › Import CSV, row `WO-EXT1-20261017-01 / 0010`, kind repair, 04:40Z–05:10Z: "Imported 1 operation(s): 1 new, 0 updated, 1 linked to a stop" | PASS | dt-06 |
| 3d Repair evidence | active repair 30 min, waiting 0 | API: `activeRepairSeconds` 1800, `waitingSeconds` 0, 04:40Z–05:10Z. Repair tab: "Active repair 30 min · Waiting 0 s · Repair work 08:10–08:40 · 1 active of 1" | PASS | dt-07; API |
| 3e Shift C stays uncoded | To code shows only it; nothing invents a reason | To code lists only the 02:00 stop; its detail shows Reason "—", "Coding: not coded yet"; the period C loss candidate (14 t) says "Not coded" | PASS | dt-08 |
| 3e Period C coding gate | warning for the uncoded stop | "Stop coding incomplete — shown as a warning · 1 stops: 0 with a reason, 0 investigation pending, 1 uncoded · coded stop time 0 % (target 95 %) · Verified by a supervisor: 0 · waiting: 1" | PASS | dt-09 |
| 3f Shift A total downtime | 1 h | 1 h | PASS | dt-10 |
| 3f Shift A stops | 1 | 1 (carry-in 0) | PASS | dt-10 |
| 3f Shift A availability | 87.5 % | scheduled availability 87.5 %, onstream factor 87.5 % | PASS | dt-10 |
| 3f Shift A coded ratio | 100 % | stop time coded 100.0 % | PASS | dt-10 |
| 3f Shift A MTBF | 7 h (7 h exposure / 1 failure) | 7 h, 1 failure (API: exposure 25200 s) | PASS | dt-11; `GET /v2/reports/reliability` |
| 3f Shift A MTTR | 30 min (active repair) | "Mean active repair time" 30 min | PASS | dt-11 |
| 3f Shift A mean time to restore | 1 h | API `meanDowntimeToRestore` 3600 s. The Reliability table does not show it once repair evidence exists (see 1.5). "Mean completed stop" on the Overview shows 1 h | PASS (API) | API; dt-10 |
| 3f Day total downtime | 1.5 h (union) | 1 h 30 min | PASS | dt-12 |
| 3f Day stops | 2 | 2 | PASS | dt-12 |
| 3f Day availability | 93.75 % | 93.8 % (one decimal; API coverage 0.9375) | PASS | dt-12 |
| 3f Day coded ratio | 66.67 % | 66.7 % | PASS | dt-12 |
| 3f Day Pareto | MECH-GEARBOX 60 min, uncoded 30 min | Downtime reasons: Mechanical 1 h (66.7 %) → Drive train 1 h → MECH-GEARBOX 1 h; Not coded 30 min (33.3 %) | PASS | dt-13 |
| 3f Day lost production by reason | not in the guide (28 t + 14 t) | MECH-GEARBOX 28.00 t, Not coded 14.00 t, total 42.00 t | PASS | Causes page |
| 3f Day reliability | not in the guide | MTBF 22 h 30 min (81000 s exposure / 1 failure; the uncoded Shift C stop is not a failure under D13), MTTR 30 min | consistent | API |
| 3g Attributed losses | likely none before PLA | Shift A stop: period A, Availability 28.00 t, 4,200.00 USD. Shift C stop: period C, 14.00 t, 2,100.00 USD. Both provisional, revision 1 | PASS (lines exist) | dt-14 |
| 3g Periods tab | links to the shift periods | Shift A stop → "2026-10-17 A, 06:00–14:00, Complete inputs" `/plans/274b…/periods/8919d301…`. Shift C stop → "2026-10-17 C, 22:00–06:00" | PASS | dt-14 |

Details for 3b. Stored values:
- reason MECH-GEARBOX; asset and origin asset EXT1-Main; origin unit null (the form's "This unit"); schedule unplanned; OEE availability
- impact full stop with basis `unit_rule`, i.e. the approved impact rule
- failure detail: severity critical, maintainable item GEARBOX, mode GEARBOX_FAILURE, mechanism MECHANISM_PENDING, cause CAUSE_PENDING, detection TRIP_ALARM
- description: "Gearbox-related full stop of the main drive (EXT1-Main), 08:00–09:00: gearbox function lost, trip alarm evidence. Root cause undetermined until RCA."

The day window was set through the URL `from` / `to` (exact instants), which is what the "Period dates" control writes. The header confirms "Custom window · 06:00–14:00" and "06:00–06:00".

### 1.4 Bugs found and fixed

1. **The state engine ignored late samples older than 24 h.**
   - Intake accepts samples up to 7 days old, but `processingWindow` reopened the window only within `STATE_ENGINE_LOOKBACK_HOURS` (24). Replaying 17 Oct on 18 Oct would have stored the 08:00 STOP and never derived it.
   - Fix: late samples reopen the window back to `STATE_ENGINE_LATE_SAMPLE_HOURS` (default 168).
   - Files: `server/pro-act-backend/src/stop-events/derived-stop-window.ts`, `derived-stop-engine.service.ts`.
   - Test: `test/integration/stop-events.int-spec.ts`, "a late stop sample older than the 24 h lookback…". It fails with the horizon at 24 h.
   - Deployed before publishing.
2. **Coding a derived stop turned it into `source_kind = source`.**
   - `prepareUpdate` worked the kind out again from the `source` label. Effects: the engine no longer owned the stop (`loadEngineOwned` filters `derived`); the UI origin read "From a connected source"; imports were affected the same way.
   - Fix: the stored kind is kept unless `source` changes.
   - Files: `server/pro-act-backend/src/production-event/event-write-model.ts`, plus migration `src/database/migrations/1794220900000-RestoreDerivedStopSourceKind.ts`, which repairs the rows the state engine wrote.
   - Tests: `src/production-event/event-write-model.spec.ts`, and the v2 PATCH case in `test/integration/stop-events.int-spec.ts`. Both fail without the fix.
   - Deployed by the coordinator. Both events are `derived` again, and stayed `derived` through verification and validation.

Decisions: `plans/DECISIONS.md`, "Marun E2E downtime test: two state-engine fixes".

### 1.5 Open issues and definition notes

- **Mean time to restore is hidden in the UI once repair evidence exists** (design, SME D10). The Reliability table shows a single column: "Mean active repair time" when MTTR exists, otherwise "Mean time to restore production". The guide teaches both side by side (1 h vs 30 min). The API returns both values. The report's static note ("MTTR needs active-repair evidence; until then see meanDowntimeToRestore") still appears when MTTR is present. Suggest showing both columns.
- **The day coding ratio on the period page reads "—"** while shifts are drafts. By design, `loadDayCodingGate` computes the day ratio from the approved shifts' runs only. It will fill in when the shifts are approved (PLA test).
- **Value basis label** on Attributed losses reads "Economic impact (lost sales + incremental costs)", but the valuation policy's default basis is contribution margin. The numbers are the same here (demand constrained, 150 USD/t). The PLA test should confirm which basis is in force.
- **The coding form shows no explicit "from the impact rule" hint.** Impact reads "Stops the unit · From State engine", although the stored basis is `unit_rule`. The OEE component is not on the form (it defaults from the code and shows on the detail).
- **The event summary's "Severity" shows "—"** while the failure severity is critical. That field is the event severity; the label is ambiguous.
- **"Origin" means two things:** the summary uses it for the data source (Derived), while the form's origin is "Caused by unit / asset". In the work-order table, "Open stop" is a link to the stop, which reads like a stop state.
- **Resolved:** the login page pre-filled `manager@acme.com` / `demo123`. The coordinator removed `src/features/login/demo-accounts-hint.tsx` and updated LoginForm.
- `test/integration/migrations.int-spec.ts` with the new migration: run by the coordinator.

## 2. Production loss accounting (PLA)

Status: **complete except month close (step 8), which is blocked by the product's prerequisites, not by a defect.** Four product bugs and one seeder bug were found and fixed with tests; backend, worker and frontend were rebuilt. Screenshots are `.playwright-mcp/marun-e2e-pla-*.png`; the downloaded exports are `.playwright-mcp/marun-e2e-pla-export-shiftA-v2.csv` and `.pdf`.

People (all ordinary users; SuperAdmin was not used): Leila recorded dispositions, Neda decided them, Sara prepared and submitted the shifts, Reza approved them and certified the day, Maryam accepted the late-laboratory change proposal, and Kamran decided the posting.

### 2.1 Records created

| Record | Id / value |
|---|---|
| Dispositions | A `58c71be8-da81-4742-bf40-b987bd7f1f73` 2 t (superseded); A correction `6b1cbff6-bd76-48c4-8f9e-cb649ac97061` 3 t; B `a3f1b23e-8f2e-4d93-a771-d220e5603659` 1 t; C `281bc9e0-f290-4170-bd9f-90221f386bd1` 1 t. Lots `HD5502-20261017-A01/B01/C01`, evidence `LAB-HD5502-20261017-*` |
| Shift A revisions | 1 `81582e27-3dce-4ee6-8468-a221148e60a3` (approved, 190 t, superseded); 2 `44fc9cea-0d92-4868-8bc1-815a9d97a04f` (approved, 189 t) |
| Shift B / C revisions | B `21115b59-cf5b-4e3d-9832-8a6bb9cd48f8`, C `716b3fd3-772f-4c61-9563-c6ef1da65beb` (both approved, revision 1) |
| Manual line (Shift A) | Performance 4 t, SPEED-LOSS, no event, evidence "Totalizer reading": EXT1-Throughput 1056.0 t at 09:00 and 1192.0 t at 14:00 (136 t in 5 h vs 140 t at 28 t/h). Comment: "Observed rate deficit … cause not investigated" |
| Change proposal | `810c38b8-2951-444f-abc0-77dc610e803a` (trigger: recalculation after the disposition approval), accepted by Maryam |
| Day certifications | `39b6d899-ca18-4fe3-bdeb-5920935c069f` (622 t, reopened by the correction), then a new certification at 621 t; both by Reza |
| Restatement posting | operational date 2026-10-17, posted 2026-10-18 as "a correction", by Kamran |

### 2.2 Checks

| Step | Expected (guide) | Actual | Result | Evidence |
|---|---|---|---|---|
| 1 Dispositions recorded | Omid or Leila, in the period's Actuals & quality | Leila recorded A 2 t, B 1 t, C 1 t. Omid gets "No access" on `/plans/…` (operator is an operations-only role), although the API lets operators write dispositions | PASS (Leila); see 2.4 | pla-01 |
| 1 Author cannot decide | refused | Leila and Sara: 403 `FORBIDDEN_ROLE` "Requires one of: quality_approver". The UI shows them no Approve button | PASS | API |
| 1 Neda decides; recompute | approved by the quality approver; jobs finish | All three approved by Neda. Each approval queued a recalculation (`lot_disposition_approved`), and every job finished | PASS | pla-01; SQL |
| 2 Actuals provenance A | MQTT counter, 192 t gross, coverage complete, rejects measured | "Good 190.00 t · gross 192.00 t · from Counter readings · coverage 100 % · Complete"; "Rejects taken from the approved lot dispositions" (`rejects_from_dispositions` replaces `rejects_not_measured`) | PASS | pla-02 |
| 2 Capacity ledger A | 224 / 28 / 4 / 2 / 190, residual 0 | capacity 224, availability 28, performance 4, quality 2, good 190, unaccounted 0; the waterfall closes to actual | PASS | pla-04 |
| 2 Plan ledger A, initial | stop 28 + downgrade 2 = 30, residual 4 | attributed 30, unaccounted 4 (status Unaccounted) | PASS | pla-03 |
| 2 Performance line | 4 t SPEED-LOSS citing the counter; no duplicate of the disposition | Manual line saved (2.1), candidates accepted; attributed 34, unaccounted 0. Quality is still the single 2 t candidate | PASS | pla-05 |
| 2 Derivation disclosure | "How was this calculated?" with the applied rate | Availability: "Planning rate · Plan ledger · 08:00–09:00 (1 h) · Planning rate 28.00 t/h · Event 100.0 % share". Quality: "Measured · no rate (not a time-based loss)" | PASS | pla-05 |
| 2 RCA chip (G-4) | chip on the loss line | None shown. Correct: the stop's `rca_state` is `none` and no case exists. "Start an RCA" is shown only to RCA writers (Sara is not one) | PASS (nothing to show) | SQL |
| 2 Recompute | the job finishes | Actuals job finished in 3 s. No new calculation run, because the input hash was unchanged | PASS | SQL |
| 2 Submit (Sara); Sara cannot approve | submitted; self-approval refused | Revision 1 in review. UI: Approve disabled, "You submitted this revision: another manager approver must review it". API: 403 `SEPARATION_OF_DUTIES` | PASS | pla-06 |
| 2 Reza approves; snapshot and history | approved, frozen revision | Approved 17:01 with a comment. History: saved, recalculated, submitted, approved. Approved lines: availability 28 (MECH-GEARBOX, cause event), quality 2, performance 4 | PASS | pla-07; SQL |
| 3 Shift B | 224 gross, 1 downgrade, good 223, quality 1, residual 0 | Plan and capacity: quality 1, good 223, unaccounted 0; capacity waterfall 224 → 223. Submitted by Sara, approved by Reza | PASS | pla-08 |
| 4 Shift C | gross 210, availability 14 on the uncoded stop, quality 1, good 209 | availability 14 ("Not coded"), quality 1, good 209, unaccounted 0 | PASS | pla-09 |
| 4 Coding gate (warn mode) | warning visible; submit and approve allowed | "Stop coding incomplete — shown as a warning · 1 stops: 0 with a reason, 0 investigation pending, 1 uncoded · coded stop time 0 % (target 95 %)". Submit and approve both passed; no reason was invented | PASS | pla-10, pla-11 |
| 5 OEE, Shift A | A 87.5000, P 97.9592, Q 98.9583, OEE 84.8214 % | API: 0.875 / 0.9795918367 / 0.9895833333 / 0.8482142857 (25200/28800, 24685.71/25200, 24428.57/24685.71). Reconciled is the same: 196/224, 192/196, 190/192, 190/224 | PASS | `GET /v2/reports/oee` |
| 5 OEE, day | A 93.7500, P 99.3651, Q 99.3610, OEE 92.5595 % | API operational: 0.9375 / 0.9936507937 / 0.9936102236 / 0.9255952381 (sums of stored terms: 81000/86400 …). Reconciled: 630/672, 626/630, 622/626, 622/672. OEE tab: 93.8 / 99.4 / 99.4 / 92.6 % | PASS | pla-12 |
| 5 Plan achievement, day | 92.5595 % | 622 / 672 (day roll-up target 672, actual 622) | PASS | day API |
| 5 Overview waterfall | closes to actual | Plan: 672 − 42 − 4 − 4 = 622, "Closes to actual". Capacity: 672 → 622 with the same steps | PASS | pla-13-overview, pla-13-overviewCap |
| 5 Loss Breakdown | availability 42 / performance 4 / quality 4 | API by OEE component: 42 / 4 / 4. The page showed only "SPEED-LOSS 4.00 unit unknown", because the manual line had no unit (**bug 1**, fixed). After the restatement: one tonne group, 42 / 4 / 5 = 51 | PASS after fix | pla-13-losses; API |
| 5 Trends | day bucket | Operational OEE by day: one bucket, 2026-10-17 | PASS | pla-13-trends |
| 5 Reconciliation & Data Quality | unaccounted 0; period list | 3 periods: Approved 3, Balanced 3, Unaccounted 0, overdue 0. The overdue list is empty, so it has no period rows to drill into | PASS | pla-13-recon |
| 5 Dashboard | consistent | Last 7 days: OEE 92.6, A 93.8, P 99.4, Q 99.4; reconciled 92.6; "80 % of periods calculated". Scheduled availability 95.3 % includes the 18 Oct A shift (see 2.5) | PASS | pla-18 |
| 6 Basis in force | determine | The policy in force (`valuation_basis` version 1) has `defaultBasis: economic_impact`. The server seeds that draft on first read, and the Marun seeder approved it instead of creating its contribution-margin version (**seeder bug**: script fixed, live data unchanged). So the period Value section and the "policy default" view show economic impact. The Loss Valuation page opens on contribution margin | explained | SQL; seed log |
| 6 Shift A, margin | 34 × 150 = USD 5,100 (4,200 / 600 / 300) | Approved line values 4,200 / 600 / 300 USD. Loss Valuation (margin, Shift A window): 5,100.00 USD | PASS | pla-16; SQL |
| 6 Shift A, economic | 32 × 150 + 2 × 80 = USD 4,960 | 4,200 + 600 + 160 = 4,960.00 USD. Value section: "Economic impact … 4,960.00 USD · Valued · Not priced 0.00 t · Approved, reconciled value" | PASS | pla-14 |
| 6 IRR | USD 5,100 = IRR 3,060,000,000 | IRR toggle on margin: 3,060,000,000 IRR. Economic: 2,976,000,000 IRR (= 4,960 × 600,000). These are stored server values per currency; the browser converts nothing | PASS | pla-15, pla-17 |
| 6 Day, margin | 50 t → USD 7,500 | Loss tree, margin: 7,500 USD / 4,500,000,000 IRR. Economic view: 7,220 USD (46 × 150 + 4 × 80) | PASS | API |
| 7 Day certification | eligible certifier; 622 good / 50 loss; coding gate verdict | Sara: 403 `FORBIDDEN_ROLE` (manager_approver only). Reza certified: he approved the shifts but submitted none. Roll-up target 672, actual 622, gap 50, attributed 50, residual 0. Day gate: warn, 2 stops, 1 uncoded, coded 0.6667 (server text "66.7 %", UI "66.6 %"), passes false; certification allowed | PASS | pla-11, pla-20; API |
| 8 Month close | quantities closed → finance → lock | **Blocked.** The plant closes Solar Hijri months: Mehr 1405 runs 2026-09-23 to 2026-10-22, so the month is not over. Reza's close quantities → 422 `CLOSE_PREREQUISITES`: 18 Oct A is a draft, 18 Oct B is not calculated (it is running now), day 18 Oct is not certified. Materiality is off in the policy. No data deleted | BLOCKED | pla-21; API |
| 9 Late laboratory result | correction with lot evidence; independent decision; restatement; finance posting; original snapshot kept | See the steps below this table | PASS (pre-close path) | pla-22 … pla-27; SQL |
| 9 After-close marking | `afterClose` on the revision | Not reachable while the month is open (`after_close = false`). The open-month path was used: a proposal reopens the period directly | n/a (step 8) | SQL |
| 10 CSV export | completed file, approved content | 3 rows of revision 2: quality 3 t; availability 28 t (MECH-GEARBOX, cause event); performance 4 t SPEED-LOSS with its comment. `valuation_view` economic_impact; status approved. Before **bug 3** the saved file lost its BOM and did not match the shown sha256; now it matches (`7c1e73bf…`) | PASS after fix | CSV file |
| 10 PDF export | completed file | One page: "APPROVED", revision 2, snapshot and run ids, the 3 lines with USD values (240 / 4,200 / 600), "approved content only, rendered from approval snapshots". The sha256 matches (`0179fb3d…`). Before **bug 4**, "Download PDF" saved the previous CSV job as `.pdf` | PASS after fix | PDF file; pla-28 |

Step 9 in detail:
1. Leila recorded the 3 t correction of lot A01 with `supersedesId`. She used the API, because the UI has no "correct" action. Neda approved it.
2. The system opened change proposal `810c38b8…`: before 190 t good / 34 t gap, after 189 / 35. Its figures were invisible until **bug 2** was fixed.
3. Maryam accepted the proposal, which reopened the period and the day.
4. Sara re-accepted the changed 3 t candidate and submitted.
5. Maryam, who reopened the period, tried to approve: 403 `SEPARATION_OF_DUTIES`. Reza approved revision 2.
6. The restatement panel shows actual 190 → 189, gap 34 → 35, rejected 2 → 3.
7. Kamran posted it on 2026-10-18 as a correction.
8. Reza re-certified the day: 621 t good, gap 51.
9. Both snapshots are kept: revision 1 at 190 / 34, revision 2 at 189 / 35.

### 2.3 Bugs found and fixed

1. **Manual loss lines had no unit of measure.**
   - Symptom: the loss tree split the day into "unit unknown" 4 t and a 46 t group, and Loss Breakdown showed only "SPEED-LOSS 4.00 unit unknown".
   - Fix: draft lines take the slice's unit, and approval falls back to it for lines saved earlier.
   - Files: `server/pro-act-backend/src/reconciliation/revision-state.ts` (`sliceUomOf`), `draft-lines.service.ts`, `approved-ledger.ts`.
   - Test: `test/integration/approved-ledger.int-spec.ts`, "a manual line is in the unit of its slice". It fails without the fix (received null).
   - Approved rows are immutable: Shift A revision 1 keeps null, revision 2 stores `t`.
2. **Change-proposal "Before" and "After" were empty.**
   - Cause: the snapshot's lists (`slices`, `ledgers`) were skipped.
   - Fix: `src/features/plan-dashboard/model/snapshot-figures.ts`.
   - Test: `src/features/plan-dashboard/adjustment-model.test.ts`.
3. **CSV downloads lost their UTF-8 BOM.**
   - Cause: the body was decoded as text, so the saved file never matched the shown sha256.
   - Fix: `v2Request({ asFile: true })` in `src/api/v2/client.ts`, used by `downloadExportFile` in `src/api/v2/queries/period-workflow.ts`.
   - Test: `src/api/v2/client.test.ts`. It fails without the fix.
4. **"Download PDF" offered the previous CSV job.**
   - Cause: the format changed before the new job id arrived.
   - Fix: `src/features/plan-dashboard/workflow/export-panel.tsx`.
   - Test: `src/features/plan-dashboard/workflow/export-panel.test.tsx`. It fails without the fix.
5. **Seeder: wrong valuation policy approved.**
   - Cause: the seeder approved the server's seeded economic-impact draft instead of the guide's contribution-margin policy.
   - Fix: `server/pro-act-backend/scripts/marun-train/step-finance.ts` approves only a version with the guide's `defaultBasis`; `verify-checks-flow.ts` checks it.
   - Live policy: not changed. A new version cannot cover 17 Oct without a backdate, because those periods are already calculated. This is an owner decision.

Verification:
- Backend: typecheck, eslint on the changed files, `npx jest src/reconciliation`.
- Integration (`TEST_DB_NAME=proact_ux_test`, one file at a time): `approved-ledger.int-spec.ts`, `reconciliation-draft-lines.int-spec.ts`.
- Frontend: `npm run typecheck`, the three vitest files, eslint.
- Rebuilt backend, worker and frontend.
- Bug 1 confirmed live: revision 2's performance line is stored in `t`, and the loss tree now has one unit (51 t).

Decisions: `plans/DECISIONS.md`, "Marun E2E production loss accounting test: fixes and findings".

### 2.4 Open issues (not changed)

- **Omid cannot record dispositions in the UI.** Operators hold the disposition-writer API role but have no route to the period workspace (`canViewAnalysis`). The guide says "Omid or Leila", so Leila was used.
- **No UI action to correct an approved disposition.** The API supports `supersedesId`; the UI only records new lots. The late laboratory result was recorded through the API with Leila's token.
- **Valuation default.** The plant runs economic impact by default (bug 5). A new policy version, prepared by Darya and approved by Kamran, would align it with the guide from its effective date.
- **Month close before month end.** The prerequisites count only periods that exist. Nothing stops a close while the month's later days have no generated periods. Not exercised here: the 18 Oct periods blocked it.
- **`GET /v2/month-closes/2026-10` on a Persian plant** reads the key as Persian year 2026 (Gregorian 2647). The month key is calendar-local (`1405-07`).
- **"Certify the day" acts on one click**, with no confirmation and no comment. Approvals and proposals ask for confirmation.
- **Coding-gate percentages are truncated** to one decimal (66.6 %), while the server's issue text and the Downtime pages round (66.7 %). Truncation never overstates a gate, but the two numbers differ on one screen.
- **Actuals provenance lists all 480 one-minute segments** with a raw id ("Signal:3ebbdace 1258 46b9 …") instead of the signal name, EXT1-Throughput.
- **The SLA line reads "To submit / Waiting for data…"** on periods whose coverage is complete.
- **The PDF export does not name its valuation basis.** Its column is "Loss value"; the CSV has `valuation_view`.
- **The posting date is a Gregorian date input** on a Solar Hijri plant.

### 2.5 Definition differences explained

- **Plan achievement equals OEE in this exercise** because the target (224 t per shift) equals the sustained capacity, so the plan and capacity waterfalls have the same steps.
- **"Proposed" plan-ledger candidates already count as attributed** before a decision. Accepting them changes no figure; it records the review.
- **Reconciled and operational OEE agree** because the day is balanced and fully covered. After the restatement the reconciled day is 621 / 672 = 92.4107 %.
- **Dashboard and Downtime use different scopes.** Scheduled availability 95.3 % covers the last 7 days, including the 18 Oct A shift (8 h, no stops). The OEE tiles count only calculated periods with actuals ("80 % of periods calculated").
- **Value views.** The period Value section and the loss tree's "Value (policy default view)" use the policy default, economic impact. The Loss Valuation page opens on contribution margin. Both views are stored for every approved line; they are alternatives and are never added together.
- **The 4 t in the two ledgers.** In the capacity ledger the 4 t is computed performance loss. In the plan ledger it appears only as the accepted SPEED-LOSS line, which explains the computed deficit; it is not an extra loss.

## 3. Root cause analysis (RCA)

Status: **complete.** The whole lesson 25 process ran on the gearbox stop with ordinary users; SuperAdmin was not used.
- Farid created and led the investigation from the event.
- Leila and Omid were the team.
- Farid checked the action evidence as the verifier, who is not the owner.
- Maryam approved the closure as the independent manager.

One product bug was fixed with tests and deployed (backend, worker and frontend rebuilt). Several gaps are left for the owner (3.4). Screenshots are `.playwright-mcp/marun-e2e-rca-*.png`; the exports are `.playwright-mcp/marun-e2e-rca-export-*`.

The evidence is fictional, as lesson 25 says. Evidence, fishbone and 5-Why texts say "fictional" where they cite laboratory or inspection results.

### 3.1 Records created

| Record | Id / value |
|---|---|
| Investigation | `f58df7af-1b09-4d08-b41a-560c5bfd1fd3` "Extruder1 gearbox trip 2026-10-17 08:00 (EXT1-Main)". Priority High (Farid's choice), consequence class Significant, target 2026-11-30 |
| Team | Lead Farid; members Leila and Omid. Maryam is not on the team and not in `investigator_ids` |
| Links | Event `67cc2c2a-…`, linked from the event page. Loss line `031e90b9-6426-4f90-9263-ae039d87c049`, chosen in the loss-line picker. This is the run line that approved line `f5a5fae9-…` was decided from (`approved_loss_lines.source_id`); by design, a `loss_line` link points to run lines |
| Evidence | ev-1 gearbox trip record (time series); ev-2 lubricant analysis LAB-OIL-EXT1-20261017; ev-3 inspection photographs (2 PNG attachments); ev-4 maintenance history and inspection plan, including WO-EXT1-20261017-01. Each has a collection task with an assignee and a due date |
| Analyses | Event timeline (5 diagram events and the linked stop); fishbone (5 causes, 2 primary); 5-Why (5 levels, evidence on every level); FMEA (RPN 280 and 56) |
| Typed causes | Root ME-INSPECTION-GAP, direct MAT-LUBE-CONTAM, contributing ME-OIL-LIMITS, each with supporting evidence |
| Recommendations | rec-1 "Restore gearbox function…" (Omid); rec-2 "Revise gearbox contamination detection and response" (Leila) |
| Actions | Corrective `2d1109ac-08ee-4497-acab-d4799248c035`: repair, owner Omid, due 2026-10-19, implements rec-1. Preventive `8850fde6-475e-4ee6-88ce-7f4b08a42748`: procedure change, owner Leila, due 2026-11-15, implements rec-2, baseline on recurrences, claimed avoided loss USD 4,200 |
| Knowledge entry | `a4e122c0-43d9-4315-bd0b-c5252af01f10` (unpublished, quality 80) |

### 3.2 Checks

| Step | Expected (guide) | Actual | Result | Evidence |
|---|---|---|---|---|
| 1 Trigger policy | report what the policy says | `rca_policy` v1, whole plant. Triggers: unplanned stops from 2 h; approved lost quantity from 1 % of the daily plan; 3 same-mode incidents in 30 days; 8 h in 90 days; no money limit. Action when a trigger fires: "Recommend an RCA". The 1 h stop is below the 2 h duration threshold | as stated | rca-triggers page; SQL |
| 1 Recommendation | listed in `/rca?tab=recommended` if a trigger fired | Yes, from the quantity trigger: "Large lost quantity · RCA policy v1 · lost 28.00 t (limit 6.72 t)", fired on the approved line. The Shift C stop (14 t) is also recommended | PASS | rca-01, rca-02 |
| 1 Create from the event | event page "Create / link RCA" opens `/rca/new?eventId=` | Opens `/rca/new?eventId=67cc…` with "Back to the stop" and a "Stop being investigated" card: unit, asset Main drive and gearbox, 08:00 → 09:00, 1 h, Gearbox failure. The evidence package shows approved impact 28.00 t / 4,200.00 USD | PASS | rca-03 |
| 1 Prefill | title and problem statement prefilled | Title "HDPE Extruder 1 · Gearbox failure · 2026-10-17 08:00". Problem statement "Stop on HDPE Extruder 1, Main drive and gearbox from … 08:00 to … 09:00, 1 h. Reason recorded: Gearbox failure." Both are editable; the problem statement was replaced with the guide's sentence | PASS | rca-03 |
| 1 Problem statement | the guide's sentence; 4 t kept separate | The problem statement is the guide's sentence. The team charter records the 4 t Shift A rate deficit as a separate observed problem with no evidence linking it to this cause. The 4 t SPEED-LOSS line is not linked to the case | PASS | rca-05 |
| 1 Priority and class | priority chosen; consequence class per policy | Priority High, chosen by Farid; it is not derived (the field defaults to Medium). The consequence class is a free choice (minor / significant / major) that sets the method tier; the policy has no rule that derives it. Significant was chosen: no safety consequence, 1 h and 28 t | PASS | rca-05 |
| 1 Team | Farid lead; Leila and Omid members; not Maryam | As expected | PASS | rca-05; SQL |
| 1 Link the loss line with the picker | picker, not a pasted id | Links › "Approved loss line" lists the approved lines with day · shift, kind, quantity, reason and cause event. The 28.00 t Gearbox failure row was linked with one click. The approved impact stays 28 t (one line, not doubled) | PASS | rca-06 |
| 1 Case header | "Triggered by … · Approved loss 28 t / USD 4,200" | "Triggered by: Downtime from 2026-10-17 08:00 · Approved loss 28.00t / 4,200.00USD", with a link to the event | PASS | rca-04 |
| 2 Start | Draft → In Progress | "Start the investigation" moved it on one click. No confirmation is needed because nothing locks at this step. The Definition item of the progress checklist is done | PASS | rca-07 |
| 3 Evidence | trip record, lubricant sample, photographs, maintenance history | 4 items with type (Time Series / Document / Photo / Document), 5P, asset, severity and observed time. The 2 PNGs are attached to the photographs item | PASS | rca-08 |
| 3 Collection tasks | assignee and due date | Two tasks for Omid and two for Leila, each with a due date. The maintenance-history task was due 2026-10-17 and still pending, so it showed an "Overdue" chip; the chip cleared when the task was completed | PASS | rca-08 |
| 3 verifiedBy set by the server | the server stamps who verified | For each item marked verified, the server set `verifiedBy` = Farid and `verifiedAt`. The detail page reads "Verified by Farid at 2026-10-18 17:54" | PASS | API |
| 4 Timeline | trip sequence | Events in time order: last oil sample (2026-04-15); oil temperature rising 07:20; gearbox trip 08:00; linked stop 08:00; repair work order 08:10; restart 09:00 | PASS | rca-09 |
| 4 Fishbone | hypotheses: lubrication contamination vs cooling restriction | Material: contamination (high likelihood, primary). Machine: cooler restriction (low; the cooler was found clear). Method: inspection plan without limits (high, primary). Measurement and Environment hold contributing causes | PASS | rca-10 |
| 4 5-Why with "operator error" | refused as a root cause | The tool saved "Operator error" and copied it to the case, and its checklist ticked "System-level root cause written". The server then refused acceptance with 422 `INVESTIGATION_BLOCKED` (`ROOT_CAUSE_MISSING`, `FIVE_WHY_ROOT_CAUSE`). The checklist was **bug 1**, now fixed | PASS (server); UI fixed | rca-11; API |
| 4 5-Why chain | evidence on every level; system-level root cause | 5 levels, each citing ev-1 to ev-4. Root cause "The inspection process failed to detect progressive lubrication contamination", applied to the case | PASS | rca-12 |
| 4 Method tier | Significant needs a timeline, a fishbone or logic tree, and a 5-Why or fault tree | All present. An FMEA was added too: severity 7; contamination O5 / D8 gives RPN 280 "priority high · needs action"; cooling restriction O2 / D4 gives RPN 56. The server computes the scores | PASS | rca-13 |
| 4 Coded root cause | a root cause from the cause catalogue | In the typed causes panel: root ME-INSPECTION-GAP with the guide's statement, direct MAT-LUBE-CONTAM, contributing ME-OIL-LIMITS, each with evidence. Readiness reports `rootCauseRule.codedRootCauses` = 1 | PASS | rca-14 |
| 5 Separate repair from prevention | corrective and preventive actions, each with an owner | Corrective repair (owner Omid) implements rec-1. Preventive procedure change (owner Leila) implements rec-2. Each action shows "Implements: …", the recommendation → action link | PASS | rca-21 |
| 5 Due date, evidence expected, verification method, verifier ≠ owner | on each action | Due dates are set. The expected evidence comes from the action type: "work-order operation and acceptance test" for the repair, "released procedure revision and implementation or training record" for the procedure change. The UI has no field for a verification method or a named verifier, so the method was written into `description` through the API. Whoever marks an action done is recorded as its verifier and must not be its owner | PARTIAL | API; 3.4 |
| 5 Accept the investigation | confirmation dialog; team locks; readiness satisfied | Before the actions existed, readiness blocked with `ACTIONS_MISSING`; afterwards there were no blockers. "Accept the investigation and start monitoring" asks "Accept the investigation? The investigation team is locked from now on…". A later team change was refused with 422 `TEAM_LOCKED` | PASS | rca-15, rca-16; API |
| 5 My RCA actions | owners see their actions | Leila: `/rca?tab=actions` and `/my-queue?tab=rca-actions` list her preventive action. Omid (operator): "No access" on both pages, although the API returns his action for `mine=true` | FAIL (Omid) | rca-17, rca-18; 3.4 |
| 5 Overdue badges | overdue items are marked | The evidence task showed its "Overdue" chip (above). Neither action was overdue, and the dashboard "Overdue actions" stayed at 0 | PASS | rca-08 |
| 5 Owner cannot mark own action done | refused | Leila and Omid got 403 `FORBIDDEN_ROLE`, because they are not RCA writers, and the UI shows them no status controls. The owner rule itself (`SEPARATION_OF_DUTIES` when the owner is the actor) is in `action-completion.ts` and its spec. It could not be exercised here: no team member is both an RCA writer and an action owner | PASS | API |
| 5 Completion by a non-owner | evidence checked by someone else | Farid marked both done. Corrective: "Done on 2026-10-17, evidence checked by Farid · WO-EXT1-20261017-01 / 0010 …". Preventive: "Done on 2026-10-18, evidence checked by Farid · Inspection plan IP-EXT1-GB revision 4 …" | PASS | rca-21 |
| 6 Monitoring gate | no closure before verification | Request closure: 422 `CLOSE_BLOCKED` `EFFECTIVENESS_NOT_VERIFIED`. Verify: 409 `VERIFICATION_WINDOW_OPEN` | PASS | API |
| 6 Effectiveness window | 600 comparable hours; the honest verdict is "insufficient evidence" | Planned window 2026-10-18 → 2026-11-13 (about 600 h); the policy minimum is 720 run h. We could not wait, so the window end was moved to a few minutes ahead through the API, because the UI accepts whole dates only. The history records the change. "Verify now" then gave **"Not enough evidence yet · needs 720 run hours after the action, has 17.7"** | PASS (verdict) | rca-24 |
| 6 Outcome panel | approved historical loss shown apart from claimed avoided loss and realized outcome; no 3 × 28 t | Three separate cards, labelled "never added up": approved historical loss 28.00 t / 4,200.00 USD; claimed avoided loss 4,200.00 USD (1 action); realized difference 0.00841125 recurrences (expected 0.0084, observed 0), "Not enough evidence yet". No money is booked as realized, and nothing multiplies past failures by 28 t | PASS | rca-25 |
| 7 Request closure | confirmation dialog | "Request closure? The effectiveness verdict is frozen as it stands and sent with the residual risk to an independent manager approver." A residual-risk statement is required | PASS | rca-26, rca-27 |
| 7 Participants cannot approve | Farid, Leila and Omid refused | Farid: 403 `FORBIDDEN_ROLE` "closure decisions … are made by a manager approver". Leila and Omid: 403 `FORBIDDEN_ROLE`. The UI tells Farid "Waiting for an independent manager approver" | PASS | API; rca-27 |
| 7 Maryam's eligibility | her PLA proposal acceptance does not count as participation | Readiness for Maryam returns `canApprove: true`. Independence is judged only from this case's own participants | PASS | API |
| 7 Maryam approves | independent closure | "Approve the closure? The investigation is closed and the RCA state of its linked events becomes completed." The case then reads "Closure approved by Maryam, 2026-10-18 18:11", with her note | PASS | rca-28, rca-29 |
| 7 Event RCA state | completed | `rca_state = completed` and `rca_id` = the case. The event page shows "RCA completed" and "Open the linked investigation". The recommendation left the Recommended tab | PASS | rca-32; SQL |
| 7 Knowledge base | entry created on close; search and similarity find it | The entry was created at closure: unpublished, quality 80, with the root cause and asset. `GET /v2/rca-knowledge?q=lubrication` finds it, and `similar?eventId=<Shift C stop>` returns it. The knowledge base page lists it but has no text search field | PASS | rca-31; API |
| 8 History tab | field-level history | 39 entries, newest first, in plant time, each with its actor. They cover: opening (priority, target, unit); team lead; links; every status move from Draft to Closed; evidence; diagram; analyses; root-cause length 14 → 77 characters (the "Operator error" step is visible); causes; actions (owner, due date, recommendation); completions; the "Verify until" change | PASS | rca-22 |
| 8 Exports | if any | Investigation (JSON), Evidence (CSV) and Recommendations (CSV) downloaded. The JSON has no actions, causes, links, residual risk or verdict, and the recommendations CSV shows due dates as UTC instants (3.4) | PASS (with gaps) | export files |
| 9 `/rca` list | Trigger, Actions progress and Lead columns | "Closed · High · Farid · HDPE Extruder 1 · Event 2026-10-17 08:00 · 2/2 done · 2026-11-30 · 2026-10-18" | PASS | rca-30 |
| 9 Dashboard RCA tiles | reflect the case | In Monitoring: Open investigations 1. After closure: Open 0, Overdue 0, Open critical 0, Overdue actions 0, Effectiveness pending 0 | PASS | rca-23, rca-33 |

### 3.3 Bug found and fixed

1. **The 5-Why checklist accepted "Operator error".**
   - Symptom: "System-level root cause written" was ticked for a root cause that the server's gate refuses. The tool looked complete until acceptance failed.
   - Fix: the readiness response now carries the policy's `fiveWhyUnsupportedRootCauses`. This is an additive field, and the readiness response has no OpenAPI schema, so the snapshot is unchanged. `fiveWhyChecks` normalizes the text the same way the gate does.
   - Files: `server/pro-act-backend/src/rca-case/rca-case-workflow.service.ts`, `src/api/v2/types/rca-workflow.ts`, `src/features/rca/case/analysis/tools/five-why/five-why-model.ts`, `five-why-tool.tsx`.
   - Tests: `src/features/rca/rca-workspace-model.test.ts` ("does not tick the system-level root cause…") and `test/integration/rca-cases.int-spec.ts` (readiness contains "operator error"). Both fail without the fix.

Verification:
- Backend: `tsc`; eslint on the changed files; `openapi-v2.spec.ts`; `rca-cases.int-spec.ts` with `TEST_DB_NAME=proact_ux_test` (17 passed).
- Frontend: `npm run typecheck`; eslint; vitest files rca-workspace-model, rca-workflow-model, rca-flows, rca-detail-workspace and rca-traceability.
- Backend, worker and frontend rebuilt.

Decisions: `plans/DECISIONS.md`, "Marun E2E root cause analysis test: fix and findings".

### 3.4 Open issues (not changed)

- **Effectiveness exposure counts time without data as run time** (correctness; SME CA2 / CA3).
  - The baseline reads "2,159 run hours" over 90 days, on a plant with about 25 h of measurements.
  - The post-action "17.7 run hours" includes about 12 h after the MQTT feed ended.
  - The verdict here is still honest, because it is below 720 h. But a long feed outage could later produce an "effective" verdict from no data.
  - Proposal: clip exposure to known state coverage, as a new query version.
- **Action owners outside the RCA writer roles cannot work their actions.**
  - The team and owner pickers offer every plant member.
  - Omid (operator) gets "No access" on `/rca` and `/my-queue`, although he owns the corrective action.
  - Leila sees her action read-only and cannot record progress or evidence.
  - The API refuses both with `FORBIDDEN_ROLE`.
  - Owner decision needed: may owners update their own action (but never mark it done), and do operators get "My RCA actions"?
- **No field for the verification method or a named verifier.** The verifier is whoever marks the action done, who cannot be the owner. The API has `description`, but the action forms do not show it.
- **The verification window can still be edited after the action is done.** The acceptance criteria stay frozen and the history shows the edit. This test used it to compress the 600 h window.
- **Policy and guide differ:** the policy's minimum post-action exposure is 720 run h; the guide's exercise uses 600 comparable hours.
- **Approved manual lines cannot be linked.** The loss-line picker lists only approved lines whose source is a run line, so the 4 t SPEED-LOSS manual line is not offered. Here that was correct, because the 4 t stays a separate problem. But a manual approved line can never be linked to a case.
- **Exports:**
  - The case JSON omits actions, typed causes, links, residual risk, closure and verdict.
  - The recommendations CSV shows due dates as UTC instants: "2026-10-18T20:30:00.000Z" for 19 Oct local. The plant's date setting should apply.
  - The evidence CSV omits the assignee and the verifier.
- **Smaller UI points:**
  - The fishbone "Primary cause" checkbox starts checked.
  - The realized difference prints unformatted decimals (0.00841125).
  - A linked loss line reads only "Approved loss line · linked …", without its day, kind or quantity.
  - Recommendations stay "Open" after their actions are done and the case is closed.
  - The knowledge base page has no text search, although the API has `q`.
  - The linked stop appears in the timeline as "ProductionLoss".
  - The evidence package counts 4 event revisions, while the event header says revision 5.
- **Not a product issue:** the Playwright browser prefilled the login form with `manager@acme.com` / `demo123`. That text does not exist in `src/`; it comes from credentials saved in the browser profile.

### 2.x Valuation basis follow-up (owner: contribution margin, 18 Oct 2026)

| Step | Expected | Actual | Result |
|---|---|---|---|
| Darya drafts a contribution-margin default from 2026-10-17T02:30Z without `restateApproved` | Refused: approved figures in range are never revalued silently | 409 `BACKDATE_OVERLAPS_APPROVED_VALUE` naming HDPE Extruder 1 2026-10-17 A, B, C | PASS |
| Darya drafts again with `restateApproved: true` and reason "Commissioning: guide baseline is contribution margin" | Accepted as a draft | Version 2 `71124443-95dc-4d0d-9534-3e2ed960ddf7` created | PASS |
| Kamran (finance_approver, independent) approves | Approved, effective 17 Oct 02:30Z, revaluation queued | Approved 15:50:18Z, `defaultBasis = contribution_margin`, `effectiveFrom = 2026-10-17T02:30:00Z` | PASS |
| Approved snapshots of shifts A, B, C | Unchanged; each gets an open change proposal | Approved revisions unchanged; open `rate_change` proposals exist for A, B and C. B's was created by this approval; A's (14:20Z) and C's (15:33Z) were already open from earlier in the session and were reused rather than duplicated | PASS |

Still to do, by a manager: decide the three change proposals, then Sara resubmits and Reza approves each shift. After that, the period Value sections show contribution margin: Shift A 4,200 + 600 + 450 = USD 5,250 (IRR 3,150,000,000), and the day 51 t = USD 7,650. Reports already open on the newest approved policy's default view.

### 2.y Restatement at contribution margin (18 Oct 2026)

Each role did its own steps in the application UI, logged in as an ordinary user. The API and SQL were used only to read results back. There was one exception: the RCA policy screen has no input for effectiveness, so that step went through the API (see below). Screenshots are `.playwright-mcp/marun-e2e-restate-*.png`. Nothing was reseeded or deleted, and no record mentions "demo".

| Step | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| 1 Open proposals | One open `rate_change` proposal per shift, with before/after figures | A `17139821-7f5e-47e0-a76d-b7298b4b5462`, B `83b81e31-7d14-4e9a-8d8f-f7617a7a583e`, C `28d519b2-fce7-47f1-a20b-85af8e69b753`. All have `detail.reason = profile_baseline_changed` and appear in Maryam's Pending Approvals. Before = after in quantity: A 224/189/35, B 224/223/1, C 224/209/15, residual 0 everywhere. The proposal shows no money figures, so the change in valuation basis cannot be seen in it (see the notes) | PASS (quantities); see the notes | restate-01, -03, -05A/B/C; API `GET /v2/production-periods/:id/change-proposals` |
| 1 Maryam accepts | Accepted by an eligible manager; the period and the day reopen | Maryam accepted each one in History & exports → Change proposals → "Accept (new revision)…", with a reason. New drafts: A revision 3 `6fd2da61…`, B revision 2 `f52dcdcf…`, C revision 2 `62e79dd2…`. `resolved_by` = maryam. Day certification `c95fee58…` is `reopened` by Maryam with the same reason | PASS | restate-04, -06B/C; SQL `period_change_proposals`; API production-days |
| 2 Recompute | Drafts calculated; jobs finished | Each draft was recalculated automatically on acceptance ("Calculated 19:39/19:40" local time). Sara did not need "Recompute" | PASS | period header |
| 2 Sara submits | Each revision in review | Sara used "Submit for approval" in the period workspace: A rev 3, B rev 2 and C rev 2 are "In review" | PASS | restate-07, -08B/C |
| 2 Maryam refused | The reopener cannot approve | Maryam → Review & close → Approve… → "Approve revision": 403, and the UI shows "Separation of duties". The revision stays in review | PASS | restate-09; console 403 on `/approve` |
| 2 Reza approves | Approved, with a new frozen snapshot | Reza approved A rev 3 (16:12:04Z), B rev 2 (16:12:11Z) and C rev 2 (16:12:17Z), each with a comment. The approval snapshot's default view is `contribution_margin` in the new revisions and `economic_impact` in the earlier ones | PASS | restate-10A/B/C; SQL `approval_snapshots` |
| 2 Re-certify 17 Oct | Reza (eligible: he approved the shifts and submitted none) | "Certify the day": certification `c3c681d2-c96d-4256-86b6-2fcdfbdb8287`, `certified` by Reza at 16:13:20Z, covering revisions A3/B2/C2. Roll-up 672 / 621 / gap 51 / attributed 51 / residual 0. Day coding gate passes (2 stops, 0 uncoded) | PASS | restate-11; API production-days |
| 3 Default view | Contribution margin | The period Value section reads "Loss value · Commercial opportunity (contribution margin)". `GET /v2/reports/loss-value` and `loss-tree?metric=value` return `view contribution_margin, defaultView true` | PASS | restate-12; API |
| 3 Shift A | 4,200 + 600 + 450 = USD 5,250 (IRR 3,150,000,000) | Value section 5,250.00 USD and 3,150,000,000 IRR. Approved totals for rev 3: availability 4,200, performance 600, quality 450 USD | PASS | restate-12, -13; SQL `approved_valuation_totals` |
| 3 Shift B | quality 1 t = USD 150 | 150.00 USD (rev 2: quality 150 USD / 90,000,000 IRR) | PASS | UI Value; SQL |
| 3 Shift C | availability 14 t + quality 1 t = USD 2,250 | 2,250.00 USD (rev 2: 2,100 + 150) | PASS | UI Value; SQL |
| 3 Day | 51 t = USD 7,650 (IRR 4,590,000,000) | Loss Valuation for 17 Oct: 7,650.00 USD and 4,590,000,000 IRR. API by kind: 6,300 / 600 / 750. Loss tree: 51 t and 7,650 USD | PASS | restate-14; API |
| 3 Economic view | Still available as an alternative, not added to margin | Loss Valuation → "Economic impact components": lost contribution 6,900 USD (46 t) plus downgrade price difference 400 USD (5 t), total 7,300 USD. API `metric=economic_impact` returns `defaultView false`, 7,300 USD | PASS | restate-15; API |
| 3 History kept | Earlier approved snapshots kept | Shift A has revisions 1 (approved 13:31Z, margin 5,100, economic default), 2 (approved 13:57Z, margin 5,250 / economic 5,040, economic default) and 3 (approved 16:12Z, contribution-margin default). B and C each have revisions 1 and 2. The revision history lists both reopenings by Maryam and Reza's approvals | PASS | restate-16; SQL |
| 4 RCA policy, 600 h | New version by a manager_approver with minimum run hours 600, effective now, other values unchanged | **UI gap:** the RCA trigger settings screen shows effectiveness as read-only text and has no input for it (restate-17). Reza recorded the version through `POST /v2/rca-policies` as version 2 `59c0be61-5b48-4a4c-87dc-5e17d5376460`, effective from 2026-10-18T16:18:16Z (server time, no backdate), notes "Guide lesson 25: 600 comparable operating hours". Compared with version 1, only `effectiveness.minExposureHours` changed (720 → 600). Baseline lookback (90 days), required reduction (0.5) and review days (90) are unchanged. The screen now shows "Version 2 … at least 600 run hours after" | PASS (by API; UI gap) | restate-17, -18; API `GET /v2/rca-policies/current` |

Notes (not fixed, for the owner):
- **The proposal does not show the value change.** A proposal opened by a valuation-policy change has quantity-only before/after figures (identical here), and its trigger reads "Rate change" with `profile_baseline_changed`. Maryam cannot see the change she is accepting (economic default → contribution margin, Shift A 5,040 → 5,250 USD at the default view). Proposed: carry the default-view valuation totals in the snapshot, and give the trigger its own reason (valuation policy).
- **The period Value section showed contribution margin before the restatement.** Shift A showed 5,250 USD (contribution margin) while revision 2 still had its frozen economic default (restate-02). This is consistent with "reports read the newest approved policy" but not with "an approved revision keeps its default view frozen until restated" (DECISIONS 2026-10-18). Decide which wins on the period page.
- **The approve refusal message has the wrong reason for a reopener.** It says "You prepared it, so another approver has to review it." Maryam reopened the period; she did not prepare it. The server rule is correct (submitter, line authors or the reopener), but the UI offers her an enabled Approve button and only refuses after she clicks. For the submitter, the button is disabled.
- **"Certify the day" still acts on one click** (already listed in 2.4).
- **The RCA policy screen cannot edit effectiveness, FMEA, 5-Why or methods**, although the API accepts them.
- Shift C's stop is now coded (day gate: 2 stops, 0 uncoded). This changed outside this test, before the revisions were submitted. The quantities are unchanged (availability 14 t).

### 2.z Correction of the accidental Shift C coding (18 Oct 2026)

**What happened.** At 15:33:24Z a session acting as Leila coded the Shift C stop (event `3ea50fb2-b2c8-4e25-8673-5ad40c233a27`, 2026-10-17 22:30Z–23:00Z, 30-min full stop) with SPEED-LOSS "Reduced extrusion rate", a performance reason. The owner keeps this stop uncoded (DECISIONS "Marun HDPE training plant"). Event revision 2 changed `reasonCodeId` (null → SPEED-LOSS), `oeeComponent` (availability → performance, the code's default, recorded as a user override), `codingState` (uncoded → coded) and `status` (Open → Coded), with no change reason. Nobody verified the coding. The change opened Shift C proposal `28d519b2…` at 15:33:35Z with trigger `event_change`. The valuation-policy approval at 15:50Z reused that open proposal and relabelled it `rate_change` / `profile_baseline_changed`. Maryam accepted it in 2.y as a valuation restatement, so approved Shift C revision 2 carried the SPEED-LOSS reason on its 14 t availability line.

**Cause (from the audit trail).** The coding did not come from the RCA steps. The RCA test ended at 14:51Z, and its "similar" lookup (`similar?eventId=<Shift C stop>`) and the event page's "Similar past RCAs" panel only read data. It came from a persona walkthrough of in-app notifications:
- admin logged out at 15:31:38Z;
- Leila logged in at 15:32:01Z and read her reminder `40439a14…` ("1 uncoded stop(s) waiting for a reason", kind `uncoded_backlog`, oldest stop ended 23:00Z) at 15:33:00Z;
- 24 s later she sent `PATCH /api/v2/production-events/3ea50fb2…` (the Edit / code form);
- at 15:33:37Z she read the level-2 reminder `56480a2c…` and logged out at 15:33:48Z;
- Omid, Sara and Reza followed, each reading their reminders, and Neda, Farid, Mina, Arman and Kamran logged in after 15:50Z.

Revision 2's payload matches one Edit / code save that only picked SPEED-LOSS: the OEE component is the code default and no change reason is set. The deployed form has no OEE component field, and PATCH takes no reason. No Claude transcript of this project covers 15:31–15:37Z (the only agent active then was running unit and integration tests on `proact_ux_test`), so the walkthrough ran outside these sessions: another tool or a manual session.

Each role did its own steps in the UI, logged in as an ordinary user. The API and SQL were used only to read results back. Screenshots are `.playwright-mcp/marun-e2e-fixc-*.png`.

| Step | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| 1 History before | Revisions 1 and 2 compared | History tab: revision 1 "Source update by System … created"; revision 2 "User change by Leila · 19:03" (local). Coding history: coding 1 "— · Unplanned / Availability", coding 2 "SPEED-LOSS · Reduced extrusion rate · Unplanned / Performance · by Leila" | PASS | fixc-01; SQL `event_revisions` |
| 1 Leila clears the reason | Edit / code → reason "— none —" → Save; back to revision 1's coding | Saved as **revision 3** (16:32:09Z, coding revision 3): `reason_code_id` null; the Summary shows Reason "—" and the verification panel "Coding: not coded yet". **Not fully restored:** `coding_state` stays `coded` and the status stays "Coded" (note A). The OEE component stays **Performance**, because the cleared code's default stays as a user override (note B). The change reason could not be entered: the form has no field for it, and `PatchProductionEventV2Dto` has no reason field, so revision 3's `change_reason` is null (note C). The reason was recorded on the proposal and the approval instead | PARTIAL | fixc-02; SQL |
| 1 Restore the OEE component | availability, as in revision 1 | **Not done.** The deployed Edit / code form has no OEE component field (`OeeComponentField` exists in the source but is not deployed). The one UI path is Event Hub → Bulk code with an OEE component and a reason, and this session's permission check refused it. Left open for the owner (note B) | OPEN | fixc-02 |
| 2 Coding verification | cleared if recorded on revision 2 | Revision 2 was never verified (`verified_by` / `validated_by` null, "Not verified"), so nothing needed clearing | PASS (n/a) | SQL |
| 3 Change proposal | Opens for period C; the approved revision is unchanged | `5a2dd993-58f2-4aef-bd64-5e75a9e1984d`, `event_change` / `loss_event_changed`, opened 16:32:15Z against approved revision 2 `62e79dd2…`; revision 2 unchanged | PASS | fixc-03-maryam-accept; SQL `period_change_proposals` |
| 3 Maryam accepts | New draft; the day reopens | History & exports → Change proposals → "Accept (new revision)…", reason "Revert accidental coding of the 02:00 stop by an automated test (SPEED-LOSS, 18 Oct 15:33Z); the owner keeps this stop uncoded. Quantities unchanged." Draft **revision 3** `c31082f0-34da-4b1a-85ed-36f21dc28745`, recalculated automatically; day certification `c3c681d2…` reopened with the same reason | PASS | fixc-03-maryam-accept, fixc-04; audit_log |
| 3 Sara submits | In review; coding warning shown | Availability 14 t "Not coded" (cause event linked), quality 1 t; "Submit for approval" → revision 3 In review. Review page: "Stop coding incomplete — shown as a warning · 1 stops: 0 with a reason, 0 investigation pending, 1 uncoded · coded stop time 0 % (target 95 %)" | PASS | fixc-05, fixc-06 |
| 3 Maryam refused | The reopener cannot approve | Approve… → "Approve revision": refused with "Separation of duties" (the text still says "You prepared it", as in 2.y). The revision stays in review | PASS | fixc-07 |
| 3 Reza approves | Approved with a comment | Approved 16:38:38Z with a comment (revert, uncoded, 14 / 1 / 209 t, residual 0, warning acknowledged) | PASS | fixc-08, fixc-09 |
| 3 Reza re-certifies 17 Oct | Certified | "Certify the day" → certification `3836c139-290d-476c-a1ad-705e5986de07`, Reza, 16:38:57Z, covering A3 / B2 / C3 | PASS | fixc-09; API production-days |
| 4 Approved Shift C revision 3 | availability 14 t with no reason; quantities unchanged | Approved lines: availability 14 t, reason **null**, cause event = the stop; quality 1 t. Restatement panel: target 224, actual / good 209, gap 15, attributed 15, residual 0, gross 210, rejected 1, all unchanged | PASS | SQL `approved_loss_lines`; fixc-09 |
| 4 Day | 621 good / 51 loss / residual 0 | Roll-up 672 / 621 / gap 51 / attributed 51 / residual 0 | PASS | API `GET /v2/production-days/:unit/2026-10-17` |
| 4 Value at contribution margin | C USD 2,250; day USD 7,650 | C revision 3: 2,250 USD (2,100 + 150) / 1,350,000,000 IRR, the same as revisions 1 and 2. Day: 7,650 USD (availability 6,300 / performance 600 / quality 750); `view contribution_margin, defaultView true` | PASS | SQL `approved_valuation_totals`; API `reports/loss-value` |
| 4 Coding gate | 1 uncoded stop again | Shift: 1 stop, 1 uncoded. Day: 2 stops, 1 coded, 1 uncoded, coded ratio 0.66666667 (3600 / 5400 s), `STOPS_UNCODED` + `CODING_COVERAGE_LOW`, passes false (warn) | PASS | fixc-06, fixc-09; API |
| 4 Earlier revisions kept | Revisions 1 and 2 unchanged | Shift C revisions 1 (no reason), 2 (SPEED-LOSS) and 3 (no reason) are all approved and immutable. Event revisions 1–3 kept | PASS | SQL |
| 4 Downtime coded ratio | 66.7 % | Downtime Analysis 17 Oct: "Stop time coded 66.7 %"; `coded_downtime_ratio` 3600 / 5400 | PASS | fixc-10; API `reports/downtime` |

Notes (bugs and gaps, not fixed here: product code is being edited by other agents):
- **A. Clearing a reason never un-codes a stop.**
  - Cause: `advanceStates` in `server/pro-act-backend/src/production-event/event-write-model.ts` only moves `uncoded → coded`; otherwise it keeps `existing.codingState`.
  - After the save, `coding_state = coded` and `status = Coded`, with `reason_code_id` null. The event chip reads "Coded" while the verification panel reads "Coding: not coded yet".
  - Gates and KPIs count `reason_code_id`, so they are correct.
  - Anything that reads `coding_state` misses this stop: the `uncoded_backlog` reminder (`downtime-alerts.ts`, work reminders), the uncoded partial index, and the Event Hub coding filter.
  - Proposed: `uncoded` when the reason is cleared and investigation is not pending.
- **B. A cleared reason leaves its classification behind.**
  - Coding SPEED-LOSS applied the code's default OEE component (performance) as a user override: `user_overrides.oeeComponent = 2`, and `classification_basis` cites the code default. Clearing the code keeps both.
  - The deployed Edit / code form has no OEE component field.
  - Restoring "availability" needs Bulk code (UI, with a reason) or a PATCH `oeeComponent: availability`. This is an owner action.
  - No PLA figure depends on it: the approved line's kind is availability either way.
- **C. Event edits cannot carry a change reason.** Neither the Edit / code form nor `PATCH /v2/production-events/:id` accepts one, so user revisions have `change_reason` null. Only bulk operations take a reason.
- **D. A reused change proposal hides its first trigger.**
  - Proposal `28d519b2…` opened as `event_change` (audit_log 15:33:35Z) and now reads `rate_change` / `profile_baseline_changed`.
  - Its before/after snapshots are quantity-only, so a reason-code change is invisible in it. In 2.y Maryam accepted the SPEED-LOSS coding as part of a valuation restatement without being shown it.
  - Proposed: keep every trigger on a reused proposal, and show reason-code changes per line.
- **E. The restatement panel lists a reason-only change as two unlabelled rows.** "Loss line · availability (t)" 0 → 14 and 14 → 0, with no reason code shown.
- **Test harness, not product:** after some minutes a Playwright tab stopped delivering trusted mouse and keyboard input (no `pointerdown` reached the document). A new tab fixed it.

## 4 Regression after the fixes (18 Oct 2026, 17:41–18:05Z)

This run checked the deploy of the downtime, clearing-a-reason, change-reason, PLA, month-close and RCA follow-up fixes (DECISIONS 2026-10-18). Each step was done in the UI by the persona who holds the role. The API and SQL were used only to read results back. Nothing was reseeded, Docker was not touched, and no product code changed. The Shift A stop `67cc2c2a…` was not saved: its form was opened read-only, and it is still at event revision 6 from 14:41Z. The Shift C stop `3ea50fb2…` still has no reason. Screenshots are `.playwright-mcp/marun-e2e-regr-*.png`. Downloads are in the session scratchpad `dl/` folder (`shiftA.pdf`, `rca.json`, `rca-recs.csv`, `rca-evidence.csv`). The application is now titled "Traverse Forge".

**Result: 30 of 33 checks pass. 1 fails, 2 are partial, and there are 4 UI gaps (G1–G4).** The failure is a clean-up gap left from before the fix (R1 below): it is data, not a figure.

| Step | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| 1 Leila restores the OEE component | Event Hub → Shift C stop → Edit / code. Set OEE component to Availability (new field) and Reason for the change to the given text; the reason stays none | The form now has an **OEE component** field (it showed Performance, with "Already overridden: OEE component") and an optional **Reason for the change** field. Leila saved; this is event revision 4 (17:44:27Z). `oee_component = availability`, `reason_code_id` null | PASS | regr-01, regr-02; SQL `production_events` |
| 1 Fix C: change reason | The revision carries the reason | `event_revisions` 4 and the coding revision 4 both have `change_reason` / `reason` "Restore OEE component after revert of accidental coding". The History tab shows it under "Revision 4 · User change by Leila". Coding 4 reads "— · Unplanned / Availability" | PASS | regr-03; SQL `event_revisions`, `event_coding` |
| 1 Fix A: coding state | Uncoded | **Still `coding_state = coded`, status "Coded"**, although there is no reason. The Summary chip reads "Coded" while Coding verification reads "Coding: not coded yet". Event Hub → "To code" reads "Nothing to code — All stops in this window are coded" (regr-34). The Event Hub list also shows the stop as Coded. Cause: fix A runs only when a write *clears* a reason. This stop's reason was cleared at 16:32Z, before the deploy, and the OEE-only edit does not recompute the state. Nothing repairs existing rows (see R1). The gates count `reason_code_id` and are still right: the day shows 1 uncoded, 66.7 % | **FAIL** | regr-02, regr-34; SQL |
| 1 User override | The value is availability | `user_overrides.oeeComponent` went from 2 to 4, so it is still a user override (the user chose the value). The value is correct | PASS (note) | SQL |
| 1 Change proposal for period C | Opens against approved revision 3 | `9759234a-7c23-4ca1-90e4-cf9f7db425ac`, `event_change`, opened 17:44:30Z | PASS | SQL `period_change_proposals` |
| 1 Fix D/E display (Maryam) | Triggers list; coding-changes row | The trigger list reads "Event changed", which is the single entry in `detail.triggers`. The new "Loss value before (approved, Contribution margin): 1,350,000,000 IRR · 2,250.00 USD" is shown, with "Loss value after: calculated when the proposal is accepted". There is **no coding-changes row**: correct, because the reason code did not change. Before and after are identical, so the proposal does not say *what* changed (the OEE component change is not named; see R3). The older proposal `28d519b2…` still reads "Rate changed", because triggers were not backfilled (documented) | PASS (note) | regr-04, regr-05 |
| 1 Maryam accepts | New draft; the day reopens | "Accept (new revision)…" → reason → draft **revision 4**, recalculated automatically (21:17 local). Day certification `3836c139…` is `reopened` | PASS | regr-06; SQL |
| 1 Sara submits | In review | "Submit for approval" → revision 4 "In review" | PASS | regr-07 |
| 1 Maryam's Approve disabled | Disabled with "You reopened this revision" | `Approve…` is disabled (`aria-describedby=approve-gate`): "You reopened this revision: another manager approver must approve it (separation of duties)." | PASS | regr-08 |
| 1 SLA line | Shows the data state | "To approve · Data complete · Pause for late data…" | PASS | regr-08 |
| 1 Reza approves | Approved with a comment | The approval dialog shows Attributed 15.00 t and Unaccounted 0.00 t; Reza approved revision 4 at 17:48:13Z | PASS | regr-09 |
| 1 Reza re-certifies 17 Oct | A confirmation dialog shows good / loss / residual and the coding gate | "Certify this production day?" → "Good 621.00 t of target 672.00 t · loss 51.00 t (attributed 51.00 t, residual 0.00 t) · 3 shifts" and "Day stop coding incomplete — shown as a warning: 2 stops, 1 uncoded · coded stop time 66.7 % (daily target 99 %)". Certified: `5996bf20-fb3b-4834-8045-62ecc1039b44`, Reza, 17:48:30Z | PASS | regr-10, regr-11; SQL |
| 1 Figures unchanged | Day 621 / 51 / 0; USD 7,650 at contribution margin; Shift C still 1 uncoded stop | Day roll-up 672 / 621 / 51 / attributed 51 / residual 0. `reports/loss-value` `contribution_margin, defaultView true`: availability 6,300 + performance 600 + quality 750 = **USD 7,650** (IRR 4,590,000,000). Shift C revision 4 is 2,100 + 150 = USD 2,250, the same as revision 3. Day gate: 2 stops, 1 coded, 1 uncoded, ratio 0.66666667, `STOPS_UNCODED` + `CODING_COVERAGE_LOW`. Shift C: 1 stop, 1 uncoded, 0 % | PASS | API `production-days`, `reports/loss-value`; SQL `approved_valuation_totals` |
| 1 Day gate while C is in review | Consistent | While Shift C was in review, the day line read "2 stops, 1 uncoded · coded stop time **100 %**". The ratio counted only the approved shifts, while the count included Shift C. After approval it read 66.7 %. Display only (R2) | PARTIAL | regr-08 |
| 2 Reliability: MTTR and restore side by side | MTTR 30 min and mean time to restore 1 h | Reliability columns: "Mean active repair time (MTTR) — Active repair from work orders" **30 min** and "Mean time to restore production — Full outage" **1 h**. MTBF is 22 h 30 min for 17 Oct (38 h 30 min over 7 days). The page states that shift filters do not apply to Reliability, so there is no Shift A-only reliability row. Shift A Overview: downtime 1 h, availability 87.5 %, coded 100.0 % | PASS | regr-12, regr-13 |
| 2 Event summary labels | Source vs Origin; Event severity vs Failure severity | The Summary has "Event severity —" and "Failure severity Critical" (Shift A) as separate rows, and "Source: State engine · Derived". The form names the origin "Caused by unit / Caused by asset" | PASS | regr-14, regr-02 |
| 2 Impact basis | "From the approved impact rule for EXT1-Main" | "From the approved impact rule for Main drive and gearbox (Impact on production)" names the asset, not its code. Shift A form opened and left without saving | PASS | regr-15 |
| 2 Work-order link | "Open the stop" | Master Data → Work-order operations (as Farid): WO-EXT1-20261017-01 / 0010 → "Open the stop" → `/events/67cc2c2a…?tab=repair`. Leila gets "You don't have permission to access master data management" (role design) | PASS | regr-16 |
| 3 Coding gate 66.7 % | 66.7 %, not 66.6 % | Day gate on the period review page and in the certify dialog: "coded stop time 66.7 %". Downtime Analysis: "Stop time coded 66.7 %" | PASS | regr-10, regr-12 |
| 3 Provenance grouped by signal name | Signal name, not `signal:<id>` | Shift A Actuals provenance: "EXT1-Throughput · counter delta step:delta · coverage 100 % · 480 segments (480 measured) · 06:00 → 14:00". The method shows a raw key `step:delta` | PASS | regr-17 |
| 3 Correct a disposition (Leila) | Action on the approved lot opens a pre-filled form | "Correct this disposition…" appears on the approved 3 t lot only, not on the superseded 2 t lot. It opens `…/dispositions/new?supersedes=6b1cbff6…` with the lot, 3 t, interval 06:00–14:00 and the product locked. Not submitted; still 4 dispositions | PASS | regr-18; SQL |
| 3 Omid reaches Actuals & quality only | Actuals & quality; other sections redirect | From the event Periods tab, "2026-10-17 · A" opens `/actuals?view=approved`. `/`, `/review`, `/value` and `/history` all redirect to `/actuals`. `/planning` and `/period-accounting` show "No access". Omid also sees "Correct this disposition…", as a disposition writer. The breadcrumb still links "Plans, Profiles & Calendars", which he cannot open (small) | PASS | regr-20 |
| 3 PDF names the value basis and FX source | Basis and exchange-rate source in the text | The cover has "Loss value basis: Contribution margin" and the header "Loss values: Contribution margin". Revision 3 lists "Loss value basis: Contribution margin (valuation policy version 2)" and "Exchange rates: rates frozen in the approval snapshot". Lines: quality 3 t USD 450, availability 28 t USD 4,200, manual performance 4 t USD 600. Small: the label "Window (plant time)" has the value "1 named approved revisions", and the basis shows the raw `planning_rate` | PASS | regr-19; `dl/shiftA.pdf` |
| 3 Month close Mehr 1405 | Refused with `MONTH_NOT_ENDED`, or `monthEnded=false` | Read only. `GET /v2/month-closes/1405-07` (Reza): `monthEnded false`, `monthEndsAt 2026-10-23T02:30Z`, `missingPeriodCount 13`, `met false`. `GET /v2/month-closes/2026-10` → 422 `MONTH_KEY_AMBIGUOUS` (overlaps 1405-07, 1405-08). UI: "Close quantities…" is disabled. **UI gap G1:** the Overview cards show only "Periods not approved 2 (3 of 5)", "Days not certified 1" and "Open proposals 0". They do not say that the month has not ended or that 13 expected periods do not exist yet | PASS (UI gap) | regr-28; API |
| 4 RCA JSON export | Contains actions, causes, links, outcome | Farid → Export → Investigation (JSON): `actions` (2, with owner, verifier, method, evidence, window, baseline), `causes` (3), `links` (2), `outcome`, `closure` (residual risk, request, approval, verdict) and `plantTimeZone Asia/Tehran` | PASS | regr-24; `dl/rca.json` |
| 4 Recommendations CSV dates | Plant time | The columns are "Due date (Asia/Tehran)" `2026-10-19` and "Due (UTC)" `2026-10-18T20:30:00.000Z`. The evidence CSV adds "Verified by" and "Task assignee" | PASS | `dl/rca-recs.csv`, `dl/rca-evidence.csv` |
| 4 Omid: RCA menu and My RCA actions | Visible | The operator menu has RCA Analysis and My work. `/rca` shows "My RCA actions" | PASS | regr-21 |
| 4 Omid opens his done action read-only | Read only, no Mark done | On the case → Recommendations & actions, his action shows "Repair · owner Omid", "Done on 2026-10-17, evidence checked by Farid". There is no Mark done button and no editable control (the only buttons are Export and the filters). **UI gap G2:** "My RCA actions" lists only open actions ("No open RCA actions"), and its "All RCA actions" link goes back to the same list. Omid can reach his done action only through the event ("Open the linked investigation") or a direct link | PARTIAL (UI gap) | regr-22, regr-23 |
| 4 RCA policy effectiveness fields | Editable, minimum run hours 600 | As Reza, RCA trigger settings, version 2: inputs "Minimum run hours after the action" 600, "Baseline lookback (days)" 90, "Required reduction (%)" 50 and "Review checkpoint (days)" 90. FMEA, 5-Why and per-class methods are inputs too. The summary reads "at least 600 run hours after". Not saved | PASS | regr-27 |
| 4 Loss-line picker lists manual lines | The approved manual 4 t line is offered | As Farid, Links → Link: "Approved loss line" lists six lines, including **"2026-10-17 · A · Performance 4.00 t · Reduced extrusion rate"**. Nothing was linked. Small: the 28 t line that is already linked still shows "Link" here (events show "Linked"), and a closed case still offers the Link form | PASS | regr-25 |
| 4 Knowledge base search | Text search | "lubrication" keeps the gearbox entry; "zzqx-nomatch" gives "No entries … Clear filters" | PASS | regr-26 |
| 5 Spot check as Reza | No errors; no "demo" | Dashboard ("For you: Pending approvals 0"; OEE 92.4 %), Event Hub, PLA overview, Reports, My work (Periods / RCA actions / Tasks), Downtime, RCA and Pending Approvals all have 0 console errors and no "demo" in the text or HTML. PLA 17 Oct waterfall: 672 − 42 − 4 − 5 = **621, "Closes to actual"** | PASS | regr-30-reza-*, regr-31 |
| 5 Spot check as Leila | Same | Dashboard "For you: Current stops 0 · Stops to code", Event Hub, PLA, Reports and My work all have 0 errors and no "demo" | PASS | regr-33-leila-* |

**Findings (for the owner; product code not changed here).**
- **R1. Stops whose reason was cleared before the fix stay "Coded".** Shift C's stop has `reason_code_id` null and `coding_state` coded. Nothing repairs these rows: no migration, no recompute on a later edit. So the uncoded reminder, the uncoded index, the Event Hub "To code" filter and the list chip all miss it, while the gates count it correctly.
  - Proposed: an expand-only data migration or repair CLI that sets `coding_state = 'uncoded'` (status Open) where `reason_code_id IS NULL AND NOT investigation_pending AND coding_state = 'coded'`.
  - Or make `prepareUpdate` derive the coding state from the merged reason on every write.
  - Not fixed in this run, because the rules forbid DB writes outside the app and product-code changes.
- **R2. The day coding line mixes bases while a shift is open.** The stop count includes every shift, but the coded ratio covers only approved shifts. With Shift C in review, the line read "1 uncoded · coded stop time 100 %". Use one basis for both, or say "approved shifts only".
- **R3. A proposal from a non-quantity, non-reason change shows identical before and after.** An OEE-component change is not named, so the manager accepts without seeing what changed. Proposal: name a classification change (OEE component, schedule class) per line, as the reason changes are named.
- **G1–G4. UI gaps.**
  - G1: the month-close Overview does not show "month not ended" or the missing expected periods.
  - G2: "My RCA actions" has no way to see done actions.
  - G3: the PDF cover label "Window (plant time)" has the wrong value, and raw `planning_rate` / `step:delta` keys appear.
  - G4: a closed case still offers the Link form, and an already-linked loss line shows "Link".
- Recommendations of the case still read "Open". The case closed before the fix, and the rule applies only at closure approval; there is no backfill.
- Harness: the browser profile prefills the login form with `manager@acme.com` (saved credentials, not product). The password was passed to the browser by a throwaway 127.0.0.1 server, which was stopped after the run.

### 4.1 Follow-up deploy (18 Oct 2026, 18:47Z)

The ten regression findings were fixed (DECISIONS "2026-10-18 — Marun regression follow-ups") and deployed. Migrations applied: `UncodeReasonlessCodedStops1794221600000`, `CloseRecommendationsOfClosedCases1794221700000`.

| Check (read-back) | Expected | Actual | Result |
|---|---|---|---|
| Shift C stop `3ea50fb2…` coding state | uncoded (no reason) | `coding_state = uncoded`, status Open, no reason | PASS |
| Shift A stop `67cc2c2a…` | unchanged, coded | coded, MECH-GEARBOX | PASS |
| Recommendations of closed case `f58df7af…` | Completed (all actions done) | both Completed | PASS |
| Gates before deploy | green | backend unit 2322/2322; integration stop-events 12, day-certification 6, reconciliation-late-corrections 6, rca-cases 19; frontend typecheck clean, 17 affected vitest files 138/138, lint 0 errors | PASS |

## 5 Owner manual-test findings — verification

Checked on 18 Oct 2026, 20:05–20:25Z (server clock), after the deploy of these DECISIONS entries: "Shared work-item notifications, read / unread, approval detail page", "Owner findings: actor names, one status wording, Integration for SuperAdmin only", "'Some values were not accepted'" and "Owner 'do according to standards'". Each check was done in the UI as the persona who holds the role. The API and SQL were used only to read results back.

Nothing was approved, rejected, retired, coded or edited. The only writes were read / unread toggles on Shirin's notifications, and both were returned to unread. The error-message check sent two requests that were refused on purpose (details in step 6). No valuation policy row was created: the latest `accounting_policies` row is still from 16:18Z. Docker was not touched and no product code changed. The password was passed to the browser by a throwaway 127.0.0.1 server, which was stopped afterwards. Screenshots are `.playwright-mcp/marun-e2e-owner-*.png`.

**Result: 6 of 7 findings pass. Finding 1 is partial and finding 5 fails on one screen.** Two new bugs were found: O1 and O2, described after the table.

| Finding | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| 1 Actor names: event History tab (both 17 Oct stops) | Each revision names the person; derived revisions read "System (state engine)"; never "Changed by a user" or an id | Shift A `67cc2c2a…`: revisions 6–2 read "User change by Maryam / Farid / Farid / Shirin / Omid". Coding history: "by Maryam / Farid / Omid (classification set manually)". Shift C `3ea50fb2…`: revisions 4–2 read "User change by Leila", and revision 4 shows its change reason. No id and no "a user" appears. **But revision 1 of both stops (`actor_kind = system`, source State engine) reads "Source update by System", and coding 1 reads "by System".** The source is not named, so the "System (state engine)" wording from the decision is missing | PARTIAL | owner-03-history-A, owner-03-history-C; SQL `event_revisions` |
| 1 Period history, approvals, RCA history, audit | Names | Period A and C History & exports: the By column reads Sara / Maryam / Reza on every submit, reopen and approve row. RCA case `f58df7af…` History reads "· Maryam" and "· Farid" on every row, and action owners Leila and Omid are named. Audit log (admin): the User column has names ("Farid", "Leila", "HDPE-TRAIN administrator"). There is no id and no "Unknown user", "Former user" or "a user" anywhere | PASS | owner-04-period-*, owner-05-rca-history, owner-06-audit |
| 2 Integration: SuperAdmin | Menu and all four pages | admin@: the menu has /connectivity, /connectivity/source-status, /connectivity/source-authority and /enhanced-historian. All four pages open | PASS | owner-01-admin-integration |
| 2 Integration: Mina, Leila, Reza | No menu entry; a direct URL shows the access-denied page | None of the three has an integration link in the menu. All four URLs show "No access — Your roles in this plant do not include <page>." This includes Mina (integration_admin) | PASS | owner-02-{mina,leila,reza}-* |
| 2 Integration: Sara | Not listed in the menu; Source Priority reachable for review | Sara has no menu entry. /connectivity/source-authority opens Source priority, and /connectivity/source-status opens too: she is a status-mapping approver (`canReviewSourceStatusRules`). /connectivity and /enhanced-historian show "No access". No source-authority item is pending (her inbox is empty), so the inbox path could not be followed; the direct route works as the decision says | PASS | owner-02-sara-*; API `GET /v2/approval-inbox` (Sara) = 0 items |
| 3 Bell, count, filters, read / unread (Shirin) | Unread count; All / Unread; Mark as read / unread; Mark all read; the count updates | The bell read "Notifications, 2 unread". The dialog has "Mark all read", All / "Unread (2)", an "Unread" label on each item and a per-item "Mark as read". Mark as read gave "1 unread" and "Unread (1)", and the Unread view lists only the other item. Mark as unread gave "2 unread". Mark all read gave "Notifications" with both items offering "Mark as unread". Both were set back to unread, and the count returned to 2 | PASS | owner-09-shirin-bell, -marked-read, -unread-filter, -all-read |
| 3 Bell as Leila, Sara, Reza (and Omid) | Same controls | Leila: 0 unread, 2 read items, each offering "Mark as unread"; "Mark all read" is hidden when nothing is unread. Sara: 2 unread, all controls present. Omid: 1 unread (per-person read state). Reza: the bell is empty, because managers are not recipients of the uncoded-stop reminder and his SLA reminders are resolved. His controls could not be toggled | PASS | owner-10-*-bell |
| 3 Shared 17 Oct uncoded reminder | The same work item for every recipient; resolved items not in any active list | SQL and `GET /v2/notifications?state=all` per user: all 11 recipients (Leila, Shirin, Sara, Omid, Farid, Mina, Arman, Bahram, Darya, Kamran, Neda) hold the same two active items with `workItemKey uncoded:da0560f4…:2026-10-17`: level 1 "1 stop(s) waiting" (13:00Z) and level 2 escalated "2 stop(s) waiting" (12:50Z). The work item is still open, because the Shift C stop is uncoded, so both rightly stay active and identical for everyone. There are no separate Shift A reminders: the key is per unit and day. Maryam's three SLA submit reminders are `resolved` / `completed` at 20:05:00Z and are not in her active list. Reza has none. **See O2: the level-2 text still says "2 stop(s)" although only 1 is left** | PASS (note O2) | owner-09/10; API `state=all`; SQL `user_notifications` |
| 4 Manager tile (Reza, Maryam) | "N approvals pending" opens the record if N = 1, else the inbox | Both read "For you: Pending approvals 0 — Waiting for your approval roles", and the tile links to /approvals. With N = 0 the inbox is correct. The N = 1 path could not be exercised live because nothing is pending for either manager. Unit evidence: `for-you.test.tsx` "manager with exactly one pending approval: the tile opens that record" (href `/approvals/plan/plan-v-1`) passes | PASS (N = 1 by unit test) | owner-08-*-dashboard; vitest 15/15 |
| 4 Approval detail page | Review opens /approvals/:kind/:id with the record, author, submitted at, summary, eligibility and the decision buttons for its kind; "Open full workspace"; no dead end | Only SuperAdmin has pending items: five "Restatement posting" items (`finance-posting`, required role finance_approver, which no plant user holds). Inbox "Review" and the title link open `/approvals/finance-posting/6fd2da61…`. The page shows: workflow Restatement posting; record "2026-10-17 · restatement 3 · version 3"; state awaiting posting; unit HDPE Extruder 1; requested by Reza; submitted 2026-10-18 19:39 (+03:30); approval role finance approver; summary. "Your decision" reads "decided in its workspace", with the SuperAdmin note. The primary action is "Review & decide in workspace", because this is a workspace-only kind, as the decision says. No decision button was clicked. As Reza and Maryam, the same URL shows "No longer pending … decided, withdrawn or outside your approval roles" with "Back to Pending Approvals", so it is not a dead end. Approve / Return / Reject buttons for inbox-command kinds could not be seen live because none is pending. Unit evidence in `approval-detail.test.tsx` passes: approve a profile, return a plan with a reason, reject a disposition with a reason, separation of duties, workspace-only, no longer pending | PASS (buttons by unit test) | owner-07-admin-inbox, owner-07-admin-approval-detail, owner-08-*-not-pending |
| 5 Status: Event Hub list and summary (Omid, Leila, Reza) | Coding chip and accounting chip, the same for every role | Shift C stop, list row for all three roles: "Ended · **Uncoded** · **Accounting: approved** · State engine". Summary chips for all three: "Ended \| Uncoded \| No RCA \| Accounting: approved \| Not verified". Shift A: "Coded · Accounting: approved · RCA completed" | PASS | owner-11-*-eventhub, owner-11-*-summary-C |
| 5 Period grid wording | Draft / In review / Approved / In review (inputs changed) | Plan period grid and PLA reconciliation: the three 17 Oct periods read "Approved"; the page's labels are Not calculated / Draft / In review / In review (inputs changed) / Approved. "Waiting for approval" and "Not reconciled" are gone. The event Periods tab reads "Approved". No 18 Oct downtime or period is in review, so "Accounting: in review" could not be seen live (label map `GRID_WORKFLOW_LABELS`) | PASS | owner-12-reza-plans-*, owner-12-reza-pla-analytics-reconciliation-* |
| 5 Status: event Values tab | Same coding state as the chip | **Shift C Values tab: "Coding state — In use: Coded", while the chip, the list and `production_events.coding_state` read uncoded.** See O1 | **FAIL** | owner-14-values-C; SQL |
| 6 Refusal names the field (UI) | The alert names the field(s), not only "Some values were not accepted" | Valuation policy form (admin, the finance_maintainer path). The browser validates a past start and a missing reason before sending, so the request was refused at the server instead: Playwright changed the outgoing POST (every mutating API call in the window was changed, as a safety net). (a) An extra property gave 422 `VALIDATION_FAILED` `property ownerTestProbe should not exist`; the alert read "Some values were not accepted — This screen sent a field the server does not accept. Report the field named below with the support reference. **Unexpected field: ownerTestProbe** · Copy support reference". (b) Bad `defaultBasis` and `reportingCurrencies` gave 422; the alert read "**Default basis:** Must be one of … **Reporting currencies:** Must be an ISO 4217 code", and both inputs carry the message. Then Cancel; nothing was created. Small: the alert says "Default basis" while the form label is "Default management view", and it shows raw enum keys | PASS | owner-13-refusal-unexpected-field, owner-13-refusal-named-fields; SQL `accounting_policies` |
| 6 Refusal names the field (API) | 4xx naming the property | `POST /v2/valuation-policies {"bogusField":1}` as admin: 422 `VALIDATION_FAILED` with `fieldErrors[{field:"bogusField", constraint:"whitelistValidation"}, …]`. As Reza and Sara: 403 `FORBIDDEN_ROLE` "Requires one of: finance_maintainer", before validation | PASS | API |
| 7 No "demo" | None | Dashboard, approvals, approval detail, Event Hub, event pages, period history and review, RCA history, audit, finance, connectivity, plan grid, PLA, month close and My work, across the roles above: no "demo" in the HTML | PASS | page scans |

**Bugs and notes (for the owner; product code not changed here).**
- **O1. The event Values tab shows a stale coding state after the R1 repair.** Shift C stop `3ea50fb2…`: `production_events.coding_state = uncoded`, status Open, so the chip and list read "Uncoded". The latest revision's `event_revisions.effective_facts` (revisions 2–4) still holds `codingState: coded`, `status: Coded`, and the Values tab reads "Coding state — In use: Coded". Cause: migration `UncodeReasonlessCodedStops1794221600000` repaired the event row only, not the effective facts of its latest revision. Fix options:
  - a follow-up data migration that patches `effective_facts` of the latest revision for the repaired rows, or appends a system revision "coding state recomputed";
  - or make the Values tab read the coding state from the event row.
- **O2. The escalated uncoded reminder keeps a stale count.** All 11 recipients have the level-2 reminder "2 stop(s) waiting for a reason" next to the level-1 "1 stop(s)". Shift A was coded, so 1 remains. The key `uncoded:<unit>:<day>` is still open, so the rule correctly keeps it active, but its text is stale. The level-2 item (12:50Z) is also older than level 1 (13:00Z). Proposed: show the current count of the work item, not the count frozen at alert time, or supersede a lower-count item when a newer reminder for the same key is written.
- **Actor wording.** Derived and source revisions read "System" without the source. The decision asks for "System (state engine)" (finding 1, partial).
- **Header revision number.** The event header reads "Derived · revision 7" for Shift A (and 5 for Shift C), but the History tab lists revisions 1–6 (1–4). The header shows `row_version`, not the event revision.
- **Restatement postings.** Five pending items require `finance_approver`, which no plant user holds, so only SuperAdmin can act on them. This is a role-assignment question for the owner.

### 5.1 Follow-up deploy (19 Oct 2026)

Fixes per DECISIONS "2026-10-19 — Owner manual-test gaps" deployed; migration `RecordUncodedStopRepairRevision1794222400000` applied.

| Finding | Check (read-back) | Result |
|---|---|---|
| Actor wording | engine/source revisions read "System (state engine)" / "System (data repair)" / "System (<source>)" | PASS (unit + UI tests) |
| O1 Values tab | Shift C stop revision 5: actor `system`, reason "Repair: reasonless stop marked uncoded"; "In use" reads the current event (uncoded) | PASS |
| O2 reminder count | active reminders (levels 1 and 2) read "1 uncoded stop(s) waiting for a reason", `countedAt` refreshed by the sweep | PASS |
| Restatement postings | Kamran holds finance_approver plant-wide; inbox, posting command and UI capability accept him (the earlier check only looked as admin/Reza/Maryam) | Not a bug |
| Field-error labels | form labels and choice names (valuation policy: "Default management view") | PASS (unit tests) |
| Event header revision | newest revision number from history | PASS (unit test) |
| Gates before deploy | frontend 1566/1566, backend 2349/2349, typechecks clean, lint 0 errors; integration work-item-resolution 8/8, stop-events 13/13 | PASS |
