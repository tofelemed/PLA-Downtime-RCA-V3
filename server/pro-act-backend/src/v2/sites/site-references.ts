import { EntityManager } from 'typeorm';
import { siteNotInPlant } from './site-errors';

/** Name of a unit's site: its own site, or the plant's default site for `null`; null when unknown. */
export type SiteNameOf = (siteId: string | null | undefined) => string | null;

/**
 * One query for the site names of a plant (a plant has a handful of sites), so a page of units resolves its
 * site names without a query per unit.
 */
export async function siteNamesOfPlant(
  manager: EntityManager,
  tenantId: string,
): Promise<SiteNameOf> {
  const rows = await manager.query<
    Array<{ id: string; name: string; is_default: boolean }>
  >(`SELECT "id", "name", "is_default" FROM "sites" WHERE "tenant_id" = $1`, [
    tenantId,
  ]);
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const defaultName = rows.find((row) => row.is_default)?.name ?? null;
  return (siteId) => (siteId ? (names.get(siteId) ?? null) : defaultName);
}

/** 422 `SITE_NOT_IN_PLANT` unless `siteId` is a site of the plant; null / undefined (default site) pass. */
export async function assertSiteOfPlant(
  manager: EntityManager,
  tenantId: string,
  siteId: string | null | undefined,
): Promise<void> {
  if (!siteId) return;
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "sites" WHERE "id" = $1 AND "tenant_id" = $2 LIMIT 1`,
    [siteId, tenantId],
  );
  if (rows.length === 0) throw siteNotInPlant();
}
