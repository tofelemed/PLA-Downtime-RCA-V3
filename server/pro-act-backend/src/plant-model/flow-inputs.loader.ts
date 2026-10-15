import { EntityManager } from 'typeorm';
import {
  EventRow,
  toEvent,
  UPSTREAM_STOPS_SQL,
} from '../accounting/loss-event-rows';
import {
  BufferLevel,
  FlowInput,
  FlowRoute,
} from '../domain/accounting/accounting.types';
import { Dec, formatDec, toDec } from '../domain/actuals/decimal';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { MAX_LEVEL_AGE_SECONDS } from './plant-flow-rules';

/** Upstream stops that started up to this long before the period can still starve it (SME E2 default). */
export const FLOW_LOOKBACK_MS = 7 * 86_400_000;

/** $1 tenant, $2 / $3 window: approved routes of the tenant's map in force over it. */
const ROUTES_SQL = `SELECT "id", "from_unit_id", "to_unit_id", "route_role", "usable_inventory"::text AS "usable_inventory",
       "min_operating_level"::text AS "min_level", "max_operating_level"::text AS "max_level",
       "draw_rate_per_hour"::text AS "draw_rate", "effective_from", "effective_to"
  FROM "plant_flow_routes"
 WHERE "tenant_id" = $1 AND "state" = 'approved'
   AND tstzrange("effective_from", "effective_to", '[)') && tstzrange($2, $3, '[)')
 ORDER BY "effective_from", "id"`;

/** $1 tenant, $2 downstream unit ids, $3 / $4 window. */
const LEVELS_SQL = `SELECT "id", "from_unit_id", "to_unit_id", "observed_at", "level"::text AS "level"
  FROM "buffer_levels"
 WHERE "tenant_id" = $1 AND "to_unit_id" = ANY($2::uuid[]) AND "observed_at" >= $3 AND "observed_at" < $4
 ORDER BY "observed_at", "id"`;

interface RouteRow {
  id: string;
  from_unit_id: string;
  to_unit_id: string;
  route_role: 'feed' | 'alternate';
  usable_inventory: string | null;
  min_level: string | null;
  max_level: string | null;
  draw_rate: string | null;
  effective_from: Date;
  effective_to: Date | null;
}

/** Configured usable inventory: as entered, else the room between the operating limits. */
function usableOf(row: RouteRow): string | null {
  if (row.usable_inventory !== null) return row.usable_inventory;
  const max = toDec(row.max_level);
  if (!max) return null;
  return formatDec(max.minus(toDec(row.min_level) ?? new Dec(0)));
}

const toRoute = (row: RouteRow): FlowRoute => ({
  fromUnitId: row.from_unit_id,
  toUnitId: row.to_unit_id,
  role: row.route_role,
  usableInventory: usableOf(row),
  minLevel: row.min_level,
  drawRatePerHour: row.draw_rate,
  from: new Date(row.effective_from),
  to: row.effective_to ? new Date(row.effective_to) : null,
});

/** Every unit upstream of `unitId` in the map (breadth-first, cycles cut). */
function upstreamOf(unitId: string, routes: readonly RouteRow[]): string[] {
  const seen = new Set<string>([unitId]);
  const queue = [unitId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const route of routes.filter((r) => r.to_unit_id === current)) {
      if (seen.has(route.from_unit_id)) continue;
      seen.add(route.from_unit_id);
      queue.push(route.from_unit_id);
    }
  }
  seen.delete(unitId);
  return [...seen].sort();
}

export interface LoadedFlow {
  flow: FlowInput | null;
  /** route, level and upstream event ids with row versions (run hash material) */
  material: string[];
}

/**
 * SME E2: the material-flow map upstream of the period's unit — approved routes, the recorded stops of
 * every upstream unit and recorded buffer levels since the lookback. Null without a route into the unit
 * (one query; nothing else is read).
 */
export async function loadFlowInputs(
  manager: EntityManager,
  period: ProductionPeriod,
): Promise<LoadedFlow> {
  const from = new Date(period.utcStart.getTime() - FLOW_LOOKBACK_MS);
  const routes: RouteRow[] = await manager.query(ROUTES_SQL, [
    period.tenantId,
    from,
    period.utcEnd,
  ]);
  if (!routes.some((r) => r.to_unit_id === period.unitId))
    return { flow: null, material: [] };
  const upstream = upstreamOf(period.unitId, routes);
  const params = [period.tenantId, upstream, from, period.utcEnd];
  const stops: EventRow[] = await manager.query(UPSTREAM_STOPS_SQL, params);
  const levels: Array<{
    id: string;
    from_unit_id: string;
    to_unit_id: string;
    observed_at: Date;
    level: string;
  }> = await manager.query(LEVELS_SQL, [
    period.tenantId,
    [period.unitId, ...upstream],
    new Date(from.getTime() - MAX_LEVEL_AGE_SECONDS * 1000),
    period.utcEnd,
  ]);
  const bufferLevels: BufferLevel[] = levels.map((l) => ({
    fromUnitId: l.from_unit_id,
    toUnitId: l.to_unit_id,
    at: new Date(l.observed_at),
    level: l.level,
  }));
  return {
    flow: {
      unitId: period.unitId,
      routes: routes.map(toRoute),
      upstreamStops: stops.map((row) => ({
        unitId: row.unit_id,
        event: toEvent(row),
      })),
      levels: bufferLevels,
      maxLevelAgeSeconds: MAX_LEVEL_AGE_SECONDS,
    },
    material: [
      ...routes.map((r) => `route:${r.id}`),
      ...levels.map((l) => `level:${l.id}`),
      ...stops.map(
        (s) => `event:${s.id}:${s.row_version}:${s.revision_id ?? ''}`,
      ),
    ],
  };
}

/** $1 tenant, $2 unit, $3 / $4 window: units downstream of the unit in the approved map (cycles cut). */
const DOWNSTREAM_SQL = `WITH RECURSIVE down("unit_id", "depth") AS (
    SELECT $2::uuid, 0
  UNION
    SELECT r."to_unit_id", down."depth" + 1
      FROM "plant_flow_routes" r JOIN down ON r."from_unit_id" = down."unit_id"
     WHERE r."tenant_id" = $1 AND r."state" = 'approved' AND down."depth" < 32
       AND tstzrange(r."effective_from", r."effective_to", '[)') && tstzrange($3, $4, '[)'))
SELECT DISTINCT "unit_id" FROM down WHERE "unit_id" <> $2::uuid`;

/**
 * SME E2: the units a stop of `unitId` can starve over the window (they recalculate with it). The
 * starvation lies inside the stop, so the stop's own window is enough.
 */
export async function downstreamUnits(
  manager: EntityManager,
  window: { tenantId: string; unitId: string; from: Date; to: Date | null },
): Promise<string[]> {
  const rows: Array<{ unit_id: string }> = await manager.query(DOWNSTREAM_SQL, [
    window.tenantId,
    window.unitId,
    window.from,
    window.to,
  ]);
  return rows.map((r) => r.unit_id).sort();
}
