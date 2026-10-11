import type { AuthenticatedUser, SessionScope } from '@/services/api/authApi';

/**
 * Effective roles of the signed-in user in an acting plant, derived exactly the way the server's
 * `RequestContextFactory` derives a request's roles (WF05, decision D06):
 *
 * - the legacy role (`users.role`) and its D06 mapping count only in the home tenant, except
 *   SuperAdmin everywhere and OrgAdmin inside tenants of its own organization;
 * - plus the roles of the `user_scopes` grants held in the acting tenant.
 *
 * Pure: no React, no I/O. The server remains the authority; this only decides what the browser shows.
 */
export type RoleSubject = Pick<
  AuthenticatedUser,
  'role' | 'tenantId' | 'organizationId' | 'homeTenantId' | 'scopes'
>;

export interface ActingPlant {
  /** null / undefined = no selection, i.e. the home tenant */
  tenantId: string | null | undefined;
  /** organization of the acting tenant when the caller knows it (plant selector) */
  organizationId?: string | null;
}

/** D06 legacy → scope role; SuperAdmin and OrgAdmin stay global roles (they hold every scope role). */
const LEGACY_TO_SCOPE_ROLE: Readonly<Record<string, string>> = {
  SuperAdmin: 'SuperAdmin',
  OrgAdmin: 'OrgAdmin',
  TenantAdmin: 'manager_approver',
  Manager: 'manager_approver',
  Analyst: 'production_engineer',
  Engineer: 'production_engineer',
  Operator: 'operator',
};

/** Roles the UI lets pick any plant for; the server still verifies every selection. */
const GLOBAL_ROLES: ReadonlySet<string> = new Set(['SuperAdmin', 'OrgAdmin']);

export function mapLegacyRole(legacyRole: string): string {
  return LEGACY_TO_SCOPE_ROLE[legacyRole] ?? legacyRole;
}

/** The legacy role itself plus its D06 mapping, as the request context carries them. */
export function rolesForLegacyRole(legacyRole: string | null | undefined): string[] {
  if (!legacyRole) return [];
  return [...new Set([legacyRole, mapLegacyRole(legacyRole)])];
}

export function homeTenantOf(user: RoleSubject): string | null {
  return user.homeTenantId ?? user.tenantId ?? null;
}

export function isGlobalAdmin(user: Pick<RoleSubject, 'role'>): boolean {
  return GLOBAL_ROLES.has(user.role);
}

export function scopesIn(user: RoleSubject, tenantId: string | null): SessionScope[] {
  if (!tenantId) return [];
  return (user.scopes ?? []).filter((scope) => scope.tenantId === tenantId);
}

/** Tenants the user holds a scope in, plus the home tenant, each once. */
export function scopedTenantIds(user: RoleSubject): string[] {
  const home = homeTenantOf(user);
  const ids = (user.scopes ?? []).map((scope) => scope.tenantId);
  return [...new Set(home ? [home, ...ids] : ids)];
}

/**
 * Whether the legacy role applies in the acting plant: always in the home tenant, SuperAdmin
 * everywhere, OrgAdmin in its own organization. An unknown organization of the acting plant is
 * left to the server (optimistic), which answers 403 TENANT_NOT_ALLOWED when it is not allowed.
 */
export function legacyRoleAppliesIn(user: RoleSubject, acting: ActingPlant): boolean {
  const home = homeTenantOf(user);
  if (!acting.tenantId || acting.tenantId === home) return true;
  if (user.role === 'SuperAdmin') return true;
  if (user.role !== 'OrgAdmin' || !user.organizationId) return false;
  const organization = acting.organizationId ?? scopesIn(user, acting.tenantId)[0]?.organizationId ?? null;
  return organization === null || organization === user.organizationId;
}

/** Roles held in the acting plant: legacy role (when it applies) + scope roles there, each once. */
export function effectiveRoles(user: RoleSubject, acting: ActingPlant): string[] {
  const tenantId = acting.tenantId || homeTenantOf(user);
  const legacy = legacyRoleAppliesIn(user, acting) ? rolesForLegacyRole(user.role) : [];
  const scoped = scopesIn(user, tenantId).map((scope) => scope.role);
  return [...new Set([...legacy, ...scoped])];
}

/**
 * Whether the plant selector may offer a tenant: global admins see every plant (the server verifies);
 * everyone else their home tenant and the tenants they hold a scope in.
 */
export function maySelectTenant(user: RoleSubject, tenantId: string): boolean {
  if (isGlobalAdmin(user)) return true;
  return scopedTenantIds(user).includes(tenantId);
}
