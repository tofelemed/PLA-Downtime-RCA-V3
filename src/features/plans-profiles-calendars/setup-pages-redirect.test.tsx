import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ADMINISTRATION_ROUTES } from '@/app/routes/administration';
import { withMenuGates } from '@/app/routes/route-gates';

vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => null }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'UTC', source: 'utc-fallback' }) }));

const { PlanningPage, SetupCalendarsPage, SetupProfilesPage } = await import('./planning-page');

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

const open = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/setup/profiles" element={<><SetupProfilesPage /><Where /></>} />
        <Route path="/setup/calendars" element={<><SetupCalendarsPage /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );

describe('Setup section (owner 21 Oct 2026)', () => {
  it.each([
    ['/planning?tab=calendars&unitId=u1', '/setup/calendars?unitId=u1'],
    ['/planning?tab=profiles', '/setup/profiles?tab=profiles'],
    ['/planning?tab=transitions', '/setup/profiles?tab=transitions'],
    ['/planning?tab=streams', '/setup/profiles?tab=streams'],
  ])('an old link %s opens %s', (from, to) => {
    open(from);
    expect(screen.getByTestId('where')).toHaveTextContent(to);
  });

  it('master-data pages keep the gate they had under "Master data", whatever Setup entry lists them', () => {
    const gated = withMenuGates(ADMINISTRATION_ROUTES);
    const gateOf = (path: string) => gated.find((route) => route.path === path)?.requires;
    for (const path of ['/master-data', '/master-data/units', '/master-data/stop-policy', '/master-data/rca/templates', '/master-data/work-orders', '/master-data/codes-rules']) {
      expect([path, gateOf(path)]).toEqual([path, 'canReachMasterData']);
    }
    expect(gateOf('/finance')).toBe('canViewAnalysis');
  });
});
