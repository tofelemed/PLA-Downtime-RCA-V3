import type { PlanView } from '@/api/v2/types/plans';

/** Where the plan list opens when the plan cannot be chosen for the user. */
export const PLAN_LIST_PATH = '/planning';

export type PeriodAccountingTarget =
  | { kind: 'plan'; to: string }
  | { kind: 'list'; to: string; reason: 'none' | 'several' };

/** A plan whose current version is approved and valid now (half-open `[validFrom, validTo)`). */
function isActiveApproved(plan: PlanView, now: number): boolean {
  const { approvalState, validFrom, validTo } = plan.version;
  return approvalState === 'approved' && Date.parse(validFrom) <= now && now < Date.parse(validTo);
}

/**
 * UX audit B-5 ("which plan is current?" has no SME rule yet): exactly one active approved plan of the
 * unit (or of the plant without a unit) opens its period grid; none or several open the plan list.
 */
export function periodAccountingTarget(plans: readonly PlanView[], unitId: string | null, now: number): PeriodAccountingTarget {
  const active = plans.filter((plan) => (!unitId || plan.version.unitId === unitId) && isActiveApproved(plan, now));
  if (active.length === 1) return { kind: 'plan', to: `/plans/${encodeURIComponent(active[0].id)}` };
  return { kind: 'list', to: PLAN_LIST_PATH, reason: active.length === 0 ? 'none' : 'several' };
}

/** The one unit of a `?units=` scope (carried from the analysis pages), else null (whole plant). */
export function singleUnitOf(params: URLSearchParams): string | null {
  const units = (params.get('units') ?? '').split(',').filter(Boolean);
  return units.length === 1 ? units[0] : null;
}
