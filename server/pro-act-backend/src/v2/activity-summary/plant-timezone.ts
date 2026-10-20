import { EntityManager } from 'typeorm';

/** The plant's timezone candidates in order: the default site's, then the plant's own. */
const CANDIDATES_SQL = `SELECT (SELECT s."timezone" FROM "sites" s WHERE s."tenant_id" = $1 AND s."is_default" LIMIT 1) AS "site",
       (SELECT t."timezone" FROM "tenants" t WHERE t."id" = $1 LIMIT 1) AS "tenant"`;

/**
 * Whether Postgres knows a zone name, asked once per name and process: `pg_timezone_names` is built by
 * scanning the zone files (~45 ms per query, perf audit P05), and its contents only change with a server
 * upgrade, which restarts the application too.
 */
const knownZones = new Map<string, Promise<boolean>>();

function postgresKnowsZone(
  manager: EntityManager,
  zone: string,
): Promise<boolean> {
  let known = knownZones.get(zone);
  if (!known) {
    known = manager
      .query<
        Array<{ known: boolean }>
      >('SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE "name" = $1) AS "known"', [zone])
      .then((rows) => rows[0]?.known === true);
    // a failed lookup is retried on the next call instead of being remembered
    known.catch(() => knownZones.delete(zone));
    knownZones.set(zone, known);
  }
  return known;
}

/**
 * Plant timezone for plant-local days: the default site's, else the plant's, else UTC — only zones Postgres
 * knows, since callers pass it to `AT TIME ZONE`.
 */
export async function plantTimezone(
  manager: EntityManager,
  tenantId: string,
): Promise<string> {
  const [row] = await manager.query<
    Array<{ site: string | null; tenant: string | null }>
  >(CANDIDATES_SQL, [tenantId]);
  for (const zone of [row?.site, row?.tenant]) {
    if (zone && (await postgresKnowsZone(manager, zone))) return zone;
  }
  return 'UTC';
}
