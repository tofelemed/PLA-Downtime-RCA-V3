/**
 * Roles of the intake commands (spec §13.2; engineering default, DECISIONS.md §D 2026-10-08):
 * connections and jobs are integration configuration; replay and quarantine resolution change canonical
 * data, so they need an integration admin or a manager approver. Reads: any tenant member.
 */
export const INTEGRATION_WRITERS = [
  'integration_admin',
  'manager_approver',
] as const;

export const REPLAY_ROLES = ['integration_admin', 'manager_approver'] as const;
