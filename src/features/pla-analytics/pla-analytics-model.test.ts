import { describe, expect, it } from 'vitest';
import { reportKey } from '@/api/v2/queries/reports';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import {
  exportRequestOf,
  lossTreeQuery,
  oeeQuery,
  parseScope,
  qualityQuery,
  repeatQuery,
  scopeBase,
  scopeToParams,
  statusQuery,
  trendQuery,
  waterfallQuery,
} from './model/analytics-scope';
import { ageText, amountText, kpiText, notValuedReason, shownMetricLabel } from './model/display';
import { oeeRows, residualRows, trendUnits } from './model/series';
import { bucketLabel } from './model/buckets';
import { dashboardScope, presetKeyOf } from './model/dashboard-scope';
import { lossEventsQuery, SCOPE_PARAMS } from './model/analytics-scope';

const URL_TEXT = 'from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u2,u1&approved=1&ledger=capacity&tab=trends&trend=week';
const scope = () => parseScope(new URLSearchParams(URL_TEXT), 0);

const kpi = (over: Partial<KpiAggregateView>): KpiAggregateView => ({
  metric: 'oee', numerator: null, denominator: null, value: null, unit: 'ratio', quality: 'unavailable', reason: null, rows: 1, missing: 0, ...over,
});

describe('PLA analytics scope (plan 3.6, T24)', () => {
  it('reads the URL and writes it back without defaults (equal scopes give equal URLs)', () => {
    const parsed = scope();
    expect(parsed).toMatchObject({ unitIds: ['u1', 'u2'], approvedOnly: true, ledger: 'capacity', tab: 'trends', trendBy: 'week', lossGroupBy: 'reason', lossMetric: 'qty' });
    expect(parseScope(scopeToParams(parsed), 0)).toEqual(parsed);
    // SME R12: management reports default to approved figures; an explicit choice in the URL wins
    const plain = new URLSearchParams('from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z');
    expect(parseScope(plain, 0).approvedOnly).toBe(false);
    expect(parseScope(plain, 0, { approvedByDefault: true }).approvedOnly).toBe(true);
    const provisional = { ...parseScope(plain, 0, { approvedByDefault: true }), approvedOnly: false };
    const params = scopeToParams(provisional, { approvedByDefault: true });
    expect(params.get('approved')).toBe('0');
    expect(parseScope(params, 0, { approvedByDefault: true }).approvedOnly).toBe(false);
    expect(scopeToParams({ ...provisional, approvedOnly: true }, { approvedByDefault: true }).has('approved')).toBe(false);
    expect(scopeToParams(parsed).has('metric')).toBe(false);
  });

  it('falls back to the last 7 days ending at the instant given, never a moving window', () => {
    const fallback = parseScope(new URLSearchParams('from=bad'), Date.parse('2026-10-10T00:00:00Z'));
    expect(fallback).toMatchObject({ from: '2026-10-03T00:00:00.000Z', to: '2026-10-10T00:00:00.000Z', windowLabel: 'Last 7 days' });
  });

  it('U2c: a rolling window key of a Downtime / Event Hub link (window=24h) keeps its length instead of the 7-day default', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    expect(parseScope(new URLSearchParams('window=24h&units=u1'), now)).toMatchObject({ from: '2026-10-09T00:00:00.000Z', to: '2026-10-10T00:00:00.000Z', windowLabel: 'Last 24 h', unitIds: ['u1'] });
    expect(parseScope(new URLSearchParams('window=30d'), now)).toMatchObject({ from: '2026-09-10T00:00:00.000Z', windowLabel: 'Last 30 days' });
    expect(parseScope(new URLSearchParams('window=Last 8 h'), now)).toMatchObject({ from: '2026-10-09T16:00:00.000Z', windowLabel: 'Last 8 h' });
    expect(parseScope(new URLSearchParams('window=nonsense'), now).windowLabel).toBe('Last 7 days');
    const bounded = parseScope(new URLSearchParams('from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&window=24h'), now);
    expect(bounded).toMatchObject({ from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z', windowLabel: 'Last 24 h' });
  });

  it('T24: every widget sends the same window, units and run selection; the same scope gives the same report key', () => {
    const base = scopeBase(scope());
    const queries = [waterfallQuery(scope()), lossTreeQuery(scope()), trendQuery(scope()), statusQuery(scope()), qualityQuery(scope()), oeeQuery(scope(), 'unit'), repeatQuery(scope(), 'reason')];
    for (const query of queries) expect(query).toMatchObject(base);
    expect(reportKey('t', 'scope-waterfall', waterfallQuery(scope()), 'UTC')).toEqual(reportKey('t', 'scope-waterfall', waterfallQuery(parseScope(scopeToParams(scope()), 0)), 'UTC'));
    expect(reportKey('t', 'scope-waterfall', waterfallQuery(scope(), 'plan'))).not.toEqual(reportKey('t', 'scope-waterfall', waterfallQuery(scope())));
  });

  it('T24: grouping, metric, trend and ledger reach the server query (B11: the trend selector is wired)', () => {
    expect(trendQuery({ ...scope(), trendBy: 'shift' }).groupBy).toBe('shift');
    expect(lossTreeQuery({ ...scope(), lossGroupBy: 'impact', lossMetric: 'margin' })).toMatchObject({ groupBy: 'impact', metric: 'margin', ledger: 'capacity' });
    expect(lossTreeQuery(scope(), { metric: 'standard_cost', groupBy: 'reason', limit: 10 })).toMatchObject({ metric: 'standard_cost', limit: 10 });
    expect(oeeQuery(scope(), 'week', 'reconciled')).toMatchObject({ groupBy: 'week', policy: 'reconciled' });
  });

  it('SME V8: the value view opens on the policy default (`value`); economic impact is selectable; the heading names the resolved view', () => {
    expect(parseScope(new URLSearchParams(), 0).valueMetric).toBe('value');
    expect(parseScope(new URLSearchParams('metric=economic_impact'), 0).lossMetric).toBe('economic_impact');
    expect(lossTreeQuery(scope(), { metric: scope().valueMetric })).toMatchObject({ metric: 'value' });
    expect(shownMetricLabel('value', { metric: 'economic_impact', defaultView: true })).toBe('Economic impact (policy default)');
    expect(shownMetricLabel('value', undefined)).toBe('Value (policy default view)');
    expect(shownMetricLabel('margin', { metric: 'margin', defaultView: false })).toBe('Contribution margin');
  });

  it('T24: the export carries the page window and units, approved content only', () => {
    const request = exportRequestOf(scope(), 'period_summary', false);
    expect(request).toEqual({ reportType: 'period_summary', format: 'csv', revisionSelector: 'published', from: scope().from, to: scope().to, unitIds: ['u1', 'u2'] });
    expect(exportRequestOf(scope(), 'period_summary', true)).toBeNull();
    expect(exportRequestOf({ ...scope(), approvedOnly: false }, 'loss_lines', false)).toBeNull();
  });
});

describe('PLA analytics display (plan 3.6, T41)', () => {
  it('T41: a null OEE reads "Not available: <reason>", never 87 % or 100 %', () => {
    expect(kpiText(kpi({ reason: 'no_scheduled_time' }))).toBe('Not available: no scheduled time');
    expect(kpiText(undefined)).toBe('Not available: no calculated periods');
    expect(kpiText(kpi({ value: '0.875', quality: 'ok' }))).toBe('87.5 %');
  });

  it('unvalued amounts say why and are never 0; quantities keep their unit', () => {
    expect(amountText({ amount: null, unit: 'USD', reasons: ['policy_unapproved'], status: 'unvalued' }, 'margin')).toMatch(/^Not valued \(Valuation policy not approved/);
    expect(amountText({ amount: '1234.567', unit: 'IRR', reasons: [], status: 'valued' }, 'margin')).toBe('1,235 IRR');
    expect(amountText({ amount: '90', unit: 't', reasons: [], status: 'quantity' }, 'qty')).toBe('90.00 t');
    expect(notValuedReason(['not_valued'])).toBe('no valuation recorded');
    expect(ageText(-1)).toBe('not ended');
    expect(ageText(3 * 86_400 + 7200)).toBe('3 d 2 h');
  });

  it('chart rows copy server values per series (null stays null)', () => {
    const rows = oeeRows({ policy: 'operational', label: 'L', groupBy: 'day', calculationRunIds: [], total: [], groups: [{ key: '2026-10-01', label: null, metrics: [kpi({ value: '0.5' }), kpi({ metric: 'quality' })] }] });
    expect(rows).toEqual([{ label: '2026-10-01', values: { oee: '0.5', quality: null } }]);
    const trend = { groupBy: 'day' as const, ledger: 'plan' as const, calculationRunIds: [], totals: [], buckets: [{ key: 'd', uom: 't', unaccounted: '10', overAccounted: '0', overproduction: '0', plan: '100', actual: '90', shortfall: '10', unexplained: '10', explained: '0', unexplainedOfPlan: '0.1', unexplainedOfShortfall: '1', unexplainedTarget: '0.02', unexplainedAboveTarget: true, periods: 1, excludedSlices: 0 }] };
    expect(trendUnits(trend)).toEqual(['t']);
    expect(residualRows(trend, 't')[0].values.unaccounted).toBe('10');
  });
});

describe('PLA analytics views and dashboard window (UI guidelines §2, §8)', () => {
  it('opens links to the former eight tabs on the view that now holds them', () => {
    const tabOf = (tab: string) => parseScope(new URLSearchParams(`${URL_TEXT.replace('tab=trends', `tab=${tab}`)}`), 0).tab;
    expect(['loss-tree', 'opportunities', 'repeat-causes'].map(tabOf)).toEqual(['losses', 'losses', 'losses']);
    expect(tabOf('quality')).toBe('reconciliation');
    expect(tabOf('nonsense')).toBe('waterfall');
  });

  it('the dashboard window rolls with the clock but is minute-stable (one cache entry per minute)', () => {
    const a = dashboardScope('7d', {}, Date.parse('2026-10-12T10:00:05Z'));
    const b = dashboardScope('7d', {}, Date.parse('2026-10-12T10:00:50Z'));
    const later = dashboardScope('7d', {}, Date.parse('2026-10-13T10:00:05Z'));
    expect([a.from, a.to]).toEqual([b.from, b.to]);
    expect(a.to).toBe('2026-10-12T10:01:00.000Z');
    expect(later.to > a.to).toBe(true);
    expect(dashboardScope('24h', {}, 0).windowLabel).toBe('24 h');
    expect(presetKeyOf('90d')).toBe('7d');
  });

  it('loss events are the loss types of the scope, never superseded or retracted rows', () => {
    expect(lossEventsQuery({ ...scope(), eventType: 'all' })).toMatchObject({ physicalTypes: ['downtime', 'slowdown', 'quality_loss'], physicalStates: ['open', 'closed'], unitIds: ['u1', 'u2'], sort: '-startTime' });
    expect(lossEventsQuery({ ...scope(), eventType: 'slowdown' }).physicalTypes).toEqual(['slowdown']);
    expect(SCOPE_PARAMS.has('events')).toBe(true);
    expect(SCOPE_PARAMS.has('view')).toBe(false);
  });

  it('bucket keys read as plant dates, weeks or month ranges, Persian when the plant uses it', () => {
    expect(bucketLabel('2026-10-12', 'day', {})).toBe('2026-10-12');
    expect(bucketLabel('2026-10-12', 'day', { calendar: 'persian' })).toBe('1405/07/20');
    expect(bucketLabel('2026-10-12 A', 'shift', {})).toBe('2026-10-12 A');
    expect(bucketLabel('2026-W41', 'week', {})).toBe('Week 41 of 2026');
    // DT-10: Saturday weeks (Iranian plants) are keyed by their Saturday and named from it
    expect(bucketLabel('2026-10-10', 'week', {})).toBe('Week from 2026-10-10');
    expect(bucketLabel('2026-10-10', 'week', { calendar: 'persian' })).toBe('Week from 1405/07/18');
    expect(bucketLabel('2026-02', 'month', {})).toBe('2026-02-01 – 2026-02-28');
    // a Persian-calendar plant's months are keyed in that calendar by the server (21 Oct 2026)
    expect(bucketLabel('1405-07', 'month', { calendar: 'persian', digits: 'latin' })).toBe('Mehr 1405');
  });
});
