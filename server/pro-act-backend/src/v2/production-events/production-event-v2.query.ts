import { SelectQueryBuilder } from 'typeorm';
import { applyIsOpenFilter } from '../../common/query/open-event-filter';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { SortSpec } from '../common/sort-spec';
import { applyPossibleDuplicateFilter } from './possible-duplicate-filter';
import { applyPossibleRepeatFilter } from './possible-repeat-filter';
import {
  ProductionEventListQueryDto,
  ProductionEventSortField,
  VerificationState,
} from './production-event-list-query.dto';
import { applyEventKeyset, sortKeyOf } from './production-event-sort';

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
  asOf: Date = new Date(),
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
  applyMinDurationFilter(qb, query.minDurationSeconds, { alias, asOf });
  applyVerificationFilter(qb, query.verificationStates, alias);
  if (query.q) {
    qb.andWhere(
      `(${alias}.description ILIKE :textQuery OR ${alias}.eventId ILIKE :textQuery)`,
      { textQuery: containsPattern(query.q) },
    );
  }
  return qb;
}

/** Keyset condition of the list for its sort (see `applyEventKeyset`). */
export function applyKeysetCursor(
  qb: SelectQueryBuilder<ProductionEvent>,
  cursor: string | undefined,
  sort: SortSpec<ProductionEventSortField>,
  alias = 'event',
): SelectQueryBuilder<ProductionEvent> {
  return applyEventKeyset(qb, cursor, sort, alias);
}

/**
 * UX E-1 `minDurationSeconds`: closed events by their stored `end − start`, events without an end by the
 * time elapsed until `asOf` (the `elapsedSeconds` the response shows), written as a start bound.
 */
export function applyMinDurationFilter(
  qb: SelectQueryBuilder<ProductionEvent>,
  minDurationSeconds: number | undefined,
  input: { alias: string; asOf: Date },
): SelectQueryBuilder<ProductionEvent> {
  if (minDurationSeconds === undefined) return qb;
  const { alias, asOf } = input;
  // closed branch on the duration sort key (IDX_production_events_tenant_duration), open branch on the start
  const key = sortKeyOf('durationSeconds', alias);
  return qb.andWhere(
    `((${alias}.endTime IS NOT NULL AND ${key} >= :minDurationSeconds) OR ` +
      `(${alias}.endTime IS NULL AND ${alias}.startTime <= :openStartedBy))`,
    {
      minDurationSeconds,
      openStartedBy: new Date(asOf.getTime() - minDurationSeconds * 1000),
    },
  );
}

/** UX E-7: verified = `verified_at` set (SME D13 supervisor verification); both values = no filter. */
export function applyVerificationFilter(
  qb: SelectQueryBuilder<ProductionEvent>,
  states: readonly VerificationState[] | undefined,
  alias: string,
): SelectQueryBuilder<ProductionEvent> {
  const wanted = new Set(states ?? []);
  if (wanted.size !== 1) return qb;
  return wanted.has('verified')
    ? qb.andWhere(`${alias}.verifiedAt IS NOT NULL`)
    : qb.andWhere(`${alias}.verifiedAt IS NULL`);
}
