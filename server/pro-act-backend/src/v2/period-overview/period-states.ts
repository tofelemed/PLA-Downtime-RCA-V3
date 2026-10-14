import { EntityManager, In, Not } from 'typeorm';
import {
  AccountingRevision,
  RevisionLifecycle,
} from '../../accounting/entities/accounting-revision.entity';
import { CalculationRun } from '../../accounting/entities/calculation-run.entity';
import { LossLine } from '../../accounting/entities/loss-line.entity';
import { PeriodLedgerTotal } from '../../accounting/entities/period-ledger-total.entity';
import { reconcile } from '../../domain/reconciliation/reconcile';
import {
  Candidate,
  DecisionLine,
  Reconciliation,
  ToleranceRule,
} from '../../domain/reconciliation/reconciliation.types';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { ActualsResult } from '../../periods/entities/actuals-result.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { parseReconciliationTolerance } from '../../periods/engine-policy-bodies';
import { policyBodiesInForce } from '../../periods/policy-bodies-in-force';
import { ReconciliationLine } from '../../reconciliation/entities/reconciliation-line.entity';
import {
  candidatesOf,
  decisionLinesOf,
  ruleOf,
  slicesOf,
} from '../../reconciliation/revision-state';

/**
 * Which revision a read shows: the latest not cancelled one (open, else published), the published one, or
 * — like the KPI reports (plan 2.7) — the published one, else the open draft (`shown`, plan 3.6).
 */
export type RevisionSelector = 'current' | 'approved' | 'shown';

/** What the grid and the waterfall need of one period, loaded for a whole page at once (no N+1). */
export interface PeriodState {
  period: ProductionPeriod;
  revision: AccountingRevision | null;
  publishedRevision: number | null;
  run: CalculationRun | null;
  totals: PeriodLedgerTotal[];
  actuals: ActualsResult[];
  candidates: Candidate[];
  lines: DecisionLine[];
  rule: ToleranceRule | null;
  reconciliation: Reconciliation | null;
}

const PLAN_CANDIDATE_KINDS = ['availability', 'performance', 'quality'];

function pickRevision(
  revisions: readonly AccountingRevision[],
  selector: RevisionSelector,
): AccountingRevision | null {
  const live = revisions.filter((r) => r.lifecycle !== 'cancelled');
  const published = live.find((r) => r.lifecycle === 'approved') ?? null;
  if (selector === 'approved') return published;
  if (selector === 'shown') return published ?? live[0] ?? null;
  return live[0] ?? null;
}

const groupBy = <T>(rows: readonly T[], key: (row: T) => string) => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const group = map.get(key(row));
    if (group) group.push(row);
    else map.set(key(row), [row]);
  }
  return map;
};

/**
 * Columns the states read of a run and of its plan candidates (`candidatesOf`): runs and loss lines carry
 * large JSON columns (fingerprint, valuation context, evidence) that no state uses, and loading them for a
 * page of 500 periods dominated the PLA reports (plan 3.6 profiling, docs/UI_UX_AUDIT.md finding 6).
 */
const RUN_COLUMNS = {
  id: true,
  tenantId: true,
  periodId: true,
  revisionId: true,
  actualsRunId: true,
  status: true,
  engineVersion: true,
  policyVersions: true,
  startedAt: true,
  completedAt: true,
} as const;
const CANDIDATE_COLUMNS = {
  id: true,
  runId: true,
  sliceId: true,
  kind: true,
  quantity: true,
  autoKey: true,
} as const;

async function revisionsOf(manager: EntityManager, periodIds: string[]) {
  const rows = periodIds.length
    ? await manager.find(AccountingRevision, {
        where: {
          periodId: In(periodIds),
          lifecycle: Not<RevisionLifecycle>('cancelled'),
        },
        order: { revision: 'DESC' },
      })
    : [];
  return groupBy(rows, (r) => r.periodId);
}

async function runContent(manager: EntityManager, runs: CalculationRun[]) {
  const runIds = runs.map((r) => r.id);
  const actualsRunIds = runs.flatMap((r) =>
    r.actualsRunId ? [r.actualsRunId] : [],
  );
  if (!runIds.length)
    return {
      lines: new Map<string, LossLine[]>(),
      totals: new Map<string, PeriodLedgerTotal[]>(),
      actuals: new Map<string, ActualsResult[]>(),
    };
  const [lines, totals, actuals] = await Promise.all([
    manager.find(LossLine, {
      select: CANDIDATE_COLUMNS,
      where: {
        runId: In(runIds),
        ledger: 'plan',
        source: 'auto',
        kind: In(PLAN_CANDIDATE_KINDS),
      },
      order: { sliceId: 'ASC', segmentStart: 'ASC', autoKey: 'ASC' },
    }),
    manager.find(PeriodLedgerTotal, {
      where: { runId: In(runIds) },
      order: { sliceId: 'ASC', ledger: 'ASC' },
    }),
    actualsRunIds.length
      ? manager.find(ActualsResult, {
          where: { actualsRunId: In(actualsRunIds) },
          order: { sliceId: 'ASC' },
        })
      : Promise.resolve([] as ActualsResult[]),
  ]);
  return {
    lines: groupBy(lines, (l) => l.runId),
    totals: groupBy(totals, (t) => t.runId),
    actuals: groupBy(actuals, (a) => a.actualsRunId),
  };
}

async function savedLines(
  manager: EntityManager,
  revisions: AccountingRevision[],
) {
  const setIds = revisions.flatMap((r) =>
    r.currentLineSetId ? [r.currentLineSetId] : [],
  );
  const rows = setIds.length
    ? await manager.find(ReconciliationLine, {
        where: { lineSetId: In(setIds) },
        order: { position: 'ASC' },
      })
    : [];
  return groupBy(rows, (l) => l.lineSetId);
}

/** Tolerance rule each run recorded; the policy in force for the unit when a run names none. */
async function toleranceRules(
  manager: EntityManager,
  runs: CalculationRun[],
  periods: Map<string, ProductionPeriod>,
  policies: AccountingPoliciesService,
): Promise<Map<string, ToleranceRule>> {
  const refOf = (run: CalculationRun) =>
    run.policyVersions.find((p) => p.kind === 'reconciliation_tolerance')?.id;
  const ids = [
    ...new Set(runs.flatMap((r) => (refOf(r) ? [refOf(r) as string] : []))),
  ];
  const stored = ids.length
    ? await manager.find(AccountingPolicy, { where: { id: In(ids) } })
    : [];
  const byId = new Map(
    stored.map((p) => [p.id, ruleOf(parseReconciliationTolerance(p.body))]),
  );
  const rules = new Map<string, ToleranceRule>();
  const unrecorded: CalculationRun[] = [];
  for (const run of runs) {
    const known = byId.get(refOf(run) ?? '');
    if (known) rules.set(run.id, known);
    else unrecorded.push(run);
  }
  await addPoliciesInForce(rules, { manager, unrecorded, periods, policies });
  return rules;
}

/**
 * Runs that recorded no tolerance policy (pre-2.5) get the one in force for their unit at period start,
 * looked up for the whole page in one statement (DB-08: was one `resolveEngine` per run). Only a lookup
 * without any version in force — a tenant never seeded — goes through `resolveEngine`, which seeds.
 */
async function addPoliciesInForce(
  rules: Map<string, ToleranceRule>,
  input: {
    manager: EntityManager;
    unrecorded: CalculationRun[];
    periods: Map<string, ProductionPeriod>;
    policies: AccountingPoliciesService;
  },
): Promise<void> {
  const { manager, unrecorded, periods, policies } = input;
  const lookups = unrecorded.map((run) => {
    const period = periods.get(run.periodId) as ProductionPeriod;
    return {
      tenantId: period.tenantId,
      unitId: period.unitId,
      at: period.utcStart,
    };
  });
  const bodies = await policyBodiesInForce(
    manager,
    'reconciliation_tolerance',
    lookups,
  );
  for (const [index, run] of unrecorded.entries()) {
    const body = bodies[index];
    if (body !== undefined) {
      rules.set(run.id, ruleOf(parseReconciliationTolerance(body)));
      continue;
    }
    const { tenantId, unitId, at } = lookups[index];
    const engine = await policies.resolveEngine(
      manager,
      { tenantId, unitId },
      at,
    );
    rules.set(run.id, ruleOf(engine.tolerance));
  }
}

/**
 * Loads the selected revision of every period with its run (plan candidates, both ledgers' totals,
 * actuals results), its saved lines and tolerance rule in a fixed number of queries, and reconciles each
 * one with the plan 2.8 arithmetic (`reconcile`) — the same numbers the reconciliation view shows.
 */
export async function loadPeriodStates(
  manager: EntityManager,
  periods: readonly ProductionPeriod[],
  selector: RevisionSelector,
  policies: AccountingPoliciesService,
): Promise<PeriodState[]> {
  const revisionsByPeriod = await revisionsOf(
    manager,
    periods.map((p) => p.id),
  );
  const picked = new Map(
    periods.map((p) => [
      p.id,
      pickRevision(revisionsByPeriod.get(p.id) ?? [], selector),
    ]),
  );
  const chosen = [...picked.values()].filter(
    (r): r is AccountingRevision => r !== null,
  );
  const runIds = chosen.flatMap((r) =>
    r.currentRunId ? [r.currentRunId] : [],
  );
  const runs = runIds.length
    ? await manager.find(CalculationRun, {
        select: RUN_COLUMNS,
        where: { id: In(runIds) },
      })
    : [];
  const runsById = new Map(runs.map((r) => [r.id, r]));
  const [content, lineSets, rules] = await Promise.all([
    runContent(manager, runs),
    savedLines(manager, chosen),
    toleranceRules(
      manager,
      runs,
      new Map(periods.map((p) => [p.id, p])),
      policies,
    ),
  ]);
  return periods.map((period) => {
    const revision = picked.get(period.id) ?? null;
    const published = (revisionsByPeriod.get(period.id) ?? []).find(
      (r) => r.lifecycle === 'approved',
    );
    const run = revision?.currentRunId
      ? (runsById.get(revision.currentRunId) ?? null)
      : null;
    const totals: PeriodLedgerTotal[] = run
      ? (content.totals.get(run.id) ?? [])
      : [];
    const candidates = candidatesOf(
      run ? (content.lines.get(run.id) ?? []) : [],
    );
    const lines = decisionLinesOf(
      revision?.currentLineSetId
        ? (lineSets.get(revision.currentLineSetId) ?? [])
        : [],
    );
    const rule = run ? rules.get(run.id) : undefined;
    return {
      period,
      revision,
      publishedRevision: published?.revision ?? null,
      run,
      totals,
      actuals: run?.actualsRunId
        ? (content.actuals.get(run.actualsRunId) ?? [])
        : [],
      candidates,
      lines,
      rule: rule ?? null,
      reconciliation: rule
        ? reconcile({ candidates, lines, slices: slicesOf(totals), rule })
        : null,
    };
  });
}
