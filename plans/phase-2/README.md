# Phase 2 — Calendars, planning, actuals, accounting, workflow

**Spec epics:** P2 E07 Calendars and planning · E08 Accounting engine · E09 Approval workflow
**Exit gate (spec §20):** T19 T29 T30 T43 (E07); T15–T17 T20 T21 T28 T31 T32 T38 T45 (E08); T33–T36 T39 T44 (E09).
**Milestones:** M1 vertical slice needs 2.1, 2.2, 2.3 (minimal), 2.4, 2.5, 2.8 (submit/approve) and 2.9 (CSV export). M3 = all of Phase 2.

| Status | Sub-phase | Depends on | Exit tests |
|---|---|---|---|
| 🧪 | [2.1 Calendars and shift instances](2.1-calendars-and-shifts.md) | 0.4 | T19 T29 — green (9 Oct); calendar UI in 3.4 |
| 🧪 | [2.2 Production profiles and rates](2.2-production-profiles-and-rates.md) | 0.4, 1.3 | rate-version fixtures (T30 input) — green (9 Oct); profiles UI in 3.4 |
| 🧪 | [2.3 Plan versions and period generation](2.3-plan-versions-and-period-generation.md) | 2.1, 2.2 | T43; exact target distribution — green (9 Oct); plans UI in 3.4 |
| 🧪 | [2.4 Production periods and actuals results](2.4-production-periods-and-actuals.md) | 2.1, 2.3, 1.7, 1.10 | T25–T27 persisted; T12; T44 (2.4 half) — green (9 Oct); D05 authority applied in the runner until 1.10; revision half of T44 in 2.8; UI in Phase 3 |
| ⬜ | [2.5 Loss accounting engine and calculation runs](2.5-loss-accounting-engine.md) | 1.1, 1.2, 1.10, 2.2, 2.4 | T15 T16 T17 T28 T30 (+T37 conservation) |
| ⬜ | [2.6 Valuation](2.6-valuation.md) | 2.2, 2.5 | T38 T45 |
| ⬜ | [2.7 KPI engine: OEE, downtime, reliability](2.7-kpi-engine.md) | 2.1, 2.4, 2.5 | T20 T21 T31 T41 |
| ⬜ | [2.8 Reconciliation editor backend and approval workflow](2.8-reconciliation-and-approval-workflow.md) | 2.5 | T32 T33 T34 T35 T36 T44 |
| ⬜ | [2.9 Exports, domain events, downstream delivery](2.9-exports-and-downstream-events.md) | 2.8, 1.9 | T39; API04/API05 |

## The accounting data model in one picture

```
calendar_versions ─► shift_instances ─┐
production_profiles ─► unit_product_rates, valuation_rates ─┐
production_plans ─► plan_versions ─► plan_periods (per product slice) ─┤
                                                                      ▼
                                              production_periods ─► period_product_slices
                                                                      │
                                        accounting_revisions (Draft → InReview → Approved; Revise → new Draft)
                                                                      │
                                        calculation_runs (immutable; input hash; engine version)
                                            ├─ actuals_results (gross/good/reject, coverage, method)
                                            ├─ loss_lines (ledger plan|capacity, kind, qty, codes, basis, valuation snapshot)
                                            │     └─ loss_line_evidence (event revision / observation, share, clipped interval)
                                            └─ kpi_results (numerator/denominator/value/quality)
                                        approval_actions, audit_log, outbox → exports, realtime, downstream
```

## Legacy compatibility
`production_losses`, `reconcile_forms`, `loss_categories`, `oee_summaries` are not written by new code. 2.5/2.7 provide **read compatibility views** with the same column names so v1 screens keep rendering until Phase 3 rebinds them; `oee_summaries` loses its public write endpoint when 3.5 ships (§14.3). The legacy-ID crosswalk is kept for 3.10.

## Policies used by this phase (from 0.2)
`reconciliation_tolerance`, `oee_policy`, `coverage_gate`, `valuation_basis`, `approval_roles`. Each calculation run and approval records the policy versions it used.
