import { EntityManager } from 'typeorm';
import { Dec, toDec, ZERO } from '../domain/actuals/decimal';
import { reversibleKindsOf } from '../periods/reconciliation-options';
import { ShapedLine } from './line-shape';
import { RevisionState } from './revision-state';
import { lineInvalid } from './workflow-errors';

/** An approved line a reversal names, with what approved reversals of other periods already took back. */
export interface ReversedLineRow {
  id: string;
  kind: string;
  quantity: string | null;
  uom: string | null;
  period_id: string;
  unit_id: string;
  utc_start: Date;
  /** belongs to the published (latest approved) revision of its period */
  is_current: boolean;
  /** Σ quantity of reversals of it in the published revisions of other periods (signed) */
  reversed: string | null;
}

/**
 * Approved lines by id with their period and the reversals already approved elsewhere (published revisions
 * only; the period being edited is left out — its own earlier lines are replaced, never added).
 */
export const REVERSED_LINES_SQL = `SELECT l."id", l."kind"::text AS "kind", l."quantity"::text AS "quantity", l."uom",
       l."period_id", p."unit_id", p."utc_start",
       NOT EXISTS (SELECT 1 FROM "accounting_revisions" later
                    WHERE later."period_id" = r."period_id" AND later."lifecycle" = 'approved'
                      AND later."revision" > r."revision") AS "is_current",
       (SELECT sum(al."quantity") FROM "reconciliation_lines" rl
          JOIN "approved_loss_lines" al ON al."source" = 'line' AND al."source_id" = rl."id"
          JOIN "accounting_revisions" ar ON ar."id" = al."revision_id"
         WHERE rl."reverses_line_id" = l."id" AND al."period_id" <> $3
           AND NOT EXISTS (SELECT 1 FROM "accounting_revisions" newer
                            WHERE newer."period_id" = ar."period_id" AND newer."lifecycle" = 'approved'
                              AND newer."revision" > ar."revision"))::text AS "reversed"
  FROM "approved_loss_lines" l
  JOIN "accounting_revisions" r ON r."id" = l."revision_id"
  JOIN "production_periods" p ON p."id" = l."period_id"
 WHERE l."tenant_id" = $1 AND l."id" = ANY($2::uuid[])`;

const dec = (value: string | null): Dec => toDec(value) ?? ZERO;

function target(
  row: ReversedLineRow | undefined,
  line: ShapedLine,
  state: RevisionState,
): ReversedLineRow {
  const { period } = state;
  const valid =
    row &&
    row.is_current &&
    row.unit_id === period.unitId &&
    row.period_id !== period.id &&
    new Date(row.utc_start).getTime() < period.utcStart.getTime();
  if (!valid) {
    throw lineInvalid(
      'REVERSAL_TARGET_INVALID',
      line.index,
      'reversesLineId must be a line of the published revision of an earlier period of this unit',
    );
  }
  return row;
}

function assertKindAndUnit(
  row: ReversedLineRow,
  line: ShapedLine,
  state: RevisionState,
): void {
  if (!reversibleKindsOf(state.tolerance.body).includes(row.kind)) {
    throw lineInvalid(
      'REVERSAL_KIND_NOT_ALLOWED',
      line.index,
      `the tolerance policy does not allow reversing a ${row.kind} line`,
    );
  }
  const uom = state.totals.find((t) => t.sliceId === line.sliceId)?.uom ?? null;
  if (row.uom && uom && row.uom !== uom) {
    throw lineInvalid(
      'REVERSAL_UOM_MISMATCH',
      line.index,
      `the reversed line is in ${row.uom}, this slice in ${uom}`,
    );
  }
}

/** Opposite sign, never more than what is left of the original after earlier and sibling reversals. */
function assertQuantity(
  row: ReversedLineRow,
  line: ShapedLine,
  taken: Dec,
): Dec {
  const original = dec(row.quantity);
  const quantity = line.quantity ?? ZERO;
  if (
    quantity.isZero() ||
    original.isZero() ||
    quantity.isNegative() === original.isNegative()
  ) {
    throw lineInvalid(
      'REVERSAL_SIGN',
      line.index,
      'a reversal has the opposite sign of the line it reverses',
    );
  }
  const left = original.abs().minus(dec(row.reversed).abs()).minus(taken);
  if (quantity.abs().gt(left)) {
    throw lineInvalid(
      'REVERSAL_EXCEEDS',
      line.index,
      `at most ${left.toString()} of that line is left to reverse`,
    );
  }
  return quantity.abs();
}

/**
 * SME R9 reversal rules of a draft save: a `reversal` line reverses a line of the published revision of an
 * earlier period of the same unit, of a kind the tolerance policy allows (`reversibleKinds`), in the slice's
 * unit of measure, with the opposite sign and at most what is not yet reversed (approved reversals of other
 * periods and the other reversal lines of this save count). 422 with the line index. One query.
 */
export async function checkReversals(
  manager: EntityManager,
  state: RevisionState,
  lines: readonly ShapedLine[],
): Promise<void> {
  const reversals = lines.filter(
    (l) => l.kind === 'reversal' && l.input.reversesLineId,
  );
  if (reversals.length === 0) return;
  const ids = [
    ...new Set(reversals.map((l) => l.input.reversesLineId as string)),
  ];
  const rows: ReversedLineRow[] = await manager.query(REVERSED_LINES_SQL, [
    state.period.tenantId,
    ids,
    state.period.id,
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const taken = new Map<string, Dec>();
  for (const line of reversals) {
    const id = line.input.reversesLineId as string;
    const row = target(byId.get(id), line, state);
    assertKindAndUnit(row, line, state);
    const used = assertQuantity(row, line, taken.get(id) ?? ZERO);
    taken.set(id, (taken.get(id) ?? ZERO).plus(used));
  }
}
