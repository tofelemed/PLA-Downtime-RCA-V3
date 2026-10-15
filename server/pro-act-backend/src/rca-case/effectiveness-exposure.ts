import { EntityManager } from 'typeorm';
import { ExposureWindow } from '../domain/rca/effectiveness';
import {
  ExposureBasis,
  exposureBasisOf,
  standbyRunningSeconds,
} from '../domain/rca/exposure-basis';
import { failureModeKeySql } from '../domain/rca/failure-mode-key';
import { RepeatMatch } from '../domain/rca/rca-policy';
import {
  standbyAssetsOf,
  standbyRunsOf,
} from './standby-effectiveness-exposure';

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
 * the standby running-time basis for cases about standby assets (owner, 15 Oct 2026).
 */
export const EXPOSURE_QUERY_VERSION = 'rca-exposure-v2';

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
 * not taken twice; when every case asset is standby equipment, they are the assets' own running time
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

async function unitExposureWindow(
  manager: EntityManager,
  input: ExposureRequest,
): Promise<ExposureWindow> {
  const { footprint } = input;
  const base = { from: input.from.toISOString(), to: input.to.toISOString() };
  if (footprint.unitIds.length === 0) {
    return {
      ...base,
      incidents: 0,
      downtimeSeconds: '0',
      exposureSeconds: '0',
    };
  }
  const key = failureModeKeySql(footprint.match);
  const [row]: Array<{ n: number; seconds: string | null; exposure: string }> =
    await manager.query(
      `WITH incidents AS (
       SELECT COALESCE(e."occurrence_id", e."id") AS "occ", e."physical_type", e."start_time", e."end_time"
         FROM "production_events" e
        WHERE e."tenant_id" = $1 AND e."start_time" >= $2 AND e."start_time" < $3
          AND e."physical_state" IN ('open', 'closed')
          AND (e."event_type" = 'FailureWO' OR (e."physical_type" = 'downtime' AND e."schedule_class" = 'unplanned'))
          AND (CASE WHEN cardinality($4::text[]) > 0 THEN e."asset_id"::text = ANY($4::text[])
                    ELSE e."unit_id"::text = ANY($5::text[]) END)
          AND (cardinality($6::text[]) = 0 OR ${key} = ANY($6::text[]))),
     down AS (
       SELECT range_agg(tstzrange(GREATEST(e."start_time", $2), LEAST(COALESCE(e."end_time", $3), $3), '[)')) AS "spans"
         FROM "production_events" e
        WHERE e."tenant_id" = $1 AND e."unit_id"::text = ANY($5::text[]) AND e."physical_type" = 'downtime'
          AND e."physical_state" IN ('open', 'closed') AND e."start_time" < $3
          AND (e."end_time" IS NULL OR e."end_time" > $2))
     SELECT (SELECT count(DISTINCT "occ") FROM incidents)::int AS "n",
            (SELECT sum(EXTRACT(EPOCH FROM (LEAST(COALESCE("end_time", $3), $3) - "start_time")))
               FROM incidents WHERE "physical_type" = 'downtime')::text AS "seconds",
            (EXTRACT(EPOCH FROM ($3::timestamptz - $2::timestamptz))
               - COALESCE((SELECT sum(EXTRACT(EPOCH FROM (upper(r) - lower(r))))
                             FROM down, unnest(down."spans") r), 0))::text AS "exposure"`,
      [
        input.tenantId,
        input.from,
        input.to,
        footprint.assetIds,
        footprint.unitIds,
        footprint.modeKeys,
      ],
    );
  return {
    ...base,
    incidents: row?.n ?? 0,
    downtimeSeconds: row?.seconds ?? '0',
    exposureSeconds: row?.exposure ?? '0',
  };
}
