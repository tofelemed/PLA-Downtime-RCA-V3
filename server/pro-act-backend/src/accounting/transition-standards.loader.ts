import { EntityManager } from 'typeorm';
import { TransitionStandard } from '../domain/accounting/accounting.types';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../periods/entities/production-period.entity';

/** $1 tenant, $2 unit, $3 earliest instant a standard must cover, $4 period end. */
const STANDARDS_SQL = `SELECT "id", "from_product_id", "to_product_id", "reference_seconds"::text AS "reference_seconds",
       "reference_offgrade_qty"::text AS "reference_offgrade_qty", "catalyst_family", "operating_mode",
       "effective_from", "effective_to"
  FROM "transition_standards"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "state" = 'approved'
   AND "effective_from" < $4 AND ("effective_to" IS NULL OR "effective_to" > $3)
 ORDER BY "effective_from", "id"`;

interface StandardRow {
  id: string;
  from_product_id: string;
  to_product_id: string;
  reference_seconds: string;
  reference_offgrade_qty: string | null;
  catalyst_family: string | null;
  operating_mode: string | null;
  effective_from: Date;
  effective_to: Date | null;
}

function toStandard(row: StandardRow): TransitionStandard {
  return {
    id: row.id,
    fromProductId: row.from_product_id,
    toProductId: row.to_product_id,
    referenceSeconds: row.reference_seconds,
    referenceOffgradeQuantity: row.reference_offgrade_qty,
    catalystFamily: row.catalyst_family,
    operatingMode: row.operating_mode,
    from: new Date(row.effective_from),
    to: row.effective_to ? new Date(row.effective_to) : null,
  };
}

/** Standards in force at the start of any transition overlapping the period (it may start before it). */
export async function loadTransitionStandards(
  manager: EntityManager,
  period: ProductionPeriod,
  events: ReadonlyArray<{ physical_type: string; start_time: Date }>,
): Promise<TransitionStandard[]> {
  const starts = events
    .filter((e) => e.physical_type === 'grade_transition')
    .map((e) => new Date(e.start_time).getTime());
  if (starts.length === 0) return [];
  const earliest = new Date(Math.min(...starts));
  const rows: StandardRow[] = await manager.query(STANDARDS_SQL, [
    period.tenantId,
    period.unitId,
    earliest,
    period.utcEnd,
  ]);
  return rows.map(toStandard);
}

/** $1 profile ids of the period's slices. */
const MODES_SQL = `SELECT "product_id", "operating_mode" FROM "production_profiles" WHERE "id" = ANY($1::uuid[])`;

/**
 * SME E1 production context: product → operating mode of the profile its slice runs on. Read only when a
 * grade transition records no operating mode of its own; the profile is part of the run's slices, so the
 * fingerprint already names it.
 */
export async function loadContextModes(
  manager: EntityManager,
  slices: readonly PeriodProductSlice[],
  events: ReadonlyArray<{
    physical_type: string;
    operating_mode: string | null;
  }>,
): Promise<Map<string, string>> {
  const needed = events.some(
    (e) => e.physical_type === 'grade_transition' && e.operating_mode === null,
  );
  const profileIds = slices.flatMap((s) => (s.profileId ? [s.profileId] : []));
  if (!needed || profileIds.length === 0) return new Map();
  const rows: Array<{ product_id: string; operating_mode: string }> =
    await manager.query(MODES_SQL, [profileIds]);
  return new Map(rows.map((r) => [r.product_id, r.operating_mode]));
}
