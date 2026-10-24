# Dashboard and shell redesign — design

Date: 2026-10-24 · Branch base: `feat/downtime-area2-b` · Owner-approved in conversation (mockups in `.superpowers/brainstorm/`, `dashboard-v1-full.png`).

## Intent

Traverse Forge's dashboard and shell read like a list of features, not a plant control surface. The owner's
feedback (15 points) is about the same thing: too much repeated text, inconsistent layouts, no sense of
direction over time, and navigation names that don't match how plant people talk. The goal is a calm,
ISA-101-style overview a production manager can read in a minute: what needs me, how is the plant doing,
is it getting better or worse, and where do I click next.

## Goals

1. Sidebar redesign with the logo on top (links to the Dashboard), renamed sections, labels-only when expanded and icons-only when collapsed, collapse button at the bottom.
2. Header: plant timezone shown, USD/IRR switch removed from view, hierarchy dropdown shows no expand arrow on nodes without children.
3. Dashboard: one consistent section layout, no repeated or explanatory text on the page (it moves into hover tooltips), a "Time period" control with longer ranges, the "For you" row directly under it, and trend charts for OEE, production vs plan, downtime and asset reliability.

## Non-goals

- The app-wide dark theme. A separate session is doing it on branch `feat/dark-theme` (worktree `D:\HMI_Project_Usama\ProAct-dark-theme`): ThemeProvider, a header `ThemeToggle` placed just before the notification bell, sidebar tokens `--sidebar-active-bg/-fg/-bar`, and a token sweep. This work must consume tokens, not hex literals, so both branches merge cleanly. Do not build the toggle here.
- New KPIs or new calculations beyond the server additions listed below.
- Restyling pages other than the dashboard.

## Anti-goals (a failure even if it works)

- Numbers computed in the browser (CLAUDE.md). Every figure and every chart point comes from a server response.
- Placeholder, demo or random data in product code. An empty or unavailable series shows an honest empty state with its reason.
- Losing the data-trust signal. Provisional/approved status must still be visible — once per page, not per card.
- Decorative colour. Colour carries meaning (status, planned vs unplanned, loss); charts use industry-standard semantic colours, not brand colours.

## Constraints

CLAUDE.md applies in full: file and component size limits; new code under `features/<area>/`; TanStack Query for all fetching; lazy-load charts; no new dependencies (Recharts ^2.15.4 is already present); OpenAPI snapshot updated for any API change; tests for new logic; lint, typecheck and tests run in chunks by feature folder; no seeding or full e2e without asking the owner first.

## Decisions — shell

**Sidebar** (`src/features/shell/app-sidebar.tsx`, `sidebar-group.tsx`, `sidebar-link.tsx`, `src/components/Layout.tsx`)

- Top: brand block = brand mark + app name (from branding, falling back to `APP_TITLE` "Traverse Forge") + plant name as a small uppercase subtitle. The whole block is a link to `/dashboard` with an accessible name such as "Traverse Forge — go to Dashboard". Collapsed: the mark only, still a link. The header no longer shows the brand mark or app name (it moves here); the drawer variant below 1024 px shows the same block.
- Section names (`NAV_SECTIONS`, `src/features/auth/navigation-items.ts`): Overview · Daily operations (was Production) · Production loss analysis (PLA) · Downtime analysis · Asset reliability (was Reliability) · Configuration (was Setup) · Integration · Administration. Section keys stay as they are; only labels change.
- Expanded: page labels only, no icons. Section headers stay small uppercase disclosure buttons, coloured with an AA-passing muted tone (≥ 4.5:1 on the sidebar background; the mockup's #94a3b8 is only 2.6:1 on white, so don't use it in light). Use the sidebar tokens from `feat/dark-theme` (`bg-sidebar-active-bg`, `text-sidebar-active-fg`, `bg-sidebar-active-bar`); that branch also touched `sidebar-link.tsx`, `Layout.tsx` and `app-header.tsx`, so merge it first and build on top. Active page: pale primary fill, primary text, 600 weight, a 3px bar on the left edge (light: #eff6ff / #1d4ed8; dark comes from the dark-theme tokens). Pending approvals shows a count badge (amber), using the existing approvals inbox query.
- Collapsed rail: icons only (existing icon registry), tooltip with the page name, active state as above.
- Collapse/expand button moves from the top of the nav to a footer pinned at the bottom of the sidebar; labels "Collapse sidebar" / "Expand sidebar" are kept (tests rely on them). Not shown in the drawer variant.

**Header** (`src/features/shell/app-header.tsx`)

- Add the plant timezone readout on the right: IANA name plus offset, e.g. "Asia/Tehran · UTC+03:30", from `usePlantTimezone()` (`src/features/ux-kit/use-plant-timezone.ts`). When it falls back to UTC, show it as a warning ("Plant timezone unknown — times in UTC").
- Remove `DisplayCurrencyToggle` from the header. Keep the component, its store and its tests in the codebase; amounts display in USD. *(Builder's call, settled in review:)* while the switch is hidden, force USD and ignore a previously saved IRR choice in `display-currency-store.ts`, so nobody is stuck on IRR without a way back; behind one constant so bringing the switch back is a one-line change. Record in `plans/DECISIONS.md` that the switch is hidden temporarily, overriding the CLAUDE.md learned rule until the owner brings it back.
- The dark-theme branch inserts its toggle before the notification bell; keep that slot.

**Hierarchy dropdown** (`src/features/plant-selector/plant-tree.tsx`, `tree-row.tsx`)

- A node shows the expand chevron only if it has children. Today plants and units are always expandable because children load lazily.
- There is no plant-directory endpoint: the tree is built from the session bootstrap, `/v2/organizations`, `/v2/tenants`, `/v2/units` and `/v2/assets?status=active` (`src/features/plant-selector/use-plant-directory.ts:55-104`). *(Builder's call:)* don't change those shared list contracts. Add one small read endpoint in the acting plant, `GET /api/v2/units/asset-presence`, returning for each unit the caller can see whether it has active assets (matching the tree's own filter) — one grouped query, scoped, no N+1. The tree loads it together with a plant's units, so unit rows know their chevron before any click. New contract: flag it and update the OpenAPI snapshot. Plants: units are listed per plant through the acting-plant header, so a cross-plant "has units" check would need a cross-tenant endpoint; *(builder's call)* plants keep the fallback — the chevron disappears once their unit list comes back empty. Plants without units are rare (only during setup).
- Assets (the last level) already have no chevron; keep that.

## Decisions — dashboard

Entry: `src/features/pla-analytics/dashboard/analytics-dashboard.tsx` and its children. Mockup: `dashboard-v1-full.png`.

**Page header.** Title "Dashboard". Remove the description ("Key figures of the selected plant.") and the scope label ("All units in your scope · …"). Keep "As of …" and a single Provisional / Approved badge at page level; move the incomplete-data line and the run details into a tooltip or popover on that badge. The timezone badge moves to the app header.

**Scope follows the hierarchy.** *(Owner decision, 24 Oct 2026: every KPI, chart, list and "For you" count on the dashboard changes with the header hierarchy selection.)* today the dashboard always covers every unit of the plant in the caller's scope and ignores the unit or asset picked in the header (`dashboardScope()` in `src/features/pla-analytics/model/dashboard-scope.ts`). The whole dashboard now follows the selected hierarchy node — plant: all its visible units; unit: that unit; asset: KPIs and trends that support an asset filter (downtime, reliability) narrow to it, and sections that don't (OEE, production vs plan) stay at its unit and say so in a tooltip. The page header shows nothing extra; the header breadcrumb already names the node.

**Time period.** Rename "Window" to "Time period" and render it as a segmented control: 24 h · 7 days · 30 days · 3 months · 6 months · 1 year (default 7 days, kept in `?window=`). Keys: `24h, 7d, 30d, 3m, 6m, 1y`. Chart time step follows the period: 24 h → shift; 7 and 30 days → day; 3 months → week; 6 months and 1 year → month.

**For you.** The existing row moves directly under the Time period row with the "For you" heading kept. Pending approvals is first and gets an amber edge when its count is above zero. Tile notes ("Waiting for your decision", etc.) move into tooltips.

**Section pattern (applies to every KPI section).** One card per section: heading on the left, a single report link on the right, a row of equal-width KPI tiles (5 per row on wide screens, wrapping cleanly to 3 / 2 at smaller widths), then a chart row (wide chart 2/3 + companion 1/3, or two halves). The tile shows the label (uppercase, small) and the value with its unit — nothing else. The explanatory text that sits under values today (denominators, ISO references, "not the OEE availability", etc.) is removed from the tile and shown in a tooltip on an ⓘ next to the label, reachable by keyboard focus. No section repeats its own name in a card title below it (e.g. no "Downtime totals" under "Downtime").

**Sections, in order:**

1. **OEE** — link "OEE and downtime report". Tiles: Operational OEE (highlighted), Availability, Performance, Quality, Reconciled PLA OEE. Charts: OEE trend (OEE line; Availability/Performance/Quality as lines the user can toggle on; no target line — no OEE target setting exists, so the mockup's "target 85%" is dropped) from `GET /reports/oee?groupBy=<step>`; companion "Where production was lost" — loss by OEE category (availability / performance / quality) in quantity from `GET /reports/loss-tree?groupBy=oee` (server-computed; do not derive it from the percentages — this replaces the mockup's "Where OEE was lost · pts of OEE").
2. **Production vs plan** — link "Production loss analysis". Tiles: Plan, Actual, Shortfall (highlighted), Explained loss, Unexplained (with "above target" when the server flags it), plus the "% of plan" / "% of shortfall" notes. Charts: stacked bars per step — actual, explained loss, unexplained (bar top = plan) — from `GET /reports/reconciliation-trend?groupBy=<step>`. **Owner decision (1a):** today's `ReconciliationTrendBucketView` has only plan / shortfall / unexplained per bucket (`server/pro-act-backend/src/v2/pla-reports/reconciliation-trend.ts:10-49`), so extend it on the server with `actual` and `explained` per bucket and a window `total` (same fields, per unit of measure) including the two ratios. Additive contract change: flag it, update the DTO and the OpenAPI snapshot, add fixture tests for the maths. The browser does no arithmetic on these figures; companion: top 5 loss reasons by quantity from `GET /reports/loss-tree?groupBy=reason&limit=5`. *(Builder's call, applies to this section and "Where production was lost":)* when the scope has more than one unit of measure, show a small unit-of-measure picker on the section (default: the unit of measure with the largest plan), never a sum across units of measure; with one unit of measure the picker is hidden.
3. **Downtime** — link "Downtime analysis". Tiles: Total downtime (highlighted), Planned (`downtime_planned`, already returned), Unplanned, Stops, Scheduled availability. Keep the existing "Controllable" switch. Charts: downtime stacked per step with stops as a line. `/reports/downtime` returns one schedule class and one metric per call, so use `/reports/downtime-bundle` if it covers this, otherwise one query per series. *(Builder's call:)* stack planned, unplanned, external and unknown so the bars add up to the Total downtime tile; external and unknown in neutral greys, listed in the legend only when non-zero. Companion: Pareto of the top 5 unplanned-downtime causes (`groupBy=reason`).
4. **Asset reliability** — link "Investigations" (plus "Cause portfolio" when `canViewAnalysis`, as today). Tiles: the five RCA counts from `useRcaSummary()`. Charts: MTBF and MTTR by month from `GET /reports/reliability-trend` (monthly; for periods shorter than 3 months show the last 6 months and say so in the chart subtitle). **Owner decision (2):** the trend must exist at every level of the hierarchy — organisation, plant, unit and asset — for whatever node is selected in the header hierarchy. Today the endpoint returns per-unit and per-asset series only (`server/pro-act-backend/src/v2/ops-reports/reliability-trend.ts:35-50`). Add a server-computed series for the selected node: MTBF = total run time ÷ failures, MTTR = total repair time ÷ repairs, summed over the units/assets of that node the caller can see (same failure definition the report already applies). Additive contract change: flag it, OpenAPI snapshot, fixture tests for the aggregation. Record the definition in `plans/DECISIONS.md` for the reliability engineers to confirm; companion: most-stopped assets (existing `DashboardTopAssets`, moved here). *(Builder's call:)* add a Downtime column from a second `groupBy=asset&metric=duration` query, joined by asset key.
5. **Reconciliation** and **Latest loss events** — side by side in one row, otherwise unchanged; the reconciliation tiles follow the same tile style.

**No change vs previous period.** *(Owner decision, 24 Oct 2026:)* tiles show no "▲ x pts" / previous-period line at all. The trend charts carry the direction.

**Hierarchy levels.** Organisation selected on its own (no plant): every report is plant-scoped on the server, so cross-plant figures are a separate project; the dashboard keeps the acting plant and says "Showing <plant> — organisation-wide figures are not available yet" under the title. Asset selected: the downtime report has no asset filter, so Downtime tiles take the asset's own row from `groupBy=asset` queries (selecting a server row, no arithmetic) and the trend and Pareto stay at the unit with a note; Reliability uses the asset's series.

**Charts.** Recharts, lazy-loaded, building on `src/features/pla-analytics/charts/series-chart.tsx` and `src/features/downtime-analysis/components/charts/`. Semantic colours: unplanned / loss red, planned slate grey, explained loss orange, OEE line primary blue, target green dashed. Axes, gridlines and tooltips from theme tokens so the dark theme works. Each chart has a text alternative (accessible table or summary) and an honest empty state.

**Labels removed** (point 11): "Operational OEE (ISO 22400)" as a card title (the tile label is "Operational OEE"; ISO 22400 goes in its tooltip), per-card "Provisional" badges, "Downtime totals", "Investigations and actions", "Periods by workflow state" where they repeat the section heading, availability captions under values.

## Server work

- Hierarchy: the small "which of these nodes have children" endpoint (see Hierarchy dropdown).
- `reconciliation-trend`: add `actual`, `explained`, window totals and ratios (owner decision 1a).
- `reliability-trend`: add an aggregate series for the selected hierarchy node at any level (owner decision 2).
- Merge order: merge `feat/dark-theme` into the working branch before starting the shell work.
- Range: verified in review — every report named here accepts up to 400 days, so 1 year (and the separate previous-period query) is in range. The dashboard's 90-day exclusion (commit e11d0f3a) has no recorded reason; it is replaced by the new presets. Still check `EXPLAIN ANALYZE` on the 1-year shapes.

## Tests to update

Vitest: `dashboard-headings.test.ts`, `for-you.test.tsx`, `availability-captions.test.tsx`, `dashboard-links.test.ts`, `kpi-unavailable.test.ts`, `rca-tiles.test.tsx`, `pla-analytics-flows.test.tsx`, `qa-reports-window.test.tsx`, `navigation-items.test.ts`, `page-names.test.ts`, `app-sidebar.test.tsx`, `responsive-shell.test.tsx`. Playwright specs that assert "Operational OEE (ISO 22400)" or "All units in your scope" (`manager-6-analytics`, `pla-analytics-an02`, `operator-analytics-tasks`, `operator-scope-and-roles`) must be updated, but run e2e only once at the end and only after the owner says go.

## Left to the builder

Component split and file names; exact Tailwind classes and spacing; tooltip component choice among existing `src/components/ui/*`; how many tiles per row at each breakpoint; chart heights; the exact wording inside each tooltip (reuse today's captions); the order of work.

## Housekeeping

Add `.superpowers/` to `.gitignore`. Record the renamed sections, the hidden currency switch, and the dashboard structure in `plans/DECISIONS.md`.
