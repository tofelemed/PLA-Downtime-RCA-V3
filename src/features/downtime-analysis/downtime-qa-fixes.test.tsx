import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { KpiAggregateView } from '@/api/v2/types/reports';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { useDowntimeBundle } = await import('./hooks/use-downtime-bundle');
const { useDowntimeFilters } = await import('./hooks/use-downtime-filters');
const { KpiSummary } = await import('./components/kpi-summary');
const { pageBundleQuery } = await import('./model/bundle-views');
const { parseFilters } = await import('./model/downtime-filters');
const { reasonText } = await import('./model/kpi-display');

const SEARCH = 'from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z&window=Chosen%20dates&units=u1&class=planned';
const FILTERS = parseFilters(new URLSearchParams(SEARCH), 0);

const tile = (metric: string, value: string | null, reason: string | null = null): KpiAggregateView => ({
  metric, numerator: value, denominator: null, value, unit: 's', quality: reason ? 'unavailable' : 'ok', reason, rows: 2, missing: 0,
} as KpiAggregateView);

const bundleBody = {
  data: {
    includeMicroStops: false, scheduleClass: 'planned', views: [], calculationRunIds: ['run-1'],
    summary: [tile('downtime_total', '0'), tile('stop_count', '0'), tile('scheduled_availability', null, 'not_by_schedule_class')],
  },
  calculationRunId: 'run-1', policyVersion: null, dataQuality: { missingCount: 0, provisionalCount: 0 },
  coverage: { from: FILTERS.from, to: FILTERS.to, ratio: 1 }, isProvisional: false, asOf: '2026-10-19T09:00:00.000Z', scope: { tenantId: 'tenant-a' },
};

describe('Downtime QA audit fixes (F1, F2, L15)', () => {
  let urls: URL[];
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/downtime/causes?${SEARCH}&analysis=reasons&drill=r1`]}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

  beforeEach(() => {
    urls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(new URL(url));
      return new Response(JSON.stringify(bundleBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('F1: the previous-period comparison sends views (never an empty list) and the schedule class', async () => {
    renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'trends', 'calendar'), 'Asia/Tehran'), { wrapper });
    await waitFor(() => expect(urls).toHaveLength(1));
    const [url] = urls;
    expect(url.pathname).toMatch(/\/v2\/reports\/downtime-bundle$/);
    expect(url.searchParams.getAll('views')).toEqual(['day:duration:planned']);
    expect(url.searchParams.get('scheduleClass')).toBe('planned');
    expect(url.searchParams.has('tenantId')).toBe(false);
  });

  it('F2: the summary says it is for one class; a figure not split by class shows "—" with the reason', async () => {
    const { result } = renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'overview', null), 'Asia/Tehran'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    render(<KpiSummary bundle={result.current} compact />, { wrapper });
    expect(screen.getByTestId('kpi-class-note')).toHaveTextContent('Figures for planned stops only');
    expect(screen.getByTestId('kpi-scheduled_availability')).toHaveTextContent('Not split by schedule class');
    expect(reasonText('not_by_schedule_class')).toBe('Not split by schedule class');
  });

  it('L15: a filter change closes the listed Pareto bar but keeps the analysis mode', () => {
    const { result } = renderHook(() => ({ state: useDowntimeFilters(), location: useLocation() }), { wrapper });
    expect(new URLSearchParams(result.current.location.search).get('drill')).toBe('r1');
    act(() => result.current.state.change({ scheduleClass: 'unplanned' }));
    const params = new URLSearchParams(result.current.location.search);
    expect(params.get('drill')).toBeNull();
    expect(params.get('analysis')).toBe('reasons');
    expect(params.get('class')).toBe('unplanned');
  });
});
