import { describe, expect, it } from 'vitest';
import { capabilitiesOf } from '@/features/auth/capabilities';
import { groupNavigationItems, isNavItemActive, NAVIGATION_ITEMS, visibleNavigationItems } from '@/features/auth/navigation-items';
import { pageBundleQuery } from '@/features/downtime-analysis/model/bundle-views';
import { parseFilters } from '@/features/downtime-analysis/model/downtime-filters';
import { analysisHref, DOWNTIME_PAGES, legacyPlaPath, PLA_PAGES } from './analysis-pages';

const SEARCH = '?from=2026-10-01T00%3A00%3A00Z&to=2026-10-08T00%3A00%3A00Z&units=u1&products=p1&shifts=Day&crews=c1&class=unplanned&approved=1&analysis=reasons&reasons=r1';

describe('focused analysis navigation', () => {
  it('retains period filters and reason drill when navigating inside Downtime', () => {
    const target = new URL(analysisHref('/downtime/causes', { pathname: '/downtime/trends', search: SEARCH }), 'http://test');
    for (const [key, value] of new URLSearchParams(SEARCH)) expect(target.searchParams.get(key)).toBe(value);
  });

  it('carries only compatible filters when crossing between Downtime and PLA', () => {
    const target = new URL(analysisHref('/pla-analytics/losses', { pathname: '/downtime/causes', search: SEARCH }), 'http://test');
    expect([...target.searchParams.keys()].sort()).toEqual(['approved', 'from', 'to', 'units']);
    expect(target.searchParams.get('units')).toBe('u1');
    const reverse = analysisHref('/downtime/stops', { pathname: target.pathname, search: `${target.search}&metric=economic_impact&ledger=capacity` });
    expect(reverse).not.toContain('economic_impact');
    expect(reverse).not.toContain('ledger=');
  });

  it('retains PLA ledger/detail filters and removes legacy tab state', () => {
    expect(analysisHref('/pla-analytics/trends', { pathname: '/pla-analytics/losses', search: '?ledger=capacity&breakdown=opportunities&tab=losses' })).toBe('/pla-analytics/trends?ledger=capacity&breakdown=opportunities');
    expect(analysisHref('/rca', { pathname: '/downtime', search: SEARCH })).toBe('/rca');
  });

  it('carries the shared analysis context to the Event Hub, Reports and back (B-8)', () => {
    const events = new URL(analysisHref('/events', { pathname: '/downtime', search: SEARCH }), 'http://test');
    expect([...events.searchParams.keys()].sort()).toEqual(['approved', 'from', 'to', 'units']);
    expect(analysisHref('/reports', { pathname: '/events', search: '?window=24h&units=u2&kinds=downtime' })).toBe('/reports?window=24h&units=u2');
    expect(analysisHref('/downtime', { pathname: '/dashboard', search: '?window=30d' })).toBe('/downtime?window=30d');
  });

  it.each([
    ['waterfall', '/pla-analytics'], ['loss-tree', '/pla-analytics/losses'], ['opportunities', '/pla-analytics/losses'],
    ['repeat-causes', '/pla-analytics/losses'], ['quality', '/pla-analytics/reconciliation'], ['oee', '/pla-analytics/oee'],
  ])('maps legacy %s bookmarks to %s', (tab, target) => expect(legacyPlaPath(tab)).toBe(target));

  it('gives each child page exactly one active menu item', () => {
    for (const page of [...DOWNTIME_PAGES, ...PLA_PAGES]) {
      expect(NAVIGATION_ITEMS.filter((item) => isNavItemActive(item, page.path)).map((item) => item.href)).toEqual([page.path]);
    }
  });

  it.each([['operator'], ['viewer'], ['SuperAdmin']])('keeps analysis access under the original read capability: %s', (...roles) => {
    const groups = groupNavigationItems(visibleNavigationItems(capabilitiesOf(roles), {}));
    expect(groups.find((group) => group.section.key === 'downtime')?.items).toHaveLength(5);
    // the PLA section also lists "Period accounting" (UX audit B-5, analysis roles only); Loss valuation is
    // money, which operators do not see (owner 19 Oct 2026, QA audit)
    const pla = groups.find((group) => group.section.key === 'pla')?.items.filter((item) => item.href.startsWith('/pla-analytics'));
    expect(pla).toHaveLength(roles.includes('operator') ? 5 : 6);
    expect(groups.find((group) => group.section.key === 'production')?.items.some((item) => item.href.startsWith('/downtime') || item.href.startsWith('/pla-analytics'))).toBe(false);
  });

  it('requests only the active page breakdowns without losing the selected periods', () => {
    const filters = parseFilters(new URLSearchParams(SEARCH), 0);
    const overview = pageBundleQuery(filters, 'overview', null);
    expect(overview).toMatchObject({ productIds: ['p1'], shiftNames: ['Day'], crewIds: ['c1'] });
    expect(overview.views).toEqual(['day:duration:unplanned']);
    expect(pageBundleQuery(filters, 'causes', 'assets').views).toEqual(['asset:duration:unplanned', 'asset:frequency:unplanned']);
    expect(pageBundleQuery(filters, 'trends', 'crew').views).toEqual(['crew:duration:unplanned']);
    // QA audit F1: the summary-only comparison still names one view (the API refuses an empty list)
    expect(pageBundleQuery(filters, 'trends', 'calendar').views).toEqual(['day:duration:unplanned']);
    expect(overview.scheduleClass).toBe('unplanned');
  });
});
