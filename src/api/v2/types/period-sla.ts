/**
 * Reconciliation SLA views (backend `src/v2/close/period-sla*.view.ts`, `reconciliation-queue-v2.controller.ts`;
 * SME R3 / R6): due times, overdue and escalation are the server's — the browser only displays them.
 */
export type SlaStage = 'not_due' | 'preparation' | 'review' | 'waiting_for_data' | 'done';

export interface PeriodSlaView {
  stage: SlaStage;
  submitDueAt: string;
  approveDueAt: string;
  dueAt: string | null;
  overdue: boolean;
  ageSeconds: number;
  pausedSeconds: number;
  onHold: boolean;
  escalationLevel: number;
  escalatedTo: string | null;
  rejections: number;
  rejectionEscalated: boolean;
  dayEnd: string;
  policyVersion: number;
}

export type DataHoldKind = 'lab' | 'source' | 'other';

export interface DataHoldView {
  id: string;
  kind: DataHoldKind;
  reason: string;
  startedAt: string;
  startedBy: string | null;
  endedAt: string | null;
  endedBy: string | null;
  endNote: string | null;
}

export interface RejectionView {
  at: string;
  by: string | null;
  reason: string | null;
  failedLines: string[];
  resubmitDueAt: string | null;
  rejection: number | null;
  escalated: boolean;
  escalatedTo: string | null;
}

export interface PeriodSlaDetailView {
  periodId: string;
  sla: PeriodSlaView;
  holds: DataHoldView[];
  lastRejection: RejectionView | null;
}

export type QueueTask = 'prepare' | 'review' | 'escalated';

export interface QueueItemView {
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  workflowState: string;
  revision: number | null;
  task: QueueTask;
  dueAt: string;
  overdue: boolean;
  escalationLevel: number;
  escalatedTo: string | null;
  onHold: boolean;
  rejections: number;
  rejectionEscalated: boolean;
}
