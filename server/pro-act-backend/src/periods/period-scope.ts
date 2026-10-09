import { ForbiddenException } from '@nestjs/common';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { invalidReference, notFound } from '../profiles/profile-errors';

/**
 * Periods, adjustments, recomputes and the unit scope (WF05). A period belongs to one unit: callers whose
 * grants stop at some units read and write only periods of those units (another unit's period answers
 * 404; a body unit outside the scope is 422 INVALID_REFERENCE). Tenant- or site-wide effects — external
 * daily-production reports (a site document), materializing every unit — need a tenant-wide grant (403).
 */
export function periodScopeUnits(context: RequestContext): string[] | null {
  return restrictedUnitIds(context, requireTenantId(context));
}

export function assertPeriodUnitInScope(
  context: RequestContext,
  unitId: string,
  what = 'Production period',
): void {
  const allowed = periodScopeUnits(context);
  if (allowed && !allowed.includes(unitId)) throw notFound(what);
}

/** Body unit ids must be in the caller's scope (422, no existence leak). */
export function assertBodyUnitsInScope(
  context: RequestContext,
  unitIds: readonly string[],
  field = 'unitIds',
): void {
  const allowed = periodScopeUnits(context);
  if (!allowed) return;
  if (unitIds.some((unitId) => !allowed.includes(unitId))) {
    throw invalidReference(field, 'unit');
  }
}

/** 403 TENANT_SCOPE_REQUIRED for a unit-limited caller. */
export function assertTenantWide(context: RequestContext, what: string): void {
  if (periodScopeUnits(context)) {
    throw new ForbiddenException({
      code: 'TENANT_SCOPE_REQUIRED',
      message: `${what} affects every unit of the site; a tenant-wide grant is required`,
    });
  }
}

/** Whether a stored job scope (null = tenant-wide) covers a unit. */
export function scopeCovers(
  scopeUnits: readonly string[] | null,
  unitId: string,
): boolean {
  return scopeUnits === null || scopeUnits.includes(unitId);
}
