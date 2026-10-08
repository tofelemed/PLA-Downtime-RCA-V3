import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

export const TENANT_SELECTION_HEADER = 'x-tenant-id';

/**
 * The tenant a request acts on comes from the verified token, never from a query parameter (WF05).
 * A SuperAdmin may select a tenant with `X-Tenant-Id`; membership validation against `user_scopes`
 * arrives with the tenancy tables in the second half of 0.4.
 */
export function resolveRequestTenantId(
  user: AuthenticatedUser | undefined,
  selectedTenantHeader?: string | string[],
): string {
  const selected = Array.isArray(selectedTenantHeader)
    ? selectedTenantHeader[0]
    : selectedTenantHeader;
  if (user?.role === 'SuperAdmin' && selected) {
    return selected;
  }
  if (user?.tenantId) {
    return user.tenantId;
  }
  throw new ForbiddenException({
    code: 'TENANT_REQUIRED',
    message: 'No tenant is associated with this identity',
  });
}
