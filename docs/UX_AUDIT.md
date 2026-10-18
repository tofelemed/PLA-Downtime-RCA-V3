# Pro-Act frontend UX/UI audit and redesign proposal

Date: 2026-10-18 · Branch audited: `feat/downtime-area2-b` · Status: **proposal, nothing implemented**

**How this was produced**
- **Source:** a read-only review of `src/` (about 725 non-test `.tsx` files), the routes under `src/app/routes/`, and the backend DTOs where a UI gap depends on the API.
- **Running app:** the Docker stack at `:8070` was checked with Playwright at 1440×900 and 1024×768, signed in as `manager@acme.com` (Super administrator). Screenshots are in `.playwright-mcp/ux-0*.png`.

**Evidence labels**
- **[V]** verified in code or on screen.
- **[I]** inferred, not run.
- **[Q]** needs an SME or product decision; record the answer in `plans/DECISIONS.md`.

No business rules, calculations, API contracts or status transitions are changed by this proposal. Where a fix needs an API change, it is called out.

---

## 0. Executive summary

The frontend is in better shape than a typical internal tool:
- There is a real UX kit (`src/features/ux-kit/`) with `Page`/`PageHeader`, `DataTable`, `DataState`, `ConfirmDialog`, `Quantity`, `PlantTime`, `DurationText` and `IconButton`.
- Adoption of the kit is high: 109 files use `DataState`, 98 use `DataTable`, and 38 use `ConfirmDialog`.
- Routes are lazy-loaded.
- Business numbers come from the server.
- Units, plant timezone and USD/IRR are handled consistently.
- There is no `any`, `console.log` or `Math.random` in product code.
- The large legacy files (`EventHub.tsx`, `PlanDashboard.tsx`, `RCAModule.tsx`, `StorageService.ts`) are gone. CLAUDE.md is stale on this point.

The problems are not in individual widgets. They are in **flow and trust**:

1. **The three modules are islands.** A loss line cannot open its downtime event; an event does not show its loss or link to its period; an RCA case hides its triggering event on the fifth tab. *Event → RCA* is the only link that works well.
2. **Key facts are missing at the point of decision.**
   - Equipment (asset) cannot be set on an event.
   - Loss lines don't show their reason code or how the quantity was derived.
   - Reconciliation shows 9 figures instead of an equation that visibly balances.
3. **Consequential actions are inconsistent.**
   - Period **Approve** fires on one click.
   - **Month lock**, which is irreversible, is styled like a routine step.
   - RCA workflow moves that lock the team or freeze the verdict have no confirmation.
   - Meanwhile, low-risk deletes do ask for confirmation.
4. **The shell is not robust or responsive.**
   - No error boundary is mounted, so a render error blanks the app.
   - The sidebar is a fixed 240/64 px at every width, with no drawer.
   - The sidebar has 33 items, and the Downtime and PLA pages appear both in the sidebar and as in-page tabs.
5. **Status and terminology drift.**
   - "Running" is the label for an *open stop*.
   - Durations appear as `126:19`, `59:04` and `Running 3,544 min` on the same screen.
   - The reconciliation remainder has five names.
   - Actions, recommendations and tasks are three separate models.
   - Every row in My Queue is red twice.

---

## 1. Frontend inventory

### 1.1 Shell
| Piece | File | Notes |
|---|---|---|
| App / routes | `src/App.tsx:55-70`, `src/app/routes/{overview,production,production-planning,reliability,integration,administration,dev}.tsx` | About 95 protected paths, all lazy (`lazyNamedWithPreload`). The route guard checks only that a session exists. |
| Layout | `src/components/Layout.tsx` | Skip link; focus moves to `<main>` on navigation; `<aside>` (`:57-64`) has no responsive classes. |
| Header | `src/features/shell/app-header.tsx` | Brand ("Traverse Forge", fallback initials "TF"), PlantSelector (org › plant), Live indicator, USD/IRR, notifications, user badge (legacy role). |
| Sidebar | `src/features/shell/app-sidebar.tsx`, `sidebar-group.tsx`, `sidebar-link.tsx`, `src/features/auth/navigation-items.ts` | 7 groups, 33 items for a super admin; the active match is by prefix (`:158-162`). |
| 404 | `src/pages/NotFound.tsx` | Rendered outside the Layout, so there is no sidebar or way back. |

### 1.2 Navigation as it ships (super admin, verified on screen)
- **Overview:** Dashboard, Pending Approvals, Reports.
- **Production:** Event Hub, Plans/Profiles & Calendars, My Queue, Month Close, Measurement Uncertainty.
- **Downtime Analysis:** Overview, Stops & Timeline, Causes & Pareto, Trends & Comparisons, Reliability.
- **PLA:** Overview, Loss Breakdown, Trends, OEE, Reconciliation & Data Quality, Loss Valuation.
- **Reliability:** RCA Analysis, Bad Actors, Knowledge Base, Tasks.
- **Integration:** Connectivity, Source Status Rules, Source Priority, Enhanced Historian.
- **Administration:** Equipment Setup Guide, Master Data, Finance, User Management, Admin Panel, Audit Logs.

### 1.3 Module coverage
| Module | Main routes | Feature folder | Coverage |
|---|---|---|---|
| Dashboard | `/dashboard` | `pla-analytics/dashboard/` | OEE, downtime, top assets, RCA tiles. |
| Downtime: operational | `/events`, `/events/new`, `/events/:id`, `/events/:id/edit`, `/events/rca-triggers` | `event-hub/` | List, current stops, code, bulk code, split, merge, retract, verify, conflicts. |
| Downtime: analysis | `/downtime`, `/downtime/{stops,causes,trends,reliability}` | `downtime-analysis/` | KPIs, timeline, Pareto, trends, MTBF. |
| PLA: accounting | `/planning`, `/plans/:id`, `/plans/:id/periods/:pid/*`, `/my-queue`, `/month-close`, `/approvals` | `plan-dashboard/`, `plans-profiles-calendars/`, `month-close/`, `approvals/` | Period grid, period workspace, loss-line editor, submit/approve/reject, SLA, month close. |
| PLA: analysis | `/pla-analytics`, `/pla-analytics/{losses,trends,oee,reconciliation,valuation}`, `/reports` | `pla-analytics/` | Waterfall, loss tree, OEE, reconciliation, valuation, exports. |
| RCA | `/rca`, `/rca/new`, `/rca/:caseId/{evidence,analysis,actions,links,definition}` | `rca/` | 9 analysis tools saved to the backend; server-gated workflow; links; outcome. |
| Actions | `/tasks`, `/tasks/new`, `/tasks/:id` | `tasks/` | Generic tasks; RCA recommendations are copied in once. |
| Reliability | `/reliability/bad-actors`, `/rca-knowledge-base` | `rca/bad-actors`, `rca-knowledge/` | |
| Integration / admin | `/connectivity/*`, `/enhanced-historian`, `/master-data/*` (26 sub-pages), `/finance/*`, `/users/*`, `/admin/*`, `/audit` | various | Out of scope except for shared patterns. |

### 1.4 Shared kit (reuse these; don't add new ones)
- **Pages:** `ux-kit/page-layout/` provides Page, PageHeader and Section; PageHeader is used in 63 files plus wrappers.
- **Tables:** `ux-kit/data-table/` provides DataTable, VirtualDataTable and the pager (keyset).
- **States:** `ux-kit/data-state.tsx` and `dataStateOf(query)` map loading, empty, error, `no-permission` and `source-offline`.
- **Dialogs:** `ux-kit/confirm-dialog.tsx` (supports `destructive` and `textRequired`).
- **Formatting:** `ux-kit/format/*`, `<Quantity>`, `<PlantTime>`, `<DurationText>`, `useNumberFormat`, `money-format.ts`.
- **Inputs:** `ux-kit/date-inputs/*`, `reason-code-picker/`, `debounced-search-input.tsx`.
- **Context:** `ux-kit/scope-header.tsx` shows scope, timezone, as-of time and provisional/approved status.

### 1.5 Roles (`server/pro-act-backend/src/auth/roles/role-model.ts`, `src/features/auth/capabilities.ts`)
- **Scope roles:** manager_approver, production_accountant, quality_approver, metrology_approver, finance_approver/maintainer, production_engineer, reliability_engineer, integration_admin, master_data_admin, operator, viewer.
- **Legacy roles** map onto the scope roles.
- **Menu per role:**
  - Operators see Dashboard, Approvals, Event Hub, all Downtime and PLA pages, and Tasks.
  - Every other role also sees planning, RCA and admin-ish pages.
  - Connectivity, Users, Admin and Audit each have their own gate.

---

## 2. User journey maps

**Persona mapping**
| Persona in the brief | Role in the app |
|---|---|
| Production / operations engineer | production_engineer |
| Shift supervisor | operator, or production_engineer on shift |
| Process engineer | production_engineer |
| Reliability engineer / RCA facilitator | reliability_engineer |
| Plant manager | manager_approver |
| Accountant | production_accountant |
| Admin | integration_admin / master_data_admin / TenantAdmin |

Friction points are tagged with the finding IDs from §3.

### J1. Shift supervisor: "what is down now, and is it coded?"
| # | Step | Screen / file | Friction |
|---|---|---|---|
| 1 | Open the Event Hub | `/events`: `event-hub/event-hub-page.tsx` | At 1024 px the first event row starts at about 590 px; header buttons include admin-only "RCA trigger settings" (E-L2). |
| 2 | See current stops | `CurrentStopsPanel` | Elapsed time shows as `59:04` with no unit (C-3); the stop is labelled **"Running"** (A-4). At 1024 px the panel drops below the table [V]. |
| 3 | Leave the hub open through the shift | `use-event-hub-state.ts:29-31` | The "Last 24 h" window is frozen at page open, so new stops stop appearing in the table (A-5). |
| 4 | Code a stop | Inline **Code** → `code-event-dialog.tsx` | Good. But coding one row clears a multi-row selection, and after a bulk apply the selection is not cleared (E-6). |
| 5 | Set the equipment | `event-form-fields.tsx` | **Not possible**: the form has no asset field (A-1). |
| 6 | Close the stop | `close-stop-dialog.tsx` | The required "Why" field is unmarked, and the disabled submit gives no reason (H-5). |
| 7 | Verify the shift's coding | `plan-dashboard/coding/coding-gate-panel.tsx` | "Verify this shift's stops" acts without listing the stops; the "N uncoded" count is not a link (E-7). |

### J2. Production engineer: "where did we lose output this week?"
| # | Step | Screen | Friction |
|---|---|---|---|
| 1 | Open the Dashboard | `/dashboard` | Five KPI tiles each print "Not available: different oee policies: not combined" in 28 px type [V, `ux-01`] (C-4). "No asset recorded" ranks #2 among the most-stopped assets. |
| 2 | PLA Overview | `/pla-analytics` | The waterfall bars have no value labels or y-axis unit. "16 slices left out (figure unknown): Actuals missing" is in small grey text below the chart [V, `ux-03`] (D-8). |
| 3 | Drill into the largest loss | Loss Breakdown, `loss-table.tsx` | Rows and bars are not clickable; the only drill is a generic Downtime link that drops the reason filter (D-6). |
| 4 | Open the stops behind it | Downtime → event | Back returns to the Event Hub, not to the analysis page with its filters (B-4). |
| 5 | See the loss for this event | Event detail | No quantity or value shown; the impacted periods are not links (G-2). |

### J3. Accountant / plant manager: "reconcile and approve a shift"
| # | Step | Screen | Friction |
|---|---|---|---|
| 1 | Find the period | Production → Plans/Profiles & Calendars → plan → small "Periods" link → grid | Three hops, and it isn't in the PLA menu group (B-5). In a long plan there is no date jump, residual filter or previous/next (D-5). |
| 2 | Read the period | `period-workspace.tsx` → `reconciliation-summary.tsx` | Nine figures, no visible identity (D-3). A second "run ledger" block shows different Attributed and Residual values right below it (D-9). |
| 3 | Review the loss lines | `editor/candidate-row.tsx` | No reason code (D-1), no derivation (D-2), "from a recorded event" is not a link (G-1). |
| 4 | Submit | Review & close section | Submit sits in a different section from the editor (D-10). |
| 5 | Approve | `workflow/workflow-bar.tsx:36` | **One click, no summary, no comment** (A-6). |
| 6 | Close and lock the month | `month-close/components/close-actions.tsx:51` | The irreversible lock is not marked destructive (A-7); the locked state is invisible on the period page, which still offers "Unlock (revise)" (D-7). |
| 7 | My Queue | `/my-queue` | Every row shows a red "Escalated to you" and a red "Overdue"; there is no row action and no grouping [V, `ux-07`] (C-5). |

### J4. Reliability engineer: "investigate the repeat die-plate blockage"
| # | Step | Screen | Friction |
|---|---|---|---|
| 1 | Find events that need an RCA | Per-event `event-rca-panel.tsx` only | No queue of open recommendations (F-1). |
| 2 | Create a case from the event | `/rca/new?eventId=` → `event-case-section.tsx:59` | The form starts blank: no title, problem statement, asset, times or duration shown. Back goes to `/rca`, not the event (F-2). |
| 3 | Define, add evidence, analyse | `/rca/:id/*` | Good tool coverage, saved to the backend. But only the definition editor guards unsaved work (F-6), and 5-Why silently overwrites the root cause by default (F-8). |
| 4 | Plan actions | `rca/actions/action-form.tsx:59` | The owner is always "you"; actions can't be edited after creation; no overdue marker (A-8). Recommendations, actions and tasks are three models (F-3). |
| 5 | Accept / request closure / approve | `workflow/move-controls.tsx` | No confirmation for moves that lock the team or freeze the verdict (F-5); no status stepper (F-4). |
| 6 | Trace back to the event and loss | Fifth tab, "Links & outcome" | Hidden; no unlink; links are added by pasting a raw reference (G-3). |
| 7 | Case list | `/rca` [V, `ux-04`] | No owner, linked event or action-progress column; every status and priority badge is the same grey. |

---

## 3. Findings

**Severity**
- **Critical:** blocks a core task or risks wrong or irreversible data.
- **High:** frequent friction or a trust gap.
- **Medium:** noticeable friction.
- **Low:** polish.

**Effort:** S is under 1 day, M is 1–3 days, L is more than 3 days or needs backend work.

### A. Critical usability and workflow problems

| ID | Where | Current behaviour → problem | Sev | Fix and approach | Deps | Eff |
|---|---|---|---|---|---|---|
| A-1 | Downtime · `/events/new`, `/events/:id/edit` · `event-hub/model/event-form.ts:16-36`, `components/event-form-fields.tsx:78-125` | No asset field [V]. The backend accepts `assetId` on create and patch (`production-event-v2-write.dto.ts:61`). Manual stops can't be attributed to equipment and a wrong MQTT asset can't be fixed. Bad actors, MTBF and the asset Pareto lose those stops; "No asset recorded" is the #2 most-stopped "asset" on the dashboard [V]. | Critical | Add an asset picker scoped to the selected unit (reuse `useAssetOptions`, as `origin-fields.tsx:25` does). Send `assetId`; feed it to `FailureFields`. | None. Whether a source-owned asset may be overridden follows the existing override rules (E-5). | S–M |
| A-2 | Shell · `src/App.tsx` | `components/ui/ErrorBoundary.tsx` is never imported [V]. A render error or a failed chunk load blanks the whole app with no recovery. | Critical | Move it into `ux-kit/errors/`; mount one per route inside `Layout` with "Reload" and "Go to dashboard" plus the support reference. Catch chunk-load errors and offer a reload. | None | S |
| A-3 | PLA ↔ Downtime · `plan-dashboard/editor/candidate-row.tsx:38`, `manual-lines.tsx:22`, `evidence-picker.tsx:108` | "from a recorded event" and "N linked event(s)" are plain text, though `causeEventId` is available. Approvers can't verify the evidence behind a loss. | Critical (traceability) | Render them as `Link`s to `/events/:id` with back-navigation state (the pattern in `pla-analytics/tabs/loss-events.tsx:68`). | None | S |
| A-4 | Downtime · `event-hub/model/event-states.ts:18`, `ux-kit/labels/event-labels.ts:25` | An open stop is labelled **"Running"** [V], so the screen shows "Downtime · Running 3,544 min". On a plant floor "running" means producing. | High (safety of reading) | Relabel the state `open` → "Ongoing" ("Ongoing 3,544 min" → "Ongoing 59 h 04 min"). Keep the state values; merge the two label maps into one (E-L5). | Confirm the wording with the SME [Q] | S |
| A-5 | Downtime · `use-event-hub-state.ts:29-31`, `model/event-filters.ts:154-157` | "Last 24 h" is frozen to page-open time plus 1 h and stored in the URL. A hub left open through a shift silently stops showing new stops. | High | Store relative presets as `window=24h` with no `from/to`, and resolve them on every fetch and realtime notice. Show the resolved range next to the label. | None | M |
| A-6 | PLA · `plan-dashboard/workflow/workflow-bar.tsx:36`, `plans/approve-plan-version.tsx:65` | Approve calls `actions.approve()` directly [V]; the optional `comment` in `use-workflow-actions.ts:75` is never sent. Reject, Cancel and Unlock all use dialogs. | High | `ConfirmDialog` with a summary (revision, residual state, attributed total from the server view) and an optional comment field. | None | S |
| A-7 | PLA · `month-close/components/close-actions.tsx:51` | **Lock month** ("never reopened") uses neither `destructive` nor `textRequired`; the reversible Reopen does. | High | `destructive` plus typed confirmation of the month key; state "cannot be undone". | None | S |
| A-8 | RCA · `rca/actions/action-form.tsx:54-59`, `action-row.tsx` | Owner is always the creator [V]; title, due date and owner can't be edited; no overdue marker; owners see "Mark done", which the server refuses (403). | High | Owner picker (`useAssignableUsers`; the backend already validates `ownerId`); edit form; "Overdue" badge with icon and text; hide "Mark done" for the owner and explain why. | None for owner and edit. A cross-case list needs an endpoint (F-7). | M |

### B. Navigation and information architecture

| ID | Where | Current → problem | Sev | Fix | Deps | Eff |
|---|---|---|---|---|---|---|
| B-1 | Sidebar · `navigation-items.ts` | 33 items in 7 groups. The Downtime (5) and PLA (6) pages also appear as in-page tabs (`analysis-navigation/analysis-page-nav.tsx`) [V]. Two items are both called "Overview"; long labels are truncated ("Plans, Profiles & Cale…", "Measurement Uncert…") [V]. | High | One sidebar entry per module; sub-pages only as in-page tabs. See the proposed IA in §4. | None | M |
| B-2 | Sidebar · `navigation-items.ts:158-162` | Prefix matching highlights both "Connectivity" and "Source Status Rules" on `/connectivity/source-status`. | Medium | Longest-match-wins; add those paths to the nav tests. | None | S |
| B-3 | Shell · `components/ui/breadcrumb.tsx` (unused) | No breadcrumbs; detail pages have one back link. Deep pages (`/plans/:id/periods/:pid/adjustments/new`, `/rca/:id/analysis/five-why`) lose their place. | Medium | Add a `breadcrumbs` prop to `PageHeader` (Module › Record › Sub-page), built from route data, not typed per page. | None | M |
| B-4 | Downtime · `event-hub/hooks/use-back-target.ts:9-11` | Back only allows `/downtime` and `/events` [V]. From `/downtime/stops`, `/downtime/causes`, `/pla-analytics/losses` or `/rca/:id` it falls back to the Event Hub and loses the filters. | High | Allow every path in `DOWNTIME_PAGES`, `PLA_PAGES` and `/rca/:id` with matching labels; keep the character checks; extend `use-back-target.test.ts`. | None | S |
| B-5 | PLA · `navigation-items.ts:65-72,101`, `plans-tab.tsx:49` | Period accounting, the core PLA work, sits under Production → Plans, Profiles & Calendars → plan → "Periods". The PLA group contains only analytics. | High | A "Period accounting" entry in the PLA module that opens the period grid for the selected unit's current plan. | [Q] Which plan is "current" when several are active? | M |
| B-6 | Shell · `App.tsx:61-68`, `pages/NotFound.tsx` | 404 renders outside the Layout. The dev "Data Seeding" item points to a missing route. | Low | Render the 404 inside the Layout for signed-in users; remove the dead item. | None | S |
| B-7 | Shell · routes | No route-level capability guard. Typing `/finance` or `/month-close` without the role shows a page frame with per-section 403 alerts. | Medium | `requires: capability` on route definitions; render one `PageGate` denied page. The server stays authoritative. | None | M |
| B-8 | Shell · global period | Each screen has its own window picker (`WindowSelect`, `PeriodSelectionFilters`, `DateRangeInput`). `analysisHref` carries the period only between the Downtime and PLA pages. | Medium | One shared "analysis context" (units, from/to, window) in the URL, passed by every cross-module link (dashboard → events → PLA → reports). | None | M |
| B-9 | Header · `index.html`, `use-document-title.ts:4`, `app-header.tsx:12` | The product is "Traverse Forge" in the UI and "Pro-Act" in the docs. Two effects race to set the tab title (`Layout.tsx:24` vs `PageHeader`). | Low | [Q] Confirm the product name; read it from branding in one place; let only `PageHeader` set the title. | Product decision | S |

### C. Visual consistency and design system

| ID | Where | Current → problem | Sev | Fix | Eff |
|---|---|---|---|---|---|
| C-1 | `tailwind.config.ts`, `src/index.css` | Tokens exist only for the shadcn basics; there is **no success, warning, info or chart token**. About 111 hard-coded palette classes across 36 files (amber 49, used as an unofficial "warning"); raw `hsl()` in 6 chart files. | High | Add `--success/--warning/--info/--neutral` (with `-foreground`) and `--chart-1..8`, plus `--state-running/-stopped/-planned/-idle`. Replace hard-coded colours file by file, starting with `state-badges.tsx`, `task-badges.tsx` and `tone-badge.tsx`. | M |
| C-2 | Badges (≥15 local implementations; `VersionStateBadge` duplicated in `finance/` and `plans-profiles-calendars/`) | Tone vocabularies conflict (`ok/busy/idle/warning/error` vs `neutral/active/warning/success/muted`). On the RCA list every status and priority is grey; only the header pill marks "Critical" [V]. | High | One `ux-kit/status-badge.tsx` with tone = `neutral\|info\|success\|warning\|danger` and an optional icon. Domain maps (event, period, case, action) live in `ux-kit/labels/*`. Delete the duplicates. | M |
| C-3 | Durations | One screen shows `126:19`, `59:04` and `Running 3,544 min` [V, `ux-02`]. `clock` format can be read as min:s. | High | One rule: under 1 h → "42 min"; 1–48 h → "3 h 25 min"; over 48 h → "2 d 11 h". Never bare `h:mm`. Exact seconds in the tooltip. Change the `DurationText` default and remove `clock` from KPI tiles. | S |
| C-4 | Dashboard KPI tiles · `components/oee-tile.tsx`, `dashboard/*` | An unavailable value prints the full server reason in the value slot at headline size; repeated 5× it dominates the page [V]. | Medium | Value slot shows "—" plus a small "Not available" label; the reason goes in a one-line caption or info tooltip; when all four OEE parts share the reason, show it once for the group. | S |
| C-5 | My Queue · `/my-queue` | Every row has a red "Escalated to you" and a red "Overdue" [V], so nothing stands out. | Medium | Escalation as a neutral or info chip; red reserved for overdue; group by due bucket (Overdue / Today / Later); add an "Open" row action. | S |
| C-6 | Dark mode | `.dark` is commented out (`index.css:60-96`) but 23 `dark:` classes remain. | Low | [Q] Decide whether dark mode is needed (control rooms often want it). If yes, build it on the new tokens; if not, remove the dead classes. | S/M |
| C-7 | Unit-state colours | `master-data/.../state-timeline.tsx:6-14` and `downtime-analysis/components/state-timeline.tsx:18,103` draw the same states in different colours. | Medium | Both use the `--state-*` tokens from C-1. | S |
| C-8 | Forms | 8 local `Field` components with different required-marker conventions (visible `*`, sr-only text, label text, placeholder only). | Medium | One `ux-kit/form-field.tsx` (label, required marker = visible `*` plus sr-only "required", hint, error with `aria-describedby`, `aria-invalid`). Migrate opportunistically. | M |
| C-9 | Data density | Event Hub rows stack 3 badges vertically (about 95 px per row) [V]. | Medium | One composite state cell ("Ongoing · Uncoded · No RCA" as inline chips), giving about 44 px rows; a density toggle if requested. | S |
| C-10 | Unit names | Tables show raw unit codes `unit100`/`unit200` [V] while RCA titles say "Extruder Line 1". | Medium | Display unit name with code secondary. [I] It may be a seed-data naming issue; check the master data. | S |

### D. PLA-specific

| ID | Where | Current → problem | Sev | Fix | Deps | Eff |
|---|---|---|---|---|---|---|
| D-1 | `editor/candidate-row.tsx:34-40`, `manual-lines.tsx:46-49` | Lines don't show their reason or impact code, though `reasonCodeId` and `impactCodeId` are in `CandidateView`. Approvers sign off on lines that look uncoded. | High | Resolve the code names (the `ReasonSelect` hook); show them on every line; amber "Not coded" chip. | None | S |
| D-2 | `candidate-row.tsx:37`, `waterfall-chart.tsx:29` | The basis is a humanized token; there are no derivation inputs, `effectiveQuantity` is never shown, and bar tooltips show only the delta. | High | Render "2 h 05 min × 6.0 t/h = 12.5 t" **from server-provided fields**. | API change: add derivation inputs to `CandidateView`, update the OpenAPI snapshot | L |
| D-3 | `components/reconciliation-summary.tsx:9-34` | A flat grid of 9 figures; the identity exists only in a code comment. | High | Equation row from server values: `Target − Actual = Gap = Attributed + Tolerance adj. + Residual`. Residual carries a text state ("Within tolerance" or "Unaccounted"), not just red. Secondary "Checks" row for over-accounted, overproduction and threshold. | None | S |
| D-4 | `period-grid.tsx:53` vs `reconciliation-summary.tsx:21` | Grid copy says "residual = gap − attributed" and omits the tolerance adjustment. | Medium | Fix the copy or add a "Tolerance adj." column from the server. | None | S |
| D-5 | `period-grid.tsx:25-27`, `period-page.tsx` | Only workflow and revision filters; 20 per page; no jump to a date, residual filter or previous/next shift. A year with 3 shifts a day is about 1,100 rows. | High | "Go to date", an "Unaccounted only" filter, and ◀ ▶ previous/next shift in the period header. | Residual filter may need a query parameter | M |
| D-6 | `loss-table.tsx:94-101`, `waterfall-tab.tsx`, `reconciliation-tab.tsx:156-158`, `model/links.ts:13-18` | Analytics can't be drilled into; the Downtime link drops the reason and kind filter; count badges are not links. | High | Rows and bars link to loss events or downtime filtered by reason or kind; count badges link to the period grid filtered by state. | Downtime may need a reason filter in the URL (check) | M |
| D-7 | `workflow-bar.tsx:78-81`, `period-history.tsx:52` | A locked month is invisible on the period page; "Unlock (revise)" is offered and then refused by the server. "Unlock" is easily confused with the month lock. | Medium | "Month locked" banner from the server; offer "Propose correction" instead; rename the button to "Reopen for revision". | Needs the lock flag on the period view (check) | M |
| D-8 | `waterfall-chart.tsx:12-27`, `waterfall-tab.tsx:78` | No legend, y-axis unit or bar values; 10 px ticks overlap; the missing-actuals warning is in grey fine print under the chart [V]. | Medium | Y-axis label with unit; value labels on bars; legend (Loss / Gain / Total); warning moved above the chart as an `Alert` ("16 periods have no actuals — totals are incomplete") linking to the filtered grid. | None | S |
| D-9 | `ledger-comparison.tsx:80-85` | Run-ledger figures (before decisions) sit right under the reconciled figures with similar labels. | Medium | Collapse them into `<details>` titled "Raw calculation (before loss-line decisions)". | None | S |
| D-10 | `period-workspace.tsx:44-70` | Submit lives in a different section from the editor. | Medium | Compact sticky workflow bar (state, Submit, blockers) visible in every section. | None | S |
| D-11 | `loss-line-editor.tsx:159`, `manual-lines.tsx:51` | "Discard changes" drops every unsaved decision in one click. | Medium | `ConfirmDialog` stating "N changes will be lost". | None | S |
| D-12 | `loss-line-editor.tsx:182`, `close-actions.tsx`, `month-nav.tsx:14` | Raw `${quantity} ${uom}`; raw month key `2026-09` (ignores the Jalali preference, which breaks the learned date-format rule). | Low | `<Quantity>`; a plant-month formatter. | None | S |
| D-13 | PLA overview filter bar [V, `ux-03`] | Window select plus From/To inputs plus Plan/Capacity radio plus Approved only, spread over two rows; date inputs show `11/10/2026` (browser locale) while the rest of the app shows `2026-10-15`. | Medium | Use `DateRangeInput` with plant format; put the window presets inside the range control; put the ledger and approved toggles in one segmented control. | None | S |

### E. Downtime-specific

| ID | Where | Current → problem | Sev | Fix | Eff |
|---|---|---|---|---|---|
| E-1 | `event-columns.tsx:139-157`, `event-filters.ts:93` | No asset or origin column; fixed newest-first order; no minimum-duration filter. | Medium | Add Asset and Origin (manual/source) columns and a sort toggle. Duration sort and a minimum-duration filter need API parameters [Q]. | S / L |
| E-2 | `window-select.tsx:31-36` | Four presets only; shifts only for a single unit over 3 days; no custom range or "current shift". | Medium | Custom range (`DateRangeInput`) plus "Current shift"; explain why shifts are hidden. | S |
| E-3 | `event-form-page.tsx:42`, `event-form-fields.tsx:84,115-119` | The edit page title is generic and the unit is hidden; the reason code (the main task) is below failure details; "Investigation pending" is missing from edit and bulk. | Medium | Header "Unit 100 · Stop from 2026-10-15 22:39"; reason first; add investigation pending (the DTO already supports it). | S |
| E-4 | `event-form-fields.tsx:99-103`, `event-form.ts:65,156-160` | End and duration can be entered two ways; duration starts empty on edit; minutes only (4,320 for 3 days); typing a duration clears the end. | Medium | Show the server duration read-only; explicit radio "End time / Duration"; accept `h:mm` or `2d 3h`. | S |
| E-5 | Form vs `sourceKind` | Source-owned fields are editable and refused only on save. | Medium | Mark fields "From source (PI/MQTT)" with an explicit "Override…" action, using server metadata. | M |
| E-6 | `event-list-dialogs.tsx:31-36` | Bulk apply leaves a stale selection (the next bulk run fails on row versions); single-row Code clears the selection. | Medium | Clear after bulk; keep the selection on single-row actions. | S |
| E-7 | `coding-gate-panel.tsx:21,37` | Shift-wide verify acts without showing the stops; "N uncoded" is not a link; no "coded, not verified" filter. | Medium | Link the counts to the filtered `/events`; preview the list or count before verifying; add a verification filter (API parameter). | M |
| E-8 | `split-dialog.tsx:22-26,54` | The split time is set only with a 1-minute slider; a multi-day stop has thousands of steps. | Medium | Add a `DateTimeInput` synced with the slider. | S |
| E-9 | `use-event-form.ts:17-21`, `event-draft.ts:22` | An old "new event" draft overrides `?unitId=` context. | Medium | Expire after 12 h; ask "Resume draft or start new?" when the unit differs. | S |
| E-10 | Terms · `event-states.ts:27`, `event-detail-tabs.tsx:48`, `event-verification-panel.tsx:61` | "Reviewed" (chip), "Review" (source-conflict tab) and "Verify coding" mean three things. | Medium | Rename the tab "Source conflicts"; show verification as a chip. [Q] Meaning of `reviewed` vs verified. | S |
| E-L | Low | (L2) "RCA trigger settings" shown to everyone, so gate it by capability. (L3) 4 tab stops per row, so drop the row tabindex. (L4) Raw checkbox; "Code stop" title on non-stop events. (L5) Two label maps. (L6) Generic empty text under "To code" ("All stops in this window are coded"); "42 calculation runs" jargon on the KPI. (L7) No "now" quick-fill for the start time. | Low | S each |

### F. RCA-specific

| ID | Where | Current → problem | Sev | Fix | Deps | Eff |
|---|---|---|---|---|---|---|
| F-1 | `rca/pages/rca-list-page.tsx`, `api/v2/queries/rca-cases.ts:163` | No queue of open RCA recommendations; they are visible only per event. | High | "Recommended" tab on `/rca` using `GET /v2/rca-recommendations?state=open` (the backend already filters by state and unit), with Create/link and Dismiss. | None | M |
| F-2 | `rca/pages/event-case-section.tsx:59`, `components/evidence-view.tsx` | A case from an event starts blank; the event's asset, unit and times are not shown; Back goes to `/rca`. | High | Event header card; prefilled editable title and problem statement ("Unit 100 · Die plate blockage · 2026-10-15 22:39, 59 h"); Back → `/events/:id`. | [Q] Should priority derive from impact? | S |
| F-3 | `model/recommendation-form.ts`, `actions/*`, `tasks/*`, `model/task-payload.ts` | Three action models with different status vocabularies; tasks are one-time copies; the Overview progress counts recommendations while closure depends on verified actions. | High | [Q] **Decision needed** on which is the corrective-action record. Proposal: recommendations are proposals → promoted to tracked actions; tasks link to actions instead of copying. Meanwhile, make the progress step count actions. | SME decision | L |
| F-4 | `workflow/workflow-panel.tsx:47-53`, `overview/overview-page.tsx:11-31`, `model/case-progress.ts:50` (unused) | Status (6 values) and a 5-step content checklist compete; the panel shows the raw status. | Medium | Horizontal stepper Draft → In progress → Analysis → Monitoring → Closure review → Closed in the case header; checklist items as hints under the current step; `statusLabel()` everywhere. | None | M |
| F-5 | `workflow/move-controls.tsx:36,47-54` | Accept (locks the team), Request closure (freezes the verdict) and Approve closure run on one click. | Medium | `ConfirmDialog` stating the consequences. | None | S |
| F-6 | `evidence-form-page.tsx`, recommendation and action forms, all 6 record tools, `tool-record.tsx:47` | No unsaved-changes guard; the editor is keyed on `record.id`, so a concurrent save leads to a conflict whose only exit is a reload that loses the edits. | Medium-High | Shared `useUnsavedChangesGuard` (router `useBlocker` plus `beforeunload`) and a "Saved / Unsaved" indicator; key on `rowVersion`; "Reload latest and keep my text" on conflict. | None | M |
| F-7 | Action tracking | No cross-case "My RCA actions"; the dashboard overdue tile links only to `/rca`. | High | "My actions" view (`/rca/actions?owner=me&overdue=1`). | Needs a list endpoint | L |
| F-8 | `case/analysis/tools/five-why-tool.tsx:63-67` | "Also set as the case root cause" is checked by default and overwrites an existing root cause; the two saves fail ambiguously. | Medium | Default unchecked when a root cause exists; show the current value; report the two results separately. | None | S |
| F-9 | `action-row.tsx:28-40`, `fault-tree-tool.tsx:53`, `five-why-tool.tsx:31`, `tasks/components/task-columns.tsx:133-147`, `case-header.tsx:95` | Cancelling an action (via a native select), removing a fault-tree subtree and Mark complete are not confirmed. Delete is shown on linked cases the server always refuses (409). | Medium | Confirm with a reason; hide Delete when links exist. | None | S |
| F-10 | `case/analysis/event-diagram-tool.tsx:82-100` | Connections can only be created by dragging; fixed 520 px canvas; fault tree drawn as a flat list. | Medium | "Add connection" dialog; label the canvas region; indented fault tree like `LogicNodeItem`. | None | M |
| F-11 | `evidence-fields.tsx:48-77` | Evidence tasks have no assignee or overdue flag; "Verified" is an unattributed checkbox. | Low-Med | Assignee plus overdue chip; [Q] record who verified? | Possible API | M |
| F-12 | `/rca` list [V, `ux-04`], `pages/case-table.tsx:20-37` | No team lead, linked event, action progress or overdue columns; badges all grey. | Medium | Add Lead, Trigger (event link), Actions "3/5 · 1 overdue" (from the server summary) columns; tone-coded status and priority via C-2. | Action counts per case may need the API | M |

### G. Cross-module workflow

| ID | Where | Current → problem | Sev | Fix | Deps | Eff |
|---|---|---|---|---|---|---|
| G-1 | Loss line → event | See A-3. | Critical | — | — | S |
| G-2 | Event → loss · `event-summary.tsx:36-50`, `impacted-periods-preview.tsx:38-47` | The event page shows neither lost quantity nor value (`quantity/cost/value` exist on the view but aren't rendered); impacted periods aren't links. | High | (a) link each impacted period to `/plans/:id/periods/:pid`; (b) an "Attributed losses" card from a **server** per-event impact field. | (b) needs an API field and an OpenAPI update | S / L |
| G-3 | RCA → event/loss · `case/case-header.tsx:73-99`, `links/add-link-form.tsx:37-41` | The trigger event and approved loss are only on the fifth tab; links are added by pasting a raw reference; no unlink. | Medium-High | Show "Triggered by: [event link] · Approved loss 412 t / $38k" in the case header; pickers for events, loss lines and occurrences. [Q] Is unlinking allowed? | Unlink needs a backend endpoint | M |
| G-4 | Loss/event → RCA | No "RCA" badge on loss lines or events in analytics; only the event detail has the panel. | Medium | RCA chip (state plus link) wherever an event appears: loss lines, drill lists, bad actors. | Event view already has `rcaState` [I] | S |
| G-5 | Tasks → RCA · `tasks/components/task-columns.tsx:116` | Legacy `/rca?case=` URL, working only via a redirect. | Low | Link `/rca/:id` directly. | None | S |
| G-6 | Dashboard → everything | Tiles link to generic pages (e.g. `rca-tiles.tsx:31` → `/rca`) and drop the dashboard window. | Medium | Every tile and row deep-links with its filter and the shared analysis context (B-8). | None | S |

### H. Accessibility, responsive design and error states

| ID | Where | Current → problem | Sev | Fix | Eff |
|---|---|---|---|---|---|
| H-1 | `Layout.tsx:56-61` | Fixed `w-60`/`w-16` aside at every width; `useIsMobile` unused; no drawer. At 1024 px the sidebar takes 23 % of the width [V]. | High | Below `lg` (1024 px): off-canvas `Sheet` drawer opened from a header button; at `lg`–`xl` default to the icon rail. Reuse `ui/sheet.tsx` (don't adopt the unused 761-line `ui/sidebar.tsx`). | M |
| H-2 | Error handling ignores `isError`: `notification-bell.tsx:79` ("No notifications." on error), `hierarchy-page.tsx:40`, `plant-tree.tsx:52,71`, `policy-detail-page.tsx:29`, `task-summary.tsx:20` (skeleton forever), `rca-list-page.tsx:20` (null), `audit-page.tsx:107` | Failures look like empty data, which is false reassurance. | High | Route through `dataStateOf()`; a compact inline error with retry for small widgets. | S |
| H-3 | Silent failures: `notification-bell.tsx:53,73`, `master-data/rca/move-node-dialog.tsx:33` | Errors swallowed. | Medium | Toast via `friendlyToastContent`. | S |
| H-4 | One-click server mutations: `failure-dictionary-page.tsx:26,44` (Retire), `standby-registrations-table.tsx:26,36` (Retire), `rca/case/definition/definition-page.tsx:34,49` (Discard) | No confirmation. | Medium | `ConfirmDialog`. | S |
| H-5 | Required fields across event dialogs (close, split, merge, bulk, retract) | Unmarked; submit disabled with no explanation. | Medium | Kit `FormField` with required marker plus a helper ("A reason is required for the audit history"). | S |
| H-6 | Charts (all Recharts) | No `role="img"`/`aria-label`; audit charts and 3 `ReportCharts` have no text alternative. | Medium | `figure` + `figcaption` summary + "View as table" disclosure (the pattern `waterfall-tab.tsx` already uses). | S |
| H-7 | Tiny text: 9 × `text-[10px]/[11px]` (kpi-summary, user-badge, rca-tiles, oee-tile, notification-bell, login); chart ticks 10 px | Below comfortable reading size on shop-floor screens. | Low-Med | Minimum 12 px (`text-xs`); chart ticks 11–12 px. | S |
| H-8 | Raw tables without overflow: `budget-result.tsx:41`, `waterfall-panel.tsx:36`, `ledger-comparison.tsx:44`; `virtual-data-table.tsx:91` only sets `overflowY` | Horizontal clipping on narrow screens [I]. | Low | Wrap in `overflow-x-auto`. | S |
| H-9 | Raw ISO date `failure-dictionary-page.tsx:24` (`slice(0,10)`) | Ignores the Jalali and digit preferences (learned rule). | Low | `<PlantTime>` / `formatDate`. | S |
| H-10 | Row keyboard model · `ux-kit/data-table/data-table-cells.ts:63-65` | Row `aria-label` replaces cell content for screen readers; extra tab stops. | Low | Drop the row tabindex where a link cell exists; keep the cell text exposed. | S |
| H-11 | Unsaved-changes guard | Only `beforeunload` in 2 places; nothing uses `useBlocker`. | Medium | See F-6; apply to every long form (tasks, users, policies, connections, codes). | M |
| H-12 | Terminology (copy) | stop vs event (57 vs 65 strings); residual / unaccounted / unexplained / shortfall / gap; case vs RCA vs investigation; action vs task; organisation vs organization (16 vs 83); "Tenant-wide" visible to users. | Medium | Glossary in `docs/` plus `ux-kit/labels/*` as the single source. Proposal: **Stop** for downtime events and **Event** for the generic record; **Unaccounted** for the residual; **Investigation** for the RCA case; **Action** for corrective actions; US spelling; "Whole plant" not "Tenant-wide". [Q] confirm. | M |

### I. Missing capabilities vs existing UI problems

**Existing UI problems** (frontend only, no API change):
- A-1 to A-8 except the parts noted below.
- All of B except B-5's "current plan" rule.
- All of C.
- D-1, D-3, D-4, D-6, D-8 to D-13.
- E-2, E-3, E-4, E-6, E-8, E-9, E-10.
- F-2, F-4, F-5, F-6, F-8, F-9, F-10.
- G-1, G-2(a), G-4 to G-6.
- All of H.

**Missing capabilities (need backend or contract work):**
| Capability | Findings | Backend need |
|---|---|---|
| Per-line loss derivation inputs | D-2 | Extend `CandidateView`; OpenAPI update |
| Per-event attributed loss | G-2(b) | New field or endpoint |
| Cross-case RCA action list ("My actions") | F-7 | List endpoint |
| RCA link removal | G-3 | `DELETE` link endpoint plus rule [Q] |
| Event list sort by duration, minimum-duration filter, verification filter | E-1, E-7 | Query parameters |
| Residual-state filter on the period grid | D-5 | Query parameter |
| Month-lock flag on the period view | D-7 | Field (check whether it already exists) |
| Event comments / shift handover notes | — | New feature [Q] |
| Single corrective-action model | F-3 | Product decision first |

---

## 4. Recommended information architecture

The sidebar is organised by **job**, and each module has one entry with tabs inside. That takes the sidebar from 33 items to 16.

```
OPERATE
  Home                      /dashboard            (role-aware landing; see 5.1)
  Stops                     /events               (Event Hub — live + history)
  My work                   /my-queue             (periods to prepare/approve + my RCA actions + my tasks — tabs)
ACCOUNT  (PLA)
  Period accounting         /plans/:current/periods   (grid → period workspace)
  Loss analysis             /pla-analytics        tabs: Overview · Losses · Trends · OEE · Reconciliation · Valuation
  Month close               /month-close
  Approvals                 /approvals
ANALYSE
  Downtime analysis         /downtime             tabs: Overview · Stops & timeline · Causes · Trends · Reliability
  Reports                   /reports
IMPROVE  (RCA)
  Investigations            /rca                  tabs: Cases · Recommended · Actions · Bad actors · Knowledge base
CONFIGURE  (admin; collapsed by default)
  Plans & calendars · Equipment setup · Master data · Finance · Measurement uncertainty ·
  Integration (Connectivity · Source rules · Historian) · Users · Admin · Audit
```

**Rules**
- **One active item:** longest-prefix match.
- **Module tabs:** sub-pages live in the in-page tabs (`AnalysisPageNav`, `CaseNav`, which already exist), not in the sidebar.
- **Breadcrumbs:** on every page deeper than the module root.
- **Shared analysis context:** the period and units carry over through links (B-8).
- **Responsive sidebar:** drawer below 1024 px; icon rail from 1024 to 1280 px.
- **"Tasks" (generic)** moves under My work until F-3 is decided.

[Q] Grouping by job and the move of Plans & calendars to Configure need product-owner sign-off. Planners who edit plans daily may want Plans in ACCOUNT.

---

## 5. Redesign specifications (priority screens)

Each spec gives the current problem, the proposed layout, why it helps, who benefits, what to reuse, and any API dependency.

### 5.1 Event Hub `/events` (supervisor, production engineer)
**Problem:**
- The first data row starts low on the page.
- Rows stack three badges and the open state says "Running".
- Duration formats are mixed.
- There is no asset column and the window goes stale.

**Layout (1440):**
```
PageHeader: Stops                                   [Export] [+ New stop]   (RCA settings → ⋯ menu, gated)
ScopeHeader: Unit: All · Last 24 h (06:15–06:15 Asia/Tehran, live) · Provisional
Filter bar (one row): [Search] [Units] [Window ▾ incl. Current shift / Custom] [Type] [Reason] [State] [More] · Reset
┌ Current stops (2) — horizontal strip, always above the table ───────────────┐
│ Extruder 1 · Die plate · Ongoing 59 h 04 min  [Open][Close][Code]  │ Extruder 2 · Uncoded · Ongoing 59 h 41 min ... │
└──────────────────────────────────────────────────────────────────────────────┘
Table (44 px rows): ☐ | Start | Duration | Unit | Asset | Type | Reason | State chips inline | RCA | ⋯
Selection bar (sticky when n>0): 3 selected · Bulk code · Merge · Clear
```
**Why:**
- Live stops stay visible at every width.
- About twice as many rows fit on screen.
- Every value has a unit.
- The asset is visible.

**Benefits:** supervisors and production engineers.

**Reuse:** `ScopeHeader`, `DataTable`, `StatusBadge` (C-2), `DurationText` (C-3), `WindowSelect` + `DateRangeInput`.

**API:** none, except an optional duration sort (E-1).

### 5.2 Event detail `/events/:id`
**Problem:**
- The production impact isn't shown.
- Periods and loss aren't linked.
- The asset can't be edited.
- Back loses context.

**Layout:**
- **Header:** `Unit 100 › Extruder1 gravimetric feeder · Stop 2026-10-15 22:39 → ongoing (59 h 04 min)` · state chips · primary action depends on state (Code / Close / Verify).
- **Left column:** Summary (times, reason, asset, origin "From PI/MQTT" or "Manual"), then Impact card ("Attributed in 3 periods" with links; quantity and value when the server provides them).
- **Right column:** RCA card (recommendation or linked case with status stepper mini).
- **Tabs:** Values · History · Source conflicts · Evidence · Repair · Duplicates & repeats.

**Reuse:** `event-summary.tsx`, `impacted-periods-preview.tsx` (add links), `event-rca-panel.tsx`.

**API:** a per-event impact field for the quantity and value line (G-2b); everything else is frontend only.

### 5.3 Period workspace `/plans/:id/periods/:pid`
**Problem:**
- Reconciliation doesn't visibly balance.
- Loss lines lack codes, derivations and links.
- Approve is one click, and Submit is far from the editor.

**Layout:**
```
Breadcrumb: Period accounting › Plan 2026 v3 › Unit 100 · 2026-10-14 Night        ◀ prev shift | next shift ▶
Header: state chip (Draft / In review / Approved / Month locked)  · sticky workflow bar: [Recompute] [Submit] blockers…
Balance row:  Target 1,000 t − Actual 870 t = Gap 130 t  =  Attributed 110 t + Tolerance 5 t + Unaccounted 15 t ⚠ Above tolerance
Waterfall (with unit axis + values + legend)
Loss lines table: Kind | Reason (code · name) | Event (link) | RCA chip | Basis "2 h 05 × 6.0 t/h" | Qty | Decision
▸ Raw calculation (before decisions)   ▸ Checks (over-accounted, overproduction, threshold)
```
Approve opens a confirmation with the residual state, the attributed total, the revision and an optional comment.

**Benefits:** accountants, approvers and production engineers.

**Reuse:** `reconciliation-summary.tsx` (restructured), `waterfall-panel.tsx`, `candidate-row.tsx`, `ConfirmDialog`, `Quantity`.

**API:** the derivation inputs (D-2); the balance row works with existing fields.

### 5.4 RCA case `/rca/:caseId`
**Problem:**
- The trigger and the loss are hidden.
- There is no status stepper.
- Actions can't be assigned.
- Moves aren't confirmed.

**Layout:**
- **Header:** title · status stepper (6 steps, current highlighted, next-move button inline) · priority · lead · "Triggered by: Stop 2026-10-15 22:39 Unit 100 (link) · Approved loss 412 t / $38.2k".
- **Tabs:** unchanged (Overview · Evidence · Analysis · Actions · Links & outcome).
- **Overview:** the "Needed to accept" checklist under the stepper (already good [V]).
- **Actions:** one table: Action | Owner (picker) | Due (overdue chip) | Status | Verification.
- **Danger zone:** Delete moves out of the header next to Export into an overflow menu, and is hidden when the case has links.

**Benefits:** RCA facilitators, reliability engineers and approvers.

**Reuse:** `case-header.tsx`, `workflow-panel.tsx`, `action-row.tsx`, `useAssignableUsers`, `ConfirmDialog`.

**API:** none for the header and owner (the backend already accepts `ownerId`).

### 5.5 RCA list `/rca`
**Changes:**
- Tabs: **Cases · Recommended (n) · My actions (n)**.
- Case table adds Lead, Trigger and Actions progress columns.
- Status and priority badges get tones.
- The summary chips (5 cases, Analysis 1, …) become clickable filters.

**API:** the Recommended tab needs none; My actions needs a list endpoint (F-7).

### 5.6 Dashboard `/dashboard`
**Changes:**
- **KPI tiles:** "—" plus a caption instead of the long reason; one group-level notice when the OEE policies differ.
- **Durations:** "126 h 19 min".
- **Assets table:** "No asset recorded" becomes a separate data-quality callout ("7 stops have no asset — assign") linked to the filtered `/events`. This depends on A-1.
- **Links:** every tile deep-links with the window.

**Role-aware first row:**
- Supervisor: current stops and stops to code.
- Accountant: periods due.
- Reliability: recommended investigations and overdue actions.
- Manager: approvals.

All of these come from existing endpoints.

### 5.7 My work `/my-queue`
**Changes:**
- **Tabs:** Periods · RCA actions · Tasks.
- **Periods tab:**
  - grouped Overdue / Due today / Later
  - escalation shown as a neutral chip
  - red only for overdue
  - row action "Open period"
  - unit and shift names instead of codes

### 5.8 States: the standard
| State | Pattern (kit) | Copy rule |
|---|---|---|
| Loading | `DataState loading` skeleton matching the final layout; buttons show a spinner and their label | Never blank. |
| Empty, never had data | `DataState empty` + what it means + next action | "No stops recorded for Unit 100 in this window." plus [Change window] |
| Empty, filtered | Same + [Reset filters] | "Nothing matches these filters." |
| Empty, task done | Positive copy | "All stops in this window are coded." |
| Error | Inline `FriendlyErrorAlert` + Retry + support reference; never shown as empty | "Couldn't load notifications. Retry." |
| No permission | One `PageGate` page per route | Say which role is needed. |
| Source offline / stale | `source-offline` alert above the data, with "as of" time | "Historian unavailable since 09:12 — figures may be incomplete." |
| Validation | Inline under the field (`aria-describedby`), summary at the top for server refusals | Say how to fix it, not just what's wrong. |
| Destructive / irreversible | `ConfirmDialog destructive`; typed confirmation for irreversible actions | State the consequence and whether it can be undone. |
| Render crash | Route-level `ErrorBoundary` | "This page failed to load. Reload / Go to Home." |

**Warning vs alarm:**
- **Warning (amber `--warning`):** data quality and provisional figures.
- **Danger (red `--danger`):** overdue, above tolerance, failed.
- **Never red for informational states** such as "escalated" or "provisional".

### 5.9 Screens to redesign first
1. Event Hub (5.1)
2. Period workspace (5.3)
3. Event detail (5.2)
4. RCA case header and actions (5.4)
5. Shell: sidebar IA, drawer, breadcrumbs (§4, H-1)
6. Dashboard (5.6)
7. RCA list (5.5)
8. My work (5.7)

---

## 6. Prioritized roadmap

**Wave 1: quick wins (≤ 1 sprint, frontend only, no contract change)**
- A-2 error boundary
- A-3 / G-1 loss → event links
- A-4 "Ongoing" label
- A-6 approve confirmation
- A-7 lock confirmation
- B-4 back targets
- C-3 duration format
- C-4 KPI tile "not available"
- C-5 My Queue tones
- D-1 reason codes on lines
- D-3 balance row
- D-4 copy fix
- D-8 waterfall
- D-11 discard confirmation
- F-2 prefill case from event
- F-5 workflow confirmations
- F-8 5-Why default
- F-9 confirmations
- G-2(a) period links
- G-5 legacy link
- H-2 error states
- H-3, H-4, H-9

**Wave 2: medium (1–2 sprints)**
- A-1 asset picker
- A-5 rolling window
- A-8 action owner, edit and overdue
- B-1/B-2 sidebar IA
- B-3 breadcrumbs
- B-5 period accounting entry
- B-7 route gating
- C-1/C-2 tokens and StatusBadge
- C-8 FormField
- C-9 density
- D-5 period navigation
- D-6 drill-downs
- D-7 lock banner
- D-10 sticky workflow bar
- D-13 filter bar
- E-2 to E-9
- F-1 Recommended tab
- F-4 stepper
- F-6 unsaved guard
- F-10 diagram keyboard
- G-3 header trace
- G-4 RCA chips
- G-6 dashboard deep links
- H-1 responsive drawer
- H-6 chart alternatives
- H-12 glossary

**Wave 3: larger, needs backend or decisions**
- D-2 derivation inputs (API + OpenAPI)
- G-2(b) per-event impact (API)
- F-7 My RCA actions (endpoint)
- F-3 single corrective-action model (decision → API)
- G-3 unlink (decision + endpoint)
- E-1/E-7 server sort and filters
- B-8 shared analysis context
- C-6 dark mode (decision)
- Role-aware dashboard (5.6)

---

## 7. Acceptance criteria

| Area | Measurable condition |
|---|---|
| Traceability | From any loss line, the linked event opens in 1 click. From any event, its periods open in 1 click. From any RCA case header, the trigger event opens in 1 click. Each is covered by a Playwright e2e test. |
| Context | Every page under a module shows plant (header), scope, window and timezone (`ScopeHeader`) and, at depth ≥ 2, breadcrumbs. Unit test on route metadata; e2e spot check. |
| Back navigation | From `/downtime/stops`, `/downtime/causes`, `/pla-analytics/losses` and `/rca/:id` → event → Back returns to the origin with the same query string (unit test for `eventBackTarget`). |
| Consequential actions | Approve period, Lock month, Accept investigation, Request closure, Approve closure, Cancel action, Retire (×2) and Discard (×2) each open a confirmation; irreversible ones use `destructive` and typed text. Checked by a grep/test list. |
| Status vocabulary | One label map per domain under `ux-kit/labels/`; the string "Running" never labels an open stop; 0 local badge components outside `ux-kit` (lint rule or grep in CI). |
| Durations | No `h:mm` without a unit in any KPI or table (grep for the `clock` format in product code = 0). |
| Colour tokens | 0 Tailwind palette colour classes and 0 raw `hsl(`/hex in `src/features/**` except branding (grep in CI). |
| Errors | `ErrorBoundary` mounted per route (test that throws inside a page and asserts the fallback). 0 query consumers that render empty on error: notification bell, hierarchy, plant tree, task summary, RCA summary, audit charts. |
| Responsive | At 768, 1024 and 1440 px: no horizontal page scroll; the sidebar is a drawer below 1024; the first event row is visible within 400 px of the top at 1024×768 (Playwright screenshots). |
| Accessibility | axe-core in Playwright on the 8 priority screens: 0 serious or critical violations. Every chart has a caption and a table alternative. Minimum text 12 px. Keyboard-only: create an event, code it, open its RCA, add an action. |
| Data entry | An event can be saved with an asset; the asset appears on the list and in bad actors. A case created from an event has a non-empty prefilled title and shows the event's unit, asset and times. |
| Task efficiency (manual test with 2–3 users per role) | Supervisor codes 10 stops in under 3 min; accountant finds and opens "yesterday night, Unit 200" in 3 clicks or fewer; facilitator goes from event to a created case with the problem statement in under 2 min. |

---

## 8. Open questions (record answers in `plans/DECISIONS.md`)

1. **Open-stop label:** "Ongoing", "Open" or "Stopped"? (A-4)
2. **Corrective-action model:** which of recommendation, action or task is the record of a corrective action? Should tasks link to actions or be removed for RCA? (F-3)
3. **RCA links:** may a wrong event or loss link be removed, by whom, and is it audited? (G-3)
4. **Priority from impact:** should a new case's priority come from event impact or consequence class? (F-2)
5. **"Reviewed" vs "verified":** what does the `reviewed` coding state mean compared with verification? (E-10)
6. **Glossary:** confirm the terms Stop / Event, Unaccounted, Investigation, Action, and US spelling. (H-12)
7. **Current plan:** with several active plans per unit, which one does "Period accounting" open? (B-5)
8. **Sidebar grouping:** does grouping by job (§4) suit the planners and administrators, or should Plans stay in ACCOUNT?
9. **Product name:** "Pro-Act" or "Traverse Forge" in the UI? (B-9)
10. **Dark mode:** required for control-room screens? (C-6)
11. **Event comments:** are shift-handover notes on events in scope? (I)
12. **Per-event impact:** should the event page show approved-only or provisional attributed loss? (G-2b)
13. **Asset override:** may a user change the asset on a source-owned (MQTT) event, or only through an override with a reason? (A-1, E-5)
14. **Unit names:** `unit100` vs "Extruder Line 1". Is the unit display name a master-data fix or a UI rule? (C-10)

---

## 9. Top 10 improvements, in priority order

1. **Link losses, events and RCA both ways** (A-3, G-2a, G-3 header, G-4). This is the core value of the product and is mostly frontend work.
2. **Asset field on events** (A-1). Equipment attribution feeds bad actors, MTBF and RCA scoping.
3. **Safe consequential actions** (A-6, A-7, F-5, F-9, H-4, D-11). Approve, lock and workflow moves get proportionate confirmations.
4. **Route error boundary and truthful error states** (A-2, H-2, H-3).
5. **Reconciliation that visibly balances, with coded lines** (D-3, D-1, D-4, D-8).
6. **Event Hub live correctness and readability** ("Ongoing", rolling window, one duration format, inline chips, asset column: A-4, A-5, C-3, C-9, E-1).
7. **RCA action ownership and tracking** (A-8, F-7, F-12).
8. **Navigation:** module-level sidebar, breadcrumbs, back targets, a period-accounting entry and a responsive drawer (B-1 to B-5, H-1).
9. **Semantic status tokens and one StatusBadge** (C-1, C-2, C-5, C-7).
10. **Case-from-event prefill and a Recommended investigations queue** (F-2, F-1).

### First three changes to implement
1. **Bidirectional traceability links (Top 1, frontend part):**
   - The data is already in the views (`causeEventId`, linked event ids, impacted periods, RCA links). Only links are missing.
   - Small effort, no contract change, and it fixes the biggest workflow gap across all three modules at once.
2. **Error boundary, truthful error states and confirmations on consequential actions (Top 3 and 4):**
   - Small effort with the existing `ConfirmDialog` and `DataState`.
   - Removes the two ways the UI can currently mislead or harm: a blank app, and one-click approve or irreversible lock.
3. **"Ongoing" label, one duration format and the asset field (Top 2 and part of 6):**
   - Labels and durations are copy and formatter changes that affect every downtime screen.
   - The asset field uses an API that already accepts `assetId`.
   - Together they fix what supervisors misread or cannot record today.
   - Only the wording needs an SME nod (question 1).
