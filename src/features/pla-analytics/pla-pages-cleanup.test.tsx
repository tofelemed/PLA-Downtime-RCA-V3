import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));
vi.mock('@/features/event-hub/event-hub-env', () => ({ EventHubEnvProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ tenantId: 'tenant-a', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [], unitsLoading: false, allReasonCodes: [], reasonCodes: [], unitName: (id: string) => id, reasonName: (id: string) => id }) }));
vi.mock('@/features/plan-dashboard/components/waterfall-chart', () => ({ WaterfallChart: () => <div>Waterfall chart</div> }));
vi.mock('@/features/pla-analytics/charts/series-chart', () => ({
  SeriesChart: ({ series }: { series: ReadonlyArray<{ label: string; colour?: string }> }) => <output data-testid="chart-series">{series.map((entry) => `${entry.label}=${entry.colour ?? ''}`).join(';')}</output>,
}));
vi.mock('@/features/pla-analytics/hooks/use-production-day-start', () => ({ useProductionDayStart: () => ({ dayStart: '06:00', loading: false }) }));

const fixture = vi.hoisted(() => ({ overdue: true }));
const { PlaAnalyticsPage } = await import('./pla-analytics-page');
const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-08T00:00:00.000Z';
const WINDOW = `from=${FROM}&to=${TO}&units=u1`;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const envelope = (data: unknown) => ({ data, asOf: TO, calculationRunId: null, policyVersion: null, scope: { tenantId: 'tenant-a' }, coverage: { from: FROM, to: TO, ratio: 1 }, dataQuality: { missingCount: 0, provisionalCount: 0 }, isProvisional: true });

function reportData(url: URL): object {
  const base = { calculationRunIds: ['run-1'], groups: [], total: [], totals: [], summary: [], views: [], units: [] };
  if (url.pathname.endsWith('/lines-without-event')) return { items: [], total: 0 };
  if (url.pathname.endsWith('/scope-waterfall')) return { ...base, ledger: 'plan', opening: '224', closing: '190', closes: true, uom: 't', bars: [{ key: 'target', label: 'Plan target', kind: 'total', delta: null, start: '0', end: '224' }], excluded: [] };
  if (url.pathname.endsWith('/loss-value')) return { ...base, total: { currencies: [] }, components: [] };
  if (url.pathname.endsWith('/reconciliation-status')) {
    const overdue = [{ periodId: 'p1', unitId: 'u1', unitName: 'Extruder 1', planId: null, localDate: '2026-10-02', shiftName: 'A', utcStart: FROM, workflowState: 'draft', revision: 1, residualState: null, ageSeconds: 7200 }];
    return { ...base, periods: 3, waitingForData: 2, rejectionEscalated: 0, overdueCount: fixture.overdue ? 1 : 0, overdue: fixture.overdue ? overdue : [], workflow: [{ state: 'draft', periods: 3 }], residual: [], ages: [], sla: { submitWithinHours: 12, approveWithinHours: 24 } };
  }
  if (url.pathname.endsWith('/oee')) {
    const total = ['availability', 'performance', 'quality', 'oee'].map((metric) => ({ metric, value: '0.9', numerator: '9', denominator: '10', unit: 'ratio', quality: 'provisional', reason: null, rows: 1, missing: 0 }));
    return { ...base, label: 'Operational OEE (ISO 22400)', policy: 'operational', groupBy: url.searchParams.get('groupBy'), groups: [{ key: '2026-10-01', metrics: total }], total };
  }
  return { ...base, groupBy: url.searchParams.get('groupBy'), metric: 'qty' };
}

const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('PLA analysis pages cleanup (owner direction, 24 Oct 2026)', () => {
  let client: QueryClient;
  const open = (path: string) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            {PLA_PAGES.map((page) => (
              <Route key={page.path} path={page.path} element={<PlaAnalyticsPage />} />
            ))}
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  beforeEach(() => {
    fixture.overdue = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.includes('/reports/')) return json(envelope(reportData(url)));
      return json({ items: [], nextCursor: null, asOf: TO, scope: { tenantId: 'tenant-a' } });
    }));
  });
  afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
  });

  it('the header is the title, export and the runs: no description, scope line, timezone badge or grouping note', async () => {
    open(`/pla-analytics?${WINDOW}`);
    expect(await screen.findByTestId('waterfall')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Production loss analysis · Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-runs')).toHaveAttribute('data-run-ids', 'run-1');
    expect(screen.queryByTestId('scope-header')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Trace plan or capacity|Periods are grouped|Asia\/Tehran|\+03:30|Baseline:|Unit: t/);
  });

  it('the filter bar is one bottom-aligned row: Units, then the window, the ledger and the revision, labels above', async () => {
    open(`/pla-analytics?${WINDOW}`);
    const bar = await screen.findByTestId('analytics-filters');
    expect(bar).toHaveClass('items-end');
    const units = within(bar).getByTestId('filter-units');
    const window = within(bar).getByLabelText('Window');
    const ledger = within(bar).getByRole('group', { name: 'Ledger' });
    const revision = within(bar).getByLabelText('Revision');
    expect(before(units, window) && before(window, ledger) && before(ledger, revision)).toBe(true);
    expect(within(ledger).getByTestId('ledger-plan')).toHaveTextContent(/^Plan$/);
    expect(revision).toHaveValue('shown');
    expect(window).not.toHaveTextContent(/^Window/);
  });

  it('the overview card is a report card: one "Provisional" marker beside its title, no caption', async () => {
    open(`/pla-analytics?${WINDOW}`);
    await screen.findByTestId('waterfall');
    const card = screen.getByTestId('pla-waterfall');
    expect(within(card).getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(within(card).getAllByTestId('provisional-mark')).toHaveLength(1);
    expect(screen.getAllByText('Provisional', { selector: '[data-testid="provisional-mark"]' })).toHaveLength(1);
  });

  it('Overview: the waterfall title does not repeat the ledger; its totals are KPI tiles with an ⓘ definition', async () => {
    open(`/pla-analytics?${WINDOW}`);
    await screen.findByTestId('waterfall');
    const card = screen.getByTestId('pla-waterfall');
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(/^Waterfall · target → actual$/);
    const tiles = within(card).getAllByTestId(/^waterfall-total-/);
    expect(tiles.map((tile) => tile.querySelector('span')?.textContent)).toEqual(['Plan target', 'Actual good output']);
    expect(tiles[0].querySelector('span')).toHaveClass('uppercase');
    expect(within(card).getByRole('button', { name: 'About Plan target' })).toBeInTheDocument();
  });

  it('Loss breakdown: "Explore" is a filter-bar field after Units and before the window; no loss-events note', async () => {
    open(`/pla-analytics/losses?${WINDOW}&breakdown=loss-events`);
    const bar = await screen.findByTestId('analytics-filters');
    const explore = within(bar).getByLabelText('Explore');
    expect(explore).toHaveValue('loss-events');
    expect(before(within(bar).getByTestId('filter-units'), explore) && before(explore, within(bar).getByLabelText('Window'))).toBe(true);
    expect(document.body.textContent).not.toMatch(/Events are current operational records/);
  });

  it('Loss breakdown: the loss tree Group by and Metric are filter-bar fields; its title does not repeat the ledger, no caption', async () => {
    open(`/pla-analytics/losses?${WINDOW}`);
    const card = await screen.findByTestId('pla-loss-tree');
    const bar = screen.getByTestId('analytics-filters');
    const explore = within(bar).getByLabelText('Explore');
    const groupBy = within(bar).getByLabelText('Group by');
    expect(before(explore, groupBy) && before(groupBy, within(bar).getByLabelText('Metric'))).toBe(true);
    expect(within(card).queryByLabelText('Group by')).toBeNull();
    expect(within(card).getByRole('heading', { level: 2 })).not.toHaveTextContent(/ledger/);
    expect(card).not.toHaveTextContent(/From the calculated loss lines/);
  });

  it('Loss events: the event type is a filter-bar field; the list is a titled report card', async () => {
    open(`/pla-analytics/losses?${WINDOW}&breakdown=loss-events`);
    const card = await screen.findByTestId('loss-events-card');
    expect(within(card).getByRole('heading', { level: 2, name: 'Loss events' })).toBeInTheDocument();
    expect(within(screen.getByTestId('analytics-filters')).getByLabelText('Event type')).toHaveValue('all');
  });

  it('Trends: Show, Trend by and the OEE policy are filter-bar fields; no "Operational" or "(ISO 22400)"', async () => {
    open(`/pla-analytics/trends?${WINDOW}`);
    const bar = await screen.findByTestId('analytics-filters');
    expect(within(bar).getByLabelText('Show')).toHaveValue('oee');
    expect(within(bar).getByLabelText('Trend by')).toBeInTheDocument();
    const policy = within(bar).getByLabelText('OEE');
    expect(within(policy).getAllByRole('option').map((option) => option.textContent)).toEqual(['OEE', 'Reconciled PLA OEE']);
    expect(await screen.findByTestId('pla-oee-trend')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Operational|ISO 22400|Buckets use the plant/);
  });

  it('Trends: the OEE lines read OEE, Availability, Performance, Quality in the dashboard colours (server order reordered, nothing computed)', async () => {
    open(`/pla-analytics/trends?${WINDOW}`);
    expect(await screen.findByTestId('chart-series')).toHaveTextContent(
      'OEE=hsl(var(--chart-1));Availability=hsl(var(--chart-8));Performance=hsl(var(--chart-2));Quality=hsl(var(--warning))',
    );
  });

  it('OEE: tiles and columns read OEE, Availability, Performance, Quality; one Provisional marker per card, none per row; no captions', async () => {
    open(`/pla-analytics/oee?${WINDOW}`);
    const card = await screen.findByTestId('pla-oee-operational');
    await within(card).findByTestId('oee-operational-units');
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(/^OEE$/);
    expect(within(card).getAllByTestId(/^oee-operational-(oee|availability|performance|quality)$/).map((tile) => tile.getAttribute('data-testid'))).toEqual(['oee-operational-oee', 'oee-operational-availability', 'oee-operational-performance', 'oee-operational-quality']);
    const headers = within(within(card).getByTestId('oee-operational-units')).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers.slice(1)).toEqual(['OEE', 'Availability', 'Performance', 'Quality']);
    expect(within(card).getAllByTestId('provisional-mark')).toHaveLength(1);
    expect(card).not.toHaveTextContent(/ISO 22400|run time ÷ scheduled time|good ÷ total output/);
  });

  it('Reconciliation: the period count is in the title, waiting / escalated are badges, no counts sentence, no "revision 1" on every row', async () => {
    open(`/pla-analytics/reconciliation?${WINDOW}`);
    const status = await screen.findByTestId('reconciliation-status');
    const card = screen.getByTestId('pla-reconciliation');
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Reconciliation status and age (3 periods)');
    expect(within(status).getByText('Waiting for data: 2')).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/overdue = not submitted|revision 1/);
    expect(within(card).getByRole('button', { name: 'About Reconciliation status and age (3 periods)' })).toBeInTheDocument();
    expect(within(screen.getByTestId('analytics-filters')).getByLabelText('Inspect')).toHaveValue('status');
  });

  it('a real empty result keeps its own message, centred, without the generic "No data for these dates"', async () => {
    fixture.overdue = false;
    open(`/pla-analytics/reconciliation?${WINDOW}`);
    expect(await screen.findByText('Nothing overdue.')).toBeInTheDocument();
    expect(screen.queryByText(/No data for these dates|Try other dates/)).toBeNull();
  });

  it('an empty loss tree says "No loss lines in this scope.", not the generic report text', async () => {
    open(`/pla-analytics/losses?${WINDOW}`);
    expect(await screen.findByText('No loss lines in this scope.')).toBeInTheDocument();
    expect(screen.queryByText(/No data for these dates|Try other dates/)).toBeNull();
  });

  it('Loss events: the attributed quantities can include drafts, so the card carries the Provisional marker', async () => {
    open(`/pla-analytics/losses?${WINDOW}&breakdown=loss-events`);
    const card = await screen.findByTestId('loss-events-card');
    expect(await within(card).findByTestId('provisional-mark')).toBeInTheDocument();
    expect(await within(card).findByText('No loss events in this window.')).toBeInTheDocument();
  });

  it('Loss valuation: the basis is in the filter bar; no explanatory paragraph or caption, the ledger is not repeated in the title', async () => {
    open(`/pla-analytics/valuation?${WINDOW}`);
    const bar = await screen.findByTestId('analytics-filters');
    expect(within(bar).getByLabelText('Valuation basis')).toHaveValue('margin');
    expect(document.body.textContent).not.toMatch(/Values use the approved policy/);
    const card = await screen.findByTestId('report-loss-value');
    expect(within(card).getByRole('heading', { level: 2 })).not.toHaveTextContent(/ledger/);
    expect(within(card).getByRole('button', { name: /^About Loss value/ })).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/Valued from each period/);
  });
});
