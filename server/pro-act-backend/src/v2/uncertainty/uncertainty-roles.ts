/**
 * SME E4 uncertainty budgets. Metrology work is prepared by production / process engineering, the
 * integration (instrument) owner, production accounting or the metrology owner; the metrology /
 * instrumentation owner approves measurement uncertainty, never the author (owner, 15 Oct 2026: common
 * practice, ISO/IEC 17025 / GUM ownership). Adopting a budget as the unit's tolerance stays a
 * production-accounting or manager decision, never the budget author's.
 */
export const BUDGET_WRITERS = [
  'production_engineer',
  'integration_admin',
  'production_accountant',
  'manager_approver',
  'metrology_approver',
] as const;

export const BUDGET_APPROVERS = ['metrology_approver'] as const;

export const TOLERANCE_ADOPTERS = [
  'production_accountant',
  'manager_approver',
] as const;
