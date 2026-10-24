import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { UsersPage } = await import('./users-page');
const { UserManagementPage } = await import('./user-management-page');
const { UserFormPage } = await import('./user-form-page');
const { PermissionsPage } = await import('@/features/permissions/permissions-page');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-12T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const USER = {
  id: 'u-2', name: 'Anna Keller', email: 'anna@demo.test', role: 'TenantAdmin', plantRoles: ['production_engineer'], isActive: true, tenantId: 'tenant-a',
  tenantName: 'Demo Plant', organizationId: 'o1', organizationName: 'Demo Org', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  manageable: true, accessManageable: true,
};
const GRANTEE = { ...USER, id: 'u-3', name: 'Grace Whitfield', email: 'grace@demo.test', tenantId: 'tenant-b', tenantName: 'Demo Plant 2', manageable: false };
/** Users without a home plant: an organization administrator and a super administrator. */
const ORG_ADMIN = { ...USER, id: 'u-4', name: 'Olga Org', email: 'olga@demo.test', tenantId: null, tenantName: null, organizationName: 'Demo Org' };
const SUPER = { ...USER, id: 'u-5', name: 'Sam Super', email: 'sam@demo.test', tenantId: null, tenantName: null, organizationId: null, organizationName: null };
const SCOPE = {
  id: 's1', userId: 'u-2', userName: 'Anna Keller', scopeKind: 'tenant', scopeId: 'tenant-a', scopeName: null, role: 'viewer',
  createdAt: '2026-10-01T08:00:00Z', createdByName: 'Test user', lock: null,
};

function route(path: string) {
  if (path === '/api/v2/users') return list([USER, GRANTEE, ORG_ADMIN, SUPER]);
  if (path === '/api/v2/users/u-2') return USER;
  if (path === '/api/v2/users/u-3') return GRANTEE;
  if (path === '/api/v2/user-scopes') return list([SCOPE]);
  if (path === '/api/v2/users/grantable-roles') return { roles: ['Operator'], scopeRoles: ['viewer'] };
  return list([]);
}

let client: QueryClient;
const wrap = (node: ReactNode, path: string, pattern = '*') =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => json(route(new URL(url).pathname))));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  actAs('SuperAdmin');
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('User management cleanup (25 Oct 2026)', () => {
  it('has no page description or tab paragraph; the users card has its ⓘ, actions and labelled filters', async () => {
    wrap(<UserManagementPage />, '/users');
    expect(await screen.findByText('Anna Keller')).toBeTruthy();
    expect(screen.queryByText(/Manage plant members, their permissions/)).toBeNull();
    expect(screen.queryByText(/Members of the selected plant: their role/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Members' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Users', level: 2 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About Users' })).toBeTruthy();
    ['Search users by name or e-mail', 'Role', 'Status'].forEach((name) => expect(screen.getByText(name, { selector: 'label' })).toBeTruthy());
    // label in name (WCAG 2.5.3): the search is named by its visible label only
    const search = screen.getByRole('searchbox', { name: 'Search users by name or e-mail' });
    expect(search).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: 'Grant access by e-mail' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Add user/ })).toHaveAttribute('href', '/users/new');
  });

  it('drops the plant column (the same plant on every row); a user from another plant keeps the "From" badge', async () => {
    wrap(<UsersPage embedded />, '/users');
    expect(await screen.findByText('Grace Whitfield')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Plant' })).toBeNull();
    expect(screen.getByText('From Demo Plant 2')).toHaveClass('whitespace-nowrap');
    expect(screen.getAllByText('Production engineer').length).toBeGreaterThan(0);
  });

  it('users without a home plant carry their organization or "All plants" as a badge (no Plant column)', async () => {
    wrap(<UsersPage embedded />, '/users');
    const org = await screen.findByRole('row', { name: /Olga Org/ });
    expect(within(org).getByText('Demo Org')).toHaveClass('whitespace-nowrap');
    expect(within(screen.getByRole('row', { name: /Sam Super/ })).getByText('All plants')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Anna Keller/ })).queryByText(/^From |All plants|Demo Org/)).toBeNull();
  });

  it('Grant access by e-mail: titled dialog, ⓘ instead of a paragraph, e-mail focused, Cancel before Grant access, Esc closes', async () => {
    wrap(<UsersPage embedded />, '/users');
    fireEvent.click(await screen.findByRole('button', { name: 'Grant access by e-mail' }));
    const dialog = await screen.findByRole('dialog', { name: 'Grant access to a user of another plant' });
    expect(within(dialog).queryByText(/Find a user of your organization/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Grant access to a user of another plant' })).toBeTruthy();
    await waitFor(() => expect(within(dialog).getByLabelText('E-mail')).toHaveFocus());
    const names = within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Grant access'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('user page: cards with ⓘ; the Grant access dialog, Remove access, Deactivate and Delete confirms open and close', async () => {
    wrap(<UserFormPage />, '/users/u-2', '/users/:userId');
    expect(await screen.findByRole('heading', { name: 'Access in this plant' })).toBeTruthy();
    expect(screen.queryByText(/Roles the user holds here, for the whole plant/)).toBeNull();
    expect(screen.queryByText(/Deactivated users cannot sign in; their history/)).toBeNull();
    expect(await screen.findByText('Viewer')).toBeTruthy();
    expect(screen.queryByText(/Asia\/Tehran/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    const grant = await screen.findByRole('dialog', { name: 'Grant access to Anna Keller' });
    expect(within(grant).queryByText(/The role applies in this plant/)).toBeNull();
    fireEvent.click(within(grant).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    for (const [trigger, title] of [['Remove Viewer access', 'Remove Viewer access from Anna Keller?'], ['Deactivate user', 'Deactivate Anna Keller?'], ['Delete user', 'Delete Anna Keller?']]) {
      fireEvent.click(screen.getByRole('button', { name: trigger }));
      const confirm = await screen.findByRole('alertdialog', { name: title });
      fireEvent.keyDown(confirm, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    }
  });

  it('a profile the administrator may not change shows its values as text, not disabled inputs', async () => {
    wrap(<UserFormPage />, '/users/u-3', '/users/:userId');
    const details = await screen.findByTestId('user-details-read-only');
    expect(within(details).getByText('grace@demo.test')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /Name/ })).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('permissions: no description; the read-only note is one line with its ⓘ and the link to the user', async () => {
    wrap(<PermissionsPage embedded />, '/users?tab=permissions&user=u-2');
    const note = await screen.findByTestId('permissions-read-only-note');
    expect(screen.queryByText(/See what each user's plant roles reach/)).toBeNull();
    expect(note).toHaveTextContent('Per-user permission overrides are not stored');
    expect(within(note).getByRole('link', { name: 'Open user and access' })).toHaveAttribute('href', '/users/u-2');
    expect(within(note).getByRole('button', { name: 'About permission overrides' })).toBeTruthy();
    expect(screen.getByText('What Anna Keller reaches in this plant')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Plant' })).toBeNull();
  });

  it('permissions: the name cell carries the same badges (another plant, organization, all plants); search named by its label', async () => {
    wrap(<PermissionsPage embedded />, '/users?tab=permissions');
    expect(within(await screen.findByRole('row', { name: /Grace Whitfield/ })).getByText('From Demo Plant 2')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Olga Org/ })).getByText('Demo Org')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Sam Super/ })).getByText('All plants')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search users' })).not.toHaveAttribute('aria-label');
  });
});
