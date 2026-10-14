import { Dec, ZERO } from '../actuals/decimal';
import { BoundedInterval } from '../time/interval-algebra';
import {
  LossEvent,
  Segment,
  TransitionStandard,
} from './accounting.types';
import { Claim, quantityInside } from './claims';
import { RateBasis, rateOf, segmentCapacity } from './time-lines';
import { transitionSplit } from './transition-split';

export interface TransitionScope {
  events: readonly LossEvent[];
  window: BoundedInterval;
  standards: readonly TransitionStandard[];
  asOf: Date;
}

interface Running {
  quantity: Dec;
  start: Date;
  end: Date;
  rateIds: Set<string>;
  share: Dec;
}

/** Capacity of each transition's running segments in the slice (stopped / excluded time stays A / exclusion). */
function runningCapacity(
  segments: readonly Segment[],
  basis: RateBasis,
): Map<string, Running> {
  const byEvent = new Map<string, Running>();
  for (const segment of segments) {
    const capacity = segmentCapacity(segment, basis);
    const rate = rateOf(segment, basis);
    if (segment.excluded || segment.stops.length > 0 || !capacity || !rate)
      continue;
    for (const cause of segment.transitions) {
      const part = capacity.mul(cause.share);
      const known = byEvent.get(cause.event.eventId);
      if (!known) {
        byEvent.set(cause.event.eventId, {
          quantity: part,
          start: segment.start,
          end: segment.end,
          rateIds: new Set([rate.id]),
          share: cause.share,
        });
        continue;
      }
      known.quantity = known.quantity.plus(part);
      known.end = segment.end;
      known.rateIds.add(rate.id);
    }
  }
  return byEvent;
}

function rateClaim(
  event: LossEvent,
  running: Running,
  deficit: Dec,
  split: Claim['transition'],
): Claim {
  return {
    event,
    quantity: deficit,
    start: running.start,
    end: running.end,
    rateVersionIds: [...running.rateIds].sort(),
    fromRate: true,
    share: running.share,
    transition: split,
  };
}

/**
 * Claims of grade transitions in a slice (LA-08): a transition loses the capacity of its running time
 * at the ledger's rate. The off-grade it declares (event quantity, prorated into the slice) is its
 * quality claim; the rest of that capacity is its rate-deficit (performance) claim. Both carry the
 * allowance split of the transition standard.
 */
export function transitionClaims(
  segments: readonly Segment[],
  basis: RateBasis,
  scope: TransitionScope,
): { performance: Claim[]; quality: Claim[] } {
  const running = runningCapacity(segments, basis);
  const performance: Claim[] = [];
  const quality: Claim[] = [];
  for (const event of scope.events) {
    if (event.physicalType !== 'grade_transition') continue;
    const split = transitionSplit(event, scope.standards, scope.asOf);
    const offGrade = quantityInside(event, scope.window);
    if (offGrade && offGrade.quantity.gt(ZERO))
      quality.push({ ...offGrade, transition: split });
    const own = running.get(event.eventId);
    if (!own) continue;
    const deficit = own.quantity.minus(offGrade?.quantity ?? ZERO);
    if (deficit.gt(ZERO))
      performance.push(rateClaim(event, own, deficit, split));
  }
  return { performance, quality };
}
