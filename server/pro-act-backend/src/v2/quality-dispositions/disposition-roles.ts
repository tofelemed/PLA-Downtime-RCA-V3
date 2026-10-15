/**
 * SME E3 lot dispositions (engineering default, to confirm with quality / operations): operators and
 * production record dispositions and recovery movements; a manager approver who is not the author decides.
 */
export const DISPOSITION_WRITERS = [
  'operator',
  'production_engineer',
  'production_accountant',
  'manager_approver',
] as const;

export const DISPOSITION_APPROVERS = ['manager_approver'] as const;
