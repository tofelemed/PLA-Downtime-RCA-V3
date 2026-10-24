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
const envelope = (data: unknown) => ({
  data, asOf: TO, calculationRunId: null, policyVersion: null, scope: { tenantId: 'tenant-a' }, coverage: { from: FROM, to: TO, ratio: 1 },
  dataQuality: { missingCount: 0, provisionalCount: 0 }, isProvisional: true,
});
const REPORT = {
  calculationRunIds: ['run-1', 'run-2'], groups: [], total: '0', totals: [], views: [], units: [], groupBy: 'reason', metric: 'duration', unit: 's', scheduleClass: null,
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
    if (url.pathname.includes('/reports/')) return json(envelope(REPORT));
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
    await waitFor(() => expect(screen.getAllByText('Provisional')).toHaveLength(1));
    expect(screen.getByTestId('downtime-export')).toBeDisabled();
    expect(screen.getByTestId('disabled-reason')).toHaveTextContent('approved figures only');
  });

  it('filters: one bottom-aligned row in the order Units, what, window, then the toggles; labels above h-9 controls', async () => {
    openDowntime(`/downtime/trends?${WINDOW}`);
    const row = await screen.findByTestId('downtime-filters');
    expect(row.className).toContain('items-end');
    const order = ['filter-units', 'analysis-comparison', 'filter-products', 'filter-shifts', 'filter-crews', 'downtime-class', 'downtime-window', 'downtime-trend', 'downtime-micro', 'downtime-approved'];
    const found = Array.from(row.querySelectorAll('[data-testid], select, button[role="checkbox"]'))
      .map((node) => node.getAttribute('data-testid') ?? node.id)
      .filter((id, index, all) => order.includes(id) && all.indexOf(id) === index);
    expect(found).toEqual(order);
    for (const label of ['Compare', 'Schedule class', 'Window', 'Trend by']) {
      const control = screen.getByLabelText(label);
      expect(control.className).toContain('h-9');
      expect(control.parentElement?.className).toContain('flex-col');
    }
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
