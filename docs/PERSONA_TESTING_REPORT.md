# Persona-based end-to-end testing: report

**Date:** 2026-10-11 · **Scope:** the whole application, as every persona the code defines · **Environment:** local dev stack (API `:4004` with the worker in-process, Vite `:8070`, dev Postgres, Compose broker) · **Rule set:** real UI logins as seeded persona users, every entity prefixed `P-<persona>-`, nothing deleted or retired, no feature flag turned off, all data kept in the database.

## 1. Summary

| | |
|---|---|
| Personas | 10 (SuperAdmin, OrgAdmin, TenantAdmin, Manager, Engineer/Analyst, Operator, viewer, reliability engineer, integration admin, master-data admin) |
| Seeded users | 44 on `demo.acme.com`, password `Persona-2026!demo` (`npm run db:seed-demo-personas -- --verify`, 44/44 effective roles verified against the API); plus Demo Plant 2 and Partner Org / Partner Plant |
| Browser journeys | 175 run (86 round 1 · 59 re-verified after fixes · 30 round 2) |
| Product defects found | 15 — 5 security, 4 tenancy/authorization UX, 3 MQTT intake, 3 functional |
| Fixed and committed | 15 / 15 (final browser re-verification: see §6) |
| Specs committed | `e2e/personas/*.spec.ts` (33 files) + `e2e/personas/support/*` |
| Demo data kept | see §7 |

The biggest theme: **the v1 (legacy) admin and master-data endpoints had no server-side authorization** — menus hid the screens, but the API answered anyone with a token. All of that is now enforced on the server. The second theme: **scope roles never reached the browser**, so three personas (viewer, integration admin, master-data admin) could not use the UI at all; they can now.

## 2. Persona × journey results

Results after fixes. R1 = round 1 (before fixes), RV = re-verified after fixes, R2 = round 2 (after the scope-role change).

| Persona (users) | Journeys | Result | Highlights |
|---|---|---|---|
| **Operator** (5, two unit-limited) | 9 | 9 pass (R1, RV) | Event Hub code → split → recode → close with persistence; validation errors; offline draft resumes; unit-limited sees only its line, foreign event → 404 without data; refusals; read-only analytics; tasks; per-user plant selection |
| **Engineer / Analyst** (5) | 12 | 12 pass (R1) | Plan draft with preview (approve refused); period accounting gap → line → submit, stale re-submit refused; adjustment proposed but not approvable; bulk coding; analytics, drill-through, approved-only CSV export |
| **Manager / TenantAdmin** (9) | 24 | 24 pass (R1 22 + RV 2) | Plan approved by a second manager; calendars, crews, rotations with days off; rates with 409 + supersede; period submit/approve/export with separation of duties; adjustments approve/reject; codes tree (cycle 422, retirement 409); rule lifecycle with author/approver split; FX + valuation policy; user registration; MQTT pause/resume; AN01/AN02 analytics |
| **Reliability engineer** (4) | 17 | 17 pass (R1 15 + RV 2) | RCA badge on a 70-min stop, case from event with evidence (idempotent), analysis content, second event linked, action verified against baseline, close → event completed + knowledge entry; display currency USD/IRR matches API; trigger policy thresholds (65 min yes, 10 min no, planned no) |
| **SuperAdmin / OrgAdmin** (9) | 27 | 26 pass, 1 skipped (R1 22 + RV 4) | Plant switching across 3 plants / 2 orgs; org isolation; master data; users; app settings; audit log; legacy screens on a flag-off plant; flag switch-over; cutover status; security probes |
| **viewer** (4) | 13 | 12 pass (R2) + 1 fixed (§6) | Home plant rights intact; switch to Demo Plant → read menus + "Read-only" badge; every v2 write refused; exports/previews allowed; Partner plant unreachable; `/users` 403, `/users/assignable` 200 with `{id,name}` only |
| **Integration admin** (4) | 25 | 22 pass (R2) + 3 fixed (§6) | PI UX06 end to end; MQTT wizard incl. wrong password and TLS with/without CA; subscription pause/resume with queued delivery; profile editor + live value-map classification; quarantine (poison messages) with role-based payload hiding; mappings; report import; cross-plant console |
| **Master-data admin** (4) | 17 | 16 pass (R2) + 1 fixed (§6) | Master Data units/assets/products; codes tree + mapping rules; rules draft (activation refused for the author and the role); calendars publish; crews with days off; profiles and FX drafts (approval refused); refusals |

## 3. Defects found and fixed

| # | Persona that found it | Defect | Severity | Fix (commit) |
|---|---|---|---|---|
| 1 | Operator | `GET/POST /users` returned every user's `passwordHash` to any token | high | stripped at the boundary everywhere; `GET /users/assignable` (`{id,name}`) for members (`de8a9e2`) |
| 2 | SuperAdmin | v1 `/users`, `/tenants`, `/organizations`, `/roles` had no role check (an Operator listed all users) | high | server-side role matrix; lists scoped to what the caller may see (`de8a9e2`) |
| 3 | Manager | a TenantAdmin could mint SuperAdmin accounts via `/auth/register` (public-registration bypass) and `/users` | high | bearer token on a public-if route is authenticated; grant rule ≤ own rank; peers of equal rank cannot be managed; role change on PUT is a grant (`de8a9e2`). Four rogue accounts deactivated (not deleted) |
| 4 | Reliability | any member could create units/assets/products (v1) | medium | writes require master_data_admin / manager_approver or admin roles (`de8a9e2`) |
| 5 | viewer | **cross-tenant write**: the v1 Tasks page stored a task in the read-only plant (v1 client sent no `X-Tenant-Id`; body `tenantId` unchecked) | high | v1 client sends the acting plant; `TenantBindingGuard` → 403 `TENANT_MISMATCH` on v1 body/query tenant ≠ acting tenant (`b8a758e`) |
| 6 | SuperAdmin | OrgAdmin selecting a plant outside its org → endless "Loading", empty menu | medium | org-scoped selector; access notice with "Switch to my plant" (`1d36434`) |
| 7 | SuperAdmin | cross-organisation plant listing (`GET /tenants` unfiltered) | medium | server lists scoped (`de8a9e2`) + selector filtered (`1d36434`) |
| 8 | SuperAdmin | Permissions page reported success but persisted nothing | low | honest read-only page with explanation; no fake toast/audit row (`1d36434`) |
| 9 | SuperAdmin | v1 Event Hub white-screen on "Production Output" with no plans (empty `SelectItem`) | medium | placeholder fix in 3 pages + error boundary + source-level regression test (`1d36434`) |
| 10 | Reliability | audit trail of an RCA case did not show who added an action (logged against the child id) | low | sub-resource writes logged against the parent entity (`de8a9e2`) |
| 11 | Manager | crew rotation with days off could not be saved (`null` rejected per element) | medium | per-element validator (`de8a9e2`) |
| 12 | Master-data admin | `find-mapping` and v2 preview never resolved non-PI (MQTT) mappings | medium | source system passed through; one shared vocabulary (`3a61aa3`) |
| 13 | Integration admin | burst-delivered event lifecycle (open/close/update/delete during a pause) produced no event | medium | every accepted revision normalized in order (`6164e78`) |
| 14 | Integration admin | a failed MQTT subscription never recovered after the connection was corrected | medium | failed job restarts when `config_version` moves past the failure (`6164e78`) |
| 15 | Integration admin | payload-profile editor dirty on an untouched profile (key order) | low | order-insensitive comparison (`6164e78`) |

Also closed before testing could start: **scope roles not sent to the browser** (viewer / integration admin / master-data admin had no menu or plant switching) — `12cbc0d`; **legacy Manager role had an empty menu** — `d40c538`.

Deliberately not changed: with `AUTH_ALLOW_PUBLIC_REGISTRATION=true` (dev only; off in Compose/production) an *anonymous* registration can still name any role, because the e2e `authenticate()` fallback relies on it (recorded in `plans/DECISIONS.md`; `scripts/setup-test-environment.ts`, which relied on it too, was removed on 15 Oct 2026).

## 4. Observations worth the owner's attention (not defects)

Product / UX
- Write controls are shown to users who can only be refused: Approve on the period workspace for engineers, "New code"/"New policy"/"New plan" for operators and viewers. The server refuses correctly; a role-aware hide would avoid dead ends. `capabilities.canApprove` exists now for this.
- No UI exists to propose or decide **actuals adjustments** on the v2 period workspace (API only); approved ones appear only as provenance text.
- No feature-flag screen; flags are switched through the API only.
- The v2 Event Hub has no deep link to an event; the Event Hub defaults to "Last 24 h", so accounting a day back needs the window changed first.
- The RCA knowledge-base page loads every RCA and every production event through v1 and filters in the browser; it needs a v2 rewrite before it meets the "no business numbers in the browser" rule at scale.
- Products are organisation-level (no plant field); the v1 Event Hub unit dropdown is not filtered by the selected plant.
- Separation of duties is enforced for periods, adjustments, rules and valuation policies, but **not** for profiles, rates, FX rates or plans (a manager can approve their own draft).
- Approving a far-future FX draft with "supersede" closes the open-ended live version at the new start; a bounded draft can never supersede an open-ended one (409) — worth a hint in the UI.
- Accessibility: collapsed sidebar links, the logout button and several dialog inputs lack accessible names/labels.

Operations
- The per-user rate limit (300/min) silently turns fast API polling into empty pages; tests poll at 2 s.
- The MQTT subscription counters travel with the worker heartbeat (~20 s) while quarantine rows appear at once.

## 5. What this run leaves in the code

- `server/pro-act-backend/scripts/demo-personas/` — persona seeder (`db:seed-demo-personas [--verify]`), `docs/DEMO_PERSONAS.md`.
- `e2e/personas/` — 33 spec files, ~175 journeys, runnable against a live stack: `npx playwright test e2e/personas --workers=1 --retries=1 --reporter=list`. They are not in CI's smoke set; they need the seeded personas, the Compose broker and the PI simulator.
- Security: `TenantBindingGuard`, `grant-policy.ts`, v1 role matrix, `GET /users/assignable`, scope roles in the login/profile response, capability-based menus.

## 6. Final re-verification

Run against the rebuilt API (commits `3a61aa3`, `b8a758e`, `6164e78` live), `--workers=1 --retries=1 --reporter=list`:

| Spec(s) | Summary (verbatim) |
|---|---|
| viewer-1/2/3 | `12 passed (56.4s)` (+1 flaky locator, fixed; viewer-3 re-run `4 passed`) |
| masterdata-5 / masterdata-1 | `1 passed (1.4s)` / `5 passed (17.0s)` |
| integration-03 / -04 / -07 | `4 passed (35.7s)` / `4 passed (53.0s)` / `3 passed (3.2s)` |
| operator-analytics-tasks / operator-scope-and-roles | `3 passed (10.3s)` / `3 passed (8.5s)` |
| admin-01 / -02 / -03 / -05 / -06 | `7 passed` / `3 passed` / `4 passed` / `5 passed` / `3 passed` |
| manager-1 / -2 / -5 | `5 passed (45.7s)` / `4 passed (24.1s)` / `5 passed (25.7s)` |
| reliability-rca-case | `6 passed (17.2s)` |

**85 tests, 85 passed, 0 failed; `grep -rn DEFECT e2e/personas/` → 0.** Every one of the 15 defects is fixed and verified in the browser: the viewer's task write now gets `403 READ_ONLY_ROLE` with the acting plant in the request; the MQTT mapping resolves; the paused burst yields one retracted event; both the bad-password and the TLS subscriptions restarted automatically after the connection was corrected (`failed → running`, audited `config_changed`); the untouched profile editor is clean. The v1 regression pass (tasks, master data, users, user registration, RCA pickers) found no regression and needed no test changes.

Rollout note: the recovery fix restarts every pre-existing `failed` subscription that has no recorded config version exactly once on the first sweep; a still-broken configuration fails again with the version recorded and is not retried further.

## 7. Demo data left in the database (all kept)

Prefixes make it easy to find: `P-OPS-`, `P-ENG-`, `P-MGR-`, `P-REL-`, `P-ADM-`, `P-VIEW-`, `P-INT-`, `P-MDA-` (plus `P-RV-` / `P-FV-` for re-verification runs). Per plant:

**Demo Plant** (`5f011848-…`): ~90 units and ~45 products across personas with published calendars, approved profiles and rates; ~60 reason codes with mapping rules; ~30 plans with periods, output and stop events, accounting revisions (submitted/approved/rejected), adjustments, export jobs; ~70 downtime/production events (Operator, Reliability, MQTT simulator) incl. 13 still-open unplanned stops from the RCA trigger tests; 10 RCA cases (4 closed with actions, knowledge-base entries and votes); crews with rotations; FX USD→IRR versions (far-future, approved) and valuation policy versions effective 2099; declarative rules (active, with rollback history); PI and MQTT connections (`P-INT-`) with jobs, mappings, quarantine rows, external production reports; tasks; audit rows. The owner's live FX rate (v11, 2,690,000 IRR) still applies today (closed at 2099-01-01 by a supersede).

**Demo Plant 2** (`1c19bda6-…`): units `DP2-LINE-1/2`, `P-ADM-U-*`, products `DP2-PROD-*`, 12 `P-VIEW-J1-*` downtime events, `P-INT-dp2-mqtt-*` connections, all 8 v2 flags on.

**Partner Org / Partner Plant** (`d731498e-…`): unit `PP-LINE-1`, product `PP-PROD-A`, four `P-ADM-v1 event *` v1 events, `v2.eventHub` ON (switched on by a test and left on; other flags off).

**Users:** 44 persona users; 11+ `p-mgr-operator-*` Operators created through User Management; 4 `p-mgr-superadmin-*` SuperAdmin accounts created by the escalation defect before its fix — **deactivated** (`is_active=false`), not deleted.

**Broker:** retained messages on `test/p-int-*` topics of the dev broker.
