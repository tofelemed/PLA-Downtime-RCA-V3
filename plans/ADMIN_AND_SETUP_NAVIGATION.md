# Related administration and equipment setup navigation

Owner request: move plant Settings into Admin Panel; move Codes & Rules into Master Data; verify step-by-step setup navigation for an extruder.

- [x] Embed plant Settings in an Admin Panel tab, preserving write capabilities and read-only deep links.
- [x] Move all Codes & Rules screens to Master Data routes and navigation; redirect old bookmarked routes with query/hash preserved.
- [x] Preserve reader/manager access without granting unrelated administration or master-data writes.
- [x] Add an ordered equipment setup guide with selected-unit context, scoped session resume, and Previous/Next navigation across the actual forms and previews. Explicitly distinguish navigation from saved/approved readiness.
- [x] Update the single-extruder guide and product decisions.
- [x] Run focused routing/capability/component checks, typecheck, lint and production build; activate the main frontend only and verify served assets/health. Do not seed or run a live plant setup.

## Flow coverage

Existing pages cover plant/display settings, unit and asset hierarchy, products, codes, calendar, profiles/rates, plan, stop/impact rules, MQTT/signal binding, unit-state mapping, output priority, valuation, events/coding, period workflow and analytics. The missing navigation is a single ordered path spanning them; the MQTT readiness panel covers only part of that journey.

## Validation

- Frontend typecheck passes, including E2E source compilation. Full frontend lint passes with warnings (no errors).
- Focused regression: 36 test files / 280 tests pass. It covers redirect paths/search/hash, Settings write/read roles, Master Data section boundaries, code/rule forms, unit-guided navigation, connection and period context, reload resume, malformed browser storage, user/plant isolation and exit behavior.
- Production frontend Docker build passes. Recreated only `proact-frontend-1`; it is healthy and serves entry `/assets/index-CvfJVCRw.js` (image `e130cab4a5eb4c0ef7f46613ed53edc4055467fc8dd5e40b1e7d459b3bed7f2a`). Equipment setup, Admin Panel and Codes & Rules bundles return 200 and include the new navigation. Frontend proxy health returns 200. API and worker retain their prior image and remain healthy. No backend restart or migration is needed.
- Playwright's Chromium executable is absent. Browser visual/E2E verification was not performed; no browser/dependency installation, seeding or live plant setup was attempted.


## Separate Administration guide and simpler setup sequence (17 October 2026)

- [x] Give Equipment Setup Guide its own Administration sidebar entry and page at `/equipment-setup`; redirect the old URL without losing search/hash.
- [x] Group the 19 actual tasks into six expandable phases. Place Codes & Rules after equipment/products, before stop/impact rules; apply policies before generating the first plan.
- [x] Retain unit/connection/period context, scoped resume, role boundaries, and explicit backend verification instructions. Do not imply visited steps are completed.
- [x] Align Master Data ordering and update the extruder document and decision log; explain reuse of shared configuration and remaining readiness limitations.
- [x] Check navigation, sequence, disclosure, redirect/resume and roles; run typecheck/lint/build, redeploy only the frontend and verify health.


### Separate-guide verification

- 20 focused frontend test files / 246 tests pass, covering the six phases and disclosure, dependency order, current-phase resume, direct guide menu/page access, preserved legacy setup search/hash, role boundaries and existing administration/code/user flows. The guide journey suite also passes after the final heading-accessibility adjustment (6 tests).
- Frontend typecheck passes (app, config and E2E sources). Full frontend lint completes with 0 errors / 233 warnings. Production frontend Docker build passes.
- Only the main frontend was recreated. Frontend image `13886309b682bc5df11ffcbc7ec3c7839a6ad614a2e7816f8224597957c4076c` is healthy, serving entry `/assets/index-BfFNkYFf.js` and guide `/assets/equipment-setup-page-kEgWEs-Q.js`; the page and guide bundle return 200 and served code contains the new route/menu/phase instructions. Initial entry plus module preloads is 191,455 bytes gzip across 5 chunks, within the 300 kB budget.
- Direct API and frontend-proxy health return 200, database connected. API and worker remain healthy on image `8ed5331c0745af052c19d115fa58778d6d78fa2ca7473a64326eeb49f464aad1`. No backend changes or migration required.
- Playwright Chromium is still absent; live rendered-browser visual verification and full extruder/broker/accounting execution remain unverified. No dependency installation, seeding or packet publishing.
