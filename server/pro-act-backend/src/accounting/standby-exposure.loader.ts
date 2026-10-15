import { EntityManager } from 'typeorm';
import { StandbyExposure } from '../domain/kpi/standby-mtbf';
import { ProductionPeriod } from '../periods/entities/production-period.entity';

/** Assets of the unit registered as standby at some instant of the window (index unit). */
const STANDBY_ASSETS_SQL = `SELECT DISTINCT "asset_id" FROM "standby_equipment"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "effective_from" < $4
   AND ("effective_to" IS NULL OR "effective_to" > $3)
 ORDER BY "asset_id"`;

/** Their runs touching the window (index tenant + asset + start). */
const RUNS_SQL = `SELECT "asset_id", "started_at", "ended_at" FROM "standby_records"
 WHERE "tenant_id" = $1 AND "asset_id" = ANY($2::uuid[]) AND "record_kind" = 'run'
   AND "started_at" < $4 AND ("ended_at" IS NULL OR "ended_at" > $3)
 ORDER BY "asset_id", "started_at", "id"`;

interface RunRow {
  asset_id: string;
  started_at: Date;
  ended_at: Date | null;
}

/**
 * SME D9 / DT-10: the unit's standby assets over the period with their own runs from the standby log,
 * so the KPI engine judges their MTBF on their running time. Bounded by the unit and window.
 */
export async function loadStandbyExposure(
  manager: EntityManager,
  period: ProductionPeriod,
): Promise<StandbyExposure[]> {
  const window = [period.utcStart, period.utcEnd];
  const assets: Array<{ asset_id: string }> = await manager.query(
    STANDBY_ASSETS_SQL,
    [period.tenantId, period.unitId, ...window],
  );
  if (assets.length === 0) return [];
  const ids = assets.map((a) => a.asset_id);
  const runs: RunRow[] = await manager.query(RUNS_SQL, [
    period.tenantId,
    ids,
    ...window,
  ]);
  return ids.map((assetId) => ({
    assetId,
    runs: runs
      .filter((r) => r.asset_id === assetId)
      .map((r) => ({
        start: new Date(r.started_at),
        end: r.ended_at ? new Date(r.ended_at) : null,
      })),
  }));
}
