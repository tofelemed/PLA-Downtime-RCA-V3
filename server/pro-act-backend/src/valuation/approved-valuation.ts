import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { formatDec } from '../domain/actuals/decimal';
import { ValuationTotal } from '../domain/valuation/valuation-totals';
import { ApprovedValuationTotal } from './entities/approved-valuation-total.entity';

const CHUNK = 500;

export interface ApprovedScope {
  tenantId: string;
  revisionId: string;
  periodId: string;
  approver: string;
}

function approvedRow(
  scope: ApprovedScope,
  total: ValuationTotal,
): QueryDeepPartialEntity<ApprovedValuationTotal> {
  return {
    tenantId: scope.tenantId,
    revisionId: scope.revisionId,
    periodId: scope.periodId,
    sliceId: total.sliceId,
    kind: total.kind,
    view: total.view,
    currency: total.currency,
    uom: total.uom,
    amount: total.amount === null ? null : formatDec(total.amount),
    nativeAmount: formatDec(total.nativeAmount),
    valuedLines: total.valuedLines,
    unvaluedLines: total.unvaluedLines,
    fxMissingLines: total.fxMissingLines,
    unvaluedQuantity: formatDec(total.unvaluedQuantity),
    unvaluedSeconds: formatDec(total.unvaluedSeconds),
    status: total.status,
    reasons: total.reasons,
    fxRateIds: total.fxRateIds,
    createdBy: scope.approver,
  };
}

/** VA-01: writes the reconciled plan-ledger valuation of an approved revision (approval transaction). */
export async function writeApprovedValuation(
  manager: EntityManager,
  scope: ApprovedScope,
  totals: readonly ValuationTotal[],
): Promise<void> {
  const rows = totals
    .filter((t) => t.ledger === 'plan')
    .map((t) => approvedRow(scope, t));
  for (let i = 0; i < rows.length; i += CHUNK) {
    await manager.insert(ApprovedValuationTotal, rows.slice(i, i + CHUNK));
  }
}
