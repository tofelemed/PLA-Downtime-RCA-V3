import { ForbiddenException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/** Header a caller uses to act on another tenant than the token's (validated against membership). */
export const TENANT_SELECTION_HEADER = 'x-tenant-id';

export type ScopeKind = 'tenant' | 'site' | 'unit';

/** One `user_scopes` row: the caller holds `role` on the `kind`/`id` scope inside `tenantId`. */
export interface ScopeGrant {
  kind: ScopeKind;
  id: string;
  role: string;
  tenantId: string;
}

/**
 * Identity and scope of the current request (WF05), resolved from the verified token and the
 * `user_scopes` table by `JwtStrategy.validate`, never from a query parameter. Anonymous requests
 * (public routes, or before authentication ran) carry a context with `userId: null`.
 */
export interface RequestContext {
  userId: string | null;
  /** tenant the request acts on: the token tenant, or a validated `X-Tenant-Id` selection */
  tenantId: string | null;
  organizationId: string | null;
  /** role string on `users.role` (SuperAdmin, TenantAdmin, Engineer, ...) */
  legacyRole: string | null;
  /** legacy role, its D06 mapping and every scope role; what `@Roles()` is matched against */
  roles: string[];
  scopes: ScopeGrant[];
  isSuperAdmin: boolean;
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function anonymousContext(correlationId: string): RequestContext {
  return {
    userId: null,
    tenantId: null,
    organizationId: null,
    legacyRole: null,
    roles: [],
    scopes: [],
    isSuperAdmin: false,
    correlationId,
  };
}

/** Runs `work` with `context` as the ambient request context (middleware entry point). */
export function runWithRequestContext<T>(
  context: RequestContext,
  work: () => T,
): T {
  return storage.run(context, work);
}

/** The ambient context, or undefined outside an HTTP request (jobs, CLIs, unit tests). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Copies the resolved identity into the ambient store so code further down the request (services,
 * `scoped()`) sees it; the store object itself stays the one the middleware entered.
 */
export function bindRequestContext(resolved: RequestContext): void {
  const store = storage.getStore();
  if (store && store !== resolved) {
    Object.assign(store, resolved);
  }
}

export function tenantRequired(): ForbiddenException {
  return new ForbiddenException({
    code: 'TENANT_REQUIRED',
    message: 'No tenant is associated with this identity',
  });
}

/** The tenant of the context or 403 `TENANT_REQUIRED`; v2 services call this first. */
export function requireTenantId(
  context: RequestContext | undefined = getRequestContext(),
): string {
  if (!context?.tenantId) {
    throw tenantRequired();
  }
  return context.tenantId;
}
