import { EntityManager, In, IsNull } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { LossLine } from '../accounting/entities/loss-line.entity';
import { PeriodLedgerTotal } from '../accounting/entities/period-ledger-total.entity';
import { Dec, toDec } from '../domain/actuals/decimal';
import { reconcile } from '../domain/reconciliation/reconcile';
import {
  Candidate,
  DecisionLine,
  Reconciliation,
  SliceBasis,
  ToleranceRule,
} from '../domain/reconciliation/reconciliation.types';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { ActualsResult } from '../periods/entities/actuals-result.entity';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import {
  parseReconciliationTolerance,
  ReconciliationTolerance,
} from '../periods/engine-policy-bodies';
import { ReconciliationLineSet } from './entities/reconciliation-line-set.entity';
import { ReconciliationLine } from './entities/reconciliation-line.entity';

/** Plan-ledger kinds of automatic candidates (residual lines are recomputed, never decided on). */
const CANDIDATE_KINDS = ['availability', 'performance', 'quality'] as const;

export interface TolerancePolicy {
  policyId: string | null;
  version: number | null;
  body: ReconciliationTolerance;
  rule: ToleranceRule;
}

/** Everything the editor, the workflow and the snapshot read about one revision. */
export interface RevisionState {
  period: ProductionPeriod;
  revision: AccountingRevision;
  run: CalculationRun | null;
  candidateLines: LossLine[];
  totals: PeriodLedgerTotal[];
  actuals: ActualsResult[];
  lineSet: ReconciliationLineSet | null;
  lines: ReconciliationLine[];
  /** active product slices of the period (profile and window: valuation of manual lines, plan 2.6) */
  slices: PeriodProductSlice[];
  tolerance: TolerancePolicy;
  reconciliation: Reconciliation;
  /** SME V4: closed intervals (epoch ms) of the events manual downtime lines cite */
  eventSpans: ReadonlyMap<string, { from: number; to: number }>;
}

/** Decimal from a stored numeric (string, or number when the pg type parser converted it). */
export function decOf(value: string | number | null): Dec | null {
  return toDec(value);
}

export function candidatesOf(lines: readonly LossLine[]): Candidate[] {
  return lines.map((line) => ({
    autoKey: line.autoKey ?? line.id,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: decOf(line.quantity) ?? new Dec(0),
  }));
}

export function decisionLinesOf(
  lines: readonly ReconciliationLine[],
): DecisionLine[] {
  return lines.map((line) => ({
    action: line.action,
    autoKey: line.autoKey,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: decOf(line.quantity),
    baseQuantity: decOf(line.baseQuantity),
    missingCode: line.missingCode,
  }));
}

/** Capacity-ledger flags the plan workflow must see (LA-02b: claims beyond the measured component). */
const CAPACITY_FLAGS_FOR_PLAN = ['claim_exceeds_component'];

export function slicesOf(totals: readonly PeriodLedgerTotal[]): SliceBasis[] {
  const capacityFlags = new Map(
    totals
      .filter((t) => t.ledger === 'capacity')
      .map((t) => [
        t.sliceId,
        t.flags.filter((f) => CAPACITY_FLAGS_FOR_PLAN.includes(f)),
      ]),
  );
  return totals
    .filter((t) => t.ledger === 'plan')
    .map((t) => ({
      sliceId: t.sliceId,
      uom: t.uom,
      target: decOf(t.targetQty),
      actual: decOf(t.actualQty),
      flags: [...t.flags, ...(capacityFlags.get(t.sliceId) ?? [])],
    }));
}

export function ruleOf(body: ReconciliationTolerance): ToleranceRule {
  return {
    mode: body.mode,
    value: new Dec(body.value),
    epsilon: new Dec(body.epsilon),
    allowUnaccountedClassification: body.allowUnaccountedClassification,
    ...(body.unaccountedTargetOfShortfall === null
      ? {}
      : { unaccountedTarget: new Dec(body.unaccountedTargetOfShortfall) }),
  };
}

/** Re-runs the arithmetic for other lines (draft save, submit) on the same run and policy. */
export function reconcileWith(
  state: RevisionState,
  lines: readonly DecisionLine[],
): Reconciliation {
  return reconcile({
    candidates: candidatesOf(state.candidateLines),
    lines,
    slices: slicesOf(state.totals),
    rule: state.tolerance.rule,
  });
}

/**
 * Loads a revision's run (candidates, totals, actuals), its current line set and the tolerance policy the
 * run recorded (the policy in force for the unit when there is no run yet), and reconciles them.
 */
export async function loadRevisionState(
  manager: EntityManager,
  period: ProductionPeriod,
  revision: AccountingRevision,
  policies: AccountingPoliciesService,
): Promise<RevisionState> {
  const run = revision.currentRunId
    ? await manager.findOneBy(CalculationRun, { id: revision.currentRunId })
    : null;
  const [candidateLines, totals, actuals] = run
    ? await runContent(manager, run)
    : [[], [], []];
  const [lineSet, lines] = await lineSetOf(manager, revision);
  const tolerance = await tolerancePolicy(manager, period, run, policies);
  const slices = await manager.find(PeriodProductSlice, {
    where: { periodId: period.id, supersededAt: IsNull() },
    order: { windowFrom: 'ASC', productId: 'ASC' },
  });
  const eventSpans = await eventSpansOf(manager, lines);
  const partial = {
    period,
    revision,
    run,
    candidateLines,
    totals,
    actuals,
    lineSet,
    lines,
    slices,
    tolerance,
    eventSpans,
  };
  const reconciliation = reconcile({
    candidates: candidatesOf(candidateLines),
    lines: decisionLinesOf(lines),
    slices: slicesOf(totals),
    rule: tolerance.rule,
  });
  return { ...partial, reconciliation };
}

/** Closed intervals of the events cited by manual / replacing downtime lines (one query, by id). */
async function eventSpansOf(
  manager: EntityManager,
  lines: readonly ReconciliationLine[],
): Promise<Map<string, { from: number; to: number }>> {
  const ids = [
    ...new Set(
      lines
        .filter((l) => l.kind === 'availability' && l.action !== 'reject')
        .flatMap((l) => l.evidence.map((e) => e.eventId)),
    ),
  ];
  if (ids.length === 0) return new Map();
  const rows = await manager.query<
    Array<{ id: string; start_time: Date; end_time: Date }>
  >(
    `SELECT "id", "start_time", "end_time" FROM "production_events"
      WHERE "id" = ANY($1::uuid[]) AND "end_time" IS NOT NULL`,
    [ids],
  );
  return new Map(
    rows.map((r) => [
      r.id,
      {
        from: new Date(r.start_time).getTime(),
        to: new Date(r.end_time).getTime(),
      },
    ]),
  );
}

async function lineSetOf(
  manager: EntityManager,
  revision: AccountingRevision,
): Promise<[ReconciliationLineSet | null, ReconciliationLine[]]> {
  if (!revision.currentLineSetId) return [null, []];
  const lineSet = await manager.findOneBy(ReconciliationLineSet, {
    id: revision.currentLineSetId,
  });
  if (!lineSet) return [null, []];
  const lines = await manager.find(ReconciliationLine, {
    where: { lineSetId: lineSet.id },
    order: { position: 'ASC' },
  });
  return [lineSet, lines];
}

async function runContent(
  manager: EntityManager,
  run: CalculationRun,
): Promise<[LossLine[], PeriodLedgerTotal[], ActualsResult[]]> {
  return Promise.all([
    manager.find(LossLine, {
      where: {
        runId: run.id,
        ledger: 'plan',
        source: 'auto',
        kind: In([...CANDIDATE_KINDS]),
      },
      order: { sliceId: 'ASC', segmentStart: 'ASC', autoKey: 'ASC' },
    }),
    manager.find(PeriodLedgerTotal, {
      where: { runId: run.id },
      order: { sliceId: 'ASC', ledger: 'ASC' },
    }),
    run.actualsRunId
      ? manager.find(ActualsResult, {
          where: { actualsRunId: run.actualsRunId },
          order: { sliceId: 'ASC' },
        })
      : Promise.resolve([]),
  ]);
}

async function tolerancePolicy(
  manager: EntityManager,
  period: ProductionPeriod,
  run: CalculationRun | null,
  policies: AccountingPoliciesService,
): Promise<TolerancePolicy> {
  const ref = run?.policyVersions.find(
    (p) => p.kind === 'reconciliation_tolerance',
  );
  const stored = ref
    ? await manager.findOneBy(AccountingPolicy, { id: ref.id })
    : null;
  if (stored) {
    const body = parseReconciliationTolerance(stored.body);
    return {
      policyId: stored.id,
      version: stored.version,
      body,
      rule: ruleOf(body),
    };
  }
  const engine = await policies.resolveEngine(
    manager,
    { tenantId: period.tenantId, unitId: period.unitId },
    period.utcStart,
  );
  const current = engine.refs.find(
    (p) => p.kind === 'reconciliation_tolerance',
  );
  return {
    policyId: current?.id ?? null,
    version: current?.version ?? null,
    body: engine.tolerance,
    rule: ruleOf(engine.tolerance),
  };
}
