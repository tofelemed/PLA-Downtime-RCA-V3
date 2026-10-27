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

/** The policy's basis and daily grain apply only on its accounting unit; without a unit (plant-wide) they are reported as set. */
function appliesTo(policy: Pick<LossAccountingPolicyView, 'accountingUnitId'>, unitId?: string): boolean {
  return !unitId || !policy.accountingUnitId || policy.accountingUnitId.toLowerCase() === unitId.toLowerCase();
}

/**
 * The loss accounting mode in force for the acting plant (a unit's own version, else plant-wide), fresh for
 * 5 minutes. A policy whose accounting unit is another unit than `unitId` reads computed, per shift there.
 * When the read fails or has no data the computed / per-shift defaults are returned and `isLoading` is
 * false, so a page never breaks on it.
 */
export function useLossAccountingMode(unitId?: string): LossAccountingMode {
  const inForce = useLossAccountingInForce(unitId ?? null);
  const policy = inForce.data?.policy ?? COMPUTED_SHIFT_DEFAULTS;
  const applies = appliesTo(policy, unitId);
  const isDeclared = applies && policy.lossBasis === 'declared';
  const isDay = applies && policy.grain === 'day';
  return {
    grain: isDay ? 'day' : 'shift',
    lossBasis: isDeclared ? 'declared' : 'computed',
    targetSource: isDeclared ? policy.targetSource : 'plan',
    accountingUnitId: policy.accountingUnitId,
    isDeclared,
    isDay,
    isLoading: inForce.isLoading,
  };
}
