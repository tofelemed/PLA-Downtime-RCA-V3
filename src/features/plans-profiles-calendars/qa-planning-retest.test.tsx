import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { PlanVersionView } from '@/api/v2/types/plans';
import type { ProfileView } from '@/api/v2/types/profiles';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { operatingModeLabel } = await import('./model/plan-labels');
const { targetUomOf } = await import('./model/plan-target-uom');
const { calendarVersionPath } = await import('./model/calendar-paths');
const { CalendarVersionPage } = await import('./calendars/calendar-editor-page');
const { RateTable } = await import('./profiles/rate-table');
const { PlanVersionSummary } = await import('./plans/plan-version-summary');
const { SlicesTable } = await import('./plans/slices-table');
const { PLANNING_ROUTES } = await import('@/app/routes/production-planning');
const { outsidePlanMessage } = await import('@/features/plan-dashboard/model/period-grid-params');
const { PeriodGridFilters } = await import('@/features/plan-dashboard/components/period-grid-filters');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const PROFILE = { id: 'pr1', unitId: 'u1', productId: 'p1', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'hour', state: 'approved', version: 1 } as unknown as ProfileView;
const RATE = { id: 'r1', profileId: 'pr1', rateKind: 'planning', rate: '28', timebase: 'hour', ratePerSecond: '0.00777778', version: 1, state: 'approved', source: 'manual', effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null, createdBy: 'x' };
const PUBLISHED = {
  id: 'cal-1', version: 2, state: 'published', siteId: 's1', unitId: null, timezone: 'Asia/Tehran', operationalDayStart: '06:00', effectiveFrom: '2026-10-01',
  effectiveTo: null, shiftTemplates: [], workingIntervals: [], holidays: [], exclusions: [], publishedBy: null, publishedAt: null, republishReason: null, rowVersion: 1,
};
const VERSION = {
  id: 'v1', planId: 'plan-1', version: 1, unitId: 'u1', validFrom: '2026-10-17T02:30:00.000Z', validTo: '2026-10-18T02:30:00.000Z', basis: 'quantity',
  headerTarget: '672', distribution: 'scheduled_capacity', approvalState: 'approved',
  slices: [{ id: 's1', position: 0, productId: 'p1', activeFrom: '2026-10-17T02:30:00.000Z', activeTo: '2026-10-18T02:30:00.000Z', weight: null, target: null, stream: 'sequential' }],
} as unknown as PlanVersionView;
const REFS = {
  timezone: 'Asia/Tehran', timezoneIsFallback: false, unitOptions: [], productOptions: [], siteOptions: [], defaultSiteId: null,
  unitName: () => 'HDPE Extruder 1', productName: () => 'HDPE grade A', loading: false,
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('QA planning re-test (19 Oct)', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode, at = '/') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[at]}>
          <Where />
          {node}
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/calendar-versions/cal-1')) return json(PUBLISHED);
      if (path.endsWith('/rates')) return json({ items: [RATE], nextCursor: null });
      if (path.endsWith('/profiles')) return json({ items: [PROFILE], nextCursor: null });
      return json({ items: [], nextCursor: null });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('operating modes read as words, not stored values', () => {
    expect(operatingModeLabel('normal')).toBe('Normal');
    expect(operatingModeLabel('reduced_rate')).toBe('Reduced rate');
  });

  it('a published calendar version opens on its read-only URL; a writable draft on /edit', () => {
    expect(calendarVersionPath({ id: 'c', state: 'published' }, true)).toBe('/planning/calendars/c');
    expect(calendarVersionPath({ id: 'c', state: 'draft' }, true)).toBe('/planning/calendars/c/edit');
    expect(calendarVersionPath({ id: 'c', state: 'draft' }, false)).toBe('/planning/calendars/c');
    expect(PLANNING_ROUTES.some((r) => r.path === '/planning/calendars/:versionId')).toBe(true);
  });

  it('/edit of a published version redirects to the view URL', async () => {
    wrap(
      <Routes>
        <Route path="/planning/calendars/:versionId" element={<CalendarVersionPage />} />
        <Route path="/planning/calendars/:versionId/edit" element={<CalendarVersionPage />} />
      </Routes>,
      '/planning/calendars/cal-1/edit',
    );
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/planning/calendars/cal-1'), { timeout: 5000 });
    expect(await screen.findByTestId('calendar-cancel', {}, { timeout: 5000 })).toHaveTextContent('Back to calendars');
  });

  it('rate table: no empty Actions column for a reader; approvers keep it', async () => {
    actAs('production_engineer');
    const reader = wrap(<RateTable profile={PROFILE} timezone="Asia/Tehran" />);
    expect(await screen.findByTestId('rate-row')).toHaveAttribute('data-state', 'approved');
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    reader.unmount();
    actAs('manager_approver');
    wrap(<RateTable profile={PROFILE} timezone="Asia/Tehran" />);
    expect(await screen.findByRole('columnheader', { name: 'Actions' })).toBeTruthy();
  });

  it('the plan header target names its unit; empty slice cells say why', async () => {
    expect(targetUomOf([PROFILE], ['p1'])).toBe('t');
    expect(targetUomOf([PROFILE, { productId: 'p2', quantityUom: 'kg' }], ['p1', 'p2'])).toBeNull();
    wrap(<PlanVersionSummary version={VERSION} timezone="Asia/Tehran" uom="t" />);
    expect(screen.getByTestId('plan-header-target').textContent).toMatch(/672\.00\s+t/);
    wrap(<SlicesTable version={VERSION} refs={REFS} uom="t" />);
    expect(screen.getByText('Not used')).toBeTruthy();
    expect(screen.getByText('Header target')).toBeTruthy();
  });

  it('Go to date outside the plan says so and that the grid shows the plan from its start', () => {
    const bounds = { min: '2026-10-17', max: '2026-10-22' };
    expect(outsidePlanMessage('2026-10-18', bounds, (d) => d)).toBeNull();
    expect(outsidePlanMessage('', bounds, (d) => d)).toBeNull();
    const message = '2026-09-01 is outside this plan (2026-10-17 – 2026-10-22): showing it from the plan start.';
    expect(outsidePlanMessage('2026-09-01', bounds, (d) => d)).toBe(message);
    const params = { workflow: '' as const, residual: '' as const, date: '2026-09-01', view: 'current' as const };
    wrap(<PeriodGridFilters params={params} onParam={vi.fn()} view="current" onView={vi.fn()} bounds={bounds} />);
    expect(screen.getByTestId('grid-date-outside').textContent).toContain('is outside this plan');
  });
});
