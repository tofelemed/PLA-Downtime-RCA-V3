import { EntityManager } from 'typeorm';
import { isOrgAdminOf } from '../../auth/roles/org-access';
import { RoleName } from '../../auth/roles/role-model';
import {
  RequestContext,
  tenantRequired,
} from '../../common/context/request-context';
import { siteWriteNotAllowed } from './site-errors';

/** Who creates and renames sites (`@Roles`); an organization administrator only in its organization's plants. */
export const SITE_WRITERS: readonly RoleName[] = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
];

/** What site writes need of the acting plant. */
export interface SitePlant {
  organizationId: string;
  timezone: string | null;
}

/**
 * The acting plant, after checking the caller may change its sites: a super administrator, a plant
 * administrator acting in it, or the administrator of the plant's organization (403 ORGANIZATION_NOT_ALLOWED).
 */
export async function assertSiteWriter(
  manager: EntityManager,
  context: RequestContext,
  tenantId: string,
): Promise<SitePlant> {
  const rows = await manager.query<
    Array<{ organization_id: string; timezone: string | null }>
  >(`SELECT "organization_id", "timezone" FROM "tenants" WHERE "id" = $1`, [
    tenantId,
  ]);
  const plant = rows[0];
  if (!plant) throw tenantRequired();
  const allowed =
    context.isSuperAdmin ||
    context.roles.includes('TenantAdmin') ||
    isOrgAdminOf(context, plant.organization_id);
  if (!allowed) throw siteWriteNotAllowed();
  return { organizationId: plant.organization_id, timezone: plant.timezone };
}
