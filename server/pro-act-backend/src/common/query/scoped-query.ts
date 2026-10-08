import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  getRequestContext,
  RequestContext,
  requireTenantId,
} from '../context/request-context';

export interface ScopedQueryOptions {
  /** property holding the unit id; when set, unit-only scopes restrict rows to those units */
  unitProperty?: string;
  /** explicit context (jobs, tests); defaults to the ambient request context */
  context?: RequestContext;
}

/**
 * Query builder pre-filtered to the caller's tenant (WF05, DB01). Every v2 read starts here so a
 * query can never run without `tenant_id = :scopeTenantId`; integration tests assert the predicate in
 * the SQL log. Callers with only unit-level grants are further limited to those units.
 */
export function scopedQuery<T extends ObjectLiteral>(
  repository: Repository<T>,
  alias: string,
  options: ScopedQueryOptions = {},
): SelectQueryBuilder<T> {
  const context = options.context ?? getRequestContext();
  const tenantId = requireTenantId(context);
  const qb = repository
    .createQueryBuilder(alias)
    .where(`${alias}.tenantId = :scopeTenantId`, { scopeTenantId: tenantId });
  const unitIds = options.unitProperty
    ? restrictedUnitIds(context, tenantId)
    : null;
  if (unitIds && options.unitProperty) {
    qb.andWhere(`${alias}.${options.unitProperty} IN (:...scopeUnitIds)`, {
      scopeUnitIds: unitIds.length > 0 ? unitIds : [NO_MATCH_ID],
    });
  }
  return qb;
}

/** Nil UUID: keeps `IN (...)` valid when a caller has no unit in this tenant. */
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Units the caller is limited to inside `tenantId`, or null when nothing narrower than the tenant
 * applies (SuperAdmin, a tenant-wide grant, or a legacy user without scope rows).
 */
export function restrictedUnitIds(
  context: RequestContext | undefined,
  tenantId: string,
): string[] | null {
  if (!context || context.isSuperAdmin) {
    return null;
  }
  const grants = context.scopes.filter((scope) => scope.tenantId === tenantId);
  if (grants.length === 0 || grants.some((scope) => scope.kind !== 'unit')) {
    return null;
  }
  return grants.map((scope) => scope.id);
}
