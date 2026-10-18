# UX remediation plan

Source: `docs/UX_AUDIT.md` (finding IDs). Decisions: `plans/DECISIONS.md` 2026-10-18.
Per phase: unit tests + typecheck + lint only. One-plant seed + e2e once at the end, after asking the owner.

## Phase U1 — quick wins (frontend only)
- [x] Shell/cross-cutting: A-2, H-2, H-3, H-4, H-9, B-2, B-6, B-9, C-4, C-5, G-5
- [x] Downtime: A-4, C-3, B-4, G-2(a), E-L2, E-L4, E-L6, E-L7, E-L8
- [x] PLA: A-3/G-1, A-6, A-7, D-1, D-3, D-4, D-8, D-9, D-11, D-12
- [x] RCA: F-2, F-5, F-8, F-9, F-13 copy/links, F-4 (statusLabel everywhere)

## Phase U2a — design system foundations
- [x] C-1 tokens, C-2 StatusBadge + badge migration, C-7, C-8 FormField, H-5, H-6, H-7, H-8, H-10

## Phase U2b — module work (frontend only)
- [x] Shell/nav: B-1 (fixes only), B-3, B-5, B-7, H-1, H-11 shared unsaved guard, G-6
- [x] Downtime: B-4 follow-up (accept `/plans/:id/periods/:pid…` as back target), A-1, A-5, C-9, C-10, E-1 (columns + start sort), E-2, E-3, E-4, E-5, E-6, E-7 (links/preview), E-8, E-9, E-10
- [x] PLA: D-5 (date jump, prev/next), D-6, D-7 (if field exists), D-10, D-13 — lock flag absent: rename only; reconciliation count badges → U3
- [x] RCA: A-8, F-1, F-4 stepper, F-6, F-10, F-11 (frontend), F-12, G-3 header, G-4

## Phase U2c — glossary
- [x] H-12 glossary applied across UI strings + `docs/GLOSSARY.md` (`ux-kit/labels/glossary.ts`, `eventNoun`)
- [x] PLA `parseScope` understands rolling window keys (relativeWindowOf) so Downtime→PLA keeps `window=24h`
- [x] e2e specs: sidebar link names "Downtime overview" / "PLA overview"; event-row link names (no spec used the old names; glossary strings updated)
- [x] G-4 RCA chip applied outside rca/ (downtime drill lists, event list, PLA loss events); plan-dashboard loss lines → U3 (candidate/line views carry no RCA state)

## Phase U3 — additive backend + dependent UI
- [x] G-2(a) event → period links (needs additive `planId` on ProductionPeriodView)
- [x] D-2 loss derivation inputs
- [x] G-2(b) per-event attributed impact
- [x] G-4 loss lines: RCA state of the cause event on candidate / line views (additive), then `EventRcaChip` in the period workspace
- [x] F-7 cross-case RCA actions list + My actions view
- [x] E-1/E-7 duration sort, min-duration filter, verification filter
- [x] D-5 residual-state filter; D-7 lock flag (if missing)
- [x] D-5 `sort=-utcStart` on `/period-summaries` (exact previous period; UI looks back 7 days); D-6 cross-plan period list filtered by workflow/residual state (reconciliation count badges)
- [x] RCA list: trigger event id + actions total/done/overdue on `GET /v2/rcas`; `open=true` filter for "Open critical"
- [x] RCA evidence task assignee field (F-11)
- [x] Plant-wide loss-line / occurrence pickers for RCA links (G-3)
- [x] Recommendation view: event reason, asset, start (F-1)
- [x] Event diagram save uses rowVersion/If-Match of the opened version (concurrent overwrite risk)
- [x] Bulk code DTO: assetId + investigationPending (A-1/E-3)
- [x] Event view: source-owned field list for per-field "From source" + Override (E-5)
- [x] F-3 default (progress counts actions)
- [x] B-8 shared analysis context; 5.6 role-aware dashboard row
- [x] OpenAPI snapshot updated

## Final
- [x] Full lint/typecheck/unit (frontend + backend) — 2026-10-18: FE 1431/1431, BE unit green except the OpenAPI spec broken by the parallel integrity session
- [x] Integration specs (2026-10-18, proact_ux_test): migrations 6/6, approved-ledger 3/3, accounting-runs 10/10, reconciliation-draft-lines 8/8, loss-attribution-reads 3/3, event-list-duration 5/5
- [x] G-4 RCA chip on plan-dashboard loss lines (`causeEventRca`, `linkedEventRca`)
- [x] Applied rate stored on loss_lines (migration 1794220700000) and shown in the derivation
- [x] Bulk coding can clear "investigation pending" (three-way choice)

- [ ] Ask owner → one-plant seed + e2e
