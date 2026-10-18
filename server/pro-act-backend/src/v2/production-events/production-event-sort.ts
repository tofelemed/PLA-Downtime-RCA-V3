import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  CursorCodec,
  CursorPayload,
  invalidCursor,
} from '../common/cursor-codec';
import { SortSpec } from '../common/sort-spec';
import { ProductionEventSortField } from './production-event-list-query.dto';

/** Cursor value of a running event in a `durationSeconds` sort (its sort key is +Infinity). */
export const OPEN_DURATION_CURSOR = 'Infinity';

/**
 * Sort key of a v2 event list. `durationSeconds` is the stored `end − start`; an event without an end
 * (still running) sorts as the longest (`'Infinity'::numeric`), a stable key that keeps keyset pages
 * consistent while the stop keeps running (UX E-1, plans/DECISIONS.md 2026-10-18). The expression matches
 * `IDX_production_events_tenant_duration` exactly so the index serves the sort.
 */
export function sortKeyOf(
  field: ProductionEventSortField,
  alias: string,
): string {
  if (field === 'durationSeconds') {
    return `COALESCE(${alias}.durationSeconds, CAST('Infinity' AS numeric))`;
  }
  return `${alias}.${field}`;
}

/** `ORDER BY <sort key> <dir>, id <dir>`. */
export function applyEventOrder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  sort: SortSpec<ProductionEventSortField>,
  alias = 'event',
): SelectQueryBuilder<T> {
  return qb
    .orderBy(sortKeyOf(sort.field, alias), sort.direction)
    .addOrderBy(`${alias}.id`, sort.direction);
}

/** Cursor of the last row of a page for the sort in use. */
export function cursorOf(
  event: Pick<ProductionEvent, 'id' | 'startTime' | 'durationSeconds'>,
  field: ProductionEventSortField,
): string {
  const payload: CursorPayload = { id: event.id, sortValue: null };
  if (field === 'durationSeconds') {
    const duration = event.durationSeconds;
    payload.sortValue =
      duration === null || duration === undefined
        ? OPEN_DURATION_CURSOR
        : Number(duration);
  } else {
    payload.sortValue = new Date(event.startTime).toISOString();
  }
  return CursorCodec.encode(payload);
}

/** The decoded cursor value as a bind parameter for the sort key; 400 INVALID_CURSOR when it does not fit. */
function boundaryOf(
  sortValue: CursorPayload['sortValue'],
  field: ProductionEventSortField,
): Date | string {
  if (field === 'durationSeconds') {
    if (sortValue === OPEN_DURATION_CURSOR) return OPEN_DURATION_CURSOR;
    if (typeof sortValue === 'number' && sortValue >= 0)
      return String(sortValue);
    throw invalidCursor();
  }
  const boundary = sortValue === null ? new Date(NaN) : new Date(sortValue);
  if (Number.isNaN(boundary.getTime())) throw invalidCursor();
  return boundary;
}

/**
 * Keyset condition for `ORDER BY <sort key> <dir>, id <dir>`: rows strictly after the cursor position, as a
 * row comparison so an index on `(tenant, <sort key>, id)` bounds the scan (DB-06). Never OFFSET (API01).
 */
export function applyEventKeyset<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  cursor: string | undefined,
  sort: SortSpec<ProductionEventSortField>,
  alias = 'event',
): SelectQueryBuilder<T> {
  if (!cursor) return qb;
  const { sortValue, id } = CursorCodec.decode(cursor);
  const boundary = boundaryOf(sortValue, sort.field);
  const operator = sort.direction === 'DESC' ? '<' : '>';
  const key = sortKeyOf(sort.field, alias);
  const bound =
    sort.field === 'durationSeconds'
      ? 'CAST(:cursorSort AS numeric)'
      : ':cursorSort';
  return qb.andWhere(
    `(${key}, ${alias}.id) ${operator} (${bound}, :cursorId)`,
    { cursorSort: boundary, cursorId: id },
  );
}
