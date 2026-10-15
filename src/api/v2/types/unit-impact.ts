import type { VersionFields } from './profiles';

/**
 * Plan 1.10 unit impact rules (backend `src/v2/plant-model/unit-impact-rules-v2.view.ts`, SME Q5 + D9): how
 * a stop of one asset affects its unit and which standby holds the output. Decimals are strings.
 */
export type UnitImpactMode = 'full_stop' | 'fractional' | 'none';

export interface UnitImpactRuleView extends VersionFields {
  id: string;
  unitId: string;
  assetId: string;
  mode: UnitImpactMode;
  /** share of the unit rate lost (0, 1] with `fractional` */
  fraction: string | null;
  standbyAssetId: string | null;
  takeoverSeconds: number;
  reason: string;
}
