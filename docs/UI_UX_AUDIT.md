# Pro-Act frontend: UI/UX and performance audit

**Date:** 2026-10-12. **Status:** analysis only. No product code was changed.

**Scope.** This audit covers the ten items the owner asked for (listed under Contents). For each item it gives the current state with evidence, the problems, and the recommended fix. It ends with an implementation plan that several agents can work on in parallel.

**Evidence base.**
- **Screenshots and timings.** A Playwright run in Docker (`http://localhost:8070`, the nginx production build) logged in through the UI as three users:
  - manager: Jonas Weber
  - operator: Liam Murphy
  - SuperAdmin: Helena Fischer

  Each user visited every menu route, every tab and the key sub-states at 1440×900 and 1280×720. That produced 205 captures and 210 screenshots, plus a separate plan dashboard and period workspace capture.
  - The run was read-only. Every non-GET API call except `auth/*` was aborted. The only calls aborted were 6 × `POST /api/audit-logs`, which the client sends on login.
  - Scripts and raw data are in the session scratchpad: `ux-audit/capture.cjs`, `period.cjs`, `analyse.cjs`, `results.json`, `analysis.txt`, `shots/`.
  - Screenshot names follow `<user>_<viewport>_<route>[__<sub-state>].png`, e.g. `manager_1440_events__drawer.png`.
- **Bundle.** A production build (`vite build`, output in the scratchpad, not the repo `dist/`).
- **Code review.** A read-only review of `src/` (app shell, `src/features/*`, legacy `src/pages/*` and `src/components/*`) and the backend `app-settings` and tenant modules.

**Caveats on the numbers.**
- "Content" is the time from navigation until `<main>` has text and no spinner or skeleton (`.animate-spin`, `.animate-pulse`, `aria-busy`). "Idle" adds the wait for network idle.
- A few pages that keep skeletons in a sub-panel finish later than their content time suggests. API durations come from Playwright request timing on localhost (Docker), so production latency is higher.
- **Feature flags.** All v2 flags are on in Demo Plant. Wherever this document says "v1 page (flag off)", that page is unreachable in the demo but still shipped.

---

## Contents

1. [Sidebar grouping](#1-sidebar-grouped-into-collapsible-sections)
2. [Congestion, overlapping overlays and tabs](#2-congestion-overlapping-overlays-and-tabs)
3. [Pagination on every long table](#3-pagination-on-every-long-table)
4. [React Query caching and debounced filters](#4-react-query-caching-and-debounced-filters)
5. [Frontend performance](#5-frontend-performance)
6. [Never show internal values](#6-never-show-internal-values)
7. [HCI and UI/UX heuristics](#7-hci-and-uiux-heuristics-nielsen-and-wcag-basics)
8. [Dialogs and drawers vs sub-pages](#8-long-dialogs-and-drawers-vs-sub-pages)
9. [Icons](#9-icons-to-a-standard)
10. [Persian (Jalali) / Gregorian calendar setting](#10-admin-setting-persian-jalali-vs-gregorian-calendar)
11. [Implementation plan](#11-implementation-plan)
12. [Appendix A: measured page timings](#appendix-a-measured-page-timings-1440900)
13. [Appendix B: list and table inventory](#appendix-b-list-and-table-inventory)
14. [Appendix C: internal values rendered to users](#appendix-c-internal-values-rendered-to-users)
15. [Appendix D: dialogs, sheets and drawers](#appendix-d-dialogs-sheets-drawers-tabs-and-z-index)
16. [Appendix E: React Query hook inventory](#appendix-e-react-query-and-fetching-inventory)
17. [Appendix F: icons and date-formatting site inventory](#appendix-f-icons-and-dates-full-inventory)

---

## Top findings (one screen)

| # | Finding | Evidence |
|---|---|---|
| 1 | The sidebar is a flat list of 20 items. Three items share `BarChart3`, two share `Calendar`, two share `Code`, two share `Database`. The default state is a collapsed icon rail whose links have **no accessible name**. The active highlight is wrong on `/rca-knowledge-base`: both RCA and Knowledge Base light up. | `src/features/auth/navigation-items.ts:37-94`; `src/components/Navigation.tsx:80,110-121`; `superadmin_1440_sidebar-expanded.png` |
| 2 | **Pages are extremely long because nothing is paged.** At 1440 px, the main column scrolls for 27,806 px on Audit Logs, 24,668 px on Admin Panel, 21,611 px on Production Plans, 17,700 px on Master Data → Units, 15,421 px on PLA → Trends, 13,572 px on Downtime and 11,247 px on Codes & Rules (the full code tree is rendered). | `results.json` `mainScrollHeight`; `manager_1440_codes-admin.png`, `superadmin_1440_audit.png` |
| 3 | About 110 lists and tables. Only 7 are virtualized, and none uses a numbered pager. The shadcn `ui/pagination.tsx` is imported nowhere. Twelve v2 lists load only their first page (limit 100–500) and **silently drop the rest**. The v1 pages that are always routed (Users, Tasks, Audit, Admin, Master Data) render whole arrays. | Appendix B |
| 4 | Internal values are visible across the app. Examples: `Refused (UOM_MIXED)` on every failed widget; `Reference: <uuid>` (7 places); `user d9800d1c` in revision history; `Run b4a182db · 2.5.0+kpi.2.7.0`; `oee_policy@1` on every report card; `complete_inputs`, `Tolerance zero`; raw `assetId` UUIDs and `apmType`/`codingState` keys in the event drawer; role tokens such as `TenantAdmin` in the header. | `manager_1280_period-workspace.png`, `manager_1440_events__drawer.png`, `manager_1280_dashboard.png`; Appendix C (about 150 sites) |
| 5 | **Downtime Analysis is the slowest screen.** It fires 12 API calls (10 × `/v2/reports/downtime`), with up to 17.7 s of summed server time and 1.3–2.2 s to content. It is still 1.1–1.6 s on a warm revisit, because preset windows are keyed to the millisecond and caches never hit. PLA Analytics takes 1.7–2.6 s, and the Dashboard 1.5–2.6 s even when warm. | Appendix A |
| 6 | **The slowest endpoints are all v2 reports** (p50 / max). These are backend work items: | |
|   | `GET /api/v2/reports/reconciliation-status`: 1.5 s / 2.6 s | |
|   | `GET /api/v2/reports/reconciliation-trend`: 1.3 s / 1.6 s | |
|   | `GET /api/v2/reports/actuals-quality`: 1.3 s / 1.4 s | |
|   | `GET /api/v2/reports/scope-waterfall`: 1.3 s / 2.5 s | |
|   | `GET /api/v2/reports/downtime`: 0.77 s / 2.0 s (116 calls in the run) | |
|   | `GET /api/v2/reports/reliability`: 0.6 s / 1.0 s | |
|   | `GET /api/v2/reports/oee`: 0.55 s / 1.5 s | |
| 7 | **React Query is set up with almost no caching help.** Only `staleTime: 30s` is configured. There is no `gcTime` tuning, `refetchOnWindowFocus` stays on, and there is **no `placeholderData`/`keepPreviousData` anywhere** (so every filter change shows skeletons), no prefetch, and no `initialData` from list caches. The legacy pages bypass React Query completely. | `src/app/query-client.ts:11-17`; Appendix E |
| 8 | **The app shell costs every page.** A cold load of any page makes 11 shell calls before page data: org, tenant, orgs, tenants, all units, all assets, branding, flags, sites, v2 units and reason codes. The **v1** master lists fetched for `PlantSelector` are unscoped full lists, and the route chunk only starts downloading after `/feature-flags` returns. | `events__reload` call list (Appendix A); `src/components/PlantSelector.tsx:58-63`; `src/features/v2-foundation/flagged-route.tsx:19-21` |
| 9 | **Bundle size.** The main chunk is **528 kB (164 kB gzip)**. The largest route chunks are Connectivity (v1, flag off) 555 kB, RCAModule (v1) 372 kB and MasterData 200 kB, plus the shared recharts/lodash chunks of 206 kB + 170 kB. There is no `manualChunks`. | §5 |
| 10 | **Shell noise and false status.** The header search box does nothing, the bell always shows a red dot, the Settings icon has no action, and the sidebar footer always says "System Online". `/settings` is a "coming soon" placeholder that still appears in the menu. Gradients and `scale-105` effects are layered over neutral v2 screens. | `src/components/Layout.tsx:136-187`, `Navigation.tsx:87-98`, `App.tsx:48-53` |
| 11 | **No date formatter covers the whole app.** There are about 105 `toLocale*` date sites in 41 files (browser zone and browser locale) next to the v2 `PlantTime` (171 uses in 70 files). `date-fns` and `react-day-picker` are installed but unused. Nothing stores a calendar preference. `Intl` with `calendar: 'persian'` can provide Jalali display with no new dependency. | §10, Appendix F |

---

## Part A: what was captured

| Persona | Menu routes seen (sidebar `aside nav a[href]`) |
|---|---|
| **manager** (Jonas Weber) | 13 routes: `/dashboard /reports /pla-analytics /production-plans /planning /events /downtime /rca /rca-knowledge-base /codes-admin /finance /tasks /audit` |
| **operator** (Liam Murphy) | 5 routes: `/dashboard /pla-analytics /events /downtime /tasks` |
| **SuperAdmin** (Helena Fischer) | 20 routes: the manager's routes plus `/master-data /users /admin /permissions /connectivity /enhanced-historian /settings` |

**Sub-states captured** (at 1440 px for each persona that can see the page):
- every tab of `/reports` (5), `/pla-analytics` (8), `/planning` (3), `/codes-admin` (7), `/finance` (2), `/master-data` (8), `/admin` (6), `/connectivity` (3) and `/enhanced-historian` (2);
- the open event drawer (`*_events__drawer.png`), from the "Open" button on Current stops;
- an RCA case (`*_rca__case.png`);
- a connection detail (`superadmin_*_connectivity__connection.png`);
- the plan dashboard and the period workspace (`manager_{1440,1280}_plan-dashboard.png`, `manager_{1440,1280}_period-workspace.png`);
- the expanded sidebar (`*_sidebar-expanded.png`);
- for each route, a warm revisit (`__warm`) and, for 4 heavy pages, a cold reload (`__reload`).

The per-page numbers are in [Appendix A](#appendix-a-measured-page-timings-1440900).

---

## 1. Sidebar grouped into collapsible sections

### Current state
- `NAVIGATION_ITEMS` is a flat array of 20 entries, plus Data Seeding in dev builds (`src/features/auth/navigation-items.ts:37-94`).
  - Gating is pure and tested: `visibleNavigationItems(capabilities, flagsOn)` at `:97-103`, tested in `navigation-items.test.ts`.
  - Rendering is in `src/components/Navigation.tsx` (133 lines). The collapsed state is `useState(true)` in `Layout.tsx:20`, so the sidebar starts collapsed and the state is not persisted.
- **What each persona sees in the menu:**
  - The SuperAdmin sees 20 icons stacked in a single rail. The rail overflows at 720 px height (`superadmin_1280_*.png`).
  - The operator sees 5 items, but the rail still uses the same icon set.
- **Duplicate icons:**
  - `BarChart3` ×3: Dashboard, Reports, PLA
  - `Calendar` ×2: Production Plans, Planning
  - `Code` ×2: Master Data, Codes & Rules
  - `Database` ×2–3: Knowledge Base, Historian, Data Seeding

  In the collapsed rail (the default), these items cannot be told apart (see `manager_1440_rca.png`).
- **Active state.** `location.pathname.startsWith(item.href)` (`Navigation.tsx:80`) highlights both `/rca` and `/rca-knowledge-base`, and highlights nothing on `/plans/:id`.
- **Accessibility.** Collapsed links contain only an icon and have no `aria-label`; the tooltip is not an accessible name. The toggle has only `title` and no `aria-expanded`.
- **Visual noise.** There is a gradient pill with `scale-105` and `hover:scale-102` (the latter is not even a Tailwind class), an injected purple→pink scrollbar `<style>` on every render, and a static "Quick Stats / System Online" footer (`Navigation.tsx:11-35,56-98,113-117`).
- **Labels don't match page titles:**
  - Connectivity / "Integration console"
  - Production Loss Analysis / "PLA Analytics"
  - RCA Analysis / "Root cause analysis"
  - Finance / "Finance — valuation"
- Tooltip copy contains "(v2)".

### Recommended fix
Add a `section` field to each item and a `NAV_SECTIONS` list. Keep `visibleNavigationItems` unchanged, and add a pure `groupNavigationItems(items)` that drops empty sections. A viewer or operator then never sees an empty "Administration".

| Section (icon) | Items | Icon changes (all exist in lucide 0.462) |
|---|---|---|
| **Overview** (`LayoutDashboard`) | Dashboard, Reports | Dashboard → `LayoutDashboard`; Reports → `FileBarChart` |
| **Production** (`Factory`) | Event Hub, Downtime Analysis, Production Loss Analysis, Production Plans, Plans/Profiles/Calendars | PLA → `ChartColumnDecreasing`; Production Plans → `CalendarClock`; Planning → `CalendarRange` |
| **Reliability** (`Microscope`) | RCA Analysis, Knowledge Base, Tasks | Knowledge Base → `BookOpen`; Tasks → `ListChecks` |
| **Integration** (`Cable`) | Connectivity, Enhanced Historian | Connectivity → `Plug`; Historian → `LineChart` |
| **Administration** (`ShieldCheck`) | Master Data, Codes & Rules, Finance, Users, Permissions, Admin Panel, Audit Logs, Settings (hide until it exists), Data Seeding (dev) | Master Data → `Boxes`; Codes → `Tags`; Permissions → `KeyRound`; Audit → `ScrollText` |

**Behaviour:**
- **Expanded sidebar:** section headers are `<button aria-expanded aria-controls>` built on `ui/collapsible`. The section that contains the active route is forced open. Keep links mounted when a section is closed (`forceMount` + `hidden`), because e2e helpers count `aside nav a[href]` (`e2e/personas/support/viewer-world.ts:85-90`). All sections are open by default.
- **Collapsed rail:** flat icons with section dividers, and `aria-label={item.name}` on every link.
- **Persisted state:** keep `{collapsed, openSections}` per user in localStorage, wrapped in try/catch, in a `use-nav-state.ts` hook following `plant-selection-store.ts`.
- **Active state:** use NavLink's `isActive`, plus `activeAlso: ['/plans/']` for Production Plans.
- **Cleanup in the same change:**
  - remove the gradients, scale effects, the injected `<style>` and the static footer;
  - keep the toggle's accessible name exactly "Expand sidebar"/"Collapse sidebar" (`e2e/personas/integration-01-access.spec.ts:22,37`).
- **Tests:** update `navigation-items.test.ts`. It compares against the `PREVIOUS_MENU` order at `:15-37,52-59,143-146`. Add a test per role that empty sections are hidden.

---

## 2. Congestion, overlapping overlays and tabs

### Evidence
- **Fixed header (`z-30`, 80 px) and fixed sidebar (`z-20`).**
  - `<main>` is a fixed-height `overflow-y-auto` box (`Layout.tsx:59-204`), so the page scrolls inside an inner pane. Browser full-page screenshots and print only capture one viewport; the capture had to inject CSS to get full pages.
  - The header holds, in one 80 px row: logo + app name + subtitle, the plant breadcrumb, a currency toggle, a 256 px search box that does nothing, a bell, a settings icon, and a user card with name + role + logout.
  - At 1280 px the right-hand cluster crowds the plant selector (`manager_1280_dashboard.png`).
- **Event drawer (`Sheet`).** It covers about 47 % of the width at 1440, and the Current-stops panel behind it is half covered. Its body stacks:
  - a summary,
  - three action buttons,
  - an RCA panel with a skeleton,
  - a 5-tab `TabsList` (Source vs effective / History / Review / Evidence / Periods),
  - a field table showing raw keys and UUIDs.

  The drawer scrolls on its own while the page under it keeps its own scroll (`manager_1440_events__drawer.png`).
- **Period workspace** (`manager_1280_period-workspace.png`). A **period grid squeezed into an inner scroll box about 120 px high** (only 2½ rows visible) sits above a long detail. That detail has:
  - 6 filter pills of internal tokens,
  - a 6-way tab row (Revision / Current / Approved / Ledger / Plan / Capacity) with two different visual groupings in one row,
  - 9 metric tiles,
  - a 13-row ledger table,
  - candidates,
  - manual lines,
  - the workflow bar,
  - the waterfall chart and its table,
  - loss value,
  - history,
  - proposals.

  All of this is one page about 2,200 px tall at 1280 px.
- **Dashboard** (`manager_1280_dashboard.png`). Each of the 4 cards repeats the same "Incomplete data — Only calculated periods are counted." banner and the same footer ("Provisional · 1611 calculation runs · Coverage 92 % · Policy oee_policy@1"). That is 8 repeated blocks on one screen.
- **Tabs that overflow or crowd** (full list in Appendix D):
  - Master Data uses `grid-cols-8` for 8 tabs (`src/pages/MasterData.tsx:640`).
  - PLA Analytics has 8 tabs (`pla-analytics-page.tsx:41-47`).
  - Codes & Rules has 7 tabs, not in the URL (`codes-admin-page.tsx:36-48`).
  - The event drawer has 5 tabs.
  - The period detail has 6 view toggles.
- **Overlays: the layering itself is correct, the overlays are not.** Radix overlays and the custom modals are `z-50`, portalled, and above the `z-30` header, so nothing is hidden under the header. The real problems are these:
  - **21 hand-rolled `fixed inset-0 z-50` modals** have no `role="dialog"`, focus trap, Escape or scroll lock, and they stack only by DOM order. 17 are in `RCAModule.tsx`; the others are `EventHub.tsx:2167`, `DataSourceManager.tsx:1979` and `DataTransformationPanel.tsx:481,561`.
  - **`LogicTreeBuilder.tsx:390,427`**: its `absolute inset-0` "modals" cover only the scrolling tree pane, so they scroll away with it.
  - **About 15 Radix dialogs have no `max-h`/overflow.** They are centred with `translate-y-[-50%]` while page scroll is locked, so the title and Save button fall off-screen. The worst is v1 "Create Event" with about 31 fields, `EventHub.tsx:1125`. Others: `PlanDashboard.tsx:2294,2995,3339`, `AssetList.tsx:343`, `UnitList.tsx:378`, `AdminPanel.tsx:568`, `MasterData.tsx:885`, `Tasks.tsx:343`, `profile-editor-dialog.tsx:66`. `PlanForm.tsx:363` has `min-h-[600px]`, which beats `max-h-[95vh]`.
  - **Stacks of 3 levels:** Sheet → event form → conflict dialog; Sheet → link-RCA dialog; PlanForm → approval workflow; Reconcile → select event.
  - **Two toast systems** (`App.tsx:107-108`, shadcn `Toaster` and `Sonner`) stack in the same bottom-right corner. Below 640 px the shadcn viewport moves to the top and covers the header.
  - **Dead layers:** `PlanDashboard.tsx:1312-1314` has invisible `fixed` blur and gradient layers under the header.

  See Appendix D for each site.
- **Long single-page dumps.** Codes & Rules renders every reason code in one tree (11,247 px, `manager_1440_codes-admin.png`). Audit Logs renders up to 500 rows (27,806 px).

### Recommended fix
- **Shell.**
  - Make `<main>` the document scroller: drop the `h-screen overflow-hidden` + inner `overflow-y-auto`, make the header `sticky`, and offset the sidebar.
  - Remove the dead search, bell and settings controls. Bring them back only when they work, e.g. a `cmdk` command palette for search, which is already a dependency.
  - Shorten the header: app name without subtitle, a compact user menu (`DropdownMenu`) holding role, read-only state and logout.
- **Layering scale.** Use one scale in `tailwind.config` (e.g. header 30, sidebar 20, popover 50, dialog 50, toast 100) and forbid `z-[…]` literals through lint.
- **Replace hand-rolled modals** with `ui/dialog` and `ui/alert-dialog`.
- **Density.**
  - Show the "Incomplete data" and provenance footer **once per page** in the `ScopeHeader`, not per card. Cards get a small "provisional" chip.
  - Move secondary provenance (runs, policy versions, coverage) into a "Details" disclosure.
- **Tabs.** Use one `ResponsiveTabs` primitive in `features/ux-kit` that becomes a `Select` below `md` or when there are more than 5 tabs, and keeps the active tab in `?tab=`.
- **Period workspace and event drawer.** Move them to routes (§8). This removes the 120 px nested scroll box and the 5-tab drawer.

---

## 3. Pagination on every long table

### Current state
- There are about 110 lists and tables. The full inventory is in [Appendix B](#appendix-b-list-and-table-inventory).
- **Paging primitives that exist today:**
  - `useV2InfiniteList` (keyset `cursor` + `limit`, **no total count**), `src/api/v2/queries/use-v2-list.ts:25-44`.
  - `VirtualList` with `onEndReached` (`src/features/ux-kit/virtual-list.tsx`), used in 7 places.
  - A `LoadMore` button (`features/plans-profiles-calendars/components/load-more.tsx`).
  - Three inline "Load more" buttons.
  - Two hand-rolled pagers: `TimeSeriesTable` (client-side, 50 per page) and PI event frames.
  - `src/components/ui/pagination.tsx` is **imported by nothing**.
- **Page sizes vary:** 5, 20, 25, 50, 100, 200 and 500.
- **Measured page heights** (1440 px, `mainScrollHeight`):

  | Page | Height |
  |---|---|
  | Audit Logs | 27,806 px |
  | Admin Panel (users + units + tenants, all tables) | 24,668 px |
  | Production Plans (v1 PlanList) | 21,611 px |
  | Master Data → Units | 17,700 px |
  | PLA Trends | 15,421 px |
  | PLA OEE | 14,556 px |
  | Downtime | 13,572 px |
  | Codes & Rules | 11,247 px |
  | Master Data → Products | 10,492 px |
  | Master Data → Assets | 7,210 px |
  | Reports → Downtime | 6,941 px |
  | Permissions | 6,712 px |
  | Users | 6,444 px |

### Worst offenders
1. **v1 screens that are always routed** (no v2 version) render whole arrays, with no server paging:
   - Users (`src/pages/UserManagement.tsx:347`)
   - Permissions (`PermissionsManagement.tsx:98`)
   - Admin Panel (`AdminPanel.tsx:377,417,463,514`)
   - Tasks (`Tasks.tsx:300`)
   - Audit (`AuditLogs.tsx:277`; the backend hard-caps at 500, `reporting.service.ts:287`)
   - Products, Units and Assets (`ProductList.tsx:182`, `UnitList.tsx:518`, `AssetList.tsx:529`)
   - Plant hierarchy (`PlantHierarchyManager.tsx`)
   - v1 PlanList (`components/production-plans/PlanList.tsx:97`)
2. **v2 lists that fetch only the first page** and silently truncate:
   - code tree (500), mapping rules (500), profile and valuation rates (500)
   - signals (200), source mappings (200), rules (200), calendar versions (200)
   - ingestion jobs (100), connections (100), plan versions (100)
   - RCA case search (50), evidence picker (50)
3. **Unbounded aggregate tables:**
   - loss tree (`pla-analytics/components/loss-table.tsx:28`)
   - downtime trend (`trend-panel.tsx:67`)
   - overdue periods (`reconciliation-tab.tsx:74`)
   - OEE by product (`oee-group-table.tsx:29`)
   - calendar shift preview (`calendar-preview-table.tsx:24`)
4. **Infinite scroll and load-more lists** add 25–200 rows at a time. They do not show 20-row pages.

### Recommended fix
Add a shared `usePagedList` hook and a `<ListPager>` component in `src/features/ux-kit/`, built on `ui/pagination.tsx` (First / Prev / "Page N" / Next). There are two modes:

- **Server-paged (v2):**
  - Wrap `useV2InfiniteList`. Keep `pageIndex` in state, render `data.pages[pageIndex].items`, and call `fetchNextPage()` on Next at the last cached page.
  - Add a `pageSize` option with `DEFAULT_PAGE_SIZE = 20` to `V2ListOptions`, so one pager page equals one server page.
  - Reset `pageIndex` when the key changes.
  - Without a total count, show "Page N" plus Next while `hasNextPage` is true. Optionally ask the backend for an `estimatedTotal`; that is an API change, so flag it.
- **Client-side** (aggregates, previews, v1 arrays): slice a `readonly T[]` into pages of 20.
  - This covers every shadcn `Table` user and the v1 tables without backend changes.
  - v1 lists still download everything, so Users, Tasks and Audit also need server paging (`limit/offset` on `GET /users`, `/tasks` and `/reports/audit-trail`, flagged as API changes) or v2 replacements.

**Additional rules:**
- Reference lists used as **lookups** (units 500, codes 500, products 500) are not displayed tables. Keep them unpaged, but stop truncating silently: follow `nextCursor` or fail loudly.
- The code tree should page over **root nodes**, or switch to a searchable, collapsed-by-default tree. Expanding all 1,000+ nodes is the actual problem.
- Keep `VirtualList` for heavy row renderers within a page.

---

## 4. React Query caching and debounced filters

Full hook inventory: [Appendix E](#appendix-e-react-query-and-fetching-inventory).

### Current QueryClient
`src/app/query-client.ts:11-17`:

| Setting | Value |
|---|---|
| `staleTime` | 30 s |
| `retry` | `shouldRetryQuery` (no retry on 4xx, otherwise 2) |
| `gcTime` | default **5 min** |
| `refetchOnWindowFocus` | default **true** |
| `refetchOnReconnect` | default **true** |
| Persister | none |

**Per-resource stale times** (`src/api/v2/queries/stale-times.ts:9-43`):
- reference data: 5 min
- flags: 1 min
- events, periods: 30 s
- reports: `Infinity`
- jobs: 0

The cache is cleared on tenant or session change (`v2-session-bridge.tsx:47-56`).

### Why data does not appear "in milliseconds" today (measured)
1. **Keys never repeat.**
   - Preset windows ("Last 7 days", "Last 24 h") are computed from `Date.now()` to the millisecond:
     - `downtime-analysis/model/downtime-filters.ts:43-44`
     - `pla-analytics/model/analytics-scope.ts`
     - `event-hub/model/event-filters.ts:96-97`
     - `analytics-dashboard.tsx:42`
   - So reports with `staleTime: Infinity` still miss on every revisit.
   - Measured warm revisits: Downtime `__warm` 1.1–1.6 s and 12 calls; Dashboard `__warm` 1.5–2.6 s and 4–5 calls; PLA `__warm` 1.1–2.3 s.
   - Pages without time windows do come back from cache: Planning, Codes, RCA and Finance warm content in 1–4 ms with 0–1 calls.
2. **No `placeholderData: keepPreviousData` anywhere.** `dataStateOf` maps `isLoading` to a skeleton (`ux-kit/data-state-of.ts:32`), so every filter change blanks every card. This hits Downtime (about 10 cards), PLA tabs, Event Hub, the period grid and the PeriodDetail view toggle.
3. **No prefetch and no `initialData` from list caches.** Opening an event, an RCA case, a rule, a connection or a plan always waits for the detail call.
4. **Shell waterfall on every cold load:**
   - `AuthContext`: refresh → profile → org → tenant, in series (`AuthContext.tsx:128→53→209→218`).
   - Then `FlaggedRoute` waits for `/feature-flags` before the lazy chunk is even requested.
   - Meanwhile `PlantSelector` downloads 4 unscoped master lists.
   - Measured `events__reload`: 14 calls before and with the page (Appendix A).
5. **The timezone is part of the key but is not sent to the server.**
   - `usePlantTimezone` returns `UTC` until `/v2/sites` loads, so lists and reports can be fetched twice.
   - Affected keys: `production-events.ts:26`, `reports.ts:33-40`, `period-overview.ts:36`.
6. **Duplicate calls within one page load** (measured):
   - Downtime: 10 × `/v2/reports/downtime` (distinct group-bys, so legitimate but expensive).
   - Dashboard: 2 × `/v2/reports/oee`.
   - PLA Trends: 3 × `/v2/reports/oee`.
   - Events: 2 × `/v2/production-events` (list + current stops).
   - Master Data: every v1 list twice; units and assets 3× on the warm pass (header `PlantSelector` plus the page).
   - Reason codes are fetched under two keys: `useCodeList` vs `useCodeLibrary` (`codes-admin.ts:32`, `reference-data.ts:22`).
7. **Realtime over-invalidation.**
   - Each socket notice triggers `invalidateForChange` immediately, with no coalescing (`realtime/use-scoped-realtime.ts:49-56`).
   - A `production_event` notice invalidates 5 resources (`invalidation.ts:16`).
   - Detail keys always match (`invalidation.ts:65-68`).
   - Reconnect resyncs the whole tenant **and** React Query refetches on reconnect.
   - Infinite lists refetch all loaded pages one after another (no `maxPages`).
8. **Polling.**
   - `useIngestionJobs` and `useJobTransitions` poll every 5 s with no stop condition (`ingestion-jobs.ts:23,35`).
   - Current stops poll every 30 s **and** are realtime-invalidated.
   - Job polls (1–3 s) never back off.
9. **Legacy pages** (`src/pages`, `src/components`) use `useEffect`+`useState` with no cache and no `AbortController`. The worst case is v1 PLA Dashboard, which downloads the full event list 5× in parallel (page + 4 child charts) and again on every in-browser filter.

### Filters without debounce
- `useDebouncedValue` exists (`src/features/ux-kit/use-debounced-value.ts`). It is used correctly in RCA case search, knowledge search, the event form and the rule editor.
- Un-debounced inputs that drive requests:

| Location | Input | Cost per change |
|---|---|---|
| `features/event-hub/components/event-filters-bar.tsx:41-52` | `MultiCheckSelect` | 2 requests per checkbox click |
| `features/downtime-analysis/components/downtime-filters-bar.tsx:37,77-78` | units filter and toggles | about 12 requests per click |
| `features/pla-analytics/components/analytics-filters.tsx:29` | units filter | |
| `pages/Reports.tsx:215,219` | date inputs | 6 requests per change |
| `pages/AuditLogs.tsx:193,197` | date inputs | |
| `pages/PLADashboard.tsx:537,547` | dates and every select | full event download per change |

- About 20 in-memory text searches run O(n) per keystroke over fully loaded arrays. They are listed in Appendix E.

### Recommended fix
1. **Defaults.**
   - `gcTime: 30 min`.
   - `refetchOnWindowFocus: false` and `refetchOnReconnect: false`. Realtime resync already covers both; re-enable them only while the socket reports disconnected.
   - Reference data `staleTime` 10 min. Explicit `staleTime: 0` on the bulk, plan-generation and rate-import job hooks.
2. **Stable keys.**
   - Round preset windows to the minute (or 5 min) and freeze them for the session of a page.
   - Drop `tz` from keys, or gate the queries on `!zone.loading`.
   - Unify the reason-code keys.
3. **`placeholderData: keepPreviousData`** in `useV2InfiniteList`, `useReport`, `usePeriodRead`, `useWaterfall` and `useLossValue`. `dataStateOf` should show a thin "Refreshing…" bar when `isPlaceholderData || (isFetching && !isLoading)` instead of a skeleton.
4. **Prefetch.**
   - On hover or focus of nav links: preload the route chunk with `import()` plus the page's first query.
   - On hover of rows (event, period, plan, RCA case, knowledge entry, quarantine item): `prefetchQuery` the detail.
   - After login: prefetch flags, sites and units.
   - Seed detail queries with `placeholderData` from the list cache.
5. **Shell.**
   - Run `getOrganization` and `getTenant` in parallel.
   - Prefetch flags in `V2SessionBridge`.
   - Move `PlantSelector` to v2 `useSites`/`useUnits` (or a tenant-scoped hierarchy endpoint), and stop fetching all assets for the header.
6. **Realtime.**
   - Coalesce notices for 250–500 ms per resource.
   - Target detail keys by `entityId` and unit.
   - Use `cancelRefetch: false`.
   - Set `maxPages` (for example 5) on infinite lists.
7. **Polling.** Slow ingestion-job polling to 10–15 s and stop it when realtime is connected. Add backoff to job polls (1 s, then 2 s, then 4 s, capped at 5 s).
8. **Debounce.**
   - Commit `MultiCheckSelect` changes on popover close, or debounce them by 300 ms.
   - Debounce date inputs by 300 ms.
   - Wrap in-memory text filters in `useDeferredValue`.
9. **Legacy pages that remain** (Users, Tasks, Audit, Admin, Master Data, Production Plans): wrap the v1 lists in shared `useQuery` hooks (`['v1', tenantId, 'units']`, staleTime 10 min) so the header and the page share one fetch.

---

## 5. Frontend performance

### Bundle
Production build: `vite build`, 164 JS chunks. All routes are lazy (`src/app/lazy-pages.ts`).

| Chunk | Raw | gzip | Notes |
|---|---|---|---|
| `Connectivity` (v1, flag off) | 555 kB | 106 kB | statically imports `StreamingDashboard` + `RealTimeCharts` (recharts) and the whole v1 integration suite |
| **`index` (main/shell)** | **528 kB** | **164 kB** | see below |
| `RCAModule` (v1, flag off) | 372 kB | 91 kB | 6,629-line file; statically imports reactflow (`EventDiagram`), react-chrono, and every RCA tool |
| `_baseAssignValue` (lodash via recharts) | 206 kB | 65 kB | shared chart dependency |
| `MasterData` | 200 kB | 52 kB | statically imports `@react-spring/web`, `@dnd-kit` (`RCASettings`), `PlantHierarchyManager` and every tab |
| `generateCategoricalChart` (recharts core) | 170 kB | 41 kB | shared |
| `PlanDashboard` (v1) | 158 kB | | |
| `index.css` | 141 kB | 21 kB | |
| `EventHub` (v1) | 123 kB | | statically imports `TimeSeriesChart` |
| `ProductionPlans` | 93 kB | | |
| `integration-console-page` | 74 kB | | |
| `PLADashboard` (v1) | 72 kB | | |

**What is in the main chunk:**
- react, react-dom, react-router, TanStack Query and socket.io-client (the realtime bridge is mounted globally);
- the Radix primitives used by the shell: tooltip, toast, select and popover (`PlantSelector`, `DisplayCurrencyToggle`);
- sonner **and** the shadcn toaster (two toast systems, `App.tsx:105-108`);
- the lucide icons used in the shell;
- `AuthContext`, `MasterDataService` + `masterDataApi` (v1), `BrandingService`;
- the v2 client.

**Recommendations:**
- Use `manualChunks` to split `react-vendor`, `query`, `radix` and `socket` so they cache long-term across deploys.
- Drop one of the two toasters.
- Lazy-mount `RealtimeBridge` after the first paint.
- Make `MasterDataService` a dynamic import outside the legacy pages.
- Remove `@nestjs/swagger` and `swagger-ui-express` from the frontend `package.json`: they are not imported by `src` (needs owner approval).
- Remove `date-fns`/`react-day-picker` if no date picker is adopted (§10).
- Remove the unused embla carousel and resizable UI.
- Turn on `@typescript-eslint/no-unused-vars` (off at `eslint.config.js:26`). `pages/PLADashboard.tsx` alone imports 56 unused icons.

### Lazy-loading gaps (heavy components imported statically)
- recharts in `pages/AuditLogs.tsx:8-13` (via `ReportCharts`). An audit table does not need charts up front.
- recharts in `pages/Reports.tsx:15-22`, `pages/PLADashboard.tsx:3-6`, `pages/Connectivity.tsx:21-22`, and `TimeSeriesChart` in `EventHub.tsx:31`, `RCAModule.tsx:42`, `PIIntegration.tsx:17` and `EnhancedHistorianPage.tsx:27`.
- reactflow and react-chrono in `RCAModule.tsx:37-38`. The RCA tools at `:11-17` are each shown only in their own tab.
- `@react-spring/web` and `@dnd-kit` in MasterData, and the `RCASettings` tab.
- **v2 is already good:** every recharts use is behind `lazy()` (`reason-pareto.tsx:14`, `trend-panel.tsx:12`, `loss-tree-tab.tsx:15`, `trends-tab.tsx:17`, `residual-trend-card.tsx:12`). The one exception, `plan-dashboard/components/waterfall-panel.tsx:7`, is inside the lazy `PeriodDetail`.

### Re-render hot spots
- **`AuthProvider`.** Its value is a new object literal on every render, and its functions are not memoised (`src/contexts/AuthContext.tsx:335-346`). This re-renders 57 `useAuth()` consumers.
- **`PlantSelectionProvider`.** Same problem (`PlantSelectionContext.tsx:37-45`).
- **`PlantSelector`.** It filters tenants, units and assets per node per render, over **all** assets in the header (`PlantSelector.tsx:130,166,194`).
- **`Navigation`.** It injects a `<style>` tag on every render (`Navigation.tsx:58`).
- **Legacy pages:**
  - `pages/EventHub.tsx:786-866`: 10 chained filters plus counts, over the tenant's full event list, every render, with 0 `useMemo`.
  - `RCAModule.tsx`: 63 `useState` and 1 `useMemo`.
  - `PlanDashboard.tsx` (3,417 lines), `Dashboard.tsx`, `MasterData.tsx`, `Connectivity.tsx`: no memoisation.
- **v2 (minor):**
  - `event-hub-page.tsx:47`: `flattenPages()` is not memoised, so `VirtualList` gets a new array every render.
  - `reports-page.tsx:42-43`: a sort on every render.
  - `downtime-page.tsx:82`: a new filter object every render.

There are 51 `.tsx` files over 400 lines. No non-test file under `src/features` exceeds about 115 lines. The list is in §7.

### Slowest pages and API calls (measured, 1440 px)

| Page | Content | API calls | Summed server time | Endpoint(s) responsible |
|---|---|---|---|---|
| PLA Analytics (first tab, waterfall) | 1.7–2.6 s | 1 (+11 shell on reload) | 1.6–2.5 s | `GET /v2/reports/scope-waterfall` (`pla-analytics.ts:21`) |
| PLA → Reconciliation | 1.2–2.1 s | 1 | 1.2–2.1 s | `GET /v2/reports/reconciliation-status` |
| PLA → Quality coverage | 1.2–1.5 s | 1 | 1.2–1.4 s | `GET /v2/reports/actuals-quality` |
| PLA → Trends | 1.3–1.6 s | 5 | 2.8–3.8 s | 3 × `/v2/reports/oee` + `reconciliation-trend` |
| Downtime Analysis | 1.3–2.2 s | 12 | 11–17.7 s | 10 × `/v2/reports/downtime` + `reliability` + `production-events` |
| Dashboard (warm / reload) | 1.5–2.6 s | 4–5 / 15 | 3–6.9 s | 2 × `/v2/reports/oee`, `downtime`, `reconciliation-status` (1.8 s) |
| Reports → Reconciliation | 1.3–1.4 s | 1 | 1.3 s | `reconciliation-status` |
| Event drawer | settles in about 0.9 s | 4 | 0.5–1.6 s | `/v2/production-events/:id`, `/revisions`, `/v2/rca-knowledge/similar` (0.36 s p50, 0.77 s max) |
| Master Data (SuperAdmin) | 0.13 s | 16 | 4.6 s | every v1 list twice (PlantSelector + page) |
| Period workspace | 1.0–1.1 s to idle | 20 | about 1.5 s | 11 shell + plan + summaries + reconciliation → accounting (3-level waterfall) |
| Connectivity → connection | idle 5.8 s | 0 | | the click timed out: the selected item stays covered (see `superadmin_1440_connectivity__connection.png`) |

**Backend follow-ups** (not frontend):
- Profile `reports/reconciliation-status`, `reconciliation-trend`, `actuals-quality`, `scope-waterfall` and `downtime`. Each is 0.8–1.5 s at p50 on a month of Demo Plant data, so check them with `EXPLAIN ANALYZE`.
- Consider one `GET /v2/reports/downtime-bundle` (several `groupBy` in one call) to replace the 10 Downtime calls.
- Return `revisionNumber` with `reconciliation`, to remove the third level of the period waterfall.

---

## 6. Never show internal values

The full list of about 150 sites, each with file:line and its replacement, is in [Appendix C](#appendix-c-internal-values-rendered-to-users).

### Highest-impact sites (each is shared across many screens)

| Where | Shown today | Replacement |
|---|---|---|
| `src/features/ux-kit/data-state.tsx:61,64` (every widget error) | `Refused (UOM_MIXED)` + `Reference: <uuid>` | Human title from `refusalTitle(code)`. The code and correlation id go behind a collapsed "Technical details" disclosure with "Copy support reference". |
| `src/features/downtime-analysis/components/report-card.tsx:17` (every report card) | `Policy oee_policy@3,loss_policy@2` | "OEE policy v3 · Loss policy v2", inside the details disclosure |
| `src/features/plan-dashboard/model/display.ts:91` | `user d9800d1c` (`manager_1280_period-workspace.png`) | User display name from a user directory; "a former user" when unknown |
| `src/features/plan-dashboard/components/period-header.tsx:34-47` | `Run b4a182db · 2.5.0+kpi.2.7.0+val.2.6.0`, `oee_policy@1`, `reconciliation_tolerance@1`, `valuation_basis@2`, `Tolerance zero` | "Calculated 10 Oct 13:00", "Tolerance: none". Run, engine and policy versions go in the disclosure. |
| `src/features/plan-dashboard/components/period-grid*` | `complete_inputs` readiness token in the grid | `READINESS_LABELS` (already in `plan-dashboard/model/display.ts`) |
| `src/features/event-hub/components/source-effective-table.tsx:36-45` | Field keys `apmType`, `assetId`, `codingState`, `breachDuration` and full UUID values (`manager_1440_events__drawer.png`) | Field-label map, plus value resolvers (unit/asset/reason names, enum labels) |
| `src/features/event-hub/components/evidence-panel.tsx:26,37-38` | `JSON.stringify(sourceFacts)`, `5c0b12aa → 77e0…` | Key/value table; event time windows with "Open" links |
| `src/features/plan-dashboard/editor/candidate-row.tsx:36-39` | `auto · planning_rate · event d772ed60`, `(baseline_changed)`, `accept` select | "Automatic (planning rate) · from stop at 06:40"; Accept/Reject labels |
| `src/features/rca/use-unit-names.ts:14`, `plans-profiles-calendars/hooks/use-planning-refs.ts:21`, `integration-console/*` | `Unit 3f2a9c1b`, `id.slice(0,8)` | "Unknown unit" through one resolver |
| `src/components/Layout.tsx:172` (header, every page) and the Users, Permissions and Admin tables | `TenantAdmin`, `manager_approver`, `SuperAdmin` | `ROLE_LABELS` ("Plant administrator", "Manager approver") |
| `src/api/v2/errors.ts:92,100-101` | The code becomes the message when the server has none; "Request failed with status 502" | Status-class messages |
| `src/features/*-off.tsx` (6 files) | "feature flag 'v2.codesAdmin'" | "Ask a plant administrator to turn on Codes & rules" |
| RCA case list (`manager_1440_rca.png`), Event Hub reasons | Test fixture titles such as `P-REL-validation-d6e131f2`, `E2E-ALT-0227b199` | These are **data**, not UI: test units and codes leak into Demo Plant. Separate the e2e tenant from the showcase plant, or filter `E2E-`/`P-REL-` prefixes in the demo seeder. |

### Shared modules to add
1. **`features/ux-kit/labels.ts`.**
   - `humanize()`, moved from `event-hub/model/event-states.ts:61`.
   - `labelOf(map, value)`, which never falls back to the raw token.
   - All enum maps keyed by the generated API types. Several already exist and need to be centralised: `LIFECYCLE_LABELS`, `BASIS_LABELS`, `DISTRIBUTION_LABELS`, `JOB_STATE_DISPLAY`, `ERROR_CODE_INFO`, `METRIC_LABELS`.
2. **`features/ux-kit/refusal-messages.ts`.**
   - `refusalTitle(code, status)`, `issueLabel(code)`, `fieldLabel(path)`.
   - `describeError(unknown)`, used by every alert **and** every toast, v1 and v2.
3. **`features/ux-kit/support-reference.tsx`.** A "Technical details" disclosure that holds the code, HTTP status, correlation id, run id, hashes and cursors.
4. **`features/ux-kit/display-names.ts`.**
   - `useUserDirectory()` and `useReferenceNames()`, with one "Unknown …" fallback policy.
   - **API gap:** the v2 API returns actor ids only (`display.ts:87`). A user-name projection, for example `GET /v2/users/directory?ids=`, is a new contract. Flag it and update the OpenAPI snapshot.
5. **Lint guard.** A custom ESLint rule or a test that fails on `.slice(0, 8)` in JSX files and on `Reference:` literals.

---

## 7. HCI and UI/UX heuristics (Nielsen and WCAG basics)

### App shell (every screen)
- **Visibility of system status: false status.**
  - The bell has a permanent red dot (`Layout.tsx:146-153`).
  - The footer always says "System Online" (`Navigation.tsx:87-98`). The real realtime connection state is never shown (`RealtimeBridge` renders null).
  - **Fix:** remove both, and add a real `LiveIndicator` from `useScopedRealtime`.
- **Aesthetic and minimalist design.**
  - The header search box does nothing and has no label (`Layout.tsx:136-143`). The Settings button has no action (`:156-162`).
  - Gradients are layered on the header, page background, sidebar, scrollbar and active pill, which clashes with the neutral shadcn v2 screens.
  - The default brand is "Unified APM / UA". `document.title` is the app name on every route, so there are no per-page titles (WCAG 2.4.2).
- **Accessibility.**
  - The logout button is icon-only with no name (`:180-187`).
  - The app name is an `<h1>`, so every page has two `<h1>`s or skips to `<h2>`.
  - There is no skip link and no focus move on route change.
  - The **plant picker tree is built from `<div onClick>` with no role, tabIndex or keys** (`PlantSelector.tsx:133-233`). The scope that drives every screen cannot be chosen by keyboard (WCAG 2.1.1). **This is critical.**
- **Match with the real world.**
  - Copy contains decision codes and plan references: "Triggers only recommend (D13)", "Valuation (D08) partly open", "Plant calendar (D03)", "PI details are pending (D02)", "signals API, plan 1.7", "Push to CMMS is not available in R1 (D12)", "(v2)", "v1-only plan".
  - File:line for each is in the HCI section of Appendix C.
- **`/settings` and `/test-rca-tools`.**
  - `/settings` is a "coming soon" placeholder that appears in the menu (`App.tsx:48-53`).
  - `/test-rca-tools` is routed in production (`App.tsx:71`).

### Per screen (v2)

| Screen | Strengths | Problems (heuristic) | Fix |
|---|---|---|---|
| **Event Hub** (`features/event-hub`) | `DataState` on every list; `aria-live` "N loaded"; state chips have text | No deep link to an event or filters, and Back doesn't close the drawer (user control). Merge is disabled with no reason given (error prevention). The list is a div grid with no table semantics. The row checkbox label uses a raw ISO time. The time column wraps to two lines at 1440. | `/events/:eventId` route; filters in the URL; `DisabledReason` tooltip; `role="grid"` |
| **Downtime** | Filters in the URL; drill-through; lazy charts | About 9 stacked panels, 13,572 px; 12 calls; flicker on every filter | Section anchors or tabs; summary first; keepPreviousData |
| **Planning** | Tab in the URL | Decision codes in banners; hard-coded "Asia/Tehran" copy; profile **Retire is one click with no confirmation** (`profiles/version-actions.tsx:62-64`) | `ConfirmDialog` |
| **Plan dashboard / period** | Deep links; back link | Jargon ("residual = gap − attributed (server)", "slice", "ledger"); truncated UUIDs; 120 px nested period grid; free-text "Reason (reject / cancel)" next to the action buttons | Period route, full-height grid; glossary tooltips; reason as a required field in the reject dialog |
| **RCA** | Case in the URL; debounced search | Links are added by typing a **target id** (`links/add-link-form.tsx:34`), which forces recall instead of recognition. Logic-tree remove is one click. | Entity picker; confirmation or undo toast |
| **Integration console** | Destructive job commands confirm | Tab and connection not in the URL; title mismatch (menu "Connectivity", page "Integration console"); `TableRow onClick` | `/connectivity/connections/:id` |
| **Codes & Rules** | Retire confirms | 7 tabs, not in the URL; the full tree is expanded | `?tab=`; collapsed tree with search |
| **Finance** | Policy approval confirms | **FX Retire and Approve are one click** (`fx/fx-version-actions.tsx:40,51-53`) | `ConfirmDialog` |
| **PLA analytics / Reports / Dashboard** | Scope in the URL; lazy charts | 8 tabs; the Reports tab is not in the URL; the Dashboard scope is frozen at mount, so "Last 7 days" never rolls forward (`analytics-dashboard.tsx:42`); repeated banners; "Not available: no calculated periods" repeated in four cells (`superadmin_1440_sidebar-expanded.png`, Reports); the date column wraps "2026-10-" / "05" | One banner per page; date column `whitespace-nowrap` |

### Legacy pages still routed for everyone (no v2 version)

| Page | Problems |
|---|---|
| **Users** (`src/pages/UserManagement.tsx`) | No loading, error or empty state. Scope taken from `session.tenant` instead of the selected plant (violates CLAUDE.md). Icon-only Edit and Delete with no names. Delete uses native `confirm()`. |
| **Admin Panel** | Duplicates Users and Master Data. Generic `confirm('Are you sure…')`. 24,668 px tall. |
| **Permissions** | Rows are clickable divs. Deactivate is one click with an ambiguous Lock/Unlock icon. |
| **Master Data** | **"🔄 Fix DB" clears localStorage and sessionStorage and reloads with no confirmation**, which logs the user out (`MasterData.tsx:607-627`). "Quick Add" has no handler. `grid-cols-8` tabs. |
| **Enhanced Historian** | Hard-coded connection list; a **`Math.random` "CMMS test" toast** (`EnhancedHistorian.tsx:131`). This violates the no-fabricated-data rule. |
| **Audit Logs** | A load error renders as "No audit entries match your filters" (error shown as empty). No loading state in the table. Up to 500 rows. |
| **Tasks** | "No tasks found. Create one…" also shows while loading and for read-only roles. Free-text "Link ID". `<Label>` without `htmlFor`. Native `confirm()`. |
| **Production Plans** | No loading or error UI. The v1 dashboard opens through a state swap, so there is no URL and no Back. Native `confirm()`. |

### Cross-cutting a11y counts

| Issue | Count | Where |
|---|---|---|
| Icon-only buttons without a name | 89 in 44 files | 0 in `src/features` |
| Clickable non-interactive elements | 26 | |
| Unlabelled form controls | 225 in 47 files | 0 in `src/features` |
| Native `confirm`/`alert`/`prompt` | 43 | |
| Hand-rolled modals without `role="dialog"` | about 20 | |
| Colour-only status | 8 sites | |

Fabricated data in product code: `Connectivity.tsx:95`, `EnhancedHistorian.tsx:34-58,131`, `EventHub.tsx:498,1680,2383-2391`, `HistorianMicroTrends.tsx:344-354`, `DataFlowVisualization.tsx:105-159`.

### Primitives to add to `features/ux-kit`
- `PageHeader` (title, subtitle, actions, scope slot)
- `ConfirmDialog` (on `ui/alert-dialog`)
- `IconButton` (requires `aria-label`)
- `DisabledReason` (generalises `ApproveButton`)
- `LiveIndicator`
- `ResponsiveTabs`
- `ListPager`
- `SupportReference`

**Largest files** (CLAUDE.md limit is 400 lines): `RCAModule.tsx` 6,629 · `production-plans/PlanDashboard.tsx` 3,417 · `pages/EventHub.tsx` 2,511 · `pages/Connectivity.tsx` 2,298 · `integrations/DataSourceManager.tsx` 2,217 · `PIIntegration.tsx` 2,055 · `PLADashboard.tsx` 1,450 · `RCAKnowledgeBase.tsx` 1,436 · `BindingManager.tsx` 1,411 · `EnhancedHistorianPage.tsx` 1,148 · `MasterData.tsx` 1,135 · `Dashboard.tsx` 1,107. Most of these are v1 pages behind flags that are on, so **retiring them** (see §11, track L) removes most of the debt and most of the bundle.

---

## 8. Long dialogs and drawers vs sub-pages

The full inventory is in [Appendix D](#appendix-d-dialogs-sheets-drawers-tabs-and-z-index).

**Principle.** A dialog is for short, interruptive tasks: a confirmation, or up to about 5 fields with no tabs or tables inside. Anything that has tabs, tables, its own scroll, or that people want to link to or return to with Back should be a route.

| Current overlay | Size / content | Recommendation | Proposed URL |
|---|---|---|---|
| Event detail drawer (`features/event-hub/components/event-detail-drawer.tsx`) | Sheet at about 47 % width; summary, 3 actions, RCA panel, 5 tabs with tables | **Route** (master/detail: keep the list on the left at ≥1280, full page below) | `/events/:eventId` (`?tab=history`) |
| Event form dialog (`event-form-dialog.tsx:31`; create/edit/code) | `max-w-2xl max-h-[90vh]`; 12 fields + impacted-periods table + conflict sub-dialog (3-level stack over the Sheet) | **Route** for create/edit | `/events/new?unitId=`, `/events/:eventId/edit` |
| Link-to-RCA dialog (`rca/link-dialog/link-rca-dialog.tsx:49`) | 2 tabs (existing/new), search, evidence preview; opened over the Sheet | **Route** | `/events/:eventId/rca` |
| Bulk code dialog (`bulk-code-dialog.tsx:43`) | 1 picker + preview table (up to 50 rows + "N more") + job progress | Keep for now; make it a route if selections get large | (`/events/bulk-code?ids=`) |
| Merge / split / close-stop dialogs | Short forms | Keep as dialogs | |
| Period detail (already a deep link but rendered under the grid) | Full workspace | Make it a **full page**, with the grid as its own page | `/plans/:planId` (grid), `/plans/:planId/periods/:periodId` (workspace only) |
| Plan form / version dialogs (`plans-profiles-calendars/plans/plan-form-dialog.tsx`) | Multi-section form with slices editor | **Route** | `/planning/plans/new`, `/planning/plans/:planId/versions/:v/edit` |
| Profile editor and rate import dialogs | Rate tables, import report | **Route** | `/planning/profiles/:profileId`, `/planning/profiles/:id/import` |
| Calendar editor (shift templates, holidays, exclusions, preview table) | Several editors + preview table | **Route** | `/planning/calendars/:versionId/edit` |
| RCA create-case dialog | Few fields | Keep as dialog | |
| RCA case (already master/detail) | Tabs | Route already exists via `?case=`; switch to a path | `/rca/cases/:caseId` |
| Connection wizard (`integration-console/connections/connection-wizard.tsx`) | Multi-step | **Route** | `/connectivity/connections/new`, `/connectivity/connections/:id/edit` |
| Connection detail (state today) | Tabs: jobs, signals, mappings | **Route** | `/connectivity/connections/:id` (`?tab=jobs`) |
| Mapping editor / bind-source dialog | Field mapping table + preview | **Route** | `/connectivity/mappings/:id` |
| Quarantine exception detail | Detail + raw payload | **Route** | `/connectivity/quarantine/:exceptionId` |
| Codes: code editor / mapping rules / versions | Form + tables | **Route** for the editor | `/codes-admin/:library/:codeId` |
| Rule editor + simulation | Editor + sample table | **Route** | `/codes-admin/rules/:ruleId` (`/simulate`) |
| Finance: policy form, FX form | Policy form has an impact-code checklist | **Route** for the policy; keep the FX form as a dialog | `/finance/policies/:policyId` |
| Legacy hand-rolled RCA modals (17), `EventHub.tsx:2167` (detail + about 20-field edit), `EventHub.tsx:1125` (31-field Create, Save unreachable) | | Retire with v1. If they are kept, `/events/:eventId(/edit)`, `/rca/new?eventId=`, `/rca/:rcaId/evidence/:evidenceId(/edit)`, `/rca/:rcaId/analysis/:tool` | |
| v1 Production plans: PlanForm (about 18 fields + 2 tabs) → PlanApprovalWorkflow (nested), TemplateManager → TemplateWizard (7 steps), Reconcile loss (about 420 lines), Loss breakdown, Unmapped events | | **Route** | `/production-plans/new`, `/production-plans/:planId/edit`, `/production-plans/:planId/approval`, `/production-plans/templates(/new)`, `/production-plans/:planId/losses/:lossId(/reconcile)` |
| Master data entity forms: Unit (7 fields), Asset (11), hierarchy node (9), quick create (8), custom attributes, RCA templates (full screen) | | **Route** | `/master-data/units/:unitId/edit`, `/master-data/assets/:assetId/edit`, `/master-data/hierarchy/:nodeType/:nodeId/edit`, `/master-data/rca/templates/:id/edit` |
| Admin: create entity (up to 9 fields), attribute form (13), Tasks form (8) | | **Route** | `/admin/:entity/new`, `/admin/attributes/:id/edit`, `/tasks/new`, `/tasks/:taskId/edit` |
| Users create/edit (4 fields), product (5), reason code (3), audit entry details | | Keep as dialogs | (optional `/audit/:entryId`) |
| v1 Connectivity: data source (8+ fields, custom overlay), hierarchy mapping (10), PI "Manage Mappings" (`h-[85vh]`) | | **Route**, or retire with v1 | `/connectivity/sources/:id/edit`, `/connectivity/mappings/:id/edit`, `/connectivity/pi/mappings` |
| Dead code | `RCAModule.tsx:5524,5545` ("Manage Categories/Locations" cannot be opened) | Delete | |

Confirmations (approve, retire, delete, cancel draft, reject with reason) stay as `ConfirmDialog`.

---

## 9. Icons to a standard

The full usage map is in [Appendix F](#appendix-f-icons-and-dates-full-inventory), part 1.

### Current state
- 108 files import lucide icons: 155 distinct names and 980 import occurrences. The v2 features use few icons; the v1 pages hold almost all of them.
- **148 imported icons are never used** (lint rule off).
- Deprecated aliases are used throughout (`Edit` → `SquarePen`, `AlertTriangle` → `TriangleAlert`, `AlertCircle` → `CircleAlert`, …).
- **Same action, different icons:**
  - Edit: `Edit` / `Edit2` / `Pencil`
  - Loading: `Loader2` / spinning `RefreshCw` / spinning `RotateCcw`
  - Success: `CheckCircle` / `CheckCircle2` / `Check` / `BadgeCheck` / ✅
  - Error: `AlertTriangle` / `AlertCircle` / `XCircle` / ❌
  - Export: `Download` / `FileText` / `FileSpreadsheet`
  - View: `Eye` / `ExternalLink` / `FileText`
- **Same icon, different meanings:**
  - `Settings` means both settings **and** the Production Unit entity.
  - `Package` means asset, plan, unit and product.
  - `Shield` has 8 meanings.
  - `ClipboardList` has 8.
  - `Upload` means import **and** the event "source" badge.
  - `AlertTriangle` means warning **and** the Event Hub nav item.
- **Emojis used as icons:** Connectivity, OPCUABrowser, the RCA tools, DataSeeding, RCATriggerSettings, and "🔄 Fix DB".

### Proposed standard
One registry, `src/lib/icons.ts`, that exports semantic names. Components import `Icons.edit`, never lucide directly; an ESLint `no-restricted-imports` rule for `lucide-react` outside `src/lib/icons.ts` and `components/ui` enforces it.

| Meaning | Icon | Meaning | Icon |
|---|---|---|---|
| add / create | `Plus` | edit | `SquarePen` |
| delete | `Trash2` | remove row / close | `X` |
| refresh / reload | `RefreshCw` | reset / undo | `RotateCcw` |
| loading | `Loader2` (spin) | search | `Search` |
| filter | `Filter` | export / download | `Download` |
| import / upload | `Upload` | open detail | `ChevronRight` (row) / `ExternalLink` (new context) |
| copy to clipboard | `Copy` | duplicate | `CopyPlus` |
| approve / success | `CircleCheck` | reject / error | `CircleX` |
| warning | `TriangleAlert` | info | `Info` |
| settings | `Settings` | lock / read-only | `Lock` |
| **Entity:** plant / site | `Factory` | unit | `Cog` |
| asset | `Wrench` | product | `Package` |
| event / stop | `CirclePause` (stop), `Activity` (event) | downtime | `TrendingDown` |
| plan | `CalendarClock` | calendar | `CalendarRange` |
| RCA case | `Microscope` | knowledge | `BookOpen` |
| task | `ListChecks` | user | `User` / `Users` |
| role / permission | `KeyRound` | audit | `ScrollText` |
| connection | `Plug` | signal | `Radio` |
| code | `Tag` / `Tags` | finance / valuation | `Coins` |
| report | `FileBarChart` | dashboard | `LayoutDashboard` |

**Rules:**
- An icon never stands alone without an accessible name: `IconButton` requires `aria-label`.
- Status always pairs the icon with text (WCAG 1.4.1).
- No emojis in the UI.

---

## 10. Admin setting: Persian (Jalali) vs Gregorian calendar

The full site list is in [Appendix F](#appendix-f-icons-and-dates-full-inventory), part 2.

### Current state
**Date formatting today:**
- The v2 standard is `src/features/ux-kit/format/plant-time.ts`. `Intl.DateTimeFormat('en-CA', {timeZone, hourCycle:'h23', timeZoneName:'longOffset'})` gives `2026-10-11 22:15 (+00:00 UTC)`.
- It is wrapped by `<PlantTime>` (`ux-kit/plant-time.tsx`). That has 171 uses in 70 files.
- `plantTimeParts` is **also used for logic** (`event-hub/model/plant-local-time.ts:11,33` for `datetime-local` inputs; `pla-analytics/reports/reports-filters.tsx:15`). It must stay ISO/Gregorian, so Jalali has to be a separate display layer.

**Legacy formatting:**
- About 105 `toLocale*` date sites in 41 files, using the browser zone and browser locale. This already conflicts with D03 (plant timezone).
- `src/utils/dateFormatters.ts` is hard-coded to `en-US` and the browser zone; it is used by 5 v1 production-plan components.

**Date inputs and libraries:**
- 39 `type="date"`, 31 `type="datetime-local"` and 4 `type="time"` inputs. Native pickers are always Gregorian.
- `date-fns` 3.6 has 0 imports. `react-day-picker` 8.10 is used only by the unused `ui/calendar.tsx`. There is no Jalali library.

**What the screenshots show:**
- Times render as `2026-10-11 22:15 (+00:00 UTC)`. The red `UTC (+00:00)` badge appears because **Demo Plant has no timezone configured**; the RCA subtitle says "Times in UTC (no plant timezone configured)".
- The repeated offset on every cell is noisy. It should show once in the `ScopeHeader` and be omitted per cell when equal to the page zone.

**Settings storage today:**
- Backend `app_settings` table (`server/pro-act-backend/src/app-settings/`) has `key` (PK), `value text` JSON, `tenant_id`, `user_id`.
  - `ownerForKey` recognises only per-user `tabVisibility.<tenant>.<user>` keys. **Every other key is application-wide and SuperAdmin-only**, so tenant-scoped settings cannot be created through the API today.
  - `POST /:key/value` has no DTO or per-key validation. `publish()` broadcasts `appSettings` changes to the tenant room, but only for tenant rows, and no frontend code listens.
- The tenant entity has `timezone varchar(100) null` and no locale, calendar or date-format field. Sites have `timezone` + `timezone_fallback` (D03).
- Frontend: `appSettingsApi.ts` (`value: any`), `BrandingService` (singleton cache, no TTL), `TabVisibilityService` (per user). `AuthContext` loads `session.tenant`, which carries `timezone`. `usePlantTimezone` reads `session.tenant`, **not the selected plant's tenant** (a CLAUDE.md violation).
- `/settings` is a placeholder.

### Recommended design
1. **Storage.**
   - **Option A (recommended):** a tenant column `tenants.calendar_system varchar(16) not null default 'gregorian'` with CHECK `IN ('gregorian','jalali')`, optionally `week_start smallint`. Add it to `UpdateTenantDto` with `@IsIn`. The frontend gets it on the tenant it already fetches.
     - This needs a migration with `down`, a DTO change and an OpenAPI snapshot update, and the decision recorded in `plans/DECISIONS.md`.
   - **Option B:** an allow-listed tenant key in `app-settings` (extend `ownerForKey` with `^tenant\.<uuid>\.display$` and add per-key validation).
   - **Option C:** an application-wide key, which needs no backend change but is SuperAdmin-only and the same for all plants.
2. **Read path.**
   - Add `features/ux-kit/use-display-settings.ts`. It reads the **selected** tenant (`plantSelection?.tenant?.id || session?.tenant?.id`) through TanStack Query (`['tenant', id]`, 5 min) and returns `{ tz, calendar }`.
   - Fix `usePlantTimezone` the same way.
3. **One formatter:** `features/ux-kit/format/calendar-date.ts`.
   - It provides `formatInstant(iso, zone, style)`, `formatOperationalDate`, `formatInstantRange`, `formatBucketKey`, `calendarParts`, and the arithmetic converters `jalaliToIsoDate` / `isoDateToJalali`.
   - Jalali display uses `Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {timeZone, …})`, with **no new dependency**. Verified: `2026-10-12T06:30Z` in Asia/Tehran gives `1405/07/20 10:00`, and month names come out as "Mehr 1405".
   - Cache formatter instances by `calendar|tz|style`.
   - `<PlantTime>` delegates to it, which switches the 70 v2 files at once. Then migrate the v1 `toLocale*` sites, or retire those pages.
4. **Inputs.**
   - Add a `CalendarDateInput` / `CalendarDateTimeInput` in `ux-kit`. For gregorian it renders the native input. For jalali it renders a masked `1405/07/20` field (or y/m/d selects with Intl month names).
   - It always emits ISO, so model files and API payloads are unchanged.
   - Use a pure jalaali arithmetic port of about 80 lines, with fixture tests on Nowruz and on leap years 1399, 1403 and 1408.
   - `react-day-picker` v9 Persian support would be a new dependency (`date-fns-jalali`), so ask first.
5. **Admin UI.** Replace the `/settings` placeholder with a lazy `features/settings/settings-page.tsx`. It holds a "Date display" card with a calendar radio, a live preview and a week start. Gate it on `canAdministerTenant`. Do not add it as an AdminPanel tab: that file is already 725 lines.
6. **Decisions to record:**
   - Buckets stay Gregorian on the server. A Jalali month does not equal a Gregorian month (Mehr starts on 23 Sep), so either label buckets as ranges, or add a server `calendar` parameter later.
   - Week start: Saturday for Jalali tenants.
   - Exports stay ISO/UTC.
   - No Persian digits and no RTL.

---

## 11. Implementation plan

### (i) Shared foundations: one change set, one agent, merged first
These are all new files or shell files, so no feature folder is touched.

| # | Deliverable | Files |
|---|---|---|
| F1 | Navigation sections, rail a11y, persisted nav state, NavLink active state, shell cleanup (remove the dead search, bell, settings and footer; sticky header with `<main>` as scroller; compact user menu; z-index scale) | `src/features/auth/navigation-items.ts` (+ test), `src/components/Navigation.tsx`, `src/components/Layout.tsx`, new `src/features/auth/use-nav-state.ts`, `tailwind.config.ts` |
| F2 | Icon registry + lint rule | new `src/lib/icons.ts`, `eslint.config.js` (rule at warn level until all tracks land; enable `no-unused-vars`) |
| F3 | UX kit primitives: `ListPager`/`usePagedList`, `ConfirmDialog`, `IconButton`, `DisabledReason`, `PageHeader`, `ResponsiveTabs`, `SupportReference`, `LiveIndicator` | new files in `src/features/ux-kit/` + tests + playground |
| F4 | Labels and errors: `labels.ts`, `refusal-messages.ts` (`describeError`), `display-names.ts` (`useReferenceNames`, `useUserDirectory` — needs backend B2); update `data-state.tsx` to use them | `src/features/ux-kit/*`, `src/api/v2/errors.ts` |
| F5 | Query layer: QueryClient defaults; `placeholderData: keepPreviousData` + `pageSize` in `useV2InfiniteList`/`useReport`/period reads; `maxPages`; minute-rounded preset windows helper; `tz` out of keys; unified reason-code key; `usePrefetchOnHover`; realtime coalescing and targeted invalidation; polling backoff; `dataStateOf` "refreshing" state | `src/app/query-client.ts`, `src/api/v2/queries/*`, `src/realtime/use-scoped-realtime.ts`, `src/features/ux-kit/data-state-of.ts` |
| F6 | Calendar: `format/calendar-date.ts` (+ fixtures), `use-display-settings.ts`, `<PlantTime>` delegation, `CalendarDateInput`; fix `usePlantTimezone` to use the selected tenant | `src/features/ux-kit/*` |
| F7 | Shell performance: parallel org/tenant in `AuthContext` + memoised context values; `PlantSelectionContext` memo; `PlantSelector` on v2 sites/units + keyboard-accessible tree; flags prefetch in `V2SessionBridge`; chunk preload on nav hover; `manualChunks`; single toaster; lazy `RealtimeBridge` | `src/contexts/*`, `src/components/PlantSelector.tsx`, `src/features/v2-foundation/*`, `src/App.tsx`, `src/app/lazy-pages.ts`, `vite.config.ts` |

**Backend items** (separate agent, in parallel with F; each is a contract change: flag it, update the OpenAPI snapshot, add the migration with `down`):
- **B1:** `tenants.calendar_system` (+ `week_start`).
- **B2:** user-directory projection `GET /v2/users/directory?ids=`.
- **B3:** paging for `GET /users`, `/tasks` and `/reports/audit-trail`.
- **B4:** profile the slow v2 reports and add a downtime bundle endpoint.
- **B5:** return `revisionNumber` with reconciliation.

### (ii) Per-feature application: disjoint folder groups, run in parallel after F merges
Each track owns only its folders. It consumes the F primitives and does not edit shared files. If a track needs a new label map, it adds it under its own `model/` and registers it through `labels.ts` in a follow-up.

| Track | Owns (exclusive) | Work |
|---|---|---|
| **T1 Event Hub + Downtime** | `src/features/event-hub/**`, `src/features/downtime-analysis/**` | Routes `/events/:eventId`, `/events/new`, `/events/:id/edit`, `/events/bulk-code`; URL filters; field-label map and resolvers in the drawer and evidence; debounced `MultiCheckSelect`; row prefetch; pager on event/drill lists; Downtime sections and anchors; `ConfirmDialog`; icons |
| **T2 Plan dashboard + Planning** | `src/features/plan-dashboard/**`, `src/features/plans-profiles-calendars/**` | Full-page period workspace and plan grid; candidate, period-header and history labels; disclosure for run/policy; routes for plan, profile and calendar editors; Retire confirmations; pager on rates, versions and calendar preview; Jalali inputs in planning forms |
| **T3 RCA + Knowledge** | `src/features/rca/**`, `src/features/rca-knowledge/**` | `/rca/cases/:caseId`; entity picker for links; unit and link resolvers; confirm or undo on removal; pager; jargon copy |
| **T4 Integration** | `src/features/integration-console/**` | `/connectivity/connections/:id(/edit)`, `/connectivity/mappings/:id`, `/connectivity/quarantine/:id`; tab in the URL; polling to 10–15 s; resolvers; pager on jobs, signals and mappings; console refusal → `describeError` |
| **T5 Codes + Finance** | `src/features/codes-admin/**`, `src/features/finance/**` | Collapsed and searchable code tree with paging; `/codes-admin/:library/:codeId`, `/codes-admin/rules/:ruleId`, `/finance/policies/:id`; tab in the URL; FX Retire/Approve confirmation; refusal alerts |
| **T6 Analytics** | `src/features/pla-analytics/**` (dashboard, reports, PLA) | One banner per page; Reports tab in the URL; Dashboard scope from the URL/rolling; policy label; pager on loss, OEE and overdue tables; date column nowrap |
| **T7 Admin pages (v1 still routed)** | `src/pages/UserManagement.tsx`, `AdminPanel.tsx`, `PermissionsManagement.tsx`, `AuditLogs.tsx`, `Tasks.tsx`, `src/features/permissions/**` | Rebuild as `src/features/admin/**` (users, audit, tasks) on TanStack Query + `ListPager` + `ConfirmDialog` + `DataState`; role labels; user-name resolution; remove native `confirm()` |
| **T8 Master data + settings** | `src/pages/MasterData.tsx`, `src/components/plant-hierarchy/**`, `ProductList.tsx`, `CodesManagement.tsx`, `src/components/rca-settings/**`, new `src/features/settings/**` | `/settings` page with the calendar toggle (after B1); remove "Fix DB" and "Quick Add"; lazy tabs; pager on units, assets and products; hierarchy keyboard access |
| **L Legacy retirement** | `src/pages/{EventHub,RCAModule,RCAKnowledgeBase,PLADashboard,Dashboard,Reports,Connectivity,EnhancedHistorian,TestRCAAnalysisTools}.tsx`, `src/components/{integrations,historian,streaming,production-plans}/**` | Decide per page (`plans/DECISIONS.md`): retire behind flags that are on in every tenant, or keep minimal. Remove the `Math.random` and fabricated data. This removes about 1.5 MB of chunks and most a11y debt. |

**Ordering and conflict rules:**
- F lands first, as one PR. T1–T8 and L run in parallel because their folder sets are disjoint.
- `App.tsx` and `lazy-pages.ts` are shared, and every route change touches them. To keep them out of the tracks, F7 introduces a route registry: `src/app/routes/*.tsx`, one file per area, imported by `App.tsx`. Each track then edits only its own `routes/<area>.tsx`.
- Each track adds its own tests: unit tests for model and label maps, flow tests (`*-flows.test.tsx`), and updates to the e2e persona specs it affects.
- Every track runs `npm run ci` before merging.

**Effort guide:**
- F: about 3–4 agent-days.
- T1, T2: about 2–3 days each.
- T3–T6: about 1–2 days each.
- T7, T8: about 2–3 days each.
- L: depends on the decisions.
- Backend B1–B5: about 2–3 days.

---

## Appendix A: measured page timings (1440×900)

**Column definitions:**
- "content" is milliseconds from navigation until `<main>` shows content with no spinner or skeleton.
- "API" is the number of API calls during the step.
- "Σ API" is the summed server time in ms.
- "Height" is the `<main>` scroll height in px.

**Visit types:**
- First visit: SPA navigation from the sidebar with a cold query cache.
- `__warm`: second SPA visit.
- `__reload`: a hard reload, which includes the 11 shell calls.

**Where to find the 1280 px figures:** the 1280×720 pass shows the same API pattern. Its numbers are in `results.json` (viewport `1280`).

| User | Page | content ms | API | Σ API ms | Height |
|---|---|---|---|---|---|
| manager | reports | 819 | 1 | 740 | 952 |
| manager | reports → Downtime | 444 | 1 | 425 | 6,941 |
| manager | reports → Reconciliation | 1,395 | 1 | 1,373 | 3,364 |
| manager | pla-analytics | 2,642 | 1 | 2,489 | 1,153 |
| manager | pla → Loss tree | 1,099 | 1 | 1,055 | 3,488 |
| manager | pla → Trends | 1,348 | 5 | 3,743 | 15,421 |
| manager | pla → Reconciliation | 1,318 | 1 | 1,270 | 3,346 |
| manager | pla → Quality coverage | 1,465 | 1 | 1,433 | 820 |
| manager | pla → OEE | 433 | 1 | 416 | 14,556 |
| manager | production-plans | 173 | 4 | 651 | 21,611 |
| manager | planning | 184 | 1 | 69 | 820 |
| manager | events | 455 | 3 | 293 | 1,046 |
| manager | events drawer | settled 958 | 4 | 1,578 | |
| manager | downtime | 2,153 | 12 | 17,664 | 13,572 |
| manager | rca | 86 | 1 | 40 | 2,955 |
| manager | rca-knowledge-base | 230 | 1 | 162 | 2,356 |
| manager | codes-admin | 147 | 1 | 48 | 11,247 |
| manager | finance | 72 | 1 | 38 | 1,175 |
| manager | tasks | 83 | 2 | 75 | 2,358 |
| manager | audit | 384 | 2 | 170 | 27,806 |
| manager | dashboard __warm | 1,934 | 5 | 4,838 | 1,091 |
| manager | downtime __warm | 1,252 | 12 | 11,037 | |
| manager | pla-analytics __warm | 1,223 | 1 | 1,184 | |
| manager | codes-admin / planning / rca / finance __warm | 2–7 | 0–1 | ≤ 38 | |
| manager | dashboard __reload | 2,159 | 15 | 5,759 | |
| manager | events __reload | 414 | 14 | 991 | |
| manager | pla-analytics __reload | 1,929 | 12 | 2,269 | |
| manager | plan dashboard (reload) | idle 829 | 12 | | |
| manager | period workspace (reload) | idle 1,125 | 20 | | |
| operator | pla-analytics | 1,679 | 1 | 1,552 | |
| operator | downtime | 1,301 | 12 | 10,954 | |
| operator | dashboard __warm | 2,627 | 4 | 6,884 | |
| superadmin | master-data | 128 | 16 | 4,645 | 1,030 |
| superadmin | master-data → Units | 511 | 3 | 753 | 17,700 |
| superadmin | admin | 57 | 5 | 425 | 24,668 |
| superadmin | users | 63 | 1 | 29 | 6,444 |
| superadmin | permissions | 64 | 3 | 183 | 6,712 |
| superadmin | pla → Reconciliation | 2,141 | 1 | 2,122 | |
| superadmin | connectivity → connection click | idle 5,819 (click timed out) | 0 | | |

**Shell calls on a cold reload** (`events__reload`):
1. `/organizations/:id`
2. `/tenants/:id`
3. `/app-settings/branding/value`
4. `/v2/feature-flags`
5. `/organizations`
6. `/units` (15.8 kB, all units)
7. `/tenants`
8. `/assets` (6.6 kB, all assets)
9. `/v2/sites`
10. `/v2/reason-codes` (22.6 kB)
11. `/v2/units` (11.2 kB)

Then the page calls: 2 × `/v2/production-events` and `/v2/reports/downtime`.

**Slowest endpoints across the run** (p50 / max ms, n):

| Endpoint | p50 ms | max ms | n |
|---|---|---|---|
| `reports/reconciliation-status` | 1,519 | 2,575 | 11 |
| `reports/reconciliation-trend` | 1,324 | 1,622 | 3 |
| `reports/actuals-quality` | 1,316 | 1,433 | 3 |
| `reports/scope-waterfall` | 1,260 | 2,489 | 12 |
| `reports/downtime` | 765 | 2,011 | 116 |
| `reports/loss-tree` | 646 | 1,055 | 6 |
| `reports/reliability` | 584 | 1,000 | 9 |
| `reports/oee` | 551 | 1,496 | 32 |
| `rca-knowledge/similar` | 357 | 766 | 6 |
| `production-events` | 76 | 1,633 | 32 |

Everything else is under 250 ms at p50.


---

## Appendix B: list and table inventory

**Routes and flags:**
- Routes come from `src/App.tsx` and `src/app/lazy-pages.ts`. A flagged route serves the v2 `features/*` screen while its flag is on, and falls back to v1 when the flag is off or unknown (`features/v2-foundation/flagged-route.tsx`).
- These v1 pages are **always** live: `/users`, `/admin`, `/permissions`, `/master-data`, `/audit`, `/tasks`, `/production-plans`, `/enhanced-historian` and `/test-rca-tools`.

**What "server-paged" means here:**
- "Keyset" means `useV2InfiniteList`: cursor + limit, with no total count.
- "First page only" means the list is cut off silently at `limit`.

The "Size" column is the typical row count in Demo Plant.

### B.1 v2 feature screens

| # | Component (path:line) | Lists | Route | Data source | Server-paged? | All rows rendered? | Size |
|---|---|---|---|---|---|---|---|
| 1 | features/event-hub/components/event-list.tsx:39 | Production events | /events | `useProductionEvents` → /v2/production-events, limit 100 | Keyset, infinite scroll | No (VirtualList) | Large |
| 2 | event-hub/components/current-stops-panel.tsx:39 | Open stops | /events | same, limit 50, 30 s poll | First page only | Yes | Small–medium |
| 3 | event-hub/components/review-items-list.tsx:25 | Review items | /events drawer | event payload | – | Yes | Small |
| 4 | event-hub/components/revision-timeline.tsx:16,30 | Revisions, coding history | /events drawer | /production-events/{id}/history | No | Yes | Small–medium |
| 5 | event-hub/components/evidence-panel.tsx:20,35 | Source deliveries, relations | /events drawer | history payload | No | Yes | Small |
| 6 | event-hub/components/source-effective-table.tsx:32 | Field / effective / source | /events drawer | event payload | – | Yes | Small |
| 7 | event-hub/components/impacted-periods-preview.tsx:35 | Affected periods | /events form | `useProductionPeriods` limit 20 | First page only | Yes | ≤ 20 |
| 8 | event-hub/components/merge-dialog.tsx:47 | Merge selection | /events | selection | – | Yes | Small |
| 9 | event-hub/components/bulk-preview-table.tsx:37,49,59 | Bulk preview | /events | bulk preview | Client cap 50 + "N more" | First 50 | Medium–large |
| 10 | event-hub/components/conflict-dialog.tsx:66 | Conflicting fields | /events | 409 payload | – | Yes | Small |
| 11 | rca-knowledge/similar-knowledge-panel.tsx:21 | Similar RCAs | /events drawer | /rca-knowledge/similar, limit 5 | Fixed 5 | Yes | Small |
| 12 | rca/event-rca-panel.tsx, rca/components/recommendation-badges.tsx:11 | Evidence, recommendations | /events drawer | `useEventRcaEvidence`, `useRcaRecommendations` (200) | First page | Yes | Small |
| 13 | downtime-analysis/components/drill-events.tsx:50 | Drill events | /downtime | production-events, limit 100 | Keyset, infinite | No (VirtualList) | Large |
| 14 | downtime-analysis/components/state-timeline.tsx:61 | Stop timelines per unit | /downtime | production-events + "Load more stops" | Keyset, load more | No (VirtualList) | Large |
| 15 | downtime-analysis/components/bad-actors.tsx:32 | Bad actors | /downtime | /v2/reports/downtime groupBy asset | No (aggregate) | No (VirtualList) | Medium |
| 16 | downtime-analysis/components/reason-pareto.tsx:53 | Pareto bars | /downtime | reports/downtime | No | Yes | Medium |
| 17 | downtime-analysis/components/crew-comparison.tsx:34 | Downtime by crew | /downtime | reports/downtime | No | Yes | Small |
| 18 | downtime-analysis/components/reliability-card.tsx:39 | MTBF/MTTR per unit | /downtime | reports/reliability | No | Yes | Small–medium |
| 19 | downtime-analysis/components/trend-panel.tsx:67 | Trend buckets | /downtime | 4 × reports/downtime | No | Yes | Medium (long window → many) |
| 20 | codes-admin/codes/code-tree.tsx:48 (host code-library-panel.tsx:55) | Code library tree | /codes-admin | `useCodeList` limit 500 | **First page only, truncates at 500** | Yes (entire tree expanded, 11,247 px) | Large |
| 21 | codes-admin/codes/code-versions.tsx:30 | Code versions | /codes-admin | array | No | Yes | Small |
| 22 | codes-admin/codes/mapping-rules-panel.tsx:78 | Mapping rules | /codes-admin | limit 500 | First page only | Yes | Small–medium |
| 23 | codes-admin/codes/mapping-preview.tsx:36 | Mapping preview | /codes-admin | preview | No | Yes | Small |
| 24 | codes-admin/rules/rules-panel.tsx:39 | Admin rules | /codes-admin | /v2/rules limit 200 | First page only | Yes | Medium |
| 25 | codes-admin/rules/rule-versions.tsx:32 | Rule versions | /codes-admin | array | No | Yes | Small |
| 26 | codes-admin/rules/simulation-result.tsx:37,52 | Simulation sample | /codes-admin | command | No | Yes | Small–medium |
| 27 | codes-admin/rules/conditions-section.tsx:29,54 | Rule conditions | /codes-admin | draft | – | Yes | Small |
| 28 | finance/fx/fx-rate-table.tsx:28 | FX rates | /finance | /v2/fx-rates limit 200 | Keyset + LoadMore | Yes | Medium–large |
| 29 | finance/policies/policy-table.tsx:41 | Valuation policies | /finance | limit 100 | Keyset + LoadMore | Yes | Small |
| 30 | finance/policies/impact-code-picker.tsx:22 | Impact-code checklist | /finance | codes limit 500 | First page only | Yes | Medium |
| 31 | integration-console/connections/connections-list.tsx:52 | Connections | /connectivity | /v2/connections limit 100 | First page only | Yes | Small |
| 32 | integration-console/jobs/jobs-panel.tsx:47 | Ingestion jobs | /connectivity | limit 100, 5 s poll | First page only | Yes | Medium–large (grows forever) |
| 33 | integration-console/jobs/job-transitions.tsx:13 | Job transitions | /connectivity | 5 s poll | No | Yes | Small |
| 34 | integration-console/quarantine/quarantine-inbox.tsx:60 | Ingestion exceptions | /connectivity | limit 100 | Keyset, infinite | No (VirtualList) | Large |
| 35 | integration-console/mapping/source-mappings-tab.tsx:35 | Source mappings | /connectivity | limit 200 | First page only | Yes | Medium–large |
| 36 | integration-console/mapping/mapping-rules-table.tsx:35 | Field mapping rules | /connectivity | draft | – | Yes | Small |
| 37 | integration-console/mapping/mapping-preview.tsx:52, resolution-preview.tsx:14 | Diagnostics | /connectivity | preview | No | Yes | Small |
| 38 | integration-console/signals/signals-panel.tsx:33 | Signals | /connectivity | /v2/signals limit 200 | First page only | Yes | Large |
| 39 | integration-console/discovery/sample-table.tsx:35 | Discovery sample | /connectivity | command | Server-bounded | Yes | Small–medium |
| 40 | connections/diagnostics-panel.tsx:54; mqtt/* editors | Diagnostics, MQTT editors | /connectivity | local | – | Yes | Small |
| 41 | plans-profiles-calendars/plans/plans-tab.tsx:46 | Production plans | /planning | /v2/production-plans limit 200 | Keyset + LoadMore | Yes | Medium |
| 42 | plans/version-history.tsx:18 | Plan versions | /planning | limit 100 | First page only | Yes | Small |
| 43 | plans/period-preview.tsx:75 | Period preview | /planning | command | No | No (VirtualList) | Medium–large |
| 44 | plans/plan-detail.tsx:27, slices-editor.tsx:27 | Plan slices | /planning | version | – | Yes | Small |
| 45 | profiles/profile-list.tsx:17 | Rate profiles | /planning | limit 200 | Keyset + LoadMore | Yes | Medium |
| 46 | profiles/rate-table.tsx:62 | Profile rates | /planning | limit 500 | First page only | Yes | Medium |
| 47 | profiles/valuation-rate-table.tsx:67 | Valuation rates | /planning | limit 500 | First page only | Yes | Medium |
| 48 | profiles/rate-import-dialog.tsx:39 | Import report | /planning | command | No | Yes | Medium |
| 49 | calendars/calendar-version-list.tsx:14 | Calendar versions | /planning | limit 200 | First page only | Yes | Small–medium |
| 50 | calendars/calendar-preview-table.tsx:24 | Shift instance preview | /planning | command | No | **Yes, no cap** | Large |
| 51 | calendars/crew-rotation-editor.tsx:67 | Crew rotations | /planning | limit 200 | First page only | Yes | Small |
| 52 | calendars/holidays-editor.tsx:30, exclusions-editor.tsx:24, shift-templates-editor.tsx:27 | Editor rows | /planning | draft | – | Yes | Small |
| 53 | template/step-calendar.tsx:52 | Calendars to pick | /planning | calendar versions ×2 | First page only | Yes | Small |
| 54 | plan-dashboard/components/period-grid.tsx:70 | Periods | /plans/:planId | /v2/period-summaries limit 100 | Keyset, infinite | No (VirtualList, **≈120 px box**) | Large |
| 55 | plan-dashboard/workflow/period-history.tsx:24 | Approval actions | period | limit 100 | Single page | Yes | Small |
| 56 | plan-dashboard/workflow/change-proposals-panel.tsx:48 | Change proposals | period | limit 20 | Single page | Yes | Small |
| 57 | plan-dashboard/editor/candidate-table.tsx:26 | Loss-line candidates | period | accounting | No | Yes | Medium |
| 58 | plan-dashboard/editor/evidence-picker.tsx:27 | Events to link | period | production-events limit 50 | First page only | Yes | Medium (cut at 50) |
| 59 | plan-dashboard/editor/manual-lines.tsx:41 | Manual lines | period | draft | – | Yes | Small |
| 60 | plan-dashboard/components/actuals-provenance.tsx:26,36,41 | Slices, segments, exceptions | period | period | No | Yes | Small–medium |
| 61 | ledger-comparison.tsx:37, waterfall-panel.tsx:44, valuation-tiles.tsx:40,58, reconciliation-summary.tsx:23 | Ledger and waterfall | period | accounting | No | Yes | Small |
| 62 | rca/cases/case-list.tsx:43 | RCA cases | /rca | /v2/rcas limit 50 | Keyset + Load more | Yes | Medium–large |
| 63 | rca/link-dialog/case-search.tsx:52 | Cases to link | dialog | limit 50 | First page only | Yes | Medium |
| 64 | rca/actions/actions-tab.tsx:17 | RCA actions | /rca | array | No | Yes | Small |
| 65 | rca/links/links-tab.tsx:22 | RCA links | /rca | array | No | Yes | Small–medium |
| 66 | rca/outcome-panel.tsx:29,43 | Outcome rows | /rca | outcome | No | Yes | Small |
| 67 | rca/cases/logic-tree-editor.tsx:33, nested-items-editor.tsx:31 | Logic tree | /rca | draft | – | Yes | Small |
| 68 | rca-knowledge/components/knowledge-list.tsx:43 | Knowledge entries | /rca-knowledge-base | limit 25 | Keyset + Load more | Yes | Medium–large |
| 69 | pla-analytics/components/loss-table.tsx:28 (loss-tree-tab.tsx:94, opportunities-tab.tsx:65) | Loss groups | /pla-analytics | reports/loss-tree | No (all groups) / top N | Yes | Medium–large |
| 70 | pla-analytics/components/oee-group-table.tsx:29 | OEE by unit/product | /pla-analytics | reports/oee | No | Yes (14,556 px) | Medium |
| 71 | pla-analytics/tabs/repeat-causes-tab.tsx:42 | Repeat causes | /pla-analytics | reports/downtime | No | Yes | Medium |
| 72 | pla-analytics/tabs/reconciliation-tab.tsx:74 | Overdue periods | /pla-analytics | reconciliation-status | No | Yes | Medium–large (664 overdue in the demo) |
| 73 | pla-analytics/tabs/waterfall-tab.tsx:46 | Waterfall | /pla-analytics | scope-waterfall | No | Yes | Small |
| 74 | pla-analytics/tabs/quality-tab.tsx:30,38,44 | Quality | /pla-analytics | actuals-quality | No | Yes | Small |
| 75 | pla-analytics/components/residual-trend-card.tsx:60 | Residual trend | /pla-analytics | reconciliation-trend | No | Yes | Medium |
| 76 | pla-analytics/reports/downtime-reason-card.tsx:27 | Downtime by reason | /reports | reports/downtime | No | Yes (6,941 px) | Medium |
| 77 | pla-analytics/reports/loss-value-card.tsx:37 | Loss value | /reports | loss-value | No | Yes | Small–medium |
| 78 | pla-analytics/dashboard/analytics-dashboard.tsx:93; reconciliation-tiles.tsx:30 | Tiles | /dashboard | oee, downtime | No | Yes | Small |
| 79 | features/permissions/module-permissions-panel.tsx:57 | Module permissions | /permissions | static | – | Yes | Small |

### B.2 v1 screens

| # | Component (path:line) | Lists | Route | Data source | Server-paged? | All rows? | Size |
|---|---|---|---|---|---|---|---|
| 80 | src/pages/UserManagement.tsx:347 | Users | /users (always) | GET /users | No | Yes (6,444 px) | Medium |
| 81 | src/pages/PermissionsManagement.tsx:98 | Users | /permissions (always) | GET /users | No | Yes (6,712 px) | Medium |
| 82 | src/pages/AdminPanel.tsx:377,417,463,514 | Orgs, tenants, units, users | /admin (always) | full arrays | No | Yes (24,668 px) | Medium |
| 83 | src/pages/AuditLogs.tsx:277 | Audit entries | /audit (always) | /reports/audit-trail (server cap 500) | No | Up to 500 (27,806 px) | Large |
| 84 | src/pages/Tasks.tsx:300 | Tasks | /tasks (always) | GET /tasks | No | Yes | Medium–large |
| 85 | src/components/production-plans/PlanList.tsx:97 | Plans | /production-plans (always) | masterDataService | No | Yes (21,611 px) | Medium |
| 86 | production-plans/TemplateManager.tsx:118 | Templates | /production-plans | masterDataService | No | Yes | Small |
| 87 | production-plans/PlanDashboard.tsx:1679 (+2246, 2603, 2750, 3045, 3238, 3353) | Losses, events, categories | /production-plans → v1 dashboard | masterDataService | No | Yes | Medium–large |
| 88 | src/components/AuditTrailViewer.tsx:228 | Record audit trail | v1 plans/events | auditTrail JSON | No | Yes | Small–medium |
| 89 | src/pages/MasterData.tsx:711 | Module cards | /master-data | static | – | Yes | Small |
| 90 | src/components/ProductList.tsx:182 | Products | /master-data | getProducts | No | Yes (10,492 px) | Medium |
| 91 | plant-hierarchy/UnitList.tsx:518 (+560) | Units | /master-data | getUnits | No | Yes (17,700 px) | Medium |
| 92 | plant-hierarchy/AssetList.tsx:529 | Assets | /master-data | getAssets | No | Yes (7,210 px) | Large |
| 93 | plant-hierarchy/PlantHierarchyManager.tsx:149,207,265,324 | Org → asset tree | /master-data | all lists | No | Yes | Large |
| 94 | CodesManagement.tsx:533,582; ReasonCodeLibraryTree.tsx:145; RCACauseLibraryTree.tsx:221 | Codes and cause trees | /master-data | masterDataService | No | Yes | Medium |
| 95 | rca-settings/CauseLibraries.tsx:201; RCATemplates.tsx:254; VerificationChecklists.tsx:226 | RCA settings | /master-data | masterDataService | No | Yes | Small–medium |
| 96 | src/pages/EventHub.tsx:2080 | Events (v1) | /events (flag off) | whole tenant | No | Yes | Large |
| 97 | src/pages/RCAModule.tsx:3010 (+3251, 3507, 3634, 4427, 4496, 4759, 4815, 6455) | RCAs, evidence, etc. | /rca (flag off) | whole tenant | No | Yes | Medium–large |
| 98 | src/pages/RCAKnowledgeBase.tsx:591 (+376, 1246) | Closed RCAs | /rca-knowledge-base (flag off) | getRCAs | No | Yes | Medium |
| 99 | src/pages/PLADashboard.tsx:769 → LossEventTable.tsx:90 | Loss events | /pla-analytics (flag off) | whole tenant | No | Yes | Large |
| 100 | src/pages/Reports.tsx:112,329,397,476,536 | v1 reports | /reports (flag off) | /reports/* | No | Yes | Small–medium |
| 101 | src/pages/Dashboard.tsx:519,778,873,974,1037,1070; DashboardAnalytics.tsx:685,731 | Recent and top lists | /dashboard (flag off) | whole tenant, client `slice(0,10)` | No | Capped by slice | Small display / large fetch |
| 102 | integrations/DataSourceManager.tsx:1821 | Data sources | /connectivity (flag off) | local | No | Yes | Small |
| 103 | integrations/BindingManager.tsx:1296 (+1166–1181) | Bindings | same | dataSourceService | No | Yes | Medium–large |
| 104 | hierarchy-mapping/HierarchyMappingManager.tsx:825 | Mappings | same | service | No | Yes | Medium |
| 105 | integrations/OPCUABrowser.tsx:495; OPCUAMonitor.tsx:708 | OPC UA nodes | same | client | No | Yes | Medium–large |
| 106 | pages/integrations/PIIntegration.tsx:1358 (pager 1392), 1560, 1735 | PI event frames, templates | same | PI Web API | **Yes**, the only hand-rolled server pager | Page only | Large |
| 107 | historian/TimeSeriesTable.tsx:254 (pager 294) | Time-series points | /enhanced-historian, PI, RCA v1 | query results | No | **Client pager, 50 per page** | Large |
| 108 | historian/EnhancedHistorianPage.tsx:897 | Query history | /enhanced-historian | local | – | Yes | Small |
| 109 | src/pages/TestRCAAnalysisTools.tsx:405 | Test tool rows | /test-rca-tools | local | No | Yes | Small |
| 110 | RCATimeline.tsx:152; EventTimeline.tsx:40 | Timelines | v1 /rca | props | No | Yes | Medium |

---

## Appendix C: internal values rendered to users

**Severity:**
- **H**: a v2 screen used by operators or managers.
- **M**: an admin or secondary v2 screen.
- **L**: legacy, debug or integration-only.

Keys, `data-*` attributes and test ids are excluded.

### C.1 Error and refusal codes, correlation ids
The root cause is that every v2 refusal component prints `error.code` in its title, raw `field: message` pairs, and the full correlation id. None of them maps codes to text.

| # | Sev | file:line | Shown | Fix |
|---|---|---|---|---|
| 1 | H | features/ux-kit/data-state.tsx:61 | `Refused (UOM_MIXED)` on **every** `DataState`/`ReportCard` | `refusalTitle(code)`; code in `data-code` only |
| 2 | H | features/ux-kit/data-state.tsx:64 | `Reference: <uuid>` | `<SupportReference>` |
| 3 | H | event-hub/components/command-error.tsx:12,15-19,20 | `Refused (SOURCE_OWNED)`; `lines[0].quantity: must be positive`; reference uuid | Same; field-label map |
| 4 | H | event-hub/model/event-form.ts:148 | `… (DURATION_CONFLICT)` | Message only |
| 5 | H | plan-dashboard/editor/editor-problem.tsx:25,33,38 | `Cannot submit yet (GATES_FAILED)`; `RESIDUAL_UNACCOUNTED: …`; reference | Drop the code; issue-label map |
| 6 | H | plan-dashboard/editor/line-issues.tsx:22 | `ALLOCATION_EXCEEDED: …` | Issue-label map (`workflow-errors.ts:47` `LINE_CODES`) |
| 7 | H | plan-dashboard/editor/conflict-dialogs.tsx:26 | `(RUN_CHANGED)` / `(STALE_REVISION)` in titles | Remove |
| 8 | H | plan-dashboard/workflow/workflow-bar.tsx:76,81 | Raw job error; `(SEPARATION_OF_DUTIES)` | Reason only; job-error map |
| 9 | H | plan-dashboard/workflow/export-panel.tsx:72; pla-analytics/components/scope-export.tsx:87 | `EXPORT_FAILED: …` | Message plus disclosure |
| 10 | M | codes-admin/components/admin-refusal-alert.tsx:15-16,25-30; model/admin-refusal.ts:66 | `Not accepted (422 CODE_HAS_CHILDREN)`, field paths, reference | Title only, etc. |
| 11 | M | integration-console/components/console-refusal.tsx:14,18-23; model/refusal.ts:53 | `(ADAPTER_UNAVAILABLE)`, field paths, reference | Same |
| 12 | M | plans-profiles-calendars/components/refusal-notice.tsx:26,40-44,50 | `(VERSION_OVERLAP)`, field paths, reference | Same |
| 13 | M | v2-foundation/plant-access-guard.tsx:38 | Reference uuid | `<SupportReference>` |
| 14 | M | plans/generation-progress.tsx:27; plans/open-version-actions.tsx:55 | `NO_ELIGIBLE_TIME: …`; `last generation refused: UNIT_SCOPE` | Generation-code labels |
| 15 | M | plans/period-preview.tsx:65 | `DST_GAP at 2026-03-29T01:00:00Z` | `DST_CODES` labels + `<PlantTime>` |
| 16 | M | profiles/rate-import-dialog.tsx:36,41 | `line 4: UNKNOWN_PRODUCT — …`, `imported 10 · duplicates 2` | Message only; count labels |
| 17 | M | event-hub/components/bulk-job-progress.tsx:29 | `Chunk 2 (50 events): STALE_REVISION` | Bulk-error labels |
| 18 | M | plan-dashboard/components/actuals-provenance.tsx:43 | `problem: COVERAGE_GAP` | Severity + exception labels |
| 19 | M | integration-console/mapping/mapping-preview.tsx:54; jobs/job-row.tsx:66,70; jobs/replay-run-status.tsx:38; mqtt/subscription-actions.tsx:31; quarantine/exception-detail.tsx:34; quarantine-inbox.tsx:42 | Raw ingestion codes, outcome keys, adapter errors | `ERROR_CODE_INFO`, `FAILURE_LABELS`; raw text in a disclosure |
| 20 | H | src/api/v2/errors.ts:92,100-101 | Code used as the message; `Request failed with status 502` | Status-class messages |
| 21 | M | src/services/api/httpClient.ts:38-44 | `API request failed with status 500: Internal Server Error`, `Validation failed: property x should not exist` | `describeError` |
| 22 | L | Toasts passing `error.message`: pages/Tasks.tsx:117,186,198,208; AuditLogs.tsx:123; Reports.tsx:173; EventHub.tsx:610; rca/RCACreateTaskButton.tsx:70; HierarchyMappingManager.tsx:352,372,390,434; pi/PIEventSyncManager.tsx:91,121,140,157; PIIntegration.tsx (24 sites) | Raw API errors | `describeError` |
| 23 | L | historian/PIConnectionDiagnostic.tsx:80; EnhancedHistorianPage.tsx:258; BindingManager.tsx:462 | `HTTP 500: …` | `describeError` |

### C.2 UUIDs, raw ids, truncated ids

| # | Sev | file:line | Shown | Fix |
|---|---|---|---|---|
| 1 | H | plan-dashboard/model/display.ts:89,91 → workflow/period-history.tsx:26 | `by user d9800d1c`, `service accounting-worker` | `useUserDirectory`; service labels |
| 2 | H | plan-dashboard/components/period-header.tsx:34-35 | `Run b4a182db` | "Calculated <time>"; id in a disclosure |
| 3 | H | plan-dashboard/editor/candidate-row.tsx:37; manual-lines.tsx:22 | `event d772ed60`; linked event ids | Event time + reason link |
| 4 | H | plan-dashboard/editor/conflict-dialogs.tsx:12,31-36 | `New run: 7e1d…`, `avail:7e1d…:seg-3` | "A newer calculation exists"; candidate description |
| 5 | H | plan-dashboard/workflow/export-panel.tsx:53,63-65; change-proposals-panel.tsx:55 | `Job 1a2b3c4d: running`, sha256 hash, export ids | "Export running"; hash in a disclosure; export date |
| 6 | H | plan-dashboard/components/actuals-provenance.tsx:21 | Product id slice | "Unknown product" |
| 7 | H | event-hub/components/evidence-panel.tsx:23,37-38 | Source revision token; `5c0b12aa → 77e0…` | Disclosure; event windows with links |
| 8 | H | event-hub/components/bulk-preview-table.tsx:51 | `5c0b12aa: Source owned` | Event time / unit / reason |
| 9 | H | event-hub/components/source-effective-table.tsx:36-45 | `assetId`, `reasonCodeId`, `unitId` **full UUIDs**; JSON values | Field labels + resolvers |
| 10 | H | rca/use-unit-names.ts:14 | `Unit 3f2a9c1b` | "Unknown unit" |
| 11 | M | plans-profiles-calendars/hooks/use-planning-refs.ts:21; model/refusal.ts:65 | id slices; `Plan 1c9e22f0 v3` | Names; "Another plan v3" |
| 12 | M | rca/links/links-tab.tsx:39,41; rca/model/evidence-summary.ts:23 | Full `targetId`; raw source token; reason UUID | Resolver per link type; labels |
| 13 | M | codes-admin/rules/simulation-result.tsx:62; codes/mapping-rules-panel.tsx:45,82; codes/code-versions.tsx:24; model/version-diff.ts:38 | `Run <uuid> recorded`; code ids; raw snapshot keys | "Simulation recorded <time>"; "Unknown code"; `humanizeKey` |
| 14 | M | downtime-analysis/components/downtime-header.tsx:25 | Toast `Job <uuid>` | "You'll be notified when the export is ready" |
| 15 | M | integration-console/jobs/job-transitions.tsx:18; mapping/source-mappings-tab.tsx:18-19,40; mapping/bind-source-dialog.tsx:36; quarantine/quarantine-inbox.tsx:30 | `user 3f2a9c1b`, `runner worker-7f…`, id slices | Name lookups; "Unknown …" |
| 16 | L | quarantine-inbox.tsx:44, exception-detail.tsx:40, mapping-editor.tsx:43; model/job-presets.ts:63-66; jobs/job-row.tsx:61 | Source object ids (PI WebId), scope ids, cursor JSON | Acceptable for integration admins; truncate with a copy button, or use a disclosure |
| 17 | M | pages/Tasks.tsx:306,319 | Assignee id slice; `rca · 3f2a9c1b…` | User name; entity title link |
| 18 | M | pages/AuditLogs.tsx:97,291,321; Reports.tsx:399,481 | User and entity UUIDs | Names; id in the detail dialog |
| 19 | L | pages/Dashboard.tsx:987; DashboardAnalytics.tsx:346 | Assignee UUID; `Unit 3f2a…` | Lookups |
| 20 | L | pages/RCAModule.tsx:1718-1729,1856,3305-3318,6287,6292; EventHub.tsx:2089,2259; PLADashboard.tsx:1317; production-plans/PlanDashboard.tsx:2619,3105,3358; PlanWaterfallChart.tsx:132-134 | UUIDs, `loss_<uuid>`, `eventType: 'ProductionLoss'` | Retire with v1, or use resolvers |
| 21 | L | CustomAttributeDisplay.tsx:542; HistorianTagConfigurator.tsx:602; DataSeedingPage.tsx:119; DataFlowVisualization.tsx:481 | "Entity ID / Tenant ID / Debug" lines | Remove |
| 22 | L | HierarchyMappingManager.tsx:463; BindingManager.tsx:1311; FaultTreeAnalysisTool.tsx:149; UnitList.tsx:326,571; DataTransformationPanel.tsx:344; BrandingSettings.tsx:639 | Target ids, WebIds, `updatedBy` uuid | Names; a copy button where the id is domain data |

### C.3 Enum and status tokens (v2)

| file:line | Shown | Fix (existing helper) |
|---|---|---|
| plan-dashboard/workflow/period-history.tsx:26 | `save_draft (draft → draft)` | Action labels; `LIFECYCLE_LABELS` (`period-header.tsx:16`) |
| plan-dashboard/components/period-header.tsx:36-47 | `oee_policy@1`, `engine-…`, `Tolerance zero`, stale reason | Policy labels; disclosure; "No tolerance" |
| plan-dashboard/components/period-grid (readiness column) | `complete_inputs` | `READINESS_LABELS` |
| downtime-analysis/components/report-card.tsx:17 | `Policy oee_policy@3,loss_policy@2` (every card) | `policyVersionsLabel()` |
| plan-dashboard/components/plan-summary.tsx:19,27; plan-dashboard-page.tsx:53 | `(submitted)`, `Basis time` | `VersionStateBadge` labels; `BASIS_LABELS` |
| plan-dashboard/editor/candidate-row.tsx:36,39 | `auto · planning_rate`, `(baseline_changed)` | Basis labels; remove |
| plan-dashboard/components/actuals-provenance.tsx:32-33,38,55 | `meter (counter_delta, measured)` | Method / quality / source maps |
| plan-dashboard/components/valuation-tiles.tsx:47 | `valued` badge | Status labels |
| plan-dashboard/workflow/change-proposals-panel.tsx:23,51 | Proposal state, trigger, JSON before/after | Labels; diff list |
| plan-dashboard/editor/evidence-picker.tsx:32; downtime-analysis/components/state-timeline.tsx:88 | `stop`, `ProductionLoss`, `unplanned` | `humanize()` |
| event-hub/components/revision-timeline.tsx:18; review-items-list.tsx:30; state-badges.tsx:42 | `by user`, `(scheduleClass)`, `Legacy status: …` | Actor name; field labels |
| pla-analytics/tabs/loss-tree-tab.tsx:53,59; opportunities-tab.tsx:49; rca/components/approved-impact.tsx:37; reports/loss-value-card.tsx:23; components/scope-export.tsx:72; components/oee-group-table.tsx:23 | `Basis: …`, `plan ledger`, `Export running`, `reconciled_…` | `LEDGER_LABELS`, `METRIC_LABELS` (`pla-analytics/model/display.ts:28`) |
| plans-profiles-calendars: plans/plan-detail.tsx:59, version-history.tsx:23-24, plans-tab.tsx:61, components/version-state-badge.tsx:16, generation-progress.tsx:25, rate-import-dialog.tsx:34, profiles/profile-detail.tsx:35, profile-list.tsx:34, rate-table.tsx:64, valuation-rate-table.tsx:69, calendar-preview-table.tsx:51, period-preview.tsx:46, open-version-actions.tsx:54 | `time basis · scheduled_capacity`, `draft`/`superseded`, `nameplate`, `planned_shutdown`, raw ISO | Export the existing `BASIS_LABELS` / `DISTRIBUTION_LABELS` (`plan-form-dialog.tsx:22,27`); add state, rate-kind and exclusion labels; `<PlantTime>` |
| codes-admin/rules/rules-panel.tsx:54, rule-detail.tsx:38,42, rule-editor.tsx:65 | `active`, `v2 create` | Labels; plain sentence |
| rca/cases/logic-tree-editor.tsx:35; rca/actions/action-row.tsx:33 | Raw or partly humanised status | `humanize()` |
| integration-console: mapping/source-mappings-tab.tsx:37,40; resolution-preview.tsx:23; mapping-editor.tsx:41; mapping-preview.tsx:42; mqtt/subscription-status.tsx:37; jobs/replay-run-status.tsx:29; signals/signal-actions.tsx:52,67; quarantine/exception-detail.tsx:36; jobs/job-transitions.tsx:17; signals/signals-panel.tsx:40 | `exact_path`, `unit`, `job draining`, raw states | `JOB_STATE_DISPLAY` (`model/job-states.ts`) + new maps |
| features/permissions/module-permissions-panel.tsx:53,70; pages/PermissionsManagement.tsx:169; UserManagement.tsx:358; AdminPanel.tsx:522; **components/Layout.tsx:172** | `TenantAdmin`, `manager_approver` | `ROLE_LABELS` |
| codes-admin/codes-admin-off.tsx:14; status-rules-moved.tsx:22; downtime-analysis/downtime-off.tsx:8; finance/finance-off.tsx:9; plan-dashboard/plan-dashboard-off.tsx:10; plans-profiles-calendars/planning-off.tsx:9 | `feature flag "v2.codesAdmin"` | `FEATURE_LABELS` + "ask a plant administrator" |

**Legacy v1 enum tokens** appear in about 35 more places:
- `pages/Dashboard.tsx:545,549,896-902,1006`
- `RCAModule.tsx:1293,1458,3255,4768-4824,5352`
- `RCAKnowledgeBase.tsx:620,765,932,941`
- `AuditLogs.tsx:286,290`, `Reports.tsx:479-480`, `Tasks.tsx:319`, `MasterData.tsx:729`
- `DashboardAnalytics.tsx:736,742`, `LossEventTable.tsx:150`, `RCATimeline.tsx:196,200`, `RCATriggerSettings.tsx:224`, `EventDiagram.tsx:207`
- `production-plans/*`, `CodesManagement.tsx:306`, `integrations/*`
- `HistorianMicroTrends.tsx:779`

### C.4 JSON dumps

| file:line | Fix |
|---|---|
| event-hub/components/evidence-panel.tsx:26 (`sourceFacts`) (H) | Labelled key/value table + "Show raw payload" |
| event-hub/components/source-effective-table.tsx:14 (H) | Same as C.2 row 9 |
| plan-dashboard/workflow/change-proposals-panel.tsx:23 (H) | Diff list |
| integration-console/quarantine/exception-detail.tsx:45,50 (M) | Labelled detail; raw payload collapsed |
| integration-console/mqtt/profile-editor.tsx:80; jobs/job-row.tsx:61 (L) | Acceptable for admins / disclosure |
| pages/AuditLogs.tsx:325 (M); AuditTrailViewer.tsx:117 (L) | Pretty key/value |

**Counts:**

| Category | Sites |
|---|---|
| Error, refusal and code surfaces | about 42 (7 of them correlation ids) |
| Raw or truncated ids | about 59 (21 in v2) |
| v2 enum surfaces | about 41 |
| Legacy enum surfaces | about 35 |
| Feature-flag key mentions | 6 |
| JSON dumps | 8 |

**Jargon in copy** (Nielsen: match with the real world):

| Copy | Where |
|---|---|
| "Triggers only recommend (D13)" | `rca/rca-page.tsx:37` |
| "Push to CMMS is not available in R1 (D12)" | `rca/links/links-tab.tsx:28` |
| "Valuation (D08) partly open", "Plant calendar (D03)", hard-coded "Asia/Tehran" | `plans-profiles-calendars/components/decision-banners.tsx:14-29` |
| "Legacy (v1)" | `legacy/legacy-field.tsx:23` |
| "(D14)" | `profiles/profile-editor-dialog.tsx:87` |
| "no v2 version (v1-only plan)" | `plan-dashboard/plan-dashboard-page.tsx:35` |
| "PI details are pending (D02)" | `integration-console/connections/connections-list.tsx:49` |
| "signals API, plan 1.7" | `signals/signals-panel.tsx:19` |
| "(v2)" in menu tooltips | `navigation-items.ts:47,56,68,76` |

---

## Appendix D: dialogs, sheets, drawers, tabs and z-index

**Totals:**
- About 100 overlays: 68 Radix `DialogContent`, 1 `AlertDialogContent`, 1 `SheetContent`, 9 `PopoverContent`, 21 hand-rolled `fixed inset-0` divs (19 of them in `RCAModule.tsx`) and 2 `absolute inset-0` pseudo-modals.
- 42 `TabsList`s.
- No `Drawer`/vaul.

**State today:**
- v1 pages keep "which record is open" in `useState` only, so none of their overlays can be linked to.
- v2 already uses search params: `?case=`, `?entry=` and `?tab=` on `/planning` and `/plans/:id`.

**Rule.** Keep a dialog for a confirmation, a picker, or a form of about 5 fields or fewer. Move to a route when there are more than about 5 fields, a wizard, tabs or tables, or a full detail record.

The keep/move decisions and proposed URLs are summarised in §8. The detailed v2 rows are below.

| file:line | Overlay | Trigger | Size | Content | Scroll | Nesting | Rec |
|---|---|---|---|---|---|---|---|
| event-hub/components/event-detail-drawer.tsx:40 | Event detail Sheet | Row / Current stops "Open"; also on /downtime | `w-full sm:max-w-2xl` | Summary, 3 actions, RCA panel, 5 tabs | Y | Opens dialogs on top | **MOVE** `/events/:eventId` |
| event-hub/components/event-form-dialog.tsx:31 | New / edit event | "New event"; drawer "Edit / code" | `max-w-2xl max-h-[90vh]` | 12 fields | Y | Conflict dialog inside (3 levels) | **MOVE** |
| event-hub/components/conflict-dialog.tsx:49 | Someone changed this event | 409 | `max-w-2xl` | Diff table | N | Inside form | Keep |
| event-hub/components/split-dialog.tsx:43; close-stop-dialog.tsx:34; merge-dialog.tsx:41 | Split / close / merge | Drawer, bulk bar | default | 2–3 fields | N | Above the Sheet | Keep |
| event-hub/components/bulk-code-dialog.tsx:43 | Code N events | Bulk bar | `max-w-2xl max-h-[90vh]` | Picker + preview + progress | Y | – | Keep |
| event-hub/components/multi-check-select.tsx:34 | Filter popover | Filter bars | `w-72 max-h-80` | Checklist | Y | – | Keep |
| rca/link-dialog/link-rca-dialog.tsx:49 | Create / link RCA | Drawer RCA panel | `sm:max-w-2xl max-h-[90vh]` | 2 tabs, search, preview | Y | Dialog over Sheet | **MOVE** |
| rca/cases/create-case-dialog.tsx:28 | New RCA case | "New case" | default | 3 fields | N | – | Keep |
| codes-admin/codes/code-create-dialog.tsx:43; retire-dialog.tsx:29 | New code; Retire | Library | default | 4 fields / confirmation | N | – | Keep |
| integration-console/connections/connection-wizard.tsx:28 | New / edit connection | List "New", detail "Edit" | `max-w-3xl max-h-[90vh]` | PI form with 11 fields, or 4-step MQTT wizard with about 35 fields | Y | – | **MOVE** |
| integration-console/jobs/job-command-dialog.tsx:37; mapping/bind-source-dialog.tsx:53 | Job action; bind source | Rows | default | 1 field / picker | N | – | Keep |
| plans-profiles-calendars/plans/plan-form-dialog.tsx:45 | Plan create / edit / version | Plans tab | `max-w-4xl max-h-[90vh]` | 9 fields + slices editor | Y | – | **MOVE** |
| plans-profiles-calendars/profiles/profile-editor-dialog.tsx:66 | Profile editor | Profiles tab | `max-w-2xl` | 8 fields | **N (no scroll)** | – | **MOVE** |
| plans-profiles-calendars/profiles/rate-import-dialog.tsx:72 | Import rates | Profiles tab | `max-w-2xl` | 3 fields + result | N | – | Keep (add scroll) |
| plan-dashboard/editor/conflict-dialogs.tsx:24 | Run changed / stale revision | Save conflict | default | Confirmation | N | – | Keep |
| components/PlantSelector.tsx:346 | Plant popover | Header | `min-w-[340px] max-h-[400px]` | Tree | Y | – | Keep (make keyboard-accessible) |

The v1 overlays (EventHub, production plans, master data, admin, RCAModule, Connectivity) are summarised in §8. RCAModule has 17 custom modals, among them an Evidence form with 22 fields, a full-screen analysis tool with 9 tabs, and "Start New RCA". Two of its modals (`:5524`, `:5545`) are unreachable dead code.

### D.1 TabsLists at risk
shadcn `TabsList` is `inline-flex h-10` and its triggers are `whitespace-nowrap`. So `grid-cols-N` squeezes the labels, and `flex-wrap` without `h-auto` spills out of the 40 px box. The content width is about 976 px at 1280 with the sidebar expanded.

| file:line | Tabs | Handling | Risk |
|---|---|---|---|
| pages/Connectivity.tsx:245 | 9 | `grid-cols-9`; orphan `TabsContent value="browser"` at :2032 | High |
| pages/RCAModule.tsx:3184 | 9 | flex, no wrap | High |
| pages/MasterData.tsx:640 | 8 | `grid-cols-8` ("Codes Management" needs about 155 px; the cell is about 133) | High |
| components/streaming/RealTimeCharts.tsx:670 | dynamic | `grid-cols-4 h-10`; a button inside the trigger button | High |
| pages/integrations/PIIntegration.tsx:773 | 8 | inline-flex, third nesting level | Med-high |
| pages/AdminPanel.tsx:349 | 6 | `grid-cols-6/5` chosen by `isSuperAdmin`, while the trigger count depends on `canEditRules` | Med |
| components/DashboardConfiguration.tsx:155 | 8 | `grid-cols-8` inside a card | Med |
| pages/EventHub.tsx:1819 | 6 | flex, no wrap | Med |
| features/event-hub/components/event-detail-drawer.tsx:64 | 5 | `flex-wrap` without `h-auto` | Med |
| features/integration-console/connections/connection-detail.tsx:60 | 5 | `flex-wrap` without `h-auto` | Med |
| features/pla-analytics/pla-analytics-page.tsx:41 | 8 | `h-auto flex-wrap` | Low (handled) |
| features/codes-admin/codes-admin-page.tsx:36 | 7 (mapped libraries + rules) | `flex-wrap` without `h-auto`; not in the URL | Low-med |

The remaining 30 lists have 2–5 tabs and low risk.

Nesting on one screen: Connectivity v1 (9 tabs) → Integrations → PIIntegration (8 tabs) → nested (3) → RealTimeCharts (dynamic). That is 3–4 tab levels.

### D.2 z-index and overlap

**Baseline:**
- Header: `fixed z-30 h-20`.
- Sidebar: `fixed z-20`.
- `<main>` is its own scroll container.
- Radix overlays: `z-50`, portalled.
- Toast: `z-[100]`.

**Nothing is hidden under the header.** The findings are:
1. **Two toasters.** `Toaster` and `Sonner` both default to bottom-right (`App.tsx:107-108`) and overlap. Below 640 px the shadcn viewport moves to the top and covers the header.
2. **Dead fixed layers** in `PlanDashboard.tsx:1312,1314` under the header.
   - The `sticky z-30` nav at `:1317` ties with the header's z-index.
   - The `min-h-screen` root forces extra scroll.
   - The `absolute z-10` tooltip at `:1693` can be clipped.
3. **21 custom `fixed inset-0 z-50` overlays.** They have no `role="dialog"`, focus trap, Escape or scroll lock, and they stack only by DOM order. `LogicTreeNodeInteractive` is defined inside the `RCAModule` component body (`:1066`), so it remounts on every render.
4. **`LogicTreeBuilder.tsx:390,427`.** Its `absolute inset-0` form is positioned against the scrolling tree pane (`RCATemplates.tsx:~297`), so it can be off-screen.
5. **Dialogs with no `max-h`/overflow**: the list in §2. `PlanForm.tsx:363` and `PlanApprovalWorkflow.tsx:166` have `min-h-[600px]`.
6. **Transform trap.** Radix `DialogContent` uses `translate`, so a `fixed` child would position against the dialog. Never nest custom fixed modals inside a Radix dialog.
7. **Deep stacks:**
   - Sheet → form → conflict
   - Sheet → link RCA
   - PlanForm → approval
   - Reconcile → select event
   - AuditTrailViewer → change details
   - CodesManagement full screen → cause tree dialog
   - EventHub custom → AuditTrailViewer / ReasonCodeTreePicker
8. **`PlanDashboard.tsx:2581`.** `PopoverContent className="w-full"` should be `w-[--radix-popover-trigger-width]`.
9. **Observed in the capture.** `superadmin_*_connectivity__connection.png`: clicking a connection item timed out (5 s) because another element intercepted the pointer. Check the overlap on the integration console list.

---

## Appendix E: React Query and fetching inventory

### E.1 Query hooks (v2)
**Shared list behaviour.** Every list goes through `useV2InfiniteList` (`use-v2-list.ts:25-44`):
- key: `v2Keys.list(tenant, resource, {scope, window, filters, ledger, revisionSelector})`;
- `enabled`: tenant;
- `staleTime`: `STALE_TIME[resource]`;
- no `maxPages`, `placeholderData` or `select`.

Detail keys are `['v2', tenant, resource, 'detail', id, variant]`.

| Hook | File:line | staleTime | Polling | Notes |
|---|---|---|---|---|
| useCalendarVersions / useCrews / useCrewRotations | calendars.ts:23/34/43 | 5 min | – | limit 200 |
| useCodeList | codes-admin.ts:32 | 5 min | – | limit 500, `{admin:true}` key (duplicates `useCodeLibrary`) |
| useCodeDetail (+ versions / references / mapping preview) | codes-admin.ts:42-60 | **0** | – | |
| useCodeMappingRules | codes-admin.ts:96 | 30 s | – | |
| useImpactValuationRates | codes-admin.ts:115 | 5 min | – | |
| useBulkJob | event-commands.ts:135 | 30 s (should be 0) | 1 s until terminal | |
| useFeatureFlags / useFlag | feature-flags.ts:10/28 | 1 min | – | blocks `FlaggedRoute` |
| useIngestionExceptions / useIngestionException | ingestion-exceptions.ts:19/30 | 30 s | – | |
| useReplayRun | ingestion-exceptions.ts:47 | 0 | 2 s until final | |
| useIngestionJobs | ingestion-jobs.ts:17 | 0 | **5 s, never stops** | + realtime |
| useJobTransitions | ingestion-jobs.ts:29 | 0 | **5 s, never stops** | |
| useConnections / useConnection / useDiscovery / useSourceSample | integration-connections.ts:17/27/75/87 | 30 s | – | |
| useFieldCatalog | integration-mappings.ts:24 | Infinity | – | |
| useEffectiveMappings / useSourceMappings | integration-mappings.ts:35/71 | 30 s | – | |
| usePeriodSummaries | period-overview.ts:30 | 30 s | – | key includes `tz` |
| useReconciliation / useApprovalActions / useChangeProposals | period-overview.ts:53/57/61 | 30 s | – | detail keys always invalidated |
| useWaterfall / useLossValue | period-overview.ts:66/86 | 30 s / Infinity | – | |
| usePlan | period-overview.ts:108 | 5 min | – | gates the whole plan page |
| useExportJob / useActualsJob | period-overview.ts:120/139 | 0 | 2 s / 1.5 s | |
| useScopeWaterfall, useLossTree, useReconciliationTrend, useReconciliationStatus, useActualsQuality | pla-analytics.ts:21-37 | Infinity | – | millisecond window keys defeat the cache |
| usePlans / usePlanScenarios / usePlanVersions / usePlanVersion | plans.ts:22/31/36/47 | 5 min | – | |
| usePlanGenerationJob | plans.ts:128 | 30 s (should be 0) | 1.5 s | |
| useProductionEvents / useProductionEvent / useProductionEventHistory | production-events.ts:16/31/45 | 30 s | current stops 30 s | key includes `tz` |
| useProductionPeriods / useProductionPeriod / usePeriodAccounting | production-periods.ts:16/26/41 | 30 s | – | accounting waits for reconciliation |
| useProducts / useProfiles / useProfileRates / useValuationRates | profiles.ts:11/25/36/47 | 5 min | – | |
| useRateImportJob | profiles.ts:60 | 30 s (should be 0) | 2 s | |
| useRcaCases / useRcaCase (+ links / actions / outcome) / useEventRcaEvidence / useRcaRecommendations | rca-cases.ts:29-92 | 30 s | – | |
| useRcaKnowledgeList / Entry / Similar | rca-knowledge.ts:24/35/47 | 30 s | – | |
| useCodeLibrary / useSites | reference-data.ts:22/32 | 5 min | – | |
| useReport / useDowntimeReport / useOeeReport / useReliabilityReport | reports.ts:44-69 | Infinity | – | |
| useRules / useRule / useRuleVersions / useRulesSchema / useRuleCheck | rules.ts:20-61 | 30 s / Infinity | – | rule check debounced 400 ms |
| useSignals / useSignalBackfillRun | signals.ts:20/58 | 30 s / 0 | – / 3 s | |
| useUnits / useShiftInstances | units.ts:6/22 | 5 min | – | |
| useFxRates / useValuationPolicies | valuation.ts:24/36 | 30 s | – | |

**What no hook uses:**
- `placeholderData`, `keepPreviousData`, `initialData` and `select`: none.
- Prefetch (`prefetchQuery`, `ensureQueryData`, hover prefetch, route chunk preload): none.

### E.2 Fetching outside React Query
**Shell:**
- `AuthContext` runs refresh → profile → org → tenant **in series** (`AuthContext.tsx:128,53,209,218`).
- `Layout` branding uses a `useEffect` with `[]` deps (`Layout.tsx:24-52`).
- `PlantSelector` makes 4 unscoped full-list calls (`PlantSelector.tsx:58-63`), and does so on every page.

**Legacy pages:**

| Page (file:line) | Problem |
|---|---|
| Dashboard.tsx:83 | Full events plus 5 lists |
| PLADashboard.tsx:138,178 | Full events, refetched on every in-browser filter; a fake `setInterval` refresh at :157-165 |
| EventHub.tsx:520-531 | Full events plus 4 lists; reloaded on live refresh and every mutation |
| EventHub.tsx:289-301 | Writes on render (`initializeDefaultConfig`) |
| EventHub.tsx:621-632 | Reason codes refetched on every dialog open |
| MasterData.tsx:136-141 | Sequential awaits |
| RCAModule.tsx:261-284 | N+1 `taskApi.list` per recommendation (`rcaTaskBridge.ts:121-128`) |
| RCAModule.tsx:319-344 | Write on render |
| RCAModule.tsx:590-629 | Units and assets fetched both scoped and unscoped |
| RCAModule.tsx:748-773 | Unscoped `getRCAs({})` |
| RCAKnowledgeBase.tsx:75-100 | 4 sequential awaits |
| Reports.tsx:156-162 | 6 calls per date change |
| AuditLogs.tsx:111-133 | |
| Tasks.tsx:110-125 | Users refetched per filter |
| ProductionPlans.tsx:70-85, AdminPanel.tsx:62-75, UserManagement.tsx:41,57, PermissionsManagement.tsx:30-40 | Unshared fetches |
| PIIntegration.tsx:466-475 | N+1 per attribute |
| plant-hierarchy/UnitList.tsx:117,141 | N+1 `getElement` |
| production-plans/PlanDashboard.tsx:521 | 7 lists including events |
| production-plans/PlanDashboard.tsx:748-790 | N sequential writes |
| PlanForm.tsx:207-213 | `getProductionEvents()` with no filter |
| LossEventTable.tsx:34-40, LossParetoChart.tsx:19-23, LossTrendChart.tsx:22-24, PlanWaterfallChart.tsx:14-16 | Each refetches the events |
| CodesManagement.tsx:74-79, BindingManager.tsx:188-191 | Sequential awaits |

None of these use `AbortController`, so a slow response can overwrite a newer one. Neither `httpClient` nor `v2Request` has a request timeout.

### E.3 Waterfalls

| Flow | Chain | Fix |
|---|---|---|
| Boot | auth chain → flags → route chunk → page queries, with `PlantSelector` lists in parallel | |
| Event Hub, Downtime, PLA, Dashboard v2 | the `tz` key changes when `/v2/sites` resolves, causing a possible double fetch | |
| Plan dashboard | `usePlan` gate → `usePeriodSummaries` + lazy `PeriodDetail` → `useReconciliation` → `usePeriodAccounting` (needs `revisionNumber`) | Start reconciliation in parallel; the backend returns the revision |
| Infinite lists | every loaded page refetches sequentially on invalidation | Set `maxPages` |

### E.4 Polling and realtime
**Job polls:**
- 1 s (bulk), 1.5 s (actuals, plan generation), 2 s (export, rate import, replay), 3 s (backfill). None back off.
- **5 s unconditional:** ingestion jobs and transitions.
- 30 s: current stops.

**Manual `setInterval`:**

| Interval | Where |
|---|---|
| 5 s re-render ticks | `jobs-panel.tsx:28`, `use-mqtt-subscription.ts:21` |
| 60 s | `Connectivity.tsx:208`, `PIIntegration.tsx:128` |
| 300 s | `EnhancedHistorian.tsx:243` |
| 10 s | `PIEventSyncManager.tsx:37` |
| 1–5 s local generators | `StreamingDashboard`, `RealTimePipelineMonitoring`, `IntegrationDashboard`, `HistorianMicroTrends` |

**Socket invalidation** (`use-scoped-realtime.ts:49-59`, `invalidation.ts`):
- There is no coalescing.
- `production_event` invalidates 5 resources.
- Detail keys always match.
- Unknown entity types invalidate the whole tenant.
- Reconnect invalidates the whole tenant on top of `refetchOnReconnect`.

### E.5 Un-debounced inputs

**Inputs that drive requests:**

| Location | Input |
|---|---|
| event-hub/components/event-filters-bar.tsx:41-52 | multi-select |
| downtime-analysis/components/downtime-filters-bar.tsx:37,77-78 | multi-select and toggles |
| pla-analytics/components/analytics-filters.tsx:29 | multi-select |
| pages/Reports.tsx:215,219 | date inputs |
| pages/AuditLogs.tsx:193,197 | date inputs |
| pages/PLADashboard.tsx:537,547 | dates, plus every select (deps at :205) |

**In-memory text searches** (O(n) per keystroke over full arrays):
- `AuditTrailViewer.tsx:184`
- `CodesManagement.tsx:520,569`
- `HierarchyMappingManager.tsx:766`
- `MultiAttributeSelector.tsx:771`
- `TimeSeriesTable.tsx:160`
- `AssetList.tsx:522`
- `PlantHierarchyManager.tsx:135`
- `UnitList.tsx:507`
- `TemplateManager.tsx:95`
- `ProductList.tsx:177`
- `AuditLogs.tsx:239`
- `EventHub.tsx:1930`
- `PIIntegration.tsx:1190,1204,1502,1730`
- `RCAKnowledgeBase.tsx:528`
- `RCAModule.tsx:2946,3447,4328,6264`

**Debounced correctly** (with `useDebouncedValue`):
- `rca/cases/case-list.tsx:24`
- `rca/link-dialog/case-search.tsx:33`
- `rca-knowledge/rca-knowledge-page.tsx:26`
- `event-hub/components/event-form-dialog.tsx:60-61`
- `codes-admin/rules/rule-editor.tsx:42`

---

## Appendix F: icons and dates, full inventory

*This appendix is the full report from the icon and date review. §9 and §10 summarise it. Paths are relative to `src/` unless stated otherwise.*


Scope: `src/**` (`.ts`/`.tsx`). Excludes `src/components/ui/*` (generated shadcn), `*.test.*`, `*.spec.*` and `__tests__`. Read-only; no files were changed. Scratch scripts are in the session scratchpad only (`icons.js`, `dates.js`).

---

### Part 1: Icons (lucide-react 0.462.0)

#### 1.1 Totals
- **108 files** import from `lucide-react`. There are **155 distinct icon names** and **980 import occurrences** (icon × file).
- The v2 `src/features/**` code uses icons sparingly: 27 import lines, mostly status icons (AlertTriangle, Lock, CheckCircle2, XCircle, Info). The legacy v1 pages and components (`EventHub`, `PLADashboard`, `RCAModule`, `PlanDashboard`, `Connectivity`) hold almost all icon usage.
- **148 imported icons are never used** (they appear only on the import line). This is a heuristic lower bound. Lint does not catch them because `eslint.config.js:26` sets `"@typescript-eslint/no-unused-vars": "off"`. The worst offenders:
  - `pages/PLADashboard.tsx` has 56 unused icons: Plus, Trash2, AlertCircle, Database, Calendar, Zap, Shield, Lock, RotateCcw, Copy, Server, Save, Wifi, PieChart, MessageSquare, ThumbsUp, Bell, Camera, ExternalLink, Link, Paperclip, Send, ThumbsDown, Video, Award, Cloud, Inbox, Star, Unlock, WifiOff, Archive, ArrowDownRight, BarChart, Battery*, CameraOff, Flag, Heart, Mic*, Minimize2, Phone*, Scissors, Signal*, Square, Unlink, VideoOff, Volume2, VolumeX.
  - `components/RCATimeline.tsx` (7 unused), `components/plant-hierarchy/PlantHierarchyManager.tsx` (7), `components/integrations/DataFlowVisualization.tsx` (6), `components/AuditTrailViewer.tsx` (5), `components/DashboardAnalytics.tsx` (5), `pages/MasterData.tsx` (5).
- **Deprecated aliases are used throughout.** In 0.462 these names are aliases of renamed icons:
  - `Edit`→`SquarePen`, `Edit2`→`Pen`, `Edit3`→`PenLine`
  - `AlertTriangle`→`TriangleAlert`, `AlertCircle`→`CircleAlert`
  - `CheckCircle`→`CircleCheckBig`, `CheckCircle2`→`CircleCheck`, `XCircle`→`CircleX`
  - `BarChart3`→`ChartColumn`, `BarChart`→`ChartNoAxesColumnIncreasing`, `PieChart`→`ChartPie`, `LineChart`→`ChartLine`, `AreaChart`→`ChartArea`
  - `Loader2`→`LoaderCircle`, `MoreHorizontal`→`Ellipsis`, `HelpCircle`→`CircleHelp`, `CheckSquare`→`SquareCheckBig`, `PlusCircle`→`CirclePlus`

  A registry (§1.6) is the single place to switch to the canonical names.

#### 1.2 Icon usage map: count of files and meaning(s) where used
Paths are relative to `src/`. `c/` = `components/`, `p/` = `pages/`, `f/` = `features/`.

| Icon | Files | Meaning(s) observed |
|---|---|---|
| Plus | 42 | **add/create** everywhere (AttributeManagementPanel, AuditTrailViewer, CodesManagement, EventDiagram, HierarchyMappingManager, Historian*, BindingManager, DataSourceManager, DataTransformationPanel, OPCUAMonitor, AssetList, PlantHierarchyManager, UnitList, PlanDashboard, PlanList, TemplateManager, ProductionPlanSelector, ProductList, all 6 rca-analysis tools, 5 rca-settings, RCATriggerSettings, ReasonCodeLibraryTree, f/integration-console/connections/connections-list, p/AdminPanel, Connectivity, EventHub, MasterData, PLADashboard, RCAModule, Tasks, UserManagement). Consistent. `PlusCircle` is never used. |
| Trash2 | 40 | **delete**, consistent (same 40-file set as Plus/Edit, plus PlanActions, RCATimeline, DataSeedingPage). `Trash` is never used. |
| Settings | 36 | (a) **settings/config** action: Layout:161, nav `/settings`, HistorianMicroTrends:659/731, HistorianTagConfigurator:591, OPCUAMonitor:574, RealTimeCharts:573, RCATriggerSettings:177, ProductionPlanSelector:179. (b) **Production Unit entity**: PlantSelector:211,270,282,311; PlantHierarchyManager:278; UnitList:297,522; MasterData:422,683; TemplateManager:155; PlanDashboard:1974. (c) **generic protocol fallback** for bacnet/dnp3/modbus/ethernetip/profinet/default: DataSourceManager:782-788, DataFlowVisualization:216, IntegrationDashboard:93, StreamingDashboard:202. (d) **empty-state illustration**: AttributeManagementPanel:279, CustomAttributeDisplay:523, ProductionPlanSelector:364. |
| CheckCircle | 29 | success/approved/connected status; approve step (PlanApprovalWorkflow) |
| CheckCircle2 | 5 | success/valid status (v2: validation-summary:24, policies-tab:21, diagnostics-panel, stage-tracker, period-preview) |
| Check | 3 | selected-item tick (PlantSelector:159-226), wizard step done (TemplateWizard:207,257), "use template" button (TemplateSelector:67) |
| AlertTriangle | 27 | warning/error/refusal; **Event Hub nav item** (navigation-items:50); v2 refusals (admin-refusal-alert, command-error, console-refusal, editor-problem, refusal-notice, data-state) |
| AlertCircle | 24 | error/warning status (overlaps AlertTriangle) |
| XCircle | 15 | failed/rejected/disconnected status |
| X | 9 | **close/remove row** (CodesManagement, EventFormFields, TemplateWizard, RCATriggerSettings, f/codes-admin/rules/action-row & condition-row, EventHub, RCAKnowledgeBase, RCAModule) |
| Edit | 25 | **edit** (main icon) |
| Edit2 | 2 | **edit**: EventDiagram:221, RCATimeline:244 |
| Pencil | 1 file / 8 sites | **edit**: RCAModule:1344,3236,3601,3674,4454,4794,4842; also a decorative "Team Charter Guidance" heading at RCAModule:3337 |
| Eye | 24 | (a) **view/details** (AuditTrailViewer:261/483, LossEventTable:162, PlanActions:25, ProductionPlanSelector:350, SimilarRCAs:263, LogicTreeBuilder:246, AuditLogs:296, RCAKnowledgeBase:470/706, RCAModule:3600/3673/4812, PLADashboard:851). (b) **visibility toggle** with EyeOff (TimeSeriesChart:351, DataTransformationPanel:394/459, OPCUAMonitor:721, TabVisibilitySettings:92/104). (c) **"Inspection" event type** (EventDiagram:35, EventTimeline:12). (d) **read-only hint** (f/ux-kit/read-only-hint:17). (e) **Monitoring** header (OPCUAMonitor:693). |
| Search | 19 | search input adornment; consistent |
| Filter | 18 | (a) **filter** action/panel. (b) **"filtered" pipeline stage/transform** (RealTimePipelineMonitoring:146/345, DataTransformationPanel:420/444, DataFlowVisualization:121). (c) **empty state** (CodesManagement:540/589) |
| RefreshCw | 18 | (a) **refresh/reload** (AuditLogs:200, Reports:222, Tasks:236, Dashboard:371, EventHub:1109, PLADashboard:359, Connectivity ×7, OPCUABrowser, OPCUAMonitor, PIEventSyncManager:231, IntegrationDashboard:123, DataSourceManager:1802/1926, HierarchyMappingManager:625/692). (b) **loading spinner** (HierarchyMappingManager:647, OPCUABrowser:437/474, OPCUAMonitor:452, PlanDashboard:1230). (c) **"Test connection"** (PIIntegration:806). (d) **Change Analysis tool** header (ChangeAnalysisTool:70) |
| RotateCcw | 9 | **reset** (BrandingSettings:212, DataFlowVisualization:301, RealTimePipelineMonitoring:189, StreamingDashboard:261, DataSeedingPage:658-765), **restore** (DataSourceManager:1798/1813 with spin as loader, 1867), **reconnect** (IntegrationDashboard:259). `RotateCw` is never used. |
| Loader2 | 9 | loading spinner (BrandingSettings, DashboardAnalytics, LoginForm, UnitList, ProductList, RCACreateTaskButton, validation-summary, Dashboard, DataSeedingPage). Competes with spinning RefreshCw/RotateCcw. |
| Download | 16 | **export / download** (CSV, report, chart): Historian*, OPCUAMonitor, FiveWhyAnalysis, CauseLibraries, RCATemplates, VerificationChecklists, RealTimeCharts, AuditLogs, Connectivity, EventHub, PLADashboard, RCAKnowledgeBase, RCAModule, Reports |
| Upload | 5 | **import** (CauseLibraries:180, RCATemplates:233, VerificationChecklists:205, EventHub:1114), **upload logo** (BrandingSettings:300/542), and misused as the **event "source" badge** (EventHub:2095, 2265) |
| FileText | 22 | (a) **RCA module nav** (navigation-items:60). (b) **Products** tab (MasterData:440). (c) **Template** (TemplateManager, TemplateSelector). (d) **Note** event type (EventDiagram:33, EventTimeline:10). (e) **Document evidence** (RCAKnowledgeBase:975/977). (f) **report/export** (PLADashboard:1411/1436, Connectivity:2242). (g) "RCA" button (LossEventTable:170). (h) many RCA headers (RCAModule ×14) |
| FileSpreadsheet | 1 | export to spreadsheet (Connectivity:2246) |
| FileJson | 1 | JSON export (Connectivity) |
| Printer | 1 | print (PLADashboard:894) |
| Share2 | 1 | share (PLADashboard:1431) |
| Save | 6 | save (BrandingSettings:222, HistorianTagConfigurator:567, FishboneDiagramTool:426, CodesManagement, RCATriggerSettings, PLADashboard) |
| Copy | 8 | duplicate/clone (TemplateManager:176, FishboneDiagramTool:250, FiveWhyAnalysis:222, SimilarRCAs:196/273) and copy to clipboard (UnitList:588/603, PIIntegration:1014) |
| Send | 3 | submit for approval (PlanForm:418, PlanApprovalWorkflow) |
| ExternalLink | 3 | open in another screen (RCACreateTaskButton:100, PlanDashboard, PLADashboard) |
| ThumbsUp / ThumbsDown | 4 / 3 | helpful/unhelpful vote on knowledge items (knowledge-actions, RCAKnowledgeBase, SimilarRCAs); **not** approve/reject |
| BadgeCheck | 1 | approved badge (PlanApprovalWorkflow) |
| Shield | 16 | (a) **Audit Logs** nav and page (navigation-items:88, AuditLogs:183, Reports:247 "Audit", MasterData:467). (b) **permissions** (module-permissions-panel:27/39, TabVisibilitySettings:50). (c) **approval** (PlanApprovalWorkflow:169, PlanForm:409). (d) **Barrier Analysis** (BarrierAnalysisTool:69). (e) **SOL event type** (EventHub:1742/1834). (f) **"Investigating" status** (EventHub:1729). (g) **reason code / crew field** (EventHub:2277/2281/2441). (h) prevention (FiveWhyAnalysis:344, RCAKnowledgeBase:1052/1060). (i) access-denied (Dashboard:302) |
| Lock / Unlock | 9 / 2 | permission refused / read-only (v2 refusals, plant-access-guard); **Permissions nav** (navigation-items:83); PermissionsManagement |
| BarChart3 | 24 | **3 nav items**: Dashboard, Reports, Production Loss Analysis (navigation-items:38-40); also chart tabs/headers in 21 more files |
| BarChart / PieChart / LineChart / AreaChart | 1/5/4/1 | chart-type toggles and headers; PieChart is also the **"no data" illustration** in f/ux-kit/data-state |
| Activity | 25 | **Connectivity nav** (navigation-items:84); live/streaming metrics; **"RCA Required" status** (EventHub:1727); event status badge (EventHub:2092/2262); "Signal" and "Audit Trail" sections (EventHub:2311/2451) |
| Database | 22 | **Knowledge Base nav** (61), **Enhanced Historian nav** (86), **Data Seeding nav** (92); data source of type "database" (DataSourceManager:780, IntegrationDashboard:91, StreamingDashboard:200, DataFlowVisualization:214); **PI Bound badge** (AssetList:272, UnitList:316); Historian page; empty states (×10) |
| Server | 8 | server / PI server / connection |
| Wifi / WifiOff / PlugZap / Link / Unlink | 6/2/3/3/1 | connection/online status (Wifi), PI connect (PlugZap), binding (Link BindingManager:1299) |
| Zap | 18 | **MQTT protocol** (DataSourceManager:778, DataFlowVisualization:212, IntegrationDashboard:89, StreamingDashboard:198); **"transformed" stage / Transform** (aliased `as Transform` in DataSourceManager and StreamingDashboard; RealTimePipelineMonitoring:147, DataTransformationPanel:355/379); **energy KPI** (DashboardAnalytics:241, Dashboard:726); quick action (RCAKnowledgeBase:283); sync (PIEventSyncManager:377); Connectivity:744/1631 |
| Code | 3 | **Master Data nav** (62) **and Codes & Rules nav** (63); Codes Management tab (MasterData:449); HierarchyMappingManager |
| Hash / Tag | 3 / 1 | code/id fields (PlantHierarchyManager, PIIntegration, RCAModule) |
| ClipboardList | 9 | **Operator Action** event type (EventDiagram:36, EventTimeline:13); **Failure WO** event type (EventHub:1744/1846); **"In Progress" status** (EventHub:1730); **event id** (EventHub:2089/2259); **OEE code** (EventHub:2107/2275); **recommended action** (EventHub:2283); **FMEA tool** (FMEAAnalysisTool:97); action items (PlanDashboard:2157/2242); Connectivity/EnhancedHistorian headers |
| CheckSquare | 5 | **Tasks** (navigation-items:87, Tasks, RCACreateTaskButton, Reports, RCAModule) |
| Wrench | 10 | **Maintenance** event type (EventDiagram:34, EventTimeline:11); **IOW** event type (EventHub:1741/1828); **Asset / failure mode** (EventHub:2273/2284, PIIntegration:578 "Asset"); custom attributes (AttributeManagementPanel:266); AdminPanel:456; PlanDashboard:2022 |
| Building2 / Building | 5 / 2 | **Organization** entity (PlantSelector:149, PlantHierarchyManager:162, MasterData:404/657, AttributeManagementPanel:258, AdminPanel:365) |
| Factory | 9 | **Plant/Tenant** entity (PlantSelector:186, PlantHierarchyManager:220, MasterData:413/670, AdminPanel:410, AttributeManagementPanel:262); **Production Output** tab (TabVisibilitySettings:57) |
| Package | 11 | **Asset** (PlantSelector:224, AssetList:251/534, PlantHierarchyManager:327, MasterData:431/696, AttributeManagementPanel:270); **Plan** title (PlanItem:52); **Unit** (PlanItem:55); **Product** (TemplateManager:143, TemplateSelector:82, PlanForm) |
| PackageCheck | 2 | Production Output (TabVisibilitySettings:71) |
| Users / User / UserCog / UserCircle2 | 12/6/1/1 | Users nav/User Management (navigation-items:80; MasterData:458; AdminPanel); **crew/team** (EventDiagram, EventTimeline, RCATimeline, TemplateManager); **Admin Panel nav = UserCog** (82); current user (Layout); author (AuditTrailViewer, PlanApprovalWorkflow) |
| Calendar / CalendarDays | 18 / 1 | **Production Plans nav** and **Plans, Profiles & Calendars nav** (41, 45); dates/start-time fields (EventHub:2108/2288, PlanItem, etc.) |
| Clock / Timer / Hourglass / History | 25/1/1/3 | end time / duration / pending (Clock); history (AuditTrailViewer, PlanApprovalWorkflow, PlanItem) |
| DollarSign / Coins / Calculator | 9 / 1 / 1 | cost / **finance** (Finance nav uses Coins, navigation-items:74; cost badges use DollarSign) |
| TrendingDown / TrendingUp | 12 / 21 | **Downtime Analysis nav** (55); **Production Loss tab** (TabVisibilitySettings:36); KPI deltas |
| Target / Gauge | 13 / 8 | OEE/target KPIs; Gauge = OEE/historian metrics |
| Lightbulb | 5 | recommendation / insight |
| FileCheck | 6 | "complete analysis" in each rca-analysis tool |
| GitBranch / FolderTree / Layers | 3 / 4 / 2 | fault tree / fishbone (GitBranch), cause library trees (FolderTree) |
| Thermometer / Droplets | 4 / 3 | historian tag types |
| Camera / Video / Paperclip / MessageSquare | 3/3/3/4 | evidence attachments; comments (MessageSquare) |
| Info / HelpCircle | 15 / 2 | info notice / help |
| ChevronRight / Down / Left / Up / ChevronsLeft/Right | 19/18/3/1/1/1 | tree expand, pagination, nav collapse |
| Play / Pause / Square | 10 / 9 / 1 | start/stop streams and sync jobs |
| Bell / LogOut / Palette | 3 / 1 / 2 | notifications, sign out, branding |
| Others (1-2 files each) | | Award, Star, Archive, Scissors, Flag, Heart, Mic*, Phone*, Signal*, Battery*, Volume*, Minimize2/Maximize2, GripVertical (drag handle: code-tree, AttributeManagementPanel), Inbox and CloudOff (data-state), CircleDashed and MinusCircle (stage states), Circle, Mail, Image, List, ArrowRight*, ArrowUpDown (sort), MapPin, Bug, Cloud |

#### 1.3 Inconsistencies

**Same action, different icons**

| Action | Variants found | Where |
|---|---|---|
| Edit | `Edit` (SquarePen, 25 files), `Edit2` (Pen), `Pencil` | Edit2: EventDiagram:221, RCATimeline:244. Pencil: RCAModule:1344,3236,3601,3674,4454,4794,4842 |
| Refresh / reset / reconnect | `RefreshCw` (refresh), `RotateCcw` (reset, restore, reconnect) | RotateCcw for reconnect at IntegrationDashboard:259 overlaps "refresh"; RefreshCw for "Test Connection" at PIIntegration:806 |
| Loading spinner | `Loader2`, spinning `RefreshCw`, spinning `RotateCcw` | RefreshCw spin: HierarchyMappingManager:647, OPCUABrowser:437/474, OPCUAMonitor:452, PlanDashboard:1230. RotateCcw spin: DataSourceManager:1813 |
| Success / approve | `CheckCircle` (CircleCheckBig), `CheckCircle2` (CircleCheck), `Check`, `BadgeCheck`, emoji ✅ | v1 uses CheckCircle, v2 uses CheckCircle2; emoji at Connectivity:274/284/482/483, OPCUABrowser:442, FishboneDiagramTool:136, FiveWhyAnalysis:132, DataSeedingPage:134/334/541-545, TestRCAAnalysisTools:148/488, RCATriggerSettings:429/432, HierarchyMappingManager:650 |
| Error / warning | `AlertTriangle` (27), `AlertCircle` (24), `XCircle` (15), emoji ❌/⚠️ | Same severity is shown both ways across files |
| Close / remove | `X`, `XCircle`, `Trash2` | X for removing a rule row (action-row, condition-row) vs Trash2 for removing rows in RCA tools |
| Export | `Download` (16), `FileText` (PLADashboard:1411/1436, Connectivity:2242), `FileSpreadsheet` (Connectivity:2246), `FileJson`, `Printer`, `Share2` | |
| Import | `Upload` | Also used as the event "source" badge (EventHub:2095/2265), which is a meaning clash |
| View details | `Eye`, `ExternalLink`, `FileText` (LossEventTable:170 "RCA") | |
| Duplicate vs copy to clipboard | Both use `Copy` | TemplateManager:176 / FishboneDiagramTool:250 (duplicate) vs UnitList:588/603, PIIntegration:1014 (clipboard) |
| Add | `Plus` only. Consistent; `PlusCircle` is unused. | |
| Delete | `Trash2` only. Consistent; `Trash` is unused. | |

**Same icon, different meanings**

| Icon | Meanings |
|---|---|
| `BarChart3` | Dashboard, Reports **and** Production Loss Analysis nav (navigation-items.ts:38-40), plus chart toggles |
| `Database` | Knowledge Base (61), Enhanced Historian (86), Data Seeding (92) nav; "database" data source; "PI Bound" badge; empty states |
| `Code` | Master Data (62) **and** Codes & Rules (63) nav; Codes tab (MasterData:449) |
| `Calendar` | Production Plans (41) **and** Plans, Profiles & Calendars (45) nav; date fields |
| `Settings` | Settings action/nav; **Production Unit entity** (PlantSelector, PlantHierarchyManager, UnitList, MasterData:422/683, TemplateManager:155, PlanDashboard:1974); generic protocol; empty state |
| `Package` | Asset, Plan (PlanItem:52), Unit (PlanItem:55), Product (TemplateManager:143, TemplateSelector:82) |
| `FileText` | RCA nav, Products tab (MasterData:440), template, Note event, document evidence, export, report |
| `Shield` | Audit Logs, permissions, approval, Barrier Analysis, SOL event type, "Investigating" status, reason-code/crew fields, access denied |
| `ClipboardList` | Operator Action event, Failure WO event, "In Progress" status, event id, OEE code, recommended action, FMEA, action items |
| `Wrench` | Maintenance event, IOW event, asset/failure mode, custom attributes |
| `Activity` | Connectivity nav, live metrics, "RCA Required" status, event status, Signal/Audit Trail sections |
| `Zap` | MQTT, Transform stage, energy KPI, quick action, sync |
| `Eye` | view, visibility toggle, Inspection event, read-only hint, monitoring |
| `Filter` | filter action, "filtered" pipeline stage, empty state |
| `AlertTriangle` | warning **and** the Event Hub nav item (50) |
| `Users` | user management **and** crews/teams |
| `Factory` | Plant/Tenant **and** the Production Output tab (TabVisibilitySettings:57) |
| `TrendingDown` | Downtime nav **and** the Production Loss tab (TabVisibilitySettings:36) |
| `RefreshCw` | refresh, spinner, test connection, Change Analysis tool |

#### 1.4 Emojis used as icons or in UI strings
Lines where `console.*` / logger calls and comments were removed:

| File | Lines and emoji |
|---|---|
| components/EventFormFields.tsx | 191 🛈, 409 🛈, 428 🛈 (info tooltips), 442 💡, 474 🌅, 496 👥 |
| components/PlanWaterfallChart.tsx | 103 📊 |
| components/RCATriggerSettings.tsx | 429 ✅❌, 432 ✅❌, 457 🛢️, 480 🏭 |
| components/hierarchy-mapping/HierarchyMappingManager.tsx | 650 ✅❌ |
| components/historian/HistorianMicroTrends.tsx | 266 📈📉, 294 📈📉 |
| components/integrations/BindingManager.tsx | 844 🔍, 1032 🔍, 1063 🧪, 1125 💡, 1361 🔍 |
| components/integrations/OPCUABrowser.tsx | 442 ✅ |
| components/production-plans/PlanDashboard.tsx | 2304 💡 |
| components/production-plans/PlanForm.tsx | 622, 650, 786, 787, 860 💡; 896 🌅, 905 🌆, 914 🌙 (shift prompts); 937 👥 |
| components/production-plans/template-wizard-steps/StepProductionTime.tsx | 72 💡 |
| components/production-plans/template-wizard-steps/StepProducts.tsx | 70 ✓, 78 📦 |
| components/production-plans/template-wizard-steps/StepReview.tsx | 101 ✓ |
| components/production-plans/template-wizard-steps/StepSchedule.tsx | 104 📅 |
| components/production-plans/template-wizard-steps/StepUnit.tsx | 56 ✓, 87 🏭 |
| components/rca-analysis/FishboneDiagramTool.tsx | 136 ✅ |
| components/rca-analysis/FiveWhyAnalysis.tsx | 132 ✅ |
| components/rca-analysis/SimilarRCAs.tsx | 117 📦, 119 🏭, 120 📅, 148 ✓, 290 💡 |
| pages/Connectivity.tsx | 274 ✅❌❓ (PI status as a 2xl "icon"), 284 ✅⚠️, 293 📊, 299 🔗, 476 🔄, 482-483 ✅❌, 486 🏥, 935 🔗, 942 📊, 949 ⚡, 956 💾, 1222 📡, 1229 ⚡, 1236 📊, 1243 🔄 (stat-tile icons) |
| pages/Dashboard.tsx | 827 💡 |
| pages/DataSeedingPage.tsx | 134 ✅❌, 143/160/267/324 🛢️, 151 🏢, 169 📊, 329 ⚠️, 334 ✅, 346/498 🏭, 541-545 ✅, 552 💡, 557 🔍, 567 🎯, 687 🔧, 866 📖 |
| pages/EventHub.tsx | 465/468/471 💡, 485 🌅, 488 🌆, 491 🌙, 499 👥, 1183/1197/1432/1531/2232 🛈, 1557 💡, 1614 🌅, 1668 👥, **1944-1947 🔴🟠🟡🟢 severity options** |
| pages/MasterData.tsx | 630 🔄, 1053 🛈 |
| pages/RCAKnowledgeBase.tsx | 201 ⭐☆ (rating), 362 🏆, 437 ✓, 560 ⭐, 561 📊, 562 📚, 563 📅, 606 ⭐, 1104 👍 |
| pages/RCAModule.tsx | **1096-1159 6M category icons** (⚙️ 🔄 📦 👤 🌡️ 📋 🎯 ❓ 🔍 ⚠️); **3463 evidence type** 📷📄🎥📝📊; 3478 🕒; 4055 🕐; **6227-6230 🟢🟡🟠🔴 priority options**; 3106 ✓; 6262 🔍 |
| pages/TestRCAAnalysisTools.tsx | 148 ✅❌, 412 📦, 413 🏭, 414 📅, 480 🎓, 488 ✅ |

Many `console.log` calls also contain emojis (for example CodesManagement:65-96, HierarchyMappingManager:70/88). These also break the no-`console.log` rule.

#### 1.5 Proposed standard semantic mapping
Canonical lucide 0.462 names are given, with the deprecated alias in brackets.

**Actions**

| Action | Icon | Replaces |
|---|---|---|
| Add / create | `Plus` | (PlusCircle) |
| Edit | `SquarePen` (Edit) | Edit2, Pencil |
| Delete | `Trash2` | Trash |
| Remove row / close dialog | `X` | XCircle used as remove |
| Save | `Save` | |
| Cancel / discard | `Undo2` (or text-only button) | |
| Refresh / reload data | `RefreshCw` | RotateCcw for refresh/reconnect |
| Reset to defaults / restore | `RotateCcw` | |
| Loading (busy) | `LoaderCircle` (Loader2) + `animate-spin` | spinning RefreshCw/RotateCcw |
| Export / download | `Download` | FileText/FileSpreadsheet/FileJson used as export buttons |
| Import / upload | `Upload` | Upload as "source" badge (use `Radio`/`Cable` for source) |
| Print | `Printer` | |
| Filter | `Funnel`/`Filter` | Filter used for pipeline "filtered" stage |
| Search | `Search` | |
| View / open details | `Eye` | Eye for "Inspection" event or visibility toggle |
| Show / hide toggle | `Eye` / `EyeOff` pair only | |
| Open in another screen | `ExternalLink` | |
| Duplicate | `CopyPlus` | Copy for duplicate |
| Copy to clipboard | `Copy` | |
| Settings / configure | `Settings` | Settings as Unit entity / protocol / empty state |
| Submit for approval | `Send` | |
| Approve | `CircleCheckBig` (CheckCircle) | BadgeCheck, ThumbsUp, ✅ |
| Reject | `CircleX` (XCircle) | ❌ |
| Vote helpful / unhelpful | `ThumbsUp` / `ThumbsDown` | |
| More actions | `Ellipsis` (MoreHorizontal) | |
| Start / pause / stop job | `Play` / `Pause` / `Square` | |
| Test connection | `PlugZap` | RefreshCw |
| Sign out | `LogOut` | |

**Status**

| Status | Icon | Replaces |
|---|---|---|
| Success / valid / connected | `CircleCheck` (CheckCircle2) | CheckCircle mixed in, ✅ |
| Warning | `TriangleAlert` (AlertTriangle) | ⚠️ |
| Error / failed | `CircleAlert` (AlertCircle) | XCircle when meaning "error" |
| Info | `Info` | 🛈 |
| Pending / not started | `CircleDashed` | |
| Locked / permission refused | `Lock` | |
| Read-only | `Eye` + label (ux-kit read-only-hint) | |
| Empty / no data | `Inbox` | PieChart, Settings, Database as empty art |
| Offline | `CloudOff` / `WifiOff` | |
| Severity / priority | coloured `Badge` component, no icon | 🔴🟠🟡🟢 |

**Entities**

| Entity | Icon | Replaces |
|---|---|---|
| Organization | `Building2` | Building |
| Plant / tenant / site | `Factory` | |
| Production unit | `Cog` (or `Boxes`) | Settings |
| Asset | `Package` | |
| Product | `PackageCheck` (or `Barcode`) | FileText, Package |
| Event (loss/downtime event) | `Zap`-free: `CalendarClock` or `ListChecks`; recommended `Siren` | AlertTriangle in nav |
| Downtime | `TrendingDown` | |
| Production plan | `CalendarRange` | Calendar, Package |
| Profile / calendar (v2 planning) | `CalendarCog` | Calendar |
| RCA case | `SearchCheck` (or `Microscope`) | FileText |
| Knowledge base | `BookOpen` | Database |
| Task / action item | `SquareCheckBig` (CheckSquare) | ClipboardList |
| User | `User` |  |
| Users / team / crew | `Users` |  |
| Admin | `UserCog` |  |
| Permissions / roles | `KeyRound` | Lock, Shield |
| Audit log | `ScrollText` | Shield |
| Connection / integration | `Cable` (or `PlugZap`) | Activity |
| Historian / time series | `ChartLine` | Database |
| Data source "database" | `Database` (only this meaning) | |
| MQTT / protocol | `RadioTower` | Zap |
| Code library / master data codes | `Tags` | Code |
| Master data | `Library` | Code |
| Rule | `Workflow` |  |
| Finance / cost | `Coins` (nav) and `Banknote` (cost value) | DollarSign mixed |
| FX rate | `ArrowLeftRight` |  |
| Dashboard | `LayoutDashboard` | BarChart3 |
| Reports | `FileBarChart` / `ChartColumn` | BarChart3 |
| Loss analysis (PLA) | `ChartColumnDecreasing` | BarChart3 |
| Evidence: photo / document / video / note | `Camera` / `FileText` / `Video` / `StickyNote` | emoji at RCAModule:3463 |
| RCA 6M categories | `Cog`, `Workflow`, `Package`, `User`, `Thermometer`, `Ruler` | emoji at RCAModule:1096-1159 |
| Event types: Maintenance / Inspection / Operator Action / Note | `Wrench` / `ScanSearch` / `Hand` / `StickyNote` | Eye, ClipboardList, FileText |
| Settings page | `Settings` | |

Note: `Siren`, `ScrollText`, `CalendarRange`, `CalendarCog`, `SearchCheck`, `CopyPlus`, `FileBarChart`, `ChartColumnDecreasing` and `KeyRound` exist in 0.4xx, but check each name against `node_modules/lucide-react/dist/lucide-react.d.ts` before adopting it.

#### 1.6 Suggested registry `src/lib/icons.ts`
```ts
import type { LucideIcon } from 'lucide-react';
import {
  Plus, SquarePen, Trash2, X, Save, RefreshCw, RotateCcw, LoaderCircle, Download, Upload, Printer,
  Filter, Search, Eye, EyeOff, ExternalLink, Copy, CopyPlus, Settings, Send, CircleCheckBig, CircleX,
  Ellipsis, PlugZap, CircleCheck, TriangleAlert, CircleAlert, Info, CircleDashed, Lock, Inbox, CloudOff,
  Building2, Factory, Cog, Package, PackageCheck, Siren, TrendingDown, CalendarRange, CalendarCog,
  SearchCheck, BookOpen, SquareCheckBig, User, Users, UserCog, KeyRound, ScrollText, Cable, ChartLine,
  Tags, Library, Workflow, Coins, LayoutDashboard, FileBarChart, ChartColumnDecreasing,
} from 'lucide-react';

/** One icon per user action (UI vocabulary). Never import lucide icons directly in feature code. */
export const ActionIcon = {
  add: Plus, edit: SquarePen, delete: Trash2, remove: X, close: X, save: Save,
  refresh: RefreshCw, reset: RotateCcw, loading: LoaderCircle, export: Download, import: Upload,
  print: Printer, filter: Filter, search: Search, view: Eye, show: Eye, hide: EyeOff,
  open: ExternalLink, copy: Copy, duplicate: CopyPlus, settings: Settings, submit: Send,
  approve: CircleCheckBig, reject: CircleX, more: Ellipsis, testConnection: PlugZap,
} as const satisfies Record<string, LucideIcon>;

export const StatusIcon = {
  success: CircleCheck, warning: TriangleAlert, error: CircleAlert, info: Info,
  pending: CircleDashed, locked: Lock, empty: Inbox, offline: CloudOff,
} as const satisfies Record<string, LucideIcon>;

export const EntityIcon = {
  organization: Building2, plant: Factory, unit: Cog, asset: Package, product: PackageCheck,
  event: Siren, downtime: TrendingDown, plan: CalendarRange, calendar: CalendarCog,
  rcaCase: SearchCheck, knowledge: BookOpen, task: SquareCheckBig, user: User, team: Users,
  admin: UserCog, permission: KeyRound, audit: ScrollText, connection: Cable, historian: ChartLine,
  code: Tags, masterData: Library, rule: Workflow, finance: Coins, dashboard: LayoutDashboard,
  report: FileBarChart, lossAnalysis: ChartColumnDecreasing, settings: Settings,
} as const satisfies Record<string, LucideIcon>;

export type ActionIconKey = keyof typeof ActionIcon;
export type EntityIconKey = keyof typeof EntityIcon;
```
Follow-ups:
- Make `navigation-items.ts` use `EntityIcon.*`. This gives every nav item a unique icon.
- Add a lint rule `no-restricted-imports` for `lucide-react` outside `src/lib/icons.ts` (warn first, since legacy files are oversized).
- Re-enable `no-unused-vars`, at least as a warning, to drop the ~148 dead icon imports.

---

### Part 2: Dates and calendar

#### 2.1 Dependencies (root `package.json`)
- `date-fns` `^3.6.0`: **0 imports in `src/`**. It is effectively unused (it is only a peer of react-day-picker).
- `react-day-picker` `^8.10.1`: used only by the generated `src/components/ui/calendar.tsx:3`. **That component is imported nowhere** (no shadcn Calendar or DatePicker in the app).
- `lucide-react` `^0.462.0`.
- No dayjs, moment, luxon, date-fns-tz or Jalali library on the frontend.
- The backend has `luxon ^3.7.2`, used only in `server/pro-act-backend/src/domain/calendar/zone-timeline.ts:1` (IANA offsets).

#### 2.2 Count per pattern

| Pattern | Hits | Files | Notes |
|---|---|---|---|
| `.toLocaleString(` | 118 | 34 | about 50 are dates; the rest are numbers |
| `.toLocaleDateString(` | 32 | 16 | all dates |
| `.toLocaleTimeString(` | 23 | 15 | all dates |
| **toLocale\* on dates (total)** | **~105 lines** | **41 files** | browser timezone and browser locale; ~68 more toLocale lines format numbers |
| `Intl.DateTimeFormat` | 7 | 2 | `features/ux-kit/format/plant-time.ts:22,34`; `utils/dateFormatters.ts:25,85` |
| `timeZone:` option | 2 | 1 | only plant-time.ts:22,35 |
| `from 'date-fns'`, `format(`, `formatDistance`, `parseISO` | 0 | 0 | |
| dayjs / moment / luxon (frontend) | 0 | 0 | |
| `new Date(` | 1184 | 104 | pages 166, components 189, features 23, services 796 (325 in seeders), utils 8, lib 1 |
| `Date.now()` | 393 | 67 | |
| `.toISOString()` | 532 | 68 | |
| `toISOString().slice/split/substring` (date-only via UTC) | 61 | 15 | 36 of them in seeders |
| manual `getFullYear/getMonth/getDate/getDay/getHours/set*` | 33 | 11 | |
| `type="date"` | 39 | 21 | |
| `type="datetime-local"` | 31 | 16 | |
| `type="time"` | 4 | 2 | |
| Recharts `tickFormatter` on dates | 3 | 1 | |
| Legacy `@/utils/dateFormatters` imports | 5 | 5 | |
| ux-kit `PlantTime` / `formatPlantTime` / `plantTimeParts` / `usePlantTimezone` | 171 | 70 | the v2 standard |
| Duration formatters (`utils/durationFormatter`, `ux-kit/format/duration`, `DurationText`) | 86 | 31 | |
| `freshnessOf` | 3 | 2 | |

#### 2.3 Existing shared helpers
1. **`src/features/ux-kit/format/plant-time.ts`** (59 lines, the v2 standard).
   - `plantTimeParts(iso, tz)` calls `Intl.DateTimeFormat('en-CA', {timeZone, …, hourCycle:'h23', timeZoneName:'longOffset'}).formatToParts`. It returns `{date:'YYYY-MM-DD', time:'HH:mm', offset:'+03:30', timezone}` (lines 30-51).
   - `formatPlantTime(iso, tz, withDate)` returns `06:00 (+04:00 Asia/Dubai)` (lines 54-59). `normalizeOffset` is at lines 14-18.
   - **Important:** `plantTimeParts` is also used for **logic**, not only display:
     - `features/event-hub/model/plant-local-time.ts:11,33` (`plantLocalToUtc` / `utcToPlantLocal` for `datetime-local` inputs)
     - `features/pla-analytics/reports/reports-filters.tsx:15` (`plantDate`)

     It must stay ISO/Gregorian. The Jalali display must be a separate layer.
2. `src/features/ux-kit/plant-time.tsx`: the `<PlantTime iso tz withDate/>` component (`<time dateTime title=UTC>`).
3. `src/features/ux-kit/use-plant-timezone.ts`: picks the default site, then `session.tenant.timezone`, then labelled UTC. It uses `choosePlantTimezone` from `src/api/v2/queries/reference-data.ts:43-55`. Gap: it reads `session?.tenant`, not the selected plant's tenant (`plantSelection?.tenant`).
4. `src/features/event-hub/model/plant-local-time.ts`: `plantLocalToUtc` (DST-safe two-pass) and `utcToPlantLocal`. Used by event-hub (close-stop-dialog, event-form-dialog, model/event-form.ts), finance (model/fx-form.ts, model/policy-form.ts), pla-analytics reports-filters, and plans-profiles-calendars (model/calendar-draft.ts, plan-form.ts, profile-form.ts).
5. `src/features/ux-kit/format/freshness.ts` ("3 min ago", used by scope-header) and `format/duration.ts`.
6. **Legacy `src/utils/dateFormatters.ts`** (151 lines).
   - `formatDate`, `formatDateRange`, `formatDateTime` are hard-coded to `'en-US'` with the browser timezone (lines 25, 85) and use `getFullYear/getMonth` (50-57).
   - It has `console.warn`.
   - Consumers: `components/production-plans/PlanDashboard.tsx:51`, `PlanItem.tsx:10`, `TemplateManager.tsx:4`, `TemplateSelector.tsx:4`, `template-wizard-steps/StepSchedule.tsx:7`.
7. `src/utils/durationFormatter.ts` (273 lines; durations only).
8. `src/features/plans-profiles-calendars/calendars/timezone-input.tsx`: IANA zone picker (`Intl.supportedValuesOf`).

#### 2.4 Full site list, grouped by file

**A. `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` on dates (browser zone and locale, Gregorian only)**
Unless noted, each line is `new Date(x).toLocale*()`.

| File | Lines |
|---|---|
| components/AuditTrailViewer.tsx | 246, 250, 323, 327, 450, 497 |
| components/BrandingSettings.tsx | 638 |
| components/CustomAttributeDisplay.tsx | 106 (date-type attribute values) |
| components/EventDiagram.tsx | 181 |
| components/EventTimeline.tsx | 41 |
| components/historian/EnhancedHistorianPage.tsx | 920, 933 (×2), 1119 |
| components/historian/HistorianMicroTrends.tsx | 632 |
| components/historian/PIConnectionDiagnostic.tsx | 265 |
| components/historian/TimeSeriesChart.tsx | 74 |
| components/historian/TimeSeriesTable.tsx | 258 |
| components/integrations/DataFlowVisualization.tsx | 498 |
| components/integrations/DataSourceManager.tsx | 1836, 1906 |
| components/integrations/OPCUABrowser.tsx | 166, 288, 526, 612 |
| components/integrations/OPCUAMonitor.tsx | 682, 749 |
| components/integrations/RealTimePipelineMonitoring.tsx | 420 |
| components/pi/PIEventSyncManager.tsx | 203, 255, 346, 353 |
| components/PlanWaterfallChart.tsx | 108 (×2) |
| components/production-plans/PlanApprovalWorkflow.tsx | 261, 399 |
| components/production-plans/PlanDashboard.tsx | 928, 938 (×2), 940 (`'en-US'` forced), 2629, 2778, 2779 |
| components/production-plans/PlanForm.tsx | 886 (`'en-US'`), 1045 |
| components/ProductionPlanSelector.tsx | 104 (`'en-US'`) |
| components/rca-analysis/SimilarRCAs.tsx | 120 |
| components/RCATimeline.tsx | 209, 344 |
| components/streaming/RealTimeCharts.tsx | 425, 453, 481 (Recharts `tickFormatter`) |
| components/streaming/StreamingDashboard.tsx | 414 |
| pages/AuditLogs.tsx | 57 (helper) |
| pages/Connectivity.tsx | 124, 131, 145, 190, 195 (stored as string in state), 2086 |
| pages/Dashboard.tsx | 338 (`'en-US'`, weekday) |
| pages/EnhancedHistorian.tsx | 213 |
| pages/EventHub.tsx | 458, 478 (`'en-US'`), 2108, 2110, 2288, 2289 |
| pages/integrations/PIIntegration.tsx | 122 |
| pages/PLADashboard.tsx | 735, 788, 1326, 1330 |
| pages/ProductionPlans.tsx | 170 (date baked into a saved template name) |
| pages/RCAKnowledgeBase.tsx | 222 (CSV export), 681, 984, 1030, 1034 |
| pages/RCAModule.tsx | 3062, 3071, 3315, 3333, 3479, 3541, 3656, 4434, 4504, 4587, 4668, 4687, 4773, 4826, 5047, 5062, 5081, 5097, 5355, 5628, 5794 (×2); 3331 is commented-out code |
| pages/Reports.tsx | 63 (helper), 541 |
| pages/Tasks.tsx | 63 (helper) |
| pages/TestRCAAnalysisTools.tsx | 414 |
| services/integrations/base/BaseConnector.ts | 475 (connector "format" transform, `config.locale`; data path, not UI) |
| scripts/debugRCAData.ts | 49 (console) |

Numeric `toLocaleString` (not dates, for reference): DashboardAnalytics:408; EnhancedHistorianPage:914, 1089; IntegrationDashboard:158; RealTimePipelineMonitoring:203, 229; PlanWaterfallChart:118-209; PlanDashboard (~35 lines, 489-3266); PlanItem:122, 130; SimilarRCAs:221; RCATimeline:269; RCATriggerSettings:255, 435; StreamingDashboard:275, 286, 297; ux-kit/format/duration.ts:27; EventHub:2099, 2267, 2298; RCAKnowledgeBase:947; OilGasDataSeeder:1341, 1420.

**B. `Intl.DateTimeFormat`**: `features/ux-kit/format/plant-time.ts`:22, 34; `utils/dateFormatters.ts`:25, 85 (plus JSDoc 8, 13).

**C. Manual calendar arithmetic** (`get*` / `set*`; Gregorian and browser-zone assumptions)

| File | Lines |
|---|---|
| components/DashboardAnalytics.tsx | 287, 293 (last-7-days loop, weekday array at 285) |
| components/LossTrendChart.tsx | 49-51 (ISO-ish week key `YYYY-W#`); 46 uses `startTime.slice(0,10)` as the day key |
| components/production-plans/PlanDashboard.tsx | 935, 937 (week range) |
| components/production-plans/PlanForm.tsx | 885 |
| features/pla-analytics/reports/reports-filters.tsx | 20, 26 (UTC day arithmetic on `YYYY-MM-DD`, input only) |
| pages/Dashboard.tsx | 217, 218 (relative day) |
| pages/EventHub.tsx | 170, 457, 477, 1568, 1625 (shift detection by browser hour) |
| pages/PLADashboard.tsx | 110-112 (`formatLocalDate`) |
| services/analytics/UnifiedAnalyticsService.ts | 303, 305, 335, 340, 341, 345 |
| services/OilGasDataSeeder.ts | 1123, 1124 |
| utils/dateFormatters.ts | 50-57 |

Hard-coded Monday-first weekday arrays: DashboardAnalytics:275, 285; PlanDashboard:451, 1274, 1929; PlanForm:52, 508-509, 807. The v2 calendars use ISO weekdays (`schema.d.ts:4035`, 1 = Monday). In Iran the week starts on Saturday.

**D. `toISOString().slice/split` used as a date-only value** (UTC date, can be off by one against plant time)

| File | Lines |
|---|---|
| components/integrations/OPCUAMonitor.tsx | 434 |
| components/production-plans/PlanDashboard.tsx | 393, 604, 619, 674, 945, 1046 |
| components/rca-analysis/ChangeAnalysisTool.tsx | 39 |
| components/streaming/RealTimeCharts.tsx | 374, 384 |
| features/integration-console/jobs/replay-wizard.tsx | 11 (`isoDay`) |
| features/integration-console/signals/signal-actions.tsx | 13 (`isoDay`) |
| features/pla-analytics/reports/reports-filters.tsx | 21, 27 |
| pages/AuditLogs.tsx | 50, 51 |
| pages/EventHub.tsx | 902 |
| pages/PLADashboard.tsx | 71, 72 |
| pages/RCAKnowledgeBase.tsx | 229 |
| pages/RCAModule.tsx | 133, 2272, 2310 |
| pages/Reports.tsx | 48, 49 |
| services/OilGasDataSeeder.ts | 34 lines (1000-2685) |
| services/PresentationDataSeeder.ts | 1394, 1436 |

Also `features/rca/cases/case-editor.tsx:52` uses `targetCloseDate.slice(0,10)`.

**E. Date inputs**

`type="date"` (value is always ISO `YYYY-MM-DD`; the native picker is always Gregorian):

| File | Lines | Notes |
|---|---|---|
| components/CustomAttributeDisplay.tsx | 637 | |
| components/CustomAttributeForm.tsx | 214 | |
| components/production-plans/PlanDashboard.tsx | 2878 | |
| components/production-plans/PlanForm.tsx | 572, 583 | |
| components/production-plans/template-wizard-steps/StepSchedule.tsx | 78, 91 | |
| components/rca-analysis/ChangeAnalysisTool.tsx | 133 | |
| features/integration-console/jobs/replay-wizard.tsx | 39, 42 | |
| features/integration-console/signals/signal-actions.tsx | 34, 37 | |
| features/pla-analytics/reports/reports-filters.tsx | 54, 58 | converted with `plantLocalToUtc` |
| features/plans-profiles-calendars/calendars/calendar-editor.tsx | 65, 68 | operational dates |
| features/plans-profiles-calendars/calendars/calendar-preview-panel.tsx | 52, 55 | |
| features/plans-profiles-calendars/calendars/crew-rotation-editor.tsx | 80, 83 | |
| features/plans-profiles-calendars/calendars/holidays-editor.tsx | 33 | |
| features/rca/actions/action-form.tsx | 37, 40, 43 | |
| features/rca/cases/case-editor.tsx | 51 | |
| pages/AuditLogs.tsx | 193, 197 | |
| pages/EventHub.tsx | 2007, 2018 | |
| pages/PLADashboard.tsx | 537, 547 | |
| pages/RCAModule.tsx | 5413, 5493, 6026, 6235, 6599 | |
| pages/Reports.tsx | 215, 219 | |
| pages/Tasks.tsx | 368 | |

`type="datetime-local"`:

| File | Lines | Zone handling |
|---|---|---|
| components/EventDiagram.tsx | 531 | browser zone |
| components/EventFormFields.tsx | 182, 186, 399, 404 | browser zone |
| components/streaming/RealTimeCharts.tsx | 644, 652 | browser zone |
| features/event-hub/components/close-stop-dialog.tsx | 44 | plant zone |
| features/event-hub/components/event-form-fields.tsx | 61, 64 | plant zone |
| features/event-hub/model/plant-local-time.ts | 4 | doc comment |
| features/finance/fx/fx-rate-form.tsx | 50, 53 | plant zone |
| features/finance/policies/policy-form.tsx | 68 | plant zone |
| features/plans-profiles-calendars/calendars/exclusions-editor.tsx | 27, 28 | plant zone |
| features/plans-profiles-calendars/plans/plan-form-dialog.tsx | 61, 64 | plant zone |
| features/plans-profiles-calendars/plans/slices-editor.tsx | 38, 39 | plant zone |
| features/plans-profiles-calendars/profiles/profile-editor-dialog.tsx | 91, 94 | plant zone |
| features/plans-profiles-calendars/profiles/rate-form.tsx | 52, 55 | plant zone |
| features/plans-profiles-calendars/profiles/valuation-rate-form.tsx | 59, 62 | plant zone |
| pages/EventHub.tsx | 1214, 1224, 1479, 1489 | browser zone |
| pages/RCAModule.tsx | 6402 | browser zone |

`type="time"`: components/production-plans/PlanForm.tsx:816, 836; template-wizard-steps/StepProductionTime.tsx:49, 58.

Calendar / DatePicker components: **none in use** (`components/ui/calendar.tsx` is unused).

**F. Consumers of the ux-kit PlantTime kit** (Intl, plant zone, ISO Gregorian). These are the files that will pick up Jalali automatically once the formatter changes. `file: lines`:

- codes-admin: codes-admin-page 5, 25; codes/code-detail 7, 8, 25, 38; codes/code-versions 6, 33, 37; codes/mapping-rules-panel 10, 11, 27, 84; rules/rule-versions 8, 37; rules/simulation-result 2, 21, 22, 54
- downtime-analysis: components/calendar-comparison 3, 42; components/state-timeline 9, 57, 88
- event-hub: bulk-preview-table 3, 61, 62; close-stop-dialog 9, 38; current-stops-panel 10, 48, 49; event-detail-drawer 11, 96, 98; event-row 4, 25; evidence-panel 2, 24; impacted-periods-preview 6, 40; merge-dialog 10, 49; review-items-list 6, 35; revision-timeline 2, 20, 36; split-dialog 9, 53, 57, 58; window-select 5, 68; event-hub-env 5, 14; model/plant-local-time 1, 11, 33
- finance: finance-page 4, 22; fx/fx-rate-table 3, 38, 39; policies/policy-table 7, 55, 64
- integration-console: connections/diagnostics-panel 5, 48; connections/stage-tracker 2, 26; discovery/sample-table 4, 42, 44; integration-console-page 7, 27; jobs/job-transitions 4, 17; mapping/mapping-preview 3, 42, 43; mqtt/mqtt-test-panel 4, 41; mqtt/subscription-status 4, 26, 91; quarantine/exception-detail 8, 40, 41; quarantine/quarantine-inbox 8, 44
- pla-analytics: components/scope-export 8, 77; reports/reports-filters 6, 15; reports/reports-header 3, 27; tabs/reconciliation-tab 6, 78
- plan-dashboard: components/actuals-provenance 6, 38; components/period-grid-row 4, 46, 64; components/period-header 5, 25; components/plan-summary 4, 24; editor/evidence-picker 7, 32; plan-dashboard-page 12, 29; workflow/change-proposals-panel 9, 51; workflow/export-panel 7, 58; workflow/period-history 4, 26
- plans-profiles-calendars: components/refusal-notice 3, 34, 35; hooks/use-planning-refs 6, 28; planning-page 9, 30; plans/period-preview 5, 39; plans/plan-detail 9, 29, 30, 59, 60; plans/version-history 5, 28; profiles/profile-detail 3, 39, 40, 44; profiles/profile-list 2, 34; profiles/rate-table 10, 73; profiles/valuation-rate-table 11, 75
- rca-knowledge: components/knowledge-detail 8, 29; rca-knowledge-page 6, 23
- rca: actions/action-row 8, 45; cases/case-detail 6, 29, 30; components/evidence-view 1, 28; links/links-tab 8, 41; rca-page 8, 26
- ux-kit: scope-header 3, 30, 45; ux-kit-playground 7, 34

**G. Raw date strings rendered with no formatter** (they would stay Gregorian after a toggle)
- `features/plans-profiles-calendars/calendars/calendar-version-list.tsx:31`: `{version.effectiveFrom} → {version.effectiveTo}` (operational dates)
- `features/plans-profiles-calendars/calendars/crew-rotation-editor.tsx:69-70`: `effectiveFrom/effectiveTo/anchorDate`
- `features/pla-analytics/components/residual-trend-card.tsx:62`: `{b.key}`, the server bucket key
- Chart labels from server bucket keys: `features/pla-analytics/model/series.ts:12, 26` (`labelOf(group.key)`, `b.key`), shown on `charts/series-chart.tsx:35` XAxis; `features/downtime-analysis/components/charts/trend-chart.tsx:32` XAxis `label`
- v1: `DashboardAnalytics.tsx:551, 652` and `PlanDashboard.tsx:1684, 2251, 2268, 2301, 2866, 2975, 3002` (`.period`); `pages/Reports.tsx:331`

**H. Backend date output**
- Exports are UTC ISO: `exports/export-report.ts:157` writes the `['timezone','UTC']` header; `export-renderer.ts:71, 130`; `delivery-reconciliation.service.ts:89, 95`.
- `reporting/reporting.service.ts:249, 414` builds day keys with `toISOString().slice(0,10)`.

  Keep machine exports ISO/Gregorian. A Jalali column would be an optional extra.

#### 2.5 How tenant and app settings are stored and read today

**Backend `app-settings` module** (`server/pro-act-backend/src/app-settings/`)
- Entity `app-settings.entity.ts`: table `app_settings`.
  - `key varchar(255)` is the **primary key**, `value text` holds JSON as a string, `tenant_id uuid null`, `user_id uuid null`, index `IDX_app_settings_tenant_user`.
  - The scope columns come from migration `src/database/migrations/1793312000000-AppSettingsScopeAndRefreshTokens.ts`.
- Access policy `app-settings-access.policy.ts`:
  - `ownerForKey` (lines 16-20) **recognises only per-user keys** `tabVisibility.<tenantUuid>.<userUuid>`. **Every other key becomes application-wide** (tenant null, user null).
  - `canWriteSetting`: application-wide keys are SuperAdmin-only. Tenant rows can be written by SuperAdmin, or by TenantAdmin / `manager_approver` acting in that tenant. Per-user rows by their own user.
  - `canReadSetting`: application-wide rows are readable by anyone signed in; tenant rows by members; user rows by the owner.
  - **No key pattern creates a tenant-owned row**, so tenant settings cannot be created through the API today.
- Controller `app-settings.controller.ts`: `GET /api/app-settings`, `GET/PUT/DELETE /:key`, `POST /` (CreateAppSettingsDto `{key, value: any}`), `POST /:key/value` (`@ReadOnlyAllowed`, body `{value: unknown}`, **no DTO and no per-key validation**), `GET /:key/value`.
- Service `app-settings.service.ts`: stores values with JSON serialize/parse. `publish()` (lines 141-147) broadcasts `appSettings` Created/Updated/Deleted to the tenant room **only for tenant rows**. No frontend code subscribes.
- Keys in use: `branding` (application-wide, `services/BrandingService.ts:47, 59, 91`) and `tabVisibility.<tenant>.<user>` (`services/TabVisibilityService.ts:37, 46, 64`). Nothing else.

**Tenant entity** (`server/pro-act-backend/src/tenant/tenant.entity.ts:35-36`): `timezone varchar(100) null`. It is settable through `tenant/dto/create-tenant.dto.ts:53` and `update-tenant.dto.ts:53`. There is **no locale, calendar or date-format field**.

**Sites** (`calendar/entities/site.entity.ts:23-27`): `timezone` plus `timezone_fallback`. These are the primary source of the display zone (D03). `calendar-version.entity.ts:72` also holds `timezone`. Decision D03 (`plans/DECISIONS.md:80, 249`) sets Asia/Tehran, operational day starting 06:00. There is no existing mention of Jalali, Persian or Shamsi anywhere in plans/docs/src.

**Scope resolution:** `common/context/request-context.ts`. `RequestContext {userId, tenantId (token tenant or validated X-Tenant-Id header), organizationId, roles, scopes[], isSuperAdmin}` is resolved by `JwtStrategy.validate` and injected with `@Ctx()`. Feature flags are per tenant (`feature-flags/feature-flag.entity.ts`, `TenantScopedEntity`, unique `(tenantId, key)`).

**Frontend reads**
- `services/api/appSettingsApi.ts`: `AppSettingDto.value: any` (an `any` violation). `getValue` swallows every error into a default.
- `BrandingService` is a singleton with an in-memory cache and no TanStack Query.
- `TabVisibilityService` is per user.
- `contexts/AuthContext.tsx:215-227` loads `session.tenant` via `masterDataApi.getTenant(user.tenantId)`. The `Tenant` type includes `timezone?` (`services/api/masterDataApi.ts:24`).
- `usePlantTimezone` reads `session.tenant.timezone` with a cast.

**`/settings` page:** `src/App.tsx:48-53` `SettingsPlaceholder` ("System configuration coming soon"), routed at `App.tsx:78`. The nav item is at `navigation-items.ts:89` (`canAdministerTenant`).

**AdminPanel tabs** (`src/pages/AdminPanel.tsx`, 725 lines, already over the size limit; don't grow it):
- hierarchy (350), users (351), attributes (352), dashboard (353)
- branding (354, SuperAdmin only, renders `components/BrandingSettings.tsx`)
- automation (355, `canEditRules`)

#### 2.6 What a "calendar system: gregorian | jalali" admin toggle needs

**1) Where to store it.** Recommended: a tenant-owned setting.
- **Option A (recommended): a tenant column.**
  - Add `tenants.calendar_system varchar(16) not null default 'gregorian'` with a CHECK `IN ('gregorian','jalali')`, as a new migration with `down`. Optionally add `week_start smallint` too, since Iran starts the week on Saturday.
  - Add to `UpdateTenantDto` with `@IsOptional() @IsIn(['gregorian','jalali'])`.
  - The frontend gets it for free on `session.tenant` (already fetched in `AuthContext.tsx:218`), alongside `timezone`. It is typed and validated at the boundary.
  - This changes a public contract (Tenant DTO and response): flag it and refresh the OpenAPI snapshot (`npm run openapi:v2:update` if the tenant route is part of v2; otherwise just swagger).
  - Record the decision in `plans/DECISIONS.md`.
- **Option B: an app-settings key** with no new column.
  - Extend `ownerForKey` with an allow-listed tenant key regex such as `^tenant\.(<uuid>)\.display$`, returning `{tenantId, userId: null}`. Then TenantAdmin / `manager_approver` can write it and members can read it.
  - Add server-side validation of known keys. `POST /:key/value` currently accepts any `unknown`, so add a per-key schema map in the service.
  - Invalidate the frontend query on the existing `appSettings` socket broadcast.
  - Weaker: untyped JSON and validation outside DTOs.
- **Option C: application-wide key** (`display.calendarSystem`, SuperAdmin only). No backend change at all, but one setting for the whole installation. Acceptable only if every tenant is Iranian.
- Optional later: a per-user override key `userPrefs.<tenant>.<user>`. This needs the same `ownerForKey` regex extension.

**2) How the frontend reads it**
- Add a `useDisplaySettings()` hook in `src/features/ux-kit/use-display-settings.ts`. It reads the **selected** tenant (`plantSelection?.tenant?.id || session?.tenant?.id`, per CLAUDE.md) through TanStack Query (`['tenant', tenantId]`, staleTime around 5 min). It returns `{ calendar: 'gregorian' | 'jalali', timezone }`, and combines with `usePlantTimezone()` so components get one `{tz, calendar}` object.
- Fix `usePlantTimezone` at the same time: it currently uses `session.tenant`, not the selected tenant.
- Admin UI: the `/settings` route is a placeholder (`App.tsx:48-53, 78`; nav `canAdministerTenant`). Replace it with a lazy `features/settings/settings-page.tsx` holding a "Date display" card (calendar radio group, live preview through the formatter). The alternative, a new AdminPanel tab, would grow an already oversized file, so it is not recommended.
- The page must not write on render, and should send `X-Client-Audited` only if it logs the action itself.

**3) Single formatter module.** No new dependency is needed for display: `Intl` supports `calendar: 'persian'`. This was verified in Node 24:
- `new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {timeZone:'Asia/Tehran', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'})` formats `2026-10-12T06:30Z` as `07/20/1405 AP, 10:00`.
- `formatToParts` returns `month/day/year/era/hour/minute`; drop the `era` part.
- `{month:'long'}` gives `Mehr 1405 AP`. `fa-IR` gives Persian digits (`۲۰ مهر ۱۴۰۵`). Keep `nu-latn` and an `en` locale, since RTL is not required.
- All evergreen browsers support it (ICU).

Proposed `src/features/ux-kit/format/calendar-date.ts`. Keep `plant-time.ts` unchanged for logic.
```ts
export type CalendarSystem = 'gregorian' | 'jalali';
export interface DisplayZone { tz: string; calendar: CalendarSystem }
export interface CalendarDateParts { year: number; month: number; day: number; hour: number; minute: number; offset: string }

/** Instant → parts on the plant clock in the chosen calendar (Intl `ca-persian` for jalali). */
export function calendarParts(iso: string, zone: DisplayZone): CalendarDateParts | null;
/** 'date' → 1405-07-20 | 2026-10-12; 'datetime' → + 10:00 (+03:30 Asia/Tehran); 'time'; 'month' → Mehr 1405 */
export function formatInstant(iso: string | null | undefined, zone: DisplayZone, style?: 'date' | 'datetime' | 'time' | 'month'): string;
/** Operational / date-only `YYYY-MM-DD` (no zone shift: formatted with timeZone 'UTC' at noon). */
export function formatOperationalDate(date: string | null | undefined, calendar: CalendarSystem): string;
export function formatInstantRange(fromIso: string, toIso: string, zone: DisplayZone): string;
/** Server bucket keys ('2026-10-09', '2026-10', '2026-W41') → label in the chosen calendar. */
export function formatBucketKey(key: string, granularity: 'day' | 'week' | 'month', calendar: CalendarSystem): string;
/** Jalali y/m/d ↔ ISO Gregorian 'YYYY-MM-DD' (for inputs; pure arithmetic, see §4). */
export function jalaliToIsoDate(jy: number, jm: number, jd: number): string | null;
export function isoDateToJalali(iso: string): { jy: number; jm: number; jd: number } | null;
```
- Cache `Intl.DateTimeFormat` instances in a `Map` keyed by `${calendar}|${tz}|${style}`; the constructor is expensive and this runs in tables and virtual lists.
- Then:
  - Make `<PlantTime>` take an optional `calendar` (or read the hook) and delegate to `formatInstant`. The 70 v2 consumer files in §2.4-F switch over with no further edits.
  - Wrap the raw strings in §2.4-G with `formatOperationalDate` / `formatBucketKey`.
  - Make `scope-header` and `reports-header` display through the same module.
  - Migrate the ~105 v1 `toLocale*` sites (§2.4-A) and `utils/dateFormatters.ts` to the module, or leave them as v1-only debt. They are browser-zone today, which already conflicts with D03.

**4) Date input handling for Jalali**
- Native `<input type="date">` and `datetime-local` are always Gregorian in their UI. Their value is ISO, and the browser locale controls the picker.
- Intl can convert Gregorian→Jalali, but **cannot parse** Jalali→Gregorian. Options:
  - **(a) Pure arithmetic converter, no dependency.** Port the public-domain jalaali algorithm (`jalCal` / `j2d` / `d2g`, about 80 lines), or invert with Intl by estimating `gy = jy + 621` and correcting the day difference using `calendarParts` (2-3 iterations). Put it in `format/calendar-date.ts` with fixture tests on Nowruz boundaries and leap years 1399, 1403 and 1408.
  - **(b) A `CalendarDateInput` component** in `features/ux-kit/` with the same props as the current inputs (`value: 'YYYY-MM-DD'`, `onChange(iso)`). For gregorian it renders the native input. For jalali it renders a masked text field `1405/07/20` (or three selects y/m/d with month names from Intl) and emits ISO. Add a `CalendarDateTimeInput` that wraps it with an `HH:mm` field and keeps feeding `plantLocalToUtc`. The model files (`event-form.ts`, `fx-form.ts`, `policy-form.ts`, `calendar-draft.ts`, `plan-form.ts`, `profile-form.ts`) and every API payload stay ISO/Gregorian unchanged.
  - **(c) A picker popover.** `react-day-picker` 8.10.1 has no Persian support. v9 ships `react-day-picker/persian`, but it pulls in `date-fns-jalali` and means upgrading the generated `components/ui/calendar.tsx`. That is a new dependency or a major upgrade, which requires asking first. (a)+(b) avoid any dependency.
  - **Interim:** keep the native inputs and show a read-only Jalali echo next to them (`= 1405/07/20`).
- Inputs to cover first (v2): reports-filters:54/58, calendar-editor:65/68, calendar-preview-panel:52/55, crew-rotation-editor:80/83, holidays-editor:33, rca action-form:37-43, case-editor:51, replay-wizard:39/42, signal-actions:34/37, plus the plant-zone datetime-local list in §2.4-E.

**5) Product and semantic points to decide** (record in `plans/DECISIONS.md`)
- Display only versus bucketing. Server month and week buckets are Gregorian (and Monday-ISO weeks: `schema.d.ts:4035`, `LossTrendChart.tsx:49-51`). Relabelling a Gregorian month bucket in Jalali would be wrong, because Mehr starts on 23 September. Either keep buckets Gregorian and label them as ranges, or add a server-side `calendar` parameter to trend and period grouping (the backend has luxon, but luxon has no Persian calendar math either, so the same arithmetic converter would be needed server side).
- Week start: Saturday for Jalali tenants affects weekday arrays (§2.4-C) and calendar `daysOfWeek` labels.
- Exports stay ISO/UTC (`export-report.ts:157`). Optionally add a Jalali display column.
- Persian digits and RTL are out of scope: use `nu-latn` with an `en` locale.

**Files a full implementation would touch (plan first: more than 3 files)**
- Backend: `tenant/tenant.entity.ts`, `tenant/dto/update-tenant.dto.ts` (+ create), a new migration in `src/database/migrations`, a tenant service test, the OpenAPI snapshot. Option B instead touches `app-settings-access.policy.ts` + `app-settings.service.ts` + policy spec.
- Frontend: new `features/ux-kit/format/calendar-date.ts` (+ fixtures test), `features/ux-kit/use-display-settings.ts`, `features/ux-kit/plant-time.tsx` (delegate), new `features/ux-kit/calendar-date-input.tsx`, new `features/settings/settings-page.tsx` + `App.tsx:48-53, 78` route swap, `services/api/masterDataApi.ts` Tenant type, the §2.4-G call sites, then the v2 inputs in §2.4-E.
