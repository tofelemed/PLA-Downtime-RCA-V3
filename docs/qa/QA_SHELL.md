# QA audit: app shell, navigation, Dashboard, approvals, admin (agent SHELL)

Run: 19 Oct 2026, 12:10–12:35 Tehran (08:40–09:05Z), plant Marun › HDPE plant (HDPE-TRAIN).
Method: headless Playwright (repo `playwright` + `@axe-core/playwright`), one browser per run, UI login for every persona.
Viewports: 1440×900, plus a pass at 768×1024 (omid, reza).
Evidence: screenshots and JSON captures in the session scratchpad
`C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\shell\` (`shots\*.png`, `persona-<user>.json`, `admin.json`, `shell2.json`, `shell3-*.json`, `shell4.json`). Paths below are relative to that folder.

## Summary

| Result | Count |
|---|---|
| Checks run (page × role × check) | ~420 |
| Table rows PASS | 24 |
| Table rows FAIL | 4 |
| Table rows WARN | 20 |
| Critical | 0 |
| High | 1 |
| Medium | 9 |
| Low | 15 |

Overall the results are clean:
- No console errors on any product page.
- No failed requests on product pages (status 400 or higher), apart from the deliberate invalid deep links.
- axe found 0 serious or critical violations on the 25+ pages it scanned.
- No "demo" text, no raw UUIDs and no snake_case words on screen.
- No horizontal scroll at 768 px.
- Menu items match `capabilitiesOf()` for all 14 accounts.
- Integration appears only for SuperAdmin.
- Route gates refuse every typed URL that the menu hides.

The main findings are role presentation (legacy "Analyst"/"Engineer" labels and an implicit `production_engineer` grant), the "For you" approvals tile, an inconsistent Reports provisional/approved message, and wording and capitalisation drift between menu labels and page titles.

The only failed requests seen were:
- `net::ERR_ABORTED` on `/api/v2/organizations`, `/api/v2/tenants` and `/api/v2/branding`. These requests are cancelled on full-page navigation, which is harmless.
- 400/404 responses from deliberately invalid deep links.

### Top findings

1. **High: Every "Analyst"/"Engineer" persona also holds `production_engineer`.**
   - **What happens:** the legacy role map (DECISIONS D06) gives this role to Kamran (finance approver), Neda, Arman, Darya, Bahram, Sara and Mina. Their dashboard shows "Stops to code" / "Current stops", and My work › Periods lists "Prepare and submit" for the three 18 Oct periods.
   - **Why it matters:** they also get stop-verification rights (`STOP_VERIFIERS`). That is a separation-of-duties smell: a finance approver can prepare periods and verify stop coding.
   - **Evidence:** `user_scopes` query (below); `x-user-kamran.png` shows "Production engineer · Comes from the user's role".
2. **Medium: The header badge and Users list show the legacy role instead of the plant roles.**
   - Kamran reads "Analyst", although his plant roles are Finance approver + Production engineer.
   - The same applies to Sara, Neda, Arman, Darya and Bahram ("Analyst") and to Mina ("Engineer").
3. **Medium: The Permissions tab's "Module permissions" list is wrong for these users.**
   - For Sara it lists Connectivity, Audit and Settings, yet she has no Integration menu, no Audit Logs and no Admin Panel.
4. **Medium: The "For you" Pending approvals tile is only for `manager_approver`.**
   - Kamran has 3 restatement postings waiting but no approvals tile.
   - Sara, Neda, Arman and Kamran (the other approver roles) never see the tile.
5. **Medium: Reports shows mixed messages.**
   - The chip says "Approved revisions only" and the selector says "Approved only", yet the page is badged "Provisional".
   - The Loss value note says "approved revision, else the open draft".
   - Coverage reads 43 % in Reports but 86 % on the Dashboard for the same 7-day window.
   - With the default 7-day range, all four exports are disabled. The only hint is the terse "Approved figures only." and a tooltip.
6. **Medium: An invalid approval deep link (`/approvals/nonsense/123`) shows a generic validation error.**
   - The page shows "Some values were not accepted · The server did not say which value", with no h1 and the document title is just "Traverse Forge".
   - Other bad ids show "Not found".
7. **Low: The breadcrumb repeats a level:** "Admin Panel › Admin panel › Edit Marun".
8. **Low: Menu labels and page h1s use different capitalisation and wording.**
   - Admin Panel / Admin panel
   - User Management / User management
   - Audit Logs / Audit log
   - Master Data / Master data
   - Equipment Setup Guide / Equipment setup guide
   - The denied page uses the menu form, so the same URL shows "Admin Panel" when refused and "Admin panel" when allowed.

## Expected vs actual menu (desktop, all 14 accounts)

Common items for all roles except the operator:
- Overview: Dashboard, Pending Approvals, Reports.
- Production: Event Hub, Plans, Profiles & Calendars, My work, Month Close, Measurement Uncertainty.
- Downtime Analysis (5 pages).
- PLA (6 pages + Period accounting).
- Reliability: RCA Analysis, Bad Actors, Knowledge Base, Tasks.
- Administration: Equipment Setup Guide, Master Data, Finance.

| User (plant roles) | Extra Administration items | Integration | Matches capabilities | Result |
|---|---|---|---|---|
| leila (production_engineer) | — | no | yes | PASS |
| omid (operator) | operator menu: Dashboard, Pending Approvals, Event Hub, My work, Downtime, PLA, RCA Analysis, Tasks, Equipment Setup Guide, Master Data (standby writer); no Reports/Plans/Month Close/Finance | no | yes | PASS (see W-OP) |
| sara (production_accountant, production_engineer) | User Management | no | yes | PASS |
| reza (manager_approver) | User Management, Admin Panel, Audit Logs | no | yes | PASS |
| neda (quality_approver, production_engineer) | User Management | no | yes | PASS |
| farid (reliability_engineer, production_engineer) | — | no | yes | PASS |
| mina (integration_admin, production_engineer) | — | **no** (owner rule 18 Oct: Integration is SuperAdmin-only) | yes | PASS |
| arman (metrology_approver, production_engineer) | User Management | no | yes | PASS |
| darya (finance_maintainer, production_engineer) | — | no | yes | PASS |
| kamran (finance_approver, production_engineer) | User Management | no | yes | PASS |
| maryam (manager_approver) | User Management, Admin Panel, Audit Logs | no | yes | PASS |
| bahram (master_data_admin, production_engineer) | — | no | yes | PASS |
| shirin (production_engineer) | — | no | yes | PASS |
| admin (SuperAdmin) | User Management, Admin Panel, Audit Logs | Connectivity, Source Status Rules, Source Priority, Enhanced Historian | yes | PASS |

Route gates on direct URLs (13 URLs × 14 accounts) all agree with the menu. Refused pages show "Your roles in this plant do not include <menu name>." with the page h1. Extra reach by design:
- Sara can open `/connectivity/source-authority` (`canReviewSourcePriority`) even though the menu hides it.
- Reza, Maryam and Admin reach `/admin`, `/users` and `/audit`.

Evidence: `persona-*.json` → `gates`.

## Findings by page

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| Login `/` (form) | anon | h1/title, required, wrong credentials, a11y | PASS | Title "Sign in · Traverse Forge". Empty submit uses native `required`. Wrong credentials show "Sign-in failed. Check your credentials and try again." axe 0. | `shots/s-login.png`, `s-login-wrong.png` | — | — |
| Login | anon | labels | WARN | The field label reads "USER ID", but the field is `type=email` and accounts are e-mail addresses. The h1 is the all-caps brand "TRAVERSE FORGE". | `s-login.png` | Low | `src/components/LoginForm.tsx`: label "E-mail"; keep the brand out of the h1 or use "Sign in" |
| Session expiry | leila | expired token + refresh 401 | PASS | Returns to the login form with "Your session has expired. Please sign in again."; stored session cleared. | `s-session-expired.png` | — | — |
| Logout | leila | sign out, back button | PASS | "Sign out" clears `proact_auth_state` and shows the login form. Browser Back shows the login, not cached pages. | `shell2.json` logout | — | — |
| Deep link through login | reza | `/audit?view=work-summary` before login | PASS | Lands on the same URL after sign-in. | `shell3-a.json` | — | — |
| Header: plant selector | all | label, a11y name | PASS | "Marun › HDPE plant" (aria "Plant: Marun › HDPE plant. Change plant"). The popover lists Marun / HDPE plant / HDPE Extruder 1. | `a-plant-selector.png` | — | — |
| Header at 768 px | omid, reza | truncation | WARN | The organization, plant and brand names truncate to "Ma…", "HDPE p…" and "Traverse F…". The plant scope is unreadable at tablet width. | `r-reza-_admin.png` | Low | `app-header.tsx`: hide the brand name below `md` before truncating the plant label |
| Header: live indicator | all | presence | PASS | "Live" shown (green dot) for all 14. | header text in `persona-*.json` | — | — |
| Header: USD/IRR toggle | admin, reza | toggle, values, persistence | PASS | USD is the default. IRR converts Reports › Loss value 7,650.00 USD → 4,590,000,000 IRR (rate 600,000, matches the E2E report). The choice survives a reload (`aria-pressed`). Restored to USD. | `a-reports-value-irr.png`, `shell3-a.json` | — | — |
| Header: user badge | 13 personas | role label | FAIL | The badge shows the legacy `user.role` ("Analyst" for Kamran, Sara, Neda, Arman, Darya and Bahram; "Engineer" for Mina, Farid and Leila), not the plant roles that decide what the user sees. Kamran, a finance approver, reads "Analyst". | header in `persona-kamran.json`; `s-kamran-approval-detail.png` | Medium | `src/features/shell/user-badge.tsx`: show the primary effective plant role (e.g. "Finance approver"), or "Finance approver +1" |
| Header: notification bell | all 14 | count, All/Unread, read/unread | PASS | The count badge matches unread (omid 1, sara/neda/farid/mina/darya/bahram/shirin 2, kamran 1, leila/arman 0). The Unread filter shows only unread items with the count "Unread (1)". "Mark as unread" → 2 unread → "Mark as read" → back to 1 (restored). Items link to `/events?units=…&coding=uncoded`. Reza, Maryam and Admin: "No notifications." | `s-bell-unread-filter.png`, `shell2.json` bell* | — | — |
| Notification text | 11 users | wording | WARN | "HDPE Extruder 1 · 2026-10-17: 1 stop(s) waiting for a reason". The "(s)" pluralisation is unfinished. Two near-duplicate items (normal + escalated) for the same stop. | `p-omid-bell.png` | Low | `src/features/notifications/work-reminder-text.ts:51`: plural helper ("1 stop" / "2 stops") |
| Notifications for approvers | kamran | work items | WARN | Kamran has 3 restatement postings waiting, but the bell carries only the uncoded-stop reminder (from his implicit production_engineer role) and no approval work item. | `persona-kamran.json` | Low | Consider an approval-waiting reminder |
| Sidebar (desktop) | all | sections, active item, collapse | PASS | Starts as an icon rail (`DEFAULT_NAV_STATE.collapsed = true`). Expanded, the sections are Overview, Production, Downtime Analysis, PLA, Reliability, [Integration], Administration. Long labels have a `title`. | `x-sidebar-expanded.png` | — | — |
| Sidebar labels | all | duplicates | WARN | "Reliability" is both a Downtime Analysis page and a section name directly below it; at a glance the drawer reads "…Trends & Comparisons · Reliability · PRODUCTION LOSS ANALYSIS (PLA)… RELIABILITY". | `r-omid-drawer.png` | Low | Rename the downtime page "Reliability (MTBF/MTTR)" in `analysis-pages.ts` |
| Sidebar: operator | omid | role fit | WARN (W-OP) | The operator gets "Pending Approvals" (always empty; a 26-option workflow filter, no approval role) and "Equipment Setup Guide" (a 6-phase admin setup flow) because standby writers reach master data. | `p-omid-approvals.png`, `persona-omid.json` | Low | Gate Pending Approvals on holding any approval role; gate the Setup Guide on `canManageMasterData` |
| Drawer at 768 px | omid, reza | open, items, close on navigate, h-scroll | PASS | The "Open navigation" button opens `#navigation-drawer` with the same capability-filtered items. Following a link closes the drawer. No horizontal scroll on 12 pages. | `r-omid-drawer.png`, `shell3-c.json` | — | — |
| Breadcrumbs: edit organization / plant | admin | trail | FAIL | "Admin Panel › Admin panel › Edit Marun". The menu crumb and the back target are the same page with different capitalisation, so the de-duplication misses it. | `shots/a-edit-organizations.png` | Low | `src/features/ux-kit/page-layout/route-trail.ts`: compare crumbs case-insensitively / by `to`; or set the back label in `hierarchy-edit-form.tsx` / `hierarchy-form-page.tsx` to the menu name |
| Breadcrumbs: others | admin, kamran | trail | PASS | "Pending Approvals › 2026-10-17 · restatement 2", "Audit log › Created · Exports", "Tasks › New task", "Users › Kamran". | `x-audit-entry.png` | — | — |
| 404 `/no-such-page` | admin, omid | h1, title, link | PASS | Title "Page not found · Traverse Forge", the path echoed, "Go to the dashboard". axe 0. The h1 is the bare "404" (not descriptive). | `a-404-_no_such_page.png` | Low | `src/pages/NotFound.tsx`: h1 "Page not found" with 404 as a visual tag |
| Bad deep links | admin | `/approvals/nonsense/123` | FAIL | Shows "Some values were not accepted / The server did not say which value. Copy the support reference…". No h1 and the title is "Traverse Forge". The API returns 400 `GET /api/v2/approval-inbox/nonsense/123`. | `a-404-_approvals_nonsense_123.png` | Medium | Validate `:kind` against known kinds client-side and render the "Not found" state with the page header (`src/features/approvals/approval-detail*`) |
| Bad deep links | admin | `/tasks/<zero-uuid>`, `/audit/<zero-uuid>`, `/admin/plants/<zero-uuid>/edit` | WARN | "Not found · It may have been deleted or moved. Reload the page." plus Retry. "Reload" / "Retry" does not help with a 404. | `a-404-_tasks_*.png` | Low | Shared not-found state: offer "Back to <list>" instead of Retry |
| Route gate titles | omid vs reza | h1 consistency | WARN | When denied: h1 "Admin Panel", "User Management", "Audit Logs" (menu name). When allowed: "Admin panel", "User management", "Audit log". Also "Master data", "Equipment setup guide" vs menu "Master Data", "Equipment Setup Guide". | `persona-omid.json` gates; `r-omid-_admin.png` | Low | Pick one capitalisation (the glossary uses sentence case) in `navigation-items.ts` names |
| Dashboard `/dashboard` | all 14 | tiles, figures, links, axe | PASS | Last 7 days figures match the restated 17 Oct (621 / 672):<br>• OEE 92.4 %, A 93.8 %, P 99.4 %, Q 99.2 %; reconciled 92.4 %.<br>• Downtime 1 h 30 min, unplanned 1 h 30 min, 2 stops.<br>• Most stopped assets: Main drive and gearbox 1, No asset recorded 1.<br>• Periods: Not calculated 1, Draft 3, Approved 3.<br>• Latest loss events: 2026-10-18 02:00 Not coded 30 min; 2026-10-17 08:00 MECH-GEARBOX · Gearbox failure 1 h.<br>Times in Asia/Tehran with Latin digits. All 13 tile links go to filtered pages (e.g. `/events?assets=…&kinds=downtime&window=7d`). The window choice persists in the URL (`?window=24h`) and across reload. axe 0 (omid, reza). | `p-omid-dashboard.png`, `shell2.json` omidDashLinks, `dash.json` | — | — |
| Dashboard: duplicated headings | all | headings | WARN | Section "Downtime" contains a card "Downtime"; section "Root cause analysis" contains a card "Root cause analysis". The screen reader outline repeats them. | `p-omid-dashboard.png` | Low | Drop the card title when it equals the section title |
| Dashboard: Last 24 h | reza | consistency | WARN | The banner says "67 % of periods calculated", yet every OEE tile says "Not available · No calculated periods / No slices". Each tile shows "—", "Not available", "Not available", "No slices" (three empty-state lines). | `dash.json` | Medium | Use one coverage definition for the banner and the tiles; one empty-state line per tile |
| Dashboard: For you | all | tiles per role | WARN | Tiles by role:<br>• operator / production_engineer: Current stops + Stops to code.<br>• Sara: + Periods due 3.<br>• Farid: + Recommended investigations, My overdue actions 0.<br>• Reza / Maryam: Pending approvals 0.<br>• Admin: no row.<br>**Kamran (3 approvals waiting) gets no Pending approvals tile.** `for-you-model.ts` maps `approvals` to `manager_approver` only. Neda, Arman, Sara and Kamran are approvers too. Because of the implicit `production_engineer`, finance, quality and metrology users get "Stops to code". | `persona-kamran.json` forYou | Medium | `src/features/pla-analytics/dashboard/for-you-model.ts`: show `approvals` for every approval role (finance_approver, quality_approver, metrology_approver, production_accountant, SuperAdmin) |
| Pending Approvals `/approvals` | 13 personas + admin | list, empty state, a11y | PASS | Kamran and Admin: "Restatement posting (3)" — 2026-10-17 restatement 2 / 3 / 4, requested by Reza, unit HDPE Extruder 1, "Review & decide" + "Open workspace". Admin rows add "SuperAdmin can act for every approval role". The other 12 see the empty state "No pending approvals for your roles". axe 0 (kamran). | `p-kamran-approvals.png` | — | — |
| Pending Approvals | all | wording, URL | WARN | State "awaiting posting" and role "finance approver" are lower-case, unlike the badge style elsewhere ("In review", "Draft"). The Workflow filter (`select#approval-kind`) is not kept in the URL, so reloading loses it. | `p-kamran-approvals.png` | Low | `src/features/approvals/*`: sentence-case the state labels; put `kind` in `useSearchParams` |
| Approval detail `/approvals/finance-posting/:id` | kamran | content, deep link, reload, axe; **not decided** | PASS | h1 "2026-10-17 · restatement 2". Diff "2 fields differ from the approved revision 1": Loss line · availability 14.00 t → 0.00 t; Loss line · availability · Reduced extrusion rate 0.00 t → 14.00 t. Separation-of-duties note shown. Reload restores the view. axe 0. | `s-kamran-approval-detail.png` | — | — |
| Approval detail | kamran | form | WARN | "Save posting" is disabled until a posting date is entered, with no visible reason. Treatment options are lower-case sentence fragments ("a correction", "a change in estimate", "another adjustment", "no posting"). Field label "Loss line · availability" shows the raw component key in lower case. | same | Low | Disabled-with-reason hint "Enter a posting date"; Title-case option labels; map component keys to "Availability" |
| My work `/my-queue` | all 14 | tabs, URL, empty states | PASS | Tabs Periods · RCA actions · Tasks (operator: RCA actions · Tasks). Each tab is kept in `?tab=`. Periods: "Due today (3)": Prepare and submit HDPE Extruder 1 · 2026-10-18 · A/B/C, due 2026-10-19 18:00. The empty states read "No open RCA actions." / "No open or in-progress task is assigned to you." axe 0 (sara). | `s3-leila-mywork-*.png` | — | — |
| My work: Periods | kamran, neda, arman, darya, bahram, mina, reza, maryam | role fit | WARN | All of them see "Prepare and submit" for the three 18 Oct periods (implicit production_engineer; managers through their role). For finance, quality and metrology approvers this is noise, and it lets them prepare what they later approve. | `persona-*.json` myWork | High (with finding 1) | See finding 1 |
| Reports `/reports` | admin | 4 tabs, URL, axe | PASS | `?view=` persists. OEE by date 17 Oct 93.8 / 99.4 / 99.2 / 92.4 %. Downtime by reason MECH-GEARBOX 1 h 66.7 %, Not coded 30 min 33.3 %. Reconciliation: Balanced 3, Not computable 4, Overdue 0. Loss value 7,650.00 USD. axe 0 on all tabs. | `a-reports-tab0..3.png` | — | — |
| Reports: approved vs provisional | admin | consistency | WARN | The chip says "Approved revisions only" and the selector "Approved only", yet a "Provisional" badge shows. The Loss value note says "approved revision, else the open draft". Coverage reads 43 % here and 86 % on the Dashboard for the same 7 days. The 18 Oct rows say "no calculated periods" although the 18 Oct periods have actuals runs. | `a-reports-tab0.png`, `a-reports-tab2.png` | Medium | `src/features/pla-analytics/reports/reports-header.tsx`, `reports-page.tsx`: one source for the revision basis and coverage text |
| Reports: Exports | admin, leila | download | WARN → PASS | With the default 7-day window all four buttons are disabled (provisional range). The only hint is "Approved figures only." plus a `title`. With 17 Oct only, CSV and PDF download (`traverse-forge-period_summary-2026-10-17.csv`, 2,456 B, BOM present; `traverse-forge-loss_lines-2026-10-17.pdf`, 5,133 B). The CSV header carries `requested_by,<uuid>` and `timezone,UTC`. | `a-reports-exports-after.png`, `s3-exports-17oct.png`, `dl\` | Medium | `scope-export.tsx`: say "Choose dates whose periods are all approved (17 Oct is)" or offer "approved periods only" export; name the requester instead of the uuid |
| Reports: Loss value | admin | units | WARN | Economic impact table shows quantities as "46.00t", "5.00t" (no space before the unit; brief: "t"). | `a-reports-tab2.png` | Low | Use the shared quantity formatter in `economic-breakdown-card.tsx` |
| Admin panel `/admin` | admin | 5 tabs, URL, axe | PASS | Plants & organizations (Marun MPC-TRAIN; HDPE plant HDPE-TRAIN, Asia/Tehran, Gregorian, week starts Saturday), Custom attributes (empty state), Branding (read only, not saved), Status automation (moved notice), Plant settings (Gregorian, Latin digits, Saturday week). `?tab=` persists; axe 0. | `a-admin-tab0..4.png` | — | — |
| Admin panel | reza, maryam | tabs | WARN | Only the "Plant settings" tab is shown, but the description still says "Plants and organizations, custom attributes, branding and plant settings." Branding text uses "colours" (UK), while the glossary sets US spelling. | `r-reza-_admin.png` | Low | `admin-page.tsx`: build the description from the visible tabs; `branding-section.tsx`: "color" |
| Edit organization / plant | admin | open, labels, required, cancel | PASS | `/admin/organizations/:id/edit` "Edit Marun" and `/admin/plants/:id/edit` "Edit HDPE plant": Code read-only with reason, Name* required, time zone locked with reason. Cancel returns to `/admin?tab=plants`. axe 0. Nothing saved. | `a-edit-organizations.png`, `a-edit-plants.png` | — | — |
| Edit plant | reza | gate | PASS | "No access · Only a super administrator or the organization's administrator can edit this." | `r-reza-_admin_plants_*_edit.png` | — | — |
| User management `/users` | admin | Users / Permissions / Delegations, axe | PASS | 14 members, all Active. `?tab=` persists. Delegations empty state "Nobody acts as a delegate right now." axe 0. Nothing changed. | `a-users-tab0..2.png` | — | — |
| User management: role column | admin | data | WARN | The Role column shows the legacy role ("Analyst" for six people with very different plant roles). The user page shows the real grants (Kamran: Finance approver + Production engineer "Comes from the user's role"). | `a-users-tab0.png`, `x-user-kamran.png` | Medium | `src/features/users/*`: show the plant grants in the list |
| User management: Permissions | admin | data | FAIL | "Module permissions · What the role of Sara reaches by default" lists Dashboard, Events, RCA Analysis, Master Data, Users, **Connectivity, Audit, Settings**. Sara cannot reach Connectivity, Audit Logs or Admin settings (menu and route gates refuse). The panel is driven by the legacy role, not the capabilities. | `x-permissions-sara.png` | Medium | `src/features/permissions/module-permissions-panel.tsx`: derive from `capabilitiesOf(effective roles)` / `NAVIGATION_ITEMS` |
| Audit log `/audit` | admin, reza | entries, search, detail, work summary, axe | PASS | Entries are paginated, and search is kept in the URL (`?q=Exports`). Opening an entry gives `/audit/:id`, and reload keeps it. The Work summary covers investigations (1 created, closed, High), tasks (0) and activity (497+ entries by action and record type). axe 0. | `a-audit-tab0..1.png`, `x-audit-entry.png` | — | — |
| Audit log: summaries | admin | raw text | WARN | Export jobs are summarised as `CREATE Exports "unknown"` (raw verb in upper case, the literal "unknown"). "Audit entries by record type" lists **User** twice (272 and 13). | `x-audit-entry.png`, `a-audit-tab1.png` | Medium | `server/pro-act-backend/src/audit-log/audit-auto-log.interceptor.ts`: record the export id/report type; map both resource keys to distinct labels ("User", "User session"?) |
| Tasks `/tasks`, `/tasks/new` | admin, leila | list, form, validation, cancel | PASS | No tasks exist in the plant (empty state "No task matches the filters."), so the task detail page could not be read with real data. On the new-task form, Create with an empty title shows "Enter a title.", and Cancel returns to `/tasks`. Nothing created. | `a-tasks.png`, `s3-task-new-validation.png` | — | — |
| All pages above at 768 px | omid, reza | h-scroll, drawer | PASS | No horizontal overflow on 14 pages. | `r-*.png` | — | — |

## Evidence: implicit production_engineer grants

The following query was run read-only on Postgres; the results are shown in the table below.

```sql
select u.email, u.role, string_agg(s.role, ', ') from users u left join user_scopes s on s.user_id = u.id
 and s.tenant_id = '433c1a69-7a32-4b32-ab20-c4139423abd2' where u.email like '%hdpe-train.mpc' group by 1, 2;
```

| user | legacy role | plant roles |
|---|---|---|
| arman | Analyst | metrology_approver, production_engineer |
| bahram | Analyst | master_data_admin, production_engineer |
| darya | Analyst | finance_maintainer, production_engineer |
| kamran | Analyst | finance_approver, production_engineer |
| mina | Engineer | integration_admin, production_engineer |
| neda | Analyst | production_engineer, quality_approver |
| sara | Analyst | production_accountant, production_engineer |

This follows DECISIONS 2026-10-07 D06 ("Engineer/Analyst → production engineer"). It is by design, so it is reported as a product question rather than a bug. Options:
- Give the Marun personas a role that maps to nothing extra.
- Make the legacy mapping apply only when the user holds no explicit plant role.

## Use cases verified

- Login: correct credentials, wrong credentials, empty fields.
- Session-expiry message.
- Sign out, and Back after sign out.
- Deep link preserved through login.
- Header:
  - plant selector "Marun › HDPE plant"
  - Live indicator
  - USD/IRR toggle with conversion and persistence
  - notification bell (count, All/Unread filter, mark unread / read, restored), and the item link targets
- Sidebar and menu for all 13 personas and SuperAdmin against `capabilitiesOf()`. Integration is SuperAdmin-only.
- Route gates: 13 typed URLs × 14 accounts.
- Navigation drawer at 768 px (open, list, close on navigate), and no horizontal scroll.
- Breadcrumbs on the detail and edit pages.
- 404 page and invalid deep links.
- Dashboard: all tiles, figures checked against the E2E facts, every tile link, window in the URL, and the For-you row per role.
- Pending Approvals inbox for every persona. Kamran's restatement posting detail opened, compared and reloaded; **nothing was decided**.
- My work: all tabs for every persona.
- Reports: 4 views, IRR view, exports (CSV + PDF downloaded for 17 Oct).
- Admin panel: 5 tabs. Organization and plant Edit pages opened and cancelled. Branding read.
- User management: Users, Permissions (Sara) and Delegations, plus the Kamran user page (read only).
- Audit log: entries, search, entry detail with reload, Work summary.
- Tasks: list, plus the new-task form validation and cancel.

## Data created or changed

- **Export jobs:** 2 jobs created by downloading 17 Oct exports as Leila (period summary CSV, loss lines PDF). These are read-only exports, which the brief allows.
- **Audit log entries:** sign-ins, sign-outs, the export jobs and "access denied" route checks.
- **Notification read state:** Omid's "Uncoded stops waiting" was toggled to unread and back to read, so it is restored (1 unread, as before).
- **Display currency:** the preference was switched to IRR and back to USD for Admin and Reza (per-user display preference; restored).
- **Nothing else:** no approvals, plans, events, periods, users, settings, branding or hierarchy were changed.

## Re-test 19 Oct

Run: 19 Oct 2026, 14:50–15:15 Tehran, after commit dd04dd24 and its deploy. Same method as round 1: headless Playwright, UI login for all 14 accounts, axe, 1440×900 plus 768×1024 (omid, reza, sara).
Evidence: `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\shell\r2\` (`shots\*.png`, `persona-<user>.json`, `admin.json`, `shell2.json`, `shell3-*.json`, `shell4.json`, `dash.json`, `r2probe2.json`, `r2probe3.json`). Paths below are relative to that folder.

**Summary: FIXED 20 / PARTIAL 4 / OPEN 3 / NEW 4**

Still clean across the sweep:
- 0 console errors on product pages.
- 0 failed requests, apart from deliberate bad ids (404) and `ERR_ABORTED` on navigation.
- 0 serious or critical axe violations on ~30 pages.
- No horizontal scroll at 768 px.
- No "demo" text, no raw UUIDs and no snake_case words on screen.

The plant roles are now one guide role per persona, checked read-only in `user_scopes`:

| User | Plant role |
|---|---|
| arman | metrology_approver |
| bahram | master_data_admin |
| darya | finance_maintainer |
| farid | reliability_engineer |
| kamran | finance_approver |
| leila | production_engineer |
| maryam | manager_approver |
| mina | integration_admin |
| neda | quality_approver |
| omid | operator |
| reza | manager_approver |
| sara | production_accountant |
| shirin | production_engineer |
| admin | SuperAdmin |

### Menu, header badge and For you per persona (desktop)

| User | Header badge | Menu (beyond the common set) | For you | Result |
|---|---|---|---|---|
| leila | Production engineer | — | Current stops 0, Stops to code | PASS |
| omid | Operator; no USD/IRR toggle | Operator menu: Dashboard, Pending approvals, Event Hub, My work, Downtime, PLA (no Loss valuation or Period accounting), RCA Analysis, Tasks, Equipment setup guide, Master data | Current stops, Stops to code | PASS (W-OP still open) |
| sara | Production accountant | User management | Periods due 0, Pending approvals 0 | PASS |
| reza | Manager (approver) | User management, Admin panel, Audit log | Pending approvals 0 | PASS |
| neda | Quality / Lab approver | User management | Pending approvals 0 | PASS |
| farid | Reliability engineer | — | Recommended investigations, My overdue actions 0 | PASS |
| mina | Integration administrator | — (Integration is SuperAdmin-only by the owner's rule) | none | PASS |
| arman | Metrology / Instrumentation approver | User management | Pending approvals 0 | PASS |
| darya | Finance (rates) | — | none | PASS |
| kamran | Finance approver | User management | **Pending approvals 3** | PASS |
| maryam | Manager (approver) | User management, Admin panel, Audit log | Pending approvals 0 | PASS |
| bahram | Master data administrator | — | none | PASS |
| shirin | Production engineer | — | Current stops, Stops to code | PASS |
| admin | Super administrator | Integration (4 pages) + User management, Admin panel, Audit log | Pending approvals 3 | PASS |

The common set is:
- Overview: Dashboard, Pending approvals, Reports.
- Production: Event Hub, Plans, profiles & calendars, My work, Month close, Measurement uncertainty.
- Downtime analysis (5 pages).
- PLA (7 pages).
- Reliability: RCA Analysis, Bad actors, Knowledge base, Tasks.
- Administration: Equipment setup guide, Master data, Finance.

Route gates (13 URLs × 14 accounts) agree with the menu, as in round 1. Sara can still open `/connectivity/source-authority` (review rights). Denied pages and allowed pages now use the same h1, for example "Admin panel" in both cases.

### Round-1 findings: status

| # | Round-1 finding | Status | Evidence (round 2) |
|---|---|---|---|
| 1 | High: implicit `production_engineer` for Kamran, Sara, Neda, Arman, Darya, Bahram and Mina | FIXED | `user_scopes` holds one guide role each (table above). My work › Periods: "Nothing waiting for you" for all of them. The For-you rows have no "Stops to code" for non-coders. |
| 2 | Header badge shows the legacy role ("Analyst"/"Engineer") | FIXED | The badge is the plant role for all 14 (table above). `persona-*.json` header. |
| 3 | Users list shows the legacy role | PARTIAL | The Users tab now has a **Plant roles** column (`a-users-tab0.png`). The **Permissions** tab list still has a "Role" column with Analyst/Engineer/Manager (`a-users-tab1.png`). The user page subtitle still reads "Analyst · HDPE plant", next to a required legacy "Role*" select (`x-user-kamran.png`). Its Access table is correct (Finance approver only). |
| 4 | Permissions › Module permissions wrong (Sara: Connectivity, Audit, Settings) | FIXED | "What Sara reaches in this plant" is now built from the menu: Overview … Administration (… User management); "This is the menu of Production accountant". Evidence: `x-permissions-sara.png`. |
| 5 | Pending approvals tile only for `manager_approver` | FIXED | Kamran: "Pending approvals 3". Admin: 3. Sara, Neda, Arman, Reza, Maryam: 0. Evidence: `p-kamran-dashboard.png`. |
| 6 | Reports: provisional vs approved mixed messages; coverage 43 % vs 86 % | PARTIAL | Fixed parts: the page badge now reads "Approved"; the coverage line says "only approved periods are counted (38 % of periods approved)", while the Dashboard says "88 % of periods calculated" (different, now labelled measures); the Exports tab explains "Some periods of these dates are not approved yet…". Still open: with the default 7-day window, the OEE and Reconciliation cards still carry a "Provisional" badge under "Approved revisions only", and the Revisions select still offers "Approved revision, else the open draft (provisional)" on an approved-only page. Evidence: `a-reports-tab0.png`, `a-reports-tab1.png`. See also N1. |
| 7 | `/approvals/nonsense/123` shows a validation error, no h1 | FIXED | h1/title "Approval not found", "This address does not name an approval workflow…", "Back to Pending approvals". Evidence: `a-404-_approvals_nonsense_123.png`. |
| 8 | Breadcrumb "Admin Panel › Admin panel › Edit Marun" | FIXED | "Admin panel › Edit Marun" and "Admin panel › Edit HDPE plant". Cancel returns to `/admin?tab=plants`. Evidence: `a-edit-organizations.png`. |
| 9 | Menu labels vs h1 capitalisation (Admin Panel/Admin panel, …) | FIXED | The menu, h1, title and denied page all match in sentence case: Pending approvals, Month close, Equipment setup guide, Master data, User management, Admin panel, Audit log. |
| 10 | Login: label "USER ID", h1 is the brand | FIXED | Label "Email", h1 "Sign in", title "Sign in · Traverse Forge". Evidence: `r2-login.png`. |
| 11 | Header at 768 px truncates the plant to "HDPE p…" | FIXED | At 768 px only the "TF" mark shows, and "Marun › HDPE plant" is readable. Evidence: `r2-sara-768-header.png`. |
| 12 | Notification text "1 stop(s)" | FIXED | "HDPE Extruder 1 · 2026-10-17: 1 stop waiting for a reason". |
| 13 | Kamran's bell has no approval-waiting item | OPEN | Kamran's bell still holds only the two uncoded-stop reminders, and nothing for his 3 restatement postings (`p-kamran-bell.png`). See also N2. |
| 14 | "Reliability" is both a downtime page and a section | FIXED | The downtime page is now "Reliability (MTBF/MTTR)". Evidence: `shell4.json` expanded. |
| 15 | W-OP: operator sees Pending approvals (always empty) and the Equipment setup guide | OPEN | Omid's menu still has Pending approvals and Equipment setup guide (`/equipment-setup` opens). |
| 16 | 404 h1 is the bare "404" | FIXED | h1 "Page not found"; 404 is a tag. |
| 17 | Not-found state offers "Reload"/"Retry" | FIXED | "Not found · It may have been deleted or moved." with "Back to Tasks", "Back to Audit log" and "Back to Admin panel". The titles are "Task", "Audit entry" and "Edit plant". |
| 18 | Denied vs allowed h1 differ in case | FIXED | `persona-omid.json` gates: "Your roles in this plant do not include Admin panel." |
| 19 | Dashboard duplicated headings (Downtime/Downtime, RCA/RCA) | FIXED | Cards are now "Downtime totals" and "Investigations and actions". |
| 20 | Dashboard Last 24 h: banner "67 % of periods calculated" while every tile says "Not available · No calculated periods / No slices" | OPEN | The behaviour is unchanged. Each tile still shows "—", "Not available" and a reason that alternates between "No slices" and "No calculated periods". Evidence: `dash.json`, `r2-reza-dash-24h.png`. |
| 21 | Pending approvals: lower-case state and role; Workflow filter not in the URL | PARTIAL | The list now shows "Awaiting posting" / "Finance approver", and the filter is kept as `?kind=finance-posting`. On the detail page, the Request section still says State "awaiting posting" and Approval roles "finance approver". Evidence: `s-kamran-approval-detail.png`. |
| 22 | Approval detail form: disabled Save with no reason; lower-case treatment options; raw "Loss line · availability" | PARTIAL | A reason now shows: "Choose the posting date first." The detail also adds a "Loss value (default valuation view) 2,180.00 → 2,250.00 USD" row. Still open: the treatment options are "a correction / a change in estimate / another adjustment / no posting", and the field labels are "Loss line · availability". Nothing was decided. |
| 23 | My work › Periods "Prepare and submit" for approvers | FIXED | Every persona sees "Nothing waiting for you". The 18 Oct periods have no approved plan and are excluded. |
| 24 | Exports disabled with a terse hint; CSV `requested_by` uuid; `timezone,UTC` | FIXED | There is an explicit hint (row 6). The CSV now adds `requested_by_name,Leila` and `plant_timezone,Asia/Tehran`, keeping the id lines for traceability. Evidence: `r2probe3.json`, `dl\traverse-forge-period_summary-2026-10-17.csv`. |
| 25 | Loss value quantities "46.00t" | FIXED | "46.00 t", "5.00 t". |
| 26 | Admin panel description lists hidden tabs for Reza; "colours" | FIXED | Reza sees "Plant settings." (only his tab). Branding says "colors". Evidence: `r2-reza-admin.png`. |
| 27 | Audit: `CREATE Exports "unknown"`; "User" listed twice by record type | FIXED | "Created export · Loss lines PDF / Period summary CSV …". Record types are now "User session 550" and "User 13". Entries older than the fix still read "Created export" with no label. |

### New findings

| # | Page / route | Role | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| N1 | Reports `/reports` (Period dates, Exports) | leila, admin | FAIL | **Choosing one approved day through the From/To fields cannot select the production day.**<br>• The default "Last 7 days" window is "now − 7 d → now", which the page reads as "production days 15:01–15:01".<br>• Typing 17 Oct → 17 Oct keeps that clock time: "2026-10-17 (production day 15:10–15:10)", `from=2026-10-17T11:40Z&to=2026-10-18T11:40Z`. This runs into 18 Oct, so the coverage drops to "33 % approved" and all four exports stay disabled with "Some periods of these dates are not approved yet".<br>• The real production day is 06:00–06:00 (periods start at 02:30Z). With that window typed into the URL, the page is fully approved, the "Provisional" badges disappear, and the CSV downloads.<br>• In round 1, exporting 17 Oct from the date fields worked, so this is a regression.<br>• The URL also carries the label text `window=Last+7+days` / `Chosen+dates`. | `shots/r2-reports-17oct-exports.png` vs `shots/r2-reports-17oct-0600.png`; `r2probe2.json`, `r2probe3.json` | Medium | `src/features/pla-analytics/components/plant-days-input.tsx` reuses `plantDaysOf(value).boundary`. A relative window ending "now" makes the boundary the current minute. Take the boundary from the plant's production-day start (first shift start) instead. Snap relative windows on Reports to whole production days, so they match the "Approved figures" page. |
| N2 | Notification bell | sara, neda, arman, darya, kamran, mina, bahram, farid | WARN | **Stale reminders remain after the role change.** These users still carry the 18 Oct "Uncoded stops waiting" and "(escalated)" reminders, 2 unread for most, which link to `/events?…&coding=uncoded`. They no longer hold a stop-coding role; for example, Sara is a production accountant who now cannot edit stops. | `p-sara-bell.png`, `persona-*.json` bell | Low | One-off data fix: delete or close the work reminders whose recipient no longer holds the role (`apply-guide-roles.ts`). Generally, resolve a reminder when the recipient's role is revoked (`work-item-resolution-sql.ts`). |
| N3 | User management › Permissions panel | admin | WARN | **Page names differ from the sidebar.** The panel lists "Downtime analysis", "Production loss analysis" and "PLA trends", while the sidebar shows "Downtime overview", "PLA overview" and "Trends", against the single page-name source. | `x-permissions-sara.png`, `shell4.json` expanded | Low | `module-permissions-panel.tsx`: use the same `label ?? name` as the sidebar |
| N4 | Reports › OEE and downtime | admin | WARN | **The no-plan wording is not used on Reports.** The 18 and 19 Oct rows repeat "Not available: no calculated periods" in all 4 cells. The re-test brief says periods without an approved plan read "No approved plan covers this period". | `a-reports-tab0.png` | Low | Use the no-plan reason for these dates. Show the reason once per row, not once per cell. |

### Use cases re-verified

- **Login and session:** login (correct, wrong and empty), session expiry, sign out and Back, and a deep link through login (`/audit?view=work-summary`).
- **Header:**
  - plant selector.
  - Live indicator.
  - USD/IRR: 7,650.00 USD ↔ 4,590,000,000 IRR; persists across reload; restored to USD for Admin and Reza.
  - Operator: no money toggle, and no USD/IRR on the Dashboard or Event Hub.
- **Bell:** count, All/Unread filter, and mark unread → read on Omid (restored to 1 unread).
- **Navigation:** sidebar collapsed and expanded, the drawer at 768 px for Omid and Reza (closes on navigate), and route gates for 14 accounts.
- **Breadcrumbs and errors:** breadcrumbs, 404, and the bad deep links for approvals, tasks, audit and plant edit.
- **Dashboard:** every persona; tile links; window kept in the URL and across reload.
- **Approvals:** the Pending approvals inbox for all 14, and Kamran's approval detail opened and reloaded (**not decided**).
- **My work:** all tabs.
- **Reports:** 4 tabs and IRR; the 17 Oct export CSV downloaded as Leila.
- **Admin panel:** 5 tabs; organization and plant edit opened and cancelled; Reza sees the Plant settings tab only.
- **User management:** Users (Plant roles), Permissions (Sara), Delegations, and the Kamran user page (read only).
- **Audit log:** entries, search in the URL, entry detail with reload, and Work summary.
- **Tasks:** list, and the new-task validation ("Enter a title.") and Cancel.

### Data created or changed (round 2)

- **Export jobs:** Leila's 17 Oct period summary CSV (export jobs are read-only, which the brief allows).
- **Audit log entries:** sign-ins and sign-outs, access-denied route checks, and the export.
- **Notification read state:** Omid's notification read state toggled and restored (1 unread).
- **Display currency:** Reza's and Admin's display currency switched to IRR and back to USD (verified USD active afterwards).
- **Nothing else:** nothing was approved, decided, saved or edited.

## Round 3 re-test (19 Oct 2026)

Run: 19 Oct 2026, about 17:20–17:40 Tehran, against the containers rebuilt at 17:18 (working tree on top of dd04dd24). Headless Playwright, UI login, every mutating request aborted in the browser (only login and notification reads went through). All 14 accounts at 1440 px; Omid, Reza and Admin also at 768 px; axe on the user page, approval detail and delegations. API checks were made from the signed-in browser with each persona's own token (Omid, Reza, Kamran).
Evidence: `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\r3-shellmd\` (`shots\*.png`, `menus.json`, `money-omid-*.json`, `op-*.json`, `cap-kamran.json`, `replay-omid.json`, `replay-reza.json`, `shell.json`, `users-admin-1440.json`, `words-*.json`).

**Summary: the round-3 money, roles and shell fixes are live. 0 High, 0 Medium, 8 Low still open.**

Clean across the sweep: 0 console errors, 0 failed requests, 0 serious or critical axe violations, no horizontal scroll at 768 px, no raw ids or snake_case keys on screen, menu name = h1 = page title on every page visited.

### Verified fixed

- **Operator sees no money (Omid, 1440 and 768 px).**
  - PLA tab bar has no Loss valuation; `/pla-analytics/valuation` opens the standard "No access" page.
  - Dashboard: no "OEE and downtime report" link (Reza has it).
  - Downtime: no "Lost value" toggle on Causes & Pareto and no "Export period summary" on Overview or Trends (Reza has both).
  - RCA case: header reads "Approved loss 28.00 t" (Reza: "28.00 t / 4,200.00 USD"); actions show no "claimed …" and recommendations no "Est. cost"; Outcome shows quantities only, no "Value basis" or "Claimed avoided loss" figures.
  - No USD/IRR toggle in the header; Reports, Period accounting and Finance are "No access".
- **Operator API (Omid's token).**
  - 403 `MONEY_NOT_VISIBLE` ("Your roles in this plant do not include loss values") on `GET /v2/reports/loss-value`, `loss-tree?metric=margin`, `bad-actors?rankBy=value`, `fx-rates`, `valuation-policies`, `valuation-rates`, `demand-statuses` and `exports/:id/download`.
  - The same GETs that return money to Kamran and Reza come back without it for Omid: `rcas/:id/actions` (no `claimedAvoidedLoss`), `rcas/:id/outcome` and `rcas/:id/links` (no value rows), `production-events/:id/attributed-losses` (no `values`, no `valuationView`), `bad-actors?rankBy=quantity` (no `value` objects), `production-events` (no `cost`).
  - Kamran (finance approver) and Reza (manager approver) get 200 with the money fields on every one of these routes.
- **User page shows plant roles (Admin).** Subtitle "Finance approver · HDPE plant" (Kamran) and "Operator · HDPE plant" (Omid). The legacy role is a "Sign-in type" select with the fallback help text ("Counts as a plant role only while the user holds none in the home plant…"). Users and Permissions lists show "Plant roles". For approval-role holders who are not administrators, `/users` now opens Approval delegations.
- **Permissions panel uses sidebar names (round 2 N3).** Sara: "Downtime overview · Stops & timeline …", "PLA overview · Loss breakdown · Trends …", "… Approval delegations".
- **Menus per persona (round 1 #15, round 2 observations).**
  - User management: Admin only. `/users` and `/permissions` are "No access" for every other persona.
  - Approval delegations: Sara, Reza, Neda, Arman, Kamran and Maryam (not Leila, Shirin, Farid, Omid, Mina, Darya or Bahram). Admin's `/delegations` goes to User management › Delegations.
  - Pending approvals: listed for every decider, including Omid (duplicate-stop merges); not listed, and "No access" by URL, for Mina, Darya and Bahram.
  - Equipment setup guide: gone from Omid's menu and "No access" by URL; listed for everyone else.
  - Integration pages (Connectivity, Source status rules, Source priority, Enhanced historian): Admin only in the menu.
  - Admin panel and Audit log: Reza and Maryam (by decision), Admin.
- **Header at 768 px (round 1 #11).** All 14 show "TF | Marun | HDPE plant" with nothing clipped; as decided, the name and role are not shown in the header below 1024 px.
- **Approval detail (round 2 #21, #22).** Kamran's restatement posting: State "Awaiting posting", Approval roles "Finance approver", treatment options "Correction / Change in estimate / Other adjustment / No posting", and a change-set row "Availability loss line · Reduced extrusion rate". Nothing was decided.
- **Reports (round 2 N1, N4, round 1 #6).** The default window is whole production days ("2026-10-12 – 2026-10-18 (production days 06:00–06:00)", `from=…T02:30Z`). Days without a plan read "No approved plan covers this period · Open Plans" once per row. Revisions offers "Approved revisions only / Include open drafts (provisional figures)".
- **Stale reminders (round 2 N2).** No bell count for Sara, Neda, Arman, Darya, Kamran, Mina, Bahram or Farid. Omid (1) and Shirin (2) still hold coding reminders, which match their roles.

### Still open

| # | Page / route | Persona | What's wrong | Expected | Severity |
|---|---|---|---|---|---|
| R3-1 | Pending approvals › restatement posting (`/approvals/finance-posting/…`) | Kamran | The first change-set row reads just "Availability loss line" (14.00 t → 0.00 t); the second reads "Availability loss line · Reduced extrusion rate". The line without a reason has no label after the dot. | "Availability loss line · Not coded" (or the reason it had), so both rows follow the same pattern. | Low |
| R3-2 | Dashboard, Last 24 h (round 1 #20) | Reza | The banner says "67 % of periods calculated" while the Availability tile still says "No calculated periods". OEE, Performance, Quality and Reconciled PLA OEE now correctly say "No approved plan covers these periods". | Availability uses the same no-plan reason as the other tiles. | Low |
| R3-3 | RCA case `/rca/…` Overview | Omid | Free text still carries money and course wording for an operator: the team charter says "(approved availability loss 28 t, USD 4,200, …)"; the problem statement starts "Training extruder stopped…"; the residual risk says "(guide: 600 comparable hours)". These are typed case texts, not redacted fields. | Correct the case texts (data), or accept that free text is outside the money rule and record it in DECISIONS. | Low |
| R3-4 | RCA case `/rca/…` Overview and Links & outcome | Omid | Text that only makes sense with money is still shown to the operator: "SuperAdmin may approve their own investigation; other approvers must be independent." (not SuperAdmin), "…valued in the contribution margin view…" and "Claimed avoided loss (owners), approved historical loss (ledger) and realized difference … are separate figures". | Show the SuperAdmin sentence only to SuperAdmin (as on Finance and Source priority); drop the valuation sentences when money is hidden. | Low |
| R3-5 | API, operator token | Omid | Money-related metadata is still returned: `bad-actors` keeps `data.currency: "USD"` and `viewSource`; `attributed-losses` keeps `valuationViewSource`; `GET /v2/exports` (list) answers 200 with every export job and `presentation.currency`. No amounts leak. | Leave out the currency and valuation-view metadata too, and list only the jobs an operator can download (or none, since download is 403). | Low |
| R3-6 | User management, Users list and header | Admin | The SuperAdmin's display name is "HDPE-TRAIN administrator", so course wording ("TRAIN") shows in every audit, "Granted by" and approval row. | A plant-neutral name, for example "HDPE administrator" (data). | Low |
| R3-7 | Notification bell | Kamran | Still no bell item for his 3 waiting restatement postings (round 1 #13). The decision entry says postings have no SLA, so no reminder is sent. | Open product decision (a posting SLA); not a defect in this build. | Low |
| R3-8 | Sidebar "RCA Analysis" | all | The only menu label not in sentence case. | "RCA analysis" in the menu, h1 and page title. | Low |

### Data created or changed (round 3)

None. No form was submitted and nothing was approved, decided, saved or edited. Mutating requests were aborted in the browser. The rule-builder Save check in master data sent `POST /v2/rules`, and that request was aborted too. Audit entries for sign-ins and for the deliberate 403 money checks were written by the server.
