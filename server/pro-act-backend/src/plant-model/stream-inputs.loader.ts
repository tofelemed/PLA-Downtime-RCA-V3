import { EntityManager } from 'typeorm';
import { StreamRun } from '../domain/accounting/accounting.types';
import { OutputStreamRun } from '../domain/actuals/period/output-attribution';

/**
 * $1 tenant, $2 unit, $3 window start, $4 window end: stream runs of the unit cut at the approved stream
 * versions in force over them (the share is constant per piece); run time without an approved version
 * carries no capacity.
 */
const RUN_PIECES_SQL = `SELECT r."id", r."stream_code", r."product_id", r."lot_code", s."id" AS "stream_version_id",
       s."capacity_share"::text AS "share", lower(x."span") AS "start_time", upper(x."span") AS "end_time"
  FROM "stream_runs" r
  JOIN "unit_streams" s ON s."tenant_id" = r."tenant_id" AND s."unit_id" = r."unit_id"
   AND s."code" = r."stream_code" AND s."state" = 'approved'
  CROSS JOIN LATERAL (SELECT tstzrange(r."start_time", r."end_time", '[)')
                           * tstzrange(s."effective_from", s."effective_to", '[)') AS "span") x
 WHERE r."tenant_id" = $1 AND r."unit_id" = $2 AND NOT isempty(x."span")
   AND x."span" && tstzrange($3, $4, '[)')
 ORDER BY 7, r."stream_code", r."id"`;

interface PieceRow {
  id: string;
  stream_code: string;
  product_id: string;
  lot_code: string | null;
  stream_version_id: string;
  share: string;
  start_time: Date;
  end_time: Date | null;
}

export interface LoadedStreamRuns {
  runs: StreamRun[];
  /** run and stream-version ids the pieces came from (run fingerprint) */
  ids: string[];
}

interface Window {
  tenantId: string;
  unitId: string;
  from: Date;
  to: Date;
}

/** SME E6: the unit's stream runs over a window, for the accounting engine. Empty = no streams. */
export async function loadStreamRuns(
  manager: EntityManager,
  window: Window,
): Promise<LoadedStreamRuns> {
  const rows: PieceRow[] = await manager.query(RUN_PIECES_SQL, [
    window.tenantId,
    window.unitId,
    window.from,
    window.to,
  ]);
  return {
    runs: rows.map((row) => ({
      streamId: row.stream_code,
      productId: row.product_id,
      share: row.share,
      start: new Date(row.start_time),
      end: row.end_time ? new Date(row.end_time) : null,
    })),
    ids: [...new Set(rows.flatMap((r) => [r.id, r.stream_version_id]))].sort(),
  };
}

/** $1 tenant, $2 unit, $3 lot codes: the runs that made these lots (any time). */
const LOT_RUNS_SQL = `SELECT "id", "stream_code", "product_id", "lot_code", "start_time", "end_time"
  FROM "stream_runs" WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "lot_code" = ANY($3::text[])`;

/** $1 tenant, $2 unit, $3 window start, $4 window end: runs overlapping the window. */
const WINDOW_RUNS_SQL = `SELECT "id", "stream_code", "product_id", "lot_code", "start_time", "end_time"
  FROM "stream_runs" WHERE "tenant_id" = $1 AND "unit_id" = $2
   AND tstzrange("start_time", "end_time", '[)') && tstzrange($3, $4, '[)')`;

type RunRow = Omit<PieceRow, 'share' | 'stream_version_id'>;

const toOutputRun = (row: RunRow): OutputStreamRun => ({
  id: row.id,
  streamId: row.stream_code,
  productId: row.product_id,
  lotCode: row.lot_code,
  start: new Date(row.start_time),
  end: row.end_time ? new Date(row.end_time) : null,
});

/**
 * SME E6: the runs the actuals need to attribute output: those overlapping the window (stream output)
 * and those that made the lots the window's outputs name (silo / packaging output of an earlier grade).
 */
export async function loadOutputStreamRuns(
  manager: EntityManager,
  window: Window,
  lotCodes: readonly string[],
): Promise<OutputStreamRun[]> {
  const params = [window.tenantId, window.unitId];
  const inWindow: RunRow[] = await manager.query(WINDOW_RUNS_SQL, [
    ...params,
    window.from,
    window.to,
  ]);
  const ofLots: RunRow[] = lotCodes.length
    ? await manager.query(LOT_RUNS_SQL, [...params, [...lotCodes]])
    : [];
  const byId = new Map([...inWindow, ...ofLots].map((r) => [r.id, r]));
  return [...byId.values()].map(toOutputRun);
}

/**
 * $1 tenant, $2 unit, $3 window start, $4 window end: output events measured outside the window whose lot
 * was made inside it (they belong to the period the lot was produced in).
 */
export const LOT_OUTPUT_EVENTS_SQL = `SELECT e."id", e."canonical_id", e."current_source_revision", e."row_version", e."start_time",
       e."end_time", e."quantity"::text AS "quantity", e."defective_quantity"::text AS "rejects", e."quantity_uom",
       e."stream_code", e."lot_code"
  FROM "production_events" e
  JOIN "stream_runs" r ON r."tenant_id" = e."tenant_id" AND r."unit_id" = e."unit_id" AND r."lot_code" = e."lot_code"
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."physical_type" = 'production_output'
   AND e."physical_state" IN ('open', 'closed')
   AND tstzrange(r."start_time", r."end_time", '[)') && tstzrange($3, $4, '[)')
   AND NOT (tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)'))
 ORDER BY e."start_time", e."id"`;
