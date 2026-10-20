import { Dec, secondsBetween, toDec, ZERO } from '../actuals/decimal';
import { BoundedInterval, clip } from '../time/interval-algebra';
import { LossEvent, Segment } from './accounting.types';
import { causeKey } from './reason-split';
import { TransitionSplit } from './transition-split';
import { segmentCapacity, RateBasis, rateOf } from './time-lines';

/** A cause claiming part of a component total (micro-stop, derate, measured slowdown, quality event). */
export interface Claim {
  event: LossEvent;
  quantity: Dec;
  start: Date;
  end: Date;
  rateVersionIds: string[];
  /** quantity from rate × time (`sustained_rate`/`planning_rate`) or from the event (`measured`) */
  fromRate: boolean;
  share: Dec;
  /** a share of a claim pooled over a product run (`claim-pooling.ts`) */
  pooled?: boolean;
  /** LA-08: the claim of a grade transition, split into allowance and excess when it becomes lines */
  transition?: TransitionSplit;
}

function addTo(
  claims: Map<string, Claim>,
  event: LossEvent,
  part: { start: Date; end: Date; quantity: Dec; rateId: string; share: Dec },
): void {
  const existing = claims.get(causeKey(event));
  if (!existing) {
    claims.set(causeKey(event), {
      event,
      quantity: part.quantity,
      start: part.start,
      end: part.end,
      rateVersionIds: [part.rateId],
      fromRate: true,
      share: part.share,
    });
    return;
  }
  existing.quantity = existing.quantity.plus(part.quantity);
  existing.end = part.end > existing.end ? part.end : existing.end;
  if (!existing.rateVersionIds.includes(part.rateId))
    existing.rateVersionIds.push(part.rateId);
}

/**
 * Rate-based claims inside running time (not excluded, no availability stop, no grade transition): a
 * micro-stop claims the segment's capacity (shared between concurrent micro-stops); a fractional derate
 * claims capacity × fraction where no micro-stop is active (never twice for the same second).
 */
export function rateClaims(
  segments: readonly Segment[],
  basis: RateBasis,
): Claim[] {
  const micro = new Map<string, Claim>();
  const derate = new Map<string, Claim>();
  for (const segment of segments) {
    const capacity = segmentCapacity(segment, basis);
    const rate = rateOf(segment, basis);
    if (segment.excluded || segment.stops.length > 0 || !capacity || !rate)
      continue;
    // a grade transition takes the segment (`transitionClaims`): its time is not claimed twice
    if (segment.transitions.length > 0) continue;
    const base = { start: segment.start, end: segment.end, rateId: rate.id };
    for (const cause of segment.microStops) {
      addTo(micro, cause.event, {
        ...base,
        quantity: capacity.mul(cause.share),
        share: cause.share,
      });
    }
    if (segment.microStops.length > 0) continue;
    for (const event of segment.derates) {
      const fraction = toDec(event.impactFraction) ?? ZERO;
      addTo(derate, event, {
        ...base,
        quantity: capacity.mul(fraction),
        share: new Dec(1),
      });
    }
  }
  return [...micro.values(), ...derate.values()];
}

/** Part of a declared quantity inside the window: prorated by time, an instant event counts whole. */
export function quantityInside(
  event: LossEvent,
  window: BoundedInterval,
): Claim | null {
  const quantity = toDec(event.quantity);
  if (!quantity) return null;
  const instant = !event.end || event.end <= event.start;
  if (instant) {
    const inside = event.start >= window.start && event.start < window.end;
    return inside ? measured(event, quantity, event.start, event.start) : null;
  }
  const part = clip({ start: event.start, end: event.end }, window);
  if (!part || !event.end) return null;
  const share = secondsBetween(part.start.getTime(), part.end.getTime()).div(
    secondsBetween(event.start.getTime(), event.end.getTime()),
  );
  return measured(event, quantity.mul(share), part.start, part.end);
}

function measured(
  event: LossEvent,
  quantity: Dec,
  start: Date,
  end: Date,
): Claim {
  return {
    event,
    quantity,
    start,
    end,
    rateVersionIds: [],
    fromRate: false,
    share: new Dec(1),
  };
}

/** Measured slowdowns (`impact_mode = measured` with a quantity) prorated into the slice window. */
export function measuredDerateClaims(
  events: readonly LossEvent[],
  window: BoundedInterval,
): Claim[] {
  return events
    .filter((e) => e.physicalType === 'slowdown' && e.impactMode === 'measured')
    .flatMap((e) => quantityInside(e, window) ?? []);
}

/** Quality-loss events with a declared quantity, prorated into the slice window. */
export function qualityClaims(
  events: readonly LossEvent[],
  window: BoundedInterval,
): Claim[] {
  return events
    .filter((e) => e.physicalType === 'quality_loss')
    .flatMap((e) => quantityInside(e, window) ?? []);
}

export function sumOf(values: readonly Dec[]): Dec {
  return values.reduce((sum, v) => sum.plus(v), ZERO);
}
