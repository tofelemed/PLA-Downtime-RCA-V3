/** The SLA state of one ended, not approved period, as `slaPeriodsCte` computes it. */
export interface DuePeriod {
  periodId: string;
  /** current revision (null = not reconciled yet) */
  revisionId: string | null;
  /** `none`, `draft`, `in_review`, `stale` or `approved` */
  workflow: string;
  /** past the current stage's due time and not waiting for data */
  overdue: boolean;
  /** rejections of the current revision (each starts a new submission cycle) */
  rejections: number;
}

export type ReminderStage = 'submit' | 'approve';

/** Who a reminder is for: the preparer of the period (submit) or its independent checker (approve). */
export type ReminderRecipient = 'preparer' | 'checker';

/** One reminder owed when a stage falls due: at most one per period, stage and submission cycle, ever. */
export interface DueReminder {
  dedupeKey: string;
  stage: ReminderStage;
  recipient: ReminderRecipient;
}

const IN_REVIEW: ReadonlySet<string> = new Set(['in_review', 'stale']);

/**
 * SME R3 "remind the preparer and checker when due", before any escalation: a period whose current stage is
 * past its due time (and not on a data hold) owes one reminder — the preparer while it waits for submission,
 * the checker while it waits for approval. Keyed per period, stage and submission cycle
 * (`sla:<period>:due:<stage>:<revision>:<rejections>`), so a rejection that sets a new due time reminds again
 * and nothing is ever sent twice. An approved period owes nothing.
 */
export function dueReminder(period: DuePeriod): DueReminder | null {
  if (!period.overdue || period.workflow === 'approved') return null;
  const stage: ReminderStage = IN_REVIEW.has(period.workflow)
    ? 'approve'
    : 'submit';
  const cycle = `${period.revisionId ?? 'none'}:${period.rejections}`;
  return {
    dedupeKey: `sla:${period.periodId}:due:${stage}:${cycle}`,
    stage,
    recipient: stage === 'submit' ? 'preparer' : 'checker',
  };
}
