/**
 * Role vocabulary (spec §13.2, decision D06).
 *
 * Legacy roles live on `users.role`; scope roles live on `user_scopes.role`. Until every caller
 * uses scope roles, a request context carries both the legacy role and its D06 mapping, so
 * `@Roles('manager_approver')` and `@Roles('TenantAdmin')` both admit a TenantAdmin.
 */
export const LEGACY_ROLES = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
  'Manager',
  'Analyst',
  'Engineer',
  'Operator',
] as const;
export type LegacyRole = (typeof LEGACY_ROLES)[number];

export const SCOPE_ROLES = [
  'manager_approver',
  'production_engineer',
  'reliability_engineer',
  'integration_admin',
  'master_data_admin',
  'operator',
  'viewer',
] as const;
export type ScopeRole = (typeof SCOPE_ROLES)[number];

export type RoleName = LegacyRole | ScopeRole;

/** D06 legacy → scope role; SuperAdmin and OrgAdmin stay global roles (they hold every scope role). */
const LEGACY_TO_SCOPE_ROLE: Readonly<Record<LegacyRole, RoleName>> = {
  SuperAdmin: 'SuperAdmin',
  OrgAdmin: 'OrgAdmin',
  TenantAdmin: 'manager_approver',
  Manager: 'manager_approver',
  Analyst: 'production_engineer',
  Engineer: 'production_engineer',
  Operator: 'operator',
};

/** Ordering used for "a caller may not grant a role above its own" (higher = more privilege). */
const ROLE_RANK: Readonly<Record<RoleName, number>> = {
  SuperAdmin: 100,
  OrgAdmin: 90,
  TenantAdmin: 80,
  Manager: 70,
  manager_approver: 70,
  master_data_admin: 60,
  integration_admin: 60,
  reliability_engineer: 50,
  Analyst: 50,
  Engineer: 50,
  production_engineer: 50,
  Operator: 40,
  operator: 40,
  viewer: 10,
};

export function isLegacyRole(value: string): value is LegacyRole {
  return (LEGACY_ROLES as readonly string[]).includes(value);
}

export function isKnownRole(value: string): value is RoleName {
  return value in ROLE_RANK;
}

/** Scope role a legacy user role maps to (D06); unknown roles map to themselves. */
export function mapLegacyRole(legacyRole: string): string {
  return isLegacyRole(legacyRole)
    ? LEGACY_TO_SCOPE_ROLE[legacyRole]
    : legacyRole;
}

/** Unknown role strings rank lowest so they can never out-rank a known one. */
export function roleRank(role: string): number {
  return isKnownRole(role) ? ROLE_RANK[role] : 0;
}

export function highestRank(roles: readonly string[]): number {
  return roles.reduce((best, role) => Math.max(best, roleRank(role)), 0);
}

/** Global roles satisfy every scope role (D06: "SuperAdmin/OrgAdmin → all roles"). */
export function holdsEveryScopeRole(roles: readonly string[]): boolean {
  return roles.includes('SuperAdmin') || roles.includes('OrgAdmin');
}

/**
 * Whether a caller holding `callerRoles` satisfies `required`: SuperAdmin satisfies anything,
 * OrgAdmin anything but SuperAdmin, everyone else needs the role itself.
 */
export function satisfiesRole(
  callerRoles: readonly string[],
  required: string,
): boolean {
  if (callerRoles.includes('SuperAdmin')) {
    return true;
  }
  if (callerRoles.includes('OrgAdmin')) {
    return required !== 'SuperAdmin';
  }
  return callerRoles.includes(required);
}

/** A caller may grant at most its own rank (registration, invitations). */
export function canGrantRole(
  callerRoles: readonly string[],
  target: string,
): boolean {
  return roleRank(target) <= highestRank(callerRoles) && roleRank(target) > 0;
}

/** Roles a request context carries for a legacy role: the role itself plus its D06 mapping. */
export function rolesForLegacyRole(legacyRole: string | null): string[] {
  if (!legacyRole) {
    return [];
  }
  return [...new Set([legacyRole, mapLegacyRole(legacyRole)])];
}
