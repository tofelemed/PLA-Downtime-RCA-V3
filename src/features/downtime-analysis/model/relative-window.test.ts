import { describe, expect, it } from 'vitest';
import { analysisHref } from '@/features/analysis-navigation/analysis-pages';
import { hasWindowParams, parseFilters, previousWindow, reportBase, toSearchParams } from './downtime-filters';

const NOW = Date.parse('2026-10-18T06:15:20.000Z');

describe('A-5 rolling windows on the Downtime pages', () => {
  it('keeps a preset relative in the URL and resolves it from now on every parse', () => {
    const params = new URLSearchParams('window=24h&units=u1');
    const filters = parseFilters(params, NOW);
    expect(filters).toMatchObject({ relativeWindow: '24h', windowLabel: 'Last 24 h', from: '2026-10-17T06:16:00.000Z', to: '2026-10-18T06:16:00.000Z' });
    expect(toSearchParams(filters).toString()).toBe('window=24h&units=u1');
    const later = parseFilters(params, NOW + 5 * 60_000);
    expect(reportBase(later).to).toBe('2026-10-18T06:21:00.000Z');
  });

  it('a missing window is the default preset, kept relative; explicit dates stay absolute', () => {
    const fallback = parseFilters(new URLSearchParams(), NOW);
    expect(fallback.relativeWindow).toBe('30d');
    expect(hasWindowParams(new URLSearchParams())).toBe(false);
    const chosen = parseFilters(new URLSearchParams('from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=Chosen+dates'), NOW);
    expect(chosen).toMatchObject({ relativeWindow: null, windowLabel: 'Chosen dates', from: '2026-10-01T00:00:00.000Z' });
    expect(toSearchParams(chosen).get('to')).toBe('2026-10-08T00:00:00.000Z');
  });

  it('the previous window of a rolling one is an explicit range', () => {
    const previous = previousWindow(parseFilters(new URLSearchParams('window=7d'), NOW));
    expect(previous.relativeWindow).toBeNull();
    expect(toSearchParams(previous).has('from')).toBe(true);
  });

  it('analysis navigation carries the rolling window as its key, never frozen bounds', () => {
    const inside = new URL(analysisHref('/downtime/causes', { pathname: '/downtime', search: '?window=24h&units=u1' }), 'http://test');
    expect(Object.fromEntries(inside.searchParams)).toEqual({ window: '24h', units: 'u1' });
    const across = new URL(analysisHref('/pla-analytics', { pathname: '/downtime/stops', search: '?window=24h&units=u1&class=planned' }), 'http://test');
    expect(Object.fromEntries(across.searchParams)).toEqual({ window: '24h', units: 'u1' });
  });
});
