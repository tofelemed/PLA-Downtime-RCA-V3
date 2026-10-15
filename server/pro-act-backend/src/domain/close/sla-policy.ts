import {
  integer,
  positive,
  Raw,
  record,
  WorkflowPolicyError,
} from './policy-fields';

/** One escalation step: unresolved this many hours after the production day ended → the role is told. */
export interface EscalationStep {
  afterHours: number;
  role: string;
}

/**
 * `reconciliation_sla` body (contracts/policies/reconciliation_sla.schema.json; SME R3 / R6 pilot):
 * clocks run from the end of the production day and pause while the period waits for data.
 */
export interface ReconciliationSlaPolicy {
  /** submission due this many hours after the production day ends */
  submitWithinHours: number;
  /** approval due this many hours after the production day ends */
  approveWithinHours: number;
  /** after a rejection the preparer resubmits within this many hours of it (the new due time) */
  resubmitWithinHours: number;
  /** level 1, 2, … in ascending `afterHours` */
  escalations: EscalationStep[];
  /** the n-th rejection of the same revision escalates (SME R6: the third) */
  rejectionEscalationCount: number;
  rejectionEscalationRole: string;
}

/**
 * SME R3 / R6 pilot settings: submit ≤ 12 h after the production day ends, approve ≤ 24 h; escalate at 48 h
 * to production accounting, at 72 h to plant management; the third rejection goes to production accounting.
 */
export const RECONCILIATION_SLA_DEFAULT: ReconciliationSlaPolicy = {
  submitWithinHours: 12,
  approveWithinHours: 24,
  resubmitWithinHours: 12,
  escalations: [
    { afterHours: 48, role: 'production_accountant' },
    { afterHours: 72, role: 'manager_approver' },
  ],
  rejectionEscalationCount: 3,
  rejectionEscalationRole: 'production_accountant',
};

function role(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new WorkflowPolicyError(`${field} must name a role`);
  }
  return value;
}

function escalations(value: unknown): EscalationStep[] {
  if (!Array.isArray(value)) {
    throw new WorkflowPolicyError('escalations must be a list');
  }
  const steps = value.map((item: unknown, i) => {
    const raw: Raw = record(item, `escalations[${i}]`);
    return {
      afterHours: positive(raw.afterHours, `escalations[${i}].afterHours`),
      role: role(raw.role, `escalations[${i}].role`),
    };
  });
  if (steps.some((s, i) => i > 0 && s.afterHours <= steps[i - 1].afterHours)) {
    throw new WorkflowPolicyError('escalations must rise in afterHours');
  }
  return steps;
}

export function parseReconciliationSla(body: unknown): ReconciliationSlaPolicy {
  const raw = record(body, 'reconciliation_sla');
  const policy: ReconciliationSlaPolicy = {
    submitWithinHours: positive(raw.submitWithinHours, 'submitWithinHours'),
    approveWithinHours: positive(raw.approveWithinHours, 'approveWithinHours'),
    resubmitWithinHours: positive(
      raw.resubmitWithinHours,
      'resubmitWithinHours',
    ),
    escalations: escalations(raw.escalations),
    rejectionEscalationCount: integer(
      raw.rejectionEscalationCount,
      'rejectionEscalationCount',
      1,
    ),
    rejectionEscalationRole: role(
      raw.rejectionEscalationRole,
      'rejectionEscalationRole',
    ),
  };
  if (policy.approveWithinHours < policy.submitWithinHours) {
    throw new WorkflowPolicyError('approval cannot be due before submission');
  }
  return policy;
}
