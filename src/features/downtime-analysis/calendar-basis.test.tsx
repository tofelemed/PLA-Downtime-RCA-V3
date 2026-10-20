import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { CalendarBasisView, KpiAggregateView } from '@/api/v2/types/reports';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { useDowntimeBundle } = await import('./hooks/use-downtime-bundle');
const { KpiSummary } = await import('./components/kpi-summary');
const { CalendarBasisSection } = await import('./components/calendar-basis-section');
const { pageBundleQuery } = await import('./model/bundle-views');
const { parseFilters } = await import('./model/downtime-filters');
const { CALENDAR_BASIS_BADGE, INCOMPLETE_TEXT, reasonText } = await import('./model/kpi-display');

const SEARCH = 'window=7d&units=u1&units=u2';
const FILTERS = parseFilters(new URLSearchParams(SEARCH), Date.parse('2026-10-19T09:00:00.000Z'));

const kpi = (metric: string, value: string | null, basis: 'calculated' | 'calendar', unit = 's'): KpiAggregateView => ({
  metric, numerator: value, denominator: null, value, unit, quality: value === null ? 'unavailable' : 'ok', reason: value === null ? 'no_failures' : null, rows: 1, missing: 0, basis,
});

const CALENDAR: CalendarBasisView = {
  basis: 'calendar',
  label: 'Calendar basis — no plan or calendar for these units/days',
  timezone: 'Asia/Tehran',
  operationalDayStart: '06:00:00',
  omitted: null,
  units: [{
    unitId: 'u2', unitName: 'Blow moulding', policy: 'default',
    days: [{ localDate: '2026-10-18', from: '2026-10-18T02:30:00.000Z', to: '2026-10-19T02:30:00.000Z' }],
    kpis: [],
  }],
  total: [
    kpi('calendar_availability', '0.9166666667', 'calendar', 'ratio'),
    kpi('downtime_total', '10800', 'calendar'),
    kpi('downtime_unplanned', '7200', 'calendar'),
    kpi('stop_count', '2', 'calendar', 'count'),
    kpi('mtbf', null, 'calendar'),
  ],
};

const body = (calendarBasis: CalendarBasisView | undefined) => ({
  data: {
    includeMicroStops: false, scheduleClass: null, views: [], calculationRunIds: ['run-1'],
    summary: [kpi('downtime_total', '3600', 'calculated'), kpi('stop_count', '1', 'calculated', 'count')],
    ...(calendarBasis ? { calendarBasis } : {}),
  },
  calculationRunId: 'run-1', policyVersion: null, dataQuality: { missingCount: 0, provisionalCount: 0 },
  coverage: { from: FILTERS.from, to: FILTERS.to, ratio: 0.5 }, isProvisional: false, asOf: '2026-10-19T09:00:00.000Z', scope: { tenantId: 'tenant-a' },
});

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[`/downtime?${SEARCH}`]}>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </MemoryRouter>
);

function serve(calendarBasis: CalendarBasisView | undefined) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body(calendarBasis)), { status: 200, headers: { 'Content-Type': 'application/json' } })));
}

async function renderSummary() {
  const { result } = renderHook(() => useDowntimeBundle(pageBundleQuery(FILTERS, 'overview', null), 'Asia/Tehran'), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  render(<KpiSummary bundle={result.current} compact />, { wrapper });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('Downtime KPIs on calendar basis (plan 2.3)', () => {
  it('shows the calendar-basis badge, the units/days and the server figures apart from the calculated tiles', async () => {
    serve(CALENDAR);
    await renderSummary();
    const section = screen.getByTestId('calendar-basis');
    expect(within(section).getByTestId('calendar-basis-badge')).toHaveTextContent(CALENDAR_BASIS_BADGE);
    expect(within(section).getByTestId('calendar-basis-unit')).toHaveTextContent('Blow moulding');
    expect(within(section).getByTestId('calendar-basis-unit')).toHaveTextContent('default OEE policy');
    const tiles = within(section).getByTestId('calendar-basis-tiles');
    expect(within(tiles).getByTestId('kpi-calendar_availability')).toHaveTextContent('91.7 %');
    expect(within(tiles).getByTestId('kpi-calendar_availability')).toHaveTextContent('not ISO 22400 availability');
    expect(within(tiles).getByTestId('kpi-stop_count')).toHaveAttribute('data-value', '2');
    expect(within(tiles).getByTestId('kpi-mtbf')).toHaveTextContent(reasonText('no_failures') ?? '');
    // the calculated tiles keep the run-based values: nothing is added up in the browser
    const calculated = screen.getAllByTestId('kpi-downtime_total').find((tile) => !section.contains(tile));
    expect(calculated).toHaveAttribute('data-value', '3600');
    expect(within(tiles).getByTestId('kpi-downtime_total')).toHaveAttribute('data-value', '10800');
  });

  it('no section when every unit/day is calculated, or when the server is older', async () => {
    serve({ ...CALENDAR, units: [] });
    await renderSummary();
    expect(screen.queryByTestId('calendar-basis')).toBeNull();
    const { container } = render(<CalendarBasisSection calendar={undefined}><span /></CalendarBasisSection>, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it('says why the calendar basis is left out under a filter only calculated periods carry', () => {
    render(<CalendarBasisSection calendar={{ ...CALENDAR, omitted: 'approved_only', units: [] }}><span /></CalendarBasisSection>, { wrapper });
    expect(screen.getByTestId('calendar-basis-omitted')).toHaveTextContent('Approved only');
    expect(screen.queryByTestId('calendar-basis-badge')).toBeNull();
  });

  it('the incomplete-card copy points to the calendar basis', () => {
    expect(INCOMPLETE_TEXT).toMatch(/^Only calculated periods are counted here\./);
    expect(INCOMPLETE_TEXT).toContain('calendar basis');
  });
});
