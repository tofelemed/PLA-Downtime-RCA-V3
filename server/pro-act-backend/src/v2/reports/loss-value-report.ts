import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { LOSS_VALUE_KINDS } from '../../domain/valuation/reconciled-valuation';
import {
  TotalsView,
  VIEW_LABELS,
} from '../../domain/valuation/valuation.types';
import { AnalyticsResponse } from '../common/response';
import { reportEnvelope } from './kpi-reports-v2.view';
import {
  LOSS_VALUE_METRICS,
  LossValueGroup,
  LossValueReportQueryDto,
} from './loss-value-v2.dto';
import { params, periodStats, SHOWN } from './report-sql';
import { ReportScope } from './report-scope';

export interface CurrencyValueView {
  currency: string;
  /** decimal string; null when nothing is valued or an approved FX rate is missing (never estimated) */
  amount: string | null;
  /** Σ of what was priced in this currency itself (no conversion) */
  nativeAmount: string;
  status: 'valued' | 'unvalued' | 'mixed';
  reasons: string[];
}

export interface LossValueGroupView {
  key: string;
  currencies: CurrencyValueView[];
  /** quantities without a price, per unit of measure (never converted or summed across units) */
  unvalued: Array<{ uom: string | null; quantity: string; seconds: string }>;
}

export interface LossValueReportView {
  metric: string;
  view: TotalsView;
  label: string;
  ledger: 'plan' | 'capacity';
  groupBy: LossValueGroup;
  basis: string;
  groups: LossValueGroupView[];
  total: LossValueGroupView;
  calculationRunIds: string[];
}

interface CellRow {
  group_key: string;
  currency: string;
  uom: string | null;
  amount: string | null;
  native: string;
  valued: number;
  unvalued: number;
  fx_missing: number;
  unvalued_quantity: string;
  unvalued_seconds: string;
  /** the `reasons` arrays of the contributing totals */
  reasons: string[][] | null;
}

const GROUPS: Readonly<Record<LossValueGroup, string>> = {
  kind: `t."kind"::text`,
  unit: `s."unit_id"::text`,
  day: `s."local_date"::text`,
  month: `to_char(s."local_date", 'YYYY-MM')`,
};

const BASIS =
  'calculation-run valuation of the shown run (approved revision, else the open draft); reconciliation edits are valued in the approval snapshot';

async function cells(
  manager: EntityManager,
  scope: ReportScope,
  spec: {
    groupSql: string;
    view: TotalsView;
    ledger: string;
    kinds: string[] | null;
  },
): Promise<CellRow[]> {
  return manager.query<CellRow[]>(
    `${SHOWN} SELECT ${spec.groupSql} AS "group_key", t."currency", t."uom",
            sum(t."amount")::text AS "amount", sum(t."native_amount")::text AS "native",
            sum(t."valued_lines")::int AS "valued", sum(t."unvalued_lines")::int AS "unvalued",
            sum(t."fx_missing_lines")::int AS "fx_missing",
            sum(t."unvalued_quantity")::text AS "unvalued_quantity", sum(t."unvalued_seconds")::text AS "unvalued_seconds",
            jsonb_agg(t."reasons") AS "reasons"
       FROM shown s
       JOIN "period_valuation_totals" t ON t."run_id" = s."run_id" AND t."tenant_id" = $1
        AND t."view" = $6::valuation_totals_view AND t."ledger" = $7::loss_ledger
        AND ($8::text[] IS NULL OR t."kind"::text = ANY($8::text[]))
      GROUP BY 1, t."currency", t."uom" ORDER BY 1, t."currency", t."uom"`,
    [...params(scope), spec.view, spec.ledger, spec.kinds],
  );
}

const sum = (values: Array<string | null>) =>
  values.reduce((acc, v) => acc.plus(toDec(v) ?? 0), new Dec(0));

function currencyView(
  currency: string,
  rows: readonly CellRow[],
): CurrencyValueView {
  const valued = rows.reduce((n, r) => n + r.valued, 0);
  const missing = rows.reduce((n, r) => n + r.unvalued + r.fx_missing, 0);
  const fxMissing = rows.some((r) => r.fx_missing > 0);
  return {
    currency,
    amount:
      valued === 0 || fxMissing
        ? null
        : formatDec(sum(rows.map((r) => r.amount))),
    nativeAmount: formatDec(sum(rows.map((r) => r.native))),
    status: valued === 0 ? 'unvalued' : missing === 0 ? 'valued' : 'mixed',
    reasons: [...new Set(rows.flatMap((r) => (r.reasons ?? []).flat()))].sort(),
  };
}

function groupView(key: string, rows: readonly CellRow[]): LossValueGroupView {
  const currencies = [...new Set(rows.map((r) => r.currency))].sort();
  const first = currencies[0];
  const uoms = [
    ...new Set(rows.filter((r) => r.currency === first).map((r) => r.uom)),
  ];
  return {
    key,
    currencies: currencies.map((c) =>
      currencyView(
        c,
        rows.filter((r) => r.currency === c),
      ),
    ),
    unvalued: uoms.map((uom) => {
      const own = rows.filter((r) => r.currency === first && r.uom === uom);
      return {
        uom,
        quantity: formatDec(sum(own.map((r) => r.unvalued_quantity))),
        seconds: formatDec(sum(own.map((r) => r.unvalued_seconds))),
      };
    }),
  };
}

function grouped(rows: readonly CellRow[]): LossValueGroupView[] {
  const keys = [...new Set(rows.map((r) => r.group_key))];
  return keys.map((key) =>
    groupView(
      key,
      rows.filter((r) => r.group_key === key),
    ),
  );
}

/** The requested view, ledger and grouping with their defaults (margin, plan ledger, by kind). */
function requestOf(query: LossValueReportQueryDto) {
  const metric = query.metric ?? 'margin';
  return {
    metric,
    view: LOSS_VALUE_METRICS[metric],
    ledger: query.ledger ?? 'plan',
    groupBy: query.groupBy ?? 'kind',
  };
}

/**
 * `GET /reports/loss-value` (plan 2.6 step 5): the stored valuation totals of the shown runs summed in SQL
 * per group, reporting currency and unit of measure — one view at a time (VAL02), amounts null when any
 * contributing line lacks an approved FX rate (T45), unvalued quantities per uom (T38). Read-only.
 */
export async function lossValueReport(
  manager: EntityManager,
  scope: ReportScope,
  query: LossValueReportQueryDto,
): Promise<AnalyticsResponse<LossValueReportView>> {
  const request = requestOf(query);
  const { view, ledger, groupBy } = request;
  const lossKinds = groupBy === 'kind' ? null : [...LOSS_VALUE_KINDS];
  const spec = { view, ledger, kinds: lossKinds };
  const rows = await cells(manager, scope, {
    ...spec,
    groupSql: GROUPS[groupBy],
  });
  const totalRows = await cells(manager, scope, {
    ...spec,
    kinds: [...LOSS_VALUE_KINDS],
    groupSql: `'total'`,
  });
  const stats = await periodStats(manager, scope);
  const total = groupView('total', totalRows);
  const data: LossValueReportView = {
    ...request,
    label: VIEW_LABELS[view],
    basis: BASIS,
    groups: grouped(rows),
    total,
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await valuationPolicyVersions(manager, stats.runIds),
    provisionalData: total.currencies.some((c) => c.status !== 'valued'),
    notes: [...new Set(total.currencies.flatMap((c) => c.reasons))],
  });
}

async function valuationPolicyVersions(
  manager: EntityManager,
  runIds: readonly string[],
): Promise<string[]> {
  if (runIds.length === 0) return [];
  const rows = await manager.query<Array<{ ref: string }>>(
    `SELECT DISTINCT (pv->>'kind') || '@' || (pv->>'version') AS "ref"
       FROM "calculation_runs" r, jsonb_array_elements(r."policy_versions") pv
      WHERE r."id" = ANY($1::uuid[]) AND pv->>'kind' = 'valuation_basis' ORDER BY 1`,
    [runIds],
  );
  return rows.map((r) => r.ref);
}
