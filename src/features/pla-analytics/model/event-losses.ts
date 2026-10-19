import type { LossTreeView } from '@/api/v2/types/pla-analytics';

/** The attributed loss of one event, per unit of measure (never added across units). */
export interface EventLoss {
  amount: string;
  uom: string | null;
}

/**
 * The loss tree by cause event as a lookup: event id → its attributed loss lines' quantity per unit of
 * measure (QA PLA M2: the loss list shows what the event cost, not the event's own recorded quantity).
 */
export function eventLossesOf(view: LossTreeView | undefined): ReadonlyMap<string, EventLoss[]> {
  const byEvent = new Map<string, EventLoss[]>();
  for (const group of view?.groups ?? []) {
    if (!group.key || group.amount === null) continue;
    byEvent.set(group.key, [...(byEvent.get(group.key) ?? []), { amount: group.amount, uom: group.unit }]);
  }
  return byEvent;
}
