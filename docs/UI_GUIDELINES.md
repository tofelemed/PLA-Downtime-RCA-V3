# Pro-Act UI guidelines

**Status:** binding for every screen. **Date:** 2026-10-12. **Source:** `docs/UI_UX_AUDIT.md` §11 (shared foundations F1–F7).

This is how to build a screen with the shared foundations. The per-area tracks (T1–T8, L) follow it. If a rule doesn't fit your screen, ask before you deviate, and record the decision in `plans/DECISIONS.md`.

---

## 1. Where things live

| Need | Import from | Files |
|---|---|---|
| Icons | `@/lib/icons` | `src/lib/icons.ts` |
| Dates, times, durations, Jalali | `@/lib/dates` | `src/lib/dates/*` |
| Date inputs | `@/features/ux-kit/date-inputs` | `DateInput`, `DateTimeInput`, `DateRangeInput` |
| Tables and paging | `@/features/ux-kit/data-table` | `DataTable`, `ListPager`, `useClientPager` |
| Server-paged v2 lists | `@/api/v2/queries/use-paged-query` | `usePagedQuery` |
| Page layout | `@/features/ux-kit/page-layout` | `Page`, `PageHeader`, `Section` |
| Confirmations | `@/features/ux-kit/confirm-dialog` | `ConfirmDialog` |
| Icon-only buttons | `@/features/ux-kit/icon-button` | `IconButton` |
| Search boxes | `@/features/ux-kit/debounced-search-input` | `DebouncedSearchInput`, plus `useDebouncedValue` |
| Human labels for tokens | `@/features/ux-kit/labels` | `roleLabel`, `labelOf`, `humanize`, `policyLabel`, the `*_LABELS` maps |
| Names for ids | `@/features/ux-kit/labels` | `useUnitNames`, `useAssetNames`, `useProductNames`, `useUserNames` |
| Errors | `@/features/ux-kit/errors` | `describeError`, `FriendlyErrorAlert`, `SupportReference`, `friendlyToastContent` |
| Loading / empty / error states | `@/features/ux-kit/data-state` | `DataState`, `dataStateOf` |
| Routes | `src/app/routes/<area>.tsx` | one file per area (see §10) |

Never edit `src/components/ui/*`; it is generated. Wrap it instead.

---

## 2. Page anatomy and density (decongestion)

```tsx
<Page>
  <PageHeader title="Downtime analysis" description="…" actions={<Button>Export</Button>} meta={<ScopeHeader … />} />
  <Section title="Summary">…</Section>
  <Section title="By reason" collapsible defaultOpen={false}>…</Section>
</Page>
```

- **One `<h1>` per page**, rendered by `PageHeader`. It also sets the tab title to `"<title> · Pro-Act"`. The app header's name is not a heading. `Section` renders `<h2>`, or `<h3>` with `headingLevel={3}`.
- **Spacing:** sections are 24 px apart (`Page` = `space-y-6`), with 12 px from a section's header to its content. Don't add your own outer margins, gradients, shadows or `scale-*` hover effects. Cards are for grouped figures, not for every block.
- **Say it once.** A page-wide condition is shown once, in the page header or scope area: the "Incomplete data" banner, provenance, policy versions, the timezone. It is not repeated per card. Cards carry a small chip at most (e.g. "Provisional").
- **Secondary detail** goes behind a disclosure: `Section collapsible`, or "Details" for run ids, policy versions and coverage.
- **Tabs:** at most 5 visible. Keep the active tab in the URL (`?tab=`). With more than 5, use a `Select` or split into sub-pages.
- **Layering:** use the Tailwind z-index scale: `z-sidebar` (20), `z-header` (30), `z-overlay` (50), `z-toast` (100). No `z-[…]` literals. No hand-rolled `fixed inset-0` modals: use `ui/dialog` / `ui/alert-dialog`, which handle focus trap, Escape and scroll lock.
- **Scrolling:** the document scrolls; `<main>` is not a scroll box. Never nest a fixed-height scroll box inside a page unless it is a virtualized list.

---

## 3. Dialog, drawer or sub-page

| Use | When |
|---|---|
| `ConfirmDialog` | Approve, retire, delete, cancel a draft, reject with a reason. **Every destructive or irreversible action.** |
| Dialog (`ui/dialog`) | A short, interruptive task: about 5 fields or fewer, no tabs, no tables, no own scroll. A picker. |
| **Sub-page (route)** | More than ~5 fields, a wizard, tabs, tables, a full record, or anything a user wants to link to, bookmark or leave with Back. |

- Sub-pages go in your area's route file, e.g. `/events/:eventId`, `/planning/profiles/:profileId`. A detail page has a `PageHeader back={{ to, label }}`.
- Never stack more than **2** overlay levels. A dialog never opens a drawer.
- Dialog content has a max height and scrolls inside, so the title and the buttons never leave the screen.

`ConfirmDialog` keeps the dialog open while `onConfirm`'s promise is pending and when it rejects (you show the error), and closes when it resolves. Destructive dialogs focus **Cancel** first.

```tsx
<ConfirmDialog
  trigger={<Button variant="destructive">Retire</Button>}
  title="Retire this profile?"
  description="Plans that use it keep their figures; new plans cannot pick it."
  confirmLabel="Retire profile"
  destructive
  onConfirm={() => retire.mutateAsync(input)}
/>
```

---

## 4. Tables and pagination

**Rule: a long table shows at most 20 rows on its first page.** The page-size choices are 20, 50 and 100, and 20 is the default. "Long" means any list that can grow with data; a fixed list of up to about 10 rows can use `pager="none"`.

### Client-side rows (aggregates, previews, v1 arrays)

```tsx
<DataTable caption="Overdue periods" columns={columns} rows={rows} getRowKey={(r) => r.id} />   // pager="client" by default
```

### Server-paged v2 lists (keyset)

```tsx
const events = usePagedQuery<ProductionEventView>({
  resource: 'production-events', path: '/production-events',
  query: filters, key: { scope: { unitIds }, window: { from, to }, filters: rest },
});
<DataTable caption="Production events" columns={columns} rows={events.rows} getRowKey={(e) => e.id}
  pager={events.pager} status={events.status} onRowClick={(e) => navigate(`/events/${e.id}`)} rowLabel={(e) => …} />
```

- `pages` mode (the default) has First / Previous / "Page N" / Next. The total is shown only once the last page is known, because v2 lists carry no total count. `mode: 'append'` shows "Show more" instead; use it only for feeds.
- The page index resets to page 1 whenever the filters, window or page size change.
- **Lookup lists** (units, codes, products used to fill selects) are not displayed tables. Keep them unpaged, but never cut them off silently: follow `nextCursor` or show that there are more.
- Trees (e.g. the code library) start collapsed and are searchable. Never render a whole tenant's tree expanded.
- **Virtualize** only very long client lists that must stay on one scroll (`pager="none" virtualize={{ rowHeight, height }}`). It renders an ARIA grid (`role="table"`).
- Sticky header is the default. A row can be opened with `onRowClick`; it then becomes focusable and works with Enter / Space. Give it a `rowLabel`.
- States come from `status`: loading → skeleton rows, error → `DataState` (friendly message), refreshing → a thin bar with the rows kept. `empty` sets the empty text and an action.
- Columns of dates or numbers use `nowrap`; numbers align right.

---

## 5. Never show internal values

Users never see UUIDs or id slices, error codes, enum or status tokens (`complete_inputs`, `manager_approver`), policy keys (`oee_policy@1`), run ids, hashes, cursors or correlation ids.

| Instead of | Use |
|---|---|
| a role token | `roleLabel(role)` → "Plant administrator" |
| an enum / state token | the map in `@/features/ux-kit/labels` (`labelOf(MAP, value)`); for a one-off, `humanize(token)` |
| `oee_policy@3,loss_policy@2` | `policyVersionsLabel(…)` → "OEE policy v3 · Loss policy v2", inside a "Details" disclosure |
| a unit / asset / product / user id | `useUnitNames().nameOf(id)` etc. → the name, or "Unknown unit" |
| "Refused (CODE)", "Reference: <uuid>" | `<FriendlyErrorAlert error={e} />` or `describeError(e)`; the code and reference sit behind "Copy support reference" |
| feature-flag keys in copy | `featureOffMessage(flag)` |
| raw ISO timestamps | the date formatters (§7) |
| decision / plan codes in copy ("(D13)", "plan 1.7", "(v2)") | plain language |

- `labelOf` never returns the raw token: an unknown value is humanized, and null becomes "—". A track that needs a new map adds it under its own `model/` and later registers it in `labels/`.
- `DataTable` calls `assertNoRawId` on every plain string or number cell. In development the console then warns `[no-raw-id] <table> › <column> renders an internal id`. Treat that warning as a bug.
- Toasts: `toast({ ...friendlyToastContent(error), variant: 'destructive' })`. Never `toast({ description: error.message })`.
- Ids that are domain data for integration admins (a PI WebId, a topic) may be shown, truncated, with a copy button.
- **Known gap:** names of users who are inactive, or who act from another plant, resolve to "Unknown user" until a user-directory API exists (backend item B2).

---

## 6. Icons

Import from `@/lib/icons`, never from `lucide-react`; lint warns on direct imports. There is one icon per meaning:

- `ActionIcon`: add, edit, delete, remove/close, save, cancel, refresh, reset, export, import, print, filter, search, view/show/hide, open (other context), openDetail (row), copy, duplicate, settings, submit, approve, reject, more, start/pause/stop, testConnection, voteUp/voteDown, signOut, help.
- `StatusIcon`: success, warning, error, info, pending, loading, locked, empty, offline, live, selected, time.
- `EntityIcon`: organization, plant, unit, asset, product, event, stop, downtime, plan, planning, calendar, rcaCase, knowledge, task, user, team, admin, permission, audit, connection, integration, signal, historian, dataSource, code, masterData, library, rule, finance, cost, fxRate, dashboard, report, lossAnalysis, maintenance, settings, administration.
- `UiIcon`: chevrons, the sidebar toggle, pager arrows.

Rules:
- Use the entity's icon wherever that entity is listed or headed. The menu uses the same icons.
- An icon-only control is an `IconButton`, and its `label` is required. The label is both the accessible name and the tooltip.
- A status icon always comes with text (WCAG 1.4.1). Severity and priority are a coloured badge with a word.
- No emojis in the UI. If a meaning is missing, add it to the registry (one meaning, one icon) and document it there.

---

## 7. Dates, times and the calendar setting

All display goes through `@/lib/dates`, in the **plant timezone**. Never use the browser zone, `toLocale*`, or a raw ISO string.

| Function | Gregorian | Persian (Jalali) |
|---|---|---|
| `formatDate(iso, { timeZone, ...pref })` | `2026-10-12` | `1405/07/20` |
| `formatTime(iso, opts)` | `06:30` | `06:30` |
| `formatDateTime(iso, { ...opts, withZone })` | `2026-10-12 06:30 (+03:30 Asia/Tehran)` | `1405/07/20 06:30 (…)` |
| `formatRange(from, to, opts)` | `2026-10-12 06:00–14:00` | same in Jalali |
| `formatOperationalDate('2026-10-12', pref)` | date-only values, no zone shift | |
| `formatMonth(iso, opts)` | `Oct 2026` | `Mehr 1405` |
| `formatDuration(seconds, { style })` | `1 h 30 min` / `90 min` / `1:30` | |

- **The preference:** `const pref = useCalendarPreference()` gives `{ calendar: 'gregorian' | 'persian', digits: 'latin' | 'persian' }`. It is the tenant setting of the selected plant, edited on **Settings → Plant settings** by a TenantAdmin, a manager approver or a SuperAdmin. `<PlantTime>` already applies it. The timezone comes from `usePlantTimezone()`.
- **Inputs:** use `DateInput` (emits `'YYYY-MM-DD'`), `DateTimeInput` (emits an ISO UTC instant) and `DateRangeInput` (emits a half-open UTC `{from, to}`). In the Persian calendar they accept `1405/07/20`, with Latin or Persian digits. Models and API payloads stay ISO/Gregorian. Replace native `type="date"` / `datetime-local` inputs with these.
- `plantTimeParts` (ux-kit) stays Gregorian because it is used for logic. Never format with it.
- **Server buckets stay Gregorian.** Label a month bucket as a date range, not as a Jalali month name.
- **Exports stay ISO / UTC.**
- `jalaliToIsoDate`, `isoDateToJalali`, `gregorianToJalali` and `jalaliToGregorian` are exact for 1300–1500 AP and match `Intl`.

---

## 8. Data fetching (TanStack Query)

- All fetching uses TanStack Query through the hooks in `src/api/v2/queries/*`. For a v1 list, add a shared `useQuery` with a key like `['v1', tenantId, 'units']`. Never write `useEffect` + `useState` fetches, and never fetch on render to write.
- **Defaults:** `gcTime` is 10 min. Stale time is per data class (`stale-times.ts`): reference data 5 min, events and periods 30 s, reports until invalidated. A 4xx is never retried; a 5xx or network failure is retried twice. Reports do not refetch on window focus.
- **Keep the previous data.** Lists (`useV2InfiniteList`, `usePagedQuery`) and reports (`useReport`, `useLossValue`, `useWaterfall`, period view toggles) keep the previous result of the same tenant (and the same record, for detail reads) while a new filter loads. Show the refreshing state (`isPlaceholderData`, or `isFetching && !isLoading`) as a thin bar, not a skeleton.
- **Stable keys:** compute preset windows with `rollingWindow(7 * DAY_MS)` from `src/api/v2/queries/time-window.ts`, never `new Date().toISOString()` per render. The factories already round window bounds to the minute and leave the display timezone out of keys.
- **Debounce** anything that drives a request: text search with `DebouncedSearchInput` (300 ms); multi-selects should commit on close or be debounced with `useDebouncedValue`; date inputs are debounced too. In-memory filters over loaded arrays use `useDeferredValue`.
- **Realtime:** socket notices are coalesced for 500 ms and invalidate by resource prefix (`use-scoped-realtime.ts`). Don't add your own socket listeners for cache refresh.
- **Polling** only while something is running, with a stop condition: `refetchInterval: (query) => terminal ? false : ms`. Never poll while the tab is hidden; that is the default.
- **Prefetch:** menu links preload their route chunk on hover or focus. Add `queryClient.prefetchQuery` on row hover for detail pages, and seed details from the list cache with `placeholderData`.
- **Tenant:** queries take the acting tenant from `useV2TenantId()` (`plantSelection?.tenant?.id || session?.tenant?.id`). The whole cache is cleared on a plant switch.

---

## 9. HCI checklist (before you merge)

- [ ] Page has one `PageHeader` (h1 + tab title); sections use `Section`.
- [ ] Every long table ≤ 20 rows on page 1; pager present; empty, loading and error states shown.
- [ ] No UUIDs, codes, tokens, policy keys or correlation ids visible (no dev-console `[no-raw-id]` warnings).
- [ ] Errors use `describeError` / `FriendlyErrorAlert`; toasts use `friendlyToastContent`.
- [ ] Destructive actions use `ConfirmDialog`; nothing irreversible happens on one click; no native `confirm()` / `alert()`.
- [ ] Forms with more than ~5 fields, tabs or tables are sub-pages; overlays stack at most 2 levels deep.
- [ ] Every icon-only control is an `IconButton` with a label; every input has a label; status is never colour-only.
- [ ] Keyboard: everything clickable is a button or link; Tab order is sensible; Escape closes overlays; focus is visible.
- [ ] Filters, tabs and the selected record are in the URL, so Back works and the page can be linked.
- [ ] Icons come from `@/lib/icons`; no emojis.
- [ ] Dates and durations go through `@/lib/dates` and date inputs through `date-inputs`; nothing uses the browser zone.
- [ ] Data comes from TanStack Query with stable keys; requests are debounced; polling stops.
- [ ] Disabled controls say why (tooltip or hint); read-only users see no write control.
- [ ] Copy is plain language: no decision codes, no "(v2)", no internal names.
- [ ] Text holds at 1280 px with the sidebar expanded: no squeezed tabs, and no date columns wrapping mid-value.

---

## 10. Routes, menu and shell

- **Routes:** each area has its own file in `src/app/routes/`: `overview.tsx`, `production.tsx`, `reliability.tsx`, `integration.tsx`, `administration.tsx` and `dev.tsx`. Add sub-page routes only to your area's file. Define the page with `lazyNamedWithPreload(() => import(…), 'Name')` and give the route its `preload`. `App.tsx` does not change.
- **Menu:** the items are in `src/features/auth/navigation-items.ts`. Each item has a `section`, a capability, an optional flag and an optional `activeAlso` prefix list. The active item matches its path or a sub-path (`/events/123` lights up Event Hub). A sub-page outside the item's path needs an `activeAlso` entry; that is a change to this shared file, so coordinate it.
- **Shell:** `src/components/Layout.tsx` and `src/features/shell/*` hold the sticky header and the sidebar.
  - The sidebar has collapsible sections; the collapsed rail is the default, with an accessible name on every link. The state is saved per user.
  - The header holds the plant selector, display currency, the live-update indicator and the user, with sign-out as the last button.
  - There are no dead controls. Search, notifications and similar controls come back only when they work.
- Keep the e2e contract: the sidebar toggle is named exactly "Expand sidebar" / "Collapse sidebar", and the menu links are `aside nav a[href]`.
