import { EntityManager, In } from 'typeorm';
import { ProductionEvent } from '../production-event.entity';
import { EventFacts, factsOf, sameFact } from './event-facts';
import { EventReviewItem } from './event-review-item.entity';

/**
 * Overridden fields the source now delivers with exactly the user's value (plan 1.4, DT10: a closed
 * source-owned event waits until the source confirms the end). Such an override is no longer needed.
 */
export function confirmedOverrides(
  existing: ProductionEvent,
  facts: EventFacts,
  overridden: readonly string[],
): string[] {
  const current = factsOf(existing, overridden);
  return overridden.filter((field) =>
    sameFact(facts[field] ?? null, current[field] ?? null),
  );
}

/** `overrides` without `fields`. */
export function withoutOverrides(
  overrides: Readonly<Record<string, number>>,
  fields: readonly string[],
): Record<string, number> {
  const remaining = { ...overrides };
  for (const field of fields) delete remaining[field];
  return remaining;
}

/** Open review items of the confirmed fields are resolved by the source itself (no person). */
export async function resolveConfirmed(
  manager: EntityManager,
  eventId: string,
  fields: readonly string[],
): Promise<void> {
  if (fields.length === 0) return;
  await manager
    .getRepository(EventReviewItem)
    .update(
      { eventId, field: In([...fields]), state: 'open' },
      { state: 'accepted_source', resolvedAt: new Date(), resolvedBy: null },
    );
}
