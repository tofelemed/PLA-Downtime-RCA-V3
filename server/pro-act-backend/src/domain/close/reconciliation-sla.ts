import { ReconciliationSlaPolicy } from './sla-policy';

const HOUR_MS = 3_600_000;

/** Workflow of a period's current revision, as the grid shows it. */
export type SlaWorkflow = 'none' | 'draft' | 'in_review' | 'stale' | 'approved';

/** A "waiting for data" interval (lab result, failed source): the clocks pause while it is open. */
export interface DataHoldSpan {
  startedAt: Date;
  endedAt: Date | null;
}

export interface SlaInputs {
  /** end of the production day the period belongs to (latest period end of its unit and date) */
  dayEnd: Date;
  asOf: Date;
  workflow: SlaWorkflow;
  /** the latest rejection of the current revision, null when it was never rejected */
  lastRejectedAt: Date | null;
  /** rejections of the current revision (SME R6: "same period / version lineage") */
  rejections: number;
  holds: readonly DataHoldSpan[];
}

export type SlaStage =
  | 'not_due'
  | 'preparation'
  | 'review'
  | 'waiting_for_data'
  | 'done';

export interface SlaStatus {
  stage: SlaStage;
  submitDueAt: Date;
  approveDueAt: Date;
  /** the current stage's due time has passed (never while waiting for data or once approved) */
  overdue: boolean;
  /** seconds since the production day ended, without the time spent waiting for data */
  ageSeconds: number;
  pausedSeconds: number;
  /** 0 = none; n = the n-th step of the policy's escalations */
  escalationLevel: number;
  escalatedTo: string | null;
  rejections: number;
  rejectionEscalated: boolean;
}

/** Time the holds overlap `[from, asOf)`, in milliseconds (a hold still open runs to `asOf`). */
export function pausedMs(
  holds: readonly DataHoldSpan[],
  from: Date,
  asOf: Date,
): number {
  return holds.reduce((sum, hold) => {
    const start = Math.max(hold.startedAt.getTime(), from.getTime());
    const end = Math.min((hold.endedAt ?? asOf).getTime(), asOf.getTime());
    return sum + Math.max(0, end - start);
  }, 0);
}

function stageOf(inputs: SlaInputs, onHold: boolean): SlaStage {
  if (inputs.workflow === 'approved') return 'done';
  if (onHold) return 'waiting_for_data';
  if (inputs.asOf < inputs.dayEnd) return 'not_due';
  return inputs.workflow === 'in_review' || inputs.workflow === 'stale'
    ? 'review'
    : 'preparation';
}

/** The highest escalation step the age has reached (index + 1), 0 below the first. */
function escalationOf(
  ageMs: number,
  policy: ReconciliationSlaPolicy,
): { level: number; role: string | null } {
  let level = 0;
  policy.escalations.forEach((step, i) => {
    if (ageMs >= step.afterHours * HOUR_MS) level = i + 1;
  });
  return { level, role: level ? policy.escalations[level - 1].role : null };
}

/**
 * Due times, overdue and escalation of a period (SME R3 / R6). Submission is due `submitWithinHours`
 * after the production day ends — or `resubmitWithinHours` after the latest rejection, whichever is later;
 * approval `approveWithinHours − submitWithinHours` after that. Time waiting for data is added to both
 * and left out of the age, so a lab hold never makes a period overdue or escalates it; nothing is ever
 * approved to meet a clock. The third rejection of the same revision escalates on its own.
 */
export function slaStatus(
  inputs: SlaInputs,
  policy: ReconciliationSlaPolicy,
): SlaStatus {
  const { dayEnd, asOf } = inputs;
  const onHold = inputs.holds.some((h) => h.endedAt === null);
  const paused = pausedMs(inputs.holds, dayEnd, asOf);
  const firstDue = dayEnd.getTime() + policy.submitWithinHours * HOUR_MS;
  const resubmitDue = inputs.lastRejectedAt
    ? inputs.lastRejectedAt.getTime() + policy.resubmitWithinHours * HOUR_MS
    : firstDue;
  const submitDue = Math.max(firstDue, resubmitDue) + paused;
  const approveDue =
    submitDue +
    (policy.approveWithinHours - policy.submitWithinHours) * HOUR_MS;
  const stage = stageOf(inputs, onHold);
  const open = stage !== 'done';
  const ageMs = open
    ? Math.max(0, asOf.getTime() - dayEnd.getTime() - paused)
    : 0;
  const escalation = escalationOf(ageMs, policy);
  const due = stage === 'review' ? approveDue : submitDue;
  const rejectionEscalated =
    open && inputs.rejections >= policy.rejectionEscalationCount;
  return {
    stage,
    submitDueAt: new Date(submitDue),
    approveDueAt: new Date(approveDue),
    overdue:
      (stage === 'preparation' || stage === 'review') && asOf.getTime() > due,
    ageSeconds: Math.floor(ageMs / 1000),
    pausedSeconds: Math.floor(paused / 1000),
    escalationLevel: open ? escalation.level : 0,
    escalatedTo: open ? escalation.role : null,
    rejections: inputs.rejections,
    rejectionEscalated,
  };
}
