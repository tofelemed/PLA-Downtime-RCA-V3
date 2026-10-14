import { GradeTransitionStandard } from '../../profiles/entities/transition-standard.entity';
import { decimalText, VersionFields, versionFields } from './profile-v2.view';

/** One entry of a unit's grade-transition matrix (LA-08); decimals as strings (API03). */
export interface TransitionStandardV2View extends VersionFields {
  id: string;
  unitId: string;
  fromProductId: string;
  toProductId: string;
  referenceSeconds: string;
  referenceOffgradeQty: string | null;
  offgradeUom: string | null;
  sampleCount: number | null;
  evidence: string | null;
  notes: string | null;
}

export function toTransitionStandardView(
  row: GradeTransitionStandard,
): TransitionStandardV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    fromProductId: row.fromProductId,
    toProductId: row.toProductId,
    referenceSeconds: decimalText(row.referenceSeconds),
    referenceOffgradeQty:
      row.referenceOffgradeQty === null
        ? null
        : decimalText(row.referenceOffgradeQty),
    offgradeUom: row.offgradeUom,
    sampleCount: row.sampleCount,
    evidence: row.evidence,
    notes: row.notes,
    ...versionFields(row),
  };
}
