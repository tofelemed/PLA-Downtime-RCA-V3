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
import type { LossTreeGroupBy, LossTreeMetricParam, TrendGroup } from '@/api/v2/types/pla-analytics';
import { HOUR_MS, rollingWindow } from '@/api/v2/queries/time-window';
import { DEFAULT_PRESET } from '@/features/downtime-analysis/model/downtime-filters';
import { relativeWindowOf } from '@/features/event-hub/model/relative-window';

/** Five views (UI guidelines §2: at most 5 tabs); the former eight are sections inside them. */
export const PLA_TABS = ['waterfall', 'losses', 'trends', 'reconciliation', 'oee'] as const;
export type PlaTab = (typeof PLA_TABS)[number];

/** Links written before the regrouping (`?tab=loss-tree`, `quality`, …) open the view that now holds them. */
const LEGACY_TABS: Readonly<Record<string, PlaTab>> = {
  'loss-tree': 'losses',
  opportunities: 'losses',
  'repeat-causes': 'losses',
  quality: 'reconciliation',
};

export const LOSS_EVENT_TYPES = ['all', 'downtime', 'slowdown', 'quality_loss'] as const;
export type LossEventType = (typeof LOSS_EVENT_TYPES)[number];
/** OEE component of the listed loss events (a waterfall bar or loss-tree row drills into it); `all` = no filter. */
export const LOSS_EVENT_OEE = ['all', 'availability', 'performance', 'quality'] as const;
export type LossEventOee = (typeof LOSS_EVENT_OEE)[number];

/** A preset window ending now, with minute-stable bounds (cache keys repeat within the minute). */
export const presetWindowOf = (hours: number, now: number = Date.now()) => rollingWindow(hours * HOUR_MS, now);

export const TREND_GROUPS: readonly TrendGroup[] = ['shift', 'day', 'week', 'month'];
export const LOSS_GROUPS: readonly LossTreeGroupBy[] = ['reason', 'impact', 'oee', 'kind', 'unit'];
/** SME V8: `value` opens on the valuation policy's default view (economic impact from policy version 3). */
export const LOSS_METRICS: readonly LossTreeMetricParam[] = ['qty', 'value', 'economic_impact', 'margin', 'standard_cost', 'operational_cost'];
export const VALUE_METRICS: readonly LossTreeMetricParam[] = ['value', 'economic_impact', 'margin', 'standard_cost', 'operational_cost'];
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
  lossMetric: LossTreeMetricParam;
  valueMetric: LossTreeMetricParam;
  /** physical type of the loss events listed under Losses */
  eventType: LossEventType;
  /** OEE component of the loss events listed under Losses (server filter `oeeComponents`) */
  eventOee: LossEventOee;
}

const oneOf = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));

/** Page-level defaults: management reports show approved figures unless the user chooses otherwise (SME R12). */
export interface ScopeDefaults {
  approvedByDefault?: boolean;
}

/** `approved=1` / `approved=0` in the URL, else the page default. */
function approvedOf(params: URLSearchParams, defaults: ScopeDefaults): boolean {
  const value = params.get('approved');
  if (value === '1') return true;
  if (value === '0') return false;
  return defaults.approvedByDefault ?? false;
}

/**
 * The window of the URL: explicit bounds, else a rolling key of the Downtime / Event Hub links
 * (`window=24h`, or its label) resolved at `now`, else the last 7 days ending `now`.
 */
function windowOf(params: URLSearchParams, now: number): Pick<AnalyticsScope, 'from' | 'to' | 'windowLabel'> {
  const from = params.get('from');
  const to = params.get('to');
  const name = params.get('window');
  const rolling = relativeWindowOf(name);
  if (isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to)) return { from, to, windowLabel: rolling?.label ?? name ?? 'Custom window' };
  const preset = rolling ?? DEFAULT_PRESET;
  return { ...presetWindowOf(preset.hours, now), windowLabel: preset.label };
}

/** Scope from the URL; a missing or broken window falls back to the last 7 days ending `now`. */
export function parseScope(params: URLSearchParams, now: number, defaults: ScopeDefaults = {}): AnalyticsScope {
  return {
    unitIds: (params.get('units') ?? '').split(',').filter(Boolean).sort(),
    ...windowOf(params, now),
    approvedOnly: approvedOf(params, defaults),
    ledger: oneOf(['plan', 'capacity'] as const, params.get('ledger'), 'plan'),
    policy: oneOf(['operational', 'reconciled'] as const, params.get('policy'), 'operational'),
    tab: oneOf(PLA_TABS, LEGACY_TABS[params.get('tab') ?? ''] ?? params.get('tab'), 'waterfall'),
    trendBy: oneOf(TREND_GROUPS, params.get('trend'), 'day'),
    lossGroupBy: oneOf(LOSS_GROUPS, params.get('lossBy'), 'reason'),
    lossMetric: oneOf(LOSS_METRICS, params.get('metric'), 'qty'),
    valueMetric: oneOf(VALUE_METRICS, params.get('value'), 'value'),
    eventType: oneOf(LOSS_EVENT_TYPES, params.get('events'), 'all'),
    eventOee: oneOf(LOSS_EVENT_OEE, params.get('oee'), 'all'),
  };
}

const DEFAULTS: Partial<Record<keyof AnalyticsScope, string>> = {
  ledger: 'plan',
  policy: 'operational',
  tab: 'waterfall',
  trendBy: 'day',
  lossGroupBy: 'reason',
  lossMetric: 'qty',
  valueMetric: 'value',
  eventType: 'all',
  eventOee: 'all',
};
const PARAM: Partial<Record<keyof AnalyticsScope, string>> = {
  ledger: 'ledger',
  policy: 'policy',
  tab: 'tab',
  trendBy: 'trend',
  lossGroupBy: 'lossBy',
  lossMetric: 'metric',
  valueMetric: 'value',
  eventType: 'events',
  eventOee: 'oee',
};

/** Every URL parameter the scope owns; other parameters of the page (e.g. the Reports view) are kept. */
export const SCOPE_PARAMS: ReadonlySet<string> = new Set(['from', 'to', 'window', 'units', 'approved', ...Object.values(PARAM).filter((name): name is string => name !== undefined)]);

/** URL form of the scope (defaults left out, so equal scopes give equal URLs). */
export function scopeToParams(scope: AnalyticsScope, defaults: ScopeDefaults = {}): URLSearchParams {
  const params = new URLSearchParams({ from: scope.from, to: scope.to, window: scope.windowLabel });
  if (scope.unitIds.length > 0) params.set('units', [...scope.unitIds].sort().join(','));
  if (scope.approvedOnly !== (defaults.approvedByDefault ?? false)) params.set('approved', scope.approvedOnly ? '1' : '0');
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

export function lossTreeQuery(scope: AnalyticsScope, options: { metric?: LossTreeMetricParam; groupBy?: LossTreeGroupBy; limit?: number } = {}): LossTreeQuery {
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

/** VA-04: the economic view of the scope by component (server breakdown; nothing summed in the browser). */
export function lossValueComponentsQuery(scope: AnalyticsScope): QueryOf<'/api/v2/reports/loss-value', 'get'> & ReportQueryBase {
  return { ...scopeBase(scope), groupBy: 'component', metric: 'economic_impact', ledger: scope.ledger };
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

const LOSS_PHYSICAL_TYPES = ['downtime', 'slowdown', 'quality_loss'] as const;

/**
 * The loss events of the scope (Losses → Events): stops, slowdowns and quality losses overlapping the
 * window on the scope's units, newest first, never superseded or retracted rows — a server keyset list.
 */
export function lossEventsQuery(scope: AnalyticsScope): QueryOf<'/api/v2/production-events', 'get'> {
  const query: QueryOf<'/api/v2/production-events', 'get'> = {
    from: scope.from,
    to: scope.to,
    sort: '-startTime',
    physicalTypes: scope.eventType === 'all' ? [...LOSS_PHYSICAL_TYPES] : [scope.eventType],
    physicalStates: ['open', 'closed'],
  };
  if (scope.unitIds.length > 0) query.unitIds = [...scope.unitIds].sort();
  if (scope.eventOee !== 'all') query.oeeComponents = [scope.eventOee];
  return query;
}
