import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { DataCoverageView, KpiAggregateView } from '@/api/v2/types/reports';
import { EventHubEnvContext, type EventHubEnv } from '@/features/event-hub/use-event-hub-env';

// a signed-in user (SuperAdmin by default): the period-summary export is offered only with the money capability
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { useDowntimeBundle } = await import('./hooks/use-downtime-bundle');
const { KpiSummary } = await import('./components/kpi-summary');
const { DataCoverageNote } = await import('./components/data-coverage-note');
const { pageBundleQuery } = await import('./model/bundle-views');
const { parseFilters } = await import('./model/downtime-filters');
const { reasonText } = await import('./model/kpi-display');
const { DowntimeHeader } = await import('./components/downtime-header');
const { TrendChart } = await import('./components/charts/trend-chart');
const { DowntimeFiltersBar } = await import('./components/downtime-filters-bar');
const { unbreakable } = await import('@/features/ux-kit/chart-text');

const SEARCH = 'window=7d&units=u1';
const FILTERS = parseFilters(new URLSearchParams(SEARCH), Date.parse('2026-10-19T09:00:00.000Z'));

const tile = (metric: string, value: string | null): KpiAggregateView =>
  ({ metric, numerator: value, denominator: null, value, unit: 's', quality: 'ok', reason: null, rows: 8, missing: 0 }) as KpiAggregateView;

const COVERAGE: DataCoverageView = {
  periodsWithStateData: 7, scheduledSeconds: '201600', knownSeconds: '86400', unknownSeconds: '115200', ratio: '0.4285714286', periodsWithoutPlan: 4,
};

const bundleBody = {
  data: {
    includeMicroStops: false, scheduleClass: null, views: [], calculationRunIds: ['run-1'], dataCoverage: COVERAGE,
    summary: [tile('downtime_total', '5400'), tile('scheduled_availability', '0.9375'), tile('controllable_availability', '0.9375')],
  },
  calculationRunId: 'run-1', policyVersion: null, dataQuality: { missingCount: 0, provisionalCount: 0 },
  coverage: { from: FILTERS.from, to: FILTERS.to, ratio: 1 }, isProvisional: false, asOf: '2026-10-19T09:00:00.000Z', scope: { tenantId: 'tenant-a' },
};

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [], allReasonCodes: [],
  unitName: () => 'HDPE Extruder 1', reasonName: () => '—',
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[`/downtime?${SEARCH}`]}>
    <QueryClientProvider client={client}>
      <EventHubEnvContext.Provider value={ENV}>{children}</EventHubEnvContext.Provider>
    </QueryClientProvider>
  </MemoryRouter>
);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(bundleBody), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('Downtime round-3 QA fixes', () => {
  it('N5: the summary states the data coverage and names the periods without an approved plan', async () => {
    const { result } = renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'overview', null), 'Asia/Tehran'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    render(<KpiSummary bundle={result.current} compact />, { wrapper });
    expect(screen.getByTestId('data-coverage')).toHaveTextContent('Data covers 43 % of the window');
    expect(screen.getByTestId('data-coverage')).not.toHaveTextContent('not counted as scheduled or available time');
    expect(screen.getByRole('button', { name: 'About Data coverage' })).toBeInTheDocument();
    expect(screen.getByTestId('data-coverage-no-plan')).toHaveTextContent('4 periods in this window: No approved plan covers this period');
    expect(screen.getByTestId('kpi-scheduled_availability')).toHaveTextContent('93.8 %');
    expect(reasonText('no_known_time')).toBe('No state data covers this window');
  });

  it('N5: no note when the state data covers the window and every period has a plan; one period reads singular', () => {
    const full: DataCoverageView = { ...COVERAGE, unknownSeconds: '0', ratio: '1', periodsWithoutPlan: 0 };
    const { container, rerender } = render(<DataCoverageNote coverage={full} />, { wrapper });
    expect(container).toBeEmptyDOMElement();
    rerender(<DataCoverageNote coverage={{ ...full, periodsWithStateData: 0, unknownSeconds: null, periodsWithoutPlan: 1 }} />);
    expect(screen.queryByTestId('data-coverage')).toBeNull();
    expect(screen.getByTestId('data-coverage-no-plan')).toHaveTextContent(/^1 period in this window/);
  });

  it('L17: the controllable view is kept in the URL', async () => {
    const { result } = renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'overview', null), 'Asia/Tehran'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    let search = '';
    const Probe = () => {
      search = useLocation().search;
      return null;
    };
    render(<><KpiSummary bundle={result.current} /><Probe /></>, { wrapper });
    expect(screen.queryByTestId('kpi-controllable_availability')).toBeNull();
    fireEvent.click(screen.getByTestId('controllable-switch'));
    expect(new URLSearchParams(search).get('controllable')).toBe('1');
    expect(screen.getByTestId('kpi-controllable_availability')).toBeInTheDocument();
  });

  it('L17: a reload with controllable=1 opens the controllable view', async () => {
    const reload = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[`/downtime?${SEARCH}&controllable=1`]}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
    const { result } = renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'overview', null), 'Asia/Tehran'), { wrapper: reload });
    await waitFor(() => expect(result.current.data).toBeDefined());
    render(<KpiSummary bundle={result.current} />, { wrapper: reload });
    expect(screen.getByTestId('controllable-switch')).toHaveAttribute('data-state', 'checked');
  });

  it('L23 / cleanup: export reason on screen; no unit chip or page subtitle', async () => {
    const { result } = renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'overview', null), 'Asia/Tehran'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    render(<DowntimeHeader filters={FILTERS} bundle={result.current} title="Downtime analysis · Trends & comparisons" />, { wrapper });
    expect(document.body.textContent).not.toContain('h:mm');
    expect(document.body.textContent).not.toContain('hours and minutes');
    const button = screen.getByTestId('downtime-export');
    expect(button).toBeDisabled();
    const reason = screen.getByTestId('disabled-reason');
    expect(reason).toHaveTextContent('approved figures only');
    expect(button).toHaveAttribute('aria-describedby', reason.id);
    expect(screen.queryByText('Compare downtime over time')).toBeNull();
  });

  it('N4 / L25: trend caption with a singular period and class names; axis ticks never wrap', () => {
    render(<TrendChart rows={[{ key: '2026-10-17', label: '17 Oct', values: { planned: '0', unplanned: '5400' } }]} classes={['planned', 'unplanned']} unit="s" />);
    expect(document.body.textContent).toContain('Stacked downtime for 1 period, split by schedule class (Planned, Unplanned).');
    expect(unbreakable('1 h 15 min')).toBe('1 h 15 min');
  });

  it('L1 / L20: the window select shows the preset once; one production day reads From = To', () => {
    const day = parseFilters(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z&window=Chosen%20dates&units=u1'), 0);
    const { unmount } = render(<DowntimeFiltersBar filters={FILTERS} onChange={() => undefined} />, { wrapper });
    const select = screen.getByTestId('downtime-window') as HTMLSelectElement;
    expect([...select.options].filter((option) => option.text === 'Last 7 days')).toHaveLength(1);
    expect(select.value).toBe('7d');
    unmount();
    render(<DowntimeFiltersBar filters={day} onChange={() => undefined} />, { wrapper });
    expect((screen.getByTestId('downtime-window') as HTMLSelectElement).options[0].text).toBe('Chosen dates');
  });
});
