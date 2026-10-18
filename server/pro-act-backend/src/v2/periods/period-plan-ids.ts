import { EntityManager } from 'typeorm';

/**
 * Plan of each period's selected plan version (plan version id → plan id), one tenant-guarded query for a
 * whole page (no N+1); served by the `plan_versions` primary key.
 */
export async function planIdsOfVersions(
  manager: EntityManager,
  tenantId: string,
  periods: ReadonlyArray<{ selectedPlanVersionId: string | null }>,
): Promise<Map<string, string>> {
  const versionIds = [
    ...new Set(
      periods.flatMap((p) =>
        p.selectedPlanVersionId ? [p.selectedPlanVersionId] : [],
      ),
    ),
  ];
  if (versionIds.length === 0) return new Map();
  const rows: Array<{ id: string; planId: string }> = await manager.query(
    `SELECT "id"::text AS "id", "plan_id"::text AS "planId" FROM "plan_versions"
      WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
    [tenantId, versionIds],
  );
  return new Map(rows.map((row) => [row.id, row.planId]));
}

/** The plan of one period, null without a selected plan version. */
export function planIdOf(
  period: { selectedPlanVersionId: string | null },
  plans: ReadonlyMap<string, string>,
): string | null {
  const version = period.selectedPlanVersionId;
  return version ? (plans.get(version) ?? null) : null;
}
