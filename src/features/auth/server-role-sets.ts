/**
 * The server's `@Roles(...)` sets, copied verbatim so the UI hides what the server can only refuse
 * (owner decision 2026-10-12). `server-role-sets.test.ts` reads each server file and fails when a list
 * here drifts from its source. The server remains the authority.
 */

/** v2/plans/plan-roles.ts */
export const PLAN_WRITERS = ['production_engineer', 'manager_approver'] as const;
export const PLAN_APPROVERS = ['manager_approver'] as const;

/** v2/profiles/profile-roles.ts (profiles and rates) */
export const PROFILE_WRITERS = ['master_data_admin', 'manager_approver'] as const;
export const PROFILE_APPROVERS = ['manager_approver'] as const;

/** v2/calendars/calendar-roles.ts */
export const CALENDAR_WRITERS = ['master_data_admin', 'manager_approver'] as const;

/** v2/periods/period-roles.ts */
export const PERIOD_WRITERS = ['production_engineer', 'production_accountant', 'manager_approver'] as const;
export const ADJUSTMENT_APPROVERS = ['manager_approver'] as const;
export const REVISION_APPROVERS = ['manager_approver', 'production_accountant'] as const;
export const BRIDGE_WRITERS = ['production_accountant'] as const;
/** SME R4: a manual change proposal of a closing or locked month */
export const CORRECTION_PROPOSERS = ['production_accountant', 'manager_approver'] as const;

/** v2/quality-dispositions/disposition-roles.ts (SME E3 lot dispositions) */
export const DISPOSITION_WRITERS = ['operator', 'production_engineer', 'production_accountant', 'manager_approver', 'quality_approver'] as const;
export const DISPOSITION_APPROVERS = ['quality_approver'] as const;

/** v2/production-events/verification-roles.ts (SME D13: supervisor verifies, maintenance validates) */
export const STOP_VERIFIERS = ['manager_approver', 'production_engineer'] as const;
export const FAILURE_VALIDATORS = ['reliability_engineer'] as const;

/**
 * v2/production-events/event-write-roles.ts (owner decision 2026-10-19): create, code, split, merge, bulk code,
 * close and retract events, decide review items and duplicate stops; the production accountant has read-only coding
 */
export const EVENT_WRITERS = ['operator', 'production_engineer', 'reliability_engineer', 'manager_approver'] as const;

/** v2/uncertainty/uncertainty-roles.ts (SME E4 uncertainty budgets) */
export const BUDGET_WRITERS = ['production_engineer', 'integration_admin', 'production_accountant', 'manager_approver', 'metrology_approver'] as const;
export const BUDGET_APPROVERS = ['metrology_approver'] as const;
export const TOLERANCE_ADOPTERS = ['production_accountant', 'manager_approver'] as const;

/** v2/source-authority/source-authority-roles.ts (owner 15 Oct 2026: maker-checker source authority versions) */
export const SOURCE_AUTHORITY_WRITERS = ['integration_admin', 'production_accountant'] as const;
export const SOURCE_AUTHORITY_APPROVERS = ['production_accountant'] as const;
/** v2/loss-accounting/loss-accounting-roles.ts (declared mode: the source authority sets, plus the plant administrator to draft and the manager to approve) */
export const LOSS_ACCOUNTING_WRITERS = ['integration_admin', 'production_accountant', 'TenantAdmin'] as const;
export const LOSS_ACCOUNTING_APPROVERS = ['production_accountant', 'manager_approver'] as const;
/** v2/administration/administration-roles.ts (SME R1 / R6: who records delegations of approval roles) */
export const DELEGATION_WRITERS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'manager_approver', 'production_accountant', 'finance_approver', 'quality_approver', 'metrology_approver'] as const;

/** v2/plant-model/unit-impact-roles.ts (plan 1.10: unit impact rules, maker-checker) */
export const UNIT_IMPACT_RULE_WRITERS = ['master_data_admin', 'manager_approver', 'reliability_engineer'] as const;
export const UNIT_IMPACT_RULE_APPROVERS = ['manager_approver'] as const;

/** v2/code-libraries/code-library-v2.controller.ts */
export const CODE_WRITERS = ['master_data_admin', 'manager_approver'] as const;

/** v2/rules/rules-v2.controller.ts */
export const RULE_AUTHORS = ['master_data_admin', 'manager_approver'] as const;
export const RULE_APPROVERS = ['manager_approver'] as const;

/** rca-case/rca-scope.ts */
export const RCA_WRITERS = ['reliability_engineer', 'manager_approver'] as const;

/** v2/intake/intake-roles.ts (connections, jobs, signals, replay, quarantine) */
export const INTEGRATION_WRITERS = ['integration_admin', 'manager_approver'] as const;

/** v2/valuation/valuation-roles.ts (SME V1: valuation policies, FX rates, valuation rates, demand statuses) */
export const FINANCE_MAINTAINERS = ['finance_maintainer'] as const;
export const FINANCE_APPROVERS = ['finance_approver'] as const;

/** v2/close/close-roles.ts (SME R1 / R4: month close) */
export const QUANTITY_CLOSERS = ['manager_approver'] as const;
export const FINANCE_SIGNERS = ['finance_approver'] as const;
export const MATERIALITY_REVIEWERS = ['production_accountant', 'manager_approver', 'finance_approver'] as const;
export const MONTH_REOPENERS = ['manager_approver', 'finance_approver'] as const;
/** SME R5: finance sets the posting date and treatment of a restatement */
export const POSTING_DECIDERS = ['finance_approver'] as const;
/** owner decision 14 Oct 2026 (SME R2): plant management certifies a production day */
export const DAY_CERTIFIERS = ['manager_approver'] as const;
/** SME R13: source status mappings are drafted by maintainers and approved by the source owner */
export const STATUS_MAPPING_AUTHORS = ['integration_admin', 'production_accountant'] as const;
export const SOURCE_OWNERS = ['production_accountant'] as const;

/** v2/rca-policies/rca-policies-v2.controller.ts (`@Roles` on the write) */
export const RCA_POLICY_WRITERS = ['manager_approver'] as const;

/** v2/feature-flags/feature-flags-v2.controller.ts */
export const FLAG_WRITERS = ['manager_approver'] as const;

/** v2/reliability/reliability-roles.ts (SME D9 standby log, D10 CMMS operations, D1 / D2 state mappings) */
export const STANDBY_WRITERS = ['operator', 'reliability_engineer', 'integration_admin', 'manager_approver'] as const;
export const WORK_ORDER_WRITERS = ['reliability_engineer', 'integration_admin', 'manager_approver'] as const;
export const STATE_MAPPING_WRITERS = ['integration_admin', 'manager_approver'] as const;

/** micro-stop and transition-allowance policy controllers (`@Roles('manager_approver')` on the write) */
export const OEE_POLICY_WRITERS = ['manager_approver'] as const;

/** audit-log/audit-roles.ts: who reads the audit trail of the acting plant */
export const AUDIT_READERS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'manager_approver'] as const;

/** auth/guards/write-access.guard.ts: roles that can never write */
export const READ_ONLY_ROLES = ['viewer'] as const;

/** auth/money/money-access.ts (QA re-test 2026-10-19): the roles the server withholds money from */
export const MONEY_EXCLUDED_ROLES = ['Operator', 'operator'] as const;

/**
 * `satisfiesRole` of `auth/roles/role-model.ts`: SuperAdmin satisfies anything, OrgAdmin anything but
 * SuperAdmin, everyone else needs the role itself (the D06 mapping is already in `roles`).
 */
export function satisfiesAnyRole(roles: readonly string[], required: readonly string[]): boolean {
  if (roles.includes('SuperAdmin')) return true;
  if (roles.includes('OrgAdmin')) return required.some((role) => role !== 'SuperAdmin');
  return roles.some((role) => required.includes(role));
}

/**
 * v2/approvals/approval-workflows.ts + approval-catalog.ts: every role that decides a kind of the Pending
 * approvals inbox (STOP_DECISION_ROLES = EVENT_WRITERS: operators decide duplicate-stop merges there), plus the
 * legacy administrator roles the inbox serves (TenantAdmin / Manager). A plant role outside it (finance
 * maintainer, master data or integration administrator, viewer) can never decide an inbox item.
 */
export const APPROVAL_DECIDERS: readonly string[] = [
  ...new Set([
    'TenantAdmin',
    'Manager',
    ...PLAN_APPROVERS,
    ...PROFILE_APPROVERS,
    ...ADJUSTMENT_APPROVERS,
    ...REVISION_APPROVERS,
    ...DISPOSITION_APPROVERS,
    ...BUDGET_APPROVERS,
    ...SOURCE_AUTHORITY_APPROVERS,
    ...SOURCE_OWNERS,
    ...UNIT_IMPACT_RULE_APPROVERS,
    ...RULE_APPROVERS,
    ...FINANCE_APPROVERS,
    ...MATERIALITY_REVIEWERS,
    ...EVENT_WRITERS,
  ]),
];
