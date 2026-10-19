# QA audit: Master Data, Equipment Setup Guide, Finance, Integration

Agent MASTERDATA, 19 Oct 2026, live plant Marun / HDPE plant (HDPE-TRAIN), unit HDPE Extruder 1 (Extruder1).
Driven with headless Playwright scripts (own browser, UI login, 1440x900 plus a 768x1024 pass). Every mutating API call was blocked at the network layer as a safety net (only login, notifications and the read-only `POST /v2/rules/validate` passed). Nothing was saved.

Evidence: scripts, JSON captures and 317 screenshots are under
`C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\masterdata\` (screenshots in `shots\`, named `<user>-<width>-<route>.png` or by step). Shot paths below are relative to that folder.

## Summary

| | Count |
|---|---|
| Routes and sub-pages opened | 41 (23 section routes × 8 roles, plus 18 detail, new and edit pages) |
| Roles exercised | Bahram (master_data_admin), Darya (finance_maintainer), Kamran (finance_approver), Reza (manager_approver), Leila (production_engineer), Mina (integration_admin), Sara (production_accountant), Omid (operator), SuperAdmin |
| Forms opened, validated and cancelled | 19 |
| Console errors | 0 |
| Failed requests (≥ 400) | 0 (the only blocked calls were the audit's own mutation guard) |
| axe serious/critical | 1 confirmed (`listitem`, code tree); 1 likely artefact (`aria-hidden-focus` while a select popover was open) |
| Horizontal scroll at 768 px | none; drawer navigation works |
| "demo" text | none |
| Seeded setup vs guide | all checked values match (section "Seed check") |
| Findings | High 0 · Medium 9 · Low 27 |

### Top findings

1. **M1 Epoch dates shown as "since 1970-01-01 03:30"** for the plant-wide seeded versions (stop-engine settings, micro-stops, grade-change allowance, valuation policy v1, source priority "whole plant").
2. **M2 Finance shows "Another user" as the author** of a valuation policy version (Bahram sees it for Darya's version 2). This breaks the 2026-10-18 rule: show the person's name, never "a user".
3. **M3 Unit state coverage shows nothing** when the window starts before the mapping's first version. The default window (13–19 Oct) and a 17 Oct window both read only "The unit has no state mapping at the start of this window.", although mapping v1 has been in force since 17 Oct 05:30.
4. **M4 The master-data refusal page is bare.** It has no `<h1>`, the title is only "Traverse Forge" and the text is "You don't have permission to access master data management.". The Finance and Integration gates show the standard "No access" page instead.
5. **M5 The totalizer signal EXT1-Throughput is labelled "Counter (totalizer) · t per hour"**: a counter's unit is t, but the stored `rateTimebase: h` is shown as a rate.
6. **M6 Raw seconds in the readiness checks**: "61380 s running, 1800 s known stopped…" and "63000 s observed, 23400 s missing". Durations should read "17 h 3 min".
7. **M7 Raw keys and internal notes are visible**: `pi_output_ef`, `pi_counter`, `seq_boot`, `measurement_json`, `event_id`, `payload_hash`, `schema_version`, and the note "Seeded on first use from the D04 / D05 / D06 / D13 default (DECISIONS.md, 2026-10-07)".
8. **M8 a11y serious `listitem`** in the reason-code tree: the `li[data-code=DRIVE-TRAIN]` and `li[data-code=MECH-GEARBOX]` items are not inside a list.
9. **M9 Capitalisation of page names is inconsistent** between the menu, breadcrumb, h1 and the No-access title. Examples: "Master Data" / "Master data"; "Equipment Setup Guide" / "Equipment setup guide"; "Source Status Rules" / "Source status rules"; "Measurement Uncertainty" / "Measurement uncertainty"; "Enhanced Historian" stays Title Case even as the h1.

## Seed check (guide vs live setup)

| Item | Expected (guide) | Seen | Result | Evidence |
|---|---|---|---|---|
| Reason code hierarchy | MECH-GEARBOX under Mechanical › Drive train | Tree MECHANICAL › DRIVE-TRAIN › MECH-GEARBOX "Gearbox failure"; search "GEAR" → "Under: Mechanical › Drive train"; v1 default OEE Availability, schedule Unplanned | PASS | `shots/codes-reason-expanded.png`, `code-detail-tab-Versions.png` |
| Other reason codes | ELEC-TRIP, FEED-STARVED, GRADE-CHANGE, QUALITY-DOWNGRADE, SPEED-LOSS | all present, active | PASS | `codes-lib-Reason_codes.png` |
| Rates | HD5502 28/28 t/h, TRAIN-B 24/24 t/h | `GET /v2/profiles/:id/rates`: 28, 28 and 24, 24; both profiles approved from 17 Oct 06:00 | PASS | API read |
| Calendar | A/B/C 06/14/22, day start 06:00 | published v1: A 06–14, B 14–22, C 22–06, `operationalDayStart 06:00`, Asia/Tehran | PASS | API read |
| Micro-stop | 60 s, ELEC-TRIP trip exception | unit v2: threshold 1 min (form 60 s), trip reasons ELEC-TRIP; stop-engine debounce 5 s, restart 10 s | PASS | `reza-stop-policy-unit.png` |
| Impact rule | EXT1-Main full stop | "EXT1-Main — Main drive and gearbox · Full stop (the unit stops) · 2026-10-17 06:00 → open-ended · Approved" | PASS | `bahram-1440-_master-data_unit-impact-rules.png` |
| Valuation | CM 150 USD/t | valuation rates CM 150 USD/t (both profiles), downgrade 80 USD/t; policy v2 default "Contribution margin", from 17 Oct 06:00, commissioning backdate shown | PASS | `darya-policy-detail.png`; API |
| FX | 600,000 IRR/USD | "1 USD = 600000 IRR", approved, from 2026-10-01 00:00 | PASS (format: L4) | `darya-fx-detail.png` |
| Demand | sold out | HD5502 "Sold out (demand constrained)", 2026-10-01 → 2026-11-01, approved | PASS | `darya-finance-Demand.png` |
| State mapping | RUN/STOP/CHANGEOVER/STARVED/BLOCKED, stale after 3 intervals | v1: RUN → Running; STOP → Stopped (internal); CHANGEOVER → Planned stop; STARVED → Starved; BLOCKED → Blocked; stale 3 min | PASS | `bahram-unit-state.png` |
| MQTT connection | "Extruder1 MQTT measurements", mqtt://mqtt:1885, user proact-test, 1 filter; signals EXT1-State, EXT1-Throughput | all present; job running, connected; signals v1 current | PASS (unit label: M5) | `admin-conn-detail*.png` |
| Source priority | MQTT EXT1-Throughput primary, backdated to commissioning | Version 1 this unit, from 2026-10-17 05:30, "Commissioning backdate to 2026-10-17 05:30 … Drafted by Mina … approved by Sara" | PASS | `admin-source-authority.png` |
| Work order | WO-EXT1-20261017-01 / 0010, repair 08:10–08:40, linked | listed; "Open the stop" → `/events/67cc2c2a…?tab=repair` | PASS | `bahram-workorders.png` |
| Names | org "Marun", plant "HDPE plant" | header and hierarchy correct | PASS (leftover "training" wording: L18) | `hier-expanded.png` |

## Findings per page

Columns: page/route | role | checks run | result | finding | evidence | severity | suggested fix.

### Master Data overview and hierarchy

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/master-data` | Bahram, admin | 1–8 | PASS | Cards and counts correct (Units 1, Assets 1, Products 2, RCA templates 0, Cause library 8, Checklists 0). Restricted roles get "Your pages". | `bahram-1440-_master-data.png` | — | — |
| `/master-data` (menu, h1, breadcrumb) | all | 2 | WARN | M9: the menu and breadcrumb say "Master Data", the h1 and title "Master data" | same | Medium | `navigation-items.ts` names vs page titles; pick sentence case |
| `/master-data/*` refused (hierarchy, units, assets, products, failure dictionary, RCA libraries…) | Darya, Kamran, Leila, Mina, Omid, Reza (some) | 1, 2 | FAIL | M4: a bare centred sentence, no h1, `document.title` "Traverse Forge", no way back. Other gates use the "No access" page. | `leila-1440-_master-data_units.png` | Medium | `src/features/master-data/components/master-data-gate.tsx` → reuse the RouteCapabilityGate / No-access layout |
| `/master-data/codes-rules` | Omid | 1 | WARN | L1: the page opens (code readers keep access), but its tab bar shows "Overview · Standby equipment" without "Codes & rules", so the current page is not highlighted | `omid-1440-_master-data_codes-rules.png` | Low | master-data tab list should include every page the role can open |
| `/master-data/hierarchy` | Bahram | 1, 3 | PASS | Tree Marun › HDPE plant › Extruder1 — HDPE Extruder 1 › EXT1-Main. Add unit, Add asset (unit prefilled) and Open links resolve. | `hier-expanded.png` | — | — |
| `/master-data/hierarchy` | admin | 1 | PASS | "Edit organization Marun" / "Edit plant HDPE plant" → `/admin/…/edit?from=hierarchy`; note "Organizations and plants are managed in the Admin panel" | `admin-hierarchy.png` | — | — |
| `/master-data/hierarchy` | Bahram | 3 | WARN | L2: the unit reads "Extruder1 — HDPE Extruder 1" in the tree, "HDPE Extruder 1" in the asset and rule tables, and "HDPE Extruder 1 (Extruder1)" in the signal form. Three formats. | various | Low | one unit label helper |

### Units, assets, products

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/master-data/units`, `/assets`, `/products` lists | Bahram | 1–4, 7 | PASS | Filters persist in the URL (`?status=retired`). Sorting control present. No axe issues. | `bahram-1440-_master-data_*.png` | — | — |
| lists | Bahram | 4 | WARN | L3: clicking a row does nothing (only the name link opens the record); code search result rows do navigate on click | `records.mjs` log | Low | consistent row affordance |
| `/master-data/units/new`, `/assets/new`, `/products/new` | Bahram | 5 | PASS | Required markers; "Name is required." / "Code is required." inline on Create; Cancel works | `unit-new-validate.png`, `asset-new-validate.png`, `product-new-validate.png` | — | — |
| unit / asset / product detail | Bahram | 5 | PASS | Unsaved-changes guard: "You have unsaved changes. Leave this page and discard them?" (native confirm) plus a beforeunload prompt | `unit-detail-guard.png` | — | — |
| detail pages | Bahram | 5 | WARN | L4: "Save changes" is enabled on an unchanged form | `unit-detail.png` | Low | disable until dirty |
| `/master-data/units` (h1) | Bahram | 2 | WARN | L5: tab and card "Units"; h1 and breadcrumb "Production units" | `bahram-1440-_master-data_units.png` | Low | align |
| unit detail | Bahram | 3 | WARN | L18: description "Extruder production function of the training plant…"; products "HDPE training grade A/B", "…grade of the training production day". The plant was renamed "HDPE plant" (DECISIONS 2026-10-19). | `unit-detail.png`, `product-detail.png` | Low | seeder `train-catalog.ts` wording (data, owner choice) |

### Codes & rules

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/master-data/codes-rules` libraries | Bahram | 1–4 | PASS | The library select persists in the URL (`?library=impact-codes`), search too (`?q=GEAR`); "Show retired" works | `codes-lib-*.png` | — | — |
| code tree (Reason codes) | Bahram | 7 | FAIL | M8: axe serious `listitem` (2): `li[data-code="DRIVE-TRAIN"]`, `li[data-code="MECH-GEARBOX"]` (nested `li` without `ul`/`role=group`) | `codes-reason-expanded.png` | Medium | `src/features/codes-admin/codes/code-tree-node.tsx` wrap children in `<ul role="group">` |
| empty libraries | Bahram | 4 | WARN | L6: Impact/OEE codes read "No codes yet · Create the first code of this library."; Failure code groups / Loss categories read "No data · No codes yet in this library." | `codes-lib-Failure_code_groups.png` | Low | one empty state |
| New code dialog | Bahram | 5 | WARN | L7: Create is disabled while empty (no reason given). A code "bad code!" (outside the stated "letters, digits and . _ : -") and the duplicate "MECH-GEARBOX" both enable Create with no inline error; refusal left to the server (verified up to confirmation, not sent) | `code-new-dup.png` | Low | client pattern + duplicate check in `code-create-dialog.tsx` |
| code detail MECH-GEARBOX | Bahram | 1–3 | PASS | Tabs Details / Default mappings / Versions in the URL (`?tab=versions`), reload restores. Versions list each field change. Move-under list excludes self. | `code-detail-*.png` | — | — |
| code detail breadcrumb | Bahram | 1 | WARN | L8: the trail is "Master Data › Reason codes › MECH-GEARBOX…" and skips "Codes & rules" | same | Low | route-trail |
| Rules tab / `/rules/new` | Bahram | 1, 5 | PASS | Empty "No rules yet". The new rule builder validates live ("Checking with the server…"); Create draft is disabled until valid | `codes-rule-new*.png` | — | — |

### Failure dictionary, stop & plan policy, unit state, impact rules, standby, work orders, plant flow

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/master-data/failure-dictionary` | Bahram | 1–5 | PASS | 11 entries (EXTRUDER, GEARBOX, GEARBOX_FAILURE, TRIP_ALARM…); Add entry / Check / Import disabled until filled | `bahram-failure-dict.png` | — | — |
| failure dictionary | Bahram | 3 | WARN | L9: "Investigation pending (pending)" says pending twice | same | Low | drop the suffix when the name already says it |
| `/master-data/stop-policy` | Bahram, Reza, admin | 3 | FAIL | M1: "Version 1 (plant-wide) since 1970-01-01 03:30 (+03:30 Asia/Tehran)" for stop-engine, micro-stops and grade-change allowance | `reza-stop-policy-full.png` | Medium | render the epoch sentinel as "since the start (default)" |
| stop-policy notes | all | 8 | WARN | M7: the note "Seeded on first use from the D04 / D05 / D06 / D13 default (DECISIONS.md, 2026-10-07); change by a new version." is visible | same | Medium | server seed note → plain wording |
| stop-policy, Commissioning disclosure | Reza | 5 | PASS | The disclosure explains the past instant and the "no figures calculated" condition. Effective from (time disabled until a date), Reason for backdating. Threshold -5 → "Whole seconds from 0 to 86400". Nothing sent. | `reza-micro-commissioning.png`, `reza-stopengine-commissioning.png` | — | — |
| stop-policy | Reza | 5 | WARN | L10: an empty required threshold followed by Record shows no inline message (only the native required bubble) | `reza-micro-validate.png` | Low | inline "Enter the threshold" |
| stop-policy | Bahram | 1, 5 | PASS | Read-only: fieldset disabled, "Only manager approvers record new versions." | `bahram-stop-policy-full.png` | — | — |
| stop-policy, unit scope + preview | Bahram | 1 | PASS | `?unitId=` persists; unit v2 since 2026-10-17 05:30; preview enabled once the unit is chosen | `bahram-stop-policy-unit.png` | — | — |
| `/master-data/unit-state` coverage | Bahram | 3, 4 | FAIL | M3: a window starting before 17 Oct 05:30 (the default 13–19 Oct, or 17–17 Oct) shows only "The unit has no state mapping at the start of this window." and no timeline. 18–19 Oct shows it (running 5 h 33 min, stopped 30 min, unknown 41 h 57 min). | `unit-state-coverage-17oct.png`, `unit-state-coverage.png` | Medium | compute coverage from the mapping's start or clip the window, and say so; `coverage` endpoint or `unit-state-page` |
| unit-state | Bahram | 4 | WARN | L11: the coverage window is not in the URL (the unit is) | — | Low | add from/to params |
| `/master-data/unit-impact-rules` Add rule | Bahram | 5 | PASS | Inline: "Choose the unit", "Choose the asset", "Say why…", "Enter the start"; Cancel closes | `bahram-impact-validate.png` | — | — |
| unit-impact-rules at 768 | Bahram | 7 | WARN | L12: the table scrolls inside its card; State/Actions are off-screen and the Effective date overflows | `shots/bahram-768-_master-data_unit-impact-rules.png` | Low | stack the effective range |
| `/master-data/standby-equipment` | Bahram | 4 | WARN | L13: the empty state says "Register spare pumps…" but the role has no Register action and no reason is given | `bahram-1440-_master-data_standby-equipment.png` | Low | "Ask a reliability engineer…" when not permitted |
| `/master-data/work-orders` | Bahram, Reza, Mina | 1, 3 | PASS | WO row, times 08:10–08:40 plant time, "Open the stop" deep link | `bahram-workorders.png` | — | — |
| `/master-data/plant-flow` Add route / Record level | Bahram | 4, 5 | PASS | Empty states explain the effect; Record level validates "Choose the buffer / Enter when… / Enter the level" | `bahram-route-add.png` | — | — |

### RCA causes, templates, checklists

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/master-data/rca/causes` | Bahram | 1–5 | PASS | 8 causes with categories; Add cause validates "Code is required." / "Name is required."; icon buttons have aria-labels | `bahram-cause-add.png` | — | — |
| `/master-data/rca/templates`, `/new` | Bahram | 4, 5 | PASS | Empty "No templates"; new form validates Name and Category | `bahram-template-new.png` | — | — |
| `/master-data/rca/checklists`, `/new` | Bahram | 4, 5 | PASS | Empty state; Name and Code required; "Add item" disabled until text | `bahram-checklist-new.png` | — | — |
| `/master-data/rca/*` | Reza, Leila, Darya… | 1 | FAIL | RCA libraries are refused with the bare page (M4) | crawl JSON | (M4) | — |

### Equipment Setup Guide

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/equipment-setup` | Bahram, admin | 1–4 | PASS | 6 phases, 19 steps. Choosing the unit starts the guide bar (Step 2 of 19). Readiness: 15 passed with HD5502 for 17–18 Oct (calendar, impact rule, stop policy, MQTT priority, valuation, state mapping, signals, connection, profile, planning and sustained rate, margin, FX). | `bahram-setup-unit.png`, `bahram-setup-HD5502-17oct.png` | — | — |
| readiness text | Bahram | 3 | FAIL | M6: "Selected window: 61380 s running, 1800 s known stopped, 23220 s unknown"; "EXT1-Throughput: 63000 s observed, 23400 s missing" | same | Medium | format with the duration helper (server detail or `readiness-results.tsx`) |
| readiness window | Bahram | 4 | WARN | L14: "To" is exclusive here (17 → 17 gives "The end must be after the start"), while the coverage and historian pickers say "To (inclusive)". The default window is the last 24 h (no telemetry since 18 Oct 06:00 → "Needs attention"). | `bahram-setup-HD5502-17oct.png` | Low | label "To (exclusive)" or make it inclusive |
| step buttons | Bahram | 1 | WARN | L15: "Open Stop-engine and plan policy", "Open Unit-state mapping" and others are disabled for Bahram, who can open those pages read-only. The text "SuperAdmin can perform every role personally." is shown to non-admins. | `bahram-setup-unit.png` | Low | gate by `canReachMasterData` page access, not write rights |
| `/equipment-setup` menu | Omid | 1 | WARN | L16: the operator sees "Equipment Setup Guide" in the menu (via the standby capability) | crawl-omid | Low | confirm intent |

### Finance

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/finance` tabs | Darya, Kamran, Bahram, Reza, Leila, Mina | 1–4 | PASS | Tabs in the URL (`?tab=fx`, `?tab=demand`); recalculation notice. Darya: "New policy version", "Add exchange rate draft", "Add demand status draft"; Kamran: no create actions, Retire on demand | `darya-finance-*.png` | — | — |
| `/finance` | Omid | 1 | PASS | Refused with the "No access" page, no menu item | `omid-1440-_finance.png` | — | — |
| policy list, Author | Bahram (and every non-author) | 3 | FAIL | M2: Author "Another user" (Darya sees "You", v1 "System") | `bahram-1440-_finance.png` | Medium | `src/features/finance/model/policy-status.ts` + policy table → `<PersonName id>` |
| policy list / detail | all | 3 | FAIL | M1: v1 "From 1970-01-01 03:30" | `darya-finance-Valuation_policy.png` | (M1) | — |
| policy detail v2 | Darya | 1, 3 | PASS | Contribution margin, IRR + USD, valid 2026-10-17 06:00 – ongoing, commissioning backdate reason with "approved figures in range get change proposals"; "New version from this" | `darya-policy-detail.png` | — | — |
| policy detail | Darya | 3 | WARN | L17: "Approved 2026-10-18 19:20" does not name the approver (Kamran); the breadcrumb is "Finance › Valuation policy version 2" while FX has "Finance › Exchange rates › …" | same | Low | add the approver name and a "Valuation policy" crumb |
| `/finance/policies/new` | Darya | 5 | PASS | A past Start gives "A past start is a commissioning backdate: set it under Commissioning with a reason." Commissioning: Effective from, then the **restate checkbox** appears ("Restate approved figures in this range…"), toggles; Save without reason → "Give the reason for backdating". Nothing sent; Cancel goes back. | `darya-policy-restate-checkbox.png`, `darya-policy-restate-validate.png` | — | — |
| `/finance/policies/new` | Darya | 3 | WARN | L19: "New policy version" defaults to Economic impact, not the in-force Contribution margin (only "New version from this" copies) | `darya-policy-new.png` | Low | prefill from the version in force |
| `/finance/policies/new` | Kamran | 1 | WARN | L20: a finance approver without create rights can open the create form by URL (the list hides the button); the server would refuse | `kamran-policy-new.png` | Low | route gate `canWriteValuationPolicy` |
| FX list / detail | Darya | 3 | WARN | L21: "1 USD = 600000 IRR" has no thousands separator (the Source text says 600,000) | `darya-fx-detail.png` | Low | number formatter in `fx-rate-table.tsx` / detail |
| FX new draft, Demand new draft | Darya | 5 | PASS | Inline "Enter the rate.", "Enter the date and time it starts.", "Choose a product.", "Say what shows it…"; Cancel closes | `darya-fx-new.png`, `darya-demand-new.png` | — | — |
| valuation-rate links | Darya | 1 | WARN | L22: Finance has no link to the valuation (margin) rates, which live under Plans, Profiles & Calendars. The readiness step "Valuation and exchange rates" points to Finance only. | — | Low | add a "Valuation rates (per profile)" link |

### Integration (SuperAdmin only)

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| Integration menu and routes | Bahram, Darya, Kamran, Reza, Leila, Mina, Omid | 1 | PASS | No Integration menu. `/connectivity`, `/connectivity/source-status`, `/connectivity/source-authority`, `/enhanced-historian` → "No access · Your roles in this plant do not include …". Mina (integration_admin) is refused as decided on 18 Oct. | `mina-1440-_connectivity.png` | — | — |
| source-authority / source-status | Sara | 1 | PASS | Reachable without the menu (approver path), with New version / New source | `sara_connectivity_source_authority.png` | — | — |
| source-authority / source-status | Sara | 1 | WARN | L23: the breadcrumb "Connectivity" links to a page Sara cannot open | same | Low | no link when the target is not reachable |
| `/connectivity` tabs | admin | 1–4 | PASS | Connections (1, Active, credential stored), Quarantine (empty with filters), Source mappings (empty); tabs in the URL | `admin-conn-tab-*.png` | — | — |
| connection detail (Extruder1 MQTT) | admin | 1, 3 | PASS | Subscription health: Connected, job running, last observation 2026-10-18 06:00, heartbeat current; Signals, Setup readiness (sample validation, no writes), Payload profile, Quarantine tabs | `admin-conn-detail*.png` | — | — |
| connection detail | admin | 3 | WARN | L24: "Last message never / Last persist never / Received 0" next to "Last observation 2026-10-18 06:00" reads as contradictory (counters since the worker restarted); the client id shows a raw uuid | `admin-conn-detail.png` | Low | label counters "since <start>" |
| Signals tab | admin | 3 | FAIL | M5: EXT1-Throughput "Counter (totalizer) · t per hour" (stored `canonicalUom t`, `rateTimebase h`) | `admin-conn-detail-Signals.png` | Medium | hide the time base for counters, or fix the seeded signal |
| Payload profile, Quarantine filter | admin | 8 | WARN | M7: raw keys `seq_boot`, `measurement_json`, `event_id`, `payload_hash`, "Unsupported schema_version" | `admin-conn-detail-Payload_profile.png` | (M7) | label maps |
| connection edit, Define signal | admin | 5 | PASS | Wizard Cancel returns to the detail; signal form inline "Enter a name.", "Choose the production unit.", "Enter the source stream id…" | `admin-conn-edit.png`, `admin-signal-new.png` | — | — |
| `/connectivity/source-authority` | admin | 3 | PASS / WARN | The backdated version card is complete: "Commissioning backdate to 2026-10-17 05:30 …", drafted by Mina, approved by Sara. The whole-plant v1 shows "From 1970-01-01" (M1), "Primary pi_output_ef, fallback pi_counter" (M7), "Drafted by System", and the D04 note (M7). | `admin-source-authority.png` | (M1, M7) | — |
| `/connectivity/source-status` | admin | 4 | PASS | Empty: "No source has a mapping yet; without an approved version a source releases nothing." | `admin-source-status.png` | — | — |
| `/enhanced-historian` | admin | 1, 3, 4 | PASS | Signal and period in the URL; EXT1-Throughput trend and sample table in plant time (986 t at 05:30) | `admin-historian-trend.png` | — | — |
| historian samples | admin | 3 | WARN | L25: values like "986.467" have no unit column and 3 decimals | same | Low | unit + fixed precision |
| Integration h1 casing | admin vs others | 2 | WARN | M9: h1 "Source status rules"/"Source priority" (admin) vs menu, title and No-access "Source Status Rules"/"Source Priority"; "Enhanced Historian" Title Case | crawl logs | (M9) | — |

### Measurement uncertainty

| Page | Role | Checks | Result | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|---|---|---|
| `/measurement-uncertainty` | Bahram, Leila, Darya, admin | 1, 4, 5 | PASS | Unit HDPE Extruder 1; empty state "No uncertainty budget for this unit yet; its reconciliation tolerance stays at zero…"; New budget form (components, correlations, Compute, evidence, Propose budget) opened and cancelled | `leila-mu-new.png` | — | — |
| `/measurement-uncertainty` | Omid | 1, 2 | PASS / WARN | Refused correctly; the No-access title is "Measurement Uncertainty" while the page h1 is "Measurement uncertainty" (M9) | `omid-1440-_measurement-uncertainty.png` | (M9) | — |

### Shell items seen in this area

| Item | Finding | Sev |
|---|---|---|
| Header user badge | L26: Bahram is labelled "Analyst" (legacy role), not his master-data role | Low |
| 768 px | No horizontal scroll on 31 pages; "Open navigation" drawer lists the menu; the header truncates "Ma…" / "HDPE p…" | Low (L27) |
| axe `aria-hidden-focus` | Seen on stop-policy and setup only while the audit had a select popover open; not reproduced on a closed page | WARN (recheck manually) |

## Use cases verified

- Master data admin browses every master-data page, opens unit, asset, product and code records, sees validation on create forms, and is warned before leaving an edited record (all cancelled).
- Reason code hierarchy and code versions; library switch, search and deep links persist; the new-code and new-rule forms stop before confirmation.
- Stop & plan policy: plant and unit scope, in-force versions, the commissioning backdate disclosure, threshold validation, read-only for non-managers.
- Unit state mapping and coverage timeline, unit impact rule form, plant flow route and buffer forms, work-order deep link to the stop, standby empty state.
- RCA cause library, template and checklist forms.
- Equipment Setup Guide: unit selection, guide bar, readiness checks with product and window, step links.
- Finance: valuation policy list and detail, a new version with a past start (refused) and a commissioning backdate with the restate checkbox (verified up to confirmation), FX and demand draft forms, FX detail; finance approver vs maintainer controls.
- Integration as SuperAdmin: connections, Extruder1 MQTT detail (subscription health, signals, setup readiness, payload profile, quarantine), connection edit and signal forms (cancelled), source status rules, source priority with the backdated version card, historian trend. Refusal for 7 non-SuperAdmin roles; the Sara approver path.
- Measurement uncertainty: read, and the New budget form opened and cancelled.
- Seeded setup matches the guide (section "Seed check").

## Data created

None. Every POST, PUT, PATCH and DELETE except login, notifications and the read-only rule validation was aborted in the browser. No form was submitted to the server, no notification state was changed, and Docker was not touched.

## Re-test 19 Oct

After commit dd04dd24 and deploy. Same scripts, own headless browser, UI login, every mutating call blocked in the browser (only login, notifications and the read-only rule validation passed). Personas now hold only their guide role; Farid (reliability_engineer) added to the sweep. Evidence for this round is in `shots-r2\` and `r2-*.json` / `r2-*.out` under the same scratchpad folder (`...\scratchpad\qa\masterdata\`).

**FIXED 23 / PARTIAL 2 / OPEN 11 / NEW 9**

Sweep: 23 section routes × 10 users (9 at 1440 px, Bahram and SuperAdmin at 768 px), plus detail, new and edit pages and 19 forms (opened, validated, cancelled). Console errors 0, failed requests 0, axe serious/critical 0 (the earlier `listitem` and `aria-hidden-focus` are gone; a clean stop-policy load has no violations), no "demo", no raw snake_case or uuids in page text. Menu label = h1 = `document.title` on every page in the area. The 17 Oct unit-state coverage matches the E2E facts (from 05:30: running 17 h 30 min, stopped 1 h; 18–19 Oct: stopped 30 min).

### Access matrix (1440 px, "NO" = standard No access page)

| Route | Bahram | Admin | Darya | Kamran | Reza | Leila | Mina | Sara | Omid | Farid |
|---|---|---|---|---|---|---|---|---|---|---|
| `/master-data` overview, codes-rules, `/equipment-setup` | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| hierarchy, units, assets, products, failure dictionary, RCA libraries | ok | ok | NO | NO | NO | NO | NO | NO | NO | NO |
| stop-policy, impact rules, plant flow | ok | ok | NO | NO | ok | NO | NO | NO | NO | impact rules ok |
| unit-state, work-orders | ok | ok | NO | NO | ok | NO | ok | NO | NO | work-orders ok |
| standby equipment | ok | ok | NO | NO | ok | NO | ok | NO | ok | ok |
| `/finance`, `/measurement-uncertainty` | ok | ok | ok | ok | ok | ok | ok | ok | NO | finance ok |
| `/connectivity`, `/enhanced-historian` | NO | ok | NO | NO | NO | NO | NO | NO | NO | — |
| source status, source priority | NO | ok | NO | NO | NO | NO | NO | ok | NO | — |

### First-round findings

| ID | Status | Evidence (re-test) |
|---|---|---|
| M1 epoch "since 1970-01-01" | FIXED | Stop-engine, micro-stops, grade-change, valuation policy v1, source priority (whole plant) read "Built-in default (from the start)". `shots-r2/reza-stop-policy-full.png`, `bahram-1440-_finance.png`, `r2-integ.out` |
| M2 "Another user" as author | FIXED | Bahram sees Author "Darya"; Darya sees "Darya (you)"; v1 "System". `r2-finance-bahram.out` |
| M3 unit-state coverage empty before mapping start | FIXED | "Coverage starts at 2026-10-17 05:30, when the first state mapping came into force." with the timeline. `shots-r2/unit-state-coverage-17oct.png` |
| M4 bare master-data refusal | FIXED | Standard page: breadcrumb, h1 = page name, "No access · Your roles in this plant do not include Plant hierarchy." `shots-r2/omid-1440-_master-data_hierarchy.png` |
| M5 totalizer labelled "t per hour" | FIXED | Signals tab: "EXT1-Throughput · Counter (totalizer) · t". `shots-r2/admin-conn-detail-Signals.png` |
| M6 raw seconds in readiness | FIXED | "Selected window: 5 h 33 min running, 30 min known stopped, 17 h 57 min unknown"; "EXT1-Throughput: 6 h observed, 18 h missing". `r2-setup-18.out` |
| M7 raw keys and internal notes | FIXED | "Primary PI output events, fallback PI counter"; "Gateway boot and sequence number"; quarantine "Unsupported message version"; note "Built-in default; change it by recording a new version." No snake_case in any page text. |
| M8 axe `listitem` in code tree | FIXED | 0 violations on the expanded reason tree. `shots-r2/codes-reason-expanded.png` |
| M9 page-name capitalisation | FIXED | Menu, h1, title and No-access agree: "Master data", "Equipment setup guide", "Source status rules", "Source priority", "Enhanced historian", "Measurement uncertainty". Leftovers in body text: N5. |
| L1 Omid tab bar lacks Codes & rules | PARTIAL | Farid's tab bar now lists every page he can open; Omid still sees only "Overview · Standby equipment" on `/master-data/codes-rules`. `shots-r2/omid-1440-_master-data_codes-rules.png` |
| L2 three unit label formats | OPEN | Tree "Extruder1 — HDPE Extruder 1", tables "HDPE Extruder 1", signal form "HDPE Extruder 1 (Extruder1)" |
| L3 list rows not clickable | OPEN | Clicking the Extruder1 row stays on `/master-data/units` (`r2-records.out`) |
| L4 Save enabled on unchanged form | FIXED | "Save changes" disabled with "No changes to save." on unit, asset, product (`r2-details.out`) |
| L5 "Units" vs "Production units" | OPEN | Tab and card "Units"; h1, title, breadcrumb "Production units" |
| L6 two empty-state wordings | FIXED | All empty libraries: "No codes yet · Create the first code of this library." |
| L7 code dialog: no inline errors | FIXED | "Enter a code and a name."; "Use letters, digits and . _ : - only…"; "MECH-GEARBOX already exists in this library."; Create disabled with "Fix the code first." `shots-r2/code-new-dup.png` |
| L8 code detail crumb skips Codes & rules | OPEN | "Master data › Reason codes › MECH-GEARBOX — Gearbox failure" |
| L9 "Investigation pending (pending)" | FIXED | "Investigation pending" |
| L10 no inline message on empty threshold | OPEN | Empty threshold + Record: still only the native bubble; "-5" does show "Whole seconds from 0 to 86400" (`r2-commission.out`) |
| L11 coverage window not in URL | OPEN | URL keeps `unitId` only |
| L12 impact rules table at 768 px | OPEN | Effective date clipped, State/Actions off-screen. `shots-r2/bahram-768-_master-data_unit-impact-rules.png` |
| L13 standby empty state invites a forbidden action | OPEN | Bahram: no Register action, text still "Register spare pumps or standby compressors…" |
| L14 readiness "To" exclusive | FIXED | Picker now "To (inclusive)" like the others; but see N2 |
| L15 step buttons disabled for readable pages; SuperAdmin note | FIXED | Bahram can open Stop-engine and plan policy and Unit-state mapping; only the SuperAdmin-only integration steps are disabled; the SuperAdmin sentence is gone |
| L16 operator sees Equipment setup guide | OPEN | Omid still has it in the menu, and now every one of the 19 "Open step" buttons is disabled: a dead-end page. `shots-r2/omid-setup.png` |
| L17 approver not named; breadcrumb | FIXED | "Approved 2026-10-18 19:20 by Kamran"; crumb "Finance › Valuation policy › Version 2" |
| L18 "training" in unit and product data | FIXED | Unit "Extruder production function; owns the production account…"; products "HDPE grade A/B", "Planned and measured grade of the production day". Other "training" text remains: N3 |
| L19 new policy defaults to Economic impact | FIXED | Defaults to Contribution margin |
| L20 finance approver opens create form by URL | FIXED | Kamran: `/finance/policies/new` → No access |
| L21 FX rate without separator | FIXED | "1 USD = 600,000 IRR" |
| L22 no link to valuation rates from Finance | OPEN | No link on any Finance tab |
| L23 Sara's crumb links to a refused page | FIXED | No dead "Connectivity" link on Sara's source-priority page |
| L24 contradictory counters; raw client id | PARTIAL | Counters now "since the worker started" with an explanation; the subtitle still shows "client id proact-466d5564-054c-4b56-8550-0c1fcd7f337d" |
| L25 historian values without unit | FIXED | Column "Value (t)", two decimals (986.47). `shots-r2/admin-historian-trend.png` |
| L26 Bahram labelled "Analyst" | FIXED | Header "Master data administrator" |
| L27 header truncation at 768 px | OPEN | "Mar…" / "HDPE pl…" (Bahram), "M…" / "HDP…" (SuperAdmin) |

### New findings

| ID | Page / route | Role | Finding | Evidence | Sev | Suggested fix |
|---|---|---|---|---|---|---|
| N1 | `/master-data/codes-rules/rules/new` | Bahram | The rule builder prints raw schema-validator messages with internal keys under an empty condition: "Field: must be equal to one of the allowed values: physicalType, scheduleClass, oeeComponent, impactMode, sourceKind, eventType, source, durationSeconds, reasonCodeId, impactCodeId, unitId, assetId", "Operator: must be equal to one of … eq, neq, in, gt …", "Value: must NOT have fewer than 1 characters". In the first round the same form showed no messages. | `shots-r2/rule-new-filled.png` | Medium | Map validator errors to field messages ("Choose a field", "Choose an operator", "Enter a value"); never list allowed values |
| N2 | `/equipment-setup` readiness window | Bahram | "Whole plant days" are calendar days from 00:00, but the plant day starts at 06:00. A window of 17 Oct (the certified commissioning day) is sent as 17 Oct 00:00 – 18 Oct 00:00, so it starts before commissioning (05:30): 6 passed, "Active leaf reason codes: Missing", "No published calendar on 2026-10-16" (a date the user did not pick). 18 Oct alone passes 17. The commissioning day can never pass readiness. | `r2-setup-17.out`, `r2-setup-18.out`; API `from=2026-10-16T20:30Z` | Medium | Build the window from the calendar's operational day start (`src/features/equipment-setup/readiness-model.ts` uses `rangeFromDates` at midnight), or label it "calendar days" and explain the 00:00–06:00 part |
| N3 | `/finance?tab=fx`, `?tab=demand`, policy v2 notes | Darya, Kamran | "training" wording is still on screen: FX source "Illustrative training rate of the Marun student guide (lesson 21)…", demand evidence "Training assumption (guide lesson 21)…", policy notes "Guide lesson 21…" | `r2-finance-darya.out`, `shots-r2/darya-fx-detail.png` | Low | Seed text (data, owner choice), same as the product rename |
| N4 | `/finance/policies/new`, `/connectivity/source-authority` | Darya, Sara | "SuperAdmin may approve their own version." is shown to users who are not SuperAdmin (the setup-guide sentence was removed; these two remain) | `r2-finance-darya.out`, `r2-misc.out` | Low | Show only to SuperAdmin |
| N5 | setup guide, codes footer | Bahram | Page names in body text are not from the single source: "Open Pending Approvals" (menu "Pending approvals"), "Open Codes and rules" (page "Codes & rules"), "Open Approved output source priority" (page "Source priority"), "Unit-state mapping and heartbeat" (page "Unit state"); codes footer "…RCA cause library in Master Data." | `r2-setup-bahram.out`, `r2-codes.out` | Low | Use the route title source for link texts |
| N6 | `/enhanced-historian` | admin | "Step trend of the stored samples of 1 signals" | `shots-r2/admin-historian-trend.png` | Low | Plural helper |
| N7 | `/master-data/unit-state` coverage | Bahram | With full coverage the range reads "between 94.6 % and 94.6 %", and unknown time reads "0 s" | `shots-r2/unit-state-coverage-17oct.png` | Low | One value when the bounds match; "none" for zero |
| N8 | `/master-data/work-orders` at 768 px | admin | Horizontal page scroll: the import label "CSV (workOrderId,operationId,kind,startedAt,…)" cannot wrap; it also exposes internal field names | `shots-r2/admin-768-_master-data_work-orders.png` | Low | Wrap, or move the column list into help text |
| N9 | `/master-data/failure-dictionary` | Farid | The reliability engineer is refused the failure dictionary (the ISO 14224 codes used when coding failures) while he can open impact rules, standby and work orders. Confirm intent. | `shots-r2/farid_master-data_failure-dictionary.png` | Low | Read access for reliability_engineer, if intended |

Observations outside this area (for the other agents): the menu item "RCA Analysis" is not in sentence case; Kamran (finance_approver only) and Sara (production_accountant only) have "User management" in the menu; Reza (manager_approver) has "Admin panel" and "Audit log".

### Use cases re-verified

All first-round use cases ran again with the results above. Added: Farid's view of master data, standby and work orders; single-day readiness windows for 17 Oct and 18 Oct; historian trend for 17 Oct (1,110 samples, paged); payload profile sections expanded.

### Data created (re-test)

None. Every mutating request except login, notifications and the read-only rule validation was aborted in the browser. No form was submitted, no notification state was changed, and Docker was not touched.

## Round 3 re-test (19 Oct 2026)

Run: 19 Oct 2026, about 17:20–17:40 Tehran, against the containers rebuilt at 17:18. Headless Playwright, UI login, every mutating request aborted in the browser.
Coverage:
- Bahram: all 20 master-data, setup, finance and uncertainty routes at 1440 px with axe, plus unit, asset and product detail pages.
- Admin: the same routes plus the integration and shell pages at 768 px.
- Darya, Kamran, Sara and Admin: finance and source-priority pages.
- Farid: failure dictionary.
- Omid: Codes & rules and impact codes.

Evidence: `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\r3-shellmd\` (`shots\*.png`, `words-*.json`, `es.out`).

**Summary: every round-3 master-data fix checked is live. 0 High, 0 Medium, 4 Low open.**

Across the area: 0 console errors, 0 failed requests, 0 serious or critical axe violations, no horizontal page scroll at 768 px, no uuids or snake_case keys in page text. No "demo", "student guide", "guide lesson" or course "training" text on any page. The one "training" hit is the cause "Inspection skill or training gap" in the cause library, which is a real cause, not course wording.

### Verified fixed

- **Rule builder (round 2 N1).** On `/master-data/codes-rules/rules/new` an untouched condition row shows no messages. After Create draft the rows read "Choose a field.", "Choose an operator.", "Choose the field to set." and "Enter a value.", with no allowed-value lists or keys.
- **Readiness window (round 2 N2).** The picker reads "Readiness window (whole production days, maximum 31)" with "Each production day runs from 06:00 to 06:00 the next day, named by the date it starts on." Choosing 17 Oct → 17 Oct sends `from=2026-10-17T02:30Z&to=2026-10-18T02:30Z`; the commissioning day now passes (Passed 19 · Missing 0, "22 h 30 min running, 1 h 30 min known stopped").
- **Unit-state coverage window (round 2 N7, L11).**
  - 17 Oct sends `02:30Z → 02:30Z` and reads "Availability 93.8 %" (one value, not "between 93.8 % and 93.8 %") and "22 h 30 min · 1 h 30 min · none".
  - The window is now kept in the URL and survives a reload (18–19 Oct reloads as 18 Oct → 19 Oct, `from=2026-10-18T02:30Z`).
- **Finance wording (round 2 N3).**
  - FX source: "Planning rate agreed by finance for October 2026: 600,000 IRR per USD, not a market exchange rate".
  - Demand evidence: "Unmet orders for HD5502 in October 2026: the grade is sold out, so unproduced tonnes are lost sales".
  - Policy v2 notes: "Contribution margin view by default; economic view charges lost contribution only while the product is sold out".
  - Same text on the FX and policy detail pages.
- **Self-approval sentence (round 2 N4).** "As SuperAdmin you may approve your own version." shows for Admin on `/finance/policies/new` and `/connectivity/source-authority`, and not for Darya, Sara or Kamran.
- **Page names in body text (round 2 N5).** The setup guide links read "Open Pending approvals", "Open Codes & rules", "Open Source priority" and "Open Unit state". The codes footer reads "Master data › Cause library".
- **Failure dictionary for Farid (round 2 N9).** `/master-data/failure-dictionary` opens read-only for Farid: 11 entries, the tab is in his tab bar, and there are no write controls. Omid and Leila are still refused.
- **Work orders at 768 px (round 2 N8).** No page scroll; the table scrolls inside its own frame.
- **Round-2 leftovers now fixed:**
  - L1: Omid's tab bar lists Overview, Codes & rules, Standby equipment.
  - L3: a units row opens the unit.
  - L5: tab and card read "Production units".
  - L8: crumb "Master data › Codes & rules › MECHANICAL — Mechanical".
  - L12: the impact-rules table scrolls inside its frame at 768 px.
  - L13: standby empty state "…Reliability engineers register them…" with no action offered to Bahram.
  - L16: setup guide is gone from Omid's menu.
  - L24: no MQTT client id on the connection page.
  - L27: header at 768 px shows "Marun › HDPE plant".

### Still open

| ID | Page / route | Persona | What's wrong | Expected | Severity |
|---|---|---|---|---|---|
| R3-M1 | `/master-data/codes-rules/rules/new` | Bahram | Before anything is touched, the footer already says "Not valid yet — see the marked rows." while no row is marked. Create draft stays enabled on an invalid form and still sends `POST /v2/rules` (aborted in this test, so the server's reply was not seen). | Show the footer hint only after Save, or keep Create draft disabled until the form is valid; don't send an invalid rule to the server. | Low |
| R3-M2 | `/equipment-setup` product picker, Products | Bahram | The second grade's code is "TRAIN-B" ("TRAIN-B — HDPE grade B"), course wording in a code shown on the readiness picker and on profiles. | A plant code such as the real grade number (data; a code change needs a new product or a rename by the owner). | Low |
| R3-M3 | `/master-data/codes-rules?library=impact-codes` | Omid | The impact-code library is empty in this plant, so "cost per hour" being hidden from the operator could not be checked in the UI. The operator also sees "Create the first code of this library." although he cannot create codes. | Re-check once an impact code exists; for read-only users, use an empty state that does not invite creation. | Low |
| R3-M4 | `/master-data/unit-state` URL | Bahram | The window in the URL is stored at midnight (`from=2026-10-17T20:30Z` for 18 Oct) while the request and the page use 06:00. It reloads correctly, but a shared link names a different instant than the data. | Write the production-day start (`…T02:30Z`) or plain dates to the URL. | Low |

Not re-checked this round: L2 (three unit label formats), L10 (inline message on an empty threshold), L22 (Finance names "Plans, profiles & calendars › Profiles & rates" for valuation rates; not checked whether it is a link) and N6 (historian "1 signals").

### Data created (round 3)

None. No form was submitted. The rule-builder Save check sent `POST /v2/rules`, and that request was aborted in the browser.
