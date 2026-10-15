import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { holdsAnyRoleOnUnit } from './unit-roles';

/** A broad read grant never extends a specialist write or approval role beyond its unit/site. */
export async function requireUnitRole(
  manager: EntityManager,
  context: RequestContext,
  unitId: string,
  roles: readonly string[],
): Promise<void> {
  if (await hasUnitRole(manager, context, unitId, roles)) return;
  throw new ForbiddenException({
    code: 'FORBIDDEN_ROLE',
    message: `Requires one of these roles on the unit: ${roles.join(', ')}`,
  });
}

/** Same role boundary for optional capabilities whose existing refusal belongs to the domain. */
export async function hasUnitRole(
  manager: EntityManager,
  context: RequestContext,
  unitId: string,
  roles: readonly string[],
): Promise<boolean> {
  const rows = await manager.query<
    Array<{ id: string; siteId: string | null }>
  >(
    `SELECT "id", "site_id" AS "siteId" FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
    [unitId, requireTenantId(context)],
  );
  return Boolean(rows[0] && holdsAnyRoleOnUnit(context, rows[0], roles));
}

/** Batch commands must hold the relevant role on every named unit, without per-unit queries. */
export async function requireUnitsRole(
  manager: EntityManager,
  context: RequestContext,
  unitIds: readonly string[],
  roles: readonly string[],
): Promise<void> {
  const ids = [...new Set(unitIds)];
  const rows = await manager.query<
    Array<{ id: string; siteId: string | null }>
  >(
    `SELECT "id", "site_id" AS "siteId" FROM "units" WHERE "id" = ANY($1::uuid[]) AND "tenant_id" = $2`,
    [ids, requireTenantId(context)],
  );
  if (
    rows.length === ids.length &&
    rows.every((unit) => holdsAnyRoleOnUnit(context, unit, roles))
  )
    return;
  throw new ForbiddenException({
    code: 'FORBIDDEN_ROLE',
    message: `Requires one of these roles on every unit: ${roles.join(', ')}`,
  });
}
