import { Unit } from '../../unit/unit.entity';
import { toDecimalString } from '../common/decimal-string.transformer';

/**
 * `GET /api/v2/units` item and `GET /api/v2/units/{id}`: what a unit picker needs (plan 3.2) plus the master
 * data the v2 master-data screens edit. `capacity` and `idealCycleTimeSeconds` are v1 values the v2
 * calculations never read (DECISIONS 3.4 "Legacy fields"); decimals are strings.
 */
export interface UnitV2View {
  id: string;
  code: string;
  name: string;
  /** null = the tenant's default site (plan 2.1) */
  siteId: string | null;
  description: string | null;
  unitOfMeasure: string | null;
  /** legacy v1 capacity (decimal string), not used by v2 calculations */
  capacity: string | null;
  /** legacy v1 ideal cycle time in seconds per unit (decimal string), not used by v2 calculations */
  idealCycleTimeSeconds: string | null;
  /** null while the unit is active */
  retiredAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toUnitView(unit: Unit): UnitV2View {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    siteId: unit.siteId ?? null,
    description: unit.description ?? null,
    unitOfMeasure: unit.unitOfMeasure ?? null,
    capacity: toDecimalString(unit.capacity),
    idealCycleTimeSeconds: toDecimalString(unit.idealCycleTime),
    retiredAt: unit.retiredAt ? unit.retiredAt.toISOString() : null,
    rowVersion: unit.rowVersion,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}
