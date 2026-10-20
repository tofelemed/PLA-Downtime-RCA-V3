# Tier 1 and Tier 2 implementation plan

Source: the tiered capability list (2026-10-19) built on `docs/INDUSTRY_CAPABILITY_ASSESSMENT.md` and the
nine fixes in `plans/INTEGRITY_FIXES.md`. Owner: "plan for small and medium size changes … after implementing
each tier test it all".

**Rules for every item:** follow CLAUDE.md (size limits, no `any`, business logic on the server, DTO = payload).
- Every schema change is a new migration with `down`. Every API change is flagged and the OpenAPI snapshot
  + `src/api/v2/schema.d.ts` regenerated.
- Engineering defaults are recorded in `plans/DECISIONS.md`.
- Integration specs run one file at a time on `proact_integrity_test` (single `proact-postgres`, port 5432).
  Never touch the `proact` database.
- Before any work, check with the other Claude sessions (`ListAgents`) which files they hold.

**Per-phase check** (each phase): unit tests for the new logic, backend `tsc`, frontend `npm run typecheck`,
lint on changed files.

**Tier test gate** (end of each tier, "test it all"):
1. Backend: `npx jest --selectProjects unit fixtures` (all), `npx tsc --noEmit -p tsconfig.json`, lint on
   changed files.
2. Frontend: `npm run typecheck`, `npm run lint`, `npx vitest run` (all; any failure re-run alone to separate
   load-related flakes from real failures).
3. Integration: every int-spec touched or added in the tier, one file at a time.
4. OpenAPI snapshot test green; `npm run api:types:check` green.
5. End-to-end: **ask the owner first** (CLAUDE.md), then run the e2e journeys of the tier on the plant the
   owner names. Never seed or reseed without that go-ahead.
6. Results recorded in this file (tick + counts) before the next tier starts.

Complexity: S ≈ ≤ 3 days, M ≈ 1–2 weeks (one developer familiar with the code).

---

## Tier 1 — small changes (screens over existing data, fixes, hygiene)

### Phase 1A — value from data the server already has

- [x] **1.1 Recurring-cause ranking page (S, frontend + one API check)**
  - What: a page listing RCA cause codes ranked by number of cases and by approved loss of those cases, with
    a drill to the cases. Reuses `GET /v2/reports/rca-causes` (`v2/reports/rca-cause-report-v2.controller.ts`,
    `rca-case/rca-cause-report.service.ts`). Filters: kind (root / direct / contributing), unit, currency
    (USD default, IRR toggle).
  - Where: `src/features/rca/causes-report/*` (new), route under `/reliability/causes`, navigation next to Bad
    actors (`src/features/auth/navigation-items.ts`).
  - Server: needs a "cases of this cause code" filter on `GET /v2/rcas` (`causeCodeId`) for the drill, as an
    additive query param plus an index check.
  - Tests: vitest for the page (ranking as served, no client sums, drill link); int-spec for the
    `causeCodeId` filter.
  - Done when: a reliability engineer sees the top recurring causes with their approved loss and opens the
    cases behind each one.

- [x] **1.2 Capacity gap report (S–M, backend report + page)**
  - What: per unit and product over a window, the stored rate kinds side by side (nameplate → demonstrated →
    sustained → planning), with the gap between each step as reported by the server. Only approved,
    effective-dated rate versions are used. Nothing is inferred when a kind is missing: it shows "not set".
  - Where: `src/v2/reports/capacity-gap-*.ts` (new) reading `src/profiles` rate versions;
    `src/features/pla-analytics/capacity-gap/*` (new tab or page).
  - Tests: domain unit test for gap maths (decimal, missing kinds); int-spec for scope and effective dating;
    vitest for the page.
  - Done when: a planner sees where demonstrated capacity lags nameplate and where planning lags sustained,
    per unit and product.
  - Decision needed: **D-T1** confirm meaning of each rate kind for the plant (SME Q16). Until confirmed,
    the page labels them with the stored kind names only.

- [x] **1.3 Show SuperAdmin self-decisions (S, backend view fields + frontend badges)**
  - What: where a SuperAdmin decided their own record (owner decision 2026-10-16, `DECISIONS.md`), show a
    "Self-approved (SuperAdmin)" marker in the record view, the approvals inbox history and the exports. The
    stored flag `super_admin_override` exists on three tables (migration `1794190400000`).
  - First: inventory where self-decisions happen without a stored flag (period approval, month close, plan,
    rates, RCA closure) and list them. Add a flag only where the decision can't be derived from stored actor
    ids (approver = submitter is derivable).
  - Tests: unit test for the derivation; vitest for the badge; export spec includes the marker.
  - Done when: an auditor can see every self-decided record without querying the database.

### Phase 1B — correctness and hygiene

- [x] **1.4 Keep rule provenance on PATCH (S, backend)**
  - What: when a PATCH sets a new reason code, the classification basis keeps the `declarative_rule` entries
    for axes the PATCH and the reason code leave untouched (item 8 open question 2).
  - Where: `src/v2/production-events/production-events-v2-commands.service.ts`, `src/rules/rule-defaults.ts`.
  - Tests: unit test on the basis merge; int-spec extension of `source-event-rules` / `declarative-rules`.

- [x] **1.5 Remove dead code (S)** — done 2026-10-19: `rca-trigger-config` module, service and DTOs deleted (entity kept, table exists). The 12 orphan v1 RCA entity folders (fishbone-diagram … rca-recommendation) have no importers, but removing them means dropping their tables (entity/table parity in `migrations.int-spec`), so they are kept: **owner decision needed** before a drop migration (possible old v1 data).
  - What: delete the unused `src/rca-trigger-config/{dto,*.module.ts,*.service.ts}`. The entity stays because
    the table still exists. Also remove other orphan RCA v1 entity folders only if nothing imports them (list
    them first; no table drops in this phase).
  - Tests: backend `tsc`, unit suite, `migrations.int-spec` (entity parity).

- [x] **1.6 Retire or harden v1 surfaces (S–M) — decision gate D-T2**
  - What: for each v1 route still mounted, either 410 Gone (no consumer) or scope it and paginate it:
    - `/api/production-events` (GET unpaginated), `/api/tasks/:id` (by-id scope relies on RLS);
    - the legacy `/socket.io` gateway (still used by v1 asset, app-settings and audit-log services; check
      first);
    - the `unmapped_events` writer (written, never read).
  - First: list consumers (frontend, e2e, scripts, docs). Public API change: flag it in `DECISIONS.md`.
  - Tests: route-guard allowlist test, the v1 int-specs that cover these routes, e2e grep for v1 calls.
  - **D-T2:** owner confirms the MIG05 cutover is complete, so v1 routes can be retired.

- [x] **1.7 Wider CI end-to-end smoke (S)** — done 2026-10-19: new `e2e/event-verification-d13.spec.ts`; `ci.yml`, `scripts/ci.sh` and `scripts/ci.ps1` smoke lists + verification, `plan-dashboard-ux05`, `rca-integration-rca01-03` (all self-seeding in the demo tenant). Run at the Tier 1 gate.
  - What: add three self-seeding journeys to `.github/workflows/ci.yml` (today only auth, tasks, audit):
    - an event coded and verified;
    - a PLA period submitted and approved;
    - an RCA closed with a coded root cause.

    Only specs that create their own world through the API go in, never ones that need the full plant.
  - Tests: run the CI steps locally with `npm run ci -- --e2e` (needs owner go-ahead for e2e).

### Tier 1 test gate
- [x] Gate 1–4 (2026-10-20): backend unit + fixtures 2,950/2,950, tsc clean, lint 0 errors on changed files; frontend
      typecheck clean, lint 0 errors, vitest 1,946/1,946; api types match the regenerated snapshot; 23 int-specs all pass
      (rca-causes 8, capacity-gap-report 5, profiles-api 10, super-admin-approval 7, reconciliation-approval 9,
      exports 10, month-close 11, day-certification 6, rca-cases 20, rca-history 3, source-event-rules 4,
      declarative-rules 9, production-events 16, tasks-tenant-binding 5, tenant-rls 5, event-retract 5,
      calendar-schedule 7, intake-pi-pipeline 4, source-mapping 9, query-budget 1, route-guard-coverage 4,
      migration-cutover 5, migrations 6). Afterwards all *_test DBs dropped (owner: `proact` only).
- [x] Gate 5 e2e on the Marun HDPE plant (2026-10-20: `e2e/marun-hdpe-tiers-readonly.spec.ts` 4/4 after the devdb rebuild; 16 UI screenshots, no page wrote on render) (`@hdpe-train.mpc`, read-only browser run as in `docs/qa/QA_SHELL.md`) — waits for
      the persona password (`MARUN_TRAIN_PASSWORD`) and a devdb rebuild. Expected e2e scope: RCA case + knowledge base journeys (1.1), PLA analytics (1.2),
      approvals (1.3), event-hub coding (1.4), smoke set (1.7).

---

## Tier 2 — medium changes (new logic inside the current architecture)

### Phase 2A — close the loss → cause → action → outcome loop (the differentiator)

- [x] **2.1 Loss → Cause → Action → Outcome portfolio (M, backend report + page)**
  - What: per plant/unit and window:
    - the approved loss linked to RCA cases, by coded cause;
    - open / overdue / done actions;
    - effectiveness verdicts;
    - approved vs claimed vs realised value, **never summed together**.

    Drill to the case, the action and the loss lines.
  - Where: `src/rca-case/portfolio/*` + `src/v2/reports/rca-portfolio-*` (new); reuse `approved-impact.ts`
    through its exported functions (one SQL per page, no N+1); `src/features/rca/portfolio/*` (new page);
    dashboard tile link.
  - Tests: domain unit tests (grouping, separation of the three figures); int-spec with seeded cases, actions,
    approved lines (scope, currency, keyset); vitest for the page; EXPLAIN ANALYZE noted for the new query.
  - Done when: a manager answers "which causes cost us most, what are we doing about them, and did it work"
    from one screen.

- [x] **2.2 Recurrence watch after closure → "re-evaluate" (M, backend + small UI)**
  - What: for a closed case, keep counting same-mode unplanned incidents per 1,000 run hours (the exposure
    query used by action verification) for a watch window. Above the threshold, a recommendation
    "re-evaluate this case" appears (new trigger kind; never reopens automatically).
  - Where: `src/domain/rca/recurrence-watch.ts` (pure, new), `src/rca-case/triggers/*` (new job step in the
    existing hourly verification run), `src/features/rca/components/recommendation-badges.tsx`.
  - Tests: fixture-style unit tests (exposure, threshold, zero-failure bound); int-spec (fires once per case
    and watch version, idempotent); vitest for the badge.
  - Decision needed: **D-T3** watch window and threshold (default proposal: 180 days, rate above the case's
    frozen baseline).

### Phase 2B — operations and reporting

- [x] **2.3 Downtime KPIs on a calendar-time basis (M, backend + UI label)**
  - What: when a unit/day has no calculation run (no plan or calendar), the downtime bundle reports
    availability, downtime, MTBF and stop counts computed on the server from events over calendar time.
    These are labelled "calendar basis" and are never mixed with run-based figures in one total.
  - Where: `src/v2/reports/downtime-bundle-report.ts`, `src/domain/kpi/*` (calendar-basis function),
    `src/features/downtime-analysis/components/kpi-summary.tsx` (basis badge).
  - Tests: fixture tests for calendar-basis KPIs; int-spec for a unit without periods; vitest for the badge.

- [x] **2.4 Accounting exceptions queue (M, backend list + page)**
  - What: one keyset-paginated list across periods of conditions the engine already detects:
    - residual beyond tolerance, `claim_exceeds_component`, `bridge_required`, `plan_allocation_required`;
    - stale submissions, actuals on a substitute source, uncoded stop time inside the period, pending
      duplicate-merge suggestions.

    Each row links to the screen that fixes it.
  - Where: `src/v2/reconciliation/exceptions-*` (new) reading stored flags (no recalculation on read);
    `src/features/month-close/exceptions/*` or `/my-queue` extension.
  - Tests: int-spec per exception type + scope; vitest for filters and links.
  - Done when: before month close, an accountant sees every open problem in one list.

- [x] **2.5 Server PDF report of an RCA case (S–M)**
  - What: a new export kind `rca_case` in the existing export worker (immutable, hashed, display currency).
    Contents: definition, team, timeline, coded causes, analyses summary, actions with verification,
    approved/claimed/realised, closure approval.
  - Where: `src/exports/*` (new kind + renderer), `src/features/rca/case/*` (Export button, job status).
  - Tests: export unit test (content rows, currency); int-spec (job lifecycle, scope).

- [x] **2.6 Rule-filled axes on source revisions (S–M, backend)**
  - What: when a source revision changes `eventType`, re-apply `coding_default` rules to the axes that were
    rule-filled (not user overrides) and keep the classification basis accurate (item 8 open question 1).
  - Where: `src/production-event/revisions/source-revision.ts`, `src/rules/rule-defaults.ts`.
  - Tests: int-spec extension of `source-event-rules` (event-type change → rule re-applied, user override
    kept).

### Phase 2C — SME-gated (start only after the decision is recorded)

- [x] **2.7 Investigation depth by consequence class (S–M) — decision gate D-T4**
  - What: the consequence class sets the required methods and gates (API RP 585-style levels), e.g. minor =
    5-Why, major = logic tree + team charter, critical = logic tree + FMEA/fault tree + independent review.
    The gates are pure functions (`src/domain/rca/investigation-gate.ts`).
  - Tests: domain unit tests per class; readiness int-spec; vitest for the gate messages.
  - **D-T4:** reliability lead supplies the class → required-methods matrix.

- [x] **2.8 Weighted multi-reason stops (M–L) — decision gate D-T5**
  - What: optionally split one stop across several reasons by weight (sum = 1, percent or duration),
    pro-rata across day/shift boundaries. The weights flow into loss-line evidence shares so the
    conservation checks still hold.
  - Where: `src/domain/accounting/cause-allocator.ts`, `segmentation.ts`, event coding entity + migration,
    Event Hub coding UI.
  - Tests: accounting fixtures (conservation, interaction with first-out overlap allocation); int-spec;
    vitest.
  - **D-T5:** SME agrees when weighted reasons are allowed, who sets them, and how they combine with the
    overlap policy (SME Q11). Highest-risk item: done last in Tier 2.

### Tier 2 test gate
- [x] Gate 1–6 (2026-10-20): backend unit + fixtures 3,051/3,051, tsc clean; frontend typecheck clean, lint 0 errors, vitest
      1,981 (one real failure fixed — `toFixed` in reason-split → exact decimal strings; one known timing flake passes alone);
      api types match the regenerated snapshot; 31 int-specs on a throwaway `proact_test` (dropped after): 27 passed first
      time, 4 fixed — migrations (entity CHECKs for `reason_weights`), rca-recurrence-watch (wrong close-date column,
      uuid compare, untyped `''` key), downtime-calendar-basis (tenant timezone fallback; test site timezone; 8-dp value),
      reconciliation-exceptions (recalculate all shifts; immutable totals in test data; 422 for v2 validation). Read-only
      e2e on the Marun HDPE plant 4/4 + UI screenshots. Expected e2e scope: RCA journeys (2.1, 2.2, 2.5, 2.7), downtime analysis (2.3), PLA
      period / month close (2.4, 2.8), event hub coding (2.6, 2.8).

---

## Decisions (recorded 2026-10-19 in `plans/DECISIONS.md`: D-T1 guide/SME Q16, D-T2 yes, D-T3 agreed, D-T4/D-T5 standard practice)

| Id | Question | Needed for | Owner |
|---|---|---|---|
| D-T1 | What each stored rate kind (nameplate, demonstrated, sustained, planning) means for the plant | 1.2 | Production planning |
| D-T2 | Is the v1 → v2 cutover (MIG05) complete, so v1 routes can return 410? | 1.6 | Owner |
| D-T3 | Recurrence watch window and threshold after closure | 2.2 | Reliability lead |
| D-T4 | Consequence class → required investigation methods matrix | 2.7 | Reliability lead / HSE |
| D-T5 | Rules for weighted multi-reason stops and their interaction with the overlap policy | 2.8 | Production accountant / operations |

## Order of work

1A (1.1 → 1.2 → 1.3) → 1B (1.4 → 1.5 → 1.6 if D-T2 → 1.7) → **Tier 1 gate** →
2A (2.1 → 2.2) → 2B (2.6 → 2.3 → 2.4 → 2.5) → 2C (2.7, 2.8 as decisions arrive) → **Tier 2 gate**.
Items whose decision is missing are skipped and listed as blocked at the gate. They never hold up the rest
of the tier.


## Follow-ups (2026-10-20, owner: "drop v1 and fix these 3")
- [x] Drop the ten empty v1 RCA tables (`1794240500000-DropV1RcaTables`, applied on `proact`; `evidence_categories` / `evidence_locations` kept — v2 reads them). Checks: migrations 6/6, core-tenant-uuid 6/6 (spec updated: the dropped tables are no longer asserted after a full run), rca-workspace 8/8, tenant-rls 5/5, rls-policy-form 1/1.
- [x] Capacity gap header shows "As of …" instead of the window.
- [x] Bulk-code dialog: percent-only reason split.
- [x] RCA policy editor: Critical tier and zero-repeat class.
- [x] Gate: backend tsc clean, unit + fixtures 3,051/3,051; frontend typecheck clean, lint 0 errors, vitest 1,985/1,986 (the overview timing flake passes alone); stack rebuilt (devdb override); screenshots 17–19 on the Marun HDPE plant, no writes.
- [x] Drop all other unused v1 tables and retire the cutover tool (`1794240600000-DropV1LegacyTables`, 25 tables, applied on `proact`; 154 tables remain). Checks: migrations 6/6 (full revert + re-run), core-tenant-uuid 6/6, intake-pi-pipeline 4/4, source-mapping 9/9, signals-crosswalk 1/1, tenant-rls 5/5, rls-policy-form 1/1, route-guard-coverage 4/4; backend unit + fixtures 3,024/3,024; frontend typecheck clean, lint 0 errors; read-only Marun e2e 4/4 after the devdb rebuild.
