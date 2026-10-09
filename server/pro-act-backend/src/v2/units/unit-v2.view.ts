import { Unit } from '../../unit/unit.entity';

/** `GET /api/v2/units` item: what a unit picker needs (plan 3.2), nothing tenant-internal. */
export interface UnitV2View {
  id: string;
  code: string;
  name: string;
  /** null = the tenant's default site (plan 2.1) */
  siteId: string | null;
}

export function toUnitView(unit: Unit): UnitV2View {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    siteId: unit.siteId ?? null,
  };
}
