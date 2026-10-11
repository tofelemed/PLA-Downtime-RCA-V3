import { V2ApiError } from '@/api/v2/errors';

/** True when the server refused the acting tenant itself (403 TENANT_NOT_ALLOWED), not one resource of it. */
export function isTenantRefusal(error: unknown): boolean {
  return error instanceof V2ApiError && error.status === 403 && error.code === 'TENANT_NOT_ALLOWED';
}
