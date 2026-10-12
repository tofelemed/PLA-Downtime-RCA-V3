import { describe, expect, it } from 'vitest';
import { bundleQuery, pageViews, viewOf, viewToken } from './model/bundle-views';
import { parseFilters } from './model/downtime-filters';

const URL_A = 'from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u2,u1';

describe('downtime bundle (one request for the page snapshot, T24)', () => {
  it('asks for bad actors, crews and one trend series per class in one sorted request', () => {
    const filters = parseFilters(new URLSearchParams(URL_A), 0);
    const query = bundleQuery(filters);
    expect(query).toMatchObject({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', unitIds: ['u1', 'u2'] });
    expect(query.views).toEqual([
      'asset:duration',
      'asset:frequency',
      'crew:duration',
      'day:duration:external',
      'day:duration:planned',
      'day:duration:unknown',
      'day:duration:unplanned',
    ]);
    expect(query.includeMicroStops).toBeUndefined();
  });

  it('follows the page class, metric, trend grouping and micro-stop choice', () => {
    const filters = parseFilters(new URLSearchParams(`${URL_A}&class=unplanned&metric=frequency&trend=week&micro=1`), 0);
    const views = pageViews(filters);
    expect(views.trend).toEqual({ unplanned: 'week:frequency:unplanned' });
    expect(views.crew).toBe('crew:frequency:unplanned');
    expect(views.assetDuration).toBe('asset:duration:unplanned');
    expect(bundleQuery(filters).includeMicroStops).toBe(true);
  });

  it('finds a view by its token', () => {
    const data = { includeMicroStops: false, summary: [], calculationRunIds: [], views: [{ view: viewToken('crew', 'duration'), groupBy: 'crew', metric: 'duration' as const, unit: 's' as const, scheduleClass: null, groups: [], total: '0' }] };
    expect(viewOf(data, 'crew:duration')?.groupBy).toBe('crew');
    expect(viewOf(data, 'asset:duration')).toBeUndefined();
  });
});
