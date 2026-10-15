# HDPE end-to-end validation — 15–16 October 2026

Owner request: analyse application and schema, remove accumulated demo data, seed
HDPE / unit100 / Extruder1 and HDPE / unit200 / Extruder2, then exercise all
personas, workflows, API calls, queries, filters, settings and UI.

Owner clarification during testing: the final environment must contain one
organization named HDPE, one HDPE plant, and the two requested units; remove all
other organizations and their children. Cross-tenant browser fixtures are temporary.
The owner explicitly authorized sub-agents and browser testing; backend, browser
and independent audit reviews are now delegated while the primary agent owns cleanup.

The request explicitly authorizes seeding and full plant tests (the go-ahead
required by CLAUDE.md). Preserve the owner's existing CLAUDE.md changes. Do not
push. Synthetic records remain identified as Demo in descriptions or notes.

## Execution order

1. Inspect routes, migrations, guards, scripts and tests; inventory the local DB.
2. Back up `proact` in `proact-postgres` and retain schema/migration identities.
   A guarded local-only reset refuses unfamiliar tenants/users. Preserve demo
   login identities, roles and feature flags; remove accumulated operational data
   and E2E fixtures. Never run the obsolete MSSQL `delete-all-data.ts`.
3. Adapt isolated seeders to exactly two production units and named extruder
   assets; align unit-scoped personas and MQTT placement. Add accountants and
   missing advanced workflow seeds with independent maker/checker actors.
4. Seed through public business APIs, read back results and check mass balance,
   calendars, rates, approvals, loss ledgers, valuation and ingestion provenance.
5. Run frontend/backend static and unit checks. Run integration tests only on
   `proact_hdpe_test` (the harness requires a name ending in `_test`); run browser
   spec files individually, retaining each result.
6. Add coverage for gaps in the supplied handover; fix root causes and record
   changed specs, product regressions and outstanding limitations.
7. Remove disposable test pollution from the showcase after test completion,
   restore settings, verify the two-unit seed again, and deliver evidence.

## Initial findings

- Active branch: `feat/downtime-area2-b`; app API :4004, frontend :8070.
- API/worker use host.docker.internal:5432, DB `proact`, container
  `proact-postgres`; bundled :5433 Postgres is a separate database.
- Existing tenant inventory: Demo Plant, Demo Plant 2, Partner Plant, 14 E2E
  tenants. Existing non-persona emails are documented demo or E2E accounts.
- Existing showcase creates four units plus persona/MQTT fixture units, not the
  owner's requested hierarchy. Production accountant is absent from the cast.
- Cleanup npm command is obsolete MSSQL and must not be used.
- Calendar seeder uses UTC despite the Iranian plant description; this must be
  made internally consistent with Asia/Tehran before creating periods.
- A few persona tests hardcode tenant IDs and display names. Keep established
  identities where useful, but assertions must use the requested HDPE name.
- At initial inspection, new feature coverage and the previously unrun integration
  tests had not yet been exercised; the final results are recorded below.

## Evidence

Raw backups, logs and per-spec JSON reports: `test-results/hdpe-audit/` (ignored
by Git; may contain local account data). Final results must distinguish passed,
failed, skipped and not-run checks; a passing unit suite is not an E2E pass.

## Industrial basis

- Coperion ZSK MEGAcompounder:
  https://www.coperion.com/en/products-services/extruders-compounding-machines/zsk-twin-screw-extruders/zsk-megacompounder
  establishes industrial HDPE compounding/pelletizing at tens of tonnes/hour
  (published range reaches about 135 t/h). The selected 32/28 t/h rates are
  illustrative plant assumptions, not a vendor guarantee for specific equipment.
- LyondellBasell HDPE:
  https://www.lyondellbasell.com/en/our-solutions/products/polymers/resin-type/hdpe/
  supports pipe, film, blow molding and injection applications.
- LyondellBasell blow-molding selection guide:
  https://www.lyondellbasell.com/globalassets/sites/2022/plastimagen/olefins--polyolefins/hdpe-and-pp-grades-used-in-blow-molding---consumer-rigid-packaging---product-selection-guide.pdf
  supplies representative density/MFR values with their test conditions. Values
  in the seed are engineering examples, not certified limits or commercial quotes.

Actual site rates, equipment models, prices, FX, calibration certificates and
historian feeds have not been supplied. Synthetic values cannot certify those.

## Validation findings during execution

- Backups taken before initial cleanup and before browser fixtures; preserve both.
- Initial frontend units: 141 files / 805 tests. Latest frontend: 145 files / 813
  tests; one static hygiene failure passed on an unchanged focused rerun.
  Final backend combined run: 220 suites / 2540 tests (190 / 2106 unit tests,
  29 / 418 mathematics fixtures and one / 16 seed-review fixture). Latest
  integration result per suite: 172 suites / 978 tests passed, including 23 suites /
  162 tests after scope fixes and nine / 70 after the quantity-unit fix; focused
  rerun provenance is retained.
- Product fixes include session organization lookup, active light palette,
  mapping selection preservation, accessible loading and reconciliation markup,
  mobile plant visibility, delayed acting-plant queries, PostgreSQL connection
  errors during RLS binding, and retryable 503 for failed identity lookup.
- Mixed-role scope escalation was reproduced and repaired in metrology,
  accounting, source authority/status, actuals, quality and month close. All 49
  new scope cases passed; the deployed metrology refusal and valid controls also
  passed in browser campaign 4. See the scope report for exact boundaries.
- Browser failures include stale first-out attribution expectations, outdated role
  menus, saved-filter toggles and selector races; each is checked against the current
  backend contract before changing expectations.
- New coverage: every named persona session, accountant/metrology/source authority,
  independent Quality approval, expanded axe scans and desktop/mobile overflow.
- Final cleanup restored the verified pre-browser snapshot atomically, removed
  other organizations and seeded 60 days. The previous month is locked and the
  MQTT worker ingested the finite 378-sample snapshot. Strict acceptance caught
  missing optional asset organization fields and retained browser fixture users;
  both were corrected. Final SQL/API acceptance passed, including a real ingestion
  defect that dropped the explicit MQTT quantity unit. The deployed fix preserves
  source units; a one-object public replay repaired the stored event to 9.6 t.
  All 52 persona sessions, six strengthened visual checks and the locked-month UI
  case pass. The second static-route sweep passed 61/62: Downtime session readiness
  exceeded the five-second assertion, while three traced focused repetitions
  passed unchanged. The final full traced sweep passed all 62 routes in 2.4
  minutes with unchanged waits. Latest completed-spec evidence is 65 specs /
  372 passing tests; earlier failures remain retained and their startup-delay
  causes are not established. Diagnostic repeats are excluded from the total.

## Completion

The closing read-only SQL/API acceptance passed again after the final route sweep.
`hdpe-final-validated.dump` is 21,052,197 bytes and its restore listing was verified;
the final snapshot was not separately restored. API, worker and frontend are
healthy. `final-evidence-sha256.json` records backup and evidence hashes.
The application remains one HDPE organization and plant with the requested two
units. Source, test and documentation changes are committed locally without a
push. See `docs/HDPE_E2E_REPORT.md` for final results and remaining observations;
the workflow matrix distinguishes UI journeys, API checks and unexercised controls.
