import type { AuthenticatedUser, SessionScope } from '@/services/api/authApi';

/**
 * Effective roles of the signed-in user in an acting plant, derived exactly the way the server's
 * `RequestContextFactory` derives a request's roles (WF05, decision D06):
 *
 * - the legacy role (`users.role`) counts only in the home tenant, except
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

/**
 * QA audit 2026-10-19 (guide roles only, server `legacyRolesApplying`): the legacy role's D06 scope role is
 * a fallback that counts only while the user holds no grant in the plant; with any grant the plant roles
 * are exactly the grants (plus the legacy role name, and the global SuperAdmin / OrgAdmin).
 */
export function legacyRolesApplying(legacyRole: string | null | undefined, holdsGrant: boolean): string[] {
  if (!legacyRole) return [];
  return holdsGrant ? [legacyRole] : rolesForLegacyRole(legacyRole);
}

/** Roles held in the acting plant: legacy role (when it applies) + scope roles there, each once. */
export function effectiveRoles(user: RoleSubject, acting: ActingPlant): string[] {
  const tenantId = acting.tenantId || homeTenantOf(user);
  const scoped = scopesIn(user, tenantId).map((scope) => scope.role);
  const legacy = legacyRoleAppliesIn(user, acting) ? legacyRolesApplying(user.role, scoped.length > 0) : [];
  return [...new Set([...legacy, ...scoped])];
}

/** A plant as the selector and the stored selection know it. */
export interface SelectablePlant {
  id: string;
  organizationId?: string | null;
}

/**
 * The user's organisation: the session's `organizationId`, else the organisation of the home tenant
 * (from its scope grant, or from `tenants` when the caller holds the plant list). Null when unknown.
 */
export function organizationOf(user: RoleSubject, tenants: readonly SelectablePlant[] = []): string | null {
  if (user.organizationId) return user.organizationId;
  const home = homeTenantOf(user);
  if (!home) return null;
  const fromScope = (user.scopes ?? []).find((scope) => scope.tenantId === home)?.organizationId;
  return fromScope ?? tenants.find((tenant) => tenant.id === home)?.organizationId ?? null;
}

/**
 * Whether the plant selector may offer a plant: SuperAdmin every plant; OrgAdmin the plants of its own
 * organisation; everyone their home tenant and the tenants they hold a scope in. An OrgAdmin whose
 * organisation, or the plant's, is unknown is left to the server (403 TENANT_NOT_ALLOWED, shown by the
 * plant access guard) rather than locked out of a plant it may hold.
 */
export function maySelectTenant(
  user: RoleSubject,
  plant: SelectablePlant,
  organizationId: string | null = organizationOf(user),
): boolean {
  if (user.role === 'SuperAdmin') return true;
  if (scopedTenantIds(user).includes(plant.id)) return true;
  if (user.role !== 'OrgAdmin') return false;
  const plantOrganization = plant.organizationId ?? null;
  if (plantOrganization === null || organizationId === null) return true;
  return plantOrganization === organizationId;
}
