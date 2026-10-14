import { parseRcaPolicy, RcaPolicy } from '../../domain/rca/rca-policy';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/**
 * One `rca_policy` version (plan 3.9, D13; SME D17 / CA2–CA8): tenant-wide when `unitId` is null. Carries
 * the whole parsed body — triggers and the workflow rules the server applies (screens read thresholds
 * from here, never from constants).
 */
export interface RcaPolicyVersionV2View extends RcaPolicy {
  id: string;
  unitId: string | null;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  rowVersion: number;
}

export function toRcaPolicyView(row: AccountingPolicy): RcaPolicyVersionV2View {
  const body = parseRcaPolicy(row.body);
  return {
    id: row.id,
    unitId: row.unitId,
    version: row.version,
    ...body,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: iso(row.effectiveTo),
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    rowVersion: row.rowVersion,
  };
}
