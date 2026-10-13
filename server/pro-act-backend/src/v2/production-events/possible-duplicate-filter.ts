import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * A live stop that overlaps another live stop of the same asset, or of the same unit when neither has an
 * asset (DT-04): one piece of equipment cannot stop twice at once, so the pair is usually one stop entered
 * twice. Split children never overlap and superseded / retracted events are not live, so lineage needs no
 * extra test. The lookup uses `IDX_production_events_unit_span` (unit + half-open span of live events).
 */
const OVERLAPPING_STOP = (alias: string) =>
  `EXISTS (SELECT 1 FROM "production_events" "other"
    WHERE "other"."unit_id" = ${alias}."unit_id"
      AND "other"."id" <> ${alias}."id"
      AND "other"."physical_state" IN ('open', 'closed')
      AND "other"."physical_type" = 'downtime'
      AND "other"."asset_id" IS NOT DISTINCT FROM ${alias}."asset_id"
      AND tstzrange("other"."start_time", "other"."end_time", '[)')
       && tstzrange(${alias}."start_time", ${alias}."end_time", '[)'))`;

const LIVE_STOP = (alias: string) =>
  `${alias}."physical_state" IN ('open', 'closed') AND ${alias}."physical_type" = 'downtime'`;

/** `possibleDuplicate` filter of the v2 event list and export: true = flagged stops, false = the rest. */
export function applyPossibleDuplicateFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  possibleDuplicate: boolean | undefined,
  alias: string,
): SelectQueryBuilder<T> {
  if (possibleDuplicate === undefined) return qb;
  const flagged = `(${LIVE_STOP(`"${alias}"`)} AND ${OVERLAPPING_STOP(`"${alias}"`)})`;
  return qb.andWhere(possibleDuplicate ? flagged : `NOT ${flagged}`);
}
