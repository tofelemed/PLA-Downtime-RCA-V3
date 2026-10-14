import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  revaluationWindow,
  ValuationSubject,
} from '../periods/baseline-recalc-scope';
import { OPEN_ENDED } from '../periods/period-recalc';
import { PROFILE_BASELINE_CHANGED } from '../profiles/profile-events';

export interface ValuationChange {
  tenantId: string;
  subject: ValuationSubject;
  change: 'approved' | 'superseded' | 'retired';
  row: {
    id: string;
    version: number;
    rowVersion: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  };
}

/** What a response tells the caller about the revaluation it triggered (SME V7: never silent). */
export interface RevaluationRequested {
  /** the recalculation is queued with the change (outbox → recompute jobs on the worker) */
  status: 'queued';
  scope: 'tenant';
  from: string;
  /** null = open-ended: every later period, future ones included */
  to: string | null;
}

/**
 * SME V7 (14 Oct 2026): an approved, superseded or retired FX rate, valuation policy or demand status
 * queues a recompute of the periods it values — written with the change (FND02) and consumed by the
 * baseline recalculation (`baseline-recalc.consumer.ts`) on the worker. Quantities are untouched; open
 * revisions are revalued and approved ones get a change proposal, never an overwrite.
 */
export async function recordValuationChanges(
  manager: EntityManager,
  changes: readonly ValuationChange[],
): Promise<RevaluationRequested | null> {
  if (changes.length === 0) return null;
  await enqueueOutbox(
    manager,
    changes.map(({ tenantId, subject, change, row }) => ({
      tenantId,
      aggregateType: 'valuation_input',
      aggregateId: row.id,
      type: PROFILE_BASELINE_CHANGED,
      version: row.rowVersion,
      payload: {
        change,
        id: row.id,
        version: row.version,
        subject,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
      },
    })),
  );
  return requestedOf(changes);
}

function requestedOf(
  changes: readonly ValuationChange[],
): RevaluationRequested {
  const windows = changes.map((c) =>
    revaluationWindow(c.subject, c.row.effectiveFrom, c.row.effectiveTo),
  );
  const from = Math.min(...windows.map((w) => w.from.getTime()));
  const to = Math.max(...windows.map((w) => w.to.getTime()));
  return {
    status: 'queued',
    scope: 'tenant',
    from: new Date(from).toISOString(),
    to: to >= OPEN_ENDED.getTime() ? null : new Date(to).toISOString(),
  };
}
