import { EntityManager } from 'typeorm';
import { toDec, ZERO } from '../../domain/actuals/decimal';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { CursorCodec } from '../common/cursor-codec';
import { LIST_LIMIT_DEFAULT } from '../common/list-query.dto';

/** How far back a reversal may reach (the reconciliation queue window, SME R3). */
export const REVERSIBLE_WINDOW_DAYS = 62;

/** An approved line of an earlier period of the unit that a reversal may still reverse (SME R9). */
export interface ReversibleLineV2View {
  id: string;
  periodId: string;
  localDate: string;
  shiftName: string | null;
  kind: string;
  quantity: string;
  uom: string | null;
  reasonCodeId: string | null;
  causeEventId: string | null;
  /** already reversed by the published revisions of other periods (signed) */
  reversedQuantity: string;
  /** what a reversal of this line may still take back (absolute) */
  remainingQuantity: string;
}

interface Row {
  id: string;
  period_id: string;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  kind: string;
  quantity: string;
  uom: string | null;
  reason_code_id: string | null;
  cause_event_id: string | null;
  reversed: string | null;
}

/**
 * Lines of the published revisions of the unit's earlier periods (window: 62 days before the period), of the
 * policy's reversible kinds, newest period first, keyset on (period start, line id). Fully reversed lines are
 * left out. Uses IDX_production_periods_tenant_date and the approved-ledger indexes.
 */
const SQL = `SELECT l."id", l."period_id", to_char(p."local_date", 'YYYY-MM-DD') AS "local_date", p."shift_name",
       p."utc_start", l."kind"::text AS "kind", l."quantity"::text AS "quantity", l."uom",
       l."reason_code_id", l."cause_event_id",
       (SELECT sum(al."quantity") FROM "reconciliation_lines" rl
          JOIN "approved_loss_lines" al ON al."source" = 'line' AND al."source_id" = rl."id"
          JOIN "accounting_revisions" ar ON ar."id" = al."revision_id"
         WHERE rl."reverses_line_id" = l."id" AND al."period_id" <> $2
           AND NOT EXISTS (SELECT 1 FROM "accounting_revisions" newer
                            WHERE newer."period_id" = ar."period_id" AND newer."lifecycle" = 'approved'
                              AND newer."revision" > ar."revision"))::text AS "reversed"
  FROM "production_periods" p
  JOIN "accounting_revisions" r ON r."period_id" = p."id" AND r."lifecycle" = 'approved'
  JOIN "approved_loss_lines" l ON l."revision_id" = r."id"
 WHERE p."tenant_id" = $1 AND p."unit_id" = $3 AND p."utc_start" < $4 AND p."local_date" >= $5::date
   AND NOT EXISTS (SELECT 1 FROM "accounting_revisions" later
                    WHERE later."period_id" = p."id" AND later."lifecycle" = 'approved' AND later."revision" > r."revision")
   AND l."kind"::text = ANY($6::text[]) AND l."quantity" <> 0
   AND ($7::timestamptz IS NULL OR (p."utc_start", l."id") < ($7::timestamptz, $8::uuid))
 ORDER BY p."utc_start" DESC, l."id" DESC
 LIMIT $9`;

function toView(row: Row): ReversibleLineV2View {
  const quantity = toDec(row.quantity) ?? ZERO;
  const reversed = toDec(row.reversed) ?? ZERO;
  return {
    id: row.id,
    periodId: row.period_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    kind: row.kind,
    quantity: quantity.toString(),
    uom: row.uom,
    reasonCodeId: row.reason_code_id,
    causeEventId: row.cause_event_id,
    reversedQuantity: reversed.toString(),
    remainingQuantity: quantity.abs().minus(reversed.abs()).toString(),
  };
}

/** One keyset page of the reversible lines of a period's unit (SME R9). */
export async function reversibleLines(
  manager: EntityManager,
  input: {
    period: ProductionPeriod;
    kinds: readonly string[];
    cursor?: string;
    limit?: number;
  },
): Promise<{ items: ReversibleLineV2View[]; nextCursor: string | null }> {
  const { period } = input;
  const limit = input.limit ?? LIST_LIMIT_DEFAULT;
  const after = input.cursor ? CursorCodec.decode(input.cursor) : null;
  const since = new Date(
    period.utcStart.getTime() - REVERSIBLE_WINDOW_DAYS * 86_400_000,
  );
  const rows: Row[] = await manager.query(SQL, [
    period.tenantId,
    period.id,
    period.unitId,
    period.utcStart,
    since.toISOString().slice(0, 10),
    [...input.kinds],
    after ? String(after.sortValue) : null,
    after ? after.id : null,
    limit + 1,
  ]);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? CursorCodec.encode({
          sortValue: new Date(last.utc_start).toISOString(),
          id: last.id,
        })
      : null;
  return {
    items: page
      .map(toView)
      .filter((v) => !(toDec(v.remainingQuantity) ?? ZERO).lte(0)),
    nextCursor,
  };
}
