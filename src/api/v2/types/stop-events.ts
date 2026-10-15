/** Read models of `/v2/stop-reconciliations` and `/v2/stop-incidents` (plan 1.10, DT-04, SME D5). */

/** The event fields a duplicate or incident row shows. */
export interface StopEventSummaryView {
  id: string;
  sourceKind: string;
  source: string | null;
  assetId: string | null;
  reasonCodeId: string | null;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  physicalState: string;
  occurrenceId: string;
}

export type StopReconciliationState = 'suggested' | 'merged' | 'rejected' | 'undone' | 'expired';

export interface StopReconciliationView {
  id: string;
  unitId: string;
  state: StopReconciliationState;
  mode: 'auto' | 'manual';
  suggestionReason: 'same_source' | 'cause_conflict' | 'ambiguous' | null;
  startDeltaSeconds: number;
  endDeltaSeconds: number | null;
  toleranceSeconds: number;
  conflicts: string[];
  copied: Record<string, string | null>;
  kept: StopEventSummaryView | null;
  evidence: StopEventSummaryView | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  rowVersion: number;
}

export interface StopIncidentView {
  id: string;
  unitId: string;
  assetId: string | null;
  reasonCodeId: string;
  startTime: string;
  endTime: string | null;
  stopCount: number;
  /** physical stopped seconds of the closed stops (never the envelope) */
  stoppedSeconds: number;
  envelopeSeconds: number | null;
  windowSeconds: number;
  stops: StopEventSummaryView[];
  newFailureOccurrenceIds: string[];
}
