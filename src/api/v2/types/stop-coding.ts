/**
 * SME D12 / D13 stop coding of a shift period (backend `domain/reconciliation/coding-gate.ts`,
 * `v2/production-events/stop-verification.service.ts`): the submission gate the server evaluates and the
 * staged verification counts. Every figure comes from the server.
 */
export interface CodingGateIssueView {
  code: 'STOPS_UNCODED' | 'CODING_COVERAGE_LOW' | string;
  message: string;
  sliceId: string | null;
}

export interface CodingVerificationCountsView {
  verified: number;
  unverified: number;
  failureDetailed: number;
  validated: number;
  unvalidated: number;
}

export interface CodingGateView {
  /** `block` refuses the submission when the gate fails; `warn` only shows it */
  mode: 'block' | 'warn';
  /** coded share of stopped time required (decimal string, 0.95 = 95 %) */
  target: string;
  stops: number;
  coded: number;
  investigationPending: number;
  /** neither a reason code nor "investigation pending" */
  uncoded: number;
  /** coded stop time / all stop time of the current run (decimal string); null = no stop time */
  codedRatio: string | null;
  codedSeconds: string | null;
  stoppedSeconds: string | null;
  passes: boolean;
  issues: CodingGateIssueView[];
  verification: CodingVerificationCountsView;
}

/** `POST /production-events/verification` and `…/{id}/validate-failure`: what was done, what was skipped and why. */
export interface VerificationOutcomeView {
  done: string[];
  skipped: Array<{ eventId: string; reason: string }>;
  at: string;
}
