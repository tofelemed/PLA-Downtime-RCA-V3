import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';

export const HANDOVER_EVENT_LIMIT = 100;

export interface HandoverEventView {
  id: string;
  unitId: string;
  unitName: string | null;
  physicalType: string;
  /** still running */
  open: boolean;
  codingState: string;
  verified: boolean;
  start: string;
  end: string | null;
  /** seconds of an ended event (decimal string), null while running */
  seconds: string | null;
  reason: string | null;
  asset: string | null;
  fromProduct: string | null;
  toProduct: string | null;
  description: string | null;
}

interface Row {
  id: string;
  unit_id: string;
  unit_name: string | null;
  physical_type: string;
  physical_state: string;
  coding_state: string;
  verified: boolean;
  start_time: Date;
  end_time: Date | null;
  duration_seconds: string | null;
  reason: string | null;
  asset: string | null;
  from_product: string | null;
  to_product: string | null;
  description: string | null;
}

/** Live loss events overlapping [from, to) on the units, oldest first; $5 = limit + 1 (truncation probe). */
const SQL = `SELECT e."id"::text AS "id", e."unit_id"::text AS "unit_id", un."name" AS "unit_name",
       e."physical_type"::text AS "physical_type", e."physical_state"::text AS "physical_state",
       e."coding_state"::text AS "coding_state", e."verified_at" IS NOT NULL AS "verified",
       e."start_time", e."end_time", e."duration_seconds"::text AS "duration_seconds",
       rc."code" || ' ' || rc."name" AS "reason", a."name" AS "asset",
       fp."code" AS "from_product", tp."code" AS "to_product", e."description"
  FROM "production_events" e
  LEFT JOIN "units" un ON un."id" = e."unit_id"
  LEFT JOIN "reason_codes" rc ON rc."id" = e."reason_code_id" AND rc."tenant_id" = e."tenant_id"
  LEFT JOIN "assets" a ON a."id" = e."asset_id" AND a."tenant_id" = e."tenant_id"
  LEFT JOIN "products" fp ON fp."id" = e."from_product_id" AND fp."tenant_id" = e."tenant_id"
  LEFT JOIN "products" tp ON tp."id" = e."to_product_id" AND tp."tenant_id" = e."tenant_id"
 WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[]) AND e."start_time" < $4
   AND (e."end_time" IS NULL OR e."end_time" > $3)
   AND e."physical_state" IN ('open', 'closed')
   AND e."physical_type" IN ('downtime', 'slowdown', 'quality_loss', 'grade_transition')
 ORDER BY e."start_time", e."id"
 LIMIT $5`;

const toView = (r: Row): HandoverEventView => ({
  id: r.id,
  unitId: r.unit_id,
  unitName: r.unit_name,
  physicalType: r.physical_type,
  open: r.physical_state === 'open',
  codingState: r.coding_state,
  verified: r.verified,
  start: r.start_time.toISOString(),
  end: r.end_time?.toISOString() ?? null,
  seconds:
    r.duration_seconds === null ? null : formatDec(new Dec(r.duration_seconds)),
  reason: r.reason,
  asset: r.asset,
  fromProduct: r.from_product,
  toProduct: r.to_product,
  description: r.description,
});

/** The loss events of a shift for the handover (R2), at most `HANDOVER_EVENT_LIMIT`. */
export async function handoverEvents(
  manager: EntityManager,
  scope: ReportScope,
): Promise<{ events: HandoverEventView[]; truncated: boolean }> {
  const rows: Row[] = await manager.query(SQL, [
    scope.tenantId,
    scope.unitIds,
    scope.from,
    scope.to,
    HANDOVER_EVENT_LIMIT + 1,
  ]);
  return {
    events: rows.slice(0, HANDOVER_EVENT_LIMIT).map(toView),
    truncated: rows.length > HANDOVER_EVENT_LIMIT,
  };
}
