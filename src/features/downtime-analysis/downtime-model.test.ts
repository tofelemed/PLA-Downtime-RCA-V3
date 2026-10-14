import { describe, expect, it } from 'vitest';
import { reportKey } from '@/api/v2/queries/reports';
import type { CodeView } from '@/api/v2/types/flags';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { DowntimeGroupView, KpiAggregateView, ReliabilityRowView } from '@/api/v2/types/reports';
import { downtimeQuery, parseFilters, previousWindow, reportBase, toSearchParams } from './model/downtime-filters';
import { formatCount, formatRatio, hasUnknownTime, reasonText, restoreColumn, restoreTitle, SUMMARY_TILES } from './model/kpi-display';
import { barAction, drillEventQuery, paretoQuery, subtreeIds } from './model/reason-drill';
import { timelineRows } from './model/timeline';
import { trendRows } from './model/trend-rows';

const NOW = Date.parse('2026-10-09T12:00:00.000Z');
const URL_A = 'from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-08T00%3A00%3A00.000Z&window=Last+7+days&units=u2,u1&class=unplanned&reasons=r1';

const code = (id: string, parentId: string | null, path: string): CodeView =>
  ({ id, parentId, path, code: id.toUpperCase(), name: id, level: path.split('/').length - 1, active: true }) as CodeView;
const CODES = [code('mech', null, 'mech'), code('brg', 'mech', 'mech/brg'), code('seal', 'mech', 'mech/seal'), code('elec', null, 'elec')];
const group = (key: string | null, value = '60'): DowntimeGroupView => ({ key, label: key, value, share: '0.5', cumulativeShare: '1', periods: 1 });
const kpi = (metric: string, value: string | null, reason: string | null = null): KpiAggregateView => ({
  metric, numerator: value, denominator: null, value, unit: 's', quality: value === null ? 'unavailable' : 'ok', reason, rows: 1, missing: 0,
});

describe('Downtime Analysis filters in the URL (plan 3.3 step 1)', () => {
  it('round-trips through the search params; units sorted, defaults left out', () => {
    const filters = parseFilters(new URLSearchParams(URL_A), NOW);
    expect(filters).toMatchObject({ unitIds: ['u1', 'u2'], scheduleClass: 'unplanned', metric: 'duration', trendBy: 'day', reasonPath: ['r1'] });
    const again = parseFilters(toSearchParams(filters), NOW + 60_000);
    expect(again).toEqual(filters);
    expect(toSearchParams(filters).has('metric')).toBe(false);
  });

  it('a missing or reversed window falls back to the last 7 days ending when the page opened', () => {
    const filters = parseFilters(new URLSearchParams('from=2026-10-08T00:00:00Z&to=2026-10-01T00:00:00Z&metric=cost'), NOW);
    expect(filters.to).toBe(new Date(NOW).toISOString());
    expect(Date.parse(filters.to) - Date.parse(filters.from)).toBe(7 * 86_400_000);
    expect(filters.metric).toBe('duration');
  });

  it('report requests: the shared base plus the grouping; unset options are omitted', () => {
    const filters = parseFilters(new URLSearchParams(URL_A), NOW);
    expect(downtimeQuery(filters, 'asset', { metric: 'frequency' })).toEqual({
      from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', unitIds: ['u1', 'u2'], groupBy: 'asset', metric: 'frequency', scheduleClass: 'unplanned',
    });
    expect(downtimeQuery(filters, 'oee', { scheduleClass: 'all' })).not.toHaveProperty('scheduleClass');
    expect(paretoQuery(filters)).toMatchObject({ groupBy: 'reasonChild', parentReasonId: 'r1' });
    expect(paretoQuery({ ...filters, reasonPath: [] })).toMatchObject({ groupBy: 'reasonLevel1' });
    expect(paretoQuery({ ...filters, reasonPath: [] })).not.toHaveProperty('parentReasonId');
  });

  it('T24: the same URL gives the same report keys; every widget shares scope, window and run selection', () => {
    const a = parseFilters(new URLSearchParams(URL_A), NOW);
    const b = parseFilters(new URLSearchParams(URL_A.replace('units=u2,u1', 'units=u1,u2')), NOW + 5_000);
    const header = reportKey('t1', 'downtime', downtimeQuery(a, 'oee', { scheduleClass: 'all', metric: 'duration' }), 'UTC');
    const tiles = reportKey('t1', 'downtime', downtimeQuery(b, 'oee', { scheduleClass: 'all', metric: 'duration' }), 'UTC');
    expect(tiles).toEqual(header);
    const pareto = reportKey('t1', 'downtime', paretoQuery(a), 'UTC');
    const assets = reportKey('t1', 'downtime', downtimeQuery(a, 'asset'), 'UTC');
    expect(pareto.slice(0, 6)).toEqual(header.slice(0, 6));
    expect(assets.slice(0, 6)).toEqual(header.slice(0, 6));
    expect(pareto[8]).toBe(header[8]);
    expect(reportBase(a)).toEqual(reportBase(b));
  });

  it('previous window has the same length and ends where the chosen one starts', () => {
    const filters = parseFilters(new URLSearchParams(URL_A), NOW);
    const previous = previousWindow(filters);
    expect(previous.to).toBe(filters.from);
    expect(previous.from).toBe('2026-09-24T00:00:00.000Z');
  });
});

describe('KPI labels and formatting (KPI05–KPI08)', () => {
  it('ratios move the decimal point on the digits; counts drop the scale', () => {
    expect(formatRatio('0.875')).toBe('87.5 %');
    expect(formatRatio('1')).toBe('100.0 %');
    expect(formatRatio('0.0000000001', 2)).toBe('0.00 %');
    expect(formatRatio(null)).toBe('—');
    expect(formatCount('3.0000000000')).toBe('3');
  });

  it('server reasons become text; unclassified stop time above zero flags an incomplete planned / unplanned split', () => {
    expect(reasonText('no_failures')).toBe('No failures in the window');
    expect(reasonText('custom_reason')).toBe('custom reason');
    expect(hasUnknownTime([kpi('unknown_time', '0')])).toBe(false);
    expect(hasUnknownTime([kpi('unknown_time', '120')])).toBe(true);
  });

  it('DT-07: calendar total, in-schedule downtime and external downtime are separate tiles', () => {
    const metrics = SUMMARY_TILES.map((tile) => tile.metric);
    expect(metrics.slice(0, 2)).toEqual(['downtime_total', 'downtime_in_schedule']);
    expect(metrics).toContain('downtime_external');
    expect(SUMMARY_TILES[0].note).toMatch(/calendar/);
  });

  it('SME D10: "Mean active repair time" only with repair evidence, otherwise "Mean time to restore production"', () => {
    const row = (mttr: string | null): ReliabilityRowView => ({
      unitId: 'u1', assetId: null, label: null, exposureSeconds: '3600', failures: '0',
      mtbf: kpi('mtbf', null, 'no_failures'), meanDowntimeToRestore: kpi('mean_downtime_to_restore', '600'), mttr: kpi('mttr', mttr, mttr ? null : 'repair_evidence_missing'),
    });
    expect(restoreColumn(row(null))).toMatchObject({ title: 'Mean time to restore production', view: { value: '600' } });
    expect(restoreColumn(row('300')).title).toBe('Mean active repair time');
    expect(restoreTitle([row('300'), row(null)])).toBe('Mean time to restore production');
  });
});

describe('Reason drill-down and drill-through (AN01)', () => {
  it('a bar with children drills; a leaf, the parent level or "not coded" lists events', () => {
    expect(barAction(group('mech'), [], CODES)).toEqual({ kind: 'drill', reasonId: 'mech' });
    expect(barAction(group('brg'), ['mech'], CODES)).toEqual({ kind: 'events', reasonId: 'brg' });
    expect(barAction(group('mech'), ['mech'], CODES)).toEqual({ kind: 'events', reasonId: 'mech' });
    expect(barAction(group(null), [], CODES)).toEqual({ kind: 'events', reasonId: null });
  });

  it('the event list uses the same units, window and class, and the bar subtree', () => {
    const filters = parseFilters(new URLSearchParams(URL_A), NOW);
    expect(subtreeIds('mech', CODES)).toEqual(['brg', 'mech', 'seal']);
    expect(drillEventQuery(filters, 'mech', CODES)).toMatchObject({
      from: filters.from, to: filters.to, unitIds: ['u1', 'u2'], scheduleClasses: ['unplanned'], reasonIds: ['brg', 'mech', 'seal'], physicalTypes: ['downtime'],
    });
    expect(drillEventQuery(filters, null, CODES)).toMatchObject({ codingStates: ['uncoded'] });
  });
});

describe('Trend and timeline layout (no aggregation)', () => {
  it('trend rows line up the class series by site-local key, values placed not summed', () => {
    const rows = trendRows([
      { scheduleClass: 'planned', groups: [group('2026-10-02', '60'), group('2026-10-01', '30')] },
      { scheduleClass: 'unplanned', groups: [group('2026-10-01', '90'), group(null, '5')] },
    ]);
    expect(rows).toEqual([
      { key: '2026-10-01', label: '2026-10-01', values: { planned: '30', unplanned: '90' } },
      { key: '2026-10-02', label: '2026-10-02', values: { planned: '60' } },
    ]);
  });

  it('timeline clips events to the window; running stops end at the server as-of; unknown is flagged', () => {
    const event = (id: string, start: string, end: string | null, scheduleClass = 'unplanned') =>
      ({ id, unitId: 'u1', startTime: start, endTime: end, isOpen: end === null, asOf: '2026-10-01T12:00:00.000Z', classification: { scheduleClass } }) as ProductionEventView;
    const [row] = timelineRows(
      [event('a', '2026-09-30T23:00:00.000Z', '2026-10-01T06:00:00.000Z'), event('b', '2026-10-01T09:00:00.000Z', null, 'unknown')],
      { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' },
    );
    expect(row.segments.map((s) => [s.event.id, s.left, s.width, s.unknown, s.open])).toEqual([
      ['a', 0, 25, false, false],
      ['b', 37.5, 12.5, true, true],
    ]);
  });
});
