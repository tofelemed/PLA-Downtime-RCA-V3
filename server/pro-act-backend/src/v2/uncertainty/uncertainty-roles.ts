/**
 * SME E4 uncertainty budgets. Metrology work is prepared by production / process engineering, the
 * integration (instrument) owner or production accounting; production accounting checks it as the
 * reconciliation owner, never the author (owner choice pending: a dedicated metrology role). Adopting a
 * budget as the unit's tolerance is a production-accounting or manager decision, never the author's.
 */
export const BUDGET_WRITERS = [
  'production_engineer',
  'integration_admin',
  'production_accountant',
  'manager_approver',
] as const;

export const BUDGET_APPROVERS = ['production_accountant'] as const;

export const TOLERANCE_ADOPTERS = [
  'production_accountant',
  'manager_approver',
] as const;
