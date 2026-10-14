import { DemandStatus } from '../../valuation/entities/demand-status.entity';
import { RevaluationRequested } from '../../valuation/valuation-events';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export interface DemandStatusV2View {
  id: string;
  productId: string;
  status: string;
  evidence: string;
  version: number;
  state: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the draft's author: never its approver (403 SEPARATION_OF_DUTIES) */
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** Approve / retire response: the version and the revaluation it queued (SME V7). */
export interface DemandStatusTransitionV2View extends DemandStatusV2View {
  revaluation: RevaluationRequested | null;
}

export function toDemandStatusView(row: DemandStatus): DemandStatusV2View {
  return {
    id: row.id,
    productId: row.productId,
    status: row.status,
    evidence: row.evidence,
    version: row.version,
    state: row.state,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: iso(row.effectiveTo),
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDemandTransitionView(result: {
  status: DemandStatus;
  revaluation: RevaluationRequested | null;
}): DemandStatusTransitionV2View {
  return {
    ...toDemandStatusView(result.status),
    revaluation: result.revaluation,
  };
}
