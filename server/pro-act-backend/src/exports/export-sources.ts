import { EntityManager } from 'typeorm';
import { invalid, invalidReference } from '../profiles/profile-errors';

/** Window and units of a `published` export. */
export interface PublishedWindow {
  from: Date;
  to: Date;
  unitIds: string[] | null;
}

/**
 * Columns written for each pinned source: render position (unit, period start, period), the unit name and
 * the slice → product labels as they are now, the revision and its approval snapshot.
 */
const PIN_SELECT = `
  SELECT $1::uuid, $2::uuid, row_number() OVER (ORDER BY src.unit_id, src.utc_start, src.period_id),
         src.period_id, src.unit_id, u."name", src.revision_id, src.snapshot_id,
         COALESCE((SELECT jsonb_object_agg(sl."id", jsonb_build_object('productId', sl."product_id", 'productName', pr."name"))
                     FROM "period_product_slices" sl LEFT JOIN "products" pr ON pr."id" = sl."product_id"
                    WHERE sl."period_id" = src.period_id), '{}'::jsonb)
    FROM %SOURCE% src LEFT JOIN "units" u ON u."id" = src.unit_id`;

const PIN_INSERT = `INSERT INTO "export_job_sources" ("tenant_id", "export_job_id", "position", "period_id", "unit_id",
  "unit_name", "revision_id", "snapshot_id", "slice_products")`;

/** The latest approved revision of every period of the tenant overlapping the window (in the units). */
const PUBLISHED = `(
  SELECT DISTINCT ON (r."period_id") r."period_id" AS period_id, p."unit_id" AS unit_id, p."utc_start" AS utc_start,
         r."id" AS revision_id, r."approval_snapshot_id" AS snapshot_id
    FROM "accounting_revisions" r JOIN "production_periods" p ON p."id" = r."period_id"
   WHERE r."tenant_id" = $1 AND p."tenant_id" = $1 AND r."lifecycle" = 'approved' AND r."approval_snapshot_id" IS NOT NULL
     AND p."utc_start" < $4 AND p."utc_end" > $3 AND ($5::uuid[] IS NULL OR p."unit_id" = ANY($5::uuid[]))
   ORDER BY r."period_id", r."revision" DESC)`;

const NAMED = `(
  SELECT r."period_id" AS period_id, p."unit_id" AS unit_id, p."utc_start" AS utc_start,
         r."id" AS revision_id, r."approval_snapshot_id" AS snapshot_id
    FROM "accounting_revisions" r JOIN "production_periods" p ON p."id" = r."period_id"
   WHERE r."tenant_id" = $1 AND r."lifecycle" = 'approved' AND r."approval_snapshot_id" IS NOT NULL
     AND r."id" = ANY($3::uuid[]))`;

/**
 * Pins the published revision of every period in the window (set-based, one statement: the tenant's
 * revisions are never loaded into memory). Returns the number of sources.
 */
export async function pinPublished(
  manager: EntityManager,
  ids: { tenantId: string; jobId: string },
  window: PublishedWindow,
): Promise<number> {
  const rows: unknown[] = await manager.query(
    `${PIN_INSERT} ${PIN_SELECT.replace('%SOURCE%', PUBLISHED)} RETURNING 1`,
    [ids.tenantId, ids.jobId, window.from, window.to, window.unitIds],
  );
  return rows.length;
}

export async function pinNamed(
  manager: EntityManager,
  ids: { tenantId: string; jobId: string },
  revisionIds: readonly string[],
): Promise<number> {
  const rows: unknown[] = await manager.query(
    `${PIN_INSERT} ${PIN_SELECT.replace('%SOURCE%', NAMED)} RETURNING 1`,
    [ids.tenantId, ids.jobId, revisionIds],
  );
  return rows.length;
}

/**
 * Units of named revisions after checking them: every id must be a revision of the tenant (422
 * INVALID_REFERENCE otherwise, no existence leak), approved (422 REVISION_NOT_APPROVED: exports carry
 * approved content only) and, for a unit-limited caller, of a unit in its scope (422 INVALID_REFERENCE).
 */
export async function namedRevisionUnits(
  manager: EntityManager,
  tenantId: string,
  revisionIds: readonly string[],
  allowedUnits: readonly string[] | null,
): Promise<string[]> {
  const rows: Array<{ id: string; approved: boolean; unit_id: string }> =
    await manager.query(
      `SELECT r."id", (r."lifecycle" = 'approved' AND r."approval_snapshot_id" IS NOT NULL) AS approved, p."unit_id"
       FROM "accounting_revisions" r
       JOIN "production_periods" p ON p."id" = r."period_id"
      WHERE r."id" = ANY($1::uuid[]) AND r."tenant_id" = $2`,
      [revisionIds, tenantId],
    );
  const inScope = rows.filter(
    (r) => !allowedUnits || allowedUnits.includes(r.unit_id),
  );
  if (inScope.length !== revisionIds.length) {
    throw invalidReference('revisionIds', 'revision');
  }
  if (inScope.some((r) => !r.approved)) {
    throw invalid(
      'REVISION_NOT_APPROVED',
      'exports contain approved revisions only; revisionIds names a revision that is not approved',
    );
  }
  return [...new Set(inScope.map((r) => r.unit_id))].sort();
}
