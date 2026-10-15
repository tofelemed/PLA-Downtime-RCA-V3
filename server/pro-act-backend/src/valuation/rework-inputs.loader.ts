import { EntityManager } from 'typeorm';
import { RateTimebase } from '../domain/actuals/actuals.types';
import {
  PlannedRateSnapshot,
  ReworkLotSnapshot,
  ReworkRecoverySnapshot,
} from '../domain/valuation/valuation.types';

/**
 * SME V2 / E3 (valuation 2.8.0): approved rework lots of the period's unit overlapping it ($3, $4), each
 * with its approved recovery movements (any unit, any time: a recovery recorded later recalculates the
 * lot's periods). Superseded, proposed and rejected rows are not evidence.
 */
const REWORK_LOTS_SQL = `SELECT l."id", l."product_id", l."production_start", l."production_end",
       l."quantity"::text AS "quantity", l."uom",
       COALESCE(json_agg(json_build_object(
         'id', r."id", 'start', r."production_start", 'end', r."production_end",
         'quantity', r."quantity"::text, 'remeasured', r."remeasured", 'sameUnit', r."unit_id" = l."unit_id")
         ORDER BY r."production_start", r."id") FILTER (WHERE r."id" IS NOT NULL), '[]'::json) AS "recoveries"
  FROM "lot_dispositions" l
  LEFT JOIN "lot_dispositions" r
    ON r."recovery_of_id" = l."id" AND r."tenant_id" = l."tenant_id" AND r."state" = 'approved'
 WHERE l."tenant_id" = $1 AND l."unit_id" = $2 AND l."state" = 'approved' AND l."disposition_class" = 'rework'
   AND l."production_start" < $4 AND l."production_end" > $3
 GROUP BY l."id"
 ORDER BY l."production_start", l."id"`;

/** Approved planning rate versions of the slices' profiles (rework time may fall outside the period). */
const PLANNED_RATES_SQL = `SELECT "id", "version", "profile_id", "rate"::text AS "rate", "timebase", "effective_from", "effective_to"
  FROM "unit_product_rates"
 WHERE "tenant_id" = $1 AND "profile_id" = ANY($2::uuid[]) AND "state" = 'approved' AND "rate_kind" = 'planning'
 ORDER BY "id"`;

interface RecoveryJson {
  id: string;
  start: string;
  end: string;
  quantity: string;
  remeasured: boolean;
  sameUnit: boolean;
}

interface LotRow {
  id: string;
  product_id: string;
  production_start: Date;
  production_end: Date;
  quantity: string;
  uom: string;
  recoveries: RecoveryJson[] | string;
}

interface PlannedRow {
  id: string;
  version: number;
  profile_id: string;
  rate: string;
  timebase: RateTimebase;
  effective_from: Date;
  effective_to: Date | null;
}

const isoOf = (value: Date | string) => new Date(value).toISOString();

function toRecovery(json: RecoveryJson): ReworkRecoverySnapshot {
  return {
    id: json.id,
    start: isoOf(json.start),
    end: isoOf(json.end),
    quantity: json.quantity,
    remeasured: json.remeasured,
    sameUnit: json.sameUnit,
  };
}

function toLot(row: LotRow): ReworkLotSnapshot {
  const recoveries: RecoveryJson[] =
    typeof row.recoveries === 'string'
      ? (JSON.parse(row.recoveries) as RecoveryJson[])
      : row.recoveries;
  return {
    id: row.id,
    productId: row.product_id,
    start: isoOf(row.production_start),
    end: isoOf(row.production_end),
    quantity: row.quantity,
    uom: row.uom,
    recoveries: recoveries.map(toRecovery),
  };
}

function toPlanned(row: PlannedRow): PlannedRateSnapshot {
  return {
    id: row.id,
    version: row.version,
    profileId: row.profile_id,
    rate: row.rate,
    timebase: row.timebase,
    from: isoOf(row.effective_from),
    to: row.effective_to === null ? null : isoOf(row.effective_to),
  };
}

export interface ReworkInputs {
  reworkLots: ReworkLotSnapshot[];
  plannedRates: PlannedRateSnapshot[];
}

/** What the economic view of rework reads (2.8.0): rework lots with recoveries and the planning rates. */
export async function loadReworkInputs(
  manager: EntityManager,
  period: { tenantId: string; unitId: string; utcStart: Date; utcEnd: Date },
  profileIds: readonly string[],
): Promise<ReworkInputs> {
  const [lots, planned] = await Promise.all([
    manager.query<LotRow[]>(REWORK_LOTS_SQL, [
      period.tenantId,
      period.unitId,
      period.utcStart,
      period.utcEnd,
    ]),
    manager.query<PlannedRow[]>(PLANNED_RATES_SQL, [
      period.tenantId,
      [...new Set(profileIds)].sort(),
    ]),
  ]);
  return { reworkLots: lots.map(toLot), plannedRates: planned.map(toPlanned) };
}
