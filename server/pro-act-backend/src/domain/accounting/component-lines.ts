import { Dec, ZERO } from '../actuals/decimal';
import { qualityClassFlag } from '../actuals/period/quality-classes';
import { BoundedInterval } from '../time/interval-algebra';
import { LossBasis, LossKind, LossLineDraft } from './accounting.types';
import { autoKey } from './auto-key';
import { PRODUCT_RUN_SHARE } from './claim-pooling';
import { Claim, sumOf } from './claims';
import { LineContext } from './time-lines';
import { transitionLines } from './transition-lines';

export interface ComponentInput {
  kind: Extract<LossKind, 'performance' | 'quality' | 'availability'>;
  /** the component total computed once at the production boundary (ACC03) */
  total: Dec;
  claims: Claim[];
  window: BoundedInterval;
  /** rate version of the unattributed remainder when one rate was in force, else null */
  remainderRateId: string | null;
  remainderBasis: LossBasis;
  epsilon: Dec;
}

export interface ComponentResult {
  lines: LossLineDraft[];
  /** Σ claims − total when the causes claim more than the component holds (0 otherwise) */
  overClaim: Dec;
}

function claimBasis(claim: Claim, context: LineContext): LossBasis {
  if (claim.fromRate)
    return context.basis === 'sustained' ? 'sustained_rate' : 'planning_rate';
  return claim.event.physicalType === 'slowdown' ? 'measured' : 'declared';
}

/** SME Q10: lines of a ramp-up / startup-quality event say they recover from a stop. */
export const TRIP_RECOVERY = 'trip_recovery';

function claimLine(
  claim: Claim,
  input: ComponentInput,
  context: LineContext,
): LossLineDraft {
  const { event } = claim;
  return {
    ledger: context.ledger,
    kind: input.kind,
    sliceId: context.sliceId,
    segmentStart: claim.start,
    segmentEnd: claim.end,
    quantity: claim.quantity,
    uom: context.uom,
    basis: claimBasis(claim, context),
    rateVersionId:
      claim.rateVersionIds.length === 1 ? claim.rateVersionIds[0] : null,
    cause: event,
    scheduleClass: event.scheduleClass,
    oeeComponent: input.kind,
    flags: [
      ...(claim.rateVersionIds.length > 1 ? ['several_rate_versions'] : []),
      ...(claim.pooled ? [PRODUCT_RUN_SHARE] : []),
      ...(event.recoveryOfEventId ? [TRIP_RECOVERY] : []),
      // SME E3: a quality event names the disposition of the tonnes it explains
      ...(input.kind === 'quality' && event.dispositionClass
        ? [qualityClassFlag(event.dispositionClass)]
        : []),
    ],
    evidence: [
      {
        eventId: event.eventId,
        eventRevisionId: event.revisionId,
        occurrenceId: event.occurrenceId,
        share: claim.share.toFixed(8),
        clippedStart: claim.start,
        clippedEnd: claim.end,
      },
    ],
    autoKey: autoKey(
      { ledger: context.ledger, kind: input.kind, sliceId: context.sliceId },
      claim.start,
      event,
    ),
  };
}

function remainderLine(
  quantity: Dec,
  input: ComponentInput,
  context: LineContext,
): LossLineDraft {
  return {
    ledger: context.ledger,
    kind: input.kind,
    sliceId: context.sliceId,
    segmentStart: input.window.start,
    segmentEnd: input.window.end,
    quantity,
    uom: context.uom,
    basis: input.remainderBasis,
    rateVersionId: input.remainderRateId,
    cause: null,
    scheduleClass: null,
    oeeComponent: input.kind,
    // SME Q4: a speed loss no measurement or event supports is unexplained, not proven slow running
    flags:
      input.kind === 'performance' ? ['no_cause', 'unexplained'] : ['no_cause'],
    evidence: [],
    autoKey: autoKey(
      { ledger: context.ledger, kind: input.kind, sliceId: context.sliceId },
      input.window.start,
      null,
    ),
  };
}

/**
 * Allocates a component total to its causes (ACC03: compute once, then allocate; never add rate-derived
 * totals to event claims): each cause gets a line, the unclaimed remainder a line without cause, and a
 * claim beyond the total is reported (`overClaim`) for the ledger to fail or flag — never scaled down.
 */
export function componentLines(
  input: ComponentInput,
  context: LineContext,
): ComponentResult {
  const claims = input.claims.filter((c) => c.quantity.gt(ZERO));
  const lines = claims.flatMap((claim) => {
    const line = claimLine(claim, input, context);
    return claim.transition
      ? transitionLines(line, claim.transition, input.kind)
      : [line];
  });
  const remainder = input.total.minus(sumOf(claims.map((c) => c.quantity)));
  if (remainder.gt(input.epsilon))
    lines.push(remainderLine(remainder, input, context));
  const overClaim = remainder.lt(input.epsilon.neg()) ? remainder.neg() : ZERO;
  return { lines, overClaim };
}
