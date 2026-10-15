import { Dec } from '../actuals/decimal';
import {
  CurrencyAmount,
  LineValuation,
  LineViewValuation,
  VALUATION_VIEWS,
  ValuationView,
} from './valuation.types';

/** One stored cell of the reversed line's approved valuation (`approved_loss_line_valuations`). */
export interface ApprovedValueCell {
  view: ValuationView;
  currency: string;
  /** null = unvalued or no approved FX rate at approval (never zero) */
  amount: Dec | null;
  status: string;
  reason: string | null;
}

/** The approved line a reversal reverses, with its approved quantity and value as stored at approval. */
export interface ReversedLineValue {
  quantity: Dec;
  /** the reversed line's valuation date (its period start) */
  valuationDate: Date;
  cells: readonly ApprovedValueCell[];
}

/** Note on every view of a reversal: the amount is the reversed line's approved value, never re-priced. */
export const REVERSAL_NOTE = 'reversed_line_approved_value';
/** The reversed line has no approved valuation (approved before plan 2.6, or not found). */
export const REVERSED_LINE_UNVALUED = 'reversed_line_unvalued';
/** The reversed line was not valued in this reporting currency at its approval. */
export const REVERSED_CURRENCY_MISSING = 'reversed_line_currency_missing';

/** First valuation engine that values reversals at the reversed line's approved value. */
const APPROVED_VALUE_SINCE = [2, 8, 1];

/**
 * Whether a run's frozen valuation context values reversals at the approved value (≥ 2.8.1); contexts of
 * older runs keep the rule they were calculated with, so their reviewed content and hash never change.
 */
export function valuesReversalsAtApprovedValue(engineVersion: string): boolean {
  const parts = engineVersion.split('.').map((p) => Number.parseInt(p, 10));
  for (let i = 0; i < APPROVED_VALUE_SINCE.length; i++) {
    const part = Number.isNaN(parts[i]) ? 0 : (parts[i] ?? 0);
    if (part !== APPROVED_VALUE_SINCE[i]) return part > APPROVED_VALUE_SINCE[i];
  }
  return true;
}

function amountIn(
  cells: readonly ApprovedValueCell[],
  currency: string,
  ratio: Dec,
): CurrencyAmount {
  const cell = cells.find((c) => c.currency === currency);
  if (!cell) {
    return {
      currency,
      amount: null,
      reason: REVERSED_CURRENCY_MISSING,
      fxRateIds: [],
      native: false,
    };
  }
  return {
    currency,
    amount: cell.amount === null ? null : cell.amount.mul(ratio),
    reason: cell.amount === null ? (cell.reason ?? 'fx_rate_missing') : null,
    fxRateIds: [],
    native: false,
  };
}

function viewOf(
  view: ValuationView,
  cells: readonly ApprovedValueCell[],
  ratio: Dec,
  currencies: readonly string[],
): LineViewValuation {
  const valued = cells.some((c) => c.status === 'valued');
  if (!valued) {
    const reason =
      cells.find((c) => c.reason)?.reason ?? REVERSED_LINE_UNVALUED;
    return {
      view,
      status: 'unvalued',
      reason,
      components: [],
      amounts: currencies.map((currency) => ({
        currency,
        amount: null,
        reason,
        fxRateIds: [],
        native: false,
      })),
      notes: [REVERSAL_NOTE],
    };
  }
  return {
    view,
    status: 'valued',
    reason: null,
    components: [],
    amounts: currencies.map((currency) => amountIn(cells, currency, ratio)),
    notes: [REVERSAL_NOTE],
  };
}

/**
 * SME R9 reversal valuation (valuation 2.8.1, common practice for a correcting entry): a reversal carries
 * the reversed line's **approved** value with the opposite sign, pro rata to the reversed quantity
 * (`reversal quantity / approved quantity`, negative), on the same views and in the same currencies as
 * approved — the FX of the original approval included. It is never re-priced at the reversing period's
 * rates. No stored valuation → every view `unvalued` (`reversed_line_unvalued`); a reporting currency the
 * original was not valued in → null amount (`reversed_line_currency_missing`). Pure.
 */
export function reversalValuation(
  quantity: Dec,
  reversed: ReversedLineValue | null,
  fallback: {
    views: readonly ValuationView[];
    currencies: readonly string[];
    date: Date;
  },
): LineValuation {
  const usable =
    reversed && !reversed.quantity.isZero() && reversed.cells.length > 0;
  if (!usable) {
    return {
      valuationDate: fallback.date,
      seconds: null,
      views: fallback.views.map((view) =>
        viewOf(view, [], new Dec(0), fallback.currencies),
      ),
    };
  }
  const ratio = quantity.div(reversed.quantity);
  const views = VALUATION_VIEWS.filter((view) =>
    reversed.cells.some((c) => c.view === view),
  );
  return {
    valuationDate: reversed.valuationDate,
    seconds: null,
    views: views.map((view) =>
      viewOf(
        view,
        reversed.cells.filter((c) => c.view === view),
        ratio,
        fallback.currencies,
      ),
    ),
  };
}
