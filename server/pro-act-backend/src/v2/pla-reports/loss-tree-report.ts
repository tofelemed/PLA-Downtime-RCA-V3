import { EntityManager } from 'typeorm';
import { Dec, toDec, ZERO } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';
import { params, SHOWN } from '../reports/report-sql';
import {
  LOSS_TREE_METRICS,
  LossTreeGroup,
  LossTreeMetric,
  Ledger,
} from './pla-reports.dto';

/** Loss kinds of the tree: what lowers output (gains, residuals and tolerance adjustments stay apart). */
export const LOSS_TREE_KINDS = [
  'schedule_exclusion',
  'availability',
  'performance',
  'quality',
  'bridge',
  'unaccounted_classified',
];

export interface LossTreeGroupView {
  /** reason / impact code id, OEE component, kind or unit id; null = not coded */
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
  status: 'valued' | 'unvalued' | 'mixed' | 'quantity';
  reasons: string[];
}

export interface LossTreeTotalView {
  unit: string | null;
  amount: string | null;
  lines: number;
  groups: number;
  status: LossTreeGroupView['status'];
  reasons: string[];
}

export interface LossTreeView {
  groupBy: LossTreeGroup;
  metric: LossTreeMetric;
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
  valued: number;
  unvalued: number;
  fx_missing: number;
  reasons: string[] | null;
}

const GROUP_SQL: Readonly<Record<LossTreeGroup, string>> = {
  reason: `l."reason_code_id"::text`,
  impact: `l."impact_code_id"::text`,
  oee: `l."oee_component"`,
  kind: `l."kind"::text`,
  unit: `s."unit_id"::text`,
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
  bridge: 'Bridge',
  unaccounted_classified: 'Unaccounted (classified)',
};

export const LOSS_TREE_BASIS =
  'loss lines of the shown calculation run (approved revision, else the open draft); reconciliation ' +
  'decisions of an open draft (manual lines, rejections) are in the waterfall, not in this tree';

const LINES = `FROM shown s
  JOIN "loss_lines" l ON l."run_id" = s."run_id" AND l."tenant_id" = $1 AND l."period_id" = s."period_id"
   AND l."ledger" = $6::loss_ledger AND l."state" = 'active' AND l."source" <> 'candidate_superseded'
   AND l."kind"::text = ANY($7::text[])`;

async function quantityCells(
  manager: EntityManager,
  scope: ReportScope,
  groupSql: string,
  ledger: Ledger,
): Promise<CellRow[]> {
  return manager.query<CellRow[]>(
    `${SHOWN} SELECT ${groupSql} AS "group_key", l."uom" AS "unit", sum(l."quantity")::text AS "amount",
            count(*)::int AS "lines", 0 AS "valued", 0 AS "unvalued", 0 AS "fx_missing", NULL AS "reasons"
       ${LINES}
      GROUP BY 1, 2`,
    [...params(scope), ledger, LOSS_TREE_KINDS],
  );
}

async function valueCells(
  manager: EntityManager,
  scope: ReportScope,
  spec: { groupSql: string; ledger: Ledger; view: string },
): Promise<CellRow[]> {
  return manager.query<CellRow[]>(
    `${SHOWN} SELECT ${spec.groupSql} AS "group_key", v."currency" AS "unit",
            (sum(v."amount") FILTER (WHERE v."status" = 'valued'))::text AS "amount", count(*)::int AS "lines",
            count(*) FILTER (WHERE v."status" = 'valued')::int AS "valued",
            count(*) FILTER (WHERE v."status" IS DISTINCT FROM 'valued')::int AS "unvalued",
            count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NULL)::int AS "fx_missing",
            array_remove(array_agg(DISTINCT COALESCE(v."reason", CASE WHEN v."id" IS NULL THEN 'not_valued' END)), NULL) AS "reasons"
       ${LINES}
       LEFT JOIN "loss_line_valuations" v ON v."loss_line_id" = l."id" AND v."view" = $8::valuation_view
      GROUP BY 1, 2`,
    [...params(scope), spec.ledger, LOSS_TREE_KINDS, spec.view],
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
  const sql = LABELS[groupBy];
  if (!sql) return new Map(keys.map((k) => [k, WORDS[k] ?? k]));
  if (keys.length === 0) return new Map();
  const rows = await manager.query<Array<{ id: string; label: string }>>(sql, [
    keys,
    scope.tenantId,
  ]);
  return new Map(rows.map((r) => [r.id, r.label]));
}

export interface LossTreeRequest {
  groupBy: LossTreeGroup;
  metric: LossTreeMetric;
  ledger: Ledger;
}

/** The cells of the request (quantity per uom, or one valuation view per currency) from SQL. */
export async function lossTreeCells(
  manager: EntityManager,
  scope: ReportScope,
  request: LossTreeRequest,
): Promise<{ rows: CellRow[]; labels: Map<string, string> }> {
  const groupSql = GROUP_SQL[request.groupBy];
  const view = LOSS_TREE_METRICS[request.metric];
  const rows = view
    ? await valueCells(manager, scope, {
        groupSql,
        ledger: request.ledger,
        view,
      })
    : await quantityCells(manager, scope, groupSql, request.ledger);
  const keys = [
    ...new Set(rows.flatMap((r) => (r.group_key ? [r.group_key] : []))),
  ];
  return {
    rows,
    labels: await labelsOf(manager, scope, request.groupBy, keys),
  };
}

export type LossTreeCell = CellRow;
