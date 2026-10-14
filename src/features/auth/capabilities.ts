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
  /** approve / reject adjustments and revisions, revise approved periods, decide change proposals */
  canApprovePeriods: boolean;
  /** bridge lines (SME R8: production accounting only) */
  canWriteBridges: boolean;
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

type WriteCapabilities = Omit<Capabilities, 'roles' | 'isSuperAdmin' | 'isReadOnly' | 'canViewOperations' | 'canViewAnalysis' | 'canManageMasterData' | 'canUseIntegrationConsole' | 'canAdministerTenant' | 'canUseAdminPanel' | 'canViewAuditLogs' | 'canApprove'>;

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
    canApprovePeriods: may(ServerRoles.ADJUSTMENT_APPROVERS) && may(ServerRoles.REVISION_APPROVERS),
    canWriteBridges: may(ServerRoles.BRIDGE_WRITERS),
    canWriteCodes: may(ServerRoles.CODE_WRITERS),
    canAuthorRules: may(ServerRoles.RULE_AUTHORS),
    canApproveRules: may(ServerRoles.RULE_APPROVERS),
    canWriteRca: may(ServerRoles.RCA_WRITERS),
    canWriteIntegration: may(ServerRoles.INTEGRATION_WRITERS),
    canManageRcaPolicies: may(ServerRoles.RCA_POLICY_WRITERS),
    canMaintainValuation: may(ServerRoles.FINANCE_MAINTAINERS),
    canApproveValuation: may(ServerRoles.FINANCE_APPROVERS),
    canWriteEvents: !readOnly,
    canManagePlantSettings: may(PLANT_SETTINGS_WRITERS),
  };
}

export function capabilitiesOf(roles: readonly string[]): Capabilities {
  const held = [...roles];
  const readOnly = !held.some((role) => !READ_ONLY_ROLES.has(role));
  return {
    ...writeCapabilitiesOf(held, readOnly),
    roles: held,
    isSuperAdmin: held.includes('SuperAdmin'),
    isReadOnly: readOnly,
    canViewOperations: held.length > 0,
    canViewAnalysis: held.some((role) => !OPERATIONS_ONLY_ROLES.has(role)),
    canManageMasterData: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'master_data_admin']),
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
