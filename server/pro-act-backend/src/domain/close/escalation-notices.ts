import { ReconciliationSlaPolicy } from './sla-policy';

/** The escalation state of one period, as `slaPeriodsCte` computes it. */
export interface EscalatedPeriod {
  periodId: string;
  /** current revision (the rejection count belongs to it; null = not reconciled yet) */
  revisionId: string | null;
  escalationLevel: number;
  rejectionEscalated: boolean;
  rejections: number;
}

/** One notice owed to the holders of a role: at most one per period and key, ever. */
export interface EscalationNotice {
  dedupeKey: string;
  role: string;
  reason: 'age' | 'rejections';
  level: number | null;
  afterHours: number | null;
  rejections: number | null;
}

/**
 * The notices an escalated period owes (SME R3 / R6): every age escalation level it reached — level n tells
 * the role of the n-th step, once per period (`sla:<period>:age:<n>`), so a period first seen at level 2
 * still tells level 1 — and the rejection escalation once per revision (`sla:<period>:rejection:<revision>`;
 * a revise starts a new count).
 */
export function escalationNotices(
  period: EscalatedPeriod,
  policy: ReconciliationSlaPolicy,
): EscalationNotice[] {
  const reached = Math.min(period.escalationLevel, policy.escalations.length);
  const notices: EscalationNotice[] = policy.escalations
    .slice(0, reached)
    .map((step, index) => ({
      dedupeKey: `sla:${period.periodId}:age:${index + 1}`,
      role: step.role,
      reason: 'age',
      level: index + 1,
      afterHours: step.afterHours,
      rejections: null,
    }));
  if (period.rejectionEscalated && period.revisionId) {
    notices.push({
      dedupeKey: `sla:${period.periodId}:rejection:${period.revisionId}`,
      role: policy.rejectionEscalationRole,
      reason: 'rejections',
      level: null,
      afterHours: null,
      rejections: period.rejections,
    });
  }
  return notices;
}
