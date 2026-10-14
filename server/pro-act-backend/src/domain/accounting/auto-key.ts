import { Ledger, LossEvent, LossKind } from './accounting.types';

/**
 * Deterministic key of an automatic line (ACC08): ledger, kind, slice, first segment start, occurrence
 * and cause event — and, for the lines one cause has in two components (a grade transition's rate
 * deficit and off-grade, LA-08), the component as `part`. Re-running with the same inputs yields the
 * same keys; a manual line (2.8) names the key it overrides so the candidate is kept as
 * `candidate_superseded` for provenance.
 */
export function autoKey(
  owner: { ledger: Ledger; kind: LossKind; sliceId: string },
  segmentStart: Date,
  cause: Pick<LossEvent, 'occurrenceId' | 'eventId'> | null,
  part?: string,
): string {
  return [
    owner.ledger,
    owner.kind,
    owner.sliceId,
    segmentStart.toISOString(),
    cause?.occurrenceId ?? '-',
    cause?.eventId ?? '-',
    ...(part ? [part] : []),
  ].join(':');
}
