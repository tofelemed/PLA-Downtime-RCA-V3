import { EntityManager } from 'typeorm';

/** Active-unit count per site of a plant, and whether the plant has its default site yet. */
export interface SiteCensus {
  unitCounts: Map<string, number>;
  hasDefault: boolean;
}

/**
 * One statement for every site of the plant (a plant has a handful): its active units, counted in a single
 * pass over the plant's units — units without a site belong to the default site. No query per site.
 */
export async function siteCensus(
  manager: EntityManager,
  tenantId: string,
): Promise<SiteCensus> {
  const rows = await manager.query<
    Array<{ id: string; is_default: boolean; count: number }>
  >(
    `SELECT s."id", s."is_default", COALESCE(c."count", 0)::int AS "count"
       FROM "sites" s
       LEFT JOIN (
         SELECT COALESCE(u."site_id",
                  (SELECT d."id" FROM "sites" d WHERE d."tenant_id" = $1 AND d."is_default")) AS "site_id",
                count(*) AS "count"
           FROM "units" u
          WHERE u."tenant_id" = $1 AND u."retired_at" IS NULL
          GROUP BY 1
       ) c ON c."site_id" = s."id"
      WHERE s."tenant_id" = $1`,
    [tenantId],
  );
  return {
    unitCounts: new Map(rows.map((row) => [row.id, row.count])),
    hasDefault: rows.some((row) => row.is_default),
  };
}
