# Downtime e2e findings F1–F6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six findings of `docs/DOWNTIME_MQTT_E2E_REPORT.md` §5 the standard way: no period without figures can be submitted or certified; an OT re-code of a coded stop is visible as a review item; the Causes page defaults to the stop-level Pareto in declared mode; and the three display/counter defects are corrected.

**Architecture:** Backend changes stay in the existing gate, revision and intake-health modules (NestJS, TypeORM; one additive migration for the new review-item kind). Frontend changes are local to the downtime-analysis, integration-console and event-hub features. No new endpoints; one additive field in the subscribe-job health JSON.

**Tech Stack:** NestJS 11 / TypeORM 0.3 / PostgreSQL 15 (backend, Jest), React 18 / Vite / TanStack Query (frontend, Vitest), Playwright.

**Spec:** `docs/DOWNTIME_MQTT_E2E_REPORT.md` §5 (findings F1–F6) and the owner's instruction of 28 Oct 2026: "go ahead with standard and common practices".

## Global Constraints

- CLAUDE.md applies: TypeScript strict, no `any`; files ≤ 400 lines, functions ≤ 40 lines; named exports; no `console.log`; validate at the boundary; migrations with `down`; Postgres column types only; never edit `.env*`, applied migrations or `src/components/ui/*`.
- Commit trailer exactly `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never push.
- Integration tests run only against `proact-test-postgres` (`npm run test:int`, 127.0.0.1:5434); never against `proact-postgres` (:5432).
- Public API contract changes must be flagged and the OpenAPI snapshot updated (`npm run openapi:v2:update` → `server/pro-act-backend/openapi/v2.json`). Adding a review-item kind value and a health counter field are additive contract changes: update the snapshot in the task that adds them.
- Error codes are `UPPER_SNAKE`; review-item kinds and health counter keys are `lower_snake`.
- Frontend copy: plain language, no jargon in user-facing strings; test ids kept stable (`reason-pareto`, `lost-production`, `mqtt-counters`, `[data-counter=…]`).
- Backend paths below are relative to `server/pro-act-backend/src` (written `B/`); frontend paths to `src` (written `F/`); backend integration tests `server/pro-act-backend/test/integration` (written `T/`).

## Review Focus

1. A computed-mode period that has an approved plan but zero ledger totals because the actuals run has not completed yet must get `NO_COMPUTABLE_SLICE` and not a misleading ACTUALS_INCOMPLETE only (Task 1 test "run validated, no totals").
2. An excluded period (`is_excluded = true`) is not submitted at all; the new gate must not change that path (Task 1 test "excluded period untouched").
3. A source revision that re-delivers the same reason token the event already carries must open nothing and must auto-resolve a previously opened `source_reason_changed` item (Task 2 test "same code resolves").
4. A source revision with an unresolvable reason token (unknown code) on a coded event must still quarantine `unknown_code` and must not open `source_reason_changed` (Task 2 test "unknown token stays quarantine only").
5. The date-range fix must keep boundary-aligned windows unchanged (06:00 → 06:00 still shows the one production day) while fixing rolling windows (Task 3 test table).

---

### Task 1: Basis-independent "no computable slice" gate at submit and certify

**Files:**
- Modify: `B/reconciliation/submission-environment.ts` (`runIssues`, ~lines 9-19)
- Modify: `B/domain/reconciliation/reconciliation.types.ts` (issue code union, if codes are typed)
- Modify: `B/close/day-certification.service.ts` (`assertDeclaredFigures` → basis-independent) and `B/close/day-loss-basis.ts` (`DECLARED_EMPTY_SQL` generalised)
- Modify: `B/domain/reconciliation/submission-gates.spec.ts` (flip the computed-mode "empty passes" test at ~165 only if the gate is placed in `submissionIssues`; otherwise leave it and add the new spec below)
- Create: `B/reconciliation/submission-environment.spec.ts`
- Modify: `T/declared-reconciliation.int-spec.ts` (add the computed-mode sibling of the test at 279-309)
- Modify: frontend label map for workflow issue codes (find with `grep -rn "NO_CALCULATION_RUN" src/` — the file that labels `NO_CALCULATION_RUN`/`RUN_NOT_VALIDATED`) to add `NO_COMPUTABLE_SLICE`.
- Modify: `docs/PROACT_APPLICATION_GUIDE.md` §5 gates table (one row).

**Interfaces:**
- Produces: issue code `NO_COMPUTABLE_SLICE`, message `The calculation produced no computable slice; fix the period setup (see its warnings) and recompute before submitting.`, `sliceId: null`. Emitted by `runIssues(state)` when `state.run` exists, is validated, and `state.slices.length === 0`. Certify refuses with 422 `DAY_NOT_READY` when any non-excluded period of the day has an approved revision whose run has no plan-ledger total, regardless of loss basis.

- [ ] **Step 1: Write the failing unit spec** `B/reconciliation/submission-environment.spec.ts`: build a minimal `RevisionState` (copy the fixture style of `submission-gates.spec.ts`) and assert:
  - run validated, `slices: []`, `totals: []` → codes contain `NO_COMPUTABLE_SLICE`;
  - run validated, one slice → no `NO_COMPUTABLE_SLICE`;
  - no run → only `NO_CALCULATION_RUN` (unchanged, no duplicate blame).
- [ ] **Step 2: Run** `npx jest src/reconciliation/submission-environment.spec.ts` → FAIL (code not emitted).
- [ ] **Step 3: Implement** in `runIssues` (keep ≤ 40 lines; extract `noComputableSlice(state): WorkflowIssue | null`).
- [ ] **Step 4: Certify.** Generalise `day-loss-basis.ts` so the "empty" check does not depend on the run's policy snapshot: a period is empty when its approved run has no `period_ledger_totals` row with `ledger = 'plan'`. Keep the existing function names where callers use them; rename only if the name becomes false. `assertDeclaredFigures` → `assertFigures` (or keep the name and fix the doc comment) → 422 `DAY_NOT_READY` with message `A period of this day has no computable figures; revise and recompute it before certifying.`
- [ ] **Step 5: Integration test** in `T/declared-reconciliation.int-spec.ts`: a computed-mode period (default policy) with `slices: []` after recompute is refused at submit with `NO_COMPUTABLE_SLICE`, and certify after a forced `lifecycle='approved'` returns `DAY_NOT_READY`. Run `npm run test:int -- declared-reconciliation` (5434 only).
- [ ] **Step 6: Frontend label** for `NO_COMPUTABLE_SLICE` in the workflow-issue label map: `No computable slice — fix the setup and recompute`. Run the label file's test if one exists.
- [ ] **Step 7: Run** `npx jest src/reconciliation src/domain/reconciliation src/close` and `npm run typecheck` (both projects), then commit `fix(reconciliation): refuse submit and certify when the run has no computable slice`.

### Task 2: Review item when the source re-codes a coded stop (F2)

**Files:**
- Create: `B/database/migrations/<ts>-SourceReasonChangedReviewKind.ts` (`ALTER TYPE event_review_item_kind ADD VALUE IF NOT EXISTS 'source_reason_changed'`, pattern of `1794241300000-ProductionLossEventKind.ts`; `down` is a no-op with a comment, as there).
- Modify: `B/production-event/revisions/event-review-item.entity.ts` (`REVIEW_ITEM_KINDS`)
- Modify: `B/production-event/revisions/source-revision.ts` (`applySourceIn`: open/resolve the item after `appendRevision`) and `B/integration/pi-frame-ingest.service.ts` `store()` (pass the resolved `reasonCodeId` and the raw token into the revision call as a `sourceCoding` argument, not inside `facts`)
- Modify: `B/production-event/revisions/review-resolution.ts` (`dismiss` allowed for the new kind; `accept_source` refused for it with the existing 422)
- Modify: `B/v2/event-review-items/resolve-review-item.dto.ts` (description text)
- Modify: `B/integration/pi-frame-ingest.service.spec.ts` (:76-101 keeps `facts` free of `reasonCodeId`; add the new argument assertion)
- Modify: `T/event-revisions.int-spec.ts` (new tests)
- Modify: `F/features/ux-kit/labels/event-labels.ts` (`DECLARED_REVIEW_KIND_LABELS` or a new `DISMISS_ONLY_REVIEW_KIND_LABELS` consumed by `review-items-list.tsx`), `F/api/v2/types/events.ts` (kind union)
- Modify: `F/features/event-hub/components/review-items-list.tsx` only if the dismiss-button rule needs the new map
- Modify: `server/pro-act-backend/openapi/v2.json` via `npm run openapi:v2:update`
- Modify: `docs/MQTT_FEEDS_PAYLOADS.md` (one sentence under the downtime table: a later `reason_code` does not re-code the stop; it raises a review item)

**Interfaces:**
- Consumes: `EventRevisionService.applySourceRevision(id, facts, actor)` (event-revision.service.ts:131) → add optional `sourceCoding?: { reasonCodeId: string | null; reasonToken: string | null }`.
- Produces: review item kind `source_reason_changed`, `field = 'reason'`, `sourceRevisionId` = the new source revision, `codingRevisionId` = null; at most one `open` item per event; states `open | dismissed | accepted_source` (auto-resolution only).
- Rule: open when the event has `reason_code_id` set, the source resolved a `reasonCodeId`, and it differs from the event's current `reason_code_id`. Auto-resolve (`accepted_source`, `resolvedBy` null) when a later revision resolves to the event's current code. Unresolved token → nothing here (the handler's `unknown_code` quarantine stays). Uncoded event → nothing (the event keeps taking no code on revision, unchanged).

- [ ] **Step 1: Failing integration tests** in `T/event-revisions.int-spec.ts` (copy the helpers of :230-259):
  - "a source revision with a different reason opens one source_reason_changed item" (coded event, revision with `sourceCoding.reasonCodeId` = another code → `reviewItems` has one open item, kind/field as above; the event's `reason_code_id` unchanged);
  - "a second differing revision does not open a second item";
  - "same code resolves": a later revision with the event's own code → the item is `accepted_source`;
  - "dismiss works, accept_source is refused" (422) for this kind.
- [ ] **Step 2: Run** `npm run test:int -- event-revisions` → FAIL.
- [ ] **Step 3: Migration + entity + revision logic + resolution rules.** Keep `applySourceIn` ≤ 40 lines by extracting `reviewSourceCoding(manager, event, stored, sourceCoding)`.
- [ ] **Step 4: Unit spec** `pi-frame-ingest.service.spec.ts`: the revision call receives `sourceCoding` with the resolved id and token; `facts` still has no `reasonCodeId`.
- [ ] **Step 5: Frontend**: kind label `Source now reports a different reason` with Dismiss only; type union; `event-detail-tabs.test.tsx` or `review-items-list` test covers the button rule. `npx vitest run src/features/event-hub`.
- [ ] **Step 6: OpenAPI snapshot** `npm run openapi:v2:update`; `npm run typecheck` both projects; `npx jest src/production-event src/integration`; commit `feat(events): review item when the source re-codes a coded stop`.

### Task 3: Three display fixes (F3, F4, F5) — one batched dispatch

**Files:**
- Modify: `F/features/downtime-analysis/pages/causes-page.tsx` (+ `F/features/downtime-analysis/components/lost-production-pareto.tsx` empty state) — F3
- Create: `F/features/downtime-analysis/pages/causes-page.test.tsx` — F3
- Modify: `F/features/downtime-analysis/model/production-day-range.ts` and `production-day-range.test.ts` — F4
- Modify: `F/features/integration-console/mqtt/model/mqtt-health.ts` (`secondsSince`), `F/features/integration-console/mqtt/subscription-status.tsx` (`ago`), `F/features/integration-console/mqtt/mqtt-model.test.ts` and `subscription-layout.test.tsx` — F5

**Interfaces:**
- F3: `causes-page.tsx` reads `useLossAccountingMode(filters.unitIds[0])` (`F/features/accounting-mode/use-loss-accounting-mode.ts`); when `isDeclared` and the URL has no `analysis` param, the page renders the `reasons` view (ReasonPareto) and the "Rank by" selector shows `reasons` as selected. The lost-production empty state in declared mode reads: `This plant accounts declared losses, so stops carry no lost production. Rank by downtime reasons to see stopped time and stop count.` Computed mode unchanged.
- F4: `toCalendarDayRange(from, to, tz)` returns `{ from: midnight(productionDate(from)), to: midnight(productionDate(to − 1 ms)) + 1 day }`. Test table: `[27 Oct 19:50, 28 Oct 19:50)` plant time → From 27 Oct, To (inclusive) 28 Oct; `[17 Oct 06:00, 18 Oct 06:00)` → From 17 Oct, To 17 Oct (unchanged); `[17 Oct 06:00, 19 Oct 06:00)` → 17 Oct … 18 Oct.
- F5: `secondsSince(iso, now)` returns a signed integer (negative = future). `ago()` renders `(<DurationText> ago)` for ≥ 0 and `(<DurationText> ahead of the server clock)` for < 0; `0 s ago` only when the difference is truly within the second.

- [ ] **Step 1: Failing tests**: `causes-page.test.tsx` (declared → `reason-pareto` test id present without `analysis`; computed → `lost-production` present; mock `useLossAccountingMode` the way `pla-analytics-page` tests do), `production-day-range.test.ts` (the table above), `mqtt-model.test.ts` (`secondsSince` negative) and `subscription-layout.test.tsx` ("ahead of the server clock").
- [ ] **Step 2: Run** `npx vitest run src/features/downtime-analysis src/features/integration-console/mqtt` → FAIL.
- [ ] **Step 3: Implement** the three changes (each file stays under its size limit; `causes-page.tsx` component ≤ 150 lines).
- [ ] **Step 4: Run** the same vitest scope, `npm run lint -- src/features/downtime-analysis src/features/integration-console/mqtt` (or `npx eslint` on the changed files), `npm run typecheck`; commit `fix(ui): declared-mode Pareto default, production-day range end, future source clock`.

### Task 4: Subscribe-job counters reflect normalisation quarantine (F6)

**Files:**
- Modify: `B/intake/adapters/mqtt/host/subscription-lease.ts` (`countParked` → `countExceptions` returning `{ parked, quarantinedOpen }`), `B/intake/adapters/mqtt/host/subscription-health.ts` (`parkedCount(n)` → `exceptionCounts({ parked, quarantinedOpen })`, counters gain `quarantined_open`), `B/intake/adapters/mqtt/host/mqtt-subscription.ts` (:105 call site)
- Modify: `B/intake/adapters/mqtt/host/subscription-health.spec.ts`, `subscription-lease.spec.ts` (or the lease's existing spec)
- Modify: `F/features/integration-console/mqtt/subscription-status.tsx` (counter rows), `F/features/integration-console/mqtt/model/mqtt-health.ts` (type), `subscription-layout.test.tsx`
- Modify: `server/pro-act-backend/openapi/v2.json` if the health counters are typed in the DTO (`npm run openapi:v2:update`)
- Modify: `docs/PROACT_APPLICATION_GUIDE.md` or `docs/MQTT_INTAKE_DESIGN.md` counters table (one row)

**Interfaces:**
- Produces: `health.counters.quarantined_open` = number of `ingestion_exceptions` rows of the connection with `state = 'open'` whose `error_code` is NOT in `PARKED_CODES` (`subscription-lease.ts:41`), refreshed on heartbeat like `parked`. Existing counters and keys unchanged (`received`, `accepted`, `duplicate`, `stale`, `conflict`, `quarantined`, `parked`).
- UI rows (data-counter keys): `quarantined` label becomes `Rejected at decode`, new row `quarantined_open` label `Quarantined (open)` placed before `Parked (open)`; the e2e `[data-counter=received|accepted]` keys stay.

- [ ] **Step 1: Failing specs**: health tracker snapshot includes `quarantined_open` after `exceptionCounts`; lease spec counts an open `unknown_unit` row as quarantined_open and an open `unknown_code` row as parked.
- [ ] **Step 2: Run** `npx jest src/intake/adapters/mqtt/host` → FAIL.
- [ ] **Step 3: Implement** backend; then the UI rows and `subscription-layout.test.tsx` (counter labels).
- [ ] **Step 4: Run** `npx jest src/intake/adapters/mqtt/host`, `npx vitest run src/features/integration-console/mqtt`, `npm run typecheck` both; `npm run openapi:v2:update` if the snapshot changed; commit `fix(intake): count open normalisation quarantine in the subscribe-job health`.

### Task 5 (controller): repair the 28 Oct day on HDPE-TRAIN, rebuild, re-verify

Done by the controller through the public API with the personas (no SQL writes): `POST /v2/production-periods/55bac376…/revise` as reza `{approvedRevision: 1, reason}` (reopens the certified day, queues a run) → poll `/v2/actuals-jobs/:id` → `GET /v2/production-periods/55bac376…/reconciliation` must show one slice (HD5502, planned 240 / actual 208 from `pla:MARUN-HDPE-20261028`) → submit as sara → approve as reza → certify as reza. Then rebuild backend/worker/frontend images (`docker compose -f docker-compose.yml -f docker-compose.devdb.yml up -d --build --no-deps backend worker frontend` with the dev env), run `npm run migration:run` path through the container, publish one more OT revision of stop `MARUN-HDPE-EXT1-20261028-1905` with `reason_code: ELEC-TRIP` to see the new review item, re-run `e2e/downtime-mqtt-journey.spec.ts` and `e2e/pla-declared-mode.spec.ts`, screenshot the changed pages as the six personas, update `docs/DOWNTIME_MQTT_E2E_REPORT.md` §5 with the outcome per finding, add a `plans/DECISIONS.md` entry, commit.

### Task 6: A recalculation re-resolves the slices of a period that has none (F1, second half)

Found during the repair of 28 Oct: after `revise` the period keeps `state_readiness = 'reconciled'`, so the materializer's `reresolveSliceless` (`B/periods/period-materializer.service.ts:77-104`, filter `state_readiness <> 'reconciled'`) never touches it, and the queued run computes with `slices: []` again (run `8f16a5ee…` of 28 Oct, warning `ambiguous_default_product` unchanged). A reopened or recomputed period must be computed on the current setup.

**Files:**
- Modify: `B/periods/actuals-jobs.service.ts` (`execute`, lines 233-271): after the period is loaded and before the run, when the period has no active slice (`period_product_slices` with `superseded_at IS NULL`), call `SliceResolverService.resolve(manager, [period])` inside a transaction on `this.jobs.manager`, then continue with the run. Inject `SliceResolverService` (same `PeriodsModule`; check `B/periods/periods.module.ts` providers). Extract `private async ensureSlices(period): Promise<void>` to keep `execute` ≤ 40 lines.
- Modify: `T/declared-reconciliation.int-spec.ts`: new test "a recompute re-resolves the slices of a slice-less period" — materialize a day-grain period with two approved profiles and no baseline plan (→ `ambiguous_default_product`, `slices: []`), then approve a `loss_accounting` policy with `accountingProductId`, call `env.recompute`, and assert the reconciliation view has one slice with that product and the period warnings no longer contain `ambiguous_default_product`. Reuse the fixtures of the test at :279-309.
- Modify: `docs/PROACT_APPLICATION_GUIDE.md` (one sentence in the recompute paragraph: a recompute re-resolves the product slices when the period has none).

**Interfaces:**
- Consumes: `SliceResolverService.resolve(manager, periods, options?)` → `string[]` of changed period ids (`B/periods/slice-resolver.service.ts:46`).
- Produces: no API change. Trigger strings unchanged.

- [ ] **Step 1: Failing integration test** as above; run `npm run test:int -- declared-reconciliation` → FAIL (slices still `[]`).
- [ ] **Step 2: Implement** `ensureSlices` + injection.
- [ ] **Step 3: Run** the integration spec, `npx jest src/periods`, `npx tsc --noEmit -p tsconfig.json`; commit `fix(periods): a recompute re-resolves the product slices of a slice-less period`.
