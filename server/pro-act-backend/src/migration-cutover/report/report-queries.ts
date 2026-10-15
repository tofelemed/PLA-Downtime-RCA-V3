import { EntityManager } from 'typeorm';
import { Row } from './markdown';

/** v1 tables the cutover must never lose rows from (MIG05 "never roll back by deleting source records"). */
export const LEGACY_TABLES: readonly string[] = [
  'production_events',
  'production_losses',
  'reconcile_forms',
  'loss_categories',
  'oee_summaries',
  'production_plans',
  'products',
  'units',
  'reason_codes',
  'impact_codes',
  'oee_codes',
  'source_hierarchy_mappings',
  'af_bindings',
  'pi_connections',
  'pi_sync_jobs',
  'pi_sync_watermarks',
  'pi_events',
  'unmapped_events',
  'rca_trigger_configs',
  'rcas',
  'app_settings',
];

export const V2_TABLES: readonly string[] = [
  'event_revisions',
  'event_coding',
  'code_versions',
  'source_mappings',
  'integration_connections',
  'ingestion_exceptions',
  'plan_versions',
  'production_periods',
  'loss_lines',
  'calculation_runs',
  'accounting_revisions',
  'feature_flags',
  'migration_reports',
  'migration_review',
  'legacy_id_crosswalk',
  'legacy_reported_values',
  'migration_explanations',
  'legacy_write_freezes',
];

/** Row counts per table (null = table absent on this database). */
export async function tableCounts(
  manager: EntityManager,
  tables: readonly string[],
): Promise<Record<string, number | null>> {
  const counts: Record<string, number | null> = {};
  for (const table of tables) {
    const [{ present }]: Array<{ present: boolean }> = await manager.query(
      `SELECT to_regclass($1) IS NOT NULL AS "present"`,
      [`public.${table}`],
    );
    if (!present) {
      counts[table] = null;
      continue;
    }
    const [{ n }]: Array<{ n: number }> = await manager.query(
      `SELECT count(*)::int AS "n" FROM "${table}"`,
    );
    counts[table] = n;
  }
  return counts;
}

export async function tenantOverview(manager: EntityManager): Promise<Row[]> {
  return manager.query(
    `SELECT t."id" AS "tenant", t."name",
            (SELECT count(*)::int FROM "units" u WHERE u."tenant_id" = t."id") AS "units",
            (SELECT count(*)::int FROM "production_events" e WHERE e."tenant_id" = t."id") AS "events",
            (SELECT count(*)::int FROM "production_plans" p WHERE p."tenant_id" = t."id") AS "plans",
            (SELECT string_agg(f."key", ', ' ORDER BY f."key") FROM "feature_flags" f
              WHERE f."tenant_id" = t."id" AND f."enabled") AS "flags on",
            CASE WHEN to_regclass('public.legacy_write_freezes') IS NULL THEN 'n/a' ELSE
              (SELECT CASE WHEN count(*) > 0 THEN 'FROZEN' ELSE 'no' END FROM "legacy_write_freezes" z
                WHERE z."tenant_id" = t."id" AND z."released_at" IS NULL) END AS "v1 write freeze"
       FROM "tenants" t ORDER BY t."name"`,
  );
}

/** A5 pilot: plant HDPE, units unit100–unit500 — present on this database? */
export async function pilotScope(manager: EntityManager): Promise<Row[]> {
  return manager.query(
    `SELECT want."code" AS "pilot unit", u."id" AS "unit id", t."name" AS "tenant"
       FROM unnest(ARRAY['unit100','unit200','unit300','unit400','unit500']) AS want("code")
       LEFT JOIN "units" u ON lower(u."code") = want."code" OR lower(u."name") = want."code"
       LEFT JOIN "tenants" t ON t."id" = u."tenant_id"
      ORDER BY 1, 3`,
  );
}

/** Follow-ups of earlier sub-phases the cutover depends on (1.1, 1.2, 1.3, 1.5, 2.3, 2.4/2.5, 3.1). */
export const CARRIED_CHECKS: ReadonlyArray<[title: string, sql: string]> = [
  [
    '1.1 event backfill (re-run `scripts/report-event-backfill.ts` on the data host for the full report)',
    `SELECT count(*)::int AS "events",
            count(*) FILTER (WHERE "legacy_end_sentinel" IS NOT NULL)::int AS "sentinels converted",
            count(*) FILTER (WHERE "end_time" >= '9999-01-01')::int AS "sentinels remaining",
            count(*) FILTER (WHERE "legacy_duration" IS NOT NULL AND "legacy_duration_unit_assumed" IS NULL)::int AS "durations unit unknown",
            count(*) FILTER (WHERE "tenant_id" IS NULL)::int AS "without tenant"
       FROM "production_events"`,
  ],
  [
    '1.2 revisions (events without any revision row = never touched since 1.2; baseline written on first change)',
    `SELECT count(*)::int AS "events",
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "event_revisions" r WHERE r."event_id" = e."id"))::int AS "without revision",
            count(*) FILTER (WHERE e."current_source_revision" = 0)::int AS "no source revision"
       FROM "production_events" e`,
  ],
  [
    '1.3 code libraries (v1 create / edit does not write code_versions; tenant-less codes unusable)',
    `SELECT l."library", l."codes", l."without tenant",
            l."codes" - (SELECT count(DISTINCT v."code_id")::int FROM "code_versions" v WHERE v."library"::text = l."library") AS "without version baseline"
       FROM (SELECT 'reason' AS "library", count(*)::int AS "codes", count(*) FILTER (WHERE "tenant_id" IS NULL)::int AS "without tenant" FROM "reason_codes"
             UNION ALL SELECT 'impact', count(*)::int, count(*) FILTER (WHERE "tenant_id" IS NULL)::int FROM "impact_codes"
             UNION ALL SELECT 'oee', count(*)::int, count(*) FILTER (WHERE "tenant_id" IS NULL)::int FROM "oee_codes") l`,
  ],
  [
    '1.5 v1 PI connections mirrored into integration_connections',
    `SELECT count(*)::int AS "pi_connections",
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "integration_connections" ic WHERE ic."id" = pc."id"))::int AS "mirrored",
            count(*) FILTER (WHERE pc."tenant_id" IS NULL)::int AS "without tenant"
       FROM "pi_connections" pc`,
  ],
  [
    '2.3 v1 plans bridged to plan versions',
    `SELECT count(*)::int AS "plans",
            count(*) FILTER (WHERE p."scenario_id" IS NULL)::int AS "no scenario",
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "plan_versions" v WHERE v."plan_id" = p."id"))::int AS "no plan version",
            count(*) FILTER (WHERE p."unit_ref_id" IS NULL)::int AS "no unit reference"
       FROM "production_plans" p`,
  ],
  [
    '2.4 / 2.5 / 2.7 compatibility views (v1 readers)',
    `SELECT (SELECT count(*)::int FROM "production_losses_v") AS "production_losses_v",
            (SELECT count(*)::int FROM "loss_categories_v") AS "loss_categories_v",
            (SELECT count(*)::int FROM "oee_summaries_v") AS "oee_summaries_v"`,
  ],
  [
    '3.1 app_settings (global table, no tenant column — the fix is 3.11)',
    `SELECT split_part("key", '.', 1) AS "key prefix", count(*)::int AS "keys"
       FROM "app_settings" GROUP BY 1 ORDER BY 1`,
  ],
  [
    'D08 valuation policies (approval is the owner’s finance decision)',
    `SELECT t."name" AS "tenant", p."version", coalesce(p."body"->>'currency', array_to_string(
              ARRAY(SELECT jsonb_array_elements_text(p."body"->'reportingCurrencies')), ' + ')) AS "currency",
            CASE WHEN p."approved_at" IS NULL THEN 'not approved' ELSE 'approved ' || to_char(p."approved_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC by ' || coalesce(u."email", '?') END AS "state"
       FROM "accounting_policies" p JOIN "tenants" t ON t."id" = p."tenant_id"
       LEFT JOIN "users" u ON u."id" = p."approved_by"
      WHERE p."policy_kind" = 'valuation_basis' ORDER BY 1, 2`,
  ],
];
