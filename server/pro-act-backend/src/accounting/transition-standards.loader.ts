import { EntityManager } from 'typeorm';
import { TransitionStandard } from '../domain/accounting/accounting.types';
import { ProductionPeriod } from '../periods/entities/production-period.entity';

/** $1 tenant, $2 unit, $3 earliest instant a standard must cover, $4 period end. */
const STANDARDS_SQL = `SELECT "id", "from_product_id", "to_product_id", "reference_seconds"::text AS "reference_seconds",
       "reference_offgrade_qty"::text AS "reference_offgrade_qty", "effective_from", "effective_to"
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
