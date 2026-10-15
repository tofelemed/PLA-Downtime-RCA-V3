import { EntityManager } from 'typeorm';

const DAY_MS = 86_400_000;

/** Stops and failure work orders that count as recurrences (live events only). */
const RECURRING = `e."physical_state" IN ('open', 'closed') AND (e."physical_type" = 'downtime' OR e."event_type" = 'FailureWO')`;

/**
 * Prior occurrences on the same asset and with the same reason in the `windowDays` before `before`
 * (evidence package recurrence); null when the event has no asset / reason.
 */
export async function priorRecurrence(
  manager: EntityManager,
  input: {
    tenantId: string;
    assetId: string | null;
    reasonCodeId: string | null;
    before: Date;
    windowDays: number;
  },
): Promise<{
  windowDays: number;
  sameAsset: number | null;
  sameReason: number | null;
}> {
  const from = new Date(input.before.getTime() - input.windowDays * DAY_MS);
  const count = async (
    column: 'asset_id' | 'reason_code_id',
    id: string | null,
  ) => {
    if (!id) return null;
    const rows: Array<{ n: number }> = await manager.query(
      `SELECT count(DISTINCT COALESCE(e."occurrence_id", e."id"))::int AS "n" FROM "production_events" e
        WHERE e."tenant_id" = $1 AND e."${column}" = $2 AND e."start_time" >= $3 AND e."start_time" < $4 AND ${RECURRING}`,
      [input.tenantId, id, from, input.before],
    );
    return rows[0]?.n ?? 0;
  };
  return {
    windowDays: input.windowDays,
    sameAsset: await count('asset_id', input.assetId),
    sameReason: await count('reason_code_id', input.reasonCodeId),
  };
}

/** D13 functional failures of an asset starting in [from, to) (`failure_events_v`, one per occurrence). */
export async function assetFailures(
  manager: EntityManager,
  input: { tenantId: string; assetId: string; from: Date; to: Date },
): Promise<number> {
  const rows: Array<{ n: number }> = await manager.query(
    `SELECT count(*)::int AS "n" FROM "failure_events_v" f
      WHERE f."tenant_id" = $1 AND f."asset_id" = $2 AND f."start_time" >= $3 AND f."start_time" < $4`,
    [input.tenantId, input.assetId, input.from, input.to],
  );
  return rows[0]?.n ?? 0;
}

/** What a case is about: the assets, units and reasons of its linked events. */
export interface CaseFootprint {
  assetIds: string[];
  unitIds: string[];
  reasonCodeIds: string[];
}

export async function caseFootprint(
  manager: EntityManager,
  tenantId: string,
  rcaId: string,
): Promise<CaseFootprint> {
  const rows: Array<{
    assets: string[] | null;
    units: string[] | null;
    reasons: string[] | null;
  }> = await manager.query(
    `SELECT array_agg(DISTINCT e."asset_id") FILTER (WHERE e."asset_id" IS NOT NULL) AS "assets",
              array_agg(DISTINCT e."unit_id") AS "units",
              array_agg(DISTINCT e."reason_code_id") FILTER (WHERE e."reason_code_id" IS NOT NULL) AS "reasons"
         FROM "rca_case_links" k JOIN "production_events" e ON e."id"::text = k."target_id" AND e."tenant_id" = $1
        WHERE k."tenant_id" = $1 AND k."rca_id" = $2 AND k."link_type" = 'event'`,
    [tenantId, rcaId],
  );
  const row = rows[0];
  return {
    assetIds: row?.assets ?? [],
    unitIds: (row?.units ?? []).filter((id): id is string => id !== null),
    reasonCodeIds: row?.reasons ?? [],
  };
}

/**
 * Recurrences of a case's footprint in [from, to): occurrences on its assets (or, without assets, its
 * units), narrowed to its reasons when it has any, and their downtime seconds clipped to the window.
 */
export async function footprintRecurrence(
  manager: EntityManager,
  input: { tenantId: string; footprint: CaseFootprint; from: Date; to: Date },
): Promise<{ recurrences: number; lossSeconds: string }> {
  const { footprint } = input;
  if (footprint.assetIds.length === 0 && footprint.unitIds.length === 0)
    return { recurrences: 0, lossSeconds: '0' };
  const rows: Array<{ n: number; seconds: string | null }> =
    await manager.query(
      `SELECT count(DISTINCT COALESCE(e."occurrence_id", e."id"))::int AS "n",
            sum(EXTRACT(EPOCH FROM (LEAST(COALESCE(e."end_time", $4), $4) - GREATEST(e."start_time", $3))))
              FILTER (WHERE e."physical_type" = 'downtime')::text AS "seconds"
       FROM "production_events" e
      WHERE e."tenant_id" = $1 AND e."start_time" < $4 AND (e."end_time" IS NULL OR e."end_time" > $3)
        AND e."start_time" >= $3 AND ${RECURRING}
        AND (CASE WHEN cardinality($2::uuid[]) > 0 THEN e."asset_id" = ANY($2::uuid[]) ELSE e."unit_id" = ANY($5::uuid[]) END)
        AND (cardinality($6::uuid[]) = 0 OR e."reason_code_id" = ANY($6::uuid[]))`,
      [
        input.tenantId,
        footprint.assetIds,
        input.from,
        input.to,
        footprint.unitIds,
        footprint.reasonCodeIds,
      ],
    );
  const row = rows[0];
  return { recurrences: row?.n ?? 0, lossSeconds: row?.seconds ?? '0' };
}
