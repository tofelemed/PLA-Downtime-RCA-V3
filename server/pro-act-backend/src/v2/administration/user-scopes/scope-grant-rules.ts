import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  canGrantRole,
  highestRank,
  mapLegacyRole,
  roleRank,
} from '../../../auth/roles/role-model';
import { UserScope } from '../../../auth/scopes/user-scope.entity';
import { RequestContext } from '../../../common/context/request-context';
import { ScopeLock } from './user-scope-v2.view';

/** What the grant rules need to know about the user who receives or holds a grant. */
export interface GrantHolder {
  id: string;
  role: string;
  tenantId: string | null;
  organizationId: string | null;
  isActive: boolean;
  /** roles of the holder's plant-wide grants in its home plant (unknown = treat the mirror as the only one) */
  homePlantRoles?: readonly string[];
}

/**
 * The grant mirrors the user's legacy role in its home plant and is the user's only plant role there
 * (changed through the role, not here). QA audit 2026-10-19: once the user holds another role in the plant,
 * plant-wide, the mirror is an ordinary grant and may be revoked, so a user can hold exactly the guide's role; the
 * D06 mapping does not come back while any own grant remains (`legacyRolesApplying`).
 */
export function isHomeScope(scope: UserScope, holder: GrantHolder): boolean {
  const mirror =
    scope.scopeKind === 'tenant' &&
    scope.scopeId === holder.tenantId &&
    scope.role === mapLegacyRole(holder.role);
  if (!mirror) return false;
  const others = (holder.homePlantRoles ?? []).filter(
    (role) => role !== scope.role,
  );
  return others.length === 0;
}

/** A non-SuperAdmin manages only holders ranked strictly below itself (no peers, no superiors). */
function outranksCaller(context: RequestContext, holder: GrantHolder): boolean {
  return (
    !context.isSuperAdmin && roleRank(holder.role) >= highestRank(context.roles)
  );
}

/**
 * Why the caller may not revoke a grant (null = it may): its own grants (separation of duties), the home
 * role mirror, grants of users it does not outrank or of a role above its own, users it cannot see.
 */
export function revokeLock(
  context: RequestContext,
  scope: UserScope,
  holder: GrantHolder | undefined,
): ScopeLock {
  if (!context.isSuperAdmin && scope.userId === context.userId)
    return 'own_grant';
  if (!holder) return 'other_plant';
  if (isHomeScope(scope, holder)) return 'home_role';
  if (
    outranksCaller(context, holder) ||
    !canGrantRole(context.roles, scope.role)
  ) {
    return 'outranks_you';
  }
  return null;
}

/** Throws the refusal that matches a lock (403 for authority, 422 for the home-role mirror). */
export function assertNotLocked(lock: ScopeLock): void {
  if (lock === null) return;
  if (lock === 'home_role') {
    throw new UnprocessableEntityException({
      code: 'HOME_SCOPE_REQUIRED',
      message:
        "This grant comes from the user's role in its home plant; change the role instead",
    });
  }
  throw refusal(lock);
}

/** Rules of a new grant: not to yourself, a role at most your rank, a holder ranked below you, active. */
export function assertMayGrant(
  context: RequestContext,
  holder: GrantHolder,
  role: string,
): void {
  if (!context.isSuperAdmin && holder.id === context.userId)
    throw refusal('own_grant');
  if (!canGrantRole(context.roles, role) || outranksCaller(context, holder)) {
    throw refusal('outranks_you');
  }
  if (!holder.isActive) {
    throw new UnprocessableEntityException({
      code: 'USER_INACTIVE',
      message: 'Activate the user before granting access',
    });
  }
}

function refusal(
  lock: Exclude<ScopeLock, null | 'home_role'>,
): ForbiddenException {
  if (lock === 'own_grant') {
    return new ForbiddenException({
      code: 'SELF_GRANT_NOT_ALLOWED',
      message: 'You cannot change your own access (separation of duties)',
    });
  }
  return new ForbiddenException({
    code: 'ROLE_GRANT_NOT_ALLOWED',
    message:
      lock === 'other_plant'
        ? 'This user is not visible in your plant'
        : 'You can only manage access below your own rank',
  });
}
