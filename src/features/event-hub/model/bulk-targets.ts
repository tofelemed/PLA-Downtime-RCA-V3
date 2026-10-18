import { V2ApiError } from '@/api/v2/errors';
import type { BulkTarget } from '@/api/v2/types/events';

/** The one unit all events belong to; null when they span several units (or none are given). */
export function sharedUnitOf(events: readonly Pick<BulkTarget, 'unitId'>[]): string | null {
  const first = events[0]?.unitId ?? null;
  return first !== null && events.every((event) => event.unitId === first) ? first : null;
}

/** The event ids a 422 INVALID_REFERENCE names (`details.eventIds`); empty for any other error. */
export function invalidReferenceIds(error: unknown): string[] {
  if (!(error instanceof V2ApiError) || error.status !== 422 || error.code !== 'INVALID_REFERENCE') return [];
  const ids = error.details?.eventIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}
