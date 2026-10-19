import { describe, expect, it } from 'vitest';
import { parseEventFilters } from '@/features/event-hub/model/event-url';
import { parseFilters as parseDowntimeFilters } from '@/features/downtime-analysis/model/downtime-filters';
import { filtersFromParams } from '@/features/rca/model/case-filters';
import { parseScope } from '../model/analytics-scope';
import { dashboardScope } from '../model/dashboard-scope';
import { assetStopsHref, dashboardContext, downtimeHref, eventsHref, plaHref, RCA_LIST_LINKS, reportsHref, stopsToCodeHref } from './dashboard-links';

const NOW = Date.parse('2026-10-18T08:00:00Z');
const scope = dashboardScope('30d', NOW);
const paramsOf = (href: string) => new URL(href, 'http://app').searchParams;

describe('dashboard deep links (UX audit G-6 / B-8)', () => {
  it('carries the rolling dashboard window as its key, and units when the scope names any', () => {
    expect(dashboardContext(scope)).toEqual({ relativeWindow: '30d' });
    expect(dashboardContext({ ...scope, unitIds: ['u1'] })).toEqual({ relativeWindow: '30d', unitIds: ['u1'] });
  });

  it('downtime opens with the dashboard window', () => {
    const filters = parseDowntimeFilters(paramsOf(downtimeHref(scope)), NOW);
    expect([filters.from, filters.to, filters.windowLabel, filters.relativeWindow]).toEqual([scope.from, scope.to, scope.windowLabel, '30d']);
  });

  it('a most-stopped asset opens its downtime stops in the Event Hub over the same window', () => {
    const href = assetStopsHref(scope, 'asset-7');
    expect(href.startsWith('/events?')).toBe(true);
    const filters = parseEventFilters(paramsOf(href), NOW);
    expect(filters.assetIds).toEqual(['asset-7']);
    expect(filters.physicalTypes).toEqual(['downtime']);
    expect([filters.windowLabel, filters.relativeWindow]).toEqual([scope.windowLabel, '30d']);
    expect(parseEventFilters(paramsOf(eventsHref(scope)), NOW).assetIds).toEqual([]);
  });

  it('stops to code open the uncoded stops of the window', () => {
    const filters = parseEventFilters(paramsOf(stopsToCodeHref(scope)), NOW);
    expect([filters.physicalTypes, filters.codingStates, filters.relativeWindow]).toEqual([['downtime'], ['uncoded'], '30d']);
  });

  it('PLA and Reports links open with the dashboard window, keeping the breakdown and view', () => {
    const href = plaHref(scope, '/pla-analytics/losses', { breakdown: 'repeat-causes' });
    expect(href.startsWith('/pla-analytics/losses?')).toBe(true);
    expect(href).not.toContain('#');
    expect(paramsOf(href).get('breakdown')).toBe('repeat-causes');
    const pla = parseScope(paramsOf(href), NOW);
    expect([pla.from, pla.to, pla.windowLabel]).toEqual([scope.from, scope.to, scope.windowLabel]);
    expect(paramsOf(href).get('tab')).toBeNull();
    expect(reportsHref(scope, 'production')).toBe('/reports?view=production&window=30d');
  });

  it('RCA tiles open the list with filters it supports', () => {
    expect(filtersFromParams(paramsOf(RCA_LIST_LINKS.overdue)).due).toBe('overdue');
    expect(filtersFromParams(paramsOf(RCA_LIST_LINKS.critical)).priority).toBe('Critical');
    expect(paramsOf(RCA_LIST_LINKS.critical).get('open')).toBe('true');
    expect(Object.fromEntries(paramsOf(RCA_LIST_LINKS.overdueActions))).toEqual({ tab: 'actions', mine: 'false', overdue: 'true' });
  });
});
