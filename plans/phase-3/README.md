# Phase 3 — Frontend on v2, analytics, RCA, production readiness

**Spec epics:** P3 E10 Frontend integration · E11 Analytics and RCA · E12 Production readiness
**Exit gate (spec §20):** T22 T24 T41 T42 (E10); audited formula and recurrence fixtures (E11); T40 + release evidence accepted (E12). Then R1 definition of done (§21.1).
**Milestones:** M4 = 3.1–3.9; R1 release = 3.10–3.12.

| Status | Sub-phase | Depends on | Exit tests |
|---|---|---|---|
| 🧪 | [3.1 Frontend foundation](3.1-frontend-foundation.md) | 0.4, 1.9, 2.9 | T23 (client), T24 (shared snapshot) — implemented 9 Oct 2026; T23 green (client + server scope), T24 rule unit-tested, Playwright T24 with the first report page |
| ⬜ | [3.2 Event Hub on v2](3.2-event-hub.md) | 3.1, 1.1–1.4 | UX04 journey e2e |
| ⬜ | [3.3 Downtime Analysis page](3.3-downtime-analysis-page.md) | 3.1, 2.7, 1.10 | AN01; T24 |
| ⬜ | [3.4 Plans, profiles, calendars UI](3.4-plans-profiles-calendars-ui.md) | 3.1, 2.1–2.3 | PLAN03/CAL preview e2e |
| ⬜ | [3.5 Plan Dashboard period grid and reconciliation](3.5-plan-dashboard-and-reconciliation.md) | 3.1, 2.4–2.8 | UX05 journey; T33 (UI) |
| ⬜ | [3.6 PLA Analytics and Reports](3.6-pla-analytics-and-reports.md) | 3.1, 2.6, 2.7, 2.9 | AN02 AN03; T24 T41 |
| ⬜ | [3.7 Integration console](3.7-integration-console.md) | 3.1, 1.5–1.9 | UX06 journey |
| ⬜ | [3.8 Codes, profiles and declarative admin rules](3.8-codes-and-admin-rules.md) | 3.1, 1.3 | T18 (UI); T22 |
| ⬜ | [3.9 RCA integration and action feedback](3.9-rca-integration.md) | 3.1, 1.2, 2.8 | RCA01–03 fixtures; T42 |
| ⬜ | [3.10 Migration and cutover](3.10-migration-and-cutover.md) | all 3.x features | MIG01–06; before/after report |
| ⬜ | [3.11 Security, tenant isolation, performance](3.11-security-isolation-and-performance.md) | 3.1–3.9 | T14 (full), T40 |
| ⬜ | [3.12 Monitoring, runbooks, recovery drill, pilot](3.12-monitoring-runbooks-and-pilot.md) | 3.10, 3.11 | T39; restore drill; pilot acceptance |

## Approach
- **One screen at a time behind a feature flag** (`VITE_FEATURE_V2_<SCREEN>` read from a server-provided flags endpoint, not build-time only), so v1 and v2 bindings coexist during migration (MIG02).
- **Nothing fabricated remains** when a screen's flag flips: heuristic OEE, random trends, fake loss inputs, hard-coded rates, `Math.random` crews, `Simulate Events` in production builds, `localStorage` rules (UX03).
- Every analytical screen shows: scope, plant timezone, quantity unit, baseline, approved/provisional, as-of, freshness; and distinguishes loading / empty / no-permission / source-offline / incomplete / calculation-pending / error (UX03).
- Accessibility and tablet viewport checks are part of each screen's e2e (UX07).

## Cross-cutting standards
[../ENGINEERING_STANDARDS.md](../ENGINEERING_STANDARDS.md) (performance and code-quality rules) applies to every sub-phase here and is verified in 3.11.
