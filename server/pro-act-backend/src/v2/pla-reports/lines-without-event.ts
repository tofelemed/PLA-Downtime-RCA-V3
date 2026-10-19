import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';
import { params, SHOWN } from '../reports/report-sql';
import { LOSS_TREE_KINDS, Ledger, LossTreeKind } from './pla-reports.dto';

/** Lines listed at most; `total` counts them all. */
export const LINES_WITHOUT_EVENT_LIMIT = 50;

/**
 * One loss line of the shown periods that explains no event (QA PLA M3 re-test: the Performance drill
 * opened "No loss events" while its 4 t was a manual line): what it is and the evidence it rests on.
 */
export interface LineWithoutEventView {
  lineId: string;
  /** `approved` = an approved line of the period's approved revision; `run` = a calculated line of the shown run */
  origin: 'approved' | 'run';
  periodId: string;
  /** plan of the period's selected plan version (the period page lives under it); null without one */
  planId: string | null;
  unitId: string;
  /** the period's operational date and shift name (plant calendar, as stored) */
  localDate: string;
  shiftName: string | null;
  periodStart: string;
  kind: string;
  quantity: string;
  uom: string | null;
  reasonCodeId: string | null;
  /** `CODE Name` of the reason code; null without one */
  reasonLabel: string | null;
  /** why the line was entered (the editor's words) */
  reason: string | null;
  comment: string | null;
  /** SME R11: the record the quantity rests on (log, work order, …) and its reference */
  evidenceType: string | null;
  evidenceRef: string | null;
}

export interface LinesWithoutEventView {
  ledger: Ledger;
  kinds: LossTreeKind[];
  /** largest first, at most `LINES_WITHOUT_EVENT_LIMIT` */
  items: LineWithoutEventView[];
  /** every matching line, also those beyond the list */
  total: number;
}

interface LineRow {
  line_id: string;
  origin: 'approved' | 'run';
  period_id: string;
  plan_id: string | null;
  unit_id: string;
  local_date: string;
  shift_name: string | null;
  period_start: Date;
  kind: string;
  quantity: string;
  uom: string | null;
  reason_code_id: string | null;
  reason_label: string | null;
  reason: string | null;
  comment: string | null;
  evidence_type: string | null;
  evidence_ref: string | null;
  total: number;
}

/**
 * The lines of each shown period with no cause event, by the same rule as the loss tree (VA-01b): the
 * approved plan lines (with their reconciliation line's reason, comment and evidence) when the revision is
 * approved and has them, else the run's active lines of the ledger. $1–$5 the report scope, $6 ledger,
 * $7 kinds, $8 limit.
 */
const LINES_SQL = `${SHOWN}
  SELECT l."line_id"::text AS "line_id", l."origin", s."period_id"::text AS "period_id", pv."plan_id"::text AS "plan_id",
         s."unit_id"::text AS "unit_id",
         s."local_date"::text AS "local_date", s."shift_name", p."utc_start" AS "period_start", l."kind"::text AS "kind",
         l."quantity"::text AS "quantity", l."uom", l."reason_code_id"::text AS "reason_code_id",
         CASE WHEN rc."id" IS NULL THEN NULL ELSE rc."code" || ' ' || rc."name" END AS "reason_label",
         l."reason", l."comment", l."evidence_type", l."evidence_ref", count(*) OVER ()::int AS "total"
    FROM shown s
    JOIN "production_periods" p ON p."id" = s."period_id"
    JOIN LATERAL (
      SELECT a."id" AS "line_id", 'approved' AS "origin", a."kind", a."uom", a."quantity", a."reason_code_id",
             rl."reason", rl."comment", rl."evidence_type", rl."evidence_ref"
        FROM "approved_loss_lines" a
        LEFT JOIN "reconciliation_lines" rl
          ON a."source" = 'line' AND rl."id" = a."source_id" AND rl."tenant_id" = a."tenant_id"
       WHERE $6::text = 'plan' AND s."lifecycle" = 'approved' AND a."revision_id" = s."revision_id"
         AND a."tenant_id" = $1 AND a."kind"::text = ANY($7::text[]) AND a."cause_event_id" IS NULL
      UNION ALL
      SELECT r."id", 'run', r."kind", r."uom", r."quantity", r."reason_code_id", NULL, r."comment", NULL, NULL
        FROM "loss_lines" r
       WHERE r."run_id" = s."run_id" AND r."tenant_id" = $1 AND r."period_id" = s."period_id"
         AND r."ledger" = $6::loss_ledger AND r."state" = 'active' AND r."source" <> 'candidate_superseded'
         AND r."kind"::text = ANY($7::text[]) AND r."cause_event_id" IS NULL
         AND NOT ($6::text = 'plan' AND s."lifecycle" = 'approved' AND EXISTS (
               SELECT 1 FROM "approved_loss_lines" x WHERE x."revision_id" = s."revision_id" AND x."tenant_id" = $1))
    ) l ON true
    LEFT JOIN "plan_versions" pv ON pv."id" = p."selected_plan_version_id" AND pv."tenant_id" = $1
    LEFT JOIN "reason_codes" rc ON rc."id" = l."reason_code_id" AND rc."tenant_id" = $1
   ORDER BY l."quantity" DESC, p."utc_start", l."line_id"
   LIMIT $8`;

function viewOf(row: LineRow): LineWithoutEventView {
  return {
    lineId: row.line_id,
    origin: row.origin,
    periodId: row.period_id,
    planId: row.plan_id,
    unitId: row.unit_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    periodStart: new Date(row.period_start).toISOString(),
    kind: row.kind,
    quantity: formatDec(new Dec(row.quantity)),
    uom: row.uom,
    reasonCodeId: row.reason_code_id,
    reasonLabel: row.reason_label,
    reason: row.reason,
    comment: row.comment,
    evidenceType: row.evidence_type,
    evidenceRef: row.evidence_ref,
  };
}

/** The scope's loss lines that explain no event, largest first, with their reason and evidence. */
export async function linesWithoutEvent(
  manager: EntityManager,
  scope: ReportScope,
  request: { ledger: Ledger; kinds?: readonly LossTreeKind[] },
): Promise<LinesWithoutEventView> {
  const kinds = request.kinds?.length
    ? [...request.kinds]
    : [...LOSS_TREE_KINDS];
  const rows = await manager.query<LineRow[]>(LINES_SQL, [
    ...params(scope),
    request.ledger,
    kinds,
    LINES_WITHOUT_EVENT_LIMIT,
  ]);
  return {
    ledger: request.ledger,
    kinds,
    items: rows.map(viewOf),
    total: rows[0]?.total ?? 0,
  };
}
