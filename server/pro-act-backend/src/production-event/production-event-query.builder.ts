import { SelectQueryBuilder } from 'typeorm';
import { applyOverlapWindow } from '../common/query/overlap-window';
import { ProductionEventQueryDto } from './dto/production-event-query.dto';
import { ProductionEvent } from './production-event.entity';

type EqualityFilter = Extract<
  keyof ProductionEventQueryDto,
  | 'tenantId'
  | 'unitId'
  | 'assetId'
  | 'planId'
  | 'reasonCodeId'
  | 'status'
  | 'eventType'
>;

const EQUALITY_FILTERS: readonly EqualityFilter[] = [
  'tenantId',
  'unitId',
  'assetId',
  'planId',
  'reasonCodeId',
  'status',
  'eventType',
];

/** ANDs every provided filter onto the builder (property names map to the entity's columns). */
export function applyProductionEventFilters(
  qb: SelectQueryBuilder<ProductionEvent>,
  query: ProductionEventQueryDto,
  alias = 'event',
): SelectQueryBuilder<ProductionEvent> {
  for (const field of EQUALITY_FILTERS) {
    const value = query[field];
    if (value !== undefined) {
      qb.andWhere(`${alias}.${field} = :${field}`, { [field]: value });
    }
  }
  applyOverlapWindow(
    qb,
    { alias, start: 'startTime', end: 'endTime' },
    query.startDate,
    query.endDate,
  );
  if (query.isOpen === true) {
    qb.andWhere(`${alias}.endTime IS NULL`);
  } else if (query.isOpen === false) {
    qb.andWhere(`${alias}.endTime IS NOT NULL`);
  }
  return qb;
}
