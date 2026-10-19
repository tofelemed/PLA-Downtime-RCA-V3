import { RequestContext } from '../../common/context/request-context';
import { legacyRolesOf } from './legacy-roles-of';
import { satisfiesRole } from './role-model';

/** A unit and the site it belongs to (a site grant covers the site's units). */
export interface UnitRef {
  id: string;
  siteId: string | null;
}

/**
 * Roles the caller holds for one unit of the acting tenant: the legacy role and its D06 mapping where they
 * apply (already merged into `context.roles` for the acting tenant), and every scope grant — own or
 * delegated — on the tenant, the unit's site or the unit itself.
 */
export function rolesOnUnit(context: RequestContext, unit: UnitRef): string[] {
  const legacy = legacyRolesOf(context);
  const granted = context.scopes
    .filter((scope) => scope.tenantId === context.tenantId)
    .filter(
      (scope) =>
        scope.kind === 'tenant' ||
        (scope.kind === 'unit' && scope.id === unit.id) ||
        (scope.kind === 'site' && scope.id === unit.siteId),
    )
    .map((scope) => scope.role);
  return [...new Set([...legacy, ...granted])];
}

/** Whether the caller holds any of `roles` for the unit (SuperAdmin / OrgAdmin satisfy every role). */
export function holdsAnyRoleOnUnit(
  context: RequestContext,
  unit: UnitRef,
  roles: readonly string[],
): boolean {
  const held = rolesOnUnit(context, unit);
  const global = context.roles.filter(
    (role) => role === 'SuperAdmin' || role === 'OrgAdmin',
  );
  return roles.some((role) => satisfiesRole([...held, ...global], role));
}
