import { toDec } from '../domain/actuals/decimal';
import { invalid } from '../profiles/profile-errors';

/** SME E2 default: a recorded level is the cover of upstream stops starting up to 24 h after it. */
export const MAX_LEVEL_AGE_SECONDS = 86_400;

/** The quantities of a route body (decimal strings). */
export interface RouteQuantities {
  yieldFactor?: string | null;
  usableInventory?: string | null;
  minOperatingLevel?: string | null;
  maxOperatingLevel?: string | null;
  inventoryUom?: string | null;
  drawRatePerHour?: string | null;
}

/**
 * SME E2 route rules (422): a buffer (usable inventory or an upper operating level) needs its inventory
 * unit and the downstream draw rate (> 0) that turns it into cover; limits are ordered; yield > 0.
 */
export function assertRouteQuantities(input: RouteQuantities): void {
  const yieldFactor = toDec(input.yieldFactor ?? '1');
  if (!yieldFactor || yieldFactor.lte(0))
    throw invalid('INVALID_YIELD', 'yieldFactor must be > 0');
  const buffered =
    input.usableInventory != null || input.maxOperatingLevel != null;
  const draw = toDec(input.drawRatePerHour ?? null);
  if (buffered && (!input.inventoryUom?.trim() || !draw || draw.lte(0))) {
    throw invalid(
      'BUFFER_INCOMPLETE',
      'a buffer needs inventoryUom and a drawRatePerHour > 0',
    );
  }
  const min = toDec(input.minOperatingLevel ?? null);
  const max = toDec(input.maxOperatingLevel ?? null);
  if (min && max && !max.gt(min)) {
    throw invalid(
      'INVALID_LIMITS',
      'maxOperatingLevel must be above minOperatingLevel',
    );
  }
}

/** $1 tenant, $2 the new route's to-unit, $3 its from-unit, $4 / $5 its validity: a path back closes a cycle. */
export const CYCLE_SQL = `WITH RECURSIVE reach("unit_id", "depth") AS (
    SELECT $2::uuid, 0
  UNION
    SELECT r."to_unit_id", reach."depth" + 1
      FROM "plant_flow_routes" r JOIN reach ON r."from_unit_id" = reach."unit_id"
     WHERE r."tenant_id" = $1 AND r."state" = 'approved' AND reach."depth" < 32
       AND tstzrange(r."effective_from", r."effective_to", '[)') && tstzrange($4, $5, '[)'))
SELECT 1 FROM reach WHERE "unit_id" = $3::uuid LIMIT 1`;
