import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { INACTIVE_PHYSICAL_STATES } from '../../domain/events/open-event';

/**
 * `isOpen` filter shared by the v1 and v2 event lists. Open = no end time and not superseded or
 * retracted (`isOpenEvent`); a superseded split parent without an end is not a running stop, so it
 * belongs to `isOpen=false`.
 */
export function applyIsOpenFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  isOpen: boolean | undefined,
  alias: string,
): SelectQueryBuilder<T> {
  if (isOpen === undefined) {
    return qb;
  }
  const params = { inactivePhysicalStates: [...INACTIVE_PHYSICAL_STATES] };
  if (isOpen) {
    return qb.andWhere(
      `${alias}.endTime IS NULL AND ${alias}.physicalState NOT IN (:...inactivePhysicalStates)`,
      params,
    );
  }
  return qb.andWhere(
    `(${alias}.endTime IS NOT NULL OR ${alias}.physicalState IN (:...inactivePhysicalStates))`,
    params,
  );
}
