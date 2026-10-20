import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';

/** Lot dispositions of one class, decision state and product (R4); quantity as a decimal string. */
export interface DispositionGroupView {
  dispositionClass: string;
  /** proposed (awaiting the quality decision), approved or rejected */
  state: string;
  productId: string | null;
  productCode: string | null;
  uom: string;
  lots: number;
  quantity: string;
}

export interface QualityDispositionsView {
  groups: DispositionGroupView[];
  /** proposals still waiting for a decision, and when the oldest was recorded (ISO 8601) */
  pending: number;
  oldestPendingAt: string | null;
}

interface Row {
  disposition_class: string;
  state: string;
  product_id: string | null;
  product_code: string | null;
  uom: string;
  lots: number;
  quantity: string;
  oldest: Date | null;
}

/**
 * Live dispositions (not superseded) of lots produced on the units in [from, to): $1 tenant, $2 units,
 * $3 from, $4 to (IDX_lot_dispositions_tenant_unit_production).
 */
const SQL = `SELECT d."disposition_class", d."state", d."product_id"::text AS "product_id", max(p."code") AS "product_code",
       d."uom", count(*)::int AS "lots", sum(d."quantity")::text AS "quantity",
       min(d."created_at") FILTER (WHERE d."state" = 'proposed') AS "oldest"
  FROM "lot_dispositions" d
  LEFT JOIN "products" p ON p."id" = d."product_id" AND p."tenant_id" = d."tenant_id"
 WHERE d."tenant_id" = $1 AND d."unit_id" = ANY($2::uuid[]) AND d."production_start" >= $3 AND d."production_start" < $4
   AND d."state" <> 'superseded' AND d."superseded_at" IS NULL
 GROUP BY 1, 2, 3, 5
 ORDER BY 1, 2, max(p."code") NULLS LAST, 5`;

export function toDispositionsView(rows: Row[]): QualityDispositionsView {
  const proposed = rows.filter((r) => r.state === 'proposed');
  const oldest = proposed
    .flatMap((r) => (r.oldest ? [r.oldest.getTime()] : []))
    .sort((a, b) => a - b)[0];
  return {
    groups: rows.map((r) => ({
      dispositionClass: r.disposition_class,
      state: r.state,
      productId: r.product_id,
      productCode: r.product_code,
      uom: r.uom,
      lots: r.lots,
      quantity: formatDec(new Dec(r.quantity)),
    })),
    pending: proposed.reduce((sum, r) => sum + r.lots, 0),
    oldestPendingAt:
      oldest === undefined ? null : new Date(oldest).toISOString(),
  };
}

/** `GET /reports/quality-dispositions` (R4): lot dispositions of the window by class, decision and product. */
export async function qualityDispositions(
  manager: EntityManager,
  scope: ReportScope,
): Promise<QualityDispositionsView> {
  const rows: Row[] = await manager.query(SQL, [
    scope.tenantId,
    scope.unitIds,
    scope.from,
    scope.to,
  ]);
  return toDispositionsView(rows);
}
