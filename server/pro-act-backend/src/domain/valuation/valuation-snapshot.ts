import { Dec, formatDec } from '../actuals/decimal';
import {
  LineValuation,
  LineViewValuation,
  ValuationPolicySnapshot,
  ValuationView,
} from './valuation.types';

/** How amounts are rounded (VAL03): stored with 8 decimals, rounded to currency minor units only when shown. */
export const ROUNDING_POLICY = 'stored_8dp_presentation_minor_units';

export interface StoredComponent {
  rateVersionId: string;
  rateVersion: number;
  from: string;
  to: string;
  currency: string;
  unitValue: string;
  quantity: string | null;
  seconds: string | null;
  amount: string;
}

export interface StoredAmount {
  currency: string;
  amount: string | null;
  reason: string | null;
  fxRateIds: string[];
  native: boolean;
}

export interface StoredView {
  view: ValuationView;
  status: 'valued' | 'unvalued';
  reason: string | null;
  components: StoredComponent[];
  amounts: StoredAmount[];
}

/** `loss_lines.valuation` (VAL03 snapshot): policy, valuation date, rates, FX versions, amounts, rounding. */
export interface StoredLineValuation {
  engineVersion: string;
  policyId: string | null;
  policyVersion: number | null;
  valuationDate: string;
  seconds: string | null;
  roundingPolicy: string;
  views: StoredView[];
}

const str = (value: Dec | null) => (value === null ? null : formatDec(value));
const dec = (value: string | null) => (value === null ? null : new Dec(value));

export function storeView(view: LineViewValuation): StoredView {
  return {
    view: view.view,
    status: view.status,
    reason: view.reason,
    components: view.components.map((c) => ({
      rateVersionId: c.rateVersionId,
      rateVersion: c.rateVersion,
      from: c.from.toISOString(),
      to: c.to.toISOString(),
      currency: c.currency,
      unitValue: formatDec(new Dec(c.unitValue)),
      quantity: str(c.quantity),
      seconds: str(c.seconds),
      amount: formatDec(c.amount),
    })),
    amounts: view.amounts.map((a) => ({
      currency: a.currency,
      amount: str(a.amount),
      reason: a.reason,
      fxRateIds: a.fxRateIds,
      native: a.native,
    })),
  };
}

export function storeLineValuation(
  valuation: LineValuation,
  policy: ValuationPolicySnapshot,
  engineVersion: string,
): StoredLineValuation {
  return {
    engineVersion,
    policyId: policy.id,
    policyVersion: policy.version,
    valuationDate: valuation.valuationDate.toISOString(),
    seconds: str(valuation.seconds),
    roundingPolicy: ROUNDING_POLICY,
    views: valuation.views.map(storeView),
  };
}

function loadView(view: StoredView): LineViewValuation {
  return {
    view: view.view,
    status: view.status,
    reason: view.reason,
    components: view.components.map((c) => ({
      rateVersionId: c.rateVersionId,
      rateVersion: c.rateVersion,
      from: new Date(c.from),
      to: new Date(c.to),
      currency: c.currency,
      unitValue: c.unitValue,
      quantity: dec(c.quantity),
      seconds: dec(c.seconds),
      amount: new Dec(c.amount),
    })),
    amounts: view.amounts.map((a) => ({
      currency: a.currency,
      amount: dec(a.amount),
      reason: a.reason,
      fxRateIds: a.fxRateIds,
      native: a.native,
    })),
  };
}

/** Reads a stored snapshot back (null for lines of runs before plan 2.6 or of an unexpected shape). */
export function loadLineValuation(stored: unknown): LineValuation | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const value = stored as Partial<StoredLineValuation>;
  if (!Array.isArray(value.views) || typeof value.valuationDate !== 'string')
    return null;
  return {
    valuationDate: new Date(value.valuationDate),
    seconds: dec(value.seconds ?? null),
    views: value.views.map(loadView),
  };
}
