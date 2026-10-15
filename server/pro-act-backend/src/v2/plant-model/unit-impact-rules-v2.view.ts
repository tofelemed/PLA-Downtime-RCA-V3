import { UnitImpactRule } from '../../plant-model/entities/unit-impact-rule.entity';
import {
  decimalText,
  VersionFields,
  versionFields,
} from '../profiles/profile-v2.view';

/** One version of a unit impact rule (plan 1.10, SME Q5 + D9); the fraction as a decimal string (API03). */
export interface UnitImpactRuleV2View extends VersionFields {
  id: string;
  unitId: string;
  assetId: string;
  mode: string;
  fraction: string | null;
  standbyAssetId: string | null;
  takeoverSeconds: number;
  reason: string;
}

export function toUnitImpactRuleView(
  row: UnitImpactRule,
): UnitImpactRuleV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    assetId: row.assetId,
    mode: row.mode,
    fraction: row.fraction === null ? null : decimalText(row.fraction),
    standbyAssetId: row.standbyAssetId,
    takeoverSeconds: row.takeoverSeconds,
    reason: row.reason,
    ...versionFields(row),
  };
}
