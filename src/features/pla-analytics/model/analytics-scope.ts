import type {
  ActualsQualityQuery,
  LossTreeQuery,
  ReconciliationStatusQuery,
  ReconciliationTrendQuery,
  ScopeWaterfallQuery,
} from '@/api/v2/queries/pla-analytics';
import type { DowntimeReportQuery, ExportRequest, OeeReportQuery, ReportQueryBase } from '@/api/v2/queries/reports';
import type { QueryOf } from '@/api/v2/schema-types';
import type { LedgerKind } from '@/api/v2/types/period-overview';
import type { LossTreeGroupBy, LossTreeMetric, TrendGroup } from '@/api/v2/types/pla-analytics';
import { DEFAULT_PRESET, presetWindow } from '@/features/downtime-analysis/model/downtime-filters';

export const PLA_TABS = ['waterfall', 'loss-tree', 'trends', 'reconciliation', 'quality', 'repeat-causes', 'opportunities', 'oee'] as const;
export type PlaTab = (typeof PLA_TABS)[number];

export const TREND_GROUPS: readonly TrendGroup[] = ['shift', 'day', 'week', 'month'];
export const LOSS_GROUPS: readonly LossTreeGroupBy[] = ['reason', 'impact', 'oee', 'kind', 'unit'];
export const LOSS_METRICS: readonly LossTreeMetric[] = ['qty', 'margin', 'standard_cost', 'operational_cost'];
export const VALUE_METRICS: readonly LossTreeMetric[] = ['margin', 'standard_cost', 'operational_cost'];
export type OeePolicy = 'operational' | 'reconciled';

/**
 * Everything the PLA Analytics page is filtered by (plan 3.6 `AnalyticsScope`): units, the UTC window
 * (periods starting in it, grouped by the plant's operational date), ledger, approved-only and the
 * view choices. It lives in the URL, so a view can be shared and every widget reads the same scope (T24).
 */
export interface AnalyticsScope {
  unitIds: string[];
  from: string;
  to: string;
  windowLabel: string;
  approvedOnly: boolean;
  ledger: LedgerKind;
  policy: OeePolicy;
  tab: PlaTab;
  trendBy: TrendGroup;
  lossGroupBy: LossTreeGroupBy;
  lossMetric: LossTreeMetric;
  valueMetric: LossTreeMetric;
}

const oneOf = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));

/** Scope from the URL; a missing or broken window falls back to the last 7 days ending `now`. */
export function parseScope(params: URLSearchParams, now: number): AnalyticsScope {
  const from = params.get('from');
  const to = params.get('to');
  const hasWindow = isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to);
  return {
    unitIds: (params.get('units') ?? '').split(',').filter(Boolean).sort(),
    ...(hasWindow ? { from, to } : presetWindow(DEFAULT_PRESET.hours, now)),
    windowLabel: hasWindow ? params.get('window') ?? 'Custom window' : DEFAULT_PRESET.label,
    approvedOnly: params.get('approved') === '1',
    ledger: oneOf(['plan', 'capacity'] as const, params.get('ledger'), 'plan'),
    policy: oneOf(['operational', 'reconciled'] as const, params.get('policy'), 'operational'),
    tab: oneOf(PLA_TABS, params.get('tab'), 'waterfall'),
    trendBy: oneOf(TREND_GROUPS, params.get('trend'), 'day'),
    lossGroupBy: oneOf(LOSS_GROUPS, params.get('lossBy'), 'reason'),
    lossMetric: oneOf(LOSS_METRICS, params.get('metric'), 'qty'),
    valueMetric: oneOf(VALUE_METRICS, params.get('value'), 'margin'),
  };
}

const DEFAULTS: Partial<Record<keyof AnalyticsScope, string>> = {
  ledger: 'plan',
  policy: 'operational',
  tab: 'waterfall',
  trendBy: 'day',
  lossGroupBy: 'reason',
  lossMetric: 'qty',
  valueMetric: 'margin',
};
const PARAM: Partial<Record<keyof AnalyticsScope, string>> = {
  ledger: 'ledger',
  policy: 'policy',
  tab: 'tab',
  trendBy: 'trend',
  lossGroupBy: 'lossBy',
  lossMetric: 'metric',
  valueMetric: 'value',
};

/** URL form of the scope (defaults left out, so equal scopes give equal URLs). */
export function scopeToParams(scope: AnalyticsScope): URLSearchParams {
  const params = new URLSearchParams({ from: scope.from, to: scope.to, window: scope.windowLabel });
  if (scope.unitIds.length > 0) params.set('units', [...scope.unitIds].sort().join(','));
  if (scope.approvedOnly) params.set('approved', '1');
  for (const [key, name] of Object.entries(PARAM) as Array<[keyof AnalyticsScope, string]>) {
    const value = String(scope[key]);
    if (value !== DEFAULTS[key]) params.set(name, value);
  }
  return params;
}

/** The window, units and run selection every widget of the page sends (T24: one snapshot). */
export function scopeBase(scope: AnalyticsScope): ReportQueryBase {
  const base: ReportQueryBase = { from: scope.from, to: scope.to };
  if (scope.unitIds.length > 0) base.unitIds = [...scope.unitIds].sort();
  if (scope.approvedOnly) base.approvedOnly = true;
  return base;
}

export const waterfallQuery = (scope: AnalyticsScope, ledger = scope.ledger): ScopeWaterfallQuery => ({ ...scopeBase(scope), ledger });

export function lossTreeQuery(scope: AnalyticsScope, options: { metric?: LossTreeMetric; groupBy?: LossTreeGroupBy; limit?: number } = {}): LossTreeQuery {
  const query: LossTreeQuery = {
    ...scopeBase(scope),
    groupBy: options.groupBy ?? scope.lossGroupBy,
    metric: options.metric ?? scope.lossMetric,
    ledger: scope.ledger,
  };
  if (options.limit) query.limit = options.limit;
  return query;
}

export const trendQuery = (scope: AnalyticsScope): ReconciliationTrendQuery => ({ ...scopeBase(scope), groupBy: scope.trendBy });
export const statusQuery = (scope: AnalyticsScope): ReconciliationStatusQuery => scopeBase(scope);
export const qualityQuery = (scope: AnalyticsScope): ActualsQualityQuery => scopeBase(scope);

export function oeeQuery(scope: AnalyticsScope, groupBy: NonNullable<OeeReportQuery['groupBy']>, policy: OeePolicy = scope.policy): OeeReportQuery & ReportQueryBase {
  return { ...scopeBase(scope), groupBy, policy };
}

/** Loss value per unit, contribution margin of the scope's ledger (2.6 report). */
export function lossValueQuery(scope: AnalyticsScope): QueryOf<'/api/v2/reports/loss-value', 'get'> & ReportQueryBase {
  return { ...scopeBase(scope), groupBy: 'unit', metric: 'margin', ledger: scope.ledger };
}

/** Repeat causes: stop occurrences per reason or asset, with the number of periods each recurs in. */
export function repeatQuery(scope: AnalyticsScope, groupBy: 'reason' | 'asset'): DowntimeReportQuery & ReportQueryBase {
  return { ...scopeBase(scope), groupBy, metric: 'frequency' };
}

/**
 * The export of the shown scope (2.9): the same window and units, approved content only (`published`).
 * Null while the page shows provisional figures — an export never contains drafts.
 */
export function exportRequestOf(scope: AnalyticsScope, reportType: ExportRequest['reportType'], isProvisional: boolean): ExportRequest | null {
  if (!scope.approvedOnly || isProvisional) return null;
  const request: ExportRequest = { reportType, format: 'csv', revisionSelector: 'published', from: scope.from, to: scope.to };
  if (scope.unitIds.length > 0) request.unitIds = [...scope.unitIds].sort();
  return request;
}
