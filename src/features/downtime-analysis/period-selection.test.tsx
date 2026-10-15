import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { useDowntimeReport } from '@/api/v2/queries/reports';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { downtimeQuery, hasPeriodSelection, parseFilters, toSearchParams } = await import('./model/downtime-filters');
const { bundleQuery } = await import('./model/bundle-views');
const { KpiSummary } = await import('./components/kpi-summary');

const BASE = 'from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u1';

describe('Downtime product, shift and crew filters', () => {
  it('round-trip through the URL and stay out of it when unset', () => {
    const filters = parseFilters(new URLSearchParams(`${BASE}&products=p2,p1&shifts=Night,Day&crews=c1`), 0);
    expect(filters).toMatchObject({ productIds: ['p1', 'p2'], shiftNames: ['Day', 'Night'], crewIds: ['c1'] });
    expect(hasPeriodSelection(filters)).toBe(true);
    expect(parseFilters(toSearchParams(filters), 0)).toEqual(filters);
    const plain = parseFilters(new URLSearchParams(BASE), 0);
    expect(hasPeriodSelection(plain)).toBe(false);
    expect(toSearchParams(plain).has('products')).toBe(false);
    expect(downtimeQuery(plain, 'reason')).not.toHaveProperty('productIds');
  });

  it('are sent to the downtime report and the bundle', () => {
    const filters = parseFilters(new URLSearchParams(`${BASE}&shifts=Day&crews=c1&products=p1`), 0);
    expect(downtimeQuery(filters, 'reason')).toMatchObject({ productIds: ['p1'], shiftNames: ['Day'], crewIds: ['c1'] });
    expect(bundleQuery(filters)).toMatchObject({ productIds: ['p1'], shiftNames: ['Day'], crewIds: ['c1'] });
  });

  describe('on the wire', () => {
    let urls: URL[];
    let client: QueryClient;
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    beforeEach(() => {
      urls = [];
      client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          urls.push(new URL(url));
          return new Response(JSON.stringify({ data: { groups: [], summary: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }),
      );
      configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('repeats each selection parameter', async () => {
      const filters = parseFilters(new URLSearchParams(`${BASE}&shifts=A,B&crews=c1`), 0);
      renderHook(() => useDowntimeReport(downtimeQuery(filters, 'reason'), 'UTC'), { wrapper });
      await waitFor(() => expect(urls).toHaveLength(1));
      expect(urls[0].searchParams.getAll('shiftNames')).toEqual(['A', 'B']);
      expect(urls[0].searchParams.getAll('crewIds')).toEqual(['c1']);
    });
  });
});

describe('Controllable availability view (SME D15)', () => {
  const summary = [
    { metric: 'scheduled_availability', value: '0.75', numerator: '21600', denominator: '28800', quality: 'ok', reason: null },
    { metric: 'controllable_availability', value: '1', numerator: '28800', denominator: '28800', quality: 'ok', reason: null },
  ];
  const response = {
    data: { summary },
    calculationRunId: null,
    policyVersion: null,
    dataQuality: { missingCount: 0, provisionalCount: 0 },
    coverage: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', ratio: 1 },
    isProvisional: false,
    asOf: '2026-10-08T00:00:00.000Z',
    scope: { tenantId: 'tenant-a' },
  };
  const bundle = { data: response, isLoading: false, isError: false, isSuccess: true, refetch: () => undefined } as unknown as Parameters<typeof KpiSummary>[0]['bundle'];

  it('is hidden until switched on; the headline availability stays', () => {
    render(<KpiSummary bundle={bundle} />);
    expect(screen.getByTestId('kpi-scheduled_availability')).toHaveAttribute('data-value', '0.75');
    expect(screen.queryByTestId('kpi-controllable_availability')).toBeNull();
    fireEvent.click(screen.getByTestId('controllable-switch'));
    expect(screen.getByTestId('kpi-controllable_availability')).toHaveAttribute('data-value', '1');
    expect(screen.getByTestId('kpi-scheduled_availability')).toBeInTheDocument();
  });
});
