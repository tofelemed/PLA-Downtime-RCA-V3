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
}

const GLOBAL_ROLES = ['SuperAdmin', 'OrgAdmin'];
const OPERATIONS_ONLY_ROLES: ReadonlySet<string> = new Set(['Operator', 'operator']);
const READ_ONLY_ROLES: ReadonlySet<string> = new Set(['viewer']);

const holdsAny = (roles: readonly string[], wanted: readonly string[]): boolean =>
  roles.some((role) => wanted.includes(role));

export function capabilitiesOf(roles: readonly string[]): Capabilities {
  const held = [...roles];
  return {
    roles: held,
    isSuperAdmin: held.includes('SuperAdmin'),
    isReadOnly: !held.some((role) => !READ_ONLY_ROLES.has(role)),
    canViewOperations: held.length > 0,
    canViewAnalysis: held.some((role) => !OPERATIONS_ONLY_ROLES.has(role)),
    canManageMasterData: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'master_data_admin']),
    canUseIntegrationConsole: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'integration_admin']),
    canAdministerTenant: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin']),
    canUseAdminPanel: holdsAny(held, ['SuperAdmin', 'TenantAdmin']),
    canViewAuditLogs: holdsAny(held, GLOBAL_ROLES),
    canApprove: holdsAny(held, [...GLOBAL_ROLES, 'TenantAdmin', 'Manager', 'manager_approver']),
  };
}

/** A key of the boolean capabilities (what a menu item or page gate names). */
export type CapabilityKey = {
  [K in keyof Capabilities]: Capabilities[K] extends boolean ? K : never;
}[keyof Capabilities];
