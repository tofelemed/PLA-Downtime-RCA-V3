import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';

/** Whether the caller is an OrgAdmin whose organization is `organizationId`. */
export function isOrgAdminOf(
  caller: RequestContext,
  organizationId: string | null | undefined,
): boolean {
  return (
    caller.legacyRole === 'OrgAdmin' &&
    !!caller.organizationId &&
    caller.organizationId === organizationId
  );
}

/**
 * Tenant and organization writes: SuperAdmin anywhere, OrgAdmin only inside its own organization
 * (`@Roles('SuperAdmin', 'OrgAdmin')` admits the caller; this checks which organization).
 */
export function assertOrganizationWritable(
  caller: RequestContext,
  organizationId: string | null | undefined,
): void {
  if (caller.isSuperAdmin || isOrgAdminOf(caller, organizationId)) {
    return;
  }
  throw new ForbiddenException({
    code: 'ORGANIZATION_NOT_ALLOWED',
    message: 'Only an administrator of this organization can change it',
  });
}
