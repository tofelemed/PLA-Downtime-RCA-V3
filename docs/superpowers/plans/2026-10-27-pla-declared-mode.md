# Implementation plan: declared mode (independent, daily, OT-declared PLA)

**Spec:** `docs/PLA_DECLARED_MODE_PLAN.md` (design) + `plans/DECISIONS.md` entry "2026-10-27 — Independent, daily, OT-declared production loss accounting" (D1–D12). The spec is the binding authority.
**Background reading for implementers (only the sections named in each task):** `docs/PLA_END_TO_END_ANALYSIS.md`, `docs/MQTT_FEEDS_PAYLOADS.md`, `plans/MQTT_FEEDS.md`.
**Branch:** `feat/downtime-area2-b`. Baseline commit `ae388813`.

Paths: `B` = `server/pro-act-backend/src`, `F` = `src` (frontend), `T` = `server/pro-act-backend/test`.

## Global Constraints

Binding for every task (from `CLAUDE.md`, `plans/ENGINEERING_STANDARDS.md`, the spec):

1. **Project name:** Traverse Forge in every user-facing text and doc (never "ProAct").
2. **Sizes:** files ≤ 400 lines (hard stop 500), functions ≤ 40 lines / ≤ 4 params, React components ≤ 150 lines; split by responsibility; existing oversized files (`EventHub.tsx`, `PlanDashboard.tsx`, `RCAModule.tsx`) must not grow.
3. **TypeScript strict, no `any`** (use `unknown` and narrow); named exports; kebab-case files; no `console.log`; no commented-out code; no unused imports.
4. **Backend layering:** controller → service → repository; tenant/scope from `RequestContext` (`@Ctx()`), never a query param; v2 queries start with `scopedQuery()`. DTOs validated at the boundary; the global `ValidationPipe` is `whitelist + forbidNonWhitelisted`, so DTOs and frontend payloads must match exactly.
5. **Database:** Postgres column types only (`varchar`, `text`, `timestamptz`, `boolean`, `numeric`, `jsonb`); every schema change is a migration in `B/database/migrations` with a working `down()`; follow `B/database/MIGRATIONS.md` (RLS policy for new tenant tables, enum values via `ALTER TYPE … ADD VALUE` in their own migration, never edit an applied migration). Naming `<timestamp>-<PascalName>.ts`, timestamps after `1794241101000`.
6. **Time:** UTC `timestamptz`, half-open intervals `[start, end)`, durations in seconds, display in the plant timezone.
7. **Tests:** add or update tests for new logic (fixtures for maths in `T/fixtures`, `*.spec.ts` beside the source for units, `T/integration/*.int-spec.ts` for queries). Integration tests run only with `npm run test:int` (throwaway `proact-test-postgres`, 127.0.0.1:5434) — never against `proact-postgres`. Run tests by folder / a few suites at a time, never the whole suite at once. Run lint + typecheck for the touched project before committing.
8. **Contracts:** any route / DTO / response change is flagged in the report and the OpenAPI snapshot is updated (`npm run openapi:v2:update` in `server/pro-act-backend`, then `npm run api:types` at the repo root to regenerate `F/api/v2/schema.d.ts`).
9. **No fabricated data in product code** (no demo defaults, no `Math.random`); business numbers are computed on the server only; no writes on page render.
10. **Don'ts:** no new dependencies; don't edit `.env*`, applied migrations, `F/components/ui/*`, `node_modules`; don't touch `F/services/StorageService.ts`.
11. **Commits:** one or more commits per task on the current branch, message in the repo's `type(scope): subject` style, ending with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push.
12. **Declared-mode semantics (spec §4):** loss lines in declared mode = `shortfall × reason share`, `basis = 'declared'`, kind = the reason code's OEE component (none → `unaccounted_classified`); uncoded share stays unaccounted; stops produce **no** loss lines; target = OT planned when `targetSource = 'declared'`, else the plan target; actual = OT actual; gap = target − actual, signed, never clamped; capacity ledger not computed (flag `capacity_not_applicable`).
13. **Shared types introduced by this plan** (every task uses exactly these names):

```ts
// B/periods/loss-accounting-policy.ts (Task 1)
export type LossGrain = 'shift' | 'day';
export type LossBasis = 'computed' | 'declared';
export type LossTargetSource = 'plan' | 'declared';
export interface LossAccountingPolicy {
  grain: LossGrain;
  dayStart: string;              // 'HH:mm' plant-local; used when grain = 'day'
  lossBasis: LossBasis;
  targetSource: LossTargetSource;
  accountingUnitId: string | null;
  stopsCrossCheck: boolean;
  identityTolerance: number;     // ≥ 0, in the event's uom
}
export const LOSS_ACCOUNTING_DEFAULT: LossAccountingPolicy = {
  grain: 'shift', dayStart: '06:00', lossBasis: 'computed', targetSource: 'plan',
  accountingUnitId: null, stopsCrossCheck: true, identityTolerance: 0,
};

// B/domain/events/declared-figures.ts (Task 3)
export interface DeclaredFigures {
  planned: number | null;
  actual: number | null;
  shortfall: number;
  uom: string;                                  // 't' by default
  measurementQuality: string | null;
  sourceStatus: string | null;                  // OT status, e.g. 'DETECTED' | 'CONFIRMED'
  plan: { source: string | null; planId: string | null; revision: number | null; approved: boolean | null } | null;
  piSource: { actualTag: string | null; eventFrameId: string | null } | null;
}
export const DECLARED_CONFIRMED_STATUS = 'CONFIRMED';
```

New enum values: `production_event_physical_type` + `'production_loss'`; `accounting_policy_kind` + `'loss_accounting'`; `event_review_item_kind` + `'declared_identity_mismatch' | 'declared_window_mismatch' | 'duplicate_declared_loss'`; `loss_line_basis` already has `'declared'`.
New accounting flags: `declared_loss_missing`, `declared_identity_mismatch`, `declared_window_mismatch`, `capacity_not_applicable`, `stops_cross_check`.
New submission gate codes: `DECLARED_LOSS_MISSING`, `DECLARED_IDENTITY_MISMATCH`, `LOSS_EVENT_UNCODED`; approval precondition code `DECLARED_NOT_CONFIRMED`.

---

## Task 1: `loss_accounting` policy kind (backend domain + resolution)

**Files:** `B/periods/entities/accounting-policy.entity.ts` (`POLICY_KINDS`), new `B/periods/loss-accounting-policy.ts` (types above, `LOSS_ACCOUNTING_DEFAULT`, `parseLossAccounting(body: unknown): LossAccountingPolicy` throwing `PolicyBodyError` like `parseOeePolicy` in `B/periods/engine-policy-bodies.ts`), `B/periods/accounting-policies.service.ts` (`DEFAULT_BODIES` + `resolveEngine` returns `EnginePolicies.lossAccounting: LossAccountingPolicy` and its ref; `seedDefault` seeds it), `B/periods/policy-bodies-in-force.ts` if it dispatches per kind, contract default JSON under `contracts/policies/defaults/loss_accounting.default.json` if that folder's spec (`policy-bodies.spec.ts`) requires one, migration `B/database/migrations/<ts>-LossAccountingPolicyKind.ts` (add enum value; `down()` uses `dropPolicyKind` from `B/database/policy-kind-enum.ts`; a second migration or the same one's second statement seeds one approved tenant-wide version 1 of `LOSS_ACCOUNTING_DEFAULT` for every existing tenant, effective from `'2020-01-01'`).

**Rules:** `parseLossAccounting` rejects: unknown fields, `dayStart` not `HH:mm`, negative tolerance, `lossBasis = 'declared'` with `grain = 'shift'`? — **allowed** (declared per shift is valid if OT sends per-shift events); `targetSource = 'declared'` with `lossBasis = 'computed'` → reject (`targetSource` only matters in declared mode; the parser normalizes it to `'plan'` when computed — decide: normalize, don't reject). `accountingUnitId` must be a uuid string or null.

**Tests:** `B/periods/loss-accounting-policy.spec.ts` (parse: defaults, each rejection, normalization); extend `accounting-policies.service` unit coverage if a spec exists; `T/integration/migrations.int-spec.ts` must still pass (`npm run test:int -- migrations`).

**Done when:** `npx jest src/periods` green, `npx tsc --noEmit -p tsconfig.json` clean, lint clean, migration round-trips.

## Task 2: `v2/loss-accounting` maker-checker API + daily calendar on approval

**Pattern to copy:** `B/v2/source-authority/*` (controller, dto, service, decisions service, roles). New folder `B/v2/loss-accounting/`: `loss-accounting-v2.controller.ts` (`GET /v2/loss-accounting?unitId=` current in force, `GET /versions`, `POST /versions` draft, `GET /versions/:id`, `POST /versions/:id/approve`, `POST /versions/:id/reject`), `loss-accounting-v2.dto.ts` (`LossAccountingVersionDto extends CommissioningBackdateDto` with the seven policy fields validated by class-validator + `unitId?` + `notes?`), `loss-accounting-v2.service.ts` (draft via `parseLossAccounting`, 422 `INVALID_POLICY`), reuse `SourceAuthorityDecisionsService` if it is kind-agnostic, else `loss-accounting-decisions.service.ts` with the same STALE_DRAFT / separation-of-duties rules. Roles: writers = `SOURCE_AUTHORITY_WRITERS` ∪ `['admin']`, approvers = `SOURCE_AUTHORITY_APPROVERS` ∪ `['manager_approver']` in a new `loss-accounting-roles.ts`. Register in the module that registers the source-authority controller. Add the routes to the route-guard allowlist test if it enumerates protected routes.

**On approval** (in the decisions service, same transaction): when the approved body has `grain = 'day'`: create and publish a calendar version through `CalendarVersionsService.create` + `CalendarPublishService.publish` (`B/calendar/*`) — scope: the policy's unit (`accountingUnitId` or `unitId`) as a unit override when set, else the site calendar of the tenant's default site; content: timezone = site/tenant timezone, `operationalDayStart = dayStart`, `shiftTemplates: [{ name: 'Day', startLocal: dayStart, endLocal: dayStart }]`, `effectiveFrom` = the policy's effective date (local date), `effectiveTo: null`; publish with `reason: 'loss_accounting policy v<N>'` and `regenerateFrom` = effectiveFrom. Skip calendar creation when a published calendar already yields one 24 h leaf per day for that scope from that date (compare the in-force version's templates). Period materialization follows the existing publish path. When `grain = 'shift'` nothing is published.

**Tests:** `T/integration/loss-accounting-policy.int-spec.ts` copying `source-authority-maker-checker.int-spec.ts` style: draft → approve by another user → version in force; approve with `grain = 'day'` → a published calendar version with one template and `shift_instances` of 24 h exist from the effective date; separation of duties refused; invalid body 422.

**Contract change:** yes → update the OpenAPI snapshot in this task (`npm run openapi:v2:update`), and run `npm run api:types` at the root.

## Task 3: `production_loss` event kind (model, validity, reason split by tonnes, DTOs)

**Migrations:** `<ts>-ProductionLossEventKind.ts` (enum value `production_loss` on `production_event_physical_type`; enum values on `event_review_item_kind`), `<ts>-ProductionEventDeclaredFigures.ts` (`production_events.declared_figures jsonb NULL`; partial index `IDX_production_events_declared (tenant_id, unit_id, start_time) WHERE physical_type = 'production_loss' AND retracted_at IS NULL`).

**Domain:** `B/domain/events/event-classification.ts` (`PHYSICAL_TYPES` + `'production_loss'`; it classifies as `impact_mode = 'measured'`, `oee_component = 'none'`, `schedule_class = 'unknown'`); new `B/domain/events/declared-figures.ts` (type above + `parseDeclaredFigures(raw: unknown): DeclaredFigures | null` + `declaredIdentityGap(f): number` = `planned − actual − shortfall` when planned and actual are present, else `0`); `B/domain/events/reason-weights.ts`: `ReasonWeightEntry` gains `quantity?: string | number | null`; basis `'quantity'` needs `context.quantity: number | null` (the event quantity) and the total must match within `max(0.001, quantity × 1e-6)`; error messages in the same style ("The tonnes add up to X t, not the event's Y t"). `B/production-event/production-event.entity.ts`: `declaredFigures: DeclaredFigures | null` (jsonb); `B/production-event/revisions/event-facts.ts`: `declaredFigures` is a source-owned fact; `B/production-event/event-write-model.ts`: defaults for the new type (`impactMode = 'measured'`, `physicalState = 'closed'` when `endTime` set — a production loss event must have an end), validity: `quantity` required and `= declaredFigures.shortfall`; `declaredFigures` required for `production_loss`; `Close`, `Split`, `Merge` commands refuse `production_loss` with 409 `UNSUPPORTED_FOR_KIND` (in `B/event-operations/*`).

**Review items** (raised in `B/production-event/revisions/source-revision.ts` and on manual create, same inline style as `openConflicts`): `declared_identity_mismatch` when `|declaredIdentityGap| > tolerance` (tolerance comes from the in-force `loss_accounting` policy via `AccountingPoliciesService.resolveEngine`), `duplicate_declared_loss` when another non-retracted `production_loss` event of the unit overlaps the window, `declared_window_mismatch` when no `production_periods` row of the unit has exactly `[start_time, end_time)`. Re-sync that fixes the identity resolves the open item as `accepted_source`. `ResolveReviewItemDto.decision` gains `'dismiss'` allowed only for the three new kinds (state `dismissed`).

**API:** `B/v2/production-events/production-event-v2-write.dto.ts` (`physicalType` enum, `declaredFigures?: DeclaredFiguresDto` with nested validation, reason weight `quantity`), read view adds `declaredFigures`, list query filter `physicalType` accepts the new value, export columns `Planned`, `Actual`, `Shortfall`, `OT status`. `B/periods/period-recalc.consumer.ts` `RECALCULATING_TYPES` + `production_loss`. Frontend untouched in this task.

**Tests:** `reason-weights.spec.ts` (quantity basis), `event-classification.spec.ts`, `declared-figures.spec.ts`, `event-write-model.spec.ts` cases for the new kind, `T/integration/production-loss-event.int-spec.ts` (create manual event; identity mismatch → review item; duplicate → review item; close/split refused; PATCH reason split by tonnes → `reason_weights` normalized; recalc message enqueued).

**Contract change:** yes → OpenAPI snapshot + `npm run api:types`.

## Task 4: PLA feed → production loss event (ingest)

**Files:** `B/intake/adapters/mqtt/feeds/feed-templates.ts` (`PLA_FIELDS` adds optional `planSource: 'plan.source'`, `planId: 'plan.plan_id'`, `planRevision: 'plan.revision'`, `planApproved: 'plan.approved'`, `piActualTag: 'pi_source.actual_tag'`, `piEventFrameId: 'pi_source.event_frame_id'`; `DOWNTIME_FIELDS` drops `lostQuantity` (D11) — keep reading it if mapped by an old profile but never emit it), `B/intake/adapters/mqtt/profiles/feeds.decoder.ts` (`plaParts` emits `kind: 'interval_event'`, `values: { templateName: 'Production Loss Declared', attributes: [...] }` with attributes Planned, Actual, Shortfall (number, unit `t`), MeasurementQuality, Status, PlanSource, PlanId, PlanRevision, PlanApproved, PiActualTag, PiEventFrameId; `startTime/endTime` = period window; `controls.feed = 'pla'`, `controls.report` removed; `unitId` = feed unit), `B/intake/adapters/mqtt/handlers/mqtt-pla-feed.handler.ts` (supports `interval_event` + feed `pla`; builds `DeclaredFigures` from the attributes; places on the feed's `unitId` (required; else quarantine `mapping_invalid_target` "PLA feed has no unit"); creates or revises the `production_loss` event through the same lifecycle / `EventRevisionService.applySourceRevision` path the downtime handler uses, with `physicalType: 'production_loss'`, `quantity = shortfall`, `quantityUom`, `declaredFigures`, `eventId = 'pla:' + event_id`, source revision = `event_revision`; a message without shortfall → quarantine `schema_invalid`), `B/intake/adapters/mqtt/handlers/mqtt-interval-event.handler.ts` (`supports()` also excludes feed `'pla'`), `B/v2/intake/mqtt-preview-v2.service.ts` (`feedFacts.declared` with the figures and `identityGap`; `bindingStatus` value `production_loss_event` replaces `pla_report`), `B/intake/adapters/mqtt/feeds/feeds.spec.ts`, `T/integration/mqtt-feeds.int-spec.ts` (the PLA case now asserts a `production_loss` event with `declared_figures`, revision 2 replaces figures, coding survives revision).
**Retire** the external-report write for the PLA feed (D9): the handler no longer calls `ExternalReportsService.importOne`; keep the service and endpoint for other sources; `docs/MQTT_FEEDS_PAYLOADS.md` PLA section rewritten: "PLA = one production loss event per unit per day; Traverse Forge shows it in the Event Hub for coding", field table updated (`plan.*`, `pi_source.*` optional; identity rule; status rule D8), downtime section drops `lost_production_t`.

**Tests:** feeds unit spec + the integration spec above (`npm run test:int -- mqtt-feeds`).

## Task 5: Declared ledger in the accounting engine

**Inputs:** `B/accounting/loss-event-rows.ts` loads `production_loss` events too (with `declared_figures`, `reason_weights`, `reason_code_id`, `investigation_pending`); `LossEvent` (`B/domain/accounting/accounting.types.ts`) gains `declaredFigures?: DeclaredFigures | null`; `B/accounting/accounting-inputs.loader.ts` adds `reasonComponents: Record<string, 'availability' | 'performance' | 'quality' | null>` for every reason id referenced by the period's events (from the reason code's default OEE component — see `B/code-library/classification-basis.ts` for where it lives); `EnginePolicy` gains `lossBasis`, `targetSource`, `stopsCrossCheck`, `identityTolerance` (from `EnginePolicies.lossAccounting`, wired in `engineInput()` of `B/accounting/accounting-run.service.ts`).

**Engine:** new `B/domain/accounting/declared-ledger.ts` exporting `computeDeclaredAccounting(given: PeriodAccountingInput): PeriodAccounting`, selected by `computePeriodAccounting` when `policy.lossBasis === 'declared'`. Per spec §4.4 and Global Constraint 12: pick the period's single `production_loss` event (window equal to the period; a second one → flag `duplicate_declared_loss` and use the earliest `start_time` / lowest id); target per `targetSource`; actual = declared actual; gap; candidate lines basis `declared`, `cause_event_id`, evidence `{ share, declaredShortfall }`; no lines for stops / slowdowns / quality events; residual per the plan identity (`plan-totals.ts` reused); flags `declared_loss_missing` (no event → residual = gap when a target exists), `declared_identity_mismatch` (|planned − actual − shortfall| > tolerance), `capacity_not_applicable`; with `stopsCrossCheck` compute `stopsAtPlannedRate` = Σ clipped full-stop seconds × planning rate (reuse `time-lines.ts`) and put it in the slice's `flags`/`warnings` payload as `{ stops_cross_check: { quantity, uom } }` — it never becomes a line. Quality / capacity totals absent (zero) with the flag. One slice per period in declared mode (D4): if the slice resolver produced more than one, use the first and flag `declared_single_slice`.

**Persistence:** `B/accounting/accounting-persistence.ts` writes the declared lines unchanged (basis `declared` exists); ledger totals rows for the plan ledger only.

**Tests (fixtures, `T/fixtures/declared-accounting.spec.ts` + JSON fixtures `D01…D08.json`):** single reason; split 20/12 by tonnes; uncoded (0 lines, residual = gap, `unaccounted`); identity mismatch ±; missing event; `targetSource = 'plan'`; stops present but no lines; cross-check figure present. Engine version bumps to `2.9.0` in `period-accounting.ts`.

## Task 6: Gates, approval and conservation for declared mode

**Files:** `B/domain/reconciliation/submission-gates.ts` (+ `DECLARED_LOSS_MISSING`, `DECLARED_IDENTITY_MISMATCH` from the run flags), `B/domain/reconciliation/coding-gate.ts` + `B/reconciliation/coding-gate.loader.ts` (declared variant: the gate counts the period's `production_loss` events; `LOSS_EVENT_UNCODED` when it has neither a reason nor investigation pending; coded ratio = coded share of the shortfall; the `warn`/`block` mode and thresholds of the existing `submitGate`/`dayGate` apply; stops are not counted in declared mode), `B/reconciliation/submission-environment.ts` (`ACTUALS_INCOMPLETE` not raised in declared mode when the event exists), `B/reconciliation/approval.service.ts` (new precondition after separation of duties: in declared mode the event's `declaredFigures.sourceStatus` must equal `DECLARED_CONFIRMED_STATUS`, else 409 `DECLARED_NOT_CONFIRMED` — D8), `B/domain/reconciliation/event-conservation.ts` (manual lines citing a `production_loss` event ≤ its shortfall), `B/domain/close/day-coding-gate.ts` (declared variant, same rule), the submit/approve error catalogue the frontend reads (search `RESIDUAL_UNEXPLAINED` for the list).

**Tests:** unit specs beside each file; `T/integration/declared-reconciliation.int-spec.ts` built on `ReconciliationWorld`: declared policy in force → event uncoded → submit warns/blocks per mode → code → submit ok → approve refused while `DETECTED` → revision 2 `CONFIRMED` → approve ok.

## Task 7: OpenAPI snapshot and frontend API layer

Run `npm run openapi:v2:update` (backend) and `npm run api:types` (root); verify `npm run api:types:check`. Add `F/api/v2/types/loss-accounting.ts` + `F/api/v2/queries/loss-accounting.ts` (`useLossAccountingInForce(unitId?)`, `useLossAccountingVersions(unitId?)`, `useDraftLossAccountingVersion()`, `useDecideLossAccountingVersion()`, modeled on `F/api/v2/queries/source-authority.ts`), and extend the production-event types/queries (`F/api/v2/types/events.ts`, `F/features/event-hub/model/*`) with `declaredFigures` and the `quantity` reason-weight basis. A shared hook `F/features/accounting-mode/use-loss-accounting-mode.ts` returning `{ grain, lossBasis, targetSource, accountingUnitId, isDeclared, isDay }` for the acting plant (TanStack Query, 5-minute stale time) that Tasks 8–10 use.

**Tests:** vitest for the hook (mocked client) and the query key shapes.

## Task 8: Plant settings — "Loss accounting" card

**Files:** `F/features/settings/settings-page.tsx` (new `AdminCard` "Loss accounting", testId `plant-loss-accounting`, after "Reporting week"), new `F/features/settings/loss-accounting/` (`loss-accounting-card.tsx` ≤ 150 lines, `loss-accounting-form.tsx` with fields Grain (Shift / Day), Day start (time, shown for Day), Loss basis (Computed from measurements and stops / Declared by the OT production loss event), Target (Traverse Forge plan / OT planned figure, shown for Declared), Accounting unit (unit select, shown for Declared), Stops cross-check (switch), Identity tolerance (number, t), Effective from (date) + backdate reason fields copied from the source-authority editor, `loss-accounting-versions.tsx` list with Approve / Reject for approvers), ⓘ texts in plain words: what changes from the effective date (one period per day, loss = OT's declared shortfall coded in the Event Hub, stops no longer price the loss, OEE not available). Capabilities: writers see the form, approvers the decisions (reuse the source-authority capability names or add `canEditLossAccounting` / `canApproveLossAccounting` in `F/features/auth/capabilities.ts` mapped to the Task 2 roles).

**Tests:** `loss-accounting-card.test.tsx` (render in force, draft submit payload exactly matches `LossAccountingVersionDto`, approver sees decisions). Check the card as admin and reza (manager_approver) on screen if a dev server is running; otherwise note it for Task 12.

## Task 9: Event Hub — production loss events

**Files:** `F/features/ux-kit/labels/event-labels.ts` (label "Production loss"), `F/features/event-hub/model/event-filters.ts` (`PHYSICAL_TYPES` + `production_loss`; "To code" quick filter includes uncoded `production_loss` events in declared mode — the filter takes `physicalTypes: ['downtime', 'production_loss']`), `components/event-columns.tsx` (when `isDeclared`: columns "Planned", "Actual", "Lost" (t) from `declaredFigures`; Duration cell shows the local date for a 24 h event), quick stats (a "Production loss to code" stat in declared mode), `components/event-summary.tsx` (Planned, Actual, Shortfall, Measurement quality, OT status, OT plan id / revision), `components/code-event-dialog.tsx` + `reason-split-section.tsx` (for `production_loss`: split by Percent or Tonnes; text "The tonnes must add up to the day's shortfall (N t)"), `components/event-detail-actions.tsx` (hide Close stop / Split / Merge for `production_loss`; Edit / code and Retract stay), `components/event-form-fields.tsx` + new `components/declared-fields.tsx` (type "Production loss": Planned, Actual, Shortfall, Status — manual events, D7; client-side hint when planned − actual ≠ shortfall, server decides), `components/selection-toolbar.tsx` (Merge disabled when a selected event is `production_loss`), `hooks/use-code-and-close.ts` payload with `quantity` entries. Review items of the new kinds show in the existing "Source conflicts" tab with a Dismiss action (decision `dismiss`).

**Tests:** vitest for columns (declared columns appear only in declared mode), split section (tonnes validation), form (type-specific fields), actions visibility.

## Task 10: Period pages, analytics and integration console in declared mode

**Files:** `F/features/plan-dashboard/components/period-grid-columns.tsx` (Period = date only when `isDay`; Inputs "Declared (OT)" when `isDeclared`), `F/features/plan-dashboard/components/period-grid.tsx` note text per mode, period page `reconciliation-summary.tsx` / `editor/candidate-row.tsx` / `editor/candidate-derivation.tsx` (label "Declared · from production loss event"; derivation rows: Shortfall, Share, Quantity — no rate rows; a "Stops cross-check" line when the slice carries `stops_cross_check`), `coding/coding-gate-panel.tsx` (declared texts: "Production loss coding complete / incomplete", "The day's loss event has no reason", button "Verify this day's loss coding"), `day/certify-day-button.tsx` (one-period wording), `F/features/pla-analytics/**` (OEE tab, Capacity gap tab and the waterfall's "Sustained capacity" step hidden with the note "Not available: this plant accounts declared losses"; dashboard tiles unchanged), `F/features/pla-analytics/tabs/loss-events.tsx` (includes production loss events), `F/features/integration-console/mqtt/model/feed-templates.ts` + `feed-examples.ts` (PLA fields incl. `plan.*` / `pi_source.*`, downtime without `lost_production_t`; help texts: "Becomes a production loss event in the Event Hub"), `preview-figures.ts` (reads `feedFacts.declared`), `pla-reports-tab.tsx` → replace with a "Production loss events" tab that links to the Event Hub filtered on `production_loss` for the feed's unit (`mqtt-connection-panel.tsx`), `model/endpoint-summary.ts` unchanged. Gate / error code labels for `DECLARED_LOSS_MISSING`, `DECLARED_IDENTITY_MISMATCH`, `LOSS_EVENT_UNCODED`, `DECLARED_NOT_CONFIRMED` in the workflow label map (`F/features/ux-kit/labels/workflow-labels.ts` or where `RESIDUAL_UNEXPLAINED` is labelled).

**Tests:** vitest for the grid columns, candidate derivation, gate panel texts, analytics hiding, feed templates; `npm run typecheck`, `npm run lint`.

## Task 11: Docs and glossary

`docs/PROACT_APPLICATION_GUIDE.md` (§4 event kinds + production loss; §5 "Declared basis" subsection; §6 approval precondition; plant settings), `docs/GLOSSARY.md` (Declared loss, Production loss event, Loss accounting policy), `plans/MQTT_FEEDS.md` (PLA contract = event), `docs/PLA_DOWNTIME_CURRENT_MODEL.md` and `docs/PLA_END_TO_END_ANALYSIS.md` get a one-paragraph "Implemented on 27 Oct 2026" note at the top pointing to the policy, `docs/INTEGRATION_ANALYSIS.md` update note, `plans/README.md` checklist entry. Plain language, Traverse Forge naming. No code.

## Task 12: End-to-end on HDPE with the OT sample payload

Rebuild and restart the Compose backend and worker with the devdb override (`docker compose -f docker-compose.yml -f docker-compose.devdb.yml up -d --build --no-deps backend worker` with `DEV_DB_PASSWORD`, `DEV_JWT_SECRET`, `DEV_CREDENTIAL_ENCRYPTION_KEY`, `DEV_DB_HOST=proact-postgres` exported from `server/pro-act-backend/.env`), confirm migrations applied (`GET /api/health`), then on the HDPE plant (tenant `433c1a69-7a32-4b32-ab20-c4139423abd2`, admin `admin@hdpe-train.mpc`, password in the dispatch):
1. Draft and approve a `loss_accounting` version: `grain: day`, `dayStart: '00:00'`, `lossBasis: declared`, `targetSource: declared`, `accountingUnitId` = Extruder1 (`da0560f4-2916-450d-9d30-4012e86fa17e`), effective from `2026-10-25` (backdate with reason), approver ≠ drafter (use `reza@hdpe-train.mpc` as approver). Verify one period per day for Extruder1 from 2026-10-25 (periods A/B/C before that untouched).
2. Publish the OT sample payload exactly as given in the spec §1 on the existing feeds connection "Marun OT feeds (UI e2e)" (connection `f334beca-ca4f-4310-b87f-116d84e07740`, broker container `proact-mqtt-1`, port 1885, user `proact-sim` / `proact-sim-dev`, topic `proact/marun/hdpe/pla`) with `event_id: 'MARUN-HDPE-20261025'`, revision 1, status `DETECTED`; then revision 2 with status `CONFIRMED` and the same figures.
3. Verify in the DB and UI: a `production_loss` event on Extruder1, 2026-10-25 00:00–24:00 +03:30, quantity 32, declared figures 240/208/32; it appears in the Event Hub with Planned / Actual / Lost columns; code it as `omid@hdpe-train.mpc` (operator): split 20 t `MECH-GEARBOX` + 12 t to a second existing reason; the period for 2026-10-25 shows target 240, actual 208, gap 32, attributed 32, unaccounted 0, two declared lines; publish a downtime message that day and confirm no stop loss line appears (cross-check figure visible); submit as `sara@hdpe-train.mpc` (production engineer) and approve as reza; `DECLARED_NOT_CONFIRMED` was refused before revision 2 (test by approving between step 2's revisions, or re-run with a separate event id).
4. Check the plant settings card, Event Hub, period page and PLA analytics as admin, reza, omid, sara, leila, farid — note what each role sees.
5. Write a Playwright spec `e2e/pla-declared-mode.spec.ts` covering steps 1–3 through the UI where possible (policy card → MQTT publish via the sample-publish helper or API → Event Hub coding → period approve), using the `e2e/personas/support` helpers; it must be skippable when the broker is absent.
Report every command and result verbatim; leave the test data in place (owner decides cleanup).

## Task 13: Loss accounting statement (owner requirement, 27 Oct 2026)

**Why:** the owner's main requirement is to see the accounting of a period as a statement, exactly in this shape, wherever a period's figures are shown:

| Accounting result | t |
|---|---|
| Planned production | 240 |
| Actual good production | 208 |
| Production shortfall | 32 |
| Equipment downtime loss (availability) | 23 |
| Reduced throughput loss (performance) | 11 |
| Quality loss | 6 |
| Gross attributed loss | 40 |
| Verified recovery | −8 |
| Net accounted loss | 32 |
| Unaccounted loss | 0 |

Identity: `Shortfall = Net accounted + Tolerance adj. + Unaccounted`, `Net accounted = Gross attributed − Verified recovery`, `Gross attributed = availability + performance + quality (+ transition excess, unaccounted_classified)`. These are the existing plan-ledger totals (`period_ledger_totals`: target, actual, gap, availability_qty, performance_qty, quality_qty, gain_qty, attributed_qty, residual_qty) — nothing new is computed in the browser.

**Backend**
1. Confirm the period accounting / summary views (`GET /v2/production-periods/:id/accounting`, `/reconciliation`, `/period-summaries`, `/production-days/:unit/:date`) expose the plan-ledger totals per slice and per period: `target`, `actual`, `gap`, `availability`, `performance`, `quality`, `transitionExcess`, `unaccountedClassified`, `grossAttributed` (= Σ loss kinds), `gain` (verified recovery), `attributed` (net), `toleranceAdjustment`, `residual`. Add the missing ones to the view (server-side sums), the day view aggregating its periods (approved revision when it exists, else current, with the Provisional marker rule). Contract change → OpenAPI + `npm run api:types`.
2. **Declared mode recovery share:** a split entry may be marked `recovery: true` (reason code of any kind; the entry's tonnes/percent is a recovery). Validation: Σ loss shares − Σ recovery shares = shortfall (same tolerance); percent mode: loss percents − recovery percents = 100. The engine books each recovery share as a `gain` line (`basis = 'declared'`, `cause_event_id` = the event, reason = the entry's reason) so `Gross attributed = Σ loss shares`, `Verified recovery = Σ recovery shares`, `Net = shortfall`. `reason_weights` entries gain `recovery?: boolean`; conservation and the duplicate/identity logic unchanged. Fixture: 23 + 11 + 6 − 8 = 32 → availability 23, performance 11, quality 6, gain 8, attributed 32, residual 0.
3. Verification: a recovery share counts as "verified" only when the event's coding is verified by a supervisor (existing Verify coding); until then the statement labels the row "Recovery (unverified)" — the figures do not change, only the label (view field `recoveryVerified`).

**Frontend** — new `src/features/plan-dashboard/components/loss-accounting-statement.tsx` (≤ 150 lines, pure presentation; model in `model/loss-accounting-statement.ts` with tests) rendering the table above with the plant number formatter, Provisional/Approved marker, a ⓘ per row in plain words, and the identity line under it. Shown:
- on the period page above the loss lines (replacing the current Target/Actual/Gap/Attributed/Tolerance/Unaccounted strip, which becomes the statement; keep the "Checks" row and the stops cross-check line),
- on the day view (Review & close / day certification panel) for the day,
- on the production-loss event page as the day's statement (card "Day accounting"), linking to the period,
- in the period grid a compact variant is NOT needed (the grid keeps its columns).
- Code dialog / reason split: an entry can be toggled "Recovery"; live text: "Losses 40.000 t − recovery 8.000 t = 32.000 t ✓" or the remaining amount; percent mode likewise.
- Event detail Summary: the reason list shows recovery entries as "Recovery · <reason> · 8 t".

**Tests:** fixtures for the recovery split; int-spec on the view fields; vitest for the statement model (all rows, zero rows, provisional/approved), the dialog validation with recovery, and the event-page card. Docs: guide §5 gets the statement and the identity; GLOSSARY: Gross attributed loss, Verified recovery, Net accounted loss.
