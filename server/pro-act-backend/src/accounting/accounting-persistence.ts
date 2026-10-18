import { randomUUID } from 'crypto';
import { EntityManager, ObjectLiteral, EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  LedgerTotals,
  LossLineDraft,
  PeriodAccounting,
} from '../domain/accounting/accounting.types';
import { Dec, formatDec } from '../domain/actuals/decimal';
import { StoredLineValuation } from '../domain/valuation/valuation-snapshot';
import { AccountingRevision } from './entities/accounting-revision.entity';
import { CalculationRun, RunError } from './entities/calculation-run.entity';
import { LossLineEvidence } from './entities/loss-line-evidence.entity';
import { LossLine } from './entities/loss-line.entity';
import { PeriodLedgerTotal } from './entities/period-ledger-total.entity';

const CHUNK = 500;

/** Bulk insert in chunks (no N+1; one statement per 500 rows). */
async function insertAll<T extends ObjectLiteral>(
  manager: EntityManager,
  target: EntityTarget<T>,
  rows: Array<QueryDeepPartialEntity<T>>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await manager.insert(target, rows.slice(i, i + CHUNK));
  }
}

interface RunScope {
  tenantId: string;
  periodId: string;
  runId: string;
  revisionId: string;
}

function lineRow(
  line: LossLineDraft,
  scope: RunScope,
  id: string,
  valuation: StoredLineValuation | null,
): QueryDeepPartialEntity<LossLine> {
  const cause = line.cause;
  return {
    id,
    tenantId: scope.tenantId,
    runId: scope.runId,
    revisionId: scope.revisionId,
    periodId: scope.periodId,
    sliceId: line.sliceId,
    segmentStart: line.segmentStart,
    segmentEnd: line.segmentEnd,
    ledger: line.ledger,
    kind: line.kind,
    quantity: formatDec(line.quantity),
    uom: line.uom,
    basis: line.basis,
    rateVersionId: line.rateVersionId,
    appliedRate: line.appliedRate?.value ?? null,
    appliedRateTimebase: line.appliedRate?.timebase ?? null,
    reasonCodeId: cause?.reasonCodeId ?? null,
    impactCodeId: cause?.impactCodeId ?? null,
    oeeComponent: line.oeeComponent,
    scheduleClass: line.scheduleClass,
    failureCodes: cause?.failureMode
      ? { failureMode: cause.failureMode }
      : null,
    source: 'auto',
    autoKey: line.autoKey,
    state: 'active',
    // SME Q10 / E1: ramp-up and startup-quality loss is charged to the stop it recovers from (RCA impact);
    // the line's evidence keeps the recovery event itself
    causeEventId: cause?.recoveryOfEventId ?? cause?.eventId ?? null,
    occurrenceId: cause?.occurrenceId ?? null,
    flags: line.flags,
    valuation,
    createdBy: null,
  };
}

const qty = (value: Dec | null) => (value === null ? null : formatDec(value));

function totalsRow(
  totals: LedgerTotals,
  scope: RunScope,
): QueryDeepPartialEntity<PeriodLedgerTotal> {
  return {
    tenantId: scope.tenantId,
    runId: scope.runId,
    periodId: scope.periodId,
    sliceId: totals.sliceId,
    ledger: totals.ledger,
    uom: totals.uom,
    capacityQty: qty(totals.capacity),
    exclusionQty: qty(totals.exclusion),
    availabilityQty: qty(totals.availability),
    performanceQty: qty(totals.performance),
    qualityQty: qty(totals.quality),
    goodQty: qty(totals.good),
    gainQty: qty(totals.gain),
    attributedQty: qty(totals.attributed),
    residualQty: qty(totals.residual),
    targetQty: qty(totals.target),
    actualQty: qty(totals.actual),
    gapQty: qty(totals.gap),
    overproductionQty: qty(totals.overproduction),
    overAccountedQty: qty(totals.overAccounted),
    plannedTransitionQty: qty(totals.plannedTransition),
    flags: totals.flags,
  };
}

/**
 * Lines (with their 2.6 valuation snapshot, index-aligned), their evidence and the ledger totals of a
 * validated run (one bulk insert per table); returns the line ids in line order.
 */
export async function writeRunResults(
  manager: EntityManager,
  scope: RunScope,
  accounting: PeriodAccounting,
  valuations: readonly StoredLineValuation[] = [],
): Promise<{ lines: number; evidence: number; ids: string[] }> {
  const ids = accounting.lines.map(() => randomUUID());
  const evidence = accounting.lines.flatMap((line, i) =>
    line.evidence.map(
      (e): QueryDeepPartialEntity<LossLineEvidence> => ({
        tenantId: scope.tenantId,
        lossLineId: ids[i],
        eventId: e.eventId,
        eventRevisionId: e.eventRevisionId,
        occurrenceId: e.occurrenceId,
        share: e.share,
        clippedStart: e.clippedStart,
        clippedEnd: e.clippedEnd,
      }),
    ),
  );
  await insertAll(
    manager,
    LossLine,
    accounting.lines.map((line, i) =>
      lineRow(line, scope, ids[i], valuations[i] ?? null),
    ),
  );
  await insertAll(manager, LossLineEvidence, evidence);
  await insertAll(
    manager,
    PeriodLedgerTotal,
    accounting.totals.map((t) => totalsRow(t, scope)),
  );
  return { lines: ids.length, evidence: evidence.length, ids };
}

/** `running → failed` with the validation errors; the draft keeps pointing at its previous run. */
export async function failRun(
  manager: EntityManager,
  run: CalculationRun,
  errors: RunError[],
): Promise<void> {
  await manager.update(CalculationRun, run.id, {
    status: 'failed',
    error: errors,
    completedAt: new Date(),
  });
}

/**
 * FND03 pointer switch, inside the run's transaction: the run becomes `validated`, the previous current
 * run `superseded`, and the draft revision points at the new run. Readers resolve the run through the
 * revision and read lines by run id, so they see the old or the new run, never a mix.
 */
export async function switchPointer(
  manager: EntityManager,
  revision: AccountingRevision,
  run: CalculationRun,
  stats: Record<string, number>,
): Promise<void> {
  await manager.update(CalculationRun, run.id, {
    status: 'validated',
    completedAt: new Date(),
    stats,
  });
  if (revision.currentRunId) {
    await manager.update(CalculationRun, revision.currentRunId, {
      status: 'superseded',
    });
  }
  await manager.update(AccountingRevision, revision.id, {
    currentRunId: run.id,
    inputHash: run.inputHash,
  });
}
