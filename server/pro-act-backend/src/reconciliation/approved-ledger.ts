import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { formatDec } from '../domain/actuals/decimal';
import { ReconciledLine } from '../domain/valuation/reconciled-valuation';
import { ApprovedLossLine } from './entities/approved-loss-line.entity';
import { ApprovedLossLineValuation } from './entities/approved-loss-line-valuation.entity';
import { approvedLedgerLines } from './reviewed-valuation';
import { RevisionState } from './revision-state';

const CHUNK = 500;
const OEE_KINDS = new Set(['availability', 'performance', 'quality']);

export interface ApprovedLedgerScope {
  tenantId: string;
  revisionId: string;
  periodId: string;
  approver: string;
}

type LineMeta = Pick<
  ApprovedLossLine,
  'causeEventId' | 'oeeComponent' | 'reasonCodeId' | 'impactCodeId' | 'uom'
>;

/** Codes, cause and unit a reconciled line carries: from its loss line (candidate) or its own line. */
function metaOf(line: ReconciledLine, state: RevisionState): LineMeta {
  if (line.source === 'candidate') {
    const loss = state.candidateLines.find((l) => l.id === line.id);
    return {
      causeEventId: loss?.causeEventId ?? null,
      oeeComponent: loss?.oeeComponent ?? null,
      reasonCodeId: loss?.reasonCodeId ?? null,
      impactCodeId: loss?.impactCodeId ?? null,
      uom: loss?.uom ?? null,
    };
  }
  const own = state.lines.find((l) => l.id === line.id);
  return {
    causeEventId: own?.evidence?.[0]?.eventId ?? null,
    oeeComponent: OEE_KINDS.has(line.kind) ? line.kind : null,
    reasonCodeId: own?.reasonCodeId ?? null,
    impactCodeId: own?.impactCodeId ?? null,
    uom: own?.uom ?? null,
  };
}

function valuationRows(
  scope: ApprovedLedgerScope,
  approvedLineId: string,
  line: ReconciledLine,
): Array<QueryDeepPartialEntity<ApprovedLossLineValuation>> {
  return line.valuation.views.flatMap((view) =>
    view.amounts.map((amount) => ({
      tenantId: scope.tenantId,
      approvedLineId,
      view: view.view,
      currency: amount.currency,
      amount: amount.amount === null ? null : formatDec(amount.amount),
      status: view.status,
      reason: amount.reason ?? view.reason,
      provisional: amount.provisional === true,
      createdBy: scope.approver,
    })),
  );
}

async function insertChunks<
  T extends ApprovedLossLine | ApprovedLossLineValuation,
>(
  manager: EntityManager,
  target: new () => T,
  rows: Array<QueryDeepPartialEntity<T>>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await manager.insert(target, rows.slice(i, i + CHUNK));
  }
}

/**
 * VA-01b: writes the approved plan ledger line by line (approval transaction): every reconciled line with
 * its codes, cause, quantity and valuation. Nothing for runs calculated before plan 2.6 (no frozen
 * valuation context); readers then fall back to the run's lines.
 */
export async function writeApprovedLedger(
  manager: EntityManager,
  scope: ApprovedLedgerScope,
  state: RevisionState,
): Promise<void> {
  // a rejected or replaced candidate is not part of the approved ledger
  const lines = approvedLedgerLines(state).filter(
    (line) => line.source !== 'candidate' || !line.quantity.isZero(),
  );
  const withIds = lines.map((line) => ({ line, id: randomUUID() }));
  await insertChunks(
    manager,
    ApprovedLossLine,
    withIds.map(({ line, id }) => ({
      id,
      tenantId: scope.tenantId,
      revisionId: scope.revisionId,
      periodId: scope.periodId,
      sliceId: line.sliceId,
      source: line.source,
      sourceId: line.id,
      kind: line.kind,
      quantity: formatDec(line.quantity),
      createdBy: scope.approver,
      ...metaOf(line, state),
    })),
  );
  await insertChunks(
    manager,
    ApprovedLossLineValuation,
    withIds.flatMap(({ line, id }) => valuationRows(scope, id, line)),
  );
}
