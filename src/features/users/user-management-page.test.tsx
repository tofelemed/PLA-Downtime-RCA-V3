import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';
import { UserManagementPage } from './user-management-page';
import { UserManagementRedirect } from './user-management-redirect';
import { DelegationsRoute } from './delegations-route';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('./users-page', () => ({ UsersPage: () => <p>User membership content</p> }));
vi.mock('@/features/permissions/permissions-page', () => ({ PermissionsPage: () => <p>Permission content</p> }));
vi.mock('@/features/delegations/delegations-page', () => ({ DelegationsPage: () => <p>Delegation content</p> }));
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}{location.hash}</output>; }
function show(path: string) {
  configureV2Session({ getAccessToken: () => 'token', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/users" element={<UserManagementPage />} />
    <Route path="/permissions" element={<UserManagementRedirect tab="permissions" />} />
    <Route path="/delegations" element={<DelegationsRoute />} />
  </Routes></MemoryRouter>);
}
afterEach(() => actAs('SuperAdmin'));
describe('consolidated User Management', () => {
  it.each([['/users', 'User membership content'], ['/users?tab=permissions', 'Permission content'], ['/users?tab=delegations', 'Delegation content']])('opens %s inside one workspace', async (path, content) => {
    actAs('SuperAdmin'); show(path);
    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
  it('retains selected users, filters and hash when old permission links redirect', async () => {
    actAs('TenantAdmin'); show('/permissions?user=u1&q=Anna#access');
    await screen.findByText('Permission content');
    expect(screen.getByRole('status')).toHaveTextContent('/users?user=u1&q=Anna&tab=permissions#access');
  });
  it('a manager is sent to their own Approval delegations page even when a permission tab is typed', async () => {
    actAs('Manager'); show('/users?tab=permissions');
    expect(await screen.findByText('Delegation content')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^\/delegations$/);
    expect(screen.queryByRole('tab')).toBeNull();
  });
  it('an administrator opening /delegations lands on the Delegations tab of User management', async () => {
    actAs('TenantAdmin'); show('/delegations');
    expect(await screen.findByText('Delegation content')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('/users?tab=delegations');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
  it('a viewer cannot reach any tab', () => {
    actAs('viewer'); show('/users?tab=permissions');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText(/do not have permission to manage users/)).toBeInTheDocument();
  });
});
