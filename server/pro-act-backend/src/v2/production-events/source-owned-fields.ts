import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  OVERRIDABLE_FIELDS,
  SOURCE_ATTRIBUTE_FACTS,
} from '../../production-event/revisions/event-facts';

/** The interval of a source event: only manual events accept changes (409 SOURCE_OWNED on PATCH). */
export const INTERVAL_FIELDS = [
  'startTime',
  'endTime',
  'durationSeconds',
] as const;

const ATTRIBUTE_FACTS: readonly string[] = SOURCE_ATTRIBUTE_FACTS;

/**
 * Event fields a user edit records as an override of a source value (ING06 `user_overrides`): the
 * overridable fields of the revision model that are event columns (raw attribute facts such as `reason`
 * live in the source revision only).
 */
const OVERRIDABLE_COLUMNS: readonly string[] = OVERRIDABLE_FIELDS.filter(
  (field) => !ATTRIBUTE_FACTS.includes(field),
);

/**
 * UX E-5: fields of the event its source system owns, under the same rules the writes apply — a
 * non-manual event refuses interval changes (`INTERVAL_FIELDS`), and once a source revision exists every
 * overridable column a user changes becomes a recorded override (`applyUserChangeIn`). Manual events own
 * every field themselves (empty list). Names are the PATCH body's field names.
 */
export function sourceOwnedFields(
  event: Pick<ProductionEvent, 'sourceKind' | 'currentSourceRevision'>,
): string[] {
  if (event.sourceKind === 'manual') return [];
  const owned = new Set<string>(INTERVAL_FIELDS);
  if ((event.currentSourceRevision ?? 0) > 0) {
    for (const field of OVERRIDABLE_COLUMNS) owned.add(field);
  }
  return [...owned];
}
