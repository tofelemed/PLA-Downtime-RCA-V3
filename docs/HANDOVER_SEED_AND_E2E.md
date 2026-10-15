# Traverse Forge: handover for seeding one plant end to end and testing every workflow

**Written for:** an AI coding agent (GPT) who has not seen this project. Your job is to seed realistic data for **one plant** (Demo Plant) end to end, then run and fix the **end-to-end (e2e) tests** for every use case and workflow listed here.

**State at handover (15 Oct 2026):** branch `feat/downtime-area2-b`, last merged commit `277cb22`. Nothing is pushed. Every phase was built with unit tests and typecheck only, on purpose; **no full-stack, seed or e2e pass has been run since 14 Oct.** That pass is your job.

Read these first, in this order:
1. `CLAUDE.md`: project rules. They are binding: no `any`, no `console.log`, migrations with `down`, DTOs must match exactly, business numbers only on the server, never edit `.env*` or applied migrations.
2. `plans/DECISIONS.md`: every product decision. The rows dated 2026-10-14 and 2026-10-15 describe the newest behaviour.
3. `plans/EXPERT_REVIEW.md`: status per area.
4. `docs/PROACT_APPLICATION_GUIDE.md`: what the app does, screen by screen.
5. `docs/DEMO_PERSONAS.md`: who logs in as whom.
6. `docs/DOCKER.md`: stack, environment variables, and the e2e variables.

---

## 1. Ground rules

- **Product name:** the product is **Traverse Forge**, formerly Pro-Act. Code, packages, the database (`proact`) and service names keep the old name.
- **Demo data:**
  - Demo data lives **only** in the isolated seeders under `server/pro-act-backend/scripts/`.
  - Every seeded record says **"Demo"** in a name, description or note.
  - Seed realistic HDPE plant data. The owner approved this, as long as it is marked demo.
  - Never add demo data, defaults or `Math.random` to product code.
- **Seed scope:** seed **one plant only**, Demo Plant (`demo-plant`). Demo Plant 2 and Partner Plant exist for isolation tests only; seed them only as far as the e2e specs need.
- **When something fails:**
  - Find the root cause first.
  - Outdated spec (the product changed on purpose): fix the spec.
  - Product bug: fix the product and add a unit or integration test.
  - Never weaken an assertion just to make it pass.
  - Record anything you decide in `plans/DECISIONS.md`.
- **Commits:** small commits on `feat/downtime-area2-b`. Don't push unless the owner asks.

## 2. Environment

### Projects and ports
- **Frontend (repo root):** React 18 + Vite. Dev server on `:8070`.
  - In the Docker stack, `:8070` is the **`proact-frontend-1` container**.
  - Frontend source changes need `docker compose ... up -d --build frontend` before e2e sees them. Playwright's webServer only starts Vite when nothing listens on `:8070`.
- **Backend (`server/pro-act-backend/`):** NestJS 11 + TypeORM + PostgreSQL 15. API on `:4004`, prefix `/api`. The worker process (jobs, outbox, schedules) runs as `proact-worker-1`.
- **Health check:** `GET http://localhost:4004/api/health`.

### Install
```
npm install --legacy-peer-deps                                   # root
cd server/pro-act-backend && npm install --legacy-peer-deps      # backend
```
`pdfkit` (backend) and `@axe-core/playwright` (root) were added on 15 Oct. `npm install` brings them in.

### Bring up the stack (Git Bash, repo root)
Secrets come from `server/pro-act-backend/.env`. Never print them.
```
val() { grep -E "^$1=" server/pro-act-backend/.env | head -1 | cut -d= -f2- | tr -d '\r"'; }
export DEV_DB_PASSWORD="$(val DB_PASSWORD)" DEV_JWT_SECRET="$(val JWT_SECRET)" DEV_CREDENTIAL_ENCRYPTION_KEY="$(val CREDENTIAL_ENCRYPTION_KEY)"
docker compose -f docker-compose.yml -f docker-compose.devdb.yml up -d --build
curl -s localhost:4004/api/health
```
The backend applies all pending migrations on start. The log line reads `[Migrations] Applied N migration(s)`.

### Known environment problems
- **Docker Desktop gets quit by another process on this machine,** roughly every 10–20 minutes.
  - **Symptoms:** `fetch failed`, `ECONNREFUSED`, `AggregateError`, "database system is shutting down" or "starting up".
  - **Fix:** `docker desktop start --timeout 180`, run the compose command again, then rerun the affected spec.
  - **Don't run** the 30-minute full e2e suite in one go. Run spec files **one at a time** and bring the stack up before each file.
  - **"out of shared memory"** during integration test schema reset means the Postgres lock limit was hit under load. Rerun that suite on its own.
- **Line endings:** the working copy uses CRLF. Prettier/eslint "Delete ␍" warnings are noise. The frontend has **no** prettier config, so don't run prettier on frontend files.

### Environment variables
Set these in `server/pro-act-backend/.env`. The owner edits `.env` files; you only report which lines are needed. Docker defaults are already in `docker-compose.yml`:
```
AUDIT_REQUEST_LOG_RETENTION_DAYS=30
AUDIT_TRAIL_RETENTION_DAYS=30
RAW_RETENTION_DAYS=365
SAMPLE_RETENTION_DAYS=90
# optional: EXPORT_PDF_FONT=/path/Vazirmatn-Regular.ttf  (Persian glyphs in PDF exports; without it Persian prints as "?")
```

### e2e variables
These are needed when the backend runs in Docker:
```
E2E_MQTT_PASSWORD_URL=mqtt://host.docker.internal:1885
E2E_MQTT_TLS_URL=mqtts://host.docker.internal:8885
E2E_MQTT_SIM_URL=mqtt://localhost:1885
E2E_PI_SIM_HOST=host.docker.internal     # PI simulator reachable from the container (Windows may ask to allow Node on private networks)
```

## 3. Logins

- **Simple demo users:** password `demo123`.
  - `admin@acme.com` (SuperAdmin), `manager@acme.com` (TenantAdmin → `manager_approver`), `engineer@acme.com`, `operator@acme.com`, and `test@example.com` / `Test123!@#`.
  - Reset them with `npm run db:seed-demo-users` (backend).
- **Persona users:** about 50 users, `<first>.<last>@demo.acme.com`, password **`Persona-2026!demo`**.
  - The full table is in `docs/DEMO_PERSONAS.md`.
  - Create or reset them with `npm run db:seed-demo-personas` (backend). Re-runs are safe.
- **Personas by role** (Demo Plant unless noted):

  | Role | Personas |
  |---|---|
  | SuperAdmin | helena.fischer, marcus.lindqvist, … |
  | OrgAdmin | isabel.moreno, …; lucas.ferreira (Partner Org) |
  | TenantAdmin / Manager (`manager_approver`) | anna.keller, oliver.hughes, jonas.weber, fatima.haddad, laura.rossi, … |
  | Engineer / Analyst (`production_engineer`) | noah.schmidt, aisha.bello, mateo.alvarez, hannah.novak, samuel.osei |
  | Operator | liam.murphy, yuki.sato, carlos.mendes |
  | Operator, unit-limited (`DEMO-LINE-1` only) | ingrid.hansen, amir.rahimi |
  | Viewer | grace.whitfield, pedro.santos, nadia.petrova, kenji.nakamura (home plant Demo Plant 2) |
  | `reliability_engineer` | viktor.petrov, amara.diallo, sebastian.vogel, leila.farouk |
  | `integration_admin` | elena.marchetti, omar.siddiqui, freya.nilsson, diego.herrera |
  | `master_data_admin` | charlotte.evans, hiro.yamamoto, zara.qureshi, felix.brandt |
  | `finance_maintainer` | mina.sadeghi, thomas.keller |
  | `finance_approver` | reza.karimi, sofia.lindqvist |
  | `quality_approver` (Quality / Lab) | parisa.rahimi |
  | `metrology_approver` | kaveh.ahmadi |

- **Gap: there is no `production_accountant` persona.** Many workflows need one: bridge lines, source-status approval, budget adoption, revision approval, data holds, posting decisions, source-authority approval. Add one or two to `scripts/demo-personas/persona-catalog.ts`; keep that file under 400 lines, and there is an `inBothDemoPlants()` helper. Alternatively, grant the role in the specs through `POST /v2/user-scopes`, the way `e2e/test-utils/finance-users.ts` does for finance.

## 4. Seeding (one plant, end to end)

Run these in order, against the running stack, from `server/pro-act-backend`:
```
npm run db:seed-demo-personas
npm run db:seed-demo-showcase -- --demo-plant            # ~4 min, ~1,000 API calls, idempotent
npm run db:seed-demo-showcase -- --demo-plant --only <step>   # rerun one step
```
The showcase seeder works only through the public API, acting as the personas: one person authors and a different person approves.

### Steps, in run order
`scripts/demo-showcase/showcase-steps.ts`:

1. **`master-data`**: Demo Plant HDPE units (extruder lines, underwater pelletizer, bagging, …), assets and products.
2. **`codes`** and **`rules`**: reason, impact and OEE code libraries, and rules.
3. **`calendars`**: shifts A/B/C, crews, holidays. Iranian plant settings: week starts Saturday, Thursday–Friday weekend, Solar Hijri months.
4. **`reliability-setup`**:
   - a 125-row ISO 14224 failure dictionary
   - micro-stop limits (120 s for bagger and conveyor, 0 s for extruder drives; trip reasons ELEC-MTR, PROC-MELT, EXT-PWR)
   - a state mapping for Extruder 1
5. **`profiles`**: production profiles with planning and sustained rates.
6. **`valuation-policy`**, **`rca-policy`**: demo policy versions.
7. **`plans`**: monthly plans and their periods.
8. **`transitions`**: an HDPE grade-transition matrix (17 standards). The demo plant's `oee_policy.transitionAllowanceInPlan` is pinned to **`loss`**, because the demo plans don't deduct transition time.
9. **`cleanup`**, **`events`**, **`open-stops`**, **`rca-events`**: about 30 days of production history (output, stops, transitions about 2–3 per week), open stops, and failure stops coded from the dictionary.
10. **`dispositions`**: lots (wide-spec 3.5 t, downgrade 4.2 t, scrap 0.6 t, rework 1.8 t plus its recovery), approved by Parisa (quality).
11. **`recalculate`**, **`accounting`**:
    - recalculates every period, then saves, submits and approves reconciliations (a demo speed-loss line cites a "Demo: shift rate record")
    - ends in a realistic mix: approved, draft, in review, one rejected
    - a few periods fail with `STALE_SUBMISSION` or `OPEN_REVIEW_ITEMS`, which is expected
12. **`close`**: day certification and month close (last month closed and locked if its prerequisites hold), one data hold, an escalated period.
13. **`valuation-finance`**:
    - weekly USD→IRR FX rates: economic about 1.03 M, group_reporting about 285 k
    - one provisional rate that a final rate later replaces
    - one rate approved late
    - HDPE prices and costs, demand status (PE100 sold out last month), a v3 policy
14. **`reliability-records`**: a standby pump log with one failed start, CMMS work orders for the 30 longest breakdowns.
15. **`rca`**: 5 cases, one in each workflow state (Draft, Analysis, Monitoring, Closure Review, Closed), including one effective fix and one not-effective fix, and a shared lesson.
16. **`tasks`**, **`integration`** (MQTT connections and simulator runs), **`partner-events`**, **`verify`**.

### Known seeding gaps to fix or add
- **New 15 Oct features have no seed data yet.** Add steps, marked "Demo", for:
  - unit streams / parallel trains and stream runs (`/v2/unit-streams`, `/v2/stream-runs`)
  - plant flow routes and buffer levels (`/v2/flow-routes`, `/v2/buffer-levels`)
  - uncertainty budgets (metrology approves, production accountant adopts as tolerance)
  - a ranked source-authority hierarchy
  - role delegations
  - stop-coding verification and validation
  - bridge limits, a reversal line, and a manual change proposal on the locked month
- **Persona logins in the seeders:** `scripts/demo-showcase/catalog-plants.ts` has per-plant persona lists. Add `production_accountant` there once the persona exists.
- **Seeder bugs:** if a step fails with 422/403, the product rule is usually right and the seeder is out of date (for example `EVIDENCE_REQUIRED` on manual lines). Fix the seeder.

## 5. Running the e2e tests

- **Run one file at a time:** `npx playwright test e2e/<file>.spec.ts --reporter=list`. There are 59 spec files plus `e2e/a11y.spec.ts`.
- **Accessibility:** `npm run test:a11y` checks WCAG 2.1 AA on 10 pages and fails on serious or critical issues.
- **Reading failures:**
  - Screenshots and `error-context.md` are under `test-results/`.
  - A spec failing after another spec failed is often "did not run" in a serial group.
- **Last full result (14 Oct, before the 15 Oct work):** 225 / 232 passed.
  - Two PI specs (`integration-console-ux06`, `personas/integration-02-pi-ux06`) need `E2E_PI_SIM_HOST=host.docker.internal`.
- **Specs probably out of date** after the 15 Oct changes. Check these first:
  - **Anything that approves periods:** production accountants now approve revisions in the UI, through the `canApproveRevisions` / `canApproveAdjustments` split.
  - **Anything that submits periods:** the D12 coding gate can warn. Its default is warn, not block.
  - **Anything using v1 routes:** 47 v1 controllers were removed. Only `/api/auth`, `/health`, `/tenants`, `/organizations`, `/units`, `/products`, `/assets`, `/production-events`, `/production-plans`, `/tasks`, `/audit-logs`, `/users`, `/app-settings` and `/hierarchy-mappings` remain.
  - **Anything that deletes a tenant in cleanup:** that now returns 409 `RECORD_IN_USE` once audit rows or plans exist.
  - **Exports:** CSVs gained a trailing `fx_provisional` column, PDF is new, and file names are `traverse-forge-<report>-<plant day>.csv`.
  - **RCA:** status changes only through `POST /v2/rcas/{id}/transitions`; a typed baseline is refused.
  - **Dispositions:** only `quality_approver` approves; managers get 403.
  - **Valuation, FX and demand status:** only finance maintainers author and finance approvers approve; managers get 403.
  - **Uncertainty budgets and source authority:** maker-checker.
- **Test data pile-up:** fixture cleanup often gets 409, so test units, codes and orgs accumulate (389 units, 568 codes after many runs). Lists then run past their page size. Prefer unique per-run names and search over paging assumptions.

## 6. Use cases and workflows to cover end to end

Each line is a journey. Use a different persona for author and approver wherever separation of duties applies. Mark which existing spec covers it, and write new specs (or extend persona specs) for the uncovered ones, which are marked **NEW**.

### A. Platform, plants, security
- **A1. Login and session:** login and logout, token refresh (15 min access, rotated 7-day refresh), a wrong password, a disabled user. Spec: `auth.spec`.
- **A2. Plant switching and isolation:**
  - SuperAdmin switches between plants.
  - An OrgAdmin sees only their organisation.
  - A Partner Org user never sees Demo Org data.
  - A unit-limited operator sees only `DEMO-LINE-1`; any other unit's event returns 404.
  - Specs: `admin-01`, `operator-scope-and-roles`, `viewer-*`.
- **A3. Users, scopes and permissions:** create a user, grant scope roles on plant, site or unit, see the effective roles; a caller can never grant a role above their own. Spec: `admin-03`.
- **A4. Delegation (NEW):** delegate `manager_approver` for up to 90 days with a reason, use it to approve, revoke it, and check that separation of duties still holds. Screen `/delegations`.
- **A5. Plant settings applied everywhere:**
  - Change the calendar (Gregorian / Persian), digits (Latin / Persian), week start (Saturday) and display currency (USD default, IRR switch).
  - Every date, number, chart axis, bucket label and the bad-actor month picker follows immediately.
  - Inputs, CSV and API values stay Latin.
  - Specs: `admin-04` (branding) plus **NEW** coverage for digits and calendar.
- **A6. Branding and product name:** "Traverse Forge" appears in titles and the header. Restore the branding in a `finally` block.
- **A7. Audit:** mutating requests are logged; audit "by day" is grouped in plant time; audit retention is 30 days. Specs: `audit-auto-log`, `admin-04`.
- **A8. Notifications (NEW):**
  - The bell shows SLA due reminders, escalations at 48 h / 72 h and on the third rejection; mark read, mark all read.
  - The escalation job runs every 10 minutes. For tests, call the job or wait for it.

### B. Master data
- **B1. Hierarchy:** organisation → plant → site → unit → asset, products, attributes. Specs: `master-data`, `masterdata-1`, `admin-02`.
- **B2. Code libraries and rules:**
  - Reason, impact and OEE codes as trees; a retired code shows "(retired)".
  - Rules are versioned with approve; the searchable reason picker allows leaves only.
  - Specs: `codes-admin-t18-t22`, `masterdata-2`, `manager-3`.
- **B3. Failure dictionary (ISO 14224):** class → items and modes, mechanism, cause, detection, with CSV import and dry run. Event failure fields are checked against it (422 `FAILURE_CODE_UNKNOWN`). Screen `/master-data/failure-dictionary`. **NEW**
- **B4. Stop and plan policy:**
  - Micro-stop limits per asset class, trip reasons.
  - Transition allowance `planned` / `loss`.
  - A unit-scoped approver writing a plant-wide policy gets the "plant-wide approver" refusal.
  - Screen `/master-data/stop-policy`. **NEW**
- **B5. Standby equipment:** register and retire, import the demand/test/run log, see failure on demand. MTBF on own running time shows "No failures — exposure X". Screen `/master-data/standby-equipment`. **NEW**
- **B6. CMMS work orders:** import with per-row problems; the event page "Repair" tab shows active repair vs waiting; a cross-unit link is refused. Screen `/master-data/work-orders`. **NEW**
- **B7. Unit state mapping:** versioned value → state rules, staleness; coverage timeline with lower/upper availability bounds (provisional). Screen `/master-data/unit-state`. **NEW**
- **B8. Plant flow:** routes and buffers (maker-checker), record a buffer level; flow cycle → 422. Screen `/master-data/plant-flow`. **NEW**
- **B9. Source status rules (R13):** versions per source system, released / not-released statuses, approval by the source owner (`production_accountant`). Screen `/connectivity/source-status`. **NEW**
- **B10. Source priority (E7):** a ranked source hierarchy at a boundary, drafted for a unit or the whole plant, approved by a different `production_accountant`; a stale draft → 409. Screen `/connectivity/source-authority`. **NEW**
- **B11. Measurement uncertainty (E4):**
  - Record a budget; the server computes combined and expanded values. Two 3 t readings give 4.24 t combined and 8.49 t expanded.
  - Approved by `metrology_approver`, never the author.
  - "Use as tolerance" by a production accountant writes an absolute tolerance.
  - Screen `/measurement-uncertainty`. **NEW**

### C. Planning
- **C1. Calendars, crews and rotations** (Saturday week start). Specs: `masterdata-3`, `plans-profiles-calendars-plan03`.
- **C2. Profiles and rates:** planning, sustained, nameplate and demonstrated rates; maker-checker; rate import. Specs: `engineer-planning`, `masterdata-3`.
- **C3. Plans, versions and periods:** draft, submit, approve, generate periods. Specs: `manager-1`, `production-plans-crud`.
- **C4. Grade-transition matrix:** unit × from × to × catalyst family × operating mode; the most specific match wins. Screen under Planning. **NEW**
- **C5. Streams / parallel trains:** stream shares, stream runs, lot codes; capacity split per product, e.g. 60/40 trains give 240 t + 160 t. "Streams" tab. **NEW**

### D. Events and downtime
- **D1. Event Hub:**
  - Create, code, split, recode, close, retract a stop; event pages instead of the old drawer.
  - Inline "Code" takes 3 actions, plus "To code" and bulk code (including "Code all matching" through the server snapshot).
  - Specs: `event-hub-v2-ux04`, `operator-event-hub`, `engineer-events-analytics`.
- **D2. Coding details:**
  - Origin unit and asset; planned end (time beyond it is maintenance overrun).
  - Failure severity and detail; "investigation pending"; quality-loss events with quantity and disposition class.
  - Grade-transition events with from/to product.
  - **NEW** coverage.
- **D3. Coding verification (D13):** a supervisor verifies, including bulk per shift; maintenance validates failure detail; neither can check their own coding; recoding clears the verification. **NEW**
- **D4. State-derived stops (1.10):**
  - With a state mapping and samples, stops are derived automatically.
  - Unknown time is never a stop; late samples reprocess cleanly.
  - A manual or PI stop for the same interval is reconciled: timing from the best source, cause from the operator, the other kept as evidence.
  - Preview with `GET /v2/derived-stops/preview`. **NEW**
- **D5. Duplicates and incidents:**
  - Automatic merge, or a suggestion with accept / reject / undo.
  - Repeat stops of the same asset and reason within 120 s are grouped into an incident (MTBF counts it once); a "new failure" mark breaks the chain.
  - Event page tab "Duplicates & repeats", list badge "Repeat incident". **NEW**
- **D6. Repeat / possible-duplicate filters** (`repeats=1`). Spec: engineer specs.
- **D7. Downtime Analysis (`/downtime`):**
  - KPI tiles: stop time coded, availability, controllable availability toggle (external stops left out).
  - Lost-value card first, Pareto with cumulative share, trend, crew comparison, drill-through.
  - Filters: product, shift, crew.
  - Reliability: "Mean active repair time" (CMMS), "Mean time to restore production".
  - Specs: `downtime-analysis-an01`, `manager-6`; filters and controllable view **NEW**.

### E. Production accounting and reconciliation
- **E1. Period workspace (`/plans/:planId/periods/:periodId`):**
  - actuals provenance, including the substituted-source flag and quality classes
  - plan and capacity waterfall; planned grade transition shown as information
  - loss lines; Spec: `plan-dashboard-ux05`.
- **E2. Draft lines:**
  - accept, adjust, replace or reject candidates; add manual lines
  - manual lines carry a category and evidence; a bridge is production-accountant only and never negative
  - a line claiming more of an event than its loss → 422 `EVENT_OVER_ALLOCATED`; a reversal line needs a record and an approved earlier line
  - Specs: `engineer-period-accounting`, `manager-2`; reversal **NEW**
- **E3. Submit gates:** coding gate (warn/block at 95 %), claims gates, unexplained-loss rules. **NEW** for the coding gate.
- **E4. Approve / reject:**
  - separation of duties: the approver authored no line
  - a bridge above its limit needs an independent `bridge_review`
  - reject with failed lines, a new due time and a rejection count; the third rejection escalates
  - Specs: `manager-2`, `plan-dashboard-ux05`
- **E5. SLA and My queue (`/my-queue`):** due / overdue per stage, a data hold ("waiting for data") pauses the clock, escalation 48 h / 72 h. **NEW**
- **E6. Day certification:** a manager certifies a production day's shifts; the certifier submitted none of them; revising a shift reopens the day; daily coding at 99 % (if the final wave merged). **NEW**
- **E7. Month close (`/month-close`):**
  - open → quantities closed (`manager_approver`) → finance signed off (`finance_approver`, a different person) → locked
  - working-day deadlines on the Solar Hijri calendar
  - prerequisites: approved periods, certified days, no open proposals; a closing or locked month refuses a revise
  - **NEW**
- **E8. Corrections after close:**
  - a manual change proposal (production accountant or manager, with reason and evidence)
  - another approver accepts it; the result is marked "after close"
  - restatement delta view, posting date set by `finance_approver`
  - **NEW**
- **E9. Adjustments:** propose an actuals adjustment; the author can't approve it. Specs: `engineer-period-accounting`, `manager-2`.
- **E10. Product dispositions:** record lots (wide-spec, downgrade, scrap, rework, recovery); `quality_approver` approves and the author never does. First-pass quality = good ÷ gross; rework is never counted twice. **NEW**
- **E11. Exports:**
  - period summary and loss lines, CSV and **PDF**: 202 → job → download, approved content only
  - USD / IRR, `fx_provisional` column
  - Specs: `plan-dashboard-ux05`, `viewer-3`; PDF **NEW**

### F. Valuation (finance)
- **F1. FX rates:**
  - tables: economic, group_reporting, budget
  - maker-checker: `finance_maintainer` authors, `finance_approver` approves; managers get 403
  - overlap → 409; a provisional rate (end date required) replaced by the final one; a late approval queues revaluation
  - Specs: `finance-valuation`, `manager-4`, `masterdata-4`
- **F2. Valuation policy v3:**
  - economic view, lost sales only when demand-constrained, event-date FX vs period average (refused when off by more than 5 %)
  - quality disposition map
  - Spec: `manager-4`
- **F3. Valuation rates:** margin, variable cost, salvage, disposal, downgrade difference, rework cost, rework yield (a 0–1 ratio with no currency). **NEW**
- **F4. Demand status:** sold out per product and month, with evidence and maker-checker. **NEW**
- **F5. Reports:**
  - Reports › Value: loss value defaults to approved; component breakdown table
  - period valuation tiles "Breakdown"; the loss tree with the economic metric
  - **NEW** for the breakdown

### G. Analytics
- **G1. PLA Analytics (`/pla-analytics`):**
  - waterfall closing on both ledgers, loss tree, reconciliation trend with unexplained/plan and unexplained/shortfall against the 2 % target
  - site filter; no writes on open
  - Specs: `pla-analytics-an02`, `manager-6`, `engineer-events-analytics`
- **G2. Reports (`/reports`):** approved by default; OEE, downtime, reconciliation status; CSV and PDF exports; site-loss report (plant-flow consolidation). Specs: `reports`, `pla-analytics-an02` (AN03); site loss **NEW**.
- **G3. Dashboard:** KPI tiles, downtime card with the controllable toggle, RCA tiles (open, overdue actions, effectiveness pending). **NEW** for the RCA tiles.
- **G4. Bad actors (`/reliability/bad-actors`):** monthly top-N by approved tonnes, value or stops, with trigger state; the month picker follows the plant calendar. **NEW**

### H. RCA / CAPA
- **H1. Case workflow:**
  - Draft → In Progress → Analysis → Monitoring → Closure Review → Closed, through `POST /v2/rcas/{id}/transitions`
  - the readiness panel shows the blockers; the team is locked from Monitoring
  - the closure approver was never creator, lead, member or requester
  - Specs: `reliability-rca-case`, `rca-integration-rca01-03`
- **H2. Analysis tools:** 5-Why (evidence per level, "operator error" refused), fishbone, FMEA (detection per cause, server priority), fault tree, barrier, change (plant-time dates). Consequence class sets the required method. **NEW** for the server gates.
- **H3. Actions and effectiveness:**
  - action type, evidence, a verifier who is not the owner
  - the baseline is computed by the server (correction approved by another manager)
  - verdict on run-time exposure; standby assets use their own running hours
  - **NEW**
- **H4. Triggers (D17):**
  - a stop of 2 h or more, 1 % of the daily plan, 3 same-mode stops in 30 days, a bad actor with 8 h in 90 days, a money limit
  - critical assets halve the thresholds; a stop during an open case is linked to it
  - Spec: `reliability-trigger-policy`
- **H5. Knowledge base:** an entry on close, similarity on failure mode and text, share / unshare, "From other plants". Spec: `reliability-knowledge-base`.

### I. Integration
- **I1. PI:** configure, diagnose (an unreachable server shows "Source unreachable"), discover, map, limited job, quarantine, bind, replay, backfill. Specs: `integration-console-ux06`, `integration-02`. These need `E2E_PI_SIM_HOST`.
- **I2. MQTT (subscribe only; the feed belongs to data engineering):** wizard, test, subscription, payload profile, quarantine, burst / lifecycle. Specs: `mqtt-console`, `integration-03…07`.
- **I3. Mappings and report import:** source mapping rules, external reports with a source-status mapping. Spec: `integration-06`.

### J. Accessibility
- **J1.** `npm run test:a11y`: no serious or critical WCAG 2.1 AA violations on the 10 main pages.

## 7. What is not built, or waits on the plant

Don't build these during the e2e pass. Just know they exist:
- **Plant data:**
  - real rates
  - the transition matrix
  - failure codes
  - state mappings and heartbeats
  - trains, shares and the flow map
  - uncertainty budgets
  - close calendar and lab turnaround
  - margins and prices
  - real PI and MQTT certification
  - the role matrix and materiality bands
- **About 134 engineering defaults** in `plans/DECISIONS.md` that the owner has not reviewed.
- **Deferred by the owner:**
  - monitoring (`prom-client`, 3.12)
  - Kafka (1.9)
  - Phase R2 (OPC UA, CMMS enrichment, Weibull)
  - e-mail / SMS notifications (no infrastructure)
  - web-vitals
- **7 orphan `production_plans` rows on the dev DB:** they name deleted tenants. Their foreign key stays NOT VALID until a data owner fixes them.

## 8. Merged at the end (15 Oct) — cover these too

The final wave (branch `worktree-agent-a049d612a9717eb52`) is merged. Add e2e coverage, all **NEW**:
- **Unit impact rules** (Master data → Unit impact rules; `GET|POST /v2/unit-impact-rules`, `/{id}/approve`, `/{id}/retire`): maker-checker per (unit, asset) with full stop / fractional rate / none and an optional standby. A standby run that starts within 60 s and outlasts the stop makes the impact `none`. An impact a person states on the event is `stated` and is never replaced. The Event Hub shows a hint when the impact was derived.
- **Analog thresholds** on unit-state mappings: stopped / reduced rate / running bands with hysteresis. `reduced_rate` counts as running time; spans at least as long as the debounce become slowdown events (`slowdowns` in `GET /v2/derived-stops/preview`).
- **Actuals source fallback:** when a run switches to a substitute source, production accounting and integration admins get a `source_fallback` notification (bell); it ends when a rerun uses the primary again.
- **Reversal valuation:** a reversal line carries the reversed line's approved value with the opposite sign, at the original FX. A reversed line with no stored value shows unvalued `reversed_line_unvalued`.
- **Daily 99 % coding gate:** day certification shows the coding verdict (`codingGate`). Default mode is warn; with `reconciliation_tolerance.dayGate.mode = block` certifying returns 422 `CODING_INCOMPLETE`.
- **Delegations:** `metrology_approver` can now be delegated.

Engine versions now: accounting 2.7.0, actuals 2.4.4, KPI 2.7.10, valuation 2.8.1. Seeding gap: the demo seeder has no impact rules or analog thresholds yet — add them (marked "Demo") in an isolated seeder step.

Integration specs from this wave that were never run: `unit-impact-rules`, `analog-state-engine`, plus additions to `day-certification`, `reversal-lines`, `periods-actuals`.

## 9. Checks before you report

```
# frontend (root)
npm run typecheck && npx vitest run --maxWorkers=3
# backend
cd server/pro-act-backend && npx tsc --noEmit -p tsconfig.json && npx jest --selectProjects unit fixtures
# backend integration (one test DB; run in batches of ~8 files; Docker must be up)
TEST_DB_NAME=proact_e2e_prep npx jest --selectProjects integration --runInBand "<regex of files>"
```
Last verified after merging the final wave: backend unit 2,499/2,499, frontend 805/805, both typechecks clean; migrations integration 6/6 (run by the final-wave agent).

Many new integration specs from 15 Oct are written but **never run**. Run them in batches of about 8 files and fix any failures before or alongside the e2e work:
`sla-reminders`, `stop-coding-gate`, `reversal-lines`, `bridge-limits`, `role-delegations`, `reliability-recalc`, `measurement-uncertainty`, `source-authority-maker-checker`, `rca-standby-exposure`, `transition-standard-context`, `unit-streams`, `plant-flow`, `stop-events`, `quality-dispositions`, `valuation-economic`, `valuation-rates`, `exports`, `kpi-results`, `rca-workspace`, `restatement-source-status`, `data-retention`.

In the final report give: pass/fail counts per spec file (verbatim), every product bug found and fixed (with its test), every spec updated and why, the seeder changes, and anything left for the owner.
