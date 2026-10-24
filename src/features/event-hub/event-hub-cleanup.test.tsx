import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ProductionEventView } from '@/api/v2/types/events';
import { actAs } from '@/test/acting-user';
import { defaultFilters } from './model/event-filters';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('./hooks/use-asset-options', () => ({ useAssetOptions: () => [] }));
vi.mock('@/api/v2/queries/units', () => ({ useShiftInstances: () => ({ data: undefined }) }));
vi.mock('@/api/v2/queries/reports', () => ({
  useDowntimeReport: () => ({
    data: { isProvisional: true, coverage: { ratio: 1 }, dataQuality: { missingCount: 0 }, data: { total: 3600, calculationRunIds: ['r1'] } },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
}));

const { nameRepeats, sameName } = await import('./model/name-repeats');
const { UnitLabel } = await import('./components/unit-label');
const { eventColumns } = await import('./components/event-columns');
const { EventStateCell } = await import('./components/event-state-cell');
const { EventFiltersBar } = await import('./components/event-filters-bar');
const { QuickStats } = await import('./components/quick-stats');
const { CurrentStopsPanel } = await import('./components/current-stops-panel');
const { EventListCard } = await import('./components/event-list-card');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [{ id: 'u1', code: 'Extruder1', name: 'HDPE Extruder 1', siteId: null }],
  unitsLoading: false, reasonCodes: [], allReasonCodes: [], unitName: () => 'HDPE Extruder 1', reasonName: () => '—', unitCode: () => 'Extruder1',
};
const EVENT = {
  id: 'e1', unitId: 'u1', assetId: 'a1', startTime: '2026-10-24T06:00:00.000Z', endTime: '2026-10-24T06:10:00.000Z', isOpen: false,
  durationSeconds: 600, elapsedSeconds: 600, asOf: '2026-10-24T07:00:00.000Z', sourceKind: 'source', source: 'PI',
  classification: { physicalType: 'downtime', scheduleClass: 'unplanned' }, states: { physical: 'closed', coding: 'coded', rca: 'none' },
  accountingState: 'draft', reasonCodeId: null, rowVersion: 1,
} as unknown as ProductionEventView;

let client: QueryClient;
let items: ProductionEventView[] = [];
const wrap = (node: ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  items = [];
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items, nextCursor: null, asOf: EVENT.asOf, scope: { tenantId: 'tenant-a' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  actAs('Engineer');
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('Event Hub cleanup (daily operations, 24 Oct 2026)', () => {
  it('page header has no description, scope line or timezone badge; actions stay', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'features', 'event-hub', 'event-hub-page.tsx'), 'utf8');
    expect(source).not.toMatch(/Stops, losses and other production events|ScopeHeader|All units in your scope|description=/);
    expect(source).toMatch(/ExportEventsButton/);
    expect(source).toMatch(/RcaTriggerSettingsLink/);
    expect(source).toMatch(/New event/);
  });

  it('a code that repeats the unit name is not shown after it (still the tooltip); a different one is', () => {
    expect(nameRepeats('HDPE Extruder 1', 'Extruder1')).toBe(true);
    expect(nameRepeats('Extruder Line 1', 'unit100')).toBe(false);
    expect(nameRepeats('Unit', '')).toBe(false);
    expect(nameRepeats('Extruder 11', 'Extruder1')).toBe(false);
    expect(nameRepeats('Line 1', '1')).toBe(false);
    expect(nameRepeats('Line 10', '10')).toBe(false);
    expect(nameRepeats('Pump 1', 'PUMP-1')).toBe(true);
    expect(sameName('HDPE Extruder 1', 'Extruder')).toBe(false);
    expect(sameName('HDPE Extruder 1', 'hdpe extruder-1')).toBe(true);
    const { unmount } = wrap(<UnitLabel unitId="u1" />);
    expect(screen.getByTestId('unit-label')).toHaveTextContent(/^HDPE Extruder 1$/);
    expect(screen.getByTestId('unit-label')).toHaveAttribute('title', 'Code Extruder1');
    unmount();
    render(
      <EventHubEnvContext.Provider value={{ ...ENV, unitName: () => 'Extruder 11' }}>
        <UnitLabel unitId="u1" />
      </EventHubEnvContext.Provider>,
    );
    expect(screen.getByTestId('unit-label')).toHaveTextContent('Extruder 11Extruder1');
  });

  it('the unit cell drops an asset named like the unit and keeps a different one', () => {
    const context = { unitName: ENV.unitName, reasonName: ENV.reasonName, dateTime: () => '', listSearch: '', prefetch: () => undefined };
    const unitCell = (assetName: string) => eventColumns({ ...context, assetName: () => assetName }).find((c) => c.id === 'unit')?.cell(EVENT, 0);
    const { unmount } = wrap(<>{unitCell('HDPE extruder-1')}</>);
    expect(screen.queryByTestId('event-asset')).toBeNull();
    unmount();
    wrap(<>{unitCell('Gearbox 2')}</>);
    expect(screen.getByTestId('event-asset')).toHaveTextContent('Gearbox 2');
    for (const partial of ['Extruder', 'HDPE']) {
      cleanup();
      wrap(<>{unitCell(partial)}</>);
      expect(screen.getByTestId('event-asset')).toHaveTextContent(partial);
    }
  });

  it('the accounting badge is left out while draft (explained by the States header ⓘ) and shown otherwise, on one line', () => {
    const { unmount } = wrap(<EventStateCell event={EVENT} />);
    expect(screen.queryByTestId('event-accounting-state')).toBeNull();
    expect(screen.queryByText('Accounting: draft')).toBeNull();
    unmount();
    wrap(<EventStateCell event={{ ...EVENT, accountingState: 'approved' } as ProductionEventView} />);
    expect(screen.getByTestId('event-accounting-state')).toHaveTextContent('Accounting: approved');
    expect(screen.getByTestId('event-accounting-state').className).toContain('whitespace-nowrap');
    const columns = eventColumns({ unitName: ENV.unitName, reasonName: ENV.reasonName, dateTime: () => '', listSearch: '', prefetch: () => undefined });
    render(<>{columns.find((c) => c.id === 'states')?.header}</>);
    expect(screen.getByRole('button', { name: 'About States' })).toBeInTheDocument();
  });

  it('filters: one bottom-aligned row in the order Units, Type, Reason, Window, Custom range, ongoing / ended; no shift hint', () => {
    const filters = defaultFilters({ from: '2026-10-17T00:00:00.000Z', to: '2026-10-24T00:00:00.000Z', label: 'Last 7 days' });
    wrap(<EventFiltersBar filters={filters} onChange={vi.fn()} onReset={vi.fn()} />);
    const row = screen.getByTestId('filter-units').parentElement as HTMLElement;
    expect(row.className).toContain('items-end');
    const ids = Array.from(row.querySelectorAll('[data-testid]')).map((node) => node.getAttribute('data-testid'));
    const order = ['filter-units', 'filter-physical-types', 'filter-reasons', 'event-window', 'event-window-custom', 'filter-open', 'more-filters', 'filter-to-code'];
    expect(ids.filter((id) => order.includes(id ?? ''))).toEqual(order);
    expect(screen.getByLabelText('Window')).toBe(screen.getByTestId('event-window'));
    expect(screen.getByLabelText('Ongoing or ended')).toBe(screen.getByTestId('filter-open'));
    expect(screen.queryByText(/Choose one unit to pick a shift/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
  });

  it('the downtime card is labelled "Downtime" without the window and keeps its Provisional label', () => {
    const filters = defaultFilters({ from: '2026-10-17T00:00:00.000Z', to: '2026-10-24T00:00:00.000Z', label: 'Last 7 days' });
    wrap(<QuickStats filters={filters} />);
    const card = screen.getByTestId('quick-stats');
    expect(within(card).getByText('Downtime')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('in window');
    expect(card).toHaveTextContent('Provisional');
  });

  it('no ongoing stop: the strip says "Current stops (0)" only', async () => {
    wrap(<CurrentStopsPanel unitIds={[]} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stops')).toHaveTextContent(/^Current stops \(0\)$/));
  });

  it('the list sits in an "Events" card with the report look; an empty list keeps its own message', async () => {
    items = [EVENT];
    const { unmount } = wrap(<EventListCard query={{ from: '2026-10-17T00:00:00.000Z', to: '2026-10-24T00:00:00.000Z' }} actions={<button>Merge</button>} />);
    const card = screen.getByTestId('event-list-card');
    expect(within(card).getByRole('heading', { level: 2, name: 'Events' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Merge' })).toBeInTheDocument();
    await waitFor(() => expect(within(card).getAllByRole('columnheader')[0].className).toContain('uppercase'));
    unmount();
    items = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrap(<EventListCard query={{ from: '2026-10-17T00:00:00.000Z', to: '2026-10-24T00:00:00.000Z' }} empty={{ title: 'Nothing to code', text: 'All stops in this window are coded.' }} />);
    expect(await screen.findByText('Nothing to code')).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
  });
});
