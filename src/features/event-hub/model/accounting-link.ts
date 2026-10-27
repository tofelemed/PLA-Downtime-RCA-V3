import type { ProductionEventView } from '@/api/v2/types/events';
import { statementHref } from '@/features/pla-analytics/model/statement-page';

/** Why "View accounting" is not offered for an event without a period. */
export const NO_ACCOUNTING_PERIOD = 'No accounting period covers this event yet';

/**
 * Task 13 "View accounting": the Accounting statement page on the event's period (its unit and window,
 * the row expanded), linking back to the event; null while no period covers the event.
 */
export function accountingHrefOf(event: Pick<ProductionEventView, 'id' | 'unitId' | 'accountingPeriod'>): string | null {
  const period = event.accountingPeriod;
  if (!period) return null;
  return statementHref({ unitId: event.unitId, utcStart: period.utcStart, utcEnd: period.utcEnd, periodId: period.periodId, eventId: event.id });
}
