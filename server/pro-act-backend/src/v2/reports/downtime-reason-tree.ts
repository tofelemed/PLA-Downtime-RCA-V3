import { EntityManager } from 'typeorm';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import { DowntimeGroup } from './kpi-reports-v2.dto';
import { ReportScope } from './report-scope';

/** Cell key of a breakdown row and the reason-tree join used by every reason grouping. */
export const CELL_KEY = `k."scope"->>'key'`;
export const REASON_TREE = `LEFT JOIN "reason_codes" rc ON rc."id"::text = k."scope"->>'key' AND rc."tenant_id" = $1`;

const REASON_GROUPS: ReadonlySet<DowntimeGroup> = new Set<DowntimeGroup>([
  'reason',
  'reasonLevel1',
  'reasonChild',
]);

/** The parent of a reason drill-down: its materialised path (ids joined by '/') and level (root = 0). */
export interface ReasonParent {
  path: string;
  level: number;
}

/** SQL parts a reason subtree adds to a breakdown query (parameters from $10 on). */
export interface SubtreeSql {
  groupSql?: string;
  where: string;
  extraParams: unknown[];
}

const IN_SUBTREE = `(rc."path" = $10::text OR rc."path" LIKE $10::text || '/%')`;

/**
 * Validates the reason drill-down of `GET /reports/downtime` (plan 3.3): `reasonChild` needs a parent,
 * a parent applies to the reason groupings only, and it must be a reason code of the tenant (422
 * INVALID_REFERENCE, no existence leak). Returns null without a parent.
 */
export async function resolveReasonParent(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: DowntimeGroup,
  parentReasonId: string | undefined,
): Promise<ReasonParent | null> {
  if (groupBy === 'reasonChild' && !parentReasonId) {
    throw invalid(
      'PARENT_REASON_REQUIRED',
      'groupBy=reasonChild needs parentReasonId',
    );
  }
  if (!parentReasonId) return null;
  if (!REASON_GROUPS.has(groupBy)) {
    throw invalid(
      'PARENT_REASON_NOT_APPLICABLE',
      'parentReasonId applies to groupBy reason, reasonLevel1 or reasonChild only',
    );
  }
  const rows: Array<{ path: string | null; level: number }> =
    await manager.query(
      `SELECT "path", "level" FROM "reason_codes" WHERE "id" = $1 AND "tenant_id" = $2`,
      [parentReasonId, scope.tenantId],
    );
  if (!rows[0]) throw invalidReference('parentReasonId', 'reason code');
  return { path: rows[0].path ?? parentReasonId, level: rows[0].level };
}

/**
 * Subtree restriction of a reason grouping. `reasonChild` groups by the path segment one level below
 * the parent; a cell coded with the parent itself keeps the parent's id (coded at that level).
 */
export function subtreeSql(
  groupBy: DowntimeGroup,
  parent: ReasonParent,
): SubtreeSql {
  if (groupBy !== 'reasonChild') {
    return { where: IN_SUBTREE, extraParams: [parent.path] };
  }
  return {
    groupSql: `COALESCE(NULLIF(split_part(rc."path", '/', $11::int), ''), ${CELL_KEY})`,
    where: IN_SUBTREE,
    extraParams: [parent.path, parent.level + 2],
  };
}
