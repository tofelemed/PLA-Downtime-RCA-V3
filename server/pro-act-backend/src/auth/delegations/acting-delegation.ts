import { RequestContext } from '../../common/context/request-context';
import { legacyRolesOf } from '../roles/legacy-roles-of';
import { UnitRef } from '../roles/unit-roles';

/** The delegation a decision was taken under (recorded with the workflow step). */
export interface ActingDelegation {
  delegationId: string;
  delegatorId: string;
  role: string;
}

function covers(
  grant: { kind: string; id: string },
  tenantId: string,
  unit: UnitRef,
): boolean {
  if (grant.kind === 'tenant') return grant.id === tenantId;
  if (grant.kind === 'site') return grant.id === unit.siteId;
  return grant.id === unit.id;
}

/**
 * SME R1 / R6: when the caller holds none of `roles` for the unit on their own (scope grant or legacy
 * home-plant role) but through a delegation, the delegation used — so the approval history says "approved
 * as delegate of …". Null when the caller acts on their own authority (or as a global administrator).
 */
export function actingDelegation(
  context: RequestContext,
  roles: readonly string[],
  unit: UnitRef,
): ActingDelegation | null {
  const tenantId = context.tenantId;
  if (!tenantId || context.isSuperAdmin) return null;
  const legacy = legacyRolesOf(context);
  if (legacy.some((r) => roles.includes(r) || r === 'OrgAdmin')) return null;
  const relevant = context.scopes.filter(
    (s) =>
      s.tenantId === tenantId &&
      roles.includes(s.role) &&
      covers(s, tenantId, unit),
  );
  if (relevant.some((s) => !s.delegationId)) return null;
  const used = relevant.find((s) => s.delegationId && s.delegatorId);
  return used
    ? {
        delegationId: used.delegationId as string,
        delegatorId: used.delegatorId as string,
        role: used.role,
      }
    : null;
}
