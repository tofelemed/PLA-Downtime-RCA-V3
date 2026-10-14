import { EntityManager } from 'typeorm';
import { OccurrenceSpan } from '../domain/kpi/downtime-measures';
import { FailureSource, FailureSpan } from '../domain/kpi/reliability';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { withRepairEvidence } from './repair-evidence.loader';

/** What the KPI engine reads beyond the accounting inputs: full occurrence extents and failures. */
export interface KpiInputs {
  occurrences: OccurrenceSpan[];
  failures: FailureSpan[];
}

/** Occurrences with a downtime or FailureWO event touching the window (index tenant + unit + start). */
export const TOUCHING_SQL = `SELECT DISTINCT e."occurrence_id" FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."physical_state" IN ('open', 'closed')
   AND (e."physical_type" = 'downtime' OR e."event_type" = 'FailureWO')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')`;

/** Full extent of each stop occurrence over all its events (split children before the window included). */
const OCCURRENCES_SQL = `SELECT e."occurrence_id", min(e."start_time") AS "start_time",
       CASE WHEN bool_or(e."end_time" IS NULL) THEN NULL ELSE max(e."end_time") END AS "end_time"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."occurrence_id" = ANY($2::uuid[]) AND e."physical_type" = 'downtime'
   AND e."physical_state" IN ('open', 'closed') AND e."impact_mode" NOT IN ('none', 'fractional')
 GROUP BY e."occurrence_id" ORDER BY e."occurrence_id"`;

/** D13 failure candidates (`failure_events_v`); the occurrence filter is pushed into the view's grouping. */
const FAILURES_SQL = `SELECT f."occurrence_id", f."asset_id", f."start_time", f."restored_at", f."repair_start",
       f."repair_end", f."source"
  FROM "failure_events_v" f
 WHERE f."tenant_id" = $1 AND f."unit_id" = $2 AND f."occurrence_id" = ANY($3::uuid[])
 ORDER BY f."occurrence_id"`;

interface OccurrenceRow {
  occurrence_id: string;
  start_time: Date;
  end_time: Date | null;
}

interface FailureRow {
  occurrence_id: string;
  asset_id: string | null;
  start_time: Date;
  restored_at: Date | null;
  repair_start: Date | null;
  repair_end: Date | null;
  source: FailureSource;
}

const toDate = (value: Date | null) => (value ? new Date(value) : null);

/**
 * Loads the KPI inputs of a period in the run's transaction (plan 2.7): the stop occurrences touching the
 * window with their full extent (KPI06 counting by occurrence start, mean over completed stops) and the
 * D13 failure candidates (KPI07 / KPI08). Bounded by the unit and window; no tenant-wide scan.
 */
export async function loadKpiInputs(
  manager: EntityManager,
  period: ProductionPeriod,
): Promise<KpiInputs> {
  const touching: Array<{ occurrence_id: string }> = await manager.query(
    TOUCHING_SQL,
    [period.tenantId, period.unitId, period.utcStart, period.utcEnd],
  );
  const ids = touching.map((t) => t.occurrence_id).sort();
  if (ids.length === 0) return { occurrences: [], failures: [] };
  const occurrences: OccurrenceRow[] = await manager.query(OCCURRENCES_SQL, [
    period.tenantId,
    ids,
  ]);
  const failures: FailureRow[] = await manager.query(FAILURES_SQL, [
    period.tenantId,
    period.unitId,
    ids,
  ]);
  return {
    occurrences: occurrences.map((o) => ({
      occurrenceId: o.occurrence_id,
      start: new Date(o.start_time),
      end: toDate(o.end_time),
    })),
    failures: await withRepairEvidence(
      manager,
      period.tenantId,
      failures.map((f) => ({
        occurrenceId: f.occurrence_id,
        assetId: f.asset_id,
        start: new Date(f.start_time),
        end: toDate(f.restored_at),
        source: f.source,
        repairStart: toDate(f.repair_start),
        repairEnd: toDate(f.repair_end),
      })),
    ),
  };
}

/** Hash material of the KPI inputs (they reach beyond the fingerprinted window events). */
export function kpiHashMaterial(inputs: KpiInputs): unknown {
  const time = (d: Date | null) => (d ? d.getTime() : null);
  return {
    occurrences: inputs.occurrences.map((o) => [
      o.occurrenceId,
      time(o.start),
      time(o.end),
    ]),
    failures: inputs.failures.map((f) => [
      f.occurrenceId,
      f.assetId,
      time(f.start),
      time(f.end),
      f.source,
      time(f.repairStart),
      time(f.repairEnd),
      f.activeRepairSeconds ?? null,
    ]),
  };
}
