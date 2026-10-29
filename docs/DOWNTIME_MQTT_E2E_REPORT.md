# Downtime over MQTT on Marun HDPE: end-to-end report (28 Oct 2026)

Plant HDPE-TRAIN (Asia/Tehran, UTC+03:30), unit Extruder1 `da0560f4-2916-450d-9d30-4012e86fa17e`, asset EXT1-Main. The plant runs declared mode (loss accounting policy v3: day grain, declared basis, stops cross-check on). The journey follows the OT downtime message from the broker to every screen that shows a stop, with the ordinary personas and separation of duties. It is the downtime counterpart of the PLA run in `docs/PLA_DECLARED_MODE_PLAN.md` Task 12.

Companion: `docs/MQTT_FEEDS_PAYLOADS.md` (the message template), `docs/PLA_DOWNTIME_CURRENT_MODEL.md` (how stops relate to the loss), `e2e/downtime-mqtt-journey.spec.ts` (read-only Playwright spec over the data this run created), screenshots in `docs/qa/evidence/downtime-mqtt-2026-10-28/`.

## Summary

| Area | Outcome |
|---|---|
| OT → stop | Open message creates an ongoing stop; the closing revision ends it; a duplicate delivery is counted and ignored; an unknown reason creates the stop uncoded with a quarantine note; an unknown unit is parked until bound and replayed |
| Event Hub | Current stops shows the ongoing stop with elapsed time; the operator codes, the engineer merges and splits, the manager verifies; every edit keeps the OT fields read-only and the audit history |
| Source revisions after user edits | A later OT revision keeps the operator's coding and updates the source-owned fields; a revision of a stop users merged lands on the superseded original and opens a `late_correction` review item |
| Loss accounting | Unchanged, as declared mode intends: no loss line from any stop; the 29 Oct statement stays 240 / 208 / 32 / 0 with "Stops cross-check: 16.33 t recorded in stops" (refreshed to 41.53 t by revision 2 on 29 Oct, after three more stops of that day arrived; see `docs/DEMO_GUIDE_PLA_AND_DOWNTIME_JOURNEYS.md`) |
| Roles | admin, reza, omid, sara, leila, farid all checked on screen (see §4) |
| Findings | 1 Important (pre-existing), 4 Low (see §5) |

Nothing was reseeded or cleared. The PI sample simulator was stopped first (§1), as asked.

## 1. Preparation

| Step | Result |
|---|---|
| PI sample simulator (`test/simulators/pi-web-api/run-sample-pi.ts`, host port 5460) | Process stopped; port free |
| Connection "SIM Marun PI (sample)" `f2fee882-d954-429d-8f4c-2de8e68c84ed` | Deactivated through `PATCH /v2/connections/{id}` as admin (rowVersion 1 → 2). Its last open stop `F1FmMarunLHSKQQ` was closed by omid at 19:37 with the reason "PI sample simulator stopped; end time not delivered by the source" |
| Feed connection "Marun OT feeds (UI e2e)" `f334beca-ca4f-4310-b87f-116d84e07740` | Subscribe job `a033a10a-eb52-49dc-821b-3bca8b6a0f69` connected, topics `proact/marun/hdpe/pla` and `proact/marun/hdpe/downtime`; counters before the run: received 7, accepted 7, parked 1 |
| Publisher | `mosquitto_pub` inside `proact-mqtt-1` (port 1885, user `proact-sim`, QoS 1), one JSON message per step exactly in the template of `docs/MQTT_FEEDS_PAYLOADS.md` |

The 2,210 simulator stops of 17–28 Oct remain in the tenant (1,933 coded, 277 uncoded, all ended). They are PI-sourced and dated; only one was still physically open and it is now closed.

## 2. Messages published and what the server did

All times are plant time on 28 Oct 2026. `event_id` is the OT identity; `#m`, `#1`, `#2` suffixes are the server's ids for merged and split parts.

| # | Message (`proact/marun/hdpe/downtime`) | Expected | Observed |
|---|---|---|---|
| 1 | `MARUN-HDPE-EXT1-20261028-1905` rev 1, unit Extruder1, equipment EXT1-Main, start 19:05, no end, reason MECH-GEARBOX, status OPEN | Ongoing stop on Extruder1 / EXT1-Main, coded | Stop `b801f719…` created: `isOpen: true`, elapsed 1 952 s at read time, reason MECH-GEARBOX (availability, unplanned, full stop by the EXT1-Main impact rule), accounting period 2026-10-28 Day |
| 2 | `…-1700` rev 1, 17:00–17:12, `duration_min` 12, reason **SCREEN-CHANGE** (not in the library) | Stop created uncoded; quarantine `unknown_code` | Stop `351cc61a…` created uncoded; quarantine item `4a630fc6…` "Unknown reason / impact code", detail `"SCREEN-CHANGE" is not a code of this tenant`, canonical event linked. The item resolved itself (outcome `updated`) the moment omid coded the stop |
| 3 | `MARUN-HDPE-PEL1-20261028-1630` rev 1, unit **Pelletizer1** (not a unit), 16:30–16:45, reason ELEC-TRIP | No stop; quarantine `unknown_unit`; job counter "parked" +1 | Quarantine item `1c6b978f…` "Source not mapped to a unit", element path Pelletizer1; parked 1 → 2 |
| 4, 5 | `…-1800` 18:00–18:05 and `…-1805` 18:05–18:10, both ELEC-TRIP | Two coded stops, flagged as repeat incidents | Both created coded; Event Hub shows "Repeat incident" on both |
| 6 | `…-1905` rev 2, same message plus end 19:40, `duration_min` 35, status CLOSED | The open stop closes; duration 35 min | `endTime` 19:40, `durationSeconds` 2 100, row version 3; Current stops drops to 0 |
| 7 | Message 6 sent again unchanged | Duplicate, nothing written | Counter duplicate 0 → 1; event unchanged (row version 3) |
| 8 | `…-1700` rev 2 after omid coded it GRADE-CHANGE: end 17:15, reason ELEC-TRIP, new description | Source-owned end and description update; operator's reason kept | `endTime` 17:15, description updated, reason still GRADE-CHANGE, no review item (codes are taken only on create) |
| 9 | `…-1800` rev 2 after leila merged 1800 + 1805: end 18:06, new description | The revision must not silently change the merged stop | Applied to the superseded original (`245a5dc0…`: end 18:06, row version 4); merged stop `037f10de…` unchanged (18:00–18:10); review item `late_correction` opened on the original |

Job counters at the end: received 15, accepted 14, duplicate 1, stale 0, conflict 0, quarantined 0, parked 1 (the 26 Oct Pelletizer item that was never replayed). The read-only Playwright spec `e2e/downtime-mqtt-journey.spec.ts` (9 tests, run twice: 9 passed) pins every row of this table and the role checks of §3 against the live data. Screenshot `dt-04-admin-feed-counters.png`.

## 3. Screens and actions, by persona

| Step | Persona | Screen | Checked | Evidence |
|---|---|---|---|---|
| Ongoing stop | omid (operator) | Event Hub → Current stops | "Current stops (2)": the MQTT stop "Ongoing · 34 min · Since 19:05 · MECH-GEARBOX" with Open / Close stop / Code; the list row shows "Ongoing", asset "Main drive and gearbox", source "MQTT", "Accounting: approved", "View accounting" | `dt-01-omid-current-stops-open.png` |
| Closed by OT | omid | Event Hub after reload | "Current stops (0)"; the row reads "35 min" | — |
| Code the unknown-code stop | omid | Event page → Edit / code | Banner "This stop comes from MQTT; changes to source fields are recorded as overrides"; start, end, asset, description read-only "From MQTT" with "Override…"; reason picker found GRADE-CHANGE; saved with a change reason → revision 2, "Coded", schedule class Planned (from the code) | `dt-02-omid-unknown-code-coded.png` |
| Bind and replay the unknown unit | admin | Connectivity → Quarantine → item | "Bind source to a unit" → Extruder1 → "Bound Pelletizer1; dry-run and replay to apply it" → Dry-run replay (records 1) → Replay and resolve (audited reason) → "This item is resolved"; stop `56762143…` created on Extruder1 16:30–16:45 ELEC-TRIP; source mapping `exact_path` Pelletizer1 → Extruder1 listed under Source mappings | `dt-03-admin-quarantine-bound-replayed.png`, `dt-11-admin-source-mappings.png` |
| Merge | leila (production engineer) | Event Hub → select 18:00 and 18:05 → Merge | Dialog "Merge 2 stops … One unit only", gap 0, reason required; result: one stop 18:00–18:10 ELEC-TRIP, both originals superseded ("Cancelled") | — |
| Split | leila | Event page of the Pelletizer stop → Split | Dialog with date, time, drag slider, both parts previewed, reason required; result: parts 16:30–16:38 and 16:38–16:45, both ELEC-TRIP, original superseded | — |
| Verify coding | reza (manager, approver) | Event page → Coding verification → Verify coding | "verified by Reza, 2026-10-28 19:46"; summary chip "Verified by Reza"; revision 3 | — |
| Cross-check and statement | reza | Period 2026-10-29 Day | Declared lines 20 t MECH-GEARBOX + 12 t FEED-STARVED; "Status: Capacity figures not available (declared basis)"; "Stops cross-check: 16.33 t recorded in stops"; waterfall 240 → 208 | `dt-05-reza-period-29oct-stops-cross-check.png` |
| Statement from the stop | reza | "View accounting" on the 19:05 stop → Accounting statement | Window 28–29 Oct, "← Back to the event", 29 Oct row 240 / 208 / 32 / 32 / 0, note "1 period is not in the total" (28 Oct, see F1) | `dt-10-reza-statement-28-29oct.png` |
| Downtime analysis | omid | Overview, Stops & timeline, Causes & Pareto (24 h) | Overview: downtime 2 h 14 min, stops, MTBF tiles; Stops & timeline lists the 19:05 and the merged 18:00 stops with source "MQTT"; Causes & Pareto: "No availability losses in this scope" (F3) | `dt-06-…`, `dt-07-…` |
| Reliability | leila | Reliability (MTBF/MTTR), 24 h | Page renders; "Data covers 0 % of the window", "2 periods in this window: No approved plan covers this period" (F1, F4) | `dt-12-leila-reliability-24h.png` |
| Read-only | sara (production accountant) | Event page of the 19:05 stop | No Edit / code, Split or Verify coding; sees "Verified by Reza", the MQTT markers and the day sections | `dt-09-sara-event-readonly-verified.png` |
| RCA trigger | farid (reliability engineer) | Event page of the 19:05 stop | "Investigation recommended: Same failure repeating · RCA policy v2 · 4 failures in 30 days (limit 3)", "Create or link investigation", similar past investigation (same asset, same reason) | `dt-13-farid-rca-recommendation.png` |

Every page was read with all mutating requests allowed only where the persona acted; no page wrote to the server on render.

## 4. Role matrix

| Persona | Role | What the run used |
|---|---|---|
| admin | Super administrator | Connectivity, quarantine bind/replay, source mappings, counters, deactivating the PI connection |
| omid | Operator | Current stops, code, close (API) |
| leila | Production engineer | Merge, split, Stops & timeline, Reliability |
| reza | Manager (approver) | Verify coding, period page, statement |
| sara | Production accountant | Read-only event page |
| farid | Reliability engineer | RCA recommendation on the stop |

## 5. Findings and their outcome (fixed 28 Oct 2026, same day)

All six were fixed the same day; rulings in `plans/DECISIONS.md` (2026-10-28 — Downtime-over-MQTT e2e findings), plan `docs/superpowers/plans/2026-10-28-downtime-e2e-findings.md`. Outcome per finding is in the last column.

| ID | Severity | Finding | Where | Outcome |
|---|---|---|---|---|
| F1 | Important (pre-existing, 27 Oct) | The 2026-10-28 Day period was submitted, approved and certified on 27 Oct with no computable slice: the page reads "No calculated slices yet (recompute the period)", every figure "—" or "(unit unknown)", and the period warning is `ambiguous_default_product` ("several approved profiles and no accounting-baseline plan"). The submission gates let an incomputable period through, and certification locked it. Today's stops did not trigger a new calculation run on it (last run 27 Oct 11:50), so the day's cross-check and the Reliability coverage for 28 Oct stay empty. Decide: (a) a gate that refuses submission when no slice is computable, (b) reopen and recompute 28 Oct on the training plant | `dt-08-reza-period-28oct-certified-no-slices.png`; `production_periods.warnings`; `domain/reconciliation/submission-gates.ts` | Fixed: submit gate `NO_COMPUTABLE_SLICE` and certify `DAY_NOT_READY` regardless of basis; a recompute re-resolves slice-less periods. The 28 Oct day was reopened (revise), recomputed, resubmitted, approved by maryam and re-certified: 240 / 208 / 32 / 0, two declared lines, cross-check 462.45 t (the simulator stops of that day) |
| F2 | Low | An OT revision that changes `reason_code` after the stop exists is ignored silently (codes are taken only on create, by design) with no review item or source-conflict entry, so operators cannot see that OT disagrees with their coding | `pi-frame-ingest.service.ts` `applySourceRevision`; message 8 | Fixed: review item `source_reason_changed` (dismiss-only, one per event, auto-resolved when the source agrees again). Verified live: revision 3 of the 19:05 stop with ELEC-TRIP opened the item; the coding stayed MECH-GEARBOX |
| F3 | Low | In declared mode, Causes & Pareto shows only "Lost production by stop reason", which is empty by construction ("No availability losses in this scope"). A stop-count or stopped-time Pareto is needed for the reliability use of stops that `PLA_DOWNTIME_CURRENT_MODEL.md` §9 promises | `src/features/downtime-analysis/pages/causes-page.tsx` | Fixed: on a declared plant the page opens on "Downtime reasons" (stopped time / stop count); "Lost production" explains why it is empty |
| F4 | Low | Reliability "Last 24 h" at 19:50 on 28 Oct resolves to period dates 27 Oct → 27 Oct while saying "2 periods in this window"; the From/To fields and the count disagree | `src/features/downtime-analysis/model/production-day-range.ts` | Fixed: the To date is the production date of the window's last instant |
| F5 | Low | Subscription health shows "Last observation 2026-10-30 00:00 (0 s ago)": the field is the source timestamp of the last PLA period end (future), and the age is clamped to zero, which reads as live traffic | `src/features/integration-console/mqtt/subscription-status.tsx` | Fixed: a future source timestamp reads "ahead of the server clock" |
| F6 | Low | The job counter "Quarantined" stays 0 although the unknown-code message created a quarantine item (the stop was accepted; the item is advisory). The Quarantine tab shows it; the counter does not | `intake/adapters/mqtt/host/subscription-health.ts`, `message-persister.ts` | Fixed: new counter "Quarantined (open)" from the connection's open quarantine items; "Quarantined" renamed "Rejected at decode" |

No defect was found in the ingest path itself: identity, revisions, duplicates, open/close, placement by unit and equipment code, quarantine with bind-and-replay, and the declared-mode separation of stops from the loss all behaved as `docs/MQTT_FEEDS_PAYLOADS.md` describes.

## 6. Data created (for cleanup or reuse)

Stops on Extruder1, 28 Oct, all source MQTT: `b801f719…` (19:05–19:40, verified), `351cc61a…` (17:00–17:15), `037f10de…` (merged 18:00–18:10) with superseded `245a5dc0…` and `64698144…`, split parts `faf6cedc…` (16:30–16:38) and `5bd0a649…` (16:38–16:45) with superseded `56762143…`. Quarantine: `1c6b978f…` resolved by replay, `4a630fc6…` resolved automatically by the coding. Source mapping Pelletizer1 → Extruder1 (`exact_path`, MQTT). Review item `late_correction` on `245a5dc0…`. Connection `f2fee882…` inactive. The replay run `d532c3ad…` and the audit entries carry the reasons given.
