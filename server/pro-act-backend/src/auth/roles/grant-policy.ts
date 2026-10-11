import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { canGrantRole, highestRank, roleRank } from './role-model';

/** Fields of a user record that decide whether a caller may create, place or change it. */
export interface GrantTarget {
  role?: string;
  tenantId?: string;
  organizationId?: string;
  organizationName?: string;
  tenantName?: string;
}

/** A caller may grant at most its own rank (registration, `POST /users`, a role change on `PUT`). */
export function assertCallerMayGrant(
  caller: RequestContext,
  role: string | undefined,
): void {
  if (!role || !canGrantRole(caller.roles, role)) {
    throw new ForbiddenException({
      code: 'ROLE_GRANT_NOT_ALLOWED',
      message: `Cannot grant role ${role}`,
    });
  }
}

/** Unless SuperAdmin, a caller only places users into its acting tenant and own organization. */
export function assertCallerMayPlace(
  caller: RequestContext,
  data: Omit<GrantTarget, 'role'>,
): void {
  if (caller.isSuperAdmin) {
    return;
  }
  if (data.tenantId && data.tenantId !== caller.tenantId) {
    throw new ForbiddenException({
      code: 'TENANT_NOT_ALLOWED',
      message: 'Users can only be registered into your own tenant',
    });
  }
  if (data.organizationId && data.organizationId !== caller.organizationId) {
    throw new ForbiddenException({
      code: 'ORGANIZATION_NOT_ALLOWED',
      message: 'Users can only be registered into your own organization',
    });
  }
  // Creating organizations or tenants on the fly is a SuperAdmin operation
  if (data.organizationName || data.tenantName) {
    throw new ForbiddenException({
      code: 'ORGANIZATION_CREATE_NOT_ALLOWED',
      message:
        'Only a SuperAdmin can create organizations or tenants during registration',
    });
  }
}

/** Registration and `POST /users`: rank rule, then placement rule. */
export function assertCallerMayRegister(
  caller: RequestContext,
  data: GrantTarget,
): void {
  assertCallerMayGrant(caller, data.role);
  assertCallerMayPlace(caller, data);
}

/**
 * `PUT` / `DELETE /users/:id`: the target must rank strictly below the caller (a peer — another
 * TenantAdmin, another OrgAdmin — cannot be edited or deleted) and be within the caller's reach: the
 * organization for an OrgAdmin, the acting tenant for everyone else. SuperAdmin is exempt, including
 * over other SuperAdmins (there is no higher authority to manage them).
 */
export function assertCallerMayManage(
  caller: RequestContext,
  target: GrantTarget,
): void {
  if (caller.isSuperAdmin) {
    return;
  }
  if (roleRank(target.role ?? '') >= highestRank(caller.roles)) {
    throw new ForbiddenException({
      code: 'ROLE_GRANT_NOT_ALLOWED',
      message: `Cannot manage a user of role ${target.role}`,
    });
  }
  if (caller.legacyRole === 'OrgAdmin') {
    if (target.organizationId !== caller.organizationId) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_NOT_ALLOWED',
        message: 'Users of another organization cannot be managed',
      });
    }
    return;
  }
  if (!target.tenantId || target.tenantId !== caller.tenantId) {
    throw new ForbiddenException({
      code: 'TENANT_NOT_ALLOWED',
      message: 'Users of another tenant cannot be managed',
    });
  }
}

/** Tenants the caller acts in or holds a scope in (what a non-admin may list). */
export function memberTenantIds(caller: RequestContext): string[] {
  const ids = caller.scopes.map((scope) => scope.tenantId);
  if (caller.tenantId) ids.push(caller.tenantId);
  return [...new Set(ids)];
}
