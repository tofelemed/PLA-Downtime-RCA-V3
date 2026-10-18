import { Dec, formatDec } from '../domain/actuals/decimal';
import { RevisionState } from './revision-state';
import { reviewedValuation, ReviewedValueTotal } from './reviewed-valuation';

/** The period's loss value in one currency of the policy's default view (sum of its slices). */
export interface ProposalValue {
  currency: string;
  /** null when a slice is not (fully) valued in this currency */
  amount: string | null;
  status: 'valued' | 'unvalued' | 'mixed';
}

/** Approved loss value of a change proposal's "before" side: default view, one entry per currency. */
export interface ProposalValues {
  view: string;
  policyVersion: number | null;
  amounts: ProposalValue[];
}

function statusOf(
  totals: readonly ReviewedValueTotal[],
): ProposalValue['status'] {
  if (totals.every((t) => t.status === 'valued')) return 'valued';
  if (totals.every((t) => t.status === 'unvalued')) return 'unvalued';
  return 'mixed';
}

function amountOf(totals: readonly ReviewedValueTotal[]): string | null {
  if (totals.some((t) => t.amount === null)) return null;
  return formatDec(
    totals.reduce((sum, t) => sum.add(new Dec(t.amount ?? '0')), new Dec(0)),
  );
}

/**
 * The approved revision's loss value in the default view of its frozen valuation, per currency — the same
 * reconciled totals its approval snapshot holds (`reviewedValuation`), added over the slices. Empty for
 * runs without a valuation context (before plan 2.6).
 */
export function approvedValuesPart(state: RevisionState): {
  values?: ProposalValues;
} {
  const valuation = reviewedValuation(state);
  if (!valuation) return {};
  const shown = valuation.slices.filter(
    (s) => s.view === valuation.defaultView,
  );
  return {
    values: {
      view: valuation.defaultView,
      policyVersion: valuation.policyVersion,
      amounts: valuation.currencies.map((currency) => {
        const totals = shown.filter((s) => s.currency === currency);
        return { currency, amount: amountOf(totals), status: statusOf(totals) };
      }),
    },
  };
}
