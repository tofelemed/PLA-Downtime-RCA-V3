import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleQuery, pageBundleQuery, pageViews, viewOf, viewToken } from './model/bundle-views';
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

/**
 * QA audit F1: the request contract of `GET /reports/downtime-bundle` (`DowntimeBundleQueryDto`, global
 * ValidationPipe with forbidNonWhitelisted): 1–12 view tokens in the grammar, and only declared parameters.
 */
describe('downtime bundle request contract', () => {
  const DTO = readFileSync(join(process.cwd(), 'server', 'pro-act-backend', 'src', 'v2', 'reports', 'kpi-reports-v2.dto.ts'), 'utf8');
  const listOf = (name: string) => {
    const match = new RegExp(String.raw`const ${name} = \[([^\]]*)\]`).exec(DTO);
    if (!match) throw new Error(`${name} not found`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  };
  const grammar = new RegExp(`^(${listOf('BUNDLE_GROUPS').join('|')})(:(${listOf('DOWNTIME_METRICS').join('|')}))?(:(${listOf('SCHEDULE_CLASSES').join('|')}))?$`);
  const DECLARED = ['from', 'to', 'unitIds', 'approvedOnly', 'productIds', 'shiftNames', 'crewIds', 'includeMicroStops', 'scheduleClass', 'views'];
  const PAGES: ReadonlyArray<[string, string | null]> = [
    ['overview', null], ['causes', 'assets'], ['trends', null], ['trends', 'crew'], ['trends', 'calendar'],
  ];
  const URLS = [URL_A, `${URL_A}&class=planned&metric=frequency&trend=shift&micro=1&approved=1&products=p1&shifts=A&crews=c1`];

  it.each(PAGES)('%s / %s sends 1–12 views in the grammar and declared parameters only', (page, mode) => {
    for (const url of URLS) {
      const query = pageBundleQuery(parseFilters(new URLSearchParams(url), 0), page, mode);
      expect(query.views.length).toBeGreaterThanOrEqual(1);
      expect(query.views.length).toBeLessThanOrEqual(12);
      for (const token of query.views) expect(token).toMatch(grammar);
      for (const key of Object.keys(query)) expect(DECLARED).toContain(key);
    }
  });

  it('every parameter the page sends is declared by the server DTO', () => {
    for (const key of DECLARED) expect(DTO).toMatch(new RegExp(String.raw`\b${key}[?!]?:`));
  });

  it('the summary follows the schedule class; every class leaves the parameter out', () => {
    expect(bundleQuery(parseFilters(new URLSearchParams(`${URL_A}&class=planned`), 0)).scheduleClass).toBe('planned');
    expect(bundleQuery(parseFilters(new URLSearchParams(URL_A), 0))).not.toHaveProperty('scheduleClass');
  });
});
