import { PeriodSla } from '../../close/reconciliation-sla.service';
import { SlaStage } from '../../domain/close/reconciliation-sla';

/** SLA of a period (SME R3 / R6): the server's due times, overdue verdict and escalation. */
export interface PeriodSlaV2View {
  stage: SlaStage;
  submitDueAt: string;
  approveDueAt: string;
  /** the due time of the current stage (preparation → submit, review → approve) */
  dueAt: string | null;
  overdue: boolean;
  /** seconds since the production day ended, without time waiting for data */
  ageSeconds: number;
  pausedSeconds: number;
  onHold: boolean;
  /** 0 = none; 1 = production accounting (48 h), 2 = plant management (72 h) at the pilot settings */
  escalationLevel: number;
  escalatedTo: string | null;
  rejections: number;
  /** the third rejection of the same revision went to production accounting */
  rejectionEscalated: boolean;
  dayEnd: string;
  policyVersion: number;
}

export function toPeriodSlaView(sla: PeriodSla): PeriodSlaV2View {
  const { status } = sla;
  const dueAt =
    status.stage === 'review'
      ? status.approveDueAt
      : status.stage === 'preparation' || status.stage === 'not_due'
        ? status.submitDueAt
        : null;
  return {
    stage: status.stage,
    submitDueAt: status.submitDueAt.toISOString(),
    approveDueAt: status.approveDueAt.toISOString(),
    dueAt: dueAt ? dueAt.toISOString() : null,
    overdue: status.overdue,
    ageSeconds: status.ageSeconds,
    pausedSeconds: status.pausedSeconds,
    onHold: sla.onHold,
    escalationLevel: status.escalationLevel,
    escalatedTo: status.escalatedTo,
    rejections: status.rejections,
    rejectionEscalated: status.rejectionEscalated,
    dayEnd: sla.inputs.dayEnd.toISOString(),
    policyVersion: sla.policyVersion,
  };
}
