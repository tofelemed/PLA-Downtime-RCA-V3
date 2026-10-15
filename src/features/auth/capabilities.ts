import * as ServerRoles from './server-role-sets';

/**
 * What the UI lets the user reach, decided from the effective roles in the acting plant
 * (`effective-roles.ts`). Menus and page gates read these instead of the legacy `user.role`; the
 * server still refuses anything the roles do not allow (403 FORBIDDEN_ROLE / READ_ONLY_ROLE).
 */
export interface Capabilities {
  /** effective roles in the acting plant, as the server would resolve them */
  roles: string[];
  isSuperAdmin: boolean;
  /** every role held in the acting plant is read-only (or none is held): no write can succeed */
  isReadOnly: boolean;
  /** the operations screens every role sees (dashboard, events, downtime, tasks) */
  canViewOperations: boolean;
  /** the analysis and planning screens (reports, plans, RCA, codes, finance, historian) */
  canViewAnalysis: boolean;
  canManageMasterData: boolean;
  /**
   * the Master data menu entry: master-data administrators, and the roles that write one of its
   * reliability pages (stop policy, standby, work orders, unit state) — they see only those pages' links
   */
  canReachMasterData: boolean;
  canUseIntegrationConsole: boolean;
  /** user management, permissions, settings of the plant */
  canAdministerTenant: boolean;
  canUseAdminPanel: boolean;
  canViewAuditLogs: boolean;
  /** approve plans, profiles, rules and RCAs */
  canApprove: boolean;
  /** v2 write capabilities, one per server `@Roles` set (`server-role-sets.ts`) */
  canWritePlans: boolean;
  canApprovePlans: boolean;
  /** profiles and rates */
  canWriteProfiles: boolean;
  canApproveProfiles: boolean;
  canWriteCalendars: boolean;
  /** period accounting: draft lines, submit, cancel, recompute */
  canWritePeriods: boolean;
  /** approve / reject actuals adjustments (manager approvers only, `ADJUSTMENT_APPROVERS`) */
  canApproveAdjustments: boolean;
  /**
   * approve / reject submitted revisions, revise approved periods, decide change proposals (production
   * accounting too, SME R1, `REVISION_APPROVERS`); adjustments stay with `canApproveAdjustments`
   */
  canApproveRevisions: boolean;
  /** SME R4: propose a correction of an approved period of a closing or locked month */
  canProposeCorrections: boolean;
  /** SME R1 / R4 month close: plant management closes quantities, finance signs off and locks */
  canCloseMonthQuantities: boolean;
  canSignOffMonth: boolean;
  canReviewMonthMateriality: boolean;
  canReopenMonth: boolean;
  /** SME R5: posting date and treatment of a restatement (finance approvers) */
  canDecidePosting: boolean;
  /** owner decision 14 Oct 2026 (SME R2): certify a production day (plant management) */
  canCertifyDay: boolean;
  /** SME R13: draft source status mappings / approve them as the source owner (never the author) */
  canWriteStatusMappings: boolean;
  canApproveStatusMappings: boolean;
  /** bridge lines (SME R8: production accounting only) */
  canWriteBridges: boolean;
  /** SME E3: record lot dispositions and recovery movements (operators and production) */
  canWriteDispositions: boolean;
  /** SME E3: approve / reject them (manager approvers, never the author) */
  canApproveDispositions: boolean;
  /** SME E4: record uncertainty budgets / approve them (production accounting, never the author) */
  canWriteUncertaintyBudgets: boolean;
  canApproveUncertaintyBudgets: boolean;
  /** SME E4: adopt an approved budget as the unit's absolute reconciliation tolerance */
  canAdoptTolerance: boolean;
  canWriteCodes: boolean;
  canAuthorRules: boolean;
  canApproveRules: boolean;
  canWriteRca: boolean;
  /** intake connections, jobs, signals, replay, quarantine and mappings */
  canWriteIntegration: boolean;
  /** RCA trigger policies (manager approvers) */
  canManageRcaPolicies: boolean;
  /** SME V1: draft valuation policies, FX rates, valuation rates and demand statuses (finance maintainers) */
  canMaintainValuation: boolean;
  /** SME V1: approve / retire them (finance approvers, never the author) */
  canApproveValuation: boolean;
  /** oee_policy versions over HTTP: micro-stop thresholds and the transition allowance (manager approvers) */
  canWriteOeePolicy: boolean;
  /** SME D9: register / retire standby equipment and import its demand / test log */
  canWriteStandby: boolean;
  /** SME D10: import CMMS work-order operations */
  canWriteWorkOrders: boolean;
  /** SME D1 / D2: unit state mapping versions and staleness settings */
  canWriteStateMappings: boolean;
  /** SME R1 / R6: record delegations of approval roles (administrators for anyone, holders for themselves) */
  canDelegateApprovals: boolean;
  /** SME D13: verify stop coding as the unit's supervisor / validate failure detail as maintenance */
  canVerifyStops: boolean;
  canValidateFailures: boolean;
  /** v2 production events: any member whose role is not read-only (WriteAccessGuard) */
  canWriteEvents: boolean;
  /**
   * plant display settings (calendar system, digits): the server's tenant-setting rule
   * (`app-settings-access.policy.ts` canWriteSetting: TenantAdmin or manager_approver in the plant, SuperAdmin)
   */
  canManagePlantSettings: boolean;
}

const GLOBAL_ROLES = ['SuperAdmin', 'OrgAdmin'];
/** server/pro-act-backend/src/app-settings/app-settings-access.policy.ts canWriteSetting (tenant-owned settings) */
const PLANT_SETTINGS_WRITERS = ['TenantAdmin', 'manager_approver'] as const;
const OPERATIONS_ONLY_ROLES: ReadonlySet<string> = new Set(['Operator', 'operator']);
const READ_ONLY_ROLES: ReadonlySet<string> = new Set(ServerRoles.READ_ONLY_ROLES);

const holdsAny = (roles: readonly string[], wanted: readonly string[]): boolean =>
  roles.some((role) => wanted.includes(role));

type WriteCapabilities = Omit<Capabilities, 'roles' | 'isSuperAdmin' | 'isReadOnly' | 'canViewOperations' | 'canViewAnalysis' | 'canManageMasterData' | 'canReachMasterData' | 'canUseIntegrationConsole' | 'canAdministerTenant' | 'canUseAdminPanel' | 'canViewAuditLogs' | 'canApprove'>;

/** The v2 write capabilities; a read-only plant gets none (the server's WriteAccessGuard runs first). */
function writeCapabilitiesOf(held: readonly string[], readOnly: boolean): WriteCapabilities {
  const may = (set: readonly string[]) => !readOnly && ServerRoles.satisfiesAnyRole(held, set);
  return {
    canWritePlans: may(ServerRoles.PLAN_WRITERS),
    canApprovePlans: may(ServerRoles.PLAN_APPROVERS),
    canWriteProfiles: may(ServerRoles.PROFILE_WRITERS),
    canApproveProfiles: may(ServerRoles.PROFILE_APPROVERS),
    canWriteCalendars: may(ServerRoles.CALENDAR_WRITERS),
    canWritePeriods: may(ServerRoles.PERIOD_WRITERS),
    canApproveAdjustments: may(ServerRoles.ADJUSTMENT_APPROVERS),
    canApproveRevisions: may(ServerRoles.REVISION_APPROVERS),
    canProposeCorrections: may(ServerRoles.CORRECTION_PROPOSERS),
    canCloseMonthQuantities: may(ServerRoles.QUANTITY_CLOSERS),
    canSignOffMonth: may(ServerRoles.FINANCE_SIGNERS),
    canReviewMonthMateriality: may(ServerRoles.MATERIALITY_REVIEWERS),
    canReopenMonth: may(ServerRoles.MONTH_REOPENERS),
    canDecidePosting: may(ServerRoles.POSTING_DECIDERS),
    canCertifyDay: may(ServerRoles.DAY_CERTIFIERS),
    canWriteStatusMappings: may(ServerRoles.STATUS_MAPPING_AUTHORS),
    canApproveStatusMappings: may(ServerRoles.SOURCE_OWNERS),
    canWriteBridges: may(ServerRoles.BRIDGE_WRITERS),
    canWriteDispositions: may(ServerRoles.DISPOSITION_WRITERS),
    canApproveDispositions: may(ServerRoles.DISPOSITION_APPROVERS),
    canWriteUncertaintyBudgets: may(ServerRoles.BUDGET_WRITERS),
    canApproveUncertaintyBudgets: may(ServerRoles.BUDGET_APPROVERS),
    canAdoptTolerance: may(ServerRoles.TOLERANCE_ADOPTERS),
    canWriteCodes: may(ServerRoles.CODE_WRITERS),
    canAuthorRules: may(ServerRoles.RULE_AUTHORS),
    canApproveRules: may(ServerRoles.RULE_APPROVERS),
    canWriteRca: may(ServerRoles.RCA_WRITERS),
    canWriteIntegration: may(ServerRoles.INTEGRATION_WRITERS),
    canManageRcaPolicies: may(ServerRoles.RCA_POLICY_WRITERS),
    canMaintainValuation: may(ServerRoles.FINANCE_MAINTAINERS),
    canApproveValuation: may(ServerRoles.FINANCE_APPROVERS),
    canWriteOeePolicy: may(ServerRoles.OEE_POLICY_WRITERS),
    canWriteStandby: may(ServerRoles.STANDBY_WRITERS),
    canWriteWorkOrders: may(ServerRoles.WORK_ORDER_WRITERS),
    canWriteStateMappings: may(ServerRoles.STATE_MAPPING_WRITERS),
    canDelegateApprovals: may(ServerRoles.DELEGATION_WRITERS),
    canVerifyStops: may(ServerRoles.STOP_VERIFIERS),
    canValidateFailures: may(ServerRoles.FAILURE_VALIDATORS),
    canWriteEvents: !readOnly,
    canManagePlantSettings: may(PLANT_SETTINGS_WRITERS),
  };
}

export function capabilitiesOf(roles: readonly string[]): Capabilities {
  const held = [...roles];
  const readOnly = !held.some((role) => !READ_ONLY_ROLES.has(role));
  const writes = writeCapabilitiesOf(held, readOnly);
  const canManageMasterData = holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'master_data_admin']);
  return {
    ...writes,
    roles: held,
    isSuperAdmin: held.includes('SuperAdmin'),
    isReadOnly: readOnly,
    canViewOperations: held.length > 0,
    canViewAnalysis: held.some((role) => !OPERATIONS_ONLY_ROLES.has(role)),
    canManageMasterData,
    canReachMasterData:
      canManageMasterData || writes.canWriteOeePolicy || writes.canWriteStandby || writes.canWriteWorkOrders || writes.canWriteStateMappings,
    canUseIntegrationConsole: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'integration_admin']),
    canAdministerTenant: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin']),
    canUseAdminPanel: holdsAny(held, ['SuperAdmin', 'TenantAdmin']),
    // the server's GET /audit-logs roles (read in the acting plant only)
    canViewAuditLogs: ServerRoles.satisfiesAnyRole(held, ServerRoles.AUDIT_READERS),
    canApprove: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'Manager', 'manager_approver']),
  };
}

/** A key of the boolean capabilities (what a menu item or page gate names). */
export type CapabilityKey = {
  [K in keyof Capabilities]: Capabilities[K] extends boolean ? K : never;
}[keyof Capabilities];
