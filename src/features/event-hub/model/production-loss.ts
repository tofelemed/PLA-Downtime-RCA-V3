import type { DeclaredFigures, ProductionEventView } from '@/api/v2/types/events';

/** Declared mode: the one-day, OT-declared loss of a unit (physical type `production_loss`). */
export const PRODUCTION_LOSS = 'production_loss';

export function isProductionLoss(event: Pick<ProductionEventView, 'classification'>): boolean {
  return event.classification.physicalType === PRODUCTION_LOSS;
}

/** The declared shortfall of a production loss event, null for any other event. */
export function shortfallOf(event: Pick<ProductionEventView, 'classification' | 'declaredFigures'>): number | null {
  return isProductionLoss(event) && event.declaredFigures ? event.declaredFigures.shortfall : null;
}

/** "Planned 240.000 t · Actual 208.000 t · Shortfall 32.000 t · GOOD · DETECTED · plan SRC / PLAN-1 rev 1 (approved)" in the plant's digits; what OT did not declare is left out. */
export function declaredFiguresText(figures: DeclaredFigures, decimal: (value: string, fractionDigits: number) => string): string {
  const tonnes = (label: string, value: number | null) => (value === null ? null : `${label} ${decimal(String(value), 3)} ${figures.uom}`);
  const plan = figures.plan;
  const planParts = plan ? [[plan.source, plan.planId].filter(Boolean).join(' / '), plan.revision === null ? '' : `rev ${plan.revision}`].filter(Boolean).join(' ') : '';
  const approval = plan?.approved === null || plan === null ? '' : plan.approved ? ' (approved)' : ' (not approved)';
  const parts = [tonnes('Planned', figures.planned), tonnes('Actual', figures.actual), tonnes('Shortfall', figures.shortfall), figures.measurementQuality, figures.sourceStatus, planParts && `plan ${planParts}${approval}`];
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

/** "Plan source · plan id · revision 3 · approved", leaving out what OT did not declare. */
export function planText(plan: NonNullable<DeclaredFigures['plan']>): string {
  const parts = [
    plan.source,
    plan.planId,
    plan.revision === null ? null : `revision ${plan.revision}`,
    plan.approved === null ? null : plan.approved ? 'approved' : 'not approved',
  ].filter((part): part is string => part !== null && part !== '');
  return parts.join(' · ');
}
