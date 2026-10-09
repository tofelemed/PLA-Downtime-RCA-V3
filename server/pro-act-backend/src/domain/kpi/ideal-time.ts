import { Dec, ZERO } from '../actuals/decimal';
import { Segment, SliceInput } from '../accounting/accounting.types';
import { productionOf } from '../accounting/ledger-common';
import { ratePerSecond } from '../profiles/rate-math';

/** S and D of a set of atomic segments (2.5 segmentation): D = time with an availability stop inside S. */
export interface TimeTerms {
  scheduled: Dec;
  stopped: Dec;
}

export function timeTerms(segments: readonly Segment[]): TimeTerms {
  let scheduled = ZERO;
  let stopped = ZERO;
  for (const segment of segments) {
    if (segment.excluded) continue;
    scheduled = scheduled.plus(segment.seconds);
    if (segment.stops.length > 0) stopped = stopped.plus(segment.seconds);
  }
  return { scheduled, stopped };
}

export interface IdealTimes {
  idealGross: Dec | null;
  idealGood: Dec | null;
  grossReason: string | null;
  goodReason: string | null;
}

/** Σ sustained rate × seconds and Σ seconds over the segments; null capacity when one lacks a rate. */
function weighting(segments: readonly Segment[]): {
  capacity: Dec | null;
  seconds: Dec;
} {
  let capacity = ZERO;
  let seconds = ZERO;
  for (const segment of segments) {
    if (!segment.sustained) return { capacity: null, seconds };
    capacity = capacity.plus(
      ratePerSecond(segment.sustained).mul(segment.seconds),
    );
    seconds = seconds.plus(segment.seconds);
  }
  return { capacity, seconds };
}

/**
 * Ideal-time weighting of KPI01: U = gross / sustained rate, V = good / sustained rate, the rate being the
 * time-weighted sustained rate over the slice's running time (over its scheduled time when it never ran),
 * so P = gross / running capacity — the 2.5 capacity ledger's performance basis. Missing quantities or rates
 * give null with the reason (`actuals_missing`, `uom_mismatch`, `quality_evidence_missing`, `no_profile`).
 */
export function idealTimes(
  slice: SliceInput,
  segments: readonly Segment[],
): IdealTimes {
  const production = productionOf(slice);
  const scheduled = segments.filter((s) => !s.excluded);
  const running = scheduled.filter((s) => s.stops.length === 0);
  const basis = weighting(running.length > 0 ? running : scheduled);
  const rateReason = slice.sustainedRates ? 'no_sustained_rate' : 'no_profile';
  const timeReason = scheduled.length === 0 ? 'no_scheduled_time' : null;
  const missing = (quantity: Dec | null, quantityReason: string) => {
    if (quantity === null) return quantityReason;
    if (timeReason) return timeReason;
    return basis.capacity === null || basis.capacity.isZero()
      ? rateReason
      : null;
  };
  const goodReason = missing(
    production.good,
    production.flags[0] ?? 'actuals_missing',
  );
  const grossReason = missing(
    production.gross,
    production.good === null
      ? (production.flags[0] ?? 'actuals_missing')
      : 'quality_evidence_missing',
  );
  const ideal = (quantity: Dec | null, reason: string | null) =>
    reason === null && quantity !== null && basis.capacity
      ? quantity.mul(basis.seconds).div(basis.capacity)
      : null;
  return {
    idealGross: ideal(production.gross, grossReason),
    idealGood: ideal(production.good, goodReason),
    grossReason,
    goodReason,
  };
}
