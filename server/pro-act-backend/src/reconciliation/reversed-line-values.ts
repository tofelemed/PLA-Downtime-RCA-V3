import { EntityManager } from 'typeorm';
import { toDec, ZERO } from '../domain/actuals/decimal';
import {
  ApprovedValueCell,
  ReversedLineValue,
} from '../domain/valuation/reversal-valuation';
import {
  VALUATION_VIEWS,
  ValuationView,
} from '../domain/valuation/valuation.types';
import { ReconciliationLine } from './entities/reconciliation-line.entity';

interface Row {
  id: string;
  quantity: string | number;
  utc_start: Date;
  view: string | null;
  currency: string | null;
  amount: string | number | null;
  status: string | null;
  reason: string | null;
}

/**
 * The approved lines the reversal lines name, with their approved valuation cells (VA-01b) and their period
 * start. Uses the primary key of `approved_loss_lines` and IDX_approved_loss_line_valuations_line.
 */
const SQL = `SELECT l."id", l."quantity", p."utc_start", v."view"::text AS "view", v."currency", v."amount",
       v."status", v."reason"
  FROM "approved_loss_lines" l
  JOIN "production_periods" p ON p."id" = l."period_id"
  LEFT JOIN "approved_loss_line_valuations" v ON v."approved_line_id" = l."id"
 WHERE l."tenant_id" = $1 AND l."id" = ANY($2::uuid[])`;

const isView = (value: string | null): value is ValuationView =>
  value !== null && (VALUATION_VIEWS as readonly string[]).includes(value);

function cellOf(row: Row): ApprovedValueCell | null {
  if (!isView(row.view) || !row.currency || !row.status) return null;
  return {
    view: row.view,
    currency: row.currency,
    amount: toDec(row.amount),
    status: row.status,
    reason: row.reason,
  };
}

/**
 * SME R9: the approved value of every line the revision's reversal lines reverse (one query), keyed by the
 * approved line id. A line missing here is valued `reversed_line_unvalued`.
 */
export async function reversedLineValues(
  manager: EntityManager,
  tenantId: string,
  lines: readonly ReconciliationLine[],
): Promise<Map<string, ReversedLineValue>> {
  const ids = [
    ...new Set(
      lines.flatMap((l) =>
        l.kind === 'reversal' && l.reversesLineId ? [l.reversesLineId] : [],
      ),
    ),
  ];
  if (ids.length === 0) return new Map();
  const rows: Row[] = await manager.query(SQL, [tenantId, ids]);
  const values = new Map<string, ReversedLineValue>();
  for (const row of rows) {
    const value = values.get(row.id) ?? {
      quantity: toDec(row.quantity) ?? ZERO,
      valuationDate: new Date(row.utc_start),
      cells: [],
    };
    const cell = cellOf(row);
    values.set(
      row.id,
      cell ? { ...value, cells: [...value.cells, cell] } : value,
    );
  }
  return values;
}
