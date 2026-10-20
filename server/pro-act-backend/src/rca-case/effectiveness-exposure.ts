import { EntityManager } from 'typeorm';
import { ExposureWindow } from '../domain/rca/effectiveness';
import {
  ExposureBasis,
  exposureBasisOf,
  standbyRunningSeconds,
} from '../domain/rca/exposure-basis';
import { failureModeKeySql } from '../domain/rca/failure-mode-key';
import { RepeatMatch } from '../domain/rca/rca-policy';
import { StateExposure, stateExposureOf } from '../domain/rca/state-exposure';
import { StateSegment } from '../domain/reliability/unit-state';
import { Dec, formatDec } from '../domain/actuals/decimal';
import {
  standbyAssetsOf,
  standbyRunsOf,
} from './standby-effectiveness-exposure';
import { unitStateSegments } from './state-exposure.loader';

/** What a case is about for effectiveness: its assets, units and the failure modes of its linked events. */
export interface ModeFootprint {
  assetIds: string[];
  unitIds: string[];
  /** CA8 mode keys of the linked events (`failureModeKey`); empty = every unplanned incident counts */
  modeKeys: string[];
  match: RepeatMatch;
}

/**
 * Version tag of the query below, frozen into each baseline (CA3: freeze the query with the data). v2 adds
 * the standby running-time basis for cases about standby assets (owner, 15 Oct 2026); v3 counts only known
 * running time from the units' state timelines and records the known-data coverage (SME D2, Marun E2E).
 */
export const EXPOSURE_QUERY_VERSION = 'rca-exposure-v3';

export async function caseModeFootprint(
  manager: EntityManager,
  input: { tenantId: string; rcaId: string; match: RepeatMatch },
): Promise<ModeFootprint> {
  const rows: Array<{
    assets: string[] | null;
    units: string[] | null;
    keys: string[] | null;
  }> = await manager.query(
    `SELECT array_agg(DISTINCT e."asset_id"::text) FILTER (WHERE e."asset_id" IS NOT NULL) AS "assets",
              array_agg(DISTINCT e."unit_id"::text) AS "units",
              array_agg(DISTINCT ${failureModeKeySql(input.match)}) FILTER (WHERE ${failureModeKeySql(input.match)} IS NOT NULL) AS "keys"
         FROM "rca_case_links" k JOIN "production_events" e ON e."id"::text = k."target_id" AND e."tenant_id" = $1
        WHERE k."tenant_id" = $1 AND k."rca_id" = $2 AND k."link_type" = 'event'`,
    [input.tenantId, input.rcaId],
  );
  const row = rows[0];
  return {
    assetIds: row?.assets ?? [],
    unitIds: (row?.units ?? []).filter((id): id is string => id !== null),
    modeKeys: (row?.keys ?? []).filter((key) => key !== ''),
    match: input.match,
  };
}

export interface ExposureRequest {
  tenantId: string;
  footprint: ModeFootprint;
  from: Date;
  to: Date;
  /** the basis frozen with the baseline (verification); absent = chosen from the case's assets */
  basis?: ExposureBasis;
}

/**
 * CA2 exposure of a window: same-mode unplanned incidents (stops and failure work orders; planned stops
 * never count) on the case's assets — or units without assets — starting in [from, to), their downtime
 * clipped to the window, and the run seconds. Run seconds of the case's units are the window minus the
 * union of every live downtime interval (planned and unplanned) of those units, so overlapping stops are
 * not taken twice, intersected with the known running time of the units' state timelines (v3: no data,
 * stale or unmapped time is never run time; the coverage is reported); when every case asset is standby
 * equipment, they are the assets' own running time
 * from the standby log instead (CA4: a spare is exposed only while it runs, mostly while the unit is down).
 */
export async function exposureWindow(
  manager: EntityManager,
  input: ExposureRequest,
): Promise<ExposureWindow> {
  const window = await unitExposureWindow(manager, input);
  const scope = {
    tenantId: input.tenantId,
    assetIds: input.footprint.assetIds,
    from: input.from,
    to: input.to,
  };
  const standbyIds = await standbyAssetsOf(manager, scope);
  const basis =
    input.basis ?? exposureBasisOf(input.footprint.assetIds, standbyIds);
  if (basis === 'unit_run_time') return { ...window, exposureBasis: basis };
  const runs = await standbyRunsOf(manager, { ...scope, assetIds: standbyIds });
  const asOf = new Date(Math.min(Date.now(), input.to.getTime()));
  const seconds = standbyRunningSeconds(
    runs,
    { start: input.from, end: input.to },
    asOf,
  );
  return { ...window, exposureSeconds: String(seconds), exposureBasis: basis };
}

const INCIDENTS_CTE = (key: string) => `WITH incidents AS (
  SELECT COALESCE(e."occurrence_id", e."id") AS "occ", e."id", e."occurrence_id", e."unit_id",
         e."physical_type", e."start_time", e."end_time"
    FROM "production_events" e
   WHERE e."tenant_id" = $1 AND e."start_time" >= $2 AND e."start_time" < $3
     AND e."physical_state" IN ('open', 'closed')
     AND (e."event_type" = 'FailureWO' OR (e."physical_type" = 'downtime' AND e."schedule_class" = 'unplanned'))
     AND (CASE WHEN cardinality($4::text[]) > 0 THEN e."asset_id"::text = ANY($4::text[])
               ELSE e."unit_id"::text = ANY($5::text[]) END)
     AND (cardinality($6::text[]) = 0 OR ${key} = ANY($6::text[])))`;

const INCIDENTS_SQL = (key: string) => `${INCIDENTS_CTE(key)}
SELECT (SELECT count(DISTINCT "occ") FROM incidents)::int AS "n",
       (SELECT sum(EXTRACT(EPOCH FROM (LEAST(COALESCE("end_time", $3), $3) - "start_time")))
          FROM incidents WHERE "physical_type" = 'downtime')::text AS "seconds"`;

/** Every live downtime interval (planned and unplanned) of the units touching the window, clipped to it. */
const DOWNTIME_SQL = `SELECT GREATEST(e."start_time", $2) AS "start", LEAST(COALESCE(e."end_time", $3), $3) AS "end"
   FROM "production_events" e
  WHERE e."tenant_id" = $1 AND e."unit_id"::text = ANY($4::text[]) AND e."physical_type" = 'downtime'
    AND e."physical_state" IN ('open', 'closed') AND e."start_time" < $3
    AND (e."end_time" IS NULL OR e."end_time" > $2)`;

async function unitExposureWindow(
  manager: EntityManager,
  input: ExposureRequest,
): Promise<ExposureWindow> {
  const { footprint } = input;
  const base = { from: input.from.toISOString(), to: input.to.toISOString() };
  const window = { start: input.from, end: input.to };
  if (footprint.unitIds.length === 0) {
    return {
      ...base,
      incidents: 0,
      downtimeSeconds: '0',
      ...coverageFields(stateExposureOf([], [], window)),
    };
  }
  const [row]: Array<{ n: number; seconds: string | null }> =
    await manager.query(INCIDENTS_SQL(failureModeKeySql(footprint.match)), [
      input.tenantId,
      input.from,
      input.to,
      footprint.assetIds,
      footprint.unitIds,
      footprint.modeKeys,
    ]);
  const down: Array<{ start: Date; end: Date }> = await manager.query(
    DOWNTIME_SQL,
    [input.tenantId, input.from, input.to, footprint.unitIds],
  );
  const timelines: StateSegment[][] = [];
  const unmappedUnitIds: string[] = [];
  for (const unitId of footprint.unitIds) {
    const timeline = await unitStateSegments(
      manager,
      { tenantId: input.tenantId, unitId },
      window,
    );
    timelines.push(timeline.segments);
    if (!timeline.mapped) unmappedUnitIds.push(unitId);
  }
  const downtime = down.map((d) => ({
    start: new Date(d.start),
    end: new Date(d.end),
  }));
  return {
    ...base,
    incidents: row?.n ?? 0,
    downtimeSeconds: row?.seconds ?? '0',
    ...coverageFields(stateExposureOf(timelines, downtime, window)),
    // owner, 18 Oct 2026: named so the verdict asks for a state mapping, not for more coverage
    ...(unmappedUnitIds.length > 0 ? { unmappedUnitIds } : {}),
  };
}

/** The exposure and the known-data coverage of the window, as stored (decimal strings). */
function coverageFields(
  exposure: StateExposure,
): Pick<
  ExposureWindow,
  'exposureSeconds' | 'knownSeconds' | 'unknownSeconds' | 'coverage'
> {
  return {
    exposureSeconds: String(exposure.runningSeconds),
    knownSeconds: String(exposure.knownSeconds),
    unknownSeconds: String(exposure.unknownSeconds),
    coverage:
      exposure.coverage === null
        ? null
        : formatDec(new Dec(exposure.coverage).toDecimalPlaces(4)),
  };
}

/** The latest same-mode unplanned incident of a window (the event a recurrence-watch recommendation names). */
export interface LatestIncident {
  eventId: string;
  occurrenceId: string | null;
  unitId: string;
}

const LATEST_SQL = (key: string) => `${INCIDENTS_CTE(key)}
SELECT "id"::text AS "eventId", "occurrence_id"::text AS "occurrenceId", "unit_id"::text AS "unitId"
  FROM incidents ORDER BY "start_time" DESC, "id" DESC LIMIT 1`;

export async function latestIncident(
  manager: EntityManager,
  input: ExposureRequest,
): Promise<LatestIncident | null> {
  const { footprint } = input;
  if (footprint.unitIds.length === 0) return null;
  const rows: LatestIncident[] = await manager.query(
    LATEST_SQL(failureModeKeySql(footprint.match)),
    [
      input.tenantId,
      input.from,
      input.to,
      footprint.assetIds,
      footprint.unitIds,
      footprint.modeKeys,
    ],
  );
  return rows[0] ?? null;
}
