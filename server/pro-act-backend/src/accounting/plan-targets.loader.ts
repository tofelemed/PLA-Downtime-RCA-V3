import { EntityManager } from 'typeorm';
import { windowTarget } from '../domain/accounting/slice-target';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';

/** A plan period's target with the window it was planned for. */
export interface PlanPeriodTarget {
  id: string;
  target: string;
  start: Date;
  end: Date;
}

interface PlanPeriodRow {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  unit_id: string;
  target: string;
  utc_start: Date;
  utc_end: Date;
}

const OWN_SQL = `SELECT "id", "tenant_id", "plan_version_id", "unit_id", "target"::text AS "target", "utc_start", "utc_end"
  FROM "plan_periods" WHERE "id" = ANY($1::uuid[])`;

/** Plan periods of one plan version and unit overlapping a window (IDX_plan_periods_tenant_unit_start). */
const OVERLAPPING_SQL = `SELECT "id", "tenant_id", "plan_version_id", "unit_id", "target"::text AS "target", "utc_start", "utc_end"
  FROM "plan_periods"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "plan_version_id" = $3 AND "utc_start" < $5 AND "utc_end" > $4
 ORDER BY "utc_start", "id"`;

const toTarget = (row: PlanPeriodRow): PlanPeriodTarget => ({
  id: row.id,
  target: row.target,
  start: new Date(row.utc_start),
  end: new Date(row.utc_end),
});

/** A slice wider than its plan period: the declared slice over the whole period (spec D4). */
const widened = (slice: PeriodProductSlice, own: PlanPeriodRow) =>
  slice.windowFrom < new Date(own.utc_start) ||
  slice.windowTo > new Date(own.utc_end);

/**
 * Slice id → the plan periods whose targets the slice carries: its own plan period, or — for a declared
 * slice widened past it to the whole period — every plan period of the same plan version and unit the slice
 * overlaps (a declared day over three shift plan periods carries their three targets, pro rata).
 */
export async function loadSliceTargets(
  manager: EntityManager,
  slices: readonly PeriodProductSlice[],
): Promise<Map<string, PlanPeriodTarget[]>> {
  const ids = slices.flatMap((s) => (s.planPeriodId ? [s.planPeriodId] : []));
  if (ids.length === 0) return new Map();
  const rows: PlanPeriodRow[] = await manager.query(OWN_SQL, [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const targets = new Map<string, PlanPeriodTarget[]>();
  for (const slice of slices) {
    const own = byId.get(slice.planPeriodId ?? '');
    if (!own) continue;
    if (!widened(slice, own)) {
      targets.set(slice.id, [toTarget(own)]);
      continue;
    }
    const overlapping: PlanPeriodRow[] = await manager.query(OVERLAPPING_SQL, [
      own.tenant_id,
      own.unit_id,
      own.plan_version_id,
      slice.windowFrom,
      slice.windowTo,
    ]);
    targets.set(slice.id, overlapping.map(toTarget));
  }
  return targets;
}

/** The slice's target from the plan periods it carries (LA-07 time shares); null without a plan period. */
export function targetOfSlice(
  slice: PeriodProductSlice,
  targets: ReadonlyMap<string, readonly PlanPeriodTarget[]>,
): string | null {
  const planned = targets.get(slice.id);
  if (!planned) return null;
  return windowTarget(planned, {
    start: slice.windowFrom,
    end: slice.windowTo,
  });
}
