# Demo personas

Demo accounts for testing every persona the application defines end to end. They are created by an
isolated seeder (`server/pro-act-backend/scripts/demo-personas/`), never by product code.

```
cd server/pro-act-backend
npm run db:seed-demo-personas               # idempotent: prints what it created / kept
npm run db:seed-demo-personas -- --verify   # also logs every user in against the live API and probes its rights
```

- Database: the `DB_*` values of `server/pro-act-backend/.env` (same as `db:seed-demo-users`).
- `--verify` calls the API at `PROACT_API_URL` (default `http://localhost:$PORT`, i.e. `:4004`) and exits
  non-zero when a persona does not behave as documented. It changes no data: the "allowed write" probe
  is either an idempotent flag set to its current value or a create with an empty body that stops at
  validation (`428 IDEMPOTENCY_KEY_REQUIRED`), after every guard has passed.
- Re-running resets each persona's password, display name, legacy role and home plant, and makes its
  `user_scopes` rows match the catalogue exactly (extra rows are removed). Existing organisations,
  plants, units, products and flags are kept.

## Password

Every persona below signs in with **`Persona-2026!demo`** (17 characters: satisfies the bootstrap rule
of 12+ characters and the 8+ rule of the password DTOs).

Emails follow `<firstname>.<lastname>@demo.acme.com`.

## Organisations and plants

| Organisation | Code          | Plant         | Code           | Notes |
|--------------|---------------|---------------|----------------|-------|
| Demo Org     | `demo-org`    | Demo Plant    | `demo-plant`   | existing plant `5f011848-1cb5-4b7c-b75a-8938b46260a9`; the seeder adds units `DEMO-LINE-1` / `DEMO-LINE-2` for the unit-limited operators |
| Demo Org     | `demo-org`    | Demo Plant 2  | `demo-plant-2` | created by the seeder: units `DP2-LINE-1`, `DP2-LINE-2`, products `DP2-PROD-A`, `DP2-PROD-B`; the 8 `v2.*` feature flags are copied from Demo Plant (all on) |
| Partner Org  | `partner-org` | Partner Plant | `partner-plant`| created by the seeder for cross-tenant isolation tests: unit `PP-LINE-1`, product `PP-PROD-A`; no feature flags |

The seeder prints the ids of the three plants on every run.

## How rights are resolved

A request's roles are the **legacy role** (`users.role`) with its D06 mapping, valid only in the user's
home plant (SuperAdmin everywhere, OrgAdmin in every plant of its organisation), plus the **scope
roles** of the `user_scopes` rows in the acting plant. Acting on another plant than the home plant is
done with the `X-Tenant-Id` header and requires a `user_scopes` row in that plant (SuperAdmin excepted).
A caller whose roles in the acting plant are only `viewer` cannot send any POST / PUT / PATCH / DELETE
(`403 READ_ONLY_ROLE`); a missing role is `403 FORBIDDEN_ROLE`; a plant the caller is not a member of
is `403 TENANT_NOT_ALLOWED`. On the v1 routes bound to the acting plant (`@TenantBound()`: tasks, units,
assets, products, production-events, production-plans, rcas, `GET /users`) a `tenantId` in the body or
query must be the acting plant (a read may name any plant the caller holds a scope in; SuperAdmin and
OrgAdmin may name a plant they could select); anything else is `403 TENANT_MISMATCH`, and a POST body
naming no plant gets the acting one.

## Personas

| Persona | Users (`@demo.acme.com`) | Home plant | Effective roles in Demo Plant | Can | Cannot |
|---------|--------------------------|------------|-------------------------------|-----|--------|
| **SuperAdmin** (legacy `SuperAdmin`) | helena.fischer, marcus.lindqvist, priya.raman, tomasz.nowak | Demo Plant | `SuperAdmin` | everything, in every plant that exists (select any plant with `X-Tenant-Id`); Admin Panel, Audit Logs, register any role | select a plant that does not exist (`TENANT_NOT_ALLOWED`) |
| **OrgAdmin** (Demo Org; legacy `OrgAdmin`, `OrgAdmin` scope in Demo Plant and Demo Plant 2) | isabel.moreno, daniel.okafor, sofia.bergstrom, ravi.krishnan | Demo Plant | `OrgAdmin` (also in Demo Plant 2) | every scope role in Demo Plant and Demo Plant 2; user management of the organisation; approve plans/profiles/rules; switch feature flags | SuperAdmin-only routes (`FORBIDDEN_ROLE`, e.g. editing audit logs); act on Partner Plant (`TENANT_NOT_ALLOWED`) |
| **OrgAdmin** (Partner Org) | lucas.ferreira | Partner Plant | none (`TENANT_NOT_ALLOWED`) | everything inside Partner Org / Partner Plant | see or act on any Demo Org plant |
| **TenantAdmin** (legacy `TenantAdmin` → `manager_approver`) | anna.keller, benjamin.carter, mei.tanaka, oliver.hughes | Demo Plant | `TenantAdmin`, `manager_approver` | approve plans, profiles, rules, adjustments and revisions; write codes, calendars, connections, periods, RCAs; switch feature flags; register users of Demo Plant; Master Data, User Management, Permissions, Settings screens | SuperAdmin-only routes; act on Demo Plant 2 or Partner Plant |
| **TenantAdmin** (Demo Plant 2) | chloe.dubois | Demo Plant 2 | none (`TENANT_NOT_ALLOWED`) | the same, inside Demo Plant 2 | act on Demo Plant |
| **Manager** (legacy `Manager` → `manager_approver`) | jonas.weber, fatima.haddad, erik.johansson, laura.rossi | Demo Plant | `Manager`, `manager_approver` | the same API rights as TenantAdmin (approvals, feature flags, register users); menu: Dashboard, Reports, PLA, Plans, Planning, Event Hub, Downtime, RCA, Knowledge Base, Codes & Rules, Finance, Enhanced Historian, Tasks | admin-only screens (Master Data, User Management, Permissions, Connectivity, Settings, Admin Panel); SuperAdmin-only routes |
| **Engineer / Analyst** (legacy `Engineer` ×3, `Analyst` ×2 → `production_engineer`) | noah.schmidt, aisha.bello, mateo.alvarez (Engineer); hannah.novak, samuel.osei (Analyst) | Demo Plant | `Engineer`/`Analyst`, `production_engineer` | create and edit plans and periods (drafts, reconciliation lines, adjustments); read everything of the plant | approve anything, switch feature flags, open RCAs, write codes/rules/connections (`FORBIDDEN_ROLE`) |
| **Operator** (legacy `Operator` → `operator`) | liam.murphy, yuki.sato, carlos.mendes (tenant-wide); ingrid.hansen, amir.rahimi (unit-limited: only a `unit` scope on `DEMO-LINE-1`) | Demo Plant | `Operator`, `operator` | record and code production events, tasks; the two unit-limited operators only see and write data of `DEMO-LINE-1` (other units answer 404 / 422 `INVALID_REFERENCE`) | create plans, approve, write master data (`FORBIDDEN_ROLE`) |
| **viewer** (legacy `Operator` in Demo Plant 2; only a `viewer` scope in Demo Plant) | grace.whitfield, pedro.santos, nadia.petrova, kenji.nakamura | Demo Plant 2 | `viewer` (exactly; verified) | read every screen and list of Demo Plant with `X-Tenant-Id: <Demo Plant>`; act as operator in their home plant | any write in Demo Plant (`READ_ONLY_ROLE`, from `WriteAccessGuard`) |
| **reliability_engineer** (legacy `Engineer` + scope `reliability_engineer`) | viktor.petrov, amara.diallo, sebastian.vogel, leila.farouk | Demo Plant | `Engineer`, `production_engineer`, `reliability_engineer` | open RCA cases, actions and links; plan/period writes of an engineer | approvals, feature flags, codes/rules, connections |
| **integration_admin** (legacy `Engineer` ×2 / `Analyst` ×2 + scope `integration_admin`) | elena.marchetti, omar.siddiqui, freya.nilsson, diego.herrera (also `integration_admin` in Demo Plant 2) | Demo Plant | legacy + `production_engineer`, `integration_admin` | connections, ingestion jobs, replays, signals, source/attribute mappings, external report imports; Diego can do the same in Demo Plant 2 | approvals, feature flags, RCAs; the other three cannot act on Demo Plant 2 (`TENANT_NOT_ALLOWED`) |
| **master_data_admin** (legacy `Analyst` + scope `master_data_admin`) | charlotte.evans, hiro.yamamoto, zara.qureshi, felix.brandt | Demo Plant | `Analyst`, `production_engineer`, `master_data_admin` | author codes, code mapping rules, declarative rules, calendars, crews, profiles and valuation rates | activate/approve rules, approve profiles and rates (manager_approver), feature flags, RCAs |

Demo Plant 2 OrgAdmin membership: `RequestContextFactory` only lets a non-SuperAdmin select a plant it has
a `user_scopes` row in, so the four Demo Org OrgAdmins carry an `OrgAdmin` tenant scope in Demo Plant 2 as
well (the legacy role then applies there because the plant is in their organisation).

## What the browser can and cannot show

The login response (`POST /api/auth/login`, also refresh) and `GET /api/auth/profile` carry, next to
the legacy role, `scopes` (the `user_scopes` grants grouped by tenant and role:
`{ tenantId, organizationId?, role, unitIds?, siteIds? }`) and `homeTenantId`. The browser derives
the effective roles of the selected plant from them the same way `RequestContextFactory` does
(`src/features/auth/effective-roles.ts`, tests mirror the backend cases) and turns them into
capabilities (`src/features/auth/capabilities.ts`, `useCapabilities()`):

- `Navigation.tsx` and the page gates (`MasterData`, `UserManagement`, `Permissions`,
  `Connectivity`/Integration console, `EnhancedHistorian`, `AdminPanel`) read capabilities of the
  selected plant. A `master_data_admin` (legacy Analyst) sees Master Data, an `integration_admin`
  (legacy Engineer/Analyst) sees Connectivity / Integration console; legacy-role users keep exactly the
  menus they had (`src/features/auth/navigation-items.test.ts`).
- The plant selector lists the home plant and every plant the user holds a scope in (global admins:
  every plant), so the `viewer` personas (home Demo Plant 2) can switch to Demo Plant in the UI. There
  they hold `viewer` only: the header shows a "Read-only" badge and every write is refused by the server
  (`403 READ_ONLY_ROLE`, rendered as "Your role in this plant is read-only" by the v2 screens). v1
  requests send the same `X-Tenant-Id` as v2 requests (the `httpClient` reads the acting plant from
  `V2SessionBridge`), so v1 screens act on the selected plant too.
- A session stored before the server sent `scopes` fetches them from `GET /api/auth/profile` on restore;
  a server that does not send them yet leaves the user with the legacy role in the home plant.
- The legacy `Manager` role was missing from every menu list; it gets the TenantAdmin menu minus the
  admin-only screens.

## Verification table

`npm run db:seed-demo-personas -- --verify` prints one line per user: persona, email, home plant, acting
plant, the effective roles derived the way `RequestContextFactory` derives them, and each probe with its
HTTP status and error code. All 44 users were verified against the live API on 2026-10-11.
