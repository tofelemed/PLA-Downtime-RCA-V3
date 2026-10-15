import type { ReconciliationView } from '@/api/v2/types/reconciliation';

/** What a reviewer can name as failed (SME R6): the run's candidates and the manual lines of the revision. */
export interface FailedLineChoice {
  ref: string;
  label: string;
}

const qty = (quantity: string | null, uom: string | null) => (quantity === null ? '' : ` · ${quantity}${uom ? ` ${uom}` : ''}`);

/** Candidates (by auto key) and manual / tolerance lines (by id), each with a readable label. */
export function failedLineChoices(view: ReconciliationView): FailedLineChoice[] {
  const uomOf = (sliceId: string) => view.slices.find((s) => s.sliceId === sliceId)?.uom ?? null;
  const candidates = view.candidates.map((c, i) => ({
    ref: c.autoKey,
    label: `Proposed loss ${i + 1} · ${c.kind}${qty(c.effectiveQuantity ?? c.quantity, uomOf(c.sliceId))}`,
  }));
  const manual = view.lines
    .filter((line) => line.action === 'manual' || line.action === 'tolerance')
    .map((line) => ({ ref: line.id, label: `Line ${line.position + 1} · ${line.kind ?? line.action}${qty(line.quantity, line.uom)}` }));
  return [...candidates, ...manual];
}

/** The label of a failed-line reference, or a neutral text when the line is no longer in the view. */
export function failedLineLabel(view: ReconciliationView, ref: string): string {
  return failedLineChoices(view).find((choice) => choice.ref === ref)?.label ?? 'A line of the rejected revision';
}
