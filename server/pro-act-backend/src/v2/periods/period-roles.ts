/**
 * Roles of plan 2.4 (spec §13.2; engineering default, DECISIONS.md §D 2026-10-09). Production engineers
 * (v1 Engineer/Analyst) and manager approvers propose actuals adjustments, trigger recomputes and
 * materialize periods; approving or rejecting an adjustment needs a manager approver who is not its
 * author; external daily-production reports are imported by manager approvers or integration admins.
 * Reads: any tenant member in scope.
 */
export const PERIOD_WRITERS = [
  'production_engineer',
  'manager_approver',
] as const;

export const ADJUSTMENT_APPROVERS = ['manager_approver'] as const;

export const REPORT_IMPORTERS = [
  'manager_approver',
  'integration_admin',
] as const;
