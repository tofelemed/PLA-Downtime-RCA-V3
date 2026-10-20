/** Plan 2.4 `GET /reconciliation/exceptions` (hand-written; backend `exceptions-v2.view.ts`). */
export type ExceptionType =
  | 'residual_beyond_tolerance'
  | 'claim_exceeds_component'
  | 'bridge_required'
  | 'plan_allocation_required'
  | 'stale_submission'
  | 'substitute_source'
  | 'uncoded_stop_time'
  | 'duplicate_merge_pending';

export type ExceptionWorkflow = 'none' | 'draft' | 'in_review' | 'stale';

/** Where a row is fixed (the server picks it; the browser only turns it into a link). */
export type ExceptionTarget =
  | { screen: 'period'; planId: string; periodId: string; section: 'reconciliation' | 'actuals' | 'review' }
  | { screen: 'events'; unitId: string; from: string; to: string; filter: 'uncoded' }
  | { screen: 'stop_merge'; eventId: string; reconciliationId: string }
  | { screen: 'stop_merges'; unitId: string; from: string; to: string }
  | { screen: 'none' };

export interface ReconciliationExceptionView {
  id: string;
  type: ExceptionType;
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  workflowState: ExceptionWorkflow;
  revision: number | null;
  count: number;
  /** the server's short description of the problem */
  message: string;
  target: ExceptionTarget;
}
