import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { DOWNTIME_PAGES, PLA_PAGES } from './analysis-pages';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));
vi.mock('@/features/event-hub/event-hub-env', () => ({ EventHubEnvProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/event-hub/event-hub-frame', () => ({ EventHubFrame: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ tenantId: 'tenant-a', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [], unitsLoading: false, allReasonCodes: [], reasonCodes: [], unitName: (id: string) => id, reasonName: (id: string) => id }) }));
vi.mock('@/features/plan-dashboard/components/waterfall-chart', () => ({ WaterfallChart: () => <div>Waterfall chart</div> }));

const { DowntimeAnalysisPage } = await import('@/features/downtime-analysis/downtime-page');
const { PlaAnalyticsPage } = await import('@/features/pla-analytics/pla-analytics-page');
const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-08T00:00:00.000Z';
const WINDOW = `from=${FROM}&to=${TO}&units=u1&approved=1`;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const envelope = (data: unknown) => ({ data, asOf: TO, calculationRunId: null, policyVersion: null, scope: { tenantId: 'tenant-a' }, coverage: { from: FROM, to: TO, ratio: 1 }, dataQuality: { missingCount: 0, provisionalCount: 0 }, isProvisional: false });

function reportData(url: URL): object {
  const base = { calculationRunIds: ['run-1'], groups: [], total: [], totals: [], summary: [], views: [], units: [] };
  if (url.pathname.endsWith('/scope-waterfall')) return { ...base, ledger: 'plan', opening: '224', closing: '190', closes: true, uom: 't', bars: [], excluded: [] };
  if (url.pathname.endsWith('/loss-value')) return { ...base, total: { currencies: [] }, components: [] };
  if (url.pathname.endsWith('/reconciliation-status')) return { ...base, periods: 0, waitingForData: 0, rejectionEscalated: 0, overdueCount: 0, overdue: [], workflow: [], residual: [], ages: [], sla: { submitWithinHours: 1, approveWithinHours: 1 } };
  if (url.pathname.endsWith('/actuals-quality')) return { ...base, periods: 0, slices: 0, periodsWithoutActuals: 0, lowestCoverage: null, qualityStates: [], coverage: [], quantities: [] };
  if (url.pathname.endsWith('/reconciliation-trend')) return { ...base, buckets: [] };
  return { ...base, groupBy: url.searchParams.get('groupBy'), metric: 'duration', unit: 's', scheduleClass: null };
}

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function EventReturn() {
  const location = useLocation();
  const state = location.state as { listSearch?: string } | null;
  return <output data-testid="event-return">{state?.listSearch}</output>;
}

describe('focused analysis pages and their server reads', () => {
  let calls: URL[];
  let client: QueryClient;
  let includeEvent: boolean;
  const open = (path: string) => render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Location />
    <Routes>
      <Route path="/events/:eventId" element={<EventReturn />} />
      {DOWNTIME_PAGES.map((page) => <Route key={page.path} path={page.path} element={<DowntimeAnalysisPage />} />)}
      {PLA_PAGES.map((page) => <Route key={page.path} path={page.path} element={<PlaAnalyticsPage />} />)}
    </Routes>
  </MemoryRouter></QueryClientProvider>);
  beforeEach(() => {
    calls = [];
    includeEvent = false;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(input);
      calls.push(url);
      if (url.pathname.includes('/reports/')) return json(envelope(reportData(url)));
      const events = includeEvent && url.pathname.endsWith('/production-events') ? [{ id: 'event-1', unitId: 'u1', startTime: FROM, reasonCodeId: null, classification: { physicalType: 'downtime' }, durationSeconds: 3600, quantity: null, quantityUom: null }] : [];
      return json({ items: events, nextCursor: null, asOf: TO, scope: { tenantId: 'tenant-a' } });
    }));
  });
  afterEach(() => { client.clear(); vi.unstubAllGlobals(); });
  const reads = () => calls.filter((url) => url.pathname.includes('/reports/'));

  it('keeps the overview short and does not load reliability, Paretos or the state timeline', async () => {
    open(`/downtime?${WINDOW}`);
    expect(await screen.findByTestId('kpi-summary')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(1));
    expect(reads()[0].pathname).toMatch(/downtime-bundle$/);
    expect(screen.getByText('More downtime figures')).toBeInTheDocument();
    expect(screen.queryByTestId('reliability')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lost-production-pareto')).not.toBeInTheDocument();
  });

  it('uses paginated operational stops without pretending product/approval filters apply', async () => {
    open(`/downtime/stops?${WINDOW}&products=p1&shifts=Day`);
    expect(await screen.findByTestId('downtime-stop-list')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((url) => url.pathname.endsWith('/production-events'))).toBe(true));
    const request = calls.find((url) => url.pathname.endsWith('/production-events'));
    expect(request?.searchParams.get('from')).toBe(FROM);
    expect(request?.searchParams.has('productIds')).toBe(false);
    expect(request?.searchParams.has('approvedOnly')).toBe(false);
    expect(screen.queryByLabelText('Approved only')).not.toBeInTheDocument();
    expect(reads()).toHaveLength(0);
  });

  it('loads reliability alone and retains its authoritative units/date/revision scope', async () => {
    open(`/downtime/reliability?${WINDOW}&products=p1`);
    expect(await screen.findByTestId('reliability')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(1));
    expect(reads()[0].pathname).toMatch(/reliability$/);
    expect(reads()[0].searchParams.get('unitIds')).toBe('u1');
    expect(reads()[0].searchParams.get('approvedOnly')).toBe('true');
    expect(reads()[0].searchParams.has('productIds')).toBe(false);
  });

  it('switches cause analyses without resetting the source scope or mounting every Pareto', async () => {
    open(`/downtime/causes?${WINDOW}&products=p1`);
    await waitFor(() => expect(reads().some((url) => url.pathname.endsWith('/loss-tree'))).toBe(true));
    expect(reads().some((url) => url.pathname.endsWith('/downtime-bundle'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'assets' } });
    await waitFor(() => expect(reads().some((url) => url.pathname.endsWith('/downtime-bundle'))).toBe(true));
    expect(screen.getByTestId('location').textContent).toContain('products=p1');
    expect(screen.getByTestId('location').textContent).toContain('analysis=assets');
  });

  it('changes a trend grouping without losing the selected comparison', async () => {
    open(`/downtime/trends?${WINDOW}&comparison=crew`);
    await waitFor(() => expect(reads().some((url) => url.pathname.endsWith('/downtime-bundle'))).toBe(true));
    expect(await screen.findByLabelText('Compare')).toHaveValue('crew');
    expect(screen.queryByTestId('downtime-trend')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Schedule class'), { target: { value: 'planned' } });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('class=planned'));
    expect(screen.getByTestId('location').textContent).toContain('comparison=crew');
  });

  it('loads only the PLA overview calculation', async () => {
    open(`/pla-analytics?${WINDOW}`);
    expect(await screen.findByTestId('pla-waterfall')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(1));
    expect(reads()[0].pathname).toMatch(/scope-waterfall$/);
  });

  it('redirects a bookmarked repeat-cause drill into its focused page and preserves its dates', async () => {
    open(`/pla-analytics?${WINDOW}&tab=losses#repeat-causes`);
    expect(await screen.findByLabelText('Explore')).toHaveValue('repeat-causes');
    await waitFor(() => expect(reads().some((url) => url.pathname.endsWith('/downtime'))).toBe(true));
    expect(screen.getByTestId('location').textContent).toMatch(/^\/pla-analytics\/losses\?/);
    expect(screen.getByTestId('location').textContent).toContain('breakdown=repeat-causes');
    expect(reads().some((url) => url.pathname.endsWith('/scope-waterfall'))).toBe(false);
  });

  it('loads the OEE page without making a hidden waterfall or trend request', async () => {
    open(`/pla-analytics/oee?${WINDOW}&ledger=capacity`);
    expect(await screen.findByTestId('pla-oee-operational')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
    expect(reads().every((url) => url.pathname.endsWith('/oee') && url.searchParams.get('groupBy') === 'unit')).toBe(true);
    expect(reads().map((url) => url.searchParams.get('policy')).sort()).toEqual(['operational', 'reconciled']);
    expect(screen.queryByRole('radiogroup', { name: 'Ledger' })).not.toBeInTheDocument();
  });

  it('requests just the chosen trend and switches to residuals on demand', async () => {
    open(`/pla-analytics/trends?${WINDOW}`);
    expect(await screen.findByTestId('pla-oee-trend')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'residual' } });
    await waitFor(() => expect(reads().some((url) => url.pathname.endsWith('/reconciliation-trend'))).toBe(true));
    expect(reads().some((url) => url.pathname.endsWith('/scope-waterfall'))).toBe(false);
    expect(reads().filter((url) => url.pathname.endsWith('/oee'))).toHaveLength(1);
  });

  it('loads quality coverage on demand rather than beneath every reconciliation visit', async () => {
    open(`/pla-analytics/reconciliation?${WINDOW}`);
    expect(await screen.findByTestId('pla-reconciliation')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Inspect'), { target: { value: 'quality' } });
    await waitFor(() => expect(reads().some((url) => url.pathname.endsWith('/actuals-quality'))).toBe(true));
    expect(screen.queryByTestId('pla-reconciliation')).not.toBeInTheDocument();
  });

  it('retains the filtered PLA page in an event detail return link', async () => {
    includeEvent = true;
    open(`/pla-analytics/losses?${WINDOW}&breakdown=loss-events`);
    const row = await screen.findByRole('row', { name: /on u1/ });
    expect(screen.queryByLabelText('Approved only')).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByTestId('event-return')).toHaveTextContent('/pla-analytics/losses?');
    expect(screen.getByTestId('event-return')).toHaveTextContent('breakdown=loss-events');
    expect(screen.getByTestId('event-return')).toHaveTextContent('units=u1');
  });

  it('sends the selected valuation basis and ledger to the existing server calculation', async () => {
    open(`/pla-analytics/valuation?${WINDOW}&ledger=capacity`);
    expect(await screen.findByTestId('report-loss-value')).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Valuation basis'), { target: { value: 'standard_cost' } });
    await waitFor(() => expect(reads().some((url) => url.searchParams.get('metric') === 'standard_cost')).toBe(true));
    expect(reads().every((url) => url.pathname.endsWith('/loss-value') && url.searchParams.get('ledger') === 'capacity')).toBe(true);
  });
});
