import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, stubV2Fetch } from '@/test/v2-fetch';
import { AdministrationRedirect } from './shared/administration-redirect';
import { AdminPage } from './admin-page';
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>; }
function show(path: string) {
  stubV2Fetch((call) => call.url.pathname === '/api/v2/tenants/tenant-a' ? jsonResponse(200, { id: 'tenant-a', name: 'Plant A', calendarSystem: 'gregorian', digits: 'latin', weekStart: 'saturday', timezone: 'Asia/Dubai' }) : undefined);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/master-data/setup" element={<AdministrationRedirect kind="setup" />} />
    <Route path="/equipment-setup" element={<p>Equipment setup guide</p>} />
    <Route path="/settings" element={<AdministrationRedirect kind="settings" />} />
    <Route path="/codes-admin/*" element={<AdministrationRedirect kind="codes" />} />
    <Route path="/master-data/codes-rules/*" element={<p>Canonical code page</p>} />
    <Route path="/admin" element={<AdminPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { vi.unstubAllGlobals(); actAs('SuperAdmin'); });
describe('moved administration pages', () => {
  it('keeps old setup bookmarks working with their search and anchor', async () => {
    show('/master-data/setup?unitId=u1#rules');
    await screen.findByText('Equipment setup guide');
    expect(screen.getByTestId('location')).toHaveTextContent('/equipment-setup?unitId=u1#rules');
  });
  it.each(['/codes-admin/reason-codes/r1?library=reason-codes#history', '/codes-admin/rules/rule-1?tab=rules#versions'])('redirects the full old record path %s', async (path) => {
    show(path); await screen.findByText('Canonical code page');
    expect(screen.getByTestId('location')).toHaveTextContent(path.replace('/codes-admin', '/master-data/codes-rules'));
  });
  it('a manager retains Settings access without getting plant administration or branding', async () => {
    actAs('manager_approver'); show('/settings?unitId=u1#display');
    expect(await screen.findByRole('group', { name: 'Calendar system' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin?unitId=u1&tab=settings#display');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Plant settings']);
    expect(screen.queryByRole('tab', { name: 'Branding' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Plants & organizations' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(2);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
  it('a reader keeps the read-only Settings deep link, with no new administration write access', async () => {
    actAs('viewer'); show('/settings');
    expect(await screen.findByRole('group', { name: 'Calendar system' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('radio', { name: /Gregorian/ })).toBeDisabled();
    expect(screen.queryByRole('tab', { name: 'Plants & organizations' })).toBeNull();
  });
});
