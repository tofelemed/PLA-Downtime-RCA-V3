import { formatDec, toDec } from '../domain/actuals/decimal';
import { ProposalValues } from './proposal-values';

/** Old and new loss value of one reporting currency and the change (new − old); null when either side is unknown. */
export interface ValueDelta {
  currency: string;
  old: string | null;
  new: string | null;
  delta: string | null;
}

/**
 * QA audit 2026-10-19 (P-2): the loss value a restatement changes, in each revision's default valuation
 * view (each revision is valued under its own frozen policy), one row per reporting currency. A value-only
 * restatement (a new valuation policy or rate, quantities unchanged) shows here and nowhere in the
 * quantity delta. `viewChanged` says the two sides are valued under different default views.
 */
export interface RestatementValues {
  oldView: string | null;
  newView: string | null;
  viewChanged: boolean;
  currencies: ValueDelta[];
}

function amountIn(
  values: ProposalValues | undefined,
  currency: string,
): string | null {
  return values?.amounts.find((a) => a.currency === currency)?.amount ?? null;
}

function deltaOf(oldAmount: string | null, newAmount: string | null) {
  const before = toDec(oldAmount);
  const after = toDec(newAmount);
  if (before === null || after === null) return null;
  return formatDec(after.minus(before));
}

/** The value delta of two revisions' default-view loss values; null when neither side is valued. */
export function restatementValues(
  before: ProposalValues | undefined,
  after: ProposalValues | undefined,
): RestatementValues | null {
  if (!before && !after) return null;
  const currencies = [
    ...new Set([
      ...(before?.amounts ?? []).map((a) => a.currency),
      ...(after?.amounts ?? []).map((a) => a.currency),
    ]),
  ];
  return {
    oldView: before?.view ?? null,
    newView: after?.view ?? null,
    viewChanged: (before?.view ?? null) !== (after?.view ?? null),
    currencies: currencies.map((currency) => {
      const oldAmount = amountIn(before, currency);
      const newAmount = amountIn(after, currency);
      return {
        currency,
        old: oldAmount,
        new: newAmount,
        delta: deltaOf(oldAmount, newAmount),
      };
    }),
  };
}
