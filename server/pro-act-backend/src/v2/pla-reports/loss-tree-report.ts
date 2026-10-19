import { EntityManager } from 'typeorm';
import { Dec, toDec, ZERO } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';
import { params, SHOWN } from '../reports/report-sql';
import {
  LOSS_TREE_KINDS,
  LOSS_TREE_METRICS,
  LossTreeKind,
  LossTreeGroup,
  LossTreeMetric,
  Ledger,
} from './pla-reports.dto';

export interface LossTreeGroupView {
  /**
   * reason / impact code id, OEE component, kind, unit id or cause event id; null = not coded (by reason:
   * an uncoded line with a cause event; quality lines from lot dispositions are the `quality_dispositions` group)
   */
  key: string | null;
  label: string | null;
  /** unit of measure (qty) or currency (value metrics) */
  unit: string | null;
  /** decimal string; null when nothing is valued or an approved FX rate is missing (never 0) */
  amount: string | null;
  /** of the unit's total, 0..1 (decimal string); null when the amount or the total is unknown or 0 */
  share: string | null;
  /** Pareto line: this group and every larger one before it */
  cumulativeShare: string | null;
  lines: number;
  /** lines of the group that explain an event (a cause event); 0 = manual or disposition lines only (no event to open) */
  eventLines: number;
  status: 'valued' | 'unvalued' | 'mixed' | 'quantity';
  /** SME V7: some amount was converted with an authorised provisional FX rate (reason fx_rate_provisional) */
  fxProvisional: boolean;
  reasons: string[];
}

export interface LossTreeTotalView {
  unit: string | null;
  amount: string | null;
  lines: number;
  groups: number;
  status: LossTreeGroupView['status'];
  fxProvisional: boolean;
  reasons: string[];
}

export interface LossTreeView {
  groupBy: LossTreeGroup;
  /** the metric shown (`value` resolves to the policy's default view) */
  metric: LossTreeMetric;
  /** the valuation view of a value metric; null for quantities */
  view: string | null;
  /** SME V8: true when `metric=value` asked for the policy's default management view */
  defaultView: boolean;
  /** SME V8 / R12: `approved` only when every shown period is approved, else provisional figures */
  valuationStatus: 'approved' | 'provisional';
  approvedPeriods: number;
  periods: number;
  ledger: Ledger;
  basis: string;
  groups: LossTreeGroupView[];
  /** per unit / currency, over every group (also when `limit` cut the list) */
  totals: LossTreeTotalView[];
  /** groups left out by `limit` */
  truncated: number;
  calculationRunIds: string[];
}

interface CellRow {
  group_key: string | null;
  unit: string | null;
  amount: string | null;
  lines: number;
  event_lines: number;
  valued: number;
  unvalued: number;
  fx_missing: number;
  fx_provisional: number;
  reasons: string[] | null;
}

/** Quality lines without a cause event come from lot dispositions: their own group, never "Not coded" (QA PLA). */
export const QUALITY_DISPOSITIONS = 'quality_dispositions';

const GROUP_SQL: Readonly<Record<LossTreeGroup, string>> = {
  reason: `COALESCE(l."reason_code_id"::text, CASE WHEN l."kind"::text = 'quality' AND l."cause_event_id" IS NULL THEN '${QUALITY_DISPOSITIONS}' END)`,
  impact: `l."impact_code_id"::text`,
  oee: `l."oee_component"`,
  kind: `l."kind"::text`,
  unit: `s."unit_id"::text`,
  event: `l."cause_event_id"::text`,
};

const LABELS: Partial<Record<LossTreeGroup, string>> = {
  reason: `SELECT "id"::text AS "id", "code" || ' ' || "name" AS "label" FROM "reason_codes" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`,
  impact: `SELECT "id"::text AS "id", "code" || ' ' || "name" AS "label" FROM "impact_codes" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`,
  unit: `SELECT "id"::text AS "id", "name" AS "label" FROM "units" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`,
};

const WORDS: Readonly<Record<string, string>> = {
  schedule_exclusion: 'Schedule exclusion',
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  transition_allowance: 'Grade transition (within standard)',
  transition_excess: 'Grade transition overrun',
  bridge: 'Bridge',
  unaccounted_classified: 'Unaccounted',
  [QUALITY_DISPOSITIONS]: 'Quality (dispositions)',
};

export const LOSS_TREE_BASIS =
  'plan ledger of an approved revision: the approved lines (decided candidates and manual lines); ' +
  'otherwise the loss lines of the shown calculation run — decisions of an open draft are in the waterfall';

/**
 * Lines of each shown period (VA-01b): the approved plan lines when the revision is approved and has them,
 * else the run's active lines of the ledger.
 */
const LINES = `FROM shown s
  JOIN LATERAL (
    SELECT a."id" AS "line_id", 'approved' AS "origin", a."reason_code_id", a."impact_code_id",
           a."oee_component", a."kind", a."uom", a."quantity", a."cause_event_id"
      FROM "approved_loss_lines" a
     WHERE $6::text = 'plan' AND s."lifecycle" = 'approved' AND a."revision_id" = s."revision_id"
       AND a."tenant_id" = $1 AND a."kind"::text = ANY($7::text[])
    UNION ALL
    SELECT r."id", 'run', r."reason_code_id", r."impact_code_id", r."oee_component", r."kind", r."uom", r."quantity",
           r."cause_event_id"
      FROM "loss_lines" r
     WHERE r."run_id" = s."run_id" AND r."tenant_id" = $1 AND r."period_id" = s."period_id"
       AND r."ledger" = $6::loss_ledger AND r."state" = 'active' AND r."source" <> 'candidate_superseded'
       AND r."kind"::text = ANY($7::text[])
       AND NOT ($6::text = 'plan' AND s."lifecycle" = 'approved' AND EXISTS (
             SELECT 1 FROM "approved_loss_lines" x WHERE x."revision_id" = s."revision_id" AND x."tenant_id" = $1))
  ) l ON true`;

async function quantityCells(
  manager: EntityManager,
  scope: ReportScope,
  spec: { groupSql: string; ledger: Ledger; kinds: readonly LossTreeKind[] },
): Promise<CellRow[]> {
  return manager.query<CellRow[]>(
    `${SHOWN} SELECT ${spec.groupSql} AS "group_key", l."uom" AS "unit", sum(l."quantity")::text AS "amount",
            count(*)::int AS "lines", count(l."cause_event_id")::int AS "event_lines", 0 AS "valued", 0 AS "unvalued", 0 AS "fx_missing", 0 AS "fx_provisional",
            NULL AS "reasons"
       ${LINES}
      GROUP BY 1, 2`,
    [...params(scope), spec.ledger, spec.kinds],
  );
}

async function valueCells(
  manager: EntityManager,
  scope: ReportScope,
  spec: {
    groupSql: string;
    ledger: Ledger;
    view: string;
    kinds: readonly LossTreeKind[];
  },
): Promise<CellRow[]> {
  return manager.query<CellRow[]>(
    `${SHOWN} SELECT ${spec.groupSql} AS "group_key", v."currency" AS "unit",
            (sum(v."amount") FILTER (WHERE v."status" = 'valued'))::text AS "amount", count(*)::int AS "lines",
            count(l."cause_event_id")::int AS "event_lines",
            count(*) FILTER (WHERE v."status" = 'valued')::int AS "valued",
            count(*) FILTER (WHERE v."status" IS DISTINCT FROM 'valued')::int AS "unvalued",
            count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NULL)::int AS "fx_missing",
            count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL AND v."provisional")::int AS "fx_provisional",
            array_remove(array_agg(DISTINCT COALESCE(v."reason",
              CASE WHEN v."id" IS NULL THEN 'not_valued' WHEN v."provisional" THEN 'fx_rate_provisional' END)), NULL) AS "reasons"
       ${LINES}
       LEFT JOIN LATERAL (
         SELECT lv."id", lv."currency", lv."amount", lv."status"::text AS "status", lv."reason", lv."provisional"
           FROM "loss_line_valuations" lv
          WHERE l."origin" = 'run' AND lv."loss_line_id" = l."line_id" AND lv."view" = $8::valuation_view
         UNION ALL
         SELECT av."id", av."currency", av."amount", av."status", av."reason", av."provisional"
           FROM "approved_loss_line_valuations" av
          WHERE l."origin" = 'approved' AND av."approved_line_id" = l."line_id" AND av."view" = $8::valuation_view
       ) v ON true
      GROUP BY 1, 2`,
    [...params(scope), spec.ledger, spec.kinds, spec.view],
  );
}

export function statusOf(
  row: Pick<CellRow, 'valued' | 'unvalued' | 'fx_missing'>,
  quantity: boolean,
): LossTreeGroupView['status'] {
  if (quantity) return 'quantity';
  if (row.valued === 0) return 'unvalued';
  return row.unvalued + row.fx_missing === 0 ? 'valued' : 'mixed';
}

/** Amount of a cell: quantities always; values only when something is valued and every FX rate exists. */
export function amountOf(row: CellRow, quantity: boolean): Dec | null {
  if (quantity) return toDec(row.amount) ?? ZERO;
  if (row.valued === 0 || row.fx_missing > 0) return null;
  return toDec(row.amount) ?? ZERO;
}

async function labelsOf(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: LossTreeGroup,
  keys: string[],
): Promise<Map<string, string>> {
  // an event has no group label: the client lists the events themselves
  if (groupBy === 'event') return new Map();
  const sql = LABELS[groupBy];
  if (!sql) return new Map(keys.map((k) => [k, WORDS[k] ?? k]));
  const words = keys.flatMap(
    (k): Array<[string, string]> => (WORDS[k] ? [[k, WORDS[k]]] : []),
  );
  const ids = keys.filter((k) => !WORDS[k]);
  if (ids.length === 0) return new Map(words);
  const rows = await manager.query<Array<{ id: string; label: string }>>(sql, [
    ids,
    scope.tenantId,
  ]);
  return new Map([
    ...words,
    ...rows.map((r): [string, string] => [r.id, r.label]),
  ]);
}

export interface LossTreeRequest {
  groupBy: LossTreeGroup;
  /** resolved metric (never `value`) */
  metric: LossTreeMetric;
  ledger: Ledger;
  /** loss kinds to include; every kind of the tree when absent */
  kinds?: readonly LossTreeKind[];
}

/** The cells of the request (quantity per uom, or one valuation view per currency) from SQL. */
export async function lossTreeCells(
  manager: EntityManager,
  scope: ReportScope,
  request: LossTreeRequest,
): Promise<{ rows: CellRow[]; labels: Map<string, string> }> {
  const groupSql = GROUP_SQL[request.groupBy];
  const view = LOSS_TREE_METRICS[request.metric];
  const kinds = request.kinds?.length ? request.kinds : LOSS_TREE_KINDS;
  const spec = { groupSql, ledger: request.ledger, kinds };
  const rows = view
    ? await valueCells(manager, scope, { ...spec, view })
    : await quantityCells(manager, scope, spec);
  const keys = [
    ...new Set(rows.flatMap((r) => (r.group_key ? [r.group_key] : []))),
  ];
  return {
    rows,
    labels: await labelsOf(manager, scope, request.groupBy, keys),
  };
}

export type LossTreeCell = CellRow;
