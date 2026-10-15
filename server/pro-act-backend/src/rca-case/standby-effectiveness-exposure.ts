import { EntityManager } from 'typeorm';
import { StandbyExposure } from '../domain/kpi/standby-mtbf';

/** Case assets registered as standby at some instant of [from, to) (index tenant + asset, current one unique). */
const STANDBY_ASSETS_SQL = `SELECT DISTINCT "asset_id"::text AS "asset_id" FROM "standby_equipment"
 WHERE "tenant_id" = $1 AND "asset_id" = ANY($2::uuid[]) AND "effective_from" < $4
   AND ("effective_to" IS NULL OR "effective_to" > $3)
 ORDER BY 1`;

/** Their runs touching the window (IDX_standby_records_tenant_asset_start). */
const RUNS_SQL = `SELECT "asset_id"::text AS "asset_id", "started_at", "ended_at" FROM "standby_records"
 WHERE "tenant_id" = $1 AND "asset_id" = ANY($2::uuid[]) AND "record_kind" = 'run'
   AND "started_at" < $4 AND ("ended_at" IS NULL OR "ended_at" > $3)
 ORDER BY "asset_id", "started_at", "id"`;

interface RunRow {
  asset_id: string;
  started_at: Date;
  ended_at: Date | null;
}

/** The case assets that are standby equipment in the window (SME D9 register). */
export async function standbyAssetsOf(
  manager: EntityManager,
  input: {
    tenantId: string;
    assetIds: readonly string[];
    from: Date;
    to: Date;
  },
): Promise<string[]> {
  if (input.assetIds.length === 0) return [];
  const rows: Array<{ asset_id: string }> = await manager.query(
    STANDBY_ASSETS_SQL,
    [input.tenantId, input.assetIds, input.from, input.to],
  );
  return rows.map((row) => row.asset_id);
}

/** Those assets with their own runs from the standby log touching the window. */
export async function standbyRunsOf(
  manager: EntityManager,
  input: {
    tenantId: string;
    assetIds: readonly string[];
    from: Date;
    to: Date;
  },
): Promise<StandbyExposure[]> {
  if (input.assetIds.length === 0) return [];
  const runs: RunRow[] = await manager.query(RUNS_SQL, [
    input.tenantId,
    input.assetIds,
    input.from,
    input.to,
  ]);
  return input.assetIds.map((assetId) => ({
    assetId,
    runs: runs
      .filter((run) => run.asset_id === assetId)
      .map((run) => ({
        start: new Date(run.started_at),
        end: run.ended_at ? new Date(run.ended_at) : null,
      })),
  }));
}
