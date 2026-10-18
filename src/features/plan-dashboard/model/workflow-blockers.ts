import type { RevisionSelector } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';

/** One reason the shown draft cannot be submitted yet, read from the server's view (never recomputed here). */
export interface SubmitBlocker {
  code: 'NOT_CALCULATED' | 'CODING_GATE' | 'UNSAVED_LINES';
  text: string;
}

/**
 * What stands between the draft and "Submit for approval", from the server's flags: no calculation run,
 * a failing coding gate in `block` mode (the server's `passes`), and unsaved line edits (they are never
 * submitted). The server still checks residual, tolerance and coverage on submit; its refusal is shown.
 */
export function submitBlockers(view: ReconciliationView, unsavedLines: boolean): SubmitBlocker[] {
  if (view.revision.lifecycle !== 'draft') return [];
  const blockers: SubmitBlocker[] = [];
  if (!view.baseRunId) blockers.push({ code: 'NOT_CALCULATED', text: 'Not calculated yet: recompute first.' });
  const gate = view.codingGate;
  if (gate && gate.mode === 'block' && !gate.passes) {
    blockers.push({ code: 'CODING_GATE', text: `Stop coding is below the submission gate (${gate.uncoded} stops without a reason).` });
  }
  if (unsavedLines) blockers.push({ code: 'UNSAVED_LINES', text: 'Unsaved loss-line changes: save or discard them on Reconciliation first.' });
  return blockers;
}

/**
 * Where the sticky workflow strip links and how much it shows: Review & close has the full workflow bar, so
 * there the strip only says the state; the approved view never submits.
 */
export function stickyPlacement(section: string, shown: RevisionSelector, reviewHref: string): { reviewHref: string | null; compact: boolean } {
  const inReview = section === 'review';
  return { reviewHref: inReview ? null : reviewHref, compact: inReview || shown !== 'current' };
}
