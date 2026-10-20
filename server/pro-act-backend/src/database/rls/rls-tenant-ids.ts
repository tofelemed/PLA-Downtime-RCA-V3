import { RequestContext } from '../../common/context/request-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Matches no tenant: a signed-in caller without any tenant sees no tenant rows. */
export const NO_TENANT = '00000000-0000-0000-0000-000000000000';
/** Role without BYPASSRLS created by the `TenantRowLevelSecurity` migration. */
export const RLS_ROLE = 'proact_rls_user';

/**
 * Value of the `app.tenant_ids` session setting for a request (plan 3.11, `TenantRowLevelSecurity`
 * migration): '' (no restriction) without a signed-in identity — public routes, workers, CLIs — and for
 * SuperAdmin; otherwise the acting tenant plus every tenant the caller holds a scope in. Only lowercase
 * uuids survive, so the value is always safe to inline in SQL.
 */
export function rlsTenantIds(context: RequestContext | undefined): string {
  if (!context?.userId || context.isSuperAdmin) return '';
  const ids = [
    context.tenantId,
    ...context.scopes.map((scope) => scope.tenantId),
  ]
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.toLowerCase())
    .filter((id) => UUID.test(id));
  const unique = [...new Set(ids)].sort();
  return unique.length > 0 ? unique.join(',') : NO_TENANT;
}

/**
 * Statement run on connection checkout: a restricted request switches to the RLS role with its tenants,
 * anything else resets both. Connections are pooled, so the statement runs whenever the connection's last
 * applied binding differs (`tenant-session-binding.ts`).
 */
export function sessionBindingSql(tenantIds: string): string {
  if (!/^[0-9a-f,-]*$/.test(tenantIds)) {
    throw new Error('Refusing to bind an invalid tenant list');
  }
  return tenantIds === ''
    ? `RESET ROLE; SELECT set_config('app.tenant_ids', '', false)`
    : `SET ROLE ${RLS_ROLE}; SELECT set_config('app.tenant_ids', '${tenantIds}', false)`;
}
