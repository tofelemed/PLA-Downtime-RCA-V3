import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { DOWNTIME_PAGES } from '@/features/analysis-navigation/analysis-pages';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));
vi.mock('@/features/event-hub/event-hub-frame', () => ({ EventHubFrame: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({
  useEventHubEnv: () => ({
    tenantId: 'tenant-a', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [{ id: 'u1', code: 'X1', name: 'HDPE Extruder 1', siteId: null }],
    unitsLoading: false, allReasonCodes: [], reasonCodes: [], unitName: () => 'HDPE Extruder 1', reasonName: (id: string) => id,
  }),
}));

const { DowntimeAnalysisPage } = await import('./downtime-page');

const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-08T00:00:00.000Z';
const WINDOW = `from=${FROM}&to=${TO}&units=u1`;
const kpi = (metric: string, value: string) => ({ metric, numerator: value, denominator: null, value, unit: 's', quality: 'ok', reason: null, rows: 1, missing: 0 });
const envelope = (data: unknown, isProvisional = true) => ({
  data, asOf: TO, calculationRunId: null, policyVersion: null, scope: { tenantId: 'tenant-a' }, coverage: { from: FROM, to: TO, ratio: 1 },
  dataQuality: { missingCount: 0, provisionalCount: 0 }, isProvisional,
});
const REPORT = {
  calculationRunIds: ['run-1', 'run-2'], groups: [], total: '0', totals: [], views: [], groupBy: 'reason', metric: 'duration', unit: 's', scheduleClass: null,
  failureDefinition: 'A failure is a failure work order',
  units: [{ unitId: 'u1', assetId: null, label: null, exposureSeconds: '81000', failures: '1', mtbf: kpi('mtbf', '81000'), mttr: kpi('mttr', '1800'), meanDowntimeToRestore: kpi('mean_downtime_to_restore', '3600') }],
  summary: [kpi('downtime_total', '3600'), kpi('stop_count', '2'), kpi('scheduled_availability', '0.9'), kpi('coded_downtime_ratio', '0.8')],
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

let client: QueryClient;
const openDowntime = (path: string) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {DOWNTIME_PAGES.map((page) => (
            <Route key={page.path} path={page.path} element={<DowntimeAnalysisPage />} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input);
    // the chosen window is provisional; any earlier window (previous-period comparison) is approved
    if (url.pathname.includes('/reports/')) return json(envelope(REPORT, url.searchParams.get('from') === FROM));
    return json({ items: [], nextCursor: null, asOf: TO, scope: { tenantId: 'tenant-a' } });
  }));
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

const REMOVED = [
  /All units in your scope/, /\(\+03:30\)/, /Unit: hours and minutes/, /Historical downtime summary/, /keep whole production periods/,
  /filters do not apply/, /do not apply/, /Current stops and the key figures/, /Inspect stop records/, /Rank reasons and assets/,
  /Compare downtime over time/, /Failures, exposure, MTBF/,
];

describe('Downtime analysis cleanup (24 Oct 2026): header and filter bar', () => {
  it.each(DOWNTIME_PAGES.map((page) => page.path))('%s: no description, scope line, timezone badge or filter hint', async (path) => {
    openDowntime(`${path}?${WINDOW}`);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/^Downtime analysis · /);
    await waitFor(() => expect(screen.getByTestId('downtime-filters')).toBeInTheDocument());
    const text = document.body.textContent ?? '';
    for (const pattern of REMOVED) expect(text).not.toMatch(pattern);
    expect(screen.queryByTestId('scope-header')).toBeNull();
    expect(screen.queryByTestId('period-selection-note')).toBeNull();
  });

  it('snapshot pages: one Provisional label with the runs behind its ⓘ; the export and its reason stay', async () => {
    openDowntime(`/downtime?${WINDOW}`);
    const status = await screen.findByTestId('snapshot-runs');
    expect(status).toHaveAttribute('data-run-ids', 'run-1,run-2');
    expect(within(status).getByTestId('figure-status')).toHaveTextContent('Provisional');
    expect(within(status).getByRole('button', { name: 'About Provisional figures' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Provisional', { ignore: 'option, script, style' })).toHaveLength(1));
    expect(screen.getByTestId('downtime-export')).toBeDisabled();
    expect(screen.queryByTestId('disabled-reason')).toBeNull();
    expect(screen.getByTestId('downtime-export-reason')).toHaveAttribute('title', expect.stringContaining('Revision to “Approved only”'));
    expect(document.body.textContent).not.toMatch(/tick “Approved only”/);
    // the label sits on the title's line, not on a row of its own
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toContainElement(status);
  });

  it('filters: one bottom-aligned row Units, what, window, From / To, Micro-stops, Revision last; labels above h-9 controls', async () => {
    openDowntime(`/downtime/trends?${WINDOW}`);
    const row = await screen.findByTestId('downtime-filters');
    expect(row.className).toContain('items-end');
    expect(row.className).toContain('gap-x-2');
    const order = ['filter-units', 'analysis-comparison', 'filter-products', 'filter-shifts', 'filter-crews', 'downtime-class', 'downtime-window', 'downtime-trend', 'downtime-micro', 'downtime-revision'];
    const found = Array.from(row.querySelectorAll('[data-testid], select, button[role="checkbox"]'))
      .map((node) => node.getAttribute('data-testid') ?? node.id)
      .filter((id, index, all) => order.includes(id) && all.indexOf(id) === index);
    expect(found).toEqual(order);
    for (const label of ['Compare', 'Schedule class', 'Window', 'Trend by', 'Revision']) {
      const control = screen.getByLabelText(label);
      expect(control.className).toContain('h-9');
      expect(control.parentElement?.className).toContain('flex-col');
    }
    expect(screen.queryByRole('checkbox', { name: 'Approved only' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Micro-stops' })).toBeInTheDocument();
  });

  it('Revision select: same choices and URL semantics as Reports (approved=1 ↔ Approved only)', async () => {
    openDowntime(`/downtime?${WINDOW}&approved=1`);
    const select = (await screen.findByLabelText('Revision')) as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).toEqual(['Approved only', 'Provisional']);
    expect(select.value).toBe('approved');
  });

  it('dates: From / To typed in the plant format with the calendar button, as on Reports', async () => {
    const { ProductionDateRange } = await import('./components/production-date-range');
    vi.spyOn(await import('@/features/ux-kit/use-operational-day-start'), 'useOperationalDayStart').mockReturnValue('06:00');
    render(<ProductionDateRange from="2026-10-17T02:30:00.000Z" to="2026-10-18T02:30:00.000Z" timeZone="Asia/Tehran" onChange={() => undefined} />);
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.queryByText('To (inclusive)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open calendar for From' })).toBeInTheDocument();
    expect(screen.getByLabelText('From').getAttribute('type')).not.toBe('date');
    // tightened so Units … Revision fit one line at 1440 px (measured: 1303 of 1328 px)
    expect(screen.getByTestId('downtime-dates').className).toContain('[&_input]:w-28');
  });
});

describe('Downtime analysis cleanup: Overview', () => {
  it('summary tiles: dashboard tiles with an ⓘ each and no caption; no current-stops or trend caption', async () => {
    openDowntime(`/downtime?${WINDOW}`);
    const tile = await screen.findByTestId('kpi-downtime_total');
    expect(within(tile).getByText('Total downtime').className).toContain('uppercase');
    expect(within(tile).getByRole('button', { name: 'About Total downtime' })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const caption of [/Union of stop time/, /Run time ÷ scheduled time/, /Current stops are live/, /Buckets use the plant/, /Share of stop time with a reason code/]) {
      expect(text).not.toMatch(caption);
    }
    expect(screen.getByRole('button', { name: 'About Trend by day' })).toBeInTheDocument();
    expect(screen.getByText('More downtime figures')).toBeInTheDocument();
  });

  it('chart colours: unplanned is the loss red, planned the neutral slate, from tokens', async () => {
    const { CLASS_COLOURS } = await import('./model/class-colours');
    expect(CLASS_COLOURS.unplanned.chart).toBe('hsl(var(--danger))');
    expect(CLASS_COLOURS.planned.chart).toBe('hsl(var(--chart-8))');
    expect(Object.values(CLASS_COLOURS).every((colour) => colour.chart.startsWith('hsl(var(--'))).toBe(true);
  });
});

describe('Downtime analysis cleanup: Stops & timeline', () => {
  it('stop records: the Event Hub list card titled "Stop records", no description', async () => {
    openDowntime(`/downtime/stops?${WINDOW}`);
    const card = await screen.findByTestId('event-list-card');
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(/^Stop records$/);
    expect(document.body.textContent).not.toMatch(/Open a stop to inspect its evidence|not restricted to approved period revisions/);
    expect(screen.getByLabelText('Show')).toHaveValue('list');
  });

  it('state timeline: a card with the legend; the hatched / outlined explanation is the ⓘ, no dates line', async () => {
    openDowntime(`/downtime/stops?${WINDOW}&presentation=timeline`);
    const timeline = await screen.findByTestId('state-timeline');
    expect(timeline).not.toHaveTextContent(/hatched = schedule class unknown|outlined = still ongoing/);
    expect(within(timeline).getByLabelText('Legend')).toHaveTextContent('Unplanned');
    expect(screen.getByRole('button', { name: 'About Stop timeline' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Schedule class')).toBeNull();
  });
});

describe('Downtime analysis cleanup: Causes & Pareto', () => {
  it('lost production: card with its ⓘ and one Provisional label; no ledger sentence or coverage line', async () => {
    openDowntime(`/downtime/causes?${WINDOW}`);
    await screen.findByTestId('lost-production');
    expect(screen.getByRole('button', { name: 'About Lost production by stop reason' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Availability losses of the plan ledger|Coverage 100/);
    await waitFor(() => expect(screen.getAllByText('Provisional', { ignore: 'option, script, style' })).toHaveLength(1));
    expect(screen.getByTestId('report-meta')).toHaveAttribute('data-run-count', '2');
    expect(screen.getByLabelText('Rank by')).toHaveValue('lost-production');
  });

  it('no losses: the card says so in the centred empty style, not the generic "No data for these dates"', async () => {
    openDowntime(`/downtime/causes?${WINDOW}`);
    const empty = await screen.findByTestId('card-empty');
    expect(empty).toHaveTextContent(/^No availability losses in this scope\.$/);
    expect(document.body.textContent).not.toMatch(/No data for these dates|Try other dates or units/);
  });

  it('a card without its own message keeps the generic empty state', async () => {
    const { ReportCard } = await import('./components/report-card');
    const query = { isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => undefined };
    render(<ReportCard title="Any" testId="any" query={query} response={undefined} isEmpty>{null}</ReportCard>);
    expect(screen.getByText('No data for these dates')).toBeInTheDocument();
    expect(screen.queryByTestId('card-empty')).toBeNull();
  });

  it('asset bad actors: the allocation note is the ⓘ', async () => {
    openDowntime(`/downtime/causes?${WINDOW}&analysis=assets`);
    await screen.findByRole('button', { name: 'About Asset bad actors' });
    expect(document.body.textContent).not.toMatch(/Allocated: overlapping stops/);
  });

  it('Pareto axis ticks: the reason code only, cut so slanted labels do not overlap', async () => {
    const { paretoAxisLabel } = await import('./model/reason-drill');
    expect(paretoAxisLabel('MECH-GEARBOX · Gearbox failure')).toBe('MECH-GEARBOX');
    expect(paretoAxisLabel('Not coded')).toBe('Not coded');
    expect(paretoAxisLabel('QUALITY-DOWNGRADE-LONG-CODE · x')).toBe('QUALITY-DOWNGRADE…');
  });
});

describe('Downtime analysis cleanup: Trends & comparisons', () => {
  it('crew comparison: the crew note is the ⓘ', async () => {
    openDowntime(`/downtime/trends?${WINDOW}&comparison=crew`);
    await screen.findByRole('button', { name: 'About Crew comparison' });
    expect(document.body.textContent).not.toMatch(/Crew of the shift each period belongs to/);
  });

  it('previous-period comparison: no header label; each window states its own approval on tiles in a card', async () => {
    openDowntime(`/downtime/trends?${WINDOW}&comparison=calendar`);
    const grid = await screen.findByTestId('calendar-comparison');
    await waitFor(() => expect(within(grid).getAllByTestId('report-meta')).toHaveLength(2));
    const [previous, chosen] = within(grid).getAllByTestId('figure-status');
    expect(previous).toHaveTextContent(/^Approved$/);
    expect(chosen).toHaveTextContent(/^Provisional$/);
    expect(screen.queryByTestId('snapshot-runs')).toBeNull();
    expect(within(grid).getAllByTestId('kpi-downtime_total')).toHaveLength(2);
    expect(grid).not.toHaveTextContent(/Union of stop time/);
  });

  it('time trend keeps the one header label', async () => {
    openDowntime(`/downtime/trends?${WINDOW}`);
    expect(await screen.findByTestId('snapshot-runs')).toHaveTextContent('Provisional');
  });
});

describe('Downtime analysis cleanup: Reliability', () => {
  it('failure definition and column notes are ⓘ; compact report table; one Provisional label', async () => {
    openDowntime(`/downtime/reliability?${WINDOW}`);
    await screen.findByRole('button', { name: 'About Reliability' });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Active repair from work orders|Full outage, failure to production resumed/);
    expect(screen.getByRole('button', { name: 'About Mean active repair time (MTTR)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Mean time to restore production' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Provisional', { ignore: 'option, script, style' })).toHaveLength(1));
  });
});
