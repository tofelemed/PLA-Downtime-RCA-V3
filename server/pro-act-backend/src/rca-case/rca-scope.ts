import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { RCA } from '../rca/rca.entity';

/** Roles that open, edit and link RCA cases and their actions (spec §13.2, plan 3.9). */
export const RCA_WRITERS = [
  'reliability_engineer',
  'manager_approver',
] as const;

export function notFound(what: string): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `${what} not found`,
  });
}

/** 422 INVALID_REFERENCE for a body id that is not of the caller's tenant / scope (no existence leak). */
export function invalidReference(field: string): UnprocessableEntityException {
  const message = `${field} does not refer to a record of this tenant or of your units`;
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

export function invalidBody(code: string, field: string, message: string) {
  return new UnprocessableEntityException({
    code,
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

/** The caller's tenant and, for a unit-limited grant, its units (null = whole tenant). */
export interface RcaScope {
  tenantId: string;
  units: string[] | null;
  userId: string | null;
}

export function scopeOf(context: RequestContext): RcaScope {
  const tenantId = requireTenantId(context);
  return {
    tenantId,
    units: restrictedUnitIds(context, tenantId),
    userId: context.userId ?? null,
  };
}

export const inScope = (scope: RcaScope, unitId: string | null) =>
  scope.units === null || (unitId !== null && scope.units.includes(unitId));

/**
 * The unit a case may be written for: a unit of the tenant inside the caller's units (422 otherwise);
 * a tenant-wide case (no unit) needs a tenant-wide grant (403 TENANT_SCOPE_REQUIRED).
 */
export async function assertCaseUnit(
  manager: EntityManager,
  scope: RcaScope,
  unitId: string | null | undefined,
): Promise<void> {
  if (!unitId) {
    if (scope.units === null) return;
    throw new ForbiddenException({
      code: 'TENANT_SCOPE_REQUIRED',
      message:
        'a case without a unit is tenant-wide; a tenant-wide grant is required (or name a unit)',
    });
  }
  const rows: unknown[] = await manager.query(
    `SELECT 1 FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
    [unitId, scope.tenantId],
  );
  if (rows.length === 0 || !inScope(scope, unitId))
    throw invalidReference('unitId');
}

/** A case of the caller's tenant and units, locked when `lock`; 404 for anything else. */
export async function findCase(
  manager: EntityManager,
  scope: RcaScope,
  id: string,
  lock = false,
): Promise<RCA> {
  const qb = manager
    .getRepository(RCA)
    .createQueryBuilder('rca')
    .where('rca.tenantId = :tenantId AND rca.id = :id', {
      tenantId: scope.tenantId,
      id,
    });
  if (scope.units) {
    qb.andWhere('rca.unitId IN (:...units)', {
      units: scope.units.length ? scope.units : [NO_MATCH],
    });
  }
  if (lock) qb.setLock('pessimistic_write');
  const found = await qb.getOne();
  if (!found) throw notFound('RCA case');
  return found;
}

const NO_MATCH = '00000000-0000-0000-0000-000000000000';
