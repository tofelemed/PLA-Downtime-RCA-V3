# HDPE demo personas

The HDPE showcase has **52 named users** covering all application roles. In
`--hdpe-only` mode every user's home and acting plant is HDPE, in the HDPE
organization. The production hierarchy is:

```text
HDPE organization
└── HDPE plant
    ├── unit100
    │   └── Extruder1 and its supporting equipment
    └── unit200
        └── Extruder2 and its supporting equipment
```

The organization and plant retain internal codes `demo-org` and `demo-plant` for
compatibility with the isolated seeders; their displayed names are **HDPE**.
The established plant ID is `5f011848-1cb5-4b7c-b75a-8938b46260a9`.

## Seed and verify the single-plant cast

From `server/pro-act-backend`:

```powershell
npm run db:seed-demo-personas -- --hdpe-only
npm run db:seed-demo-personas -- --hdpe-only --verify
```

The seeder reads the backend's existing `DB_*` environment settings. Verification
uses `PROACT_API_URL`, or `http://localhost:$PORT` when that variable is absent.
The seeder lives in `server/pro-act-backend/scripts/demo-personas/`, separate from
product code.

Re-running resets these users' passwords, display names, stored roles and home
plant, and reconciles their scope grants to the selected catalog. HDPE mode
remaps grants to HDPE, preserves the two operators' unit100 restriction, and gives
the four viewers only the `viewer` role and scope. They do not inherit the old
home-plant Operator write rights.

This persona command does not delete unrelated existing organizations or their
operational records. The backed-up cleanup and full HDPE seed workflow is
documented separately in `docs/HDPE_DEMO_GUIDE.md`. The final cleaned showcase
contains only the HDPE organization and plant.

The command **without `--hdpe-only`** retains the original multi-plant isolation
fixture: HDPE, Demo Plant 2 and Partner Plant, with their separate memberships.
Use that mode only when intentionally preparing isolation tests. It can recreate
the extra organizations and plants after cleanup, and its viewer accounts have
Operator rights in their separate home plant. It is not the final HDPE display.

## Sign-in

Every named persona below uses **`Persona-2026!demo`**. Add `@demo.acme.com` to
each account name in the table. For example:

| Task | Email |
|---|---|
| Plant administration | `helena.fischer@demo.acme.com` |
| Production management | `jonas.weber@demo.acme.com` |
| Production engineering | `noah.schmidt@demo.acme.com` |
| Shift operation | `liam.murphy@demo.acme.com` |
| Production accounting | `sara.nouri@demo.acme.com` |
| Read-only review | `grace.whitfield@demo.acme.com` |

## Complete account catalog

All rows below describe **HDPE-only mode**. Role descriptions are summaries;
the server remains the authority for scope, record state and independent review.

| Persona | Accounts (`@demo.acme.com`) | Main rights | Important limits |
|---|---|---|---|
| SuperAdmin — 4 | helena.fischer, marcus.lindqvist, priya.raman, tomasz.nowak | Application administration, organizations, plants, users, settings and all scope roles | An unknown plant is still refused; workflow evidence and independent-review rules still apply |
| OrgAdmin — 5 | isabel.moreno, daniel.okafor, sofia.bergstrom, ravi.krishnan, lucas.ferreira | Organization administration and scope-role operations within HDPE | SuperAdmin-only actions, including editing audit records and application-wide branding, are refused |
| TenantAdmin — 5 | anna.keller, benjamin.carter, mei.tanaka, oliver.hughes, chloe.dubois | HDPE user administration, master-data screens, plant settings, manager approvals and plant-level admin tabs | No SuperAdmin-only actions; specialist finance, quality, metrology and accounting duties require their own roles |
| Manager — 4 | jonas.weber, fatima.haddad, erik.johansson, laura.rossi | `manager_approver`: production approvals, day certification, quantity close, adjustments, plant settings, stop policy and reliability operations | Cannot approve lot dispositions, uncertainty budgets or valuation inputs without the specialist role; general user/admin screens are not offered |
| Engineer / Analyst — 5 | noah.schmidt, aisha.bello, mateo.alvarez (Engineer); hannah.novak, samuel.osei (Analyst) | `production_engineer`: plans, reconciliation drafts, actuals proposals, supervisor stop verification and production evidence | Cannot approve revisions/plans, switch flags, author codes/rules/connections or open RCA cases without another role |
| Operator — 5 | liam.murphy, yuki.sato, carlos.mendes; ingrid.hansen and amir.rahimi are unit100-only | Events and coding, tasks, disposition recording and standby equipment/log operations | Cannot create plans or approvals, or manage units/products; Ingrid and Amir cannot access unit200 operational records |
| Viewer — 4 | grace.whitfield, pedro.santos, nadia.petrova, kenji.nakamura | Read-only operations and analysis in HDPE | No business writes; no inherited Operator role. Administrative screens still require their own capabilities |
| Reliability engineer — 4 | viktor.petrov, amara.diallo, sebastian.vogel, leila.farouk | Engineer rights plus RCA cases/actions/links, technical failure validation, standby logs, work-order operations and unit-impact drafts | No manager approvals, feature flags or connection administration |
| Integration administrator — 4 | elena.marchetti, omar.siddiqui, freya.nilsson, diego.herrera | Engineer rights plus connections, ingestion jobs, replay/quarantine, signals/mappings, source-priority/status drafts, standby logs and work orders | Cannot approve source priority/status, production plans or revisions without the approving role |
| Master-data administrator — 4 | charlotte.evans, hiro.yamamoto, zara.qureshi, felix.brandt | Engineer rights plus units/assets/products, code libraries, rules, calendars, crews, operating profiles and unit-impact drafts | Cannot approve their drafts; valuation inputs belong to finance roles, not master-data administration |
| Production accountant — 2 | sara.nouri, david.chen | Period preparation and independent revision review, inventory bridges, correction proposals, source-priority/status authoring and independent approval, tolerance adoption and materiality review | No day certification, quantity close, finance lock, lot approval or metrology approval solely from this role |
| Finance maintainer — 2 | mina.sadeghi, thomas.keller | Engineer rights plus drafting valuation policies, FX, valuation rates and demand statuses | Cannot approve valuation inputs or sign off/lock a month |
| Finance approver — 2 | reza.karimi, sofia.lindqvist | Engineer rights plus independent valuation approval/retirement, month finance sign-off/lock/reopen, posting decisions and materiality review | Cannot draft valuation inputs solely from the approver role; cannot approve their own submission |
| Quality / Lab approver — 1 | parisa.rahimi | Engineer rights plus independent lot disposition approval/rejection; can also record dispositions | Cannot decide a disposition she recorded; no unrelated finance or metrology approval |
| Metrology approver — 1 | kaveh.ahmadi | Engineer rights plus uncertainty-budget authoring and independent approval/rejection | Cannot approve a budget he proposed; adopting it as reconciliation tolerance belongs to accounting/management |

Production accountants retain stored role `Analyst` in the catalog, so the
current legacy mapping also gives them `production_engineer` capabilities. Other
specialists likewise retain the Engineer/Analyst rights listed above. These are
combined-role test accounts, not claims that every specialist role by itself
has production-engineering authority.

## How access is resolved

The request context combines the stored role and its legacy mapping with valid
`user_scopes` grants in the acting plant. `TenantAdmin` and `Manager` map to
`manager_approver`; `Engineer` and `Analyst` map to `production_engineer`;
`Operator` maps to `operator`. SuperAdmin satisfies all role requirements;
OrgAdmin satisfies all except SuperAdmin-only requirements within its permitted
organization context.

The acting plant is sent in `X-Tenant-Id`. Tenant membership and unit scope are
checked separately from the role. Ingrid and Amir have only unit100 scope, so
their Operator role does not grant tenant-wide access to unit200. Missing or
out-of-scope records can be hidden with 404 or rejected as `INVALID_REFERENCE`.

Viewers have stored role `viewer` and only a viewer tenant grant in HDPE. Their
business mutation requests are refused as `READ_ONLY_ROLE` or, when an earlier
role guard rejects the operation, `FORBIDDEN_ROLE`. A read-only account can still
sign in and refresh its authentication session.

Maker/checker checks are additional to role membership. A second authorized
person must decide the first person's proposal where the workflow requires
independent review. A broad administrative role does not make self-approval a
valid workflow example.

## Master Data and other UI access

Master Data is a collection of pages with different capabilities. Seeing its
menu does not mean the account can edit the whole plant hierarchy.

| Account role | Master Data pages offered |
|---|---|
| SuperAdmin, OrgAdmin, TenantAdmin, master-data administrator | Full master-data navigation; each command still checks its required role |
| Manager | Plant flow, stop/plan policy, standby equipment, unit impacts, work-order operations and unit-state mappings |
| Operator | Standby equipment and its logs |
| Reliability engineer | Standby equipment, unit-impact rules and work-order operations |
| Integration administrator | Standby equipment, work-order operations and unit-state mappings |

These links are selected by `src/features/master-data/components/master-data-sections.ts`
and `src/features/auth/capabilities.ts`. The limited-role landing page shows
“Your pages”; it does not expose the Units/Assets/Products administration links.

Managers now have the Settings menu for plant calendar and digit preferences.
They can read their plant audit trail. User Management, Permissions and the
general Connectivity menu are separately gated; API permission for a particular
operation does not guarantee every administration screen is offered to that
role. Source Priority and Source Status Rules have dedicated analysis links.

Viewers see a read-only badge and read-capable operations/analysis pages; the
server blocks business writes even when a user manually navigates to an editor.
Login, refresh and profile responses provide scopes and `homeTenantId`, and both
v1 and v2 clients use the selected plant.

## What verification proves

`--verify` logs in all 52 users, checks their expected home plant, derives their
effective roles, and performs representative allowed/refused API probes. Allowed
write probes use an empty invalid body or an idempotent flag update to its current
value. They do not complete the whole business workflow, and may produce audit
records. Review the recorded HTTP status and error code for each probe.

The browser all-persona session suite checks sign-in and navigation separately
from the deeper persona workflow suites. Unit-scope refusals, viewer write
refusals, independent review, finance, quality, metrology, ingestion and settings
require those workflow tests as well. The current execution totals and any
remaining failures belong in `docs/HDPE_E2E_REPORT.md`; the catalog's count of 52
is not by itself a claim that 52 complete workflows passed.
