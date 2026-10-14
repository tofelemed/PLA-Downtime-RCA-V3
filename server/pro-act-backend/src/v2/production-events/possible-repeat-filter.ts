import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** SME D5 pilot: same-asset, same-reason stops restarting within 2 minutes are candidates for one incident. */
export const DEFAULT_REPEAT_WINDOW_SECONDS = 120;

/**
 * A live stop that began within the window after another live stop of the same asset (or of the unit when
 * neither has an asset) with the same reason code ended — a stop-restart-stop sequence that may be one
 * unresolved incident (SME D5). Only flagged: every raw stop stays, nothing is grouped automatically until
 * the plant has validated the window on its own traces.
 */
const REPEAT_OF_RECENT_STOP = (alias: string) =>
  `EXISTS (SELECT 1 FROM "production_events" "previous"
    WHERE "previous"."unit_id" = ${alias}."unit_id"
      AND "previous"."id" <> ${alias}."id"
      AND "previous"."physical_state" IN ('open', 'closed')
      AND "previous"."physical_type" = 'downtime'
      AND "previous"."asset_id" IS NOT DISTINCT FROM ${alias}."asset_id"
      AND "previous"."reason_code_id" = ${alias}."reason_code_id"
      AND "previous"."end_time" <= ${alias}."start_time"
      AND "previous"."end_time" >= ${alias}."start_time" - make_interval(secs => :repeatWindowSeconds))`;

const LIVE_STOP = (alias: string) =>
  `${alias}."physical_state" IN ('open', 'closed') AND ${alias}."physical_type" = 'downtime'`;

/** `possibleRepeat` filter of the v2 event list and export: true = flagged repeats, false = the rest. */
export function applyPossibleRepeatFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  filter: { possibleRepeat?: boolean; repeatWindowSeconds?: number },
  alias: string,
): SelectQueryBuilder<T> {
  if (filter.possibleRepeat === undefined) return qb;
  const flagged = `(${LIVE_STOP(`"${alias}"`)} AND ${REPEAT_OF_RECENT_STOP(`"${alias}"`)})`;
  return qb.andWhere(filter.possibleRepeat ? flagged : `NOT ${flagged}`, {
    repeatWindowSeconds:
      filter.repeatWindowSeconds ?? DEFAULT_REPEAT_WINDOW_SECONDS,
  });
}
