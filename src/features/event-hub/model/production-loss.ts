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
