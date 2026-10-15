/**
 * SME E3 lot dispositions. Operators, production and the lab record dispositions and recovery movements;
 * the decision belongs to Quality / Lab (owner decision, ISO 9001: product release is independent of
 * production), so only a `quality_approver` who is not the author approves or rejects.
 */
export const DISPOSITION_WRITERS = [
  'operator',
  'production_engineer',
  'production_accountant',
  'manager_approver',
  'quality_approver',
] as const;

export const DISPOSITION_APPROVERS = ['quality_approver'] as const;
