import { isUuid } from '../production-event/revisions/revision-actor';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';
import { RcaOccurrenceV2ListQueryDto } from '../v2/rca/rca-links-v2.dto';
import { invalidBody, RcaScope } from './rca-scope';

/** One stop occurrence a picker offers (UX G-3): what the RCA `occurrence` link targets. */
export interface RcaOccurrenceV2View {
  occurrenceId: string;
  unitId: string;
  /** first event's start; end of the last event, null while one of them is open */
  startTime: string;
  endTime: string | null;
  eventCount: number;
  firstEventId: string;
  description: string | null;
  assetId: string | null;
  assetName: string | null;
  reasonCodeId: string | null;
  reasonName: string | null;
  /** cases of your scope the occurrence is already linked to (oldest link first) */
  linkedRcaIds: string[];
}

const MAX_WINDOW_MS = 366 * 24 * 3600 * 1000;

/**
 * Occurrences with a current event (open or closed) matching the filters, each summarised over all its
 * current events in the caller's units; newest first, keyset on (first start, occurrence id). The matching
 * step is bounded by the window (or one event); the summary reads `IDX_production_events_tenant_occurrence`
 * and the link list `IDX_rca_case_links_tenant_target`.
 */
export const OCCURRENCE_PICKER_SQL = `WITH hit AS (
  SELECT DISTINCT e."occurrence_id"
    FROM "production_events" e
   WHERE e."tenant_id" = $1 AND e."physical_state" IN ('open', 'closed')
     AND ($2::uuid[] IS NULL OR e."unit_id" = ANY($2::uuid[]))
     AND ($3::uuid IS NULL OR e."unit_id" = $3::uuid)
     AND ($4::timestamptz IS NULL OR e."end_time" IS NULL OR e."end_time" > $4::timestamptz)
     AND ($5::timestamptz IS NULL OR e."start_time" < $5::timestamptz)
     AND ($6::uuid IS NULL OR e."asset_id" = $6::uuid)
     AND ($7::uuid IS NULL OR e."reason_code_id" = $7::uuid)
     AND ($8::text IS NULL OR e."description" ILIKE $8::text)
     AND ($9::uuid IS NULL OR e."occurrence_id" = (SELECT x."occurrence_id" FROM "production_events" x
                                                    WHERE x."id" = $9::uuid AND x."tenant_id" = $1))
), occ AS (
  SELECT e."occurrence_id", min(e."start_time") AS "start_time", min(e."start_time")::text AS "start_text",
         CASE WHEN bool_or(e."end_time" IS NULL) THEN NULL ELSE max(e."end_time") END AS "end_time",
         count(*)::int AS "event_count",
         (array_agg(e."id" ORDER BY e."start_time", e."id"))[1] AS "first_event_id"
    FROM hit JOIN "production_events" e ON e."tenant_id" = $1 AND e."occurrence_id" = hit."occurrence_id"
   WHERE e."physical_state" IN ('open', 'closed') AND ($2::uuid[] IS NULL OR e."unit_id" = ANY($2::uuid[]))
   GROUP BY e."occurrence_id"
  HAVING ($10::timestamptz IS NULL OR (min(e."start_time"), e."occurrence_id") < ($10::timestamptz, $11::uuid))
   ORDER BY min(e."start_time") DESC, e."occurrence_id" DESC
   LIMIT $12
)
SELECT occ."occurrence_id", f."unit_id", occ."start_time", occ."start_text", occ."end_time", occ."event_count",
       occ."first_event_id", f."description", f."asset_id", a."name" AS "asset_name", f."reason_code_id",
       rc."name" AS "reason_name",
       COALESCE((SELECT array_agg(k."rca_id" ORDER BY k."linked_at", k."id")
                   FROM "rca_case_links" k JOIN "rcas" r ON r."id" = k."rca_id"
                  WHERE k."tenant_id" = $1 AND k."link_type" = 'occurrence' AND k."target_id" = occ."occurrence_id"::text
                    AND ($2::uuid[] IS NULL OR r."unit_id" = ANY($2::uuid[]))),
                '{}') AS "linked_rca_ids"
  FROM occ
  JOIN "production_events" f ON f."id" = occ."first_event_id"
  LEFT JOIN "assets" a ON a."id" = f."asset_id"
  LEFT JOIN "reason_codes" rc ON rc."id" = f."reason_code_id"
 ORDER BY occ."start_time" DESC, occ."occurrence_id" DESC`;

export interface OccurrenceRow {
  occurrence_id: string;
  unit_id: string;
  start_time: Date | string;
  start_text: string;
  end_time: Date | string | null;
  event_count: number;
  first_event_id: string;
  description: string | null;
  asset_id: string | null;
  asset_name: string | null;
  reason_code_id: string | null;
  reason_name: string | null;
  linked_rca_ids: string[];
}

const escapeLike = (value: string) =>
  value.replace(/[\\%_]/g, (match) => `\\${match}`);

/** 422 unless the search is bounded: one event, or a window `from < to` of at most 366 days. */
function assertBounded(query: RcaOccurrenceV2ListQueryDto): void {
  if (query.from && query.to && Date.parse(query.from) >= Date.parse(query.to))
    throw invalidBody('INVALID_RANGE', 'to', 'from must be before to');
  if (query.eventId) return;
  if (!query.from || !query.to)
    throw invalidBody(
      'WINDOW_REQUIRED',
      'from',
      'give a window (from and to) or an eventId',
    );
  if (Date.parse(query.to) - Date.parse(query.from) > MAX_WINDOW_MS)
    throw invalidBody(
      'WINDOW_TOO_LONG',
      'to',
      'the window is at most 366 days',
    );
}

function cursorParams(
  cursor: string | undefined,
): [string | null, string | null] {
  if (!cursor) return [null, null];
  const { sortValue, id } = CursorCodec.decode(cursor);
  if (typeof sortValue !== 'string' || !isUuid(id)) throw invalidCursor();
  return [sortValue, id];
}

/** Positional parameters of `OCCURRENCE_PICKER_SQL` (validated; `limit + 1` rows are fetched). */
export function occurrencePickerParams(
  query: RcaOccurrenceV2ListQueryDto,
  scope: RcaScope,
): unknown[] {
  assertBounded(query);
  const [cursorStart, cursorId] = cursorParams(query.cursor);
  return [
    scope.tenantId,
    scope.units,
    query.unitId ?? null,
    query.from ?? null,
    query.to ?? null,
    query.assetId ?? null,
    query.reasonCodeId ?? null,
    query.q ? `%${escapeLike(query.q)}%` : null,
    query.eventId ?? null,
    cursorStart,
    cursorId,
    query.limit + 1,
  ];
}

const iso = (value: Date | string) => new Date(value).toISOString();

export function toOccurrenceView(row: OccurrenceRow): RcaOccurrenceV2View {
  return {
    occurrenceId: row.occurrence_id,
    unitId: row.unit_id,
    startTime: iso(row.start_time),
    endTime: row.end_time === null ? null : iso(row.end_time),
    eventCount: row.event_count,
    firstEventId: row.first_event_id,
    description: row.description,
    assetId: row.asset_id,
    assetName: row.asset_name,
    reasonCodeId: row.reason_code_id,
    reasonName: row.reason_name,
    linkedRcaIds: row.linked_rca_ids,
  };
}

/** The page and its next cursor from the `limit + 1` rows. */
export function occurrencePage(
  rows: OccurrenceRow[],
  limit: number,
): { items: RcaOccurrenceV2View[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? CursorCodec.encode({
          sortValue: last.start_text,
          id: last.occurrence_id,
        })
      : null;
  return { items: page.map(toOccurrenceView), nextCursor };
}
