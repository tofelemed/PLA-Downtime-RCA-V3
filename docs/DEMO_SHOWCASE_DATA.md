# Demo showcase data

A month of realistic, deterministic production history for the demo plants, so every screen has
something meaningful to show. It is written by an isolated seeder
(`server/pro-act-backend/scripts/demo-showcase/`), never by product code, and only through the public
API (v2; v1 only for units, assets, products, tasks, shift output reports with rejects and the Partner
Plant events, which have no v2 write) as the persona users of `docs/DEMO_PERSONAS.md`. Authors and
approvers are always different people.

```
cd server/pro-act-backend
npm run db:seed-demo-showcase -- --demo-plant                       # Demo Plant, 30 days
npm run db:seed-demo-showcase -- --tenant 1c19bda6-1c5e-42ac-af59-e1bda46b804f --days 14   # Demo Plant 2
npm run db:seed-demo-showcase -- --tenant d731498e-efd5-46f2-8bf0-64a4cf1fde3b             # Partner Plant
npm run db:seed-demo-showcase -- --demo-plant --dry-run             # what would be written; nothing is
npm run db:seed-demo-showcase -- --demo-plant --only verify         # read-back proof only
```

Flags: `--days <n>` (default 30, 14 for the small plants), `--seed <text>` (default
`proact-demo-showcase-v1`; all numbers derive from it — no `Math.random`), `--dry-run`,
`--only <step,…>` / `--skip <step,…>`. Steps in order: `master-data`, `codes`, `rules`, `calendars`,
`profiles`, `valuation-policy`, `plans`, `cleanup`, `events`, `open-stops`, `recalculate`, `accounting`,
`rca`, `tasks`, `integration`, `partner-events`, `verify` (master data, codes and profiles always run:
they only read when everything exists). Prerequisites: the personas (`npm run db:seed-demo-personas`)
and, for the integration step, the demo MQTT connections (`npm run db:seed-demo-mqtt -- --demo-plant`)
and the Compose broker. API: `PROACT_API_URL` or `http://localhost:$PORT`. A full Demo Plant run makes
about 5 000 requests in ~10 minutes, spread over ~20 personas (the API limit is 300 requests / min / user).

**Re-running** is safe: every row is found again (by code, name, title or the stable event id
`SC-<unit>-<yyyymmddHH>-…`) and reported as `kept`. Run it again on a later day to **extend** the
window: the new days get events, the month plans get a new version with the longer horizon (or a new
month plan), the new periods are materialized, recalculated and reviewed, and yesterday's "open" stops
are closed and replaced by today's. All passwords: `Persona-2026!demo`.

## Who to log in as

| To see | Log in as (`@demo.acme.com`) |
|---|---|
| everything, approvals, Finance, Codes & Rules | `jonas.weber` (Manager) or `anna.keller` (TenantAdmin) |
| period accounting (drafts, in review, rejected), plans | `noah.schmidt` (Engineer) |
| operator queue (uncoded stops), running stops, tasks | `liam.murphy` (Operator) |
| RCA cases, actions, verification | `viktor.petrov` (reliability engineer) |
| Integration console, MQTT counters, quarantine | `elena.marchetti` (integration admin) |
| Master Data, code libraries, calendars, rates | `charlotte.evans` (master-data admin) |
| read-only view of Demo Plant | `grace.whitfield` (viewer; switch to Demo Plant) |
| Demo Plant 2 | `chloe.dubois` (TenantAdmin) or `isabel.moreno` (OrgAdmin, can switch plants) |
| Partner Plant | `lucas.ferreira` |

## Demo Plant — HDPE polymer complex (UTC site, operational day from 06:00)

| What | Where (route) |
|---|---|
| Units **Extruder Line 1** (`DEMO-EXTRUDER1`, the MQTT simulator's Extruder1, renamed), **Extruder Line 2** (`EXT-LINE-2`), **Underwater Pelletizer** (`PELLETIZER-1`), **Bagging and Palletizing** (`BAGGING-1`); 22 assets (main drive motors, gearboxes, screws, die plates, feeders, cutter, dryer, scale, FFS bagger, palletizer …, codes `<unit>-<kind>`); products HDPE PE100 pipe grade (black), film F7000, blow moulding BL3, injection IM55 (t) | Master Data `/master-data` |
| Reason tree (existing roots `MECH-01` Mechanical and `ELEC-01` Electrical reused, plus Process, Material, Planned, External; 32 leaves with default schedule class, OEE component and impact code), impact codes IC001–IC008 (IC001–IC005 reused), OEE codes OEE001–OEE008, a failure-code tree (class → problem → cause → remedy), 8 loss categories, 96 default mapping rules (reason → OEE component / schedule class / impact) and two active `coding_default` rules limited to the four units (stops < 5 min → performance; stops ≥ 30 min → unplanned + IC001) | Codes & Rules `/codes-admin` |
| One published calendar version per unit (Morning 06–14, Afternoon 14–22, Night 22–06; public holiday 2026-09-23 excluded), crews A–D on a 2-2-2-2-off rotation (two mornings, two afternoons, two nights, two days off). Unit-level on purpose: a site-level version would also schedule the ~100 test units of the plant | Planning `/planning` (Calendars) |
| 13 approved profiles (unit × product, t/h) with approved nameplate, sustained and planning (92 % of sustained) rates; USD valuation rates: contribution margin and standard cost per tonne per profile, cost per hour per impact code (IC001–IC005 get an approved version for Aug–Sep 2026, before the existing October ones). The approved valuation policy (IRR + USD) and the approved FX USD→IRR (from 2026-10-01) are reused unchanged | Planning `/planning` (Profiles), Finance `/finance` |
| 8 month plans "Extruder Line 1 – September 2026" … (quantity basis, header target 97 % of the planning capacity of the month's product campaigns, one campaign per product), written by an engineer, approved by a manager; the October plans have a second version (+1.5 %, "additional customer order") approved by another manager; periods generated to 7 days ahead | Planning `/planning` (Plans), plan dashboard `/plans/<id>` |
| 30 days of history per unit: ~1 300 stops (5–15 per unit and day, Pareto-shaped: many 2–20 min, a few of 1–3.5 h; breakdowns, minor stops, planned changeovers / PM / cleaning, external outages), slowdowns (rate cuts), quality losses, a shift production report per shift (gross and rejects, crew, operator); ~3 % of older stops, ~10 % of yesterday's and a quarter of today's are uncoded (operator queue) | Event Hub `/events`, Downtime `/downtime` |
| 4 running stops "now": Extruder Line 1 die plate blockage, Extruder Line 2 main drive trip (uncoded, > 60 min → RCA trigger), Pelletizer knife breakage, Bagging film shortage. The 16 stops left open by the persona reliability tests (`P-REL-*`) and other test leftovers were closed (end time set through the v2 close command, never deleted) | Event Hub `/events` (filter: open) |
| OEE ~72–73 % per unit over the month (A ~85 %, P ~86 %, Q ~98 %); waterfall target → availability → performance → quality → good closes for every period | Dashboard `/dashboard`, PLA analytics `/pla-analytics`, Reports `/reports` |
| Period accounting: shifts older than two days reconciled by an engineer and approved by a manager (323); 2 days ago lines saved but not submitted; yesterday's Morning/Afternoon shifts of both extruders **in review**; the Pelletizer Night shift of 3 days ago **rejected** with a reason; the rest of yesterday and today untouched | Plan dashboard → period, Reports `/reports` |
| Actuals adjustments on Extruder Line 1: a weighbridge correction 5 days ago (approved; booked on `good` by mistake, then reversed and re-booked on gross — the approved period now has an open **change proposal**) and a lab downgrade of yesterday's night shift (still **proposed**) | period view of Extruder Line 1 |
| CSV exports (period summary and loss lines) of an approved week | Reports `/reports` (Exports) |
| Valuation: every past day valued in USD; IRR for October only (see below) | Finance `/finance`, Reports `/reports` |
| 6 RCA cases, each linked to the three largest stops of its cause: draft (main drive trips), analysis (die plate blockages), actions open (Pelletizer knives: two actions with owners, due dates, baseline and USD 18 500 claimed avoided loss), verified (gearbox oil cooler: action done, verification window ended, realized result), two closed (bag film shortages, melt pressure after screen changes) with their knowledge-base entries (unpublished); ~44 trigger recommendations on long unplanned showcase stops | RCA `/rca`, Knowledge Base `/rca-knowledge-base` |
| 14 tasks for operators, engineers and reliability engineers (open, in progress, completed, cancelled, one overdue) | Tasks `/tasks` |
| MQTT: both demo connections running; a burst of 20 simulator events (closed stops on Extruder Line 1, source MQTT), 30 measurement samples per signal, one malformed message in quarantine | Integration console `/connectivity` (connection → Subscription / Quarantine), Enhanced Historian `/enhanced-historian` |

## Demo Plant 2 — PP compounding (14 days)

Units **Compounding Line 1** (`CMP-LINE-1`) and **Packaging Line 1** (`PKG-LINE-1`), products PP
homopolymer H030, impact copolymer C510, compound T20; its own code library, calendar, crews, profiles,
rates, a USD-only valuation policy (approved; the plant has no FX rate), month plans, ~370 events,
1 running stop, period accounting (approved / draft / rejected), two adjustments, exports, one RCA case in
analysis and 3 tasks.

## Partner Plant

Six v1 events on Partner Line 1 (four stops, one still open, two shift outputs) — enough to see that
switching to another organisation's plant shows different data.

## Known limits

- **IRR before October**: the only approved USD→IRR rate starts 2026-10-01 (owner-provided, reused
  unchanged as asked), so September losses are valued in USD only (IRR "mixed" on those days). An
  earlier dated FX version would value them — a finance decision, not seeded.
- **Demo Plant 2 valuation**: its policy was created after the first run had approved the periods, so
  only the not-yet-approved periods carry values; a fresh run creates the policy first.
- **Yesterday on Extruder Line 1** is a bad day (OEE 58 %: a 3.5 h screen pack change on top of a grade changeover and a PM stop); the month average is
  73 %.
- The Event Hub "open" filter (`isOpen=true`) also returns 19 superseded test events (merged/split by
  persona tests, end time null); the close command refuses them (`INVALID_STATE`), so they cannot be
  cleaned through the API. The live MQTT simulator can add open stops on Extruder Line 1 at any time;
  `--only cleanup` closes simulator stops older than 15 minutes.
