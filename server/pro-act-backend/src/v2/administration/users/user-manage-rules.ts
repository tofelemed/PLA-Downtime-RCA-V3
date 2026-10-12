import { ForbiddenException } from '@nestjs/common';
import { assertCallerMayManage } from '../../../auth/roles/grant-policy';
import { highestRank, roleRank } from '../../../auth/roles/role-model';
import { RequestContext } from '../../../common/context/request-context';
import { DirectoryUser } from './plant-user-directory';
import { UserPermissions } from './user-v2.view';

type ManagedUser = Pick<
  DirectoryUser,
  'id' | 'role' | 'tenantId' | 'organizationId'
>;

/** Whether the user's home plant is another plant than the one the caller acts in. */
export function isFromOtherPlant(
  context: RequestContext,
  user: Pick<DirectoryUser, 'tenantId'>,
): boolean {
  return Boolean(user.tenantId) && user.tenantId !== context.tenantId;
}

/**
 * Profile changes (name, e-mail, role, password, active state, delete): the v1 grant policy (rank and
 * reach), and — owner decision 2026-10-12 — only while acting in the user's home plant. A plant
 * administrator sees a user granted into its plant from another plant and manages that user's access
 * here, but the profile stays with the home plant's administrators or a super administrator.
 */
export function assertMayEditProfile(
  context: RequestContext,
  user: ManagedUser,
): void {
  if (!context.isSuperAdmin && isFromOtherPlant(context, user)) {
    throw new ForbiddenException({
      code: 'HOME_PLANT_ONLY',
      message:
        "This user's home plant is another plant: their profile is changed there",
    });
  }
  assertCallerMayManage(context, {
    role: user.role,
    tenantId: user.tenantId ?? undefined,
    organizationId: user.organizationId ?? undefined,
  });
}

/** Grants and revokes in the acting plant: never your own, otherwise only users ranked below you. */
export function mayManageAccess(
  context: RequestContext,
  user: Pick<DirectoryUser, 'id' | 'role'>,
): boolean {
  if (user.id === context.userId) return false;
  return (
    context.isSuperAdmin || roleRank(user.role) < highestRank(context.roles)
  );
}

/** The `manageable` / `accessManageable` flags of a user view. */
export function permissionsOf(
  context: RequestContext,
  user: ManagedUser,
): UserPermissions {
  let manageable = true;
  try {
    assertMayEditProfile(context, user);
  } catch {
    manageable = false;
  }
  return { manageable, accessManageable: mayManageAccess(context, user) };
}
