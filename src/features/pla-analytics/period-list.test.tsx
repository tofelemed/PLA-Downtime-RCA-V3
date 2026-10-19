import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationStatusView } from '@/api/v2/types/pla-analytics';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', units: [], unitName: (id: string) => `Unit ${id}` }) }));
const STATUS = {
  periods: 5, waitingForData: 0, rejectionEscalated: 0, overdueCount: 0, overdue: [], ages: [],
  sla: { submitWithinHours: 12, approveWithinHours: 24 },
  workflow: [{ state: 'draft', periods: 2 }, { state: 'approved', periods: 0 }],
  residual: [{ state: 'unaccounted', periods: 3 }],
} as unknown as ReconciliationStatusView;
vi.mock('@/api/v2/queries/pla-analytics', async (original) => ({
  ...await original<typeof import('@/api/v2/queries/pla-analytics')>(),
  useReconciliationStatus: () => ({ data: { data: STATUS, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { parseScope } = await import('./model/analytics-scope');
const { parsePeriodListFilter, periodListQuery, withPeriodList } = await import('./model/period-list');
const { ReconciliationView } = await import('./tabs/reconciliation-view');

const SEARCH = 'from=2026-10-11T00:00:00.000Z&to=2026-10-18T00:00:00.000Z&window=Last 7 days&units=u2,u1';
const SCOPE = parseScope(new URLSearchParams(SEARCH), 0);
const row = (periodId: string, planId: string | null) => ({ periodId, planId, unitId: 'u1', utcStart: '2026-10-12T06:00:00.000Z', utcEnd: '2026-10-12T14:00:00.000Z', localDate: '2026-10-12', shiftName: 'Day', workflowState: 'draft', plan: { residualState: 'unaccounted' } });

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

describe('cross-plan period list behind the reconciliation counts (UX D-6)', () => {
  let urls: URL[];
  let pages: Array<{ items: unknown[]; nextCursor: string | null }>;
  const open = (search = SEARCH) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/pla-analytics/reconciliation?${search}`]}>
      <Routes><Route path="*" element={<><ReconciliationView scope={SCOPE} /><Location /></>} /></Routes></MemoryRouter></QueryClientProvider>);

  beforeEach(() => {
    urls = [];
    pages = [{ items: [], nextCursor: 'c1' }, { items: [row('p1', 'plan-a'), row('p2', null)], nextCursor: null }];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      const page = parsed.searchParams.get('cursor') === 'c1' ? pages[1] : pages[0];
      return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads a workflow or residual state from ?periods= and builds the server query of the scope', () => {
    expect(parsePeriodListFilter(new URLSearchParams('periods=draft'))).toEqual({ kind: 'workflow', state: 'draft' });
    expect(parsePeriodListFilter(new URLSearchParams('periods=over_accounted'))).toEqual({ kind: 'residual', state: 'over_accounted' });
    expect(parsePeriodListFilter(new URLSearchParams('periods=constructor'))).toBeNull();
    expect(periodListQuery(SCOPE, { kind: 'residual', state: 'unaccounted' })).toEqual({ from: SCOPE.from, to: SCOPE.to, view: 'current', sort: '-utcStart', unitIds: ['u1', 'u2'], residualStates: ['unaccounted'] });
    expect(periodListQuery(SCOPE, { kind: 'workflow', state: 'draft' }).workflowState).toEqual(['draft']);
    expect(withPeriodList(new URLSearchParams('a=1&periods=draft'), '')).toBe('?a=1');
  });

  it('a non-zero count links to its list; zero counts stay plain', () => {
    open();
    expect(screen.getByTestId('workflow-count-link')).toHaveAttribute('data-key', 'draft');
    expect(screen.getAllByTestId('workflow-count-link')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('residual-count-link'));
    expect(screen.getByTestId('location')).toHaveTextContent('periods=unaccounted');
  });

  it('lists every plan of the scope, pages past a short (empty) filtered page and links each period to its plan', async () => {
    open(`${SEARCH}&periods=unaccounted`);
    expect(await screen.findAllByTestId('period-list-row')).toHaveLength(2);
    expect(urls).toHaveLength(2);
    expect(urls[0].searchParams.getAll('residualStates')).toEqual(['unaccounted']);
    expect(urls[0].searchParams.get('sort')).toBe('-utcStart');
    expect(urls[0].searchParams.get('planId')).toBeNull();
    expect(screen.getByTestId('period-list-link')).toHaveAttribute('href', '/plans/plan-a/periods/p1');
    // QA re-test N7: the shared no-plan wording, not a terse "no plan"
    expect(screen.getByTestId('no-plan')).toHaveTextContent('No approved plan covers this period');
    expect(screen.queryByText('no plan')).toBeNull();
    expect(screen.queryByText('No production periods in this state.')).toBeNull();
    fireEvent.click(screen.getByTestId('period-list-back'));
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('periods='));
  });
});
