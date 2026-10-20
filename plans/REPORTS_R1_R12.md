# Persona reports R1–R12 (owner approval 2026-10-20: "approved go ahead")

Twelve reports for the plant's operating rhythm (daily meeting, shift handover, month close, engineering
reviews). Rules for all of them:

- Every number is computed on the server from stored results of the **shown run** of each period
  (`SHOWN` CTE in `src/v2/reports/report-sql.ts`: approved revision, else the open draft = provisional).
  The browser only formats.
- Read-only `GET /api/v2/reports/<name>` endpoints, `ReportWindowQueryDto` (from, to, unitIds,
  approvedOnly) plus report options, `resolveReportScope` for tenant and unit scope, the
  `AnalyticsResponse` envelope. Each new endpoint is flagged as an additive API change and recorded in the
  OpenAPI snapshot and the generated frontend types.
- Money: both currencies come from the server; the page shows the user's display currency (USD default,
  IRR option).
- Pages live in `src/features/ops-reports/` and are tabs of the Reports page (`?view=`).
- One commit per report, with tests (unit fixtures for maths, integration for SQL on the throwaway test DB).

| # | Report | New server read | Composed from existing |
|---|---|---|---|
| R1 | Daily production (day + month-to-date) | `production-by-product` (gross, prime, off-grade classes, plan target per product); `event-status` (open, uncoded, unverified events) | OEE total, loss tree top 5 by reason (quantity and value), data coverage |
| R2 | Shift handover | `shift_notes` table + `GET/POST /v2/shift-notes` | `production-by-product`, `event-status`, events of the shift |
| R3 | Monthly loss statement | — | scope waterfall, loss value, month close, restatements |
| R4 | Quality and off-grade | `quality-report` (classes by product and by day, prime yield) | loss value of quality lines |
| R5 | Grade transitions | `transition-performance` (each transition vs its standard) | — |
| R6 | Reliability trend | `reliability?groupBy=month` (additive option) | — |
| R7 | Chronic vs sporadic | `chronic-sporadic` (per reason: stops, seconds, mean; quadrant against the window medians) | — |
| R8 | Rate loss | `rate-loss` (performance loss lines by reason, monthly trend) | — |
| R9 | Coding compliance | `coding-compliance` (coded share, verified share, coding delay per shift and crew) | data coverage |
| R10 | RCA action tracker | `rca-action-tracker` (ageing buckets, on-time closure) | RCA portfolio |
| R11 | Plan adherence by grade | `production-by-product?groupBy=day` attainment | — |
| R12 | Executive scorecard | `monthly-scorecard` (12 months: OEE, loss % of capacity, loss value) | — |

Parked (need owner decisions): T1 targets and comparisons, T2 scheduled e-mail.

## Checklist
- [x] R1 Daily production (`production-by-product`, `event-status`; Reports → Daily production)
- [x] R2 Shift handover (`shift-handover`, append-only `shift_notes` + `POST /v2/shift-notes`; Reports → Shift handover)
- [x] R3 Monthly loss statement (`restatements`; composes month close, waterfall, loss tree, loss value; Reports → Monthly statement, browser print to PDF)
- [x] R4 Quality and off-grade (`quality-dispositions`, loss tree `groupBy=qualityClass`; Reports → Quality and off-grade)
- [x] R5 Grade transitions (`transition-performance`; Reports → Grade transitions)
- [ ] R6 Reliability trend
- [ ] R7 Chronic vs sporadic
- [ ] R8 Rate loss
- [ ] R9 Coding compliance
- [ ] R10 RCA action tracker
- [ ] R11 Plan adherence by grade
- [ ] R12 Executive scorecard
