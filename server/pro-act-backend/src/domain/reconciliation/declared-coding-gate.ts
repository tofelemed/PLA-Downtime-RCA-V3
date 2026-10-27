import { Dec } from '../actuals/decimal';
import { plural } from '../../common/helpers/plural';
import { CodingGatePolicy, CodingGateResult } from './coding-gate';
import { WorkflowIssue } from './reconciliation.types';

/** The period's production loss events (declared mode) by how they are coded; shortfalls in the events' unit. */
export interface LossEventCodingCounts {
  events: number;
  /** with a reason code */
  coded: number;
  /** without a reason code but explicitly "investigation pending" */
  investigationPending: number;
  /** Σ shortfall of all events (a negative shortfall, an overproduction, counts as nothing) */
  shortfall: Dec;
  /** Σ shortfall of the events with a reason code */
  codedShortfall: Dec;
}

const issue = (code: string, message: string): WorkflowIssue => ({
  code,
  message,
  sliceId: null,
});

/**
 * Coding gate of a period in declared mode (spec §4): the stops are not the loss, the production loss event
 * is. Every event needs a reason code or an explicit "investigation pending" (`LOSS_EVENT_UNCODED`), and the
 * coded share of the shortfall (Σ shortfall of coded events ÷ Σ shortfall; 1 when there is no shortfall) must
 * reach the policy target (`CODING_COVERAGE_LOW`). Same `warn` / `block` mode and target as the stop gate;
 * the event counts take the place of the stop counts in the result. Pure.
 */
export function declaredCodingGate(
  counts: LossEventCodingCounts,
  policy: CodingGatePolicy,
): CodingGateResult {
  const uncoded = Math.max(
    0,
    counts.events - counts.coded - counts.investigationPending,
  );
  const target = new Dec(policy.codedRatioTarget);
  const ratio = counts.shortfall.gt(0)
    ? counts.codedShortfall.div(counts.shortfall).toDecimalPlaces(8)
    : new Dec(1);
  const issues: WorkflowIssue[] = [];
  if (uncoded > 0) {
    issues.push(
      issue(
        'LOSS_EVENT_UNCODED',
        `${plural(uncoded, 'production loss event has', 'production loss events have')} neither a reason code nor "investigation pending"`,
      ),
    );
  }
  if (ratio.lt(target)) {
    issues.push(
      issue(
        'CODING_COVERAGE_LOW',
        `coded production loss ${ratio.times(100).toFixed(1)} % is below the target ${target.times(100).toFixed(1)} %`,
      ),
    );
  }
  return {
    mode: policy.mode,
    target: target.toString(),
    stops: counts.events,
    coded: counts.coded,
    investigationPending: counts.investigationPending,
    uncoded,
    codedRatio: ratio.toString(),
    codedSeconds: null,
    stoppedSeconds: null,
    passes: issues.length === 0,
    issues,
    verification: {
      verified: 0,
      unverified: counts.events,
      failureDetailed: 0,
      validated: 0,
      unvalidated: 0,
    },
  };
}
