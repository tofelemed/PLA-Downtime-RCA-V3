import { Dec } from '../actuals/decimal';
import { LedgerTotals, SliceInput } from '../accounting/accounting.types';
import { ReconciledTerms } from './reconciled-oee';

const LEDGER_UNAVAILABLE = ['no_profile', 'no_sustained_rate'];
const ACTUALS_FLAGS = ['actuals_missing', 'uom_mismatch', 'gross_unknown'];

function incomplete(
  reason: string,
  uom: string | null,
  provisional: string | null,
): ReconciledTerms {
  return {
    good: null,
    availabilityLoss: null,
    performanceLoss: null,
    qualityLoss: null,
    uom,
    incompleteReason: reason,
    excluded: null,
    provisional,
  };
}

/** Why a slice's capacity ledger is not a fully declared loss basis (null = it is). */
function basisGap(totals: LedgerTotals, epsilon: Dec): string | null {
  const ledger = totals.flags.find((f) => LEDGER_UNAVAILABLE.includes(f));
  if (ledger) return ledger;
  if (totals.residual === null) {
    return (
      totals.flags.find((f) => ACTUALS_FLAGS.includes(f)) ?? 'actuals_missing'
    );
  }
  const missing = [
    totals.good,
    totals.availability,
    totals.performance,
    totals.quality,
  ];
  if (missing.some((q) => q === null)) return 'loss_basis_incomplete';
  return totals.residual.abs().gt(epsilon) ? 'loss_basis_incomplete' : null;
}

/**
 * KPI04 terms of one slice from its capacity-ledger totals (G = good, LA / LP / LQ = availability,
 * performance and quality losses at the sustained rate); the basis is complete only when the residual is
 * within the tolerance epsilon, i.e. every capacity loss is classified.
 */
export function reconciledFromTotals(
  slice: SliceInput,
  totals: readonly LedgerTotals[],
  epsilon: Dec,
): ReconciledTerms {
  const capacity = totals.find(
    (t) => t.sliceId === slice.sliceId && t.ledger === 'capacity',
  );
  const state = slice.actuals?.qualityState;
  const provisional =
    state && state !== 'complete' ? 'actuals_incomplete' : null;
  if (!capacity)
    return incomplete('capacity_ledger_missing', slice.uom, provisional);
  const gap = basisGap(capacity, epsilon);
  if (gap) return incomplete(gap, capacity.uom, provisional);
  return {
    good: capacity.good,
    availabilityLoss: capacity.availability,
    performanceLoss: capacity.performance,
    qualityLoss: capacity.quality,
    uom: capacity.uom,
    incompleteReason: null,
    excluded: capacity.exclusion,
    provisional,
  };
}

const add = (a: Dec | null, b: Dec | null) =>
  a === null || b === null ? null : a.plus(b);

/** Period terms = Σ over sequential slices of one unit of measure; concurrent streams are not combined. */
export function sumReconciled(
  perSlice: ReadonlyArray<{ slice: SliceInput; terms: ReconciledTerms }>,
): ReconciledTerms {
  if (perSlice.length === 0) return incomplete('no_slices', null, null);
  const uom = perSlice[0].terms.uom;
  if (perSlice.some((p) => p.slice.concurrent))
    return incomplete('concurrent_streams', uom, null);
  const gap = perSlice.find((p) => p.terms.incompleteReason)?.terms
    .incompleteReason;
  if (gap) return incomplete(gap, uom, null);
  if (perSlice.some((p) => p.terms.uom !== uom))
    return incomplete('uom_mismatch', null, null);
  const terms = perSlice.map((p) => p.terms);
  const total = (pick: (t: ReconciledTerms) => Dec | null) =>
    terms.slice(1).reduce((s, t) => add(s, pick(t)), pick(terms[0]));
  return {
    good: total((t) => t.good),
    availabilityLoss: total((t) => t.availabilityLoss),
    performanceLoss: total((t) => t.performanceLoss),
    qualityLoss: total((t) => t.qualityLoss),
    uom,
    incompleteReason: null,
    excluded: total((t) => t.excluded),
    provisional: terms.find((t) => t.provisional)?.provisional ?? null,
  };
}
