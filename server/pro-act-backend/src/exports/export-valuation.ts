import { Decimal } from 'decimal.js';
import { Dec } from '../domain/actuals/decimal';
import { UNVALUED } from '../reconciliation/period-approval-event';
import {
  ReviewedAmount,
  ReviewedValuation,
} from '../reconciliation/reviewed-valuation';
import { CsvValue } from './csv';

/**
 * Valuation columns of both reports (plan 2.6): the default view, the value in each of the (at most two)
 * reporting currencies of the approved snapshot's policy, its status and reason. Amounts are rounded to 2
 * decimals here only (presentation, VAL03); totals were computed from unrounded values.
 */
export const VALUATION_COLUMNS = [
  'valuation_view',
  'value_1',
  'currency_1',
  'value_2',
  'currency_2',
  'valuation_status',
  'valuation_reason',
];

const PRESENTATION_DECIMALS = 2;

export const VALUATION_HEADER =
  'per row (valuation_view, value_n / currency_n, valuation_status); values rounded to 2 decimals for presentation, totals computed from unrounded values';

/** Presentation rounding of a stored 8-dp amount (half-even, fixed 2 decimals); null stays empty. */
export function presentMoney(amount: string | null): string | null {
  if (amount === null) return null;
  return new Dec(amount)
    .toDecimalPlaces(PRESENTATION_DECIMALS, Decimal.ROUND_HALF_EVEN)
    .toFixed(PRESENTATION_DECIMALS);
}

/** Snapshots approved before plan 2.6 (or of runs without a valuation context) are unvalued. */
export function unvaluedCells(): CsvValue[] {
  return [null, null, null, null, null, UNVALUED.status, UNVALUED.reason];
}

function currencyCells(
  valuation: ReviewedValuation,
  amounts: ReadonlyArray<{ currency: string; amount: string | null }>,
): CsvValue[] {
  const [first, second] = valuation.currencies;
  const of = (currency: string | undefined) =>
    currency ? (amounts.find((a) => a.currency === currency) ?? null) : null;
  return [
    presentMoney(of(first)?.amount ?? null),
    first ?? null,
    presentMoney(of(second)?.amount ?? null),
    second ?? null,
  ];
}

/** Cells of a period-summary row: the slice's loss value in the default view. */
export function sliceValuationCells(
  valuation: ReviewedValuation | undefined,
  sliceId: string,
): CsvValue[] {
  if (!valuation) return unvaluedCells();
  const totals = valuation.slices.filter(
    (s) => s.sliceId === sliceId && s.view === valuation.defaultView,
  );
  if (totals.length === 0) {
    return [
      valuation.defaultView,
      ...currencyCells(valuation, []),
      'valued',
      null,
    ];
  }
  const reasons = [...new Set(totals.flatMap((t) => t.reasons))].sort();
  const status = totals.every((t) => t.status === 'valued')
    ? 'valued'
    : totals.every((t) => t.status === 'unvalued')
      ? 'unvalued'
      : 'mixed';
  return [
    valuation.defaultView,
    ...currencyCells(valuation, totals),
    status,
    reasons.length > 0 ? reasons.join(';') : null,
  ];
}

/** Cells of a loss-line row (candidate or own line) in the default view. */
export function lineValuationCells(
  valuation: ReviewedValuation | undefined,
  line: { source: 'candidate' | 'line'; id: string },
): CsvValue[] {
  if (!valuation) return unvaluedCells();
  const found = valuation.lines.find(
    (l) => l.source === line.source && l.id === line.id,
  );
  const view = found?.views.find((v) => v.view === valuation.defaultView);
  if (!view) {
    return [
      valuation.defaultView,
      ...currencyCells(valuation, []),
      'unvalued',
      'not_valued',
    ];
  }
  const amounts: ReviewedAmount[] = view.amounts;
  const reasons = [
    ...new Set([view.reason, ...amounts.map((a) => a.reason)].filter(Boolean)),
  ].sort();
  return [
    valuation.defaultView,
    ...currencyCells(valuation, amounts),
    view.status,
    reasons.length > 0 ? reasons.join(';') : null,
  ];
}
