import { ReviewedFigures } from '../domain/reconciliation/restatement-delta';
import {
  candidatesPart,
  canon,
  linesPart,
  sliceView,
} from './reviewed-content';
import { RevisionState } from './revision-state';

/** Candidate states that leave a candidate out of the ledger (its replacement line counts instead). */
const DROPPED = new Set(['rejected', 'replaced']);

/** Line actions that carry their own quantity into the ledger (accept / adjust / reject act on candidates). */
const OWN_QUANTITY = new Set(['manual', 'tolerance', 'replace']);

/**
 * The figures of a revision a restatement compares (SME R5), from the same reviewed content an approver
 * signs: per-slice plan-ledger totals, actuals, decided candidates at their effective quantity and the
 * manual, replacing and tolerance lines.
 */
export function figuresOf(state: RevisionState): ReviewedFigures {
  const slices = state.reconciliation.slices.map(sliceView);
  const uomOf = new Map(slices.map((s) => [s.sliceId, s.uom]));
  const candidates = candidatesPart(state)
    .filter((c) => !DROPPED.has(c.state) && c.effectiveQuantity !== null)
    .map((c) => ({
      kind: c.kind,
      reasonCodeId: c.reasonCodeId,
      uom: uomOf.get(c.sliceId) ?? null,
      quantity: c.effectiveQuantity,
    }));
  const lines = linesPart(state)
    .filter((l) => OWN_QUANTITY.has(l.action))
    .map((l) => ({
      kind: l.kind ?? l.action,
      reasonCodeId: l.reasonCodeId,
      uom: l.uom ?? uomOf.get(l.sliceId) ?? null,
      quantity: l.quantity,
    }));
  return {
    slices,
    actuals: state.actuals.map((a) => ({
      uom: a.uom,
      gross: canon(a.gross),
      good: canon(a.good),
      reject: canon(a.reject),
    })),
    lines: [...candidates, ...lines],
  };
}
