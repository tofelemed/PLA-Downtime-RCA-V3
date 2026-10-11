/**
 * The server's `@Roles(...)` sets, copied verbatim so the UI hides what the server can only refuse
 * (owner decision 2026-10-12). `server-role-sets.test.ts` reads each server file and fails when a list
 * here drifts from its source. The server remains the authority.
 */

/** v2/plans/plan-roles.ts */
export const PLAN_WRITERS = ['production_engineer', 'manager_approver'] as const;
export const PLAN_APPROVERS = ['manager_approver'] as const;

/** v2/profiles/profile-roles.ts (profiles, rates, valuation rates, FX rates) */
export const PROFILE_WRITERS = ['master_data_admin', 'manager_approver'] as const;
export const PROFILE_APPROVERS = ['manager_approver'] as const;

/** v2/calendars/calendar-roles.ts */
export const CALENDAR_WRITERS = ['master_data_admin', 'manager_approver'] as const;

/** v2/periods/period-roles.ts */
export const PERIOD_WRITERS = ['production_engineer', 'manager_approver'] as const;
export const ADJUSTMENT_APPROVERS = ['manager_approver'] as const;
export const REVISION_APPROVERS = ['manager_approver'] as const;

/** v2/code-libraries/code-library-v2.controller.ts */
export const CODE_WRITERS = ['master_data_admin', 'manager_approver'] as const;

/** v2/rules/rules-v2.controller.ts */
export const RULE_AUTHORS = ['master_data_admin', 'manager_approver'] as const;
export const RULE_APPROVERS = ['manager_approver'] as const;

/** rca-case/rca-scope.ts */
export const RCA_WRITERS = ['reliability_engineer', 'manager_approver'] as const;

/** v2/intake/intake-roles.ts (connections, jobs, signals, replay, quarantine) */
export const INTEGRATION_WRITERS = ['integration_admin', 'manager_approver'] as const;

/** v2/valuation/valuation-policies-v2.controller.ts */
export const POLICY_ROLES = ['manager_approver'] as const;

/** v2/feature-flags/feature-flags-v2.controller.ts */
export const FLAG_WRITERS = ['manager_approver'] as const;

/** audit-log/audit-roles.ts: who reads the audit trail of the acting plant */
export const AUDIT_READERS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'manager_approver'] as const;

/** auth/guards/write-access.guard.ts: roles that can never write */
export const READ_ONLY_ROLES = ['viewer'] as const;

/**
 * `satisfiesRole` of `auth/roles/role-model.ts`: SuperAdmin satisfies anything, OrgAdmin anything but
 * SuperAdmin, everyone else needs the role itself (the D06 mapping is already in `roles`).
 */
export function satisfiesAnyRole(roles: readonly string[], required: readonly string[]): boolean {
  if (roles.includes('SuperAdmin')) return true;
  if (roles.includes('OrgAdmin')) return required.some((role) => role !== 'SuperAdmin');
  return roles.some((role) => required.includes(role));
}
