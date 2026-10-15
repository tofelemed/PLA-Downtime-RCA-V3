import type { AuthenticatedUser } from '@/services/api/authApi';

/** Cache/request ownership includes grants: the same person may return with reduced access. */
export function sessionAuthorityKey(user: AuthenticatedUser): string {
  return JSON.stringify([user.id, user.role, user.tenantId, user.homeTenantId, user.organizationId, user.scopes]);
}
