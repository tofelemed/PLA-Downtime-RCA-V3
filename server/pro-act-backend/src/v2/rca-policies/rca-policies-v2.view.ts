import { parseRcaPolicy } from '../../domain/rca/rca-policy';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/** One `rca_policy` version (plan 3.9, D13): tenant-wide when `unitId` is null. */
export interface RcaPolicyVersionV2View {
  id: string;
  unitId: string | null;
  version: number;
  durationThresholdSeconds: number;
  /** null = cost trigger off */
  costThreshold: number | null;
  repeatCount: number;
  repeatWindowDays: number;
  autoCreate: 'recommend' | 'create';
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
    durationThresholdSeconds: body.durationThresholdSeconds,
    costThreshold: body.costThreshold,
    repeatCount: body.repeatCount,
    repeatWindowDays: body.repeatWindowDays,
    autoCreate: body.autoCreate,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: iso(row.effectiveTo),
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    rowVersion: row.rowVersion,
  };
}
