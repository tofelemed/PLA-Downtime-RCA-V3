import { SelectQueryBuilder } from 'typeorm';
import { applyIsOpenFilter } from '../../common/query/open-event-filter';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { SortSpec } from '../common/sort-spec';
import { applyPossibleDuplicateFilter } from './possible-duplicate-filter';
import { applyPossibleRepeatFilter } from './possible-repeat-filter';
import {
  ProductionEventListQueryDto,
  ProductionEventSortField,
} from './production-event-list-query.dto';

type ArrayFilter = Extract<
  keyof ProductionEventListQueryDto,
  | 'unitIds'
  | 'assetIds'
  | 'reasonIds'
  | 'eventTypes'
  | 'statuses'
  | 'physicalTypes'
  | 'scheduleClasses'
  | 'oeeComponents'
  | 'physicalStates'
  | 'codingStates'
  | 'rcaStates'
  | 'sourceKinds'
  | 'severities'
>;

/** query parameter → entity property; OR within a parameter (IN), AND across parameters. */
const ARRAY_FILTERS: ReadonlyArray<[ArrayFilter, string]> = [
  ['unitIds', 'unitId'],
  ['assetIds', 'assetId'],
  ['reasonIds', 'reasonCodeId'],
  ['eventTypes', 'eventType'],
  ['statuses', 'status'],
  ['physicalTypes', 'physicalType'],
  ['scheduleClasses', 'scheduleClass'],
  ['oeeComponents', 'oeeComponent'],
  ['physicalStates', 'physicalState'],
  ['codingStates', 'codingState'],
  ['rcaStates', 'rcaState'],
  ['sourceKinds', 'sourceKind'],
  ['severities', 'severity'],
];

/** `%text%` for ILIKE with the LIKE wildcards and the escape character of the text taken literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

/** The filters of the list (shared by the CSV export): everything but paging and sort. */
export type ProductionEventFilters = Omit<
  ProductionEventListQueryDto,
  'cursor' | 'limit' | 'sort'
>;

export function applyProductionEventV2Filters(
  qb: SelectQueryBuilder<ProductionEvent>,
  query: ProductionEventFilters,
  alias = 'event',
): SelectQueryBuilder<ProductionEvent> {
  for (const [param, property] of ARRAY_FILTERS) {
    const values = query[param];
    if (Array.isArray(values) && values.length > 0) {
      qb.andWhere(`${alias}.${property} IN (:...${param})`, {
        [param]: values,
      });
    }
  }
  applyOverlapWindow(
    qb,
    { alias, start: 'startTime', end: 'endTime' },
    query.from,
    query.to,
  );
  applyIsOpenFilter(qb, query.isOpen, alias);
  applyPossibleDuplicateFilter(qb, query.possibleDuplicate, alias);
  applyPossibleRepeatFilter(qb, query, alias);
  if (query.q) {
    qb.andWhere(
      `(${alias}.description ILIKE :textQuery OR ${alias}.eventId ILIKE :textQuery)`,
      { textQuery: containsPattern(query.q) },
    );
  }
  return qb;
}

/**
 * Keyset condition for `ORDER BY <sort> <dir>, id <dir>`: rows strictly after the cursor position, as a
 * row comparison so an index on `(…, sort, id)` bounds the scan (DB-06). Never OFFSET (API01): inserting
 * or deleting rows elsewhere cannot shift the page boundary.
 */
export function applyKeysetCursor(
  qb: SelectQueryBuilder<ProductionEvent>,
  cursor: string | undefined,
  sort: SortSpec<ProductionEventSortField>,
  alias = 'event',
): SelectQueryBuilder<ProductionEvent> {
  if (!cursor) {
    return qb;
  }
  const { sortValue, id } = CursorCodec.decode(cursor);
  const boundary = sortValue === null ? new Date(NaN) : new Date(sortValue);
  if (Number.isNaN(boundary.getTime())) {
    throw invalidCursor();
  }
  const operator = sort.direction === 'DESC' ? '<' : '>';
  const column = `${alias}.${sort.field}`;
  qb.andWhere(`(${column}, ${alias}.id) ${operator} (:cursorSort, :cursorId)`, {
    cursorSort: boundary,
    cursorId: id,
  });
  return qb;
}
