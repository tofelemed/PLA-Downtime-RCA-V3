import { isUUID } from 'class-validator';
import { EntityManager } from 'typeorm';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';

/**
 * One loss line a picker offers (UX G-3): what the RCA `loss_line` link targets — `loss_lines.id` of a run
 * line, or the manual line id (`approved_loss_lines.source_id`) of an approved manual line.
 */
export interface LossLinePickerV2View {
  id: string;
  periodId: string;
  unitId: string;
  localDate: string;
  shiftName: string | null;
  periodStart: string;
  revisionId: string;
  revision: number;
  /** draft | in_review | approved — the latest revision of the period that is not cancelled */
  lifecycle: string;
  runId: string;
  kind: string;
  /** signed decimal string, as the engine proposed it */
  quantity: string;
  uom: string | null;
  basis: string;
  segmentStart: string;
  segmentEnd: string;
  reasonCodeId: string | null;
  reasonCode: string | null;
  reasonName: string | null;
  causeEventId: string | null;
  causeEventDescription: string | null;
  occurrenceId: string | null;
  /** run = an engine line of the current run; manual = a manual line of the approved revision (no run segment) */
  source: 'run' | 'manual';
}

export interface LossLinePickerFilter {
  tenantId: string;
  /** units the caller is limited to (null = the whole tenant) */
  scopeUnitIds: string[] | null;
  unitIds?: string[];
  reasonCodeIds?: string[];
  kinds: readonly string[];
  /** escaped ILIKE pattern */
  pattern: string | null;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
}

/** Latest non-cancelled revision of the period `p` (UQ_accounting_revisions_period_revision). */
const LATEST_REVISION = `JOIN LATERAL (SELECT ar."id", ar."revision", ar."lifecycle", ar."current_run_id" FROM "accounting_revisions" ar
                 WHERE ar."tenant_id" = $1 AND ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'
                 ORDER BY ar."revision" DESC LIMIT 1) r ON true`;

const PERIOD_FILTERS = `p."tenant_id" = $1
   AND ($2::uuid[] IS NULL OR p."unit_id" = ANY($2::uuid[]))
   AND ($3::uuid[] IS NULL OR p."unit_id" = ANY($3::uuid[]))`;

/**
 * Plan-ledger lines of the current run of each period's latest non-cancelled revision (what the
 * reconciliation editor shows), plus the manual lines of that revision once it is approved (Marun E2E:
 * `approved_loss_lines` with source `line`; their id is the manual line's, the `source_id`, which an RCA
 * `loss_line` link targets). Newest period first, keyset on (period start, line id). Uses
 * IDX_production_periods_tenant_start, UQ_accounting_revisions_period_revision and
 * IDX_loss_lines_run_ledger_kind.
 */
const SQL = `SELECT * FROM (
SELECT l."id", l."period_id", p."unit_id", to_char(p."local_date", 'YYYY-MM-DD') AS "local_date",
       p."shift_name", p."utc_start", r."id" AS "revision_id", r."revision", r."lifecycle"::text AS "lifecycle",
       l."run_id", l."kind"::text AS "kind", l."quantity"::text AS "quantity", l."uom", l."basis"::text AS "basis",
       l."segment_start", l."segment_end", l."reason_code_id", rc."code" AS "reason_code", rc."name" AS "reason_name",
       l."cause_event_id", e."description" AS "event_description", l."occurrence_id", 'run' AS "source"
  FROM "production_periods" p
  ${LATEST_REVISION}
  JOIN "loss_lines" l ON l."run_id" = r."current_run_id" AND l."tenant_id" = $1
  LEFT JOIN "reason_codes" rc ON rc."id" = l."reason_code_id"
  LEFT JOIN "production_events" e ON e."id" = l."cause_event_id" AND e."tenant_id" = $1
 WHERE ${PERIOD_FILTERS}
   AND ($4::timestamptz IS NULL OR (p."utc_end" > $4::timestamptz AND l."segment_end" > $4::timestamptz))
   AND ($5::timestamptz IS NULL OR (p."utc_start" < $5::timestamptz AND l."segment_start" < $5::timestamptz))
   AND l."ledger" = 'plan' AND l."state" = 'active' AND l."source" <> 'candidate_superseded'
   AND l."kind"::text = ANY($6::text[])
   AND ($7::uuid[] IS NULL OR l."reason_code_id" = ANY($7::uuid[]))
   AND ($8::text IS NULL OR rc."code" ILIKE $8::text OR rc."name" ILIKE $8::text OR e."description" ILIKE $8::text)
UNION ALL
SELECT a."source_id", a."period_id", p."unit_id", to_char(p."local_date", 'YYYY-MM-DD'),
       p."shift_name", p."utc_start", r."id", r."revision", r."lifecycle"::text,
       r."current_run_id", a."kind"::text, a."quantity"::text, a."uom", 'manual',
       p."utc_start", p."utc_end", a."reason_code_id", rc."code", rc."name",
       a."cause_event_id", e."description", NULL::uuid, 'manual'
  FROM "production_periods" p
  ${LATEST_REVISION}
  JOIN "approved_loss_lines" a ON a."revision_id" = r."id" AND a."tenant_id" = $1 AND a."source" = 'line'
  LEFT JOIN "reason_codes" rc ON rc."id" = a."reason_code_id"
  LEFT JOIN "production_events" e ON e."id" = a."cause_event_id" AND e."tenant_id" = $1
 WHERE ${PERIOD_FILTERS} AND r."lifecycle" = 'approved'
   AND ($4::timestamptz IS NULL OR p."utc_end" > $4::timestamptz)
   AND ($5::timestamptz IS NULL OR p."utc_start" < $5::timestamptz)
   AND a."kind"::text = ANY($6::text[])
   AND ($7::uuid[] IS NULL OR a."reason_code_id" = ANY($7::uuid[]))
   AND ($8::text IS NULL OR rc."code" ILIKE $8::text OR rc."name" ILIKE $8::text OR e."description" ILIKE $8::text)
) x
 WHERE ($9::timestamptz IS NULL OR (x."utc_start", x."id") < ($9::timestamptz, $10::uuid))
 ORDER BY x."utc_start" DESC, x."id" DESC
 LIMIT $11`;

interface Row {
  id: string;
  period_id: string;
  unit_id: string;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  revision_id: string;
  revision: number;
  lifecycle: string;
  run_id: string;
  kind: string;
  quantity: string;
  uom: string | null;
  basis: string;
  segment_start: Date;
  segment_end: Date;
  reason_code_id: string | null;
  reason_code: string | null;
  reason_name: string | null;
  cause_event_id: string | null;
  event_description: string | null;
  occurrence_id: string | null;
  source: 'run' | 'manual';
}

const iso = (value: Date) => new Date(value).toISOString();

export function pickerView(row: Row): LossLinePickerV2View {
  return {
    id: row.id,
    periodId: row.period_id,
    unitId: row.unit_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    periodStart: iso(row.utc_start),
    revisionId: row.revision_id,
    revision: row.revision,
    lifecycle: row.lifecycle,
    runId: row.run_id,
    kind: row.kind,
    quantity: row.quantity,
    uom: row.uom,
    basis: row.basis,
    segmentStart: iso(row.segment_start),
    segmentEnd: iso(row.segment_end),
    reasonCodeId: row.reason_code_id,
    reasonCode: row.reason_code,
    reasonName: row.reason_name,
    causeEventId: row.cause_event_id,
    causeEventDescription: row.event_description,
    occurrenceId: row.occurrence_id,
    source: row.source,
  };
}

function cursorOf(value: string | undefined): [string | null, string | null] {
  if (!value) return [null, null];
  const { sortValue, id } = CursorCodec.decode(value);
  const validTime =
    typeof sortValue === 'string' && !Number.isNaN(Date.parse(sortValue));
  if (!validTime || !isUUID(id)) throw invalidCursor();
  return [sortValue, id];
}

/** One keyset page of picker lines. */
export async function lossLinePickerPage(
  manager: EntityManager,
  filter: LossLinePickerFilter,
): Promise<{ items: LossLinePickerV2View[]; nextCursor: string | null }> {
  const [afterStart, afterId] = cursorOf(filter.cursor);
  const rows: Row[] = await manager.query(SQL, [
    filter.tenantId,
    filter.scopeUnitIds,
    filter.unitIds ?? null,
    filter.from ?? null,
    filter.to ?? null,
    [...filter.kinds],
    filter.reasonCodeIds ?? null,
    filter.pattern,
    afterStart,
    afterId,
    filter.limit + 1,
  ]);
  const page = rows.slice(0, filter.limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > filter.limit && last
      ? CursorCodec.encode({ sortValue: iso(last.utc_start), id: last.id })
      : null;
  return { items: page.map(pickerView), nextCursor };
}
