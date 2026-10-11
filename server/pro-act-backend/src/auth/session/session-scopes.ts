import { ScopeGrant } from '../../common/context/request-context';

/**
 * One grant of the signed-in user as the login / profile responses expose it: the role held in a
 * tenant, tenant-wide unless limited to some units or sites. It is the `user_scopes` rows grouped by
 * tenant and role; the browser derives its effective roles per acting plant from it exactly the way
 * `RequestContextFactory` does (legacy role in the home tenant + these scope roles).
 */
export interface SessionScope {
  tenantId: string;
  organizationId?: string;
  role: string;
  /** present only when the grant is limited to these units (no tenant-wide row for the role) */
  unitIds?: string[];
  /** present only when the grant is limited to these sites */
  siteIds?: string[];
}

interface ScopeAccumulator {
  tenantId: string;
  role: string;
  tenantWide: boolean;
  unitIds: string[];
  siteIds: string[];
}

/** Groups `user_scopes` grants by tenant and role, in order of first appearance. */
export function toSessionScopes(
  grants: readonly ScopeGrant[],
  organizationOfTenant: ReadonlyMap<string, string> = new Map(),
): SessionScope[] {
  const groups = new Map<string, ScopeAccumulator>();
  for (const grant of grants) {
    const key = `${grant.tenantId}|${grant.role}`;
    const group = groups.get(key) ?? {
      tenantId: grant.tenantId,
      role: grant.role,
      tenantWide: false,
      unitIds: [],
      siteIds: [],
    };
    if (grant.kind === 'tenant') group.tenantWide = true;
    if (grant.kind === 'unit') group.unitIds.push(grant.id);
    if (grant.kind === 'site') group.siteIds.push(grant.id);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) =>
    toSessionScope(group, organizationOfTenant.get(group.tenantId)),
  );
}

function toSessionScope(
  group: ScopeAccumulator,
  organizationId: string | undefined,
): SessionScope {
  const scope: SessionScope = { tenantId: group.tenantId, role: group.role };
  if (organizationId) scope.organizationId = organizationId;
  if (group.tenantWide) return scope;
  if (group.unitIds.length) scope.unitIds = [...new Set(group.unitIds)];
  if (group.siteIds.length) scope.siteIds = [...new Set(group.siteIds)];
  return scope;
}

/** Tenant ids a list of grants refers to, each once. */
export function tenantIdsOf(grants: readonly ScopeGrant[]): string[] {
  return [...new Set(grants.map((grant) => grant.tenantId))];
}
