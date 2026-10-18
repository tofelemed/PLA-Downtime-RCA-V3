# Focused Downtime Analysis and PLA pages

Owner approved proposal: separate sidebar sections for Downtime Analysis and Production Loss Analysis (PLA), each with focused routed pages. Retain Production for operational workflows and Reliability for RCA/actions.

- [x] Add sidebar groups/routes with active-page highlighting and existing role checks.
- [x] Split Downtime into Overview, Stops & Timeline, Causes & Pareto, Trends & Comparisons, Reliability.
- [x] Split PLA into Overview, Loss Breakdown, Trends, OEE, Reconciliation & Data Quality, Loss Valuation.
- [x] Preserve URL filters, drill-downs, Back behavior and old bookmarks; clearly identify unsupported filter scopes.
- [x] Load only the active analysis, reuse existing server calculations and keep tables paginated.
- [x] Add navigation/page/query regression coverage and update the extruder guide.
- [x] Run focused tests, typecheck, lint and production build; activate and verify the frontend.

Implementation constraints: no new dependencies, data seeding, backend contract changes or metric changes. Existing components and design system are the visual target. Browser verification will use an existing authorized session if available; report capture/authentication limits.

Validation (17 October 2026): 124 focused tests pass across 19 files, including actual routed page reads, legacy tab/anchor redirects, supported/unsupported filter scope, same-area and cross-area links, active-only queries, event detail return links, sidebar role visibility and equipment-guide navigation. Frontend typecheck passes; full lint has 0 errors and 233 warnings (down from 234 at the start). Production Vite build and Docker frontend image build pass. Documentation links and new feature file size limits pass.

Only the frontend was rebuilt/restarted. No migration, backend contract, seed or production calculation was changed. Native browser capture timed out; authenticated rendered-page visual QA and a full live extruder scenario remain unverified.

Deployed frontend: `sha256:4b29974072f161059fdb0d4c410968c1c6a8075e026a0030071d292f6b386ca8`, entry `index-DUdciq-Y.js`. Frontend/API/worker and supporting services are healthy. All 11 analysis SPA route shells and proxied `/api/health` return HTTP 200. Verified served overview, stops and valuation page bundles. These HTTP checks confirm delivery, not authenticated visual behavior.
