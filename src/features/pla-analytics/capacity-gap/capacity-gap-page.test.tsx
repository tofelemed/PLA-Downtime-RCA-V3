import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { CapacityGapReportView, CapacityGapRowView, CapacityKindView } from '@/api/v2/types/capacity-gap';
import type { RateKind } from '@/api/v2/types/profiles';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({
  useEventHubEnv: () => ({ timezone: 'Asia/Tehran', units: [{ id: 'u1', name: 'Reactor 1' }], unitName: (id: string) => id }),
}));

const { CapacityGapPage } = await import('./capacity-gap-page');
const { asOfHeaderText, capacityGapQueryOf, parseCapacityFilters } = await import('./capacity-gap-model');
const { AnalyticsHeader } = await import('../components/analytics-header');

const kind = (value: string | null, timebase: CapacityKindView['timebase'] = 'h'): CapacityKindView => ({
  value,
  uom: value === null ? null : 't',
  timebase: value === null ? null : timebase,
  rateVersionId: value === null ? null : `r-${value}`,
  version: value === null ? null : 1,
  effectiveFrom: value === null ? null : '2026-10-01T00:00:00.000Z',
  effectiveTo: null,
});

const RATES: Record<RateKind, CapacityKindView> = {
  nameplate: kind('150'),
  demonstrated: kind('132.123456789'),
  sustained: kind('120', 'd'),
  planning: kind(null),
  budget: kind(null),
  forecast: kind('100'),
};

const ROW: CapacityGapRowView = {
  profileId: 'p1',
  profileVersion: 1,
  unitId: 'u1',
  unitName: 'Reactor 1',
  productId: 'pr1',
  productName: 'HDPE-A',
  operatingMode: 'normal',
  quantityUom: 't',
  rates: RATES,
  gaps: [
    { upper: 'nameplate', lower: 'demonstrated', gap: '17.876543211', ratio: '0.11917695', reason: null },
    { upper: 'demonstrated', lower: 'sustained', gap: null, ratio: null, reason: 'timebase_mismatch' },
    { upper: 'sustained', lower: 'planning', gap: null, ratio: null, reason: 'not_set' },
  ],
  ratios: [
    { numerator: 'sustained', denominator: 'nameplate', ratio: null, reason: 'timebase_mismatch' },
    { numerator: 'planning', denominator: 'sustained', ratio: null, reason: 'not_set' },
  ],
};

const REPORT: CapacityGapReportView = { at: '2026-10-19T08:00:00.000Z', items: [ROW], limit: 200, truncated: true, asOf: '2026-10-19T08:00:01.000Z' };

describe('Capacity gap page (plan 1.2)', () => {
  let urls: URL[];
  beforeEach(() => {
    urls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input);
        urls.push(url);
        const body = url.pathname.endsWith('/reports/capacity-gap') ? REPORT : { items: [], nextCursor: null, asOf: REPORT.asOf, scope: { tenantId: 'tenant-a' } };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderPage = (search = '') => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = { unitIds: ['u1'] } as Parameters<typeof CapacityGapPage>[0]['scope'];
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/pla-analytics/capacity-gap${search}`]}>
          <CapacityGapPage scope={scope} onChange={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders the server values, gaps and ratios as they come, "not set" for missing kinds', async () => {
    renderPage();
    const row = (await screen.findByText('HDPE-A')).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByTestId('capacity-nameplate')).toHaveTextContent('150 t per hour');
    expect(cells.getByTestId('capacity-demonstrated')).toHaveTextContent('132.123456789 t per hour');
    expect(cells.getByTestId('capacity-sustained')).toHaveTextContent('120 t per day');
    expect(cells.getByTestId('capacity-planning')).toHaveTextContent('not set');
    expect(cells.getByTestId('capacity-budget')).toHaveTextContent('not set');
    expect(cells.getByTestId('capacity-gap-0')).toHaveTextContent('17.876543211ratio 0.11917695');
    expect(cells.getByTestId('capacity-gap-1')).toHaveTextContent('different timebases (not converted)');
    expect(cells.getByTestId('capacity-gap-2')).toHaveTextContent('not set');
    expect(cells.getByTestId('capacity-ratio-planning')).toHaveTextContent('not set');
    expect(screen.getByTestId('capacity-gap-truncated')).toHaveTextContent('first 200 profiles');
  });

  it('states the kind definitions and sends units, products and the as-of instant to the server', async () => {
    renderPage('?products=pr1&asOf=2026-10-19');
    await screen.findByText('HDPE-A');
    expect(screen.getByTestId('capacity-gap-definitions')).toHaveTextContent('Sustained: approved sustainable capability (capacity ledger)');
    expect(screen.getByTestId('capacity-gap-definitions')).toHaveTextContent('never added together');
    const request = urls.find((url) => url.pathname.endsWith('/reports/capacity-gap'));
    expect(request?.searchParams.getAll('unitIds')).toEqual(['u1']);
    expect(request?.searchParams.getAll('productIds')).toEqual(['pr1']);
    // 00:00 Tehran (UTC+03:30) on the chosen plant date
    expect(request?.searchParams.get('at')).toBe('2026-10-18T20:30:00.000Z');
  });

  it('asks for "now" when no date is chosen and ignores a malformed one', () => {
    const filters = parseCapacityFilters(new URLSearchParams('asOf=19-10-2026'));
    expect(filters.asOf).toBe('');
    expect(capacityGapQueryOf([], filters, 'Asia/Tehran')).toEqual({});
  });

  it('the header names the as-of instant and the units, not the shared window or its zone badge', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = { unitIds: ['u1'], windowLabel: 'Last 7 days' } as Parameters<typeof AnalyticsHeader>[0]['scope'];
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsHeader scope={scope} title="Capacity gap" overview={false} asOfDate="2026-10-19" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('analytics-as-of-header')).toHaveTextContent('u1 · As of 2026-10-19');
    expect(screen.queryByText(/Last 7 days/)).toBeNull();
    expect(screen.queryByTestId('scope-header')).toBeNull();
    expect(asOfHeaderText('', { calendar: 'gregorian', digits: 'latin' })).toBe('As of now');
  });
});
