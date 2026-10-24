import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { ProfileView } from '@/api/v2/types/profiles';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const REFS = {
  timezone: 'Asia/Tehran', timezoneIsFallback: false, unitOptions: [{ value: 'u1', label: 'Unit 1' }], productOptions: [{ value: 'p1', label: 'HDPE (P1)' }],
  siteOptions: [], defaultSiteId: 's1', unitName: () => 'Unit 1', productName: () => 'HDPE', loading: false,
};
const PROFILE = {
  id: 'pr9', unitId: 'u1', productId: 'p1', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'h', capacityModel: 'single_stream', version: 1, state: 'draft',
  effectiveFrom: '2026-10-10T02:30:00.000Z', effectiveTo: null, rowVersion: 1, rates: [], valuationRates: [],
} as unknown as ProfileView;

vi.mock('./hooks/use-planning-refs', () => ({ usePlanningRefs: () => REFS }));
vi.mock('./hooks/use-profile-reads', async (original) => ({
  ...(await original<typeof import('./hooks/use-profile-reads')>()),
  useProfile: () => ({ data: PROFILE, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

const { ProfilesTab } = await import('./profiles/profiles-tab');
const { ProfilesHeaderActions } = await import('./profiles/profiles-header-actions');
const { ProfilePage } = await import('./profiles/profile-page');
const { CalendarsTab } = await import('./calendars/calendars-tab');
const { CalendarsHeaderActions } = await import('./calendars/calendars-header-actions');
const { NewCalendarVersionPage } = await import('./calendars/calendar-editor-page');

const EMPTY = { items: [], nextCursor: null };

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

const wrap = (node: ReactNode, at: string, path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Where />
        <Routes>
          <Route path={path} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const back = (list: string) => `back=${encodeURIComponent(list)}`;

// SETUP_UX_FIXES Phase 3: list filters live in the URL and sub-pages return to the list as it was left
describe('Setup sub-pages keep the list context', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(EMPTY), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('profiles: the unit and product filters are in the URL and the sub-page links carry the list address', () => {
    wrap(<><ProfilesHeaderActions tab="profiles" /><ProfilesTab /></>, '/setup/profiles?unitId=u1', '/setup/profiles');
    expect((screen.getByLabelText('Unit') as HTMLSelectElement).value).toBe('u1');
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'p1' } });
    expect(screen.getByTestId('where')).toHaveTextContent('/setup/profiles?unitId=u1&productId=p1');
    expect(screen.getByTestId('profile-new')).toHaveAttribute('href', `/planning/profiles/new?${back('/setup/profiles?unitId=u1&productId=p1')}`);
  });

  it('profile page: "Back to Profiles & rates" returns to the filtered list; the area tab row stays, Profiles & rates highlighted', () => {
    wrap(<ProfilePage />, `/planning/profiles/pr9?${back('/setup/profiles?unitId=u1&productId=p1')}`, '/planning/profiles/:profileId');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/setup/profiles?unitId=u1&productId=p1');
    expect(screen.getByTestId('page-back')).toHaveTextContent('Back to Profiles & rates');
    const row = screen.getByRole('navigation', { name: 'Pages of this setup area' });
    expect(within(row).getByRole('link', { current: 'page' })).toHaveTextContent('Profiles & rates');
    expect(within(row).getByRole('link', { name: 'Streams' })).toHaveAttribute('href', '/setup/profiles?tab=streams&unitId=u1');
  });

  it('profile page without a list address goes back to the list; a foreign address is ignored', () => {
    wrap(<ProfilePage />, `/planning/profiles/pr9?${back('/admin')}`, '/planning/profiles/:profileId');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/setup/profiles');
  });

  it('calendars: the unit is in the URL; a new version returns to the same unit on Back and Cancel', () => {
    // "New calendar version" is beside the page title (CalendarsHeaderActions), the list below it
    const { unmount } = wrap(<><CalendarsHeaderActions /><CalendarsTab /></>, '/setup/calendars', '/setup/calendars');
    fireEvent.change(screen.getByLabelText(/Calendar of/), { target: { value: 'u1' } });
    expect(screen.getByTestId('where')).toHaveTextContent('/setup/calendars?unitId=u1');
    expect(screen.getByTestId('calendar-new')).toHaveAttribute('href', `/planning/calendars/new?unitId=u1&${back('/setup/calendars?unitId=u1')}`);
    unmount();
    wrap(<NewCalendarVersionPage />, `/planning/calendars/new?unitId=u1&${back('/setup/calendars?unitId=u1')}`, '/planning/calendars/new');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/setup/calendars?unitId=u1');
    expect(screen.getByTestId('calendar-cancel')).toHaveAttribute('href', '/setup/calendars?unitId=u1');
  });
});
