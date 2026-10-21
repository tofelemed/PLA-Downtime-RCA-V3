# Setup section in the side navigation (21 Oct 2026)

Owner: "make a separate tab, for example Setup, in which all pages related to setting up equipment, plans,
profiles, crews and master data are, in proper order" — the proposal accepted as written. Defaults taken on
the open points: plans stay in Production (made every period); valuation moves into Setup; plant settings stay
in the Admin panel; visibility follows the existing capabilities.

## Menu
Sections: Overview · Production · Downtime analysis · PLA · Reliability · **Setup** · Integration · Administration.

Setup, in the order of the Equipment setup guide's phases:

| # | Entry | Pages (tabs / sub-pages) | Menu capability |
|---|---|---|---|
| 1 | Setup guide | `/equipment-setup` | `canReachSetupGuide` |
| 2 | Plant & equipment | Units · Assets · Products · Hierarchy · Plant flow | `canReachPlantEquipment` |
| 3 | Codes & failures | Codes & rules · Failure dictionary | `canReachCodesSetup` |
| 4 | Production rules | Stop and plan policy · Unit impact rules · Standby equipment · Unit state | `canReachProductionRules` |
| 5 | Calendars & crews | `/setup/calendars` (calendars, crews and rotations) | `canViewAnalysis` |
| 6 | Profiles & rates | `/setup/profiles` (Profiles & rates · Grade transitions · Streams) | `canViewAnalysis` |
| 7 | RCA library | Templates · Cause library · Verification checklists | `canManageMasterData` |
| 8 | Valuation | `/finance` (valuation policy, exchange rates) | `canViewAnalysis` |

Moves out of master data: Work-order operations → Reliability. Production keeps **Plans** (`/planning`, plans only).
Administration keeps users, delegations, Admin panel and audit log.

## Rules
- Every existing URL keeps working: master-data and finance paths are unchanged; `/planning?tab=profiles|
  transitions|streams|calendars` redirects to the Setup pages; sub-pages (`/planning/profiles/…`,
  `/planning/calendars/…`) keep their paths and highlight their Setup entry.
- Route gates do not change: master-data routes keep `canReachMasterData` explicitly (menu visibility is finer).
- Pages of a multi-page entry show their siblings as a tab row (the master-data link row, per group).

## Checklist
- [x] Capabilities for the grouped entries; Setup section and entries; Reliability gets Work-order operations.
- [x] Master-data routes pin `canReachMasterData`; master-data link row shows the current group only.
- [x] Planning split: `/planning` plans; `/setup/profiles`, `/setup/calendars`; redirects; links updated.
- [x] Setup guide links and breadcrumbs follow the new pages.
- [x] Tests: navigation order and visibility per role, route gates unchanged, redirects; typecheck, lint, vitest;
      read-only UI check.
