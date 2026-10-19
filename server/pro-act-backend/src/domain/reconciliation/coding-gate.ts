import { Dec } from '../actuals/decimal';
import { WorkflowIssue } from './reconciliation.types';
import { plural } from '../../common/helpers/plural';

/** Stops of a shift period by how they are coded (stopping downtime overlapping the period). */
export interface StopCodingCounts {
  stops: number;
  /** with a reason code */
  coded: number;
  /** without a reason code but explicitly "investigation pending" */
  investigationPending: number;
  /** SME D13 (information, never part of the gate): verified by a supervisor */
  verified?: number;
  /** with failure detail, and of those validated by maintenance */
  failureDetailed?: number;
  validated?: number;
}

/** SME D13 counts shown with the gate: what still waits for the supervisor / maintenance. */
export interface VerificationCounts {
  verified: number;
  unverified: number;
  failureDetailed: number;
  validated: number;
  /** failure detail not yet validated */
  unvalidated: number;
}

/** `coded_downtime_ratio` of the period's current run: stop time with a reason code / all stop time. */
export interface CodedRatio {
  /** null = no stop time in the period (`no_downtime`) or no run yet */
  value: Dec | null;
  codedSeconds: Dec | null;
  stoppedSeconds: Dec | null;
}

export interface CodingGatePolicy {
  mode: 'block' | 'warn';
  codedRatioTarget: number;
}

export interface CodingGateResult {
  mode: 'block' | 'warn';
  target: string;
  stops: number;
  coded: number;
  investigationPending: number;
  /** neither a reason code nor "investigation pending" */
  uncoded: number;
  codedRatio: string | null;
  codedSeconds: string | null;
  stoppedSeconds: string | null;
  passes: boolean;
  /** what fails; refuses the submission only in `block` mode */
  issues: WorkflowIssue[];
  /** SME D13: staged verification of the same stops (never blocks the submission) */
  verification: VerificationCounts;
}

function verificationOf(counts: StopCodingCounts): VerificationCounts {
  const verified = counts.verified ?? 0;
  const failureDetailed = counts.failureDetailed ?? 0;
  const validated = counts.validated ?? 0;
  return {
    verified,
    unverified: Math.max(0, counts.stops - verified),
    failureDetailed,
    validated,
    unvalidated: Math.max(0, failureDetailed - validated),
  };
}

const issue = (code: string, message: string): WorkflowIssue => ({
  code,
  message,
  sliceId: null,
});

/**
 * SME D12 submission gate of a shift period: every stop needs a specific reason or an explicit
 * "investigation pending" (counts), and the coded share of stopped time must reach the policy target
 * (minutes; pilot 95 % by shift end) — "five trivial coded stops cannot compensate for one uncoded two-hour
 * event", so both are checked. A period without stop time passes. Pending stops stay visible as uncoded
 * time: they satisfy the per-stop rule, never the coverage target. Pure.
 */
export function codingGate(
  counts: StopCodingCounts,
  ratio: CodedRatio,
  policy: CodingGatePolicy,
): CodingGateResult {
  const uncoded = Math.max(
    0,
    counts.stops - counts.coded - counts.investigationPending,
  );
  const target = new Dec(policy.codedRatioTarget);
  const issues: WorkflowIssue[] = [];
  if (uncoded > 0) {
    issues.push(
      issue(
        'STOPS_UNCODED',
        `${plural(uncoded, 'stop has', 'stops have')} neither a reason code nor "investigation pending"`,
      ),
    );
  }
  if (ratio.value !== null && ratio.value.lt(target)) {
    issues.push(
      issue(
        'CODING_COVERAGE_LOW',
        `coded stop time ${ratio.value.times(100).toFixed(1)} % is below the target ${target.times(100).toFixed(1)} %`,
      ),
    );
  }
  return {
    mode: policy.mode,
    target: target.toString(),
    stops: counts.stops,
    coded: counts.coded,
    investigationPending: counts.investigationPending,
    uncoded,
    codedRatio: ratio.value?.toString() ?? null,
    codedSeconds: ratio.codedSeconds?.toString() ?? null,
    stoppedSeconds: ratio.stoppedSeconds?.toString() ?? null,
    passes: issues.length === 0,
    issues,
    verification: verificationOf(counts),
  };
}
