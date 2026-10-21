# Plant settings and branding fixes (21 Oct 2026)

Source: the plant settings and branding audit of 21 Oct 2026 (five read-only audits: settings pipeline and audit
trail, frontend dates, numbers and currency, plant name and branding, server-made text). Owner answers:

1. The first day of the week is configurable (any day).
2. The branding fields that are saved but never used are made to work.
3. Report exports take the logo, colours and name from branding; `assets/marun.png` is only the fallback.
4. The product name is "Traverse Forge" everywhere.

Each phase is tested (unit tests, typecheck, lint on the changed files, and the integration suites it touches)
before the next one starts.

## Phase 1: configurable week start
- [x] Any of the seven days (`WEEK_STARTS`); migration widens the CHECK with `down`.
- [x] Week keys: Monday keeps the ISO key; every other start is named by the date of its first day (TS and SQL).
- [x] Settings form and the plant create/edit form offer all seven days; no Monday fallbacks in the UI.
- [x] Tests: week-key fixtures for every start day; SQL and TS keys agree.

## Phase 2: audit trail and the open plant-update route
- [x] v1 `PUT /tenants/:id` no longer changes timezone, calendar or digits (v2 owns them, with the timezone lock).
- [x] `X-Client-Audited` is honoured only on routes that declare a client audit.
- [x] Plant settings, plant edits and branding write an explicit audit entry with the changed fields (old and new),
      filed under the edited plant.

## Phase 3: changes reach everyone
- [x] A plant settings change or rename is pushed to the plant's users; their clients refetch the plant.
- [x] The stored plant selection is refreshed from the plant directory (no stale names).
- [x] The timezone lock also counts calendar versions and shift instances.

## Phase 4: server-made figures and text
- [x] RCA action overdue = after the end of the due plant day (summary, list, queue, R10, reminders).
- [x] R10 on-time = completed before the end of the due plant day.
- [x] Report exports show the chosen currency only ("Not reported in X" when absent).
- [x] Month buckets follow the plant calendar (Persian months for Persian plants) in R6, R12, rate-loss and KPI
      month groups; PDF month labels and title dates use the plant calendar and digits.
- [x] Audit-log CSV gains a plant-time column; events CSV file name uses the plant day.

## Phase 5: frontend dates
- [x] "As of" header, freshness text and zone badge follow calendar and digits.
- [x] Raw ISO dates (month close, policy backdate, posting confirm, period grid label, MQTT setup) formatted.
- [x] Shift handover date uses `DateInput`; monthly drill window label; audit export file name; knowledge CSV
      header.

## Phase 6: numbers and currency
- [x] Counts in sentences and badges use plant digits (`plural` with the formatter, raw count cells).
- [x] Change proposals follow the currency switch; R12 money uses plant digits; RCA policy threshold keeps cents.
- [x] Hand-built durations use `formatDuration`; chart tooltip counts without decimals.

## Phase 7: branding
- [x] Primary colour themes the app (`--primary`, readable foreground); secondary colour applied.
- [x] Favicon, logo size, fit, radius, container size, padding and background opacity applied; broken logo falls
      back to initials.
- [x] Subtitle and initials can be cleared; the v1 settings route cannot write branding; values re-validated on read.
- [x] Public branding (name, subtitle, logo, favicon) for the sign-in page; `index.html` and the manifest say
      "Traverse Forge" and the missing favicon is fixed.
- [x] Report PDF/XLSX use the branding name, logo and colours (Marun file as fallback); download names carry plant,
      report and date.
- [x] "Traverse Forge" replaces "Pro-Act" in user-visible text (not the MQTT contract schema titles).
- [x] A branding change reaches other users without a reload.
