import { Dec, formatDec, toDec, ZERO } from '../../domain/actuals/decimal';
import {
  amountOf,
  LOSS_TREE_BASIS,
  LossTreeCell,
  LossTreeGroupView,
  LossTreeRequest,
  LossTreeTotalView,
  LossTreeView,
  statusOf,
} from './loss-tree-report';
import { LOSS_TREE_METRICS } from './pla-reports.dto';
import { valuationStatusOf } from '../reports/loss-value-default';

const ratio = (part: Dec | null, whole: Dec | null) =>
  part === null || whole === null || whole.isZero()
    ? null
    : formatDec(part.div(whole).toDecimalPlaces(10));

function totalOf(
  unit: string | null,
  rows: readonly LossTreeCell[],
  quantity: boolean,
): { view: LossTreeTotalView; amount: Dec | null } {
  const sum = (pick: (r: LossTreeCell) => number) =>
    rows.reduce((n, r) => n + pick(r), 0);
  const counts = {
    valued: sum((r) => r.valued),
    unvalued: sum((r) => r.unvalued),
    fx_missing: sum((r) => r.fx_missing),
  };
  const raw = rows.reduce((acc, r) => acc.plus(toDec(r.amount) ?? ZERO), ZERO);
  const known = quantity || (counts.valued > 0 && counts.fx_missing === 0);
  const amount = known ? raw : null;
  return {
    amount,
    view: {
      unit,
      amount: amount === null ? null : formatDec(amount),
      lines: sum((r) => r.lines),
      groups: rows.length,
      status: statusOf(counts, quantity),
      fxProvisional: rows.some((r) => r.fx_provisional > 0),
      reasons: [...new Set(rows.flatMap((r) => r.reasons ?? []))].sort(),
    },
  };
}

function paretoOf(
  rows: readonly LossTreeCell[],
  total: Dec | null,
  input: { labels: Map<string, string>; quantity: boolean },
): LossTreeGroupView[] {
  const valued = rows.map((row) => ({
    row,
    amount: amountOf(row, input.quantity),
  }));
  valued.sort((a, b) => {
    if (a.amount === null || b.amount === null)
      return a.amount === null ? (b.amount === null ? 0 : 1) : -1;
    return (
      b.amount.comparedTo(a.amount) ||
      (a.row.group_key ?? '').localeCompare(b.row.group_key ?? '')
    );
  });
  let running = ZERO;
  return valued.map(({ row, amount }) => {
    if (amount !== null) running = running.plus(amount);
    return {
      key: row.group_key,
      label: row.group_key ? (input.labels.get(row.group_key) ?? null) : null,
      unit: row.unit,
      amount: amount === null ? null : formatDec(amount),
      share: ratio(amount, total),
      cumulativeShare: amount === null ? null : ratio(running, total),
      lines: row.lines,
      eventLines: row.event_lines,
      status: statusOf(row, input.quantity),
      fxProvisional: row.fx_provisional > 0,
      reasons: [...(row.reasons ?? [])].sort(),
    };
  });
}

/**
 * The loss tree of plan 3.6 from its SQL cells: per unit of measure (or currency) the groups largest first
 * with share and cumulative share (Pareto), and the unit's total over every group; values follow VAL02 /
 * T45 (null when nothing is valued or an FX rate is missing, never 0). `limit` keeps the largest groups.
 */
export interface LossTreeShown {
  limit?: number;
  calculationRunIds: string[];
  defaultView: boolean;
  periods: number;
  approvedPeriods: number;
}

export function lossTreeView(
  cells: { rows: LossTreeCell[]; labels: Map<string, string> },
  request: LossTreeRequest & LossTreeShown,
): LossTreeView {
  const quantity = request.metric === 'qty';
  const units = [...new Set(cells.rows.map((r) => r.unit))].sort((a, b) =>
    (a ?? '').localeCompare(b ?? ''),
  );
  const groups: LossTreeGroupView[] = [];
  const totals: LossTreeTotalView[] = [];
  let truncated = 0;
  for (const unit of units) {
    const rows = cells.rows.filter((r) => r.unit === unit);
    const total = totalOf(unit, rows, quantity);
    totals.push(total.view);
    const pareto = paretoOf(rows, total.amount, {
      labels: cells.labels,
      quantity,
    });
    const kept = request.limit ? pareto.slice(0, request.limit) : pareto;
    truncated += pareto.length - kept.length;
    groups.push(...kept);
  }
  return {
    groupBy: request.groupBy,
    metric: request.metric,
    view: LOSS_TREE_METRICS[request.metric],
    defaultView: request.defaultView,
    valuationStatus: valuationStatusOf({
      periods: request.periods,
      approved: request.approvedPeriods,
    }),
    approvedPeriods: request.approvedPeriods,
    periods: request.periods,
    ledger: request.ledger,
    basis: LOSS_TREE_BASIS,
    groups,
    totals,
    truncated,
    calculationRunIds: request.calculationRunIds,
  };
}
