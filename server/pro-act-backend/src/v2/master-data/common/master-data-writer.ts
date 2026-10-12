import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
  tenantRequired,
} from '../../../common/context/request-context';
import { assertTenantWideWriter } from '../../../profiles/profile-scope';

/** Writers of master data (engineering default, DECISIONS.md §D 2026-10-08; same set as the code libraries). */
export const MASTER_DATA_WRITERS = [
  'master_data_admin',
  'manager_approver',
] as const;

export interface WriterStamp {
  tenantId: string;
  actorId: string | null;
}

/**
 * The acting tenant of a master-data write. Master data is tenant-wide (a unit or product is seen by every
 * unit of the plant), so a caller whose grants stop at some units gets 403 TENANT_SCOPE_REQUIRED.
 */
export function writerStamp(context: RequestContext): WriterStamp {
  const tenantId = requireTenantId(context);
  assertTenantWideWriter(context, tenantId);
  return { tenantId, actorId: context.userId };
}

/** Organisation of a tenant (plant): products and RCA templates name it. */
export async function organizationOfTenant(
  manager: EntityManager,
  tenantId: string,
): Promise<string> {
  const rows = await manager.query<Array<{ organization_id: string }>>(
    `SELECT "organization_id" FROM "tenants" WHERE "id" = $1`,
    [tenantId],
  );
  const organizationId = rows[0]?.organization_id;
  if (!organizationId) throw tenantRequired();
  return organizationId;
}

/** `true` for the `status` values that include active / retired rows. */
export function statusIncludes(
  status: 'active' | 'retired' | 'all' | undefined,
): { active: boolean; retired: boolean } {
  const value = status ?? 'all';
  return { active: value !== 'retired', retired: value !== 'active' };
}
