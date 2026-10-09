import { ForbiddenException } from '@nestjs/common';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { satisfiesRole } from '../auth/roles/role-model';
import { notFound } from './plan-errors';

/**
 * Plan writes and the unit scope (WF05). A plan belongs to one unit: callers whose grants stop at some
 * units may only create, edit, generate and approve plans of those units (a plan of another unit answers
 * 404 like an unknown id; a body unit outside their scope is 422 INVALID_REFERENCE). Scenarios are
 * tenant-wide (403 TENANT_SCOPE_REQUIRED, `assertTenantWideWriter`).
 */
export function scopeUnitIds(context: RequestContext): string[] | null {
  return restrictedUnitIds(context, requireTenantId(context));
}

/** A unit-limited caller sees and writes only plans whose unit is one of theirs. */
export function assertPlanUnitInScope(
  context: RequestContext,
  unitId: string,
): void {
  const allowed = scopeUnitIds(context);
  if (allowed && !allowed.includes(unitId)) throw notFound('Production plan');
}

/** Whether a stored job scope (null = tenant-wide) covers a unit. */
export function scopeCovers(
  scopeUnits: readonly string[] | null,
  unitId: string,
): boolean {
  return scopeUnits === null || scopeUnits.includes(unitId);
}

/** Approval of plan versions (PLAN04): a manager approver (D06 mapping of TenantAdmin/Manager). */
export const PLAN_APPROVER_ROLE = 'manager_approver';

/** 403 unless the caller holds `role` (used where no `@Roles()` guard runs: the v1 bridge). */
export function assertRole(context: RequestContext, role: string): void {
  if (!satisfiesRole(context.roles, role)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: `Requires one of: ${role}`,
    });
  }
}
