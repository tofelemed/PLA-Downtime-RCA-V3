/**
 * Plan 1.10 unit impact rules (engineering default, DECISIONS 15 Oct 2026): drafted by master data, the
 * unit's process / reliability engineers or a manager approver; approved or retired by a manager approver
 * who did not draft it (the rule changes stopped time and loss, like the flow map).
 */
export const UNIT_IMPACT_RULE_WRITERS = [
  'master_data_admin',
  'manager_approver',
  'production_engineer',
  'reliability_engineer',
] as const;

export const UNIT_IMPACT_RULE_APPROVERS = ['manager_approver'] as const;
