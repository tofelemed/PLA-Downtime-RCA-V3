import { useLossAccountingInForce } from '@/api/v2/queries/loss-accounting';
import type { LossAccountingPolicyView, LossBasis, LossGrain, LossTargetSource } from '@/api/v2/types/loss-accounting';

export interface LossAccountingMode {
  grain: LossGrain;
  lossBasis: LossBasis;
  targetSource: LossTargetSource;
  accountingUnitId: string | null;
  isDeclared: boolean;
  isDay: boolean;
  isLoading: boolean;
}

/** What the server applies when no version is set (computed from the plan, per shift); used while unknown or on failure. */
const COMPUTED_SHIFT_DEFAULTS: Pick<LossAccountingPolicyView, 'grain' | 'lossBasis' | 'targetSource' | 'accountingUnitId'> = {
  grain: 'shift',
  lossBasis: 'computed',
  targetSource: 'plan',
  accountingUnitId: null,
};

/**
 * The loss accounting mode in force for the acting plant (a unit's own version, else plant-wide), fresh for
 * 5 minutes. When the read fails or has no data the computed / per-shift defaults are returned and
 * `isLoading` is false, so a page never breaks on it.
 */
export function useLossAccountingMode(unitId?: string): LossAccountingMode {
  const inForce = useLossAccountingInForce(unitId ?? null);
  const policy = inForce.data?.policy ?? COMPUTED_SHIFT_DEFAULTS;
  return {
    grain: policy.grain,
    lossBasis: policy.lossBasis,
    targetSource: policy.targetSource,
    accountingUnitId: policy.accountingUnitId,
    isDeclared: policy.lossBasis === 'declared',
    isDay: policy.grain === 'day',
    isLoading: inForce.isLoading,
  };
}
