# Dashboard and Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sidebar, header and dashboard of Traverse Forge so the dashboard follows the hierarchy selection, shows one consistent KPI section layout with tooltips instead of captions, and adds server-backed trends for OEE, production vs plan, downtime and reliability.

**Architecture:** Three additive server changes (unit asset presence, reconciliation-trend actual/explained/totals, reliability-trend aggregate series) with OpenAPI snapshot updates; the frontend shell is reworked in `src/features/shell/`; the dashboard is rebuilt from a shared `KpiSection` / `KpiTile` pattern under `src/features/pla-analytics/dashboard/`, one file per section, with Recharts charts lazy-loaded. Every number comes from a server response; the browser only selects and displays.

**Tech Stack:** React 18, TypeScript strict, Tailwind, shadcn/ui (`src/components/ui/*`, generated — do not edit), TanStack Query, Recharts 2.15, Vitest + Testing Library; NestJS 11, TypeORM 0.3, Postgres 15, Jest.

**Spec:** `docs/superpowers/specs/2026-10-24-dashboard-shell-redesign-design.md` (read it first; mockup `.superpowers/brainstorm/dashboard-v1-full.png`).

## Global Constraints

- CLAUDE.md applies: files ≤ 400 lines, functions ≤ 40 lines and ≤ 4 params, components ≤ 150 lines, named exports, kebab-case files, no `any`, no `console.log`, no commented-out code.
- No new dependencies. No edits to `src/components/ui/*`, `.env*`, applied migrations.
- No business number computed in the browser — not sums, differences, ratios or shares. Selecting a server row is allowed.
- No fabricated, demo or placeholder data in product code; unavailable figures show "—" plus the server's reason in the tooltip.
- Every API contract change: flag it in the commit message, run `npm run openapi:v2:update` (in `server/pro-act-backend`), then `npm run api:types` (repo root) to regenerate `src/api/v2/schema.d.ts`.
- Colours from theme tokens only (the `no-hardcoded-colors` guard test enforces it). Chart semantics: unplanned/loss → `--danger`/red token, planned → neutral slate token, explained loss → orange chart token, OEE line → `--primary`.
- Copy (exact): sections "Overview", "Daily operations", "Production loss analysis (PLA)", "Downtime analysis", "Asset reliability", "Configuration", "Integration", "Administration". Time period label "Time period"; options "24 h", "7 days", "30 days", "3 months", "6 months", "1 year"; keys `24h`, `7d`, `30d`, `3m`, `6m`, `1y`; default `7d`.
- Run tests in chunks by feature folder (`npx vitest run src/features/<area>`; backend `npx jest <path>`), never the whole suite at once. Never seed data or run e2e without the owner's go-ahead.
- Leave the owner's own uncommitted changes (`CLAUDE.md`, `server/pro-act-backend/src/code-library/code-matching.ts`, `src/features/shell/app-header.tsx`) out of every commit: stage files by path, never `git add -A`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A user who had chosen IRR earlier must see USD after the switch is hidden — test in Task 3.
- A plant whose units use different units of measure must never show a summed quantity — tests in Tasks 5 and 11.
- Selecting an asset, then a plant, then a unit must re-scope every section and drop the asset — test in Task 7.
- A period with no data (new plant, 1 year back before go-live) must render empty states, not zeros or crashes — tests in Tasks 10–13.
- Collapsed sidebar must keep every page reachable by keyboard with an accessible name — test in Task 2.

---

### Task 0: Branch and housekeeping

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1:** `git switch -c feat/dashboard-shell-redesign` from `feat/downtime-area2-b` (the owner's uncommitted changes travel along untouched).
- [ ] **Step 2:** `git merge --no-ff feat/dark-theme`. Expected: clean merge, or a conflict only in `src/features/shell/app-header.tsx` against the owner's uncommitted edit — if so, stop and ask the owner; do not resolve their edit yourself.
- [ ] **Step 3:** Add a line `.superpowers/` to `.gitignore`.
- [ ] **Step 4:** Run `npm run typecheck` and `npx vitest run src/features/shell`. Expected: pass.
- [ ] **Step 5:** Commit `.gitignore` and the plan/spec: `git add .gitignore docs/superpowers && git commit -m "chore: dashboard redesign spec and plan; ignore brainstorm mockups"`.

### Task 1: Rename sidebar sections

**Files:**
- Modify: `src/features/auth/navigation-items.ts:15-24`
- Modify: `src/features/auth/navigation-items.test.ts`, `src/features/shell/app-sidebar.test.tsx:147-153`, `src/features/shell/responsive-shell.test.tsx:74`
- Modify: `plans/DECISIONS.md`

**Interfaces:** Produces the labels above; `NavSectionKey` values unchanged.

- [ ] **Step 1: Update tests first** — in `app-sidebar.test.tsx` the order assertion becomes `['Overview', 'Daily operations', 'Production loss analysis (PLA)', 'Downtime analysis', 'Asset reliability']`; in `responsive-shell.test.tsx` the button name `'Production'` becomes `'Daily operations'`; in `app-sidebar.test.tsx:101` `'Reliability'` becomes `'Asset reliability'`. Add to `navigation-items.test.ts`: `expect(NAV_SECTIONS.map((s) => s.label)).toEqual(['Overview','Daily operations','Production loss analysis (PLA)','Downtime analysis','Asset reliability','Configuration','Integration','Administration'])`.
- [ ] **Step 2:** `npx vitest run src/features/shell src/features/auth` → FAIL on the labels.
- [ ] **Step 3:** Change the three labels in `NAV_SECTIONS` (`production` → "Daily operations", `reliability` → "Asset reliability", `setup` → "Configuration"). Grep `src/` and `e2e/` for `'Production'`, `'Reliability'`, `'Setup'` used as section button names and update them.
- [ ] **Step 4:** Same vitest command → PASS.
- [ ] **Step 5:** Add a dated entry to `plans/DECISIONS.md` (2026-10-24): section renames; USD/IRR switch hidden temporarily (USD forced); dashboard follows the header hierarchy; plant-level MTBF/MTTR definition (total run time ÷ failures, total repair time ÷ repairs over the visible units/assets) awaiting reliability engineers' confirmation; "explained loss = shortfall − unexplained, floored at 0" (Task 5).
- [ ] **Step 6:** Commit: `feat(shell): rename sidebar sections to Daily operations, Asset reliability, Configuration`.

### Task 2: Sidebar redesign — brand on top, labels only, collapse at the bottom

**Files:**
- Create: `src/features/shell/sidebar-brand.tsx`, `src/features/shell/sidebar-collapse-button.tsx`
- Modify: `src/features/shell/app-sidebar.tsx`, `src/features/shell/sidebar-link.tsx`, `src/features/shell/sidebar-group.tsx`, `src/features/shell/navigation-drawer.tsx`, `src/features/shell/app-header.tsx` (remove brand block only)
- Test: `src/features/shell/app-sidebar.test.tsx`

**Interfaces:**
- Produces: `SidebarBrand({ branding, collapsed }: { branding: BrandingSettings | undefined; collapsed: boolean })` — a `<Link to="/dashboard">` with accessible name `` `${appName} — go to Dashboard` `` (appName = `branding?.appName || APP_TITLE`), showing `BrandMark` + app name + plant name (from `usePlantSelection().selection?.tenant?.name`) in small uppercase; collapsed: the mark only.
- Produces: `SidebarCollapseButton({ collapsed, onToggle })` — keeps aria-labels "Expand sidebar"/"Collapse sidebar" and `aria-expanded`.
- `AppSidebar` gains prop `branding: BrandingSettings | undefined` (pass it from `Layout.tsx` and `navigation-drawer.tsx`).

- [ ] **Step 1: Write failing tests** in `app-sidebar.test.tsx`:
  - `it('brand block links to the dashboard')`: `expect(screen.getByRole('link', { name: 'Traverse Forge — go to Dashboard' })).toHaveAttribute('href', '/dashboard')`.
  - `it('collapse button sits after the menu list')`: the `Collapse sidebar` button's `compareDocumentPosition` with the last nav `ul` returns `DOCUMENT_POSITION_FOLLOWING`.
  - `it('expanded links show labels without icons')`: within the Dashboard link, `container.querySelector('svg')` is null.
  - `it('collapsed rail keeps every link named')`: after clicking "Collapse sidebar", every `role=link` in the nav has a non-empty accessible name and contains an `svg`.
  - `it('active link uses the sidebar active tokens')`: the `aria-current="page"` link has class `bg-sidebar-active-bg` and `text-sidebar-active-fg`.
- [ ] **Step 2:** `npx vitest run src/features/shell` → the five new tests FAIL.
- [ ] **Step 3:** Implement. `app-sidebar.tsx`: layout `flex h-full flex-col` = `SidebarBrand` (top, `border-b`) → scrolling `ul` (`flex-1`) → `SidebarCollapseButton` footer (`border-t`, only when `variant === 'sidebar'`). `sidebar-link.tsx`: render `<Icon>` only when `collapsed`; active classes `bg-sidebar-active-bg text-sidebar-active-fg font-semibold` plus a 3px left bar (`before:` pseudo-element with `before:bg-sidebar-active-bar`); inactive `text-sidebar-foreground hover:bg-sidebar-accent`. `sidebar-group.tsx`: section header colour stays an AA-passing muted token (≥ 4.5:1 — do not use `text-sidebar-section-label` in light). Pending approvals badge: render the count from `useApprovalInbox(undefined, true)` (same first-page "N"/"N+" rule as `for-you-tiles.tsx:124-134`) on the `/approvals` link, amber warning token, hidden at 0. `app-header.tsx`: remove the `BrandMark` + app-name block (keep `MenuButton`, `PlantSelector`, right cluster).
- [ ] **Step 4:** `npx vitest run src/features/shell` → PASS. Fix `branding-appearance.test.tsx` if it looked for the brand in the header.
- [ ] **Step 5:** Commit: `feat(shell): sidebar brand links to the dashboard, labels-only menu, collapse button at the bottom`.

### Task 3: Header — timezone readout, currency switch hidden (USD forced)

**Files:**
- Create: `src/features/shell/plant-timezone-readout.tsx`, `src/features/shell/plant-timezone-readout.test.tsx`
- Modify: `src/features/shell/app-header.tsx`, `src/features/display-currency/display-currency-store.ts`
- Test: `src/features/display-currency/display-currency-store.test.ts` (create if absent)

**Interfaces:**
- Consumes: `usePlantTimezone()` from `src/features/ux-kit/use-plant-timezone.ts` (returns the IANA zone and `source: 'utc-fallback'` when unknown).
- Produces: `PlantTimezoneReadout()`; `DISPLAY_CURRENCY_SWITCH_ENABLED = false` exported from `display-currency-store.ts`.

- [ ] **Step 1: Failing tests.** `plant-timezone-readout.test.tsx`: with zone `Asia/Tehran` and a fixed date, `getByText('Asia/Tehran · UTC+03:30')`; with `source: 'utc-fallback'`, `getByText('Plant timezone unknown — times in UTC')` and the element has role `status`. Store test: with `localStorage` holding the saved choice `IRR`, the store's current currency reads `'USD'` while `DISPLAY_CURRENCY_SWITCH_ENABLED` is false.
- [ ] **Step 2:** `npx vitest run src/features/shell src/features/display-currency` → FAIL.
- [ ] **Step 3:** Implement `PlantTimezoneReadout` (offset via `Intl.DateTimeFormat(..., { timeZoneName: 'longOffset' })` → "GMT+03:30" rendered as "UTC+03:30"; hidden below `md`). In the store, return `'USD'` when the flag is false and ignore the saved value; keep the saved value untouched in storage. In `app-header.tsx` remove `<DisplayCurrencyToggle />` and its import; add `<PlantTimezoneReadout />` before the theme toggle.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit: `feat(shell): plant timezone in the header; hide the USD/IRR switch for now (USD shown)`.

### Task 4: Hierarchy chevrons — unit asset presence (API change)

**Files:**
- Modify: `server/pro-act-backend/src/v2/units/units-v2.controller.ts`, its service, and a new `server/pro-act-backend/src/v2/units/unit-asset-presence.ts`
- Test: `server/pro-act-backend/src/v2/units/unit-asset-presence.spec.ts`; integration test beside existing units integration tests
- Modify: `src/features/plant-selector/use-plant-directory.ts`, `src/features/plant-selector/plant-tree.tsx`, `src/api/v2/types/plant-directory.ts`
- Test: `src/features/plant-selector/plant-selector.test.tsx`

**Interfaces:**
- Produces (server): `GET /api/v2/units/asset-presence` → `{ data: { items: Array<{ unitId: string; hasAssets: boolean }> } }` for every unit of the acting plant the caller can see (scope from `@Ctx()`, `scopedQuery()`, one `SELECT u.id, EXISTS(SELECT 1 FROM assets a WHERE a.unit_id = u.id AND a.status = 'active')` query; confirm `assets(unit_id, status)` is indexed, add a migration with `down` if not).
- Produces (client): `useUnitAssetPresence(tenantId: string | null): Map<string, boolean>`; `plantDirectoryKeys.assetPresence(tenantId)`.

- [ ] **Step 1: Failing tests.** Jest unit: `assetPresenceRows` maps rows to `{ unitId, hasAssets }`. Integration (on `proact-test-postgres` via `npm run test:int` only): a unit with one active asset → `true`; one with only inactive assets → `false`; a unit outside the caller's unit restriction is absent. Vitest: in `plant-selector.test.tsx`, `it('unit without assets has no expand button')` — presence map `{u1: false, u2: true}` → row u1 has no button named /expand/i, u2 has one; `it('plant whose unit list is empty loses its chevron')`.
- [ ] **Step 2:** Run `npx jest src/v2/units` (server dir) and `npx vitest run src/features/plant-selector` → FAIL.
- [ ] **Step 3:** Implement the endpoint (controller → service → query function), then `npm run openapi:v2:update` and `npm run api:types`. In `plant-tree.tsx` pass `expandable={presence.get(unit.id) ?? true}` for units and `expandable={units === undefined || units.length > 0}` for plants after their load.
- [ ] **Step 4:** Re-run both → PASS; also `npm run test:int -- units` → PASS.
- [ ] **Step 5:** Commit: `feat(directory): units report whether they have active assets; tree hides empty chevrons [API: GET /v2/units/asset-presence]`.

### Task 5: Reconciliation trend — actual, explained and window totals (API change)

**Files:**
- Modify: `server/pro-act-backend/src/v2/pla-reports/reconciliation-trend.ts` (254 lines — move the bucket arithmetic into a new `reconciliation-trend-bucket.ts` to stay under 400)
- Test: `server/pro-act-backend/src/v2/pla-reports/reconciliation-trend.spec.ts`
- Modify: `src/api/v2/types/pla-analytics.ts:64-88`

**Interfaces:**
- `ReconciliationTrendBucketView` gains `actual: string | null` (Σ `slice.actual` of included slices) and `explained: string | null` (`max(0, shortfall − unexplained)`), both null when `included === 0`.
- `ReconciliationTrendView` gains `totals: ReconciliationTrendBucketView[]` — one per unit of measure, `key: 'total'`, the same fields accumulated over the whole window (ratios and target recomputed from the totals, not averaged).
- Frontend type mirrors both.

- [ ] **Step 1: Failing tests** in `reconciliation-trend.spec.ts` using the existing period-state fixtures:
  - `it('reports actual and explained per bucket')`: one slice target 100, actual 80, residual 5 → `plan '100'`, `actual '80'`, `shortfall '20'`, `unexplained '5'`, `explained '15'`.
  - `it('totals add the buckets of one unit of measure')`: two days (100/80, 50/50) → `totals[0]` = `{ key: 'total', plan: '150', actual: '130', shortfall: '20' }`.
  - `it('keeps units of measure apart in totals')`: `t` and `m3` slices → two totals, never one.
  - `it('explained never goes below zero')`: unexplained > shortfall → `explained '0'`.
  - `it('totals are null when no slice is computable')`.
- [ ] **Step 2:** `npx jest src/v2/pla-reports/reconciliation-trend` → FAIL.
- [ ] **Step 3:** Add `actual` to `Bucket`, accumulate in `addFigures`; keep a second map `acc.totals` keyed by unit of measure fed from the same `addPeriod` call; build `totals` in `trendView`.
- [ ] **Step 4:** Same command → PASS. Then `npm run openapi:v2:update`, `npm run api:types`, `npx tsc --noEmit -p tsconfig.json` (server) and `npm run typecheck` (root) → clean.
- [ ] **Step 5:** Commit: `feat(pla-reports): reconciliation trend reports actual, explained loss and window totals [API: additive]`.

### Task 6: Reliability trend — aggregate series for the selected node (API change)

**Files:**
- Modify: `server/pro-act-backend/src/v2/ops-reports/reliability-trend.ts`, `server/pro-act-backend/src/v2/ops-reports/ops-reports-v2.dto.ts:106`
- Test: `server/pro-act-backend/src/v2/ops-reports/reliability-trend.spec.ts`
- Modify: `src/api/v2/types/ops-reports.ts:204-210`, `src/api/v2/queries/ops-reports.ts:73`

**Interfaces:**
- `ReliabilityTrendQueryDto` gains optional `assetIds?: string[]` (same validators as `ReliabilityReportQueryDto.assetIds`, `kpi-reports-v2.dto.ts:204-215`).
- `ReliabilityTrendView` gains `total: { months: ReliabilityMonthView[]; fallingMtbf: boolean }`:
  - no `assetIds`: a third `kpiGroups` call with `groupSql: MONTH`, `level: 'period'`, `excludeUnknownTime: true` — the stored terms summed over every unit in scope (MTBF = Σ exposure ÷ Σ failures; MTTR = Σ repair ÷ Σ repairs, exactly as `reliabilityRow` reads terms).
  - with `assetIds`: `assetTerms(unitTermsOfMonth, assetTermsOfMonth)` summed over those assets; the listed assets are always included in `assets[]` even outside `TREND_ASSET_LIMIT`.
- `useReliabilityTrend(query: (ReportQueryBase & { assetIds?: string[] }) | null, tz?: string)`.

- [ ] **Step 1: Failing tests:**
  - `it('total sums the terms of every unit per month')`: unit A 100 h / 2 failures, unit B 300 h / 2 → `total.months[0].row.mtbf.value` is 400 h ÷ 4 = 100 h in the unit `reliabilityRow` already uses (seconds → `'360000'`), never the mean of the units' 50 h and 150 h.
  - `it('total follows the asset filter')`: with `assetIds=[x]`, `total` equals asset x's series.
  - `it('a filtered asset outside the top 30 is still listed')`.
  - `it('total months with no terms carry null values')`.
- [ ] **Step 2:** `npx jest src/v2/ops-reports/reliability-trend` → FAIL.
- [ ] **Step 3:** Implement; validate asset ids belong to the tenant and the caller's units (422 `INVALID_REFERENCE`, as the reliability report does).
- [ ] **Step 4:** PASS; `npm run openapi:v2:update`, `npm run api:types`, both typechecks clean; run `EXPLAIN ANALYZE` on the new month-only query for a 1-year window on `proact` and note the plan in the commit body.
- [ ] **Step 5:** Commit: `feat(ops-reports): reliability trend adds a total series for the selected scope and an asset filter [API: additive]`.

### Task 7: Dashboard scope — time periods, chart step, hierarchy

**Files:**
- Modify: `src/features/pla-analytics/model/dashboard-scope.ts`, `src/features/event-hub/model/relative-window.ts` (add `3m`, `6m`, `1y` entries; check Event Hub tests still pass since it shares the list), `src/features/downtime-analysis/model/downtime-filters.ts` only if it must exclude the new keys
- Create: `src/features/pla-analytics/dashboard/use-dashboard-scope.ts`
- Test: `src/features/pla-analytics/model/dashboard-scope.test.ts`

**Interfaces:**
- `DASHBOARD_PRESETS`: `[{key:'24h',label:'24 h',hours:24},{key:'7d',label:'7 days',hours:168},{key:'30d',label:'30 days',hours:720},{key:'3m',label:'3 months',hours:2184},{key:'6m',label:'6 months',hours:4368},{key:'1y',label:'1 year',hours:8760}]`; `DashboardPresetKey` = their keys.
- `stepOf(key: DashboardPresetKey): TrendGroup` → `24h→'shift'`, `7d|30d→'day'`, `3m→'week'`, `6m|1y→'month'`.
- `dashboardScope(key: DashboardPresetKey, node: DashboardNode, now?: number): AnalyticsScope` where `DashboardNode = { unitId?: string; assetId?: string }`; sets `unitIds = node.unitId ? [node.unitId] : []`, `trendBy = stepOf(key)`, `windowLabel` = preset label.
- `useDashboardScope(): { key; setKey; scope; node; orgOnly: boolean }` — reads `?window=` and `usePlantSelection().selection` (`unit?.id`, `asset?.id`; `orgOnly` when `organization` is set without `tenant`).

- [ ] **Step 1: Failing tests:** each key maps to the step above; `dashboardScope('7d', { unitId: 'u1', assetId: 'a1' }).unitIds` equals `['u1']`; `dashboardScope('1y', {}).unitIds` equals `[]`; `presetKeyOf('90d')` falls back to `'7d'`; hook test: changing the selection from asset → plant → unit yields `node` `{unitId,assetId}` → `{}` → `{unitId}`.
- [ ] **Step 2:** `npx vitest run src/features/pla-analytics/model src/features/pla-analytics/dashboard` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; also `npx vitest run src/features/event-hub src/features/downtime-analysis` → PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): time periods up to 1 year, chart step per period, scope follows the hierarchy`.

### Task 8: Shared KPI section and tile

**Files:**
- Create: `src/features/pla-analytics/dashboard/kpi-section.tsx`, `kpi-tile.tsx`, `kpi-info.tsx`, `kpi-tile.test.tsx`

**Interfaces:**
- `KpiSection({ title, link, controls, children }: { title: string; link?: { to: string; label: string; testId?: string }; controls?: ReactNode; children: ReactNode })` — one card: heading row (h2 title left, controls + link right), then children. Use `Section`/`Card` from ux-kit if it fits; otherwise a `rounded-lg border bg-card p-4`.
- `KpiTileRow({ children })` — `grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`.
- `KpiTile({ spec, value, testId }: { spec: KpiTileSpec; value: ReactNode | null; testId: string })` with `KpiTileSpec = { title: string; info: string; highlight?: boolean }`. Value null → "—"; unavailable reason goes into the info text. No previous-period or change line (owner decision).
- `KpiInfo({ label, text })` — ⓘ button (`aria-label` `` `About ${label}` ``) opening the existing `Tooltip` from `src/components/ui/tooltip`; reachable by keyboard focus.

- [ ] **Step 1: Failing tests:** tile shows title and value, not the info text; focusing `About Operational OEE` shows the info text; `value={null}` renders "—"; the tile renders no "▲", "▼" or "prev." text.
- [ ] **Step 2:** `npx vitest run src/features/pla-analytics/dashboard/kpi-tile.test.tsx` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): shared KPI section and tile with info tooltips`.

### Task 9: Page header, time period control, For you, status

**Files:**
- Create: `src/features/pla-analytics/dashboard/time-period-control.tsx`, `dashboard-header.tsx`
- Modify: `analytics-dashboard.tsx`, `for-you-row.tsx`, `for-you-tile.tsx`, `src/features/pla-analytics/components/snapshot-status.tsx` (or wrap it)
- Test: `for-you.test.tsx`, new `dashboard-header.test.tsx`

**Interfaces:**
- `TimePeriodControl({ value, onChange }: { value: DashboardPresetKey; onChange: (key: DashboardPresetKey) => void })` — a labelled radio group ("Time period"), `data-testid="dashboard-window"`.
- `DashboardHeader({ scope, keyValue, onKey, orgOnly, plantName })` — h1 "Dashboard", the control, "As of …" and one Provisional/Approved badge whose popover holds the incomplete-data line and run details; when `orgOnly`, the line `` `Showing ${plantName} — organisation-wide figures are not available yet` ``. No description, no scope label, no timezone badge.

- [ ] **Step 1: Failing tests:** `getByRole('radiogroup', { name: 'Time period' })` has 6 radios with the exact labels; clicking "3 months" sets `?window=3m`; the page has no text "Key figures of the selected plant" or "in your scope"; `getAllByText(/^Provisional$/)` has length 1; For you row renders directly after the header (DOM order) and Pending approvals is its first tile with the attention class when count > 0; tile notes appear only via the ⓘ tooltip.
- [ ] **Step 2:** `npx vitest run src/features/pla-analytics/dashboard` → FAIL.
- [ ] **Step 3:** Implement; `analytics-dashboard.tsx` now composes `DashboardHeader`, `ForYouRow`, then the section components of Tasks 10–14 (stub them as the existing components until each task replaces one).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): Time period control, one status badge, For you row under it`.

### Task 10: OEE section

**Files:**
- Create: `src/features/pla-analytics/dashboard/oee-section.tsx`, `oee-trend-chart.tsx`, `oee-loss-chart.tsx`, `oee-section.test.tsx`
- Delete: `dashboard-oee.tsx` (and its uses); update `availability-captions.ts` users
- Test also: `availability-captions.test.tsx`, `kpi-unavailable.test.ts`, `dashboard-headings.test.ts`

**Interfaces:** consumes `KpiSection`, `KpiTile`, `useDashboardScope`; queries `useOeeReport(oeeQuery(scope,'unit','operational'))`, the same with `'reconciled'`, `useOeeReport(oeeQuery(scope, scope.trendBy, 'operational'))` for the trend, `useLossTree(lossTreeQuery(scope, { groupBy: 'oee', metric: 'qty' }))` for the companion.

- [ ] **Step 1: Failing tests:** five tiles titled exactly "Operational OEE", "Availability", "Performance", "Quality", "Reconciled PLA OEE"; no text "(ISO 22400)" outside tooltips; the ISO 22400 text and the availability caption are in the info tooltips; link "OEE and downtime report" only with `canViewAnalysis`; trend chart receives one row per `groups[]` entry in server order and draws no target line; with an empty `groups[]` the chart shows the empty state; loss chart renders one bar per unit of measure group and never sums across units of measure.
- [ ] **Step 2:** `npx vitest run src/features/pla-analytics/dashboard` → FAIL.
- [ ] **Step 3:** Implement (charts lazy via `React.lazy`; trend via `SeriesChart` with A/P/Q series toggleable through a legend button group, default OEE only).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): OEE section with trend and loss by OEE category`.

### Task 11: Production vs plan section

**Files:**
- Create: `production-plan-section.tsx`, `plan-trend-chart.tsx`, `top-loss-reasons.tsx`, `uom-picker.tsx`, `production-plan-section.test.tsx` (all under `src/features/pla-analytics/dashboard/`)

**Interfaces:** consumes Task 5 fields via `useReconciliationTrend(trendQuery(scope))`; `useLossTree(lossTreeQuery(scope, { groupBy: 'reason', metric: 'qty', limit: 5 }))`. `UomPicker({ uoms, value, onChange })` hidden when `uoms.length < 2`; default = the uom whose `totals` row has the largest `plan` (choose by comparing server values, no arithmetic).

- [ ] **Step 1: Failing tests:** tiles "Plan", "Actual", "Shortfall", "Explained loss", "Unexplained" read `totals[uom]` values verbatim; notes "% of plan"/"% of shortfall" show `unexplainedOfPlan` / `unexplainedOfShortfall` formatted as percent; "above target" note when `unexplainedAboveTarget` is true; with two uoms the picker appears and switching it swaps every tile and the chart; no rendered value equals the sum of the two uoms' plans; chart bars stack `actual`, `explained`, `unexplained` per bucket; link "Production loss analysis".
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): Production vs plan section with plan trend and top loss reasons`.

### Task 12: Downtime section

**Files:**
- Create: `downtime-section.tsx`, `downtime-trend-chart.tsx`, `downtime-pareto.tsx`, `use-downtime-series.ts`, `downtime-section.test.tsx`
- Modify/Delete: `dashboard-downtime.tsx` (keep `DashboardTopAssets` → moved in Task 13)

**Interfaces:** `useDowntimeSeries(scope): { rows: SeriesRow[]; isLoading; isError }` — for each `scheduleClass` in `['planned','unplanned','external','unknown']` one `useDowntimeReport({ ...scopeBase(scope), groupBy: scope.trendBy, metric: 'duration', scheduleClass })` plus one `metric: 'frequency'` (no class) for stops; rows joined by group `key` (selection, not arithmetic). Use `/reports/downtime-bundle` instead if its DTO allows these combinations in one call — check `kpi-reports-v2.dto.ts:218+` first.

- [ ] **Step 1: Failing tests:** tiles exactly "Total downtime", "Planned", "Unplanned", "Stops", "Scheduled availability" from `summary[]` (`downtime_total`, `downtime_planned`, `downtime_unplanned`, `stop_count`, `scheduled_availability`); "Controllable" switch still adds the controllable tile; "not the OEE availability" caption only in the tooltip; trend legend lists External/Unknown only when a value is non-zero; Pareto shows the top 5 `groupBy=reason&scheduleClass=unplanned` groups with `cumulativeShare` as the line; with an asset node, tiles show "Total downtime"/"Stops" from that asset's `groupBy=asset` row and the trend subtitle says it shows the unit.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): Downtime section with planned/unplanned trend and cause Pareto`.

### Task 13: Asset reliability section

**Files:**
- Create: `reliability-section.tsx`, `mtbf-trend-chart.tsx`, `reliability-section.test.tsx`
- Modify: `rca-tiles.tsx` (render through `KpiTile`), move `DashboardTopAssets` here as `top-assets-table.tsx` with a Downtime column
- Test: `rca-tiles.test.tsx`

**Interfaces:** `useReliabilityTrend({ ...scopeBase(reliabilityScope), assetIds: node.assetId ? [node.assetId] : undefined })` where `reliabilityScope` = `scope` when the period is ≥ 3 months, else the same node over the last 6 months (`dashboardScope('6m', node)`); chart draws `total.months` (MTBF and MTTR, hours). Top assets: `repeatQuery(scope,'asset')` (stops) + the same with `metric: 'duration'`, joined by key.

- [ ] **Step 1: Failing tests:** five tiles "Open investigations", "Overdue investigations", "Open critical", "Overdue actions", "Effectiveness pending"; links "Investigations" and (with `canViewAnalysis`) "Cause portfolio"; for a 7-day period the chart subtitle reads "monthly · last 6 months"; with an asset node the request carries `assetIds=[assetId]`; table columns Asset / Stops / Downtime.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): Asset reliability section with MTBF/MTTR trend and most-stopped assets`.

### Task 14: Reconciliation and latest events row; cleanup

**Files:**
- Modify: `reconciliation-tiles.tsx` (through `KpiTile`, no "Periods by workflow state" title), `latest-events.tsx`, `analytics-dashboard.tsx`
- Delete: components no longer used; update `dashboard-headings.test.ts`, `dashboard-links.test.ts`, `pla-analytics-flows.test.tsx`, `qa-reports-window.test.tsx`
- Modify (strings only, do not run): `e2e/personas/manager-6-analytics.spec.ts:177`, `e2e/pla-analytics-an02.spec.ts:186` (`'Operational OEE (ISO 22400)'` → `'Operational OEE'`), `e2e/personas/operator-analytics-tasks.spec.ts:79`, `e2e/personas/operator-scope-and-roles.spec.ts:62` (drop the `scope-header` "All units in your scope" assertion; assert the hierarchy breadcrumb instead)

- [ ] **Step 1:** Update the listed vitest files to the new headings and links; add `it('no card repeats its section name')` over all section titles.
- [ ] **Step 2:** `npx vitest run src/features/pla-analytics` → FAIL then implement the row (`grid gap-4 xl:grid-cols-2`) and delete dead code → PASS.
- [ ] **Step 3:** Verify `analytics-dashboard.tsx` ≤ 150 lines and every new file ≤ 400.
- [ ] **Step 4:** Commit: `refactor(dashboard): reconciliation and latest events side by side; remove replaced components`.

### Task 15: Final verification

- [ ] **Step 1:** Root: `npm run lint` (0 errors), `npm run typecheck` (clean), `npm run api:types:check` (clean), vitest by chunks: `src/features/shell`, `src/features/auth`, `src/features/plant-selector`, `src/features/display-currency`, `src/features/pla-analytics`, `src/features/downtime-analysis`, `src/features/event-hub`, `src/features/ux-kit`.
- [ ] **Step 2:** Server: `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npx jest src/v2/units src/v2/pla-reports src/v2/ops-reports src/v2/openapi-v2.spec.ts`, `npm run test:int` for the touched suites.
- [ ] **Step 3:** Start the app (`npm run dev` on :8070 with the API on :4004), sign in as `test@example.com`, and screenshot the dashboard in light and dark at 1440 px and 390 px into `.superpowers/brainstorm/`; check the hierarchy switch plant → unit → asset re-scopes every section.
- [ ] **Step 4:** Report results verbatim to the owner and ask before running the updated e2e specs.
