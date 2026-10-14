/**
 * Roles of plan 2.4 (spec §13.2; engineering default, DECISIONS.md §D 2026-10-09). Production engineers
 * (v1 Engineer/Analyst) and manager approvers propose actuals adjustments, trigger recomputes and
 * materialize periods; approving or rejecting an adjustment needs a manager approver who is not its
 * author; external daily-production reports are imported by manager approvers or integration admins.
 * Reads: any tenant member in scope.
 */
export const PERIOD_WRITERS = [
  'production_engineer',
  'production_accountant',
  'manager_approver',
] as const;

export const ADJUSTMENT_APPROVERS = ['manager_approver'] as const;

export const REPORT_IMPORTERS = [
  'manager_approver',
  'integration_admin',
] as const;

/**
 * Accounting workflow of plan 2.8 (D06, §13.2): production engineers and manager approvers save draft
 * lines, submit, cancel and request recomputes (`PERIOD_WRITERS`); approving, rejecting, revising an
 * approved period and deciding change proposals need a manager approver — never the submitter (403
 * SEPARATION_OF_DUTIES, enforced in the services for every role including SuperAdmin).
 */
export const REVISION_APPROVERS = [
  'manager_approver',
  'production_accountant',
] as const;

/**
 * SME R8 (14 Oct 2026): manual bridge lines close a gap without naming a loss, so only production
 * accounting enters them (422 BRIDGE_NOT_ALLOWED for other writers).
 */
export const BRIDGE_WRITERS = ['production_accountant'] as const;
