import { EntityManager } from 'typeorm';

/** F-1: what the Recommended queue shows of a recommendation's event without a request per row. */
export interface RcaRecommendationEventFacts {
  reasonCodeId: string | null;
  reasonName: string | null;
  assetId: string | null;
  assetName: string | null;
  startTime: string;
}

interface FactsRow {
  id: string;
  reason_code_id: string | null;
  reason_name: string | null;
  asset_id: string | null;
  asset_name: string | null;
  start_time: Date | string;
}

/** Events of one page by primary key with their reason and asset names (left joins by primary key). */
export const RECOMMENDATION_EVENT_FACTS_SQL = `SELECT e."id", e."reason_code_id", rc."name" AS "reason_name", e."asset_id",
       a."name" AS "asset_name", e."start_time"
  FROM "production_events" e
  LEFT JOIN "reason_codes" rc ON rc."id" = e."reason_code_id"
  LEFT JOIN "assets" a ON a."id" = e."asset_id"
 WHERE e."tenant_id" = $1 AND e."id" = ANY($2::uuid[])`;

export function toEventFacts(row: FactsRow): RcaRecommendationEventFacts {
  return {
    reasonCodeId: row.reason_code_id,
    reasonName: row.reason_name,
    assetId: row.asset_id,
    assetName: row.asset_name,
    startTime: new Date(row.start_time).toISOString(),
  };
}

/** Event facts by event id for the recommendations of one page (one query). */
export async function recommendationEventFacts(
  manager: EntityManager,
  tenantId: string,
  eventIds: string[],
): Promise<Map<string, RcaRecommendationEventFacts>> {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) return new Map();
  const rows: FactsRow[] = await manager.query(RECOMMENDATION_EVENT_FACTS_SQL, [
    tenantId,
    ids,
  ]);
  return new Map(rows.map((row) => [row.id, toEventFacts(row)]));
}
