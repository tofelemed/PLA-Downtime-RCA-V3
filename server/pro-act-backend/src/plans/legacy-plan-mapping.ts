import { Dec, formatDec } from '../domain/actuals/decimal';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { PlanContent } from './plan-content';

/** v1 approval label → what the version model does with it (plan 2.3 legacy bridge). */
export type LegacyApprovalIntent = 'approve' | 'submit' | 'reopen' | null;

const INTENTS: Record<string, LegacyApprovalIntent> = {
  approved: 'approve',
  'pending review': 'submit',
  'pending approval': 'submit',
  draft: 'reopen',
  rejected: 'reopen',
};

export function approvalIntent(
  label: string | null | undefined,
): LegacyApprovalIntent {
  return label ? (INTENTS[label.trim().toLowerCase()] ?? null) : null;
}

/** v1 header fields whose change makes a new plan content (anything else is header-only). */
export function contentChanged(
  before: ProductionPlan,
  after: ProductionPlan,
): boolean {
  const time = (value: Date | string | undefined) =>
    value ? new Date(value).getTime() : null;
  return (
    before.unitId !== after.unitId ||
    (before.productId ?? null) !== (after.productId ?? null) ||
    time(before.startDate) !== time(after.startDate) ||
    time(before.endDate) !== time(after.endDate) ||
    quantityOf(before) !== quantityOf(after)
  );
}

/** v1 `plannedQuantity` as a decimal string (numeric(15,4) fits the 8-place scale), or null. */
export function quantityOf(plan: ProductionPlan): string | null {
  const value = plan.plannedQuantity;
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatDec(new Dec(parsed)) : null;
}

/**
 * The version content a v1 header asks for (plan 2.3 legacy bridge): `plannedQuantity` → header target
 * with basis `quantity` distributed by scheduled capacity (no 100/h default; none → basis `time`), the
 * product → one sequential slice. Content the v1 form does not know (more slices, campaigns, weights) is
 * kept from `base` unless the product changed.
 */
export function contentFromHeader(
  plan: ProductionPlan,
  refs: { unitId: string; productId: string | null },
  base: PlanContent | null,
): PlanContent {
  const target = quantityOf(plan);
  const sameProduct = base?.slices[0]?.productId === refs.productId;
  return {
    unitId: refs.unitId,
    validFrom: new Date(plan.startDate).toISOString(),
    validTo: new Date(plan.endDate).toISOString(),
    basis: target === null ? 'time' : 'quantity',
    headerTarget: target,
    distribution: base?.distribution ?? 'scheduled_capacity',
    slices:
      base && sameProduct
        ? base.slices
        : refs.productId
          ? [{ productId: refs.productId, stream: 'sequential' }]
          : [],
    manualTargets: null,
    changeReason: 'v1 plan edit',
  };
}
