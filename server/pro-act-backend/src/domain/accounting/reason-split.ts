import { Decimal } from 'decimal.js';
import { Dec } from '../actuals/decimal';
import { isWeighted, ReasonWeight } from '../events/reason-weights';
import { LossEvent, SegmentCause } from './accounting.types';
import { SHARE_SCALE } from './shares';

/**
 * The part of a weighted stop charged to one of its reasons: the event as the line's cause with that
 * reason as its reason code (`weightedReason` keeps the reason and its weight).
 */
function reasonPart(event: LossEvent, reason: ReasonWeight): LossEvent {
  return {
    ...event,
    reasonCodeId: reason.reasonCodeId,
    reasonCode:
      reason.reasonCodeId === event.reasonCodeId ? event.reasonCode : null,
    weightedReason: reason,
  };
}

/**
 * `share` × each weight, truncated to 8 places; the first reason (the largest, the primary) takes the
 * remainder, so the parts add up to `share` exactly and the segment's shares still add up to 1 (ACC05).
 */
function weightedShares(share: Dec, weights: readonly ReasonWeight[]): Dec[] {
  const rest = weights
    .slice(1)
    .map((w) =>
      share.mul(w.weight).toDecimalPlaces(SHARE_SCALE, Decimal.ROUND_DOWN),
    );
  const assigned = rest.reduce((sum, part) => sum.plus(part), new Dec(0));
  return [share.minus(assigned), ...rest];
}

/**
 * D-T5 weighted multi-reason stops: after the overlap rule shared a segment between the stop occurrences
 * (`allocateCauses`: `first_out` or `equal_share`), the share a weighted stop received is split across
 * its reasons by weight, so each (cause event, reason) gets its own line with evidence share = segment
 * share × weight. A stop crossing a day or shift edge is split pro-rata because every segment is. An
 * unweighted cause is returned as it is (the same object). Pure and deterministic.
 */
export function splitByReasons(
  causes: readonly SegmentCause[],
): SegmentCause[] {
  return causes.flatMap((cause): SegmentCause[] => {
    const weights = cause.event.reasonWeights;
    if (!isWeighted(weights)) return [cause];
    const shares = weightedShares(cause.share, weights);
    return weights.map((reason, i) => ({
      event: reasonPart(cause.event, reason),
      share: shares[i],
    }));
  });
}

/** Grouping key of a cause: its event, and its reason when the event is a weighted stop. */
export function causeKey(event: LossEvent): string {
  return event.weightedReason
    ? `${event.eventId}|${event.weightedReason.reasonCodeId}`
    : event.eventId;
}

/**
 * D-T5 for consumers outside the ledgers (the KPI downtime breakdown by reason): an amount of a cause
 * (e.g. its allocated seconds) split across the event's weighted reasons, each part with the per-reason
 * event; an unweighted event keeps the whole amount. The parts add up to `amount` exactly.
 */
export function splitAmountByReason(
  event: LossEvent,
  amount: Dec,
): Array<{ event: LossEvent; amount: Dec }> {
  return splitByReasons([{ event, share: amount }]).map((part) => ({
    event: part.event,
    amount: part.share,
  }));
}
