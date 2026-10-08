import { SelectQueryBuilder } from 'typeorm';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { SortSpec } from '../common/sort-spec';
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
];

export function applyProductionEventV2Filters(
  qb: SelectQueryBuilder<ProductionEvent>,
  query: ProductionEventListQueryDto,
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
  if (query.isOpen === true) {
    qb.andWhere(`${alias}.endTime IS NULL`);
  } else if (query.isOpen === false) {
    qb.andWhere(`${alias}.endTime IS NOT NULL`);
  }
  return qb;
}

/**
 * Keyset condition for `ORDER BY <sort> <dir>, id <dir>`: rows strictly after the cursor position.
 * Never OFFSET (API01): inserting or deleting rows elsewhere cannot shift the page boundary.
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
  qb.andWhere(
    `(${column} ${operator} :cursorSort OR (${column} = :cursorSort AND ${alias}.id ${operator} :cursorId))`,
    {
      cursorSort: boundary,
      cursorId: id,
    },
  );
  return qb;
}
