import { SetMetadata } from '@nestjs/common';

export const TENANT_BOUND_KEY = 'tenantBound';

export interface TenantBoundSpec {
  /** a POST body without `tenantId` gets the acting tenant written into it */
  fill: boolean;
}

/**
 * Binds a v1 route (class or handler) to the acting tenant: a `tenantId` in the body or query must be
 * the tenant of the request context (`X-Tenant-Id` or the token tenant). SuperAdmin and OrgAdmin may
 * name any tenant they could select; a read may name any tenant within the caller's scopes. Anything
 * else is 403 `TENANT_MISMATCH` (`TenantBindingGuard`).
 *
 * `fill` (default true) also writes the acting tenant into a POST body that names none, so a create
 * never lands in a tenant the caller did not act on; pass `{ fill: false }` where the handler sets the
 * tenant itself or the create DTO has no `tenantId` field.
 */
export const TenantBound = (options: Partial<TenantBoundSpec> = {}) =>
  SetMetadata<string, TenantBoundSpec>(TENANT_BOUND_KEY, {
    fill: options.fill ?? true,
  });
