import type { DataHoldKind, PeriodSlaView, QueueTask } from '@/api/v2/types/period-sla';

/** Plain words for the SLA stage of a period (SME R3). */
export const SLA_STAGE_LABELS: Record<PeriodSlaView['stage'], string> = {
  not_due: 'Production day not ended',
  preparation: 'To submit',
  review: 'To approve',
  waiting_for_data: 'Waiting for data',
  done: 'Approved',
};

/** What a period waits for. */
export const HOLD_KIND_LABELS: Record<DataHoldKind, string> = {
  lab: 'Lab result',
  source: 'Source system',
  other: 'Other data',
};

/** What "My queue" asks of the user. */
export const QUEUE_TASK_LABELS: Record<QueueTask, string> = {
  prepare: 'Prepare and submit',
  review: 'Review and approve',
  escalated: 'Escalated to you',
};
