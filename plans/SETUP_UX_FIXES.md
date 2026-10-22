# Setup UX fixes (audit 2026-10-22)

Owner decisions: `DECISIONS.md` › "2026-10-22 — Setup guide, sidebar and Setup UX". Each phase is one commit;
unit tests + typecheck per phase, browser check at the end (screenshots once the browser tool is allowed).

## Phase 1 — Plant scoping (data integrity)
Cause: unit/asset/product creates take the plant from the header selection (`X-Tenant-Id` → `RequestContext`);
creating a plant never switches or refreshes the selection (`hierarchy-form-page.tsx:64-77`; directory cached 10 min,
`use-plant-directory.ts:11`, not invalidated on `admin_config`).
- [x] `/setup/plants` page (Organizations & plants) in the Setup section; Admin `plants` tab removed; `/admin?tab=plants`
      and `/admin/{organizations,plants}/…` redirect; repoint links (`plants-section.tsx`, `hierarchy-edit-link.tsx`,
      `hierarchy-page.tsx:83`, `hierarchy-edit-form.tsx`); gate `isSuperAdmin || OrgAdmin` (new capability).
- [x] After plant create: invalidate `['v2','directory']`; dialog "Plant X created — switch to it now?".
- [x] Organization › Plant dropdown at the top of unit, asset and product create forms (defaults to the header plant;
      change = confirm, then `setSelection`).
- [x] Server: an OrgAdmin may select every plant of its organization (`maySelectTenant`), so no role is granted on create;
      it also creates the plant's default site in the same transaction.
- [ ] Sites: `siteId` on `UnitV2CreateDto`/`UnitV2ChangeDto` (validated: active site of the acting plant); site list/create
      API + Site selector on the unit form; sites managed on the plant page. Migration only if a column is missing.
      OpenAPI snapshot update. *(Server side done: `POST`/`PATCH /v2/sites`, `GET /v2/sites` with `unitCount`, unit
      `siteId`/`siteName`, 422 `SITE_NOT_IN_PLANT`; no migration needed; snapshot updated.)*

## Phase 2 — Save feedback standard
- [x] `ux-kit` `SaveResultDialog` (title, record name, actions View · Add another · Back to list · Next: <tab>) and a
      `useSaveFeedback` built on `useCommandFeedback`; failures → `FriendlyErrorAlert` + field errors, input kept.
      (`src/features/ux-kit/save-result/`: `useSaveFeedback`, `useSaveResult`, `SaveFailureAlert`, `nextSetupLink`;
      applied so far to `useRecordEditor` and Setup › organizations & plants creates.)
- [x] Apply to `useRecordEditor` creates (units, assets, products, RCA templates/checklists), codes/rules create,
      profiles, rates, calendars, streams, transitions, plant flow, impact rules, finance creates, all imports,
      stop-engine / micro-stop / grade-change / unit-state versions.
- [x] Small edits/approvals: toast; inline adds above their own table (rates, transitions, streams, crews, flow
      routes) toast + close. Settings forms remount clean with the saved version. Dismissing a create's result dialog
      opens the new record (no duplicate create). Richer area alerts (codes, RefusalNotice) sit in `SaveFailureFrame`.
- [x] Defects: dictionary error shown as neutral status; duplicate `RefusalNotice` (`version-actions.tsx`);
      demand retire without confirmation; rate import stays enabled after accept (now disabled; result dialog when
      the import job finishes); rotation form never resets. Plan screens (Production) still use plain `RefusalNotice`.

## Phase 3 — Navigation
- [x] Area tab bar visible on sub-pages (`master-data-layout.tsx:34`); one link-row tab pattern for codes, profiles,
      calendars, finance (no nested shadcn Tabs). (`ux-kit/page-layout/area-tabs.tsx`; `?tab=` URLs kept; Calendars & crews
      and Organizations & plants are single pages, no row.)
- [x] Visible "← Back to <list>" on every sub-page, keeping tab, unit and filters in the query; module crumb on first tabs.
      (Setup sub-pages; list address handed over as `?back=`, `ux-kit/page-layout/return-to.ts`.)
- [x] Cancel on code and rule editors; asset Back returns to the originating unit (and units / assets opened from the
      plant hierarchy return to it).
- [x] "Next: <tab>" from the setup step order, in the result dialog only (no route moved in Phase 3; `next-setup-link` tests pass).

## Phase 4 — Add / Import placement
- [x] Every table page: `[Import CSV] [+ Add]` in the `PageHeader` actions. (Failure dictionary, Standby, Codes & rules
      New code / New rule, Valuation per tab, Unit impact rules; Default mappings, Grade transitions, Streams and profile
      rates keep their top-right Section/toolbar button, now opening a dialog. Work orders still uses `RowsImportPanel`.)
- [x] + Add: dialog for small records (dictionary entry, standby, buffer level, crew, rotation), sub-page for large ones.
      `ux-kit/add-dialog`: dictionary entry, standby, default mapping, transition standard, stream, stream run, rate,
      valuation rate, unit impact rule; buffer level, route, crew and rotation per the note below.
- [x] One shared CSV import page (file or paste → check → import) modelled on `rate-import-page.tsx`; replaces the paste
      panels in `failure-dictionary-page.tsx:98-103` and `standby-page.tsx:34-46`. (`ux-kit/csv-import`;
      `/master-data/failure-dictionary/import`, `/master-data/standby-equipment/import`.)
- [x] Stop policy and unit state: read-only summary per section with Edit. Stop policy: summary card per section,
      "Record new version" in the section header opens the form in a side panel (Sheet), closes on success; preview is a
      header button. Unit state: "New mapping version" on the versions section opens the editor in a Sheet.
- Done for my part of "+ Add" (dialogs from section-header actions): plant flow "Add route" / "Record buffer level",
  calendars "Add crew" / "Add rotation".

## Phase 5 — Consistency
- [ ] Names: "Production rules" vs "Stop and plan policy"; "Valuation" vs "Finance" crumb; "Master data › Cause library".
- [ ] Unit choice in the URL everywhere (profiles, calendars); unit impact rules honours `?unitId=`.
- [ ] Numbered pager instead of "Load more"; failure dictionary server-paged; RCA templates rows clickable.
