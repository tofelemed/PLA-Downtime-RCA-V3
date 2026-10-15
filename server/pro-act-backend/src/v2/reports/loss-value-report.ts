import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { LOSS_VALUE_KINDS } from '../../domain/valuation/reconciled-valuation';
import {
  TotalsView,
  VIEW_LABELS,
} from '../../domain/valuation/valuation.types';
import { invalid } from '../../profiles/profile-errors';
import { AnalyticsResponse } from '../common/response';
import { ComponentGroupView, componentGroups } from './loss-value-components';
import { reportEnvelope } from './kpi-reports-v2.view';
import {
  defaultLossValueMetric,
  valuationStatusOf,
} from './loss-value-default';
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
  /** SME V7: some amount was converted with an authorised provisional FX rate (reason fx_rate_provisional) */
  fxProvisional: boolean;
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
  /** SME V8: true when the view is the policy's default management view (no metric asked) */
  defaultView: boolean;
  /** SME V8 / R12: `approved` only when every shown period is approved, else provisional figures */
  valuationStatus: 'approved' | 'provisional';
  approvedPeriods: number;
  periods: number;
  ledger: 'plan' | 'capacity';
  groupBy: LossValueGroup;
  basis: string;
  groups: LossValueGroupView[];
  total: LossValueGroupView;
  /** VA-04, `groupBy=component` only: the economic view by component (else null; `groups` is then empty) */
  components: ComponentGroupView[] | null;
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
  fx_provisional: number;
  unvalued_quantity: string;
  unvalued_seconds: string;
  /** the `reasons` arrays of the contributing totals */
  reasons: string[][] | null;
}

const GROUPS: Readonly<Record<Exclude<LossValueGroup, 'component'>, string>> = {
  kind: `t."kind"::text`,
  unit: `s."unit_id"::text`,
  day: `s."local_date"::text`,
  month: `to_char(s."local_date", 'YYYY-MM')`,
};

const BASIS =
  'plan ledger of an approved revision: the reconciled valuation stored at approval; otherwise the calculation-run valuation of the shown run (open draft, or capacity ledger)';

/** Valuation columns of one shown period: the approved reconciled totals (plan ledger), else the run's (VA-01). */
const VALUATION_SOURCE = `JOIN LATERAL (
         SELECT a."kind", a."view", a."currency", a."uom", a."amount", a."native_amount", a."valued_lines",
                a."unvalued_lines", a."fx_missing_lines", a."fx_provisional_lines", a."unvalued_quantity", a."unvalued_seconds", a."reasons"
           FROM "approved_valuation_totals" a
          WHERE $7::text = 'plan' AND s."lifecycle" = 'approved' AND a."revision_id" = s."revision_id"
            AND a."tenant_id" = $1
         UNION ALL
         SELECT r."kind", r."view", r."currency", r."uom", r."amount", r."native_amount", r."valued_lines",
                r."unvalued_lines", r."fx_missing_lines", r."fx_provisional_lines", r."unvalued_quantity", r."unvalued_seconds", r."reasons"
           FROM "period_valuation_totals" r
          WHERE r."run_id" = s."run_id" AND r."tenant_id" = $1 AND r."ledger" = $7::loss_ledger
            AND NOT ($7::text = 'plan' AND s."lifecycle" = 'approved' AND EXISTS (
                  SELECT 1 FROM "approved_valuation_totals" x
                   WHERE x."revision_id" = s."revision_id" AND x."tenant_id" = $1))
       ) t ON true`;

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
            sum(t."fx_missing_lines")::int AS "fx_missing", sum(t."fx_provisional_lines")::int AS "fx_provisional",
            sum(t."unvalued_quantity")::text AS "unvalued_quantity", sum(t."unvalued_seconds")::text AS "unvalued_seconds",
            jsonb_agg(t."reasons") AS "reasons"
       FROM shown s
       ${VALUATION_SOURCE}
      WHERE t."view" = $6::valuation_totals_view
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
    fxProvisional: rows.some((r) => r.fx_provisional > 0),
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

/** The requested view, ledger and grouping with their defaults (policy default view, plan ledger, by kind). */
async function requestOf(
  manager: EntityManager,
  scope: ReportScope,
  query: LossValueReportQueryDto,
) {
  const metric =
    query.metric ?? (await defaultLossValueMetric(manager, scope.tenantId));
  return {
    metric,
    view: LOSS_VALUE_METRICS[metric],
    defaultView: query.metric === undefined,
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
  const request = await requestOf(manager, scope, query);
  const { view, ledger, groupBy } = request;
  const byComponent = groupBy === 'component';
  if (byComponent && view !== 'economic_impact') {
    throw invalid(
      'BREAKDOWN_NEEDS_ECONOMIC_VIEW',
      'groupBy=component breaks down the economic_impact view only',
    );
  }
  const lossKinds = groupBy === 'kind' ? null : [...LOSS_VALUE_KINDS];
  const spec = { view, ledger, kinds: lossKinds };
  const rows = byComponent
    ? []
    : await cells(manager, scope, { ...spec, groupSql: GROUPS[groupBy] });
  const totalRows = await cells(manager, scope, {
    ...spec,
    kinds: [...LOSS_VALUE_KINDS],
    groupSql: `'total'`,
  });
  const components = byComponent
    ? await componentGroups(manager, scope, {
        ledger,
        kinds: [...LOSS_VALUE_KINDS],
      })
    : null;
  const stats = await periodStats(manager, scope);
  const total = groupView('total', totalRows);
  const data: LossValueReportView = {
    ...request,
    label: VIEW_LABELS[view],
    valuationStatus: valuationStatusOf(stats),
    approvedPeriods: stats.approved,
    periods: stats.periods,
    basis: BASIS,
    groups: grouped(rows),
    total,
    components,
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await valuationPolicyVersions(manager, stats.runIds),
    provisionalData: total.currencies.some(
      (c) => c.status !== 'valued' || c.fxProvisional,
    ),
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
