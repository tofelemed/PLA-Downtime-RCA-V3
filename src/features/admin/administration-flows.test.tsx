import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';
import { attributeFormOf, emptyAttributeForm, toAttributeInput, validateAttributeForm } from './attributes/attribute-form-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { UsersPage } = await import('@/features/users/users-page');
const { TasksPage } = await import('@/features/tasks/tasks-page');
const { AdminPage } = await import('./admin-page');
const { HierarchyFormPage } = await import('./plants/hierarchy-form-page');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, asOf: '2026-10-12T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const USER = {
  id: 'u-2', name: 'Anna Keller', email: 'anna@demo.test', role: 'TenantAdmin', isActive: true, tenantId: 'tenant-a', tenantName: 'Demo Plant',
  organizationId: 'o1', organizationName: 'Demo Org', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', manageable: true,
  accessManageable: true,
};
/** A viewer granted into the selected plant from her home plant (owner decision 2026-10-12). */
const GRANTEE = { ...USER, id: 'u-3', name: 'Grace Whitfield', email: 'grace@demo.test', role: 'Operator', tenantId: 'tenant-b', tenantName: 'Demo Plant 2', manageable: false };
const TASK = {
  id: 't1', title: 'Replace seal', description: null, assigneeId: 'u-2', assigneeName: 'Anna Keller', assignedById: 'u-1', assignedByName: 'Test user',
  priority: 'High', status: 'In Progress', dueDate: '2026-10-01T20:00:00Z', completedAt: null, overdue: true, linkType: 'RCA', linkId: 'c1',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};
const SUMMARY = { total: 1, open: 0, inProgress: 1, completed: 0, cancelled: 0, overdue: 1, asOf: '2026-10-12T00:00:00Z' };
const ORGANIZATIONS = [
  { id: 'o1', name: 'Own organization', code: 'OWN', canAddPlants: true, canDelete: false },
  { id: 'o2', name: 'Read-only organization', code: 'OTHER', canAddPlants: false, canDelete: false },
];

describe('administration screens on v2', () => {
  let calls: Call[];
  let client: QueryClient;
  const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const wrap = (node: ReactNode, path = '/') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="*" element={node} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers) };
      calls.push(call);
      const path = call.url.pathname;
      if (path === '/api/v2/users') return json(200, list([USER, GRANTEE], 'next'));
      if (path === '/api/v2/tasks') return json(200, list([TASK]));
      if (path === '/api/v2/tasks/summary') return json(200, SUMMARY);
      if (path === '/api/v2/organizations') return json(200, list(ORGANIZATIONS));
      if (path === '/api/v2/tenants') return json(200, list([{ id: 'tenant-a', name: 'Own plant', code: 'P1', organizationName: 'Own organization', timezone: 'Asia/Tehran', calendarSystem: 'gregorian', weekStart: 'saturday', canDelete: false }]));
      return json(200, list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    actAs('SuperAdmin');
  });

  it('pages users by 20 on the server, shows role labels and sends filters to the server', async () => {
    wrap(<UsersPage />, '/users');
    expect(await screen.findByText('Anna Keller')).toBeTruthy();
    expect(screen.getByText('Plant administrator')).toBeTruthy();
    expect(screen.queryByText('TenantAdmin')).toBeNull();
    const first = calls.find((call) => call.url.pathname === '/api/v2/users');
    expect(first?.url.searchParams.get('limit')).toBe('20');
    expect(first?.url.searchParams.get('isActive')).toBe('true');
    fireEvent.change(screen.getByLabelText('Search users by name or e-mail'), { target: { value: 'anna' } });
    await waitFor(() => expect(calls.some((call) => call.url.searchParams.get('q') === 'anna')).toBe(true));
  });

  it('marks users granted in from another plant with their home plant', async () => {
    wrap(<UsersPage />, '/users');
    expect(await screen.findByText('Grace Whitfield')).toBeTruthy();
    expect(screen.getByText('From Demo Plant 2')).toBeTruthy();
    expect(screen.queryByText('From Demo Plant')).toBeNull();
    expect(screen.getByRole('button', { name: 'Grant access by e-mail' })).toBeTruthy();
  });

  it('refuses the users page to an operator with a plain message', () => {
    actAs('Operator');
    wrap(<UsersPage />, '/users');
    expect(screen.getByText(/don't have permission to access user management/)).toBeTruthy();
    expect(calls.some((call) => call.url.pathname === '/api/v2/users')).toBe(false);
  });

  it('shows server task counts, names instead of ids and the overdue state in words', async () => {
    wrap(<TasksPage />, '/tasks');
    expect(await screen.findByText('Replace seal')).toBeTruthy();
    expect(screen.getByText('Overdue', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('In progress', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('Investigation').getAttribute('href')).toBe('/rca/c1');
    expect(calls.some((call) => call.url.pathname === '/api/v2/tasks/summary')).toBe(true);
  });

  it('groups plant settings with the related administration sections (no dashboard settings, FE-02) and hides branding from plant administrators', async () => {
    wrap(<AdminPage />, '/admin');
    expect((await screen.findAllByRole('tab')).map((tab) => tab.textContent)).toEqual(['Plants & organizations', 'Custom attributes', 'Branding', 'Status automation', 'Plant settings']);
    actAs('TenantAdmin');
    wrap(<AdminPage />, '/admin?tab=branding');
    await waitFor(() => expect(screen.getAllByRole('tablist').at(-1)?.querySelectorAll('[role="tab"]').length).toBe(4));
  });

  it('lets OrgAdmin reach plant administration while retaining global and server row guards', async () => {
    actAs('OrgAdmin');
    wrap(<AdminPage />, '/admin?tab=branding');
    expect(await screen.findByText('Own plant')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Branding' })).toBeNull();
    expect(calls.some((call) => call.url.pathname === '/api/v2/branding')).toBe(false);
    expect(screen.queryByRole('link', { name: 'Add organization' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete (organization|plant)/ })).toBeNull();
    expect(within(screen.getByRole('row', { name: /Own organization OWN/ })).getByRole('link', { name: 'Add plant' })).toHaveAttribute('href', '/admin/plants/new?organizationId=o1');
    expect(within(screen.getByRole('row', { name: /Read-only organization OTHER/ })).queryByRole('link', { name: 'Add plant' })).toBeNull();
  });

  it('lets OrgAdmin open the plant form with only writable organizations available', async () => {
    actAs('OrgAdmin');
    wrap(<HierarchyFormPage kind="plant" />, '/admin/plants/new');
    expect(screen.getByRole('button', { name: 'Create plant' })).toBeTruthy();
    await waitFor(() => expect(calls.some((call) => call.url.pathname === '/api/v2/organizations')).toBe(true));
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Organization/ }), { key: 'ArrowDown' });
    // the form has two selects since 21 Oct 2026 (organization, week start): slow under a parallel full run
    expect(await screen.findByRole('option', { name: 'Own organization' }, { timeout: 5_000 })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Read-only organization' })).toBeNull();
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  }, 30_000);

  it.each(['OrgAdmin', 'TenantAdmin', 'viewer'])('does not allow %s to open organization creation', (role) => {
    actAs(role);
    wrap(<HierarchyFormPage kind="organization" />, '/admin/organizations/new');
    expect(screen.getByText(/Only a super administrator/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create organization' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each(['TenantAdmin', 'viewer'])('does not allow %s to open plant creation', (role) => {
    actAs(role);
    wrap(<HierarchyFormPage kind="plant" />, '/admin/plants/new');
    expect(screen.getByText(/Only a super administrator/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create plant' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('custom attribute form model', () => {
  it('validates the internal name and choices and sends only the rules of the type', () => {
    const empty = emptyAttributeForm('Unit');
    expect(validateAttributeForm({ ...empty, name: 'Bad Name', dataType: 'select' }, 'create')).toEqual({
      name: 'Lowercase letters, digits and “_”, starting with a letter.',
      displayName: 'Enter the name people see.',
      options: 'Enter at least one choice.',
    });
    const values = { ...empty, name: 'room', displayName: 'Room', maxLength: '20', minValue: '3' };
    expect(toAttributeInput(values, 'create')).toMatchObject({ entityType: 'Unit', name: 'room', validationRules: { maxLength: 20 }, selectOptions: [] });
    const view = { ...toAttributeInput(values, 'create') };
    expect(view.validationRules).not.toHaveProperty('minValue');
  });

  it('round-trips a stored definition into the form', () => {
    const form = attributeFormOf({
      id: 'a1', entityType: 'Asset', name: 'grade', displayName: 'Grade', description: null, dataType: 'select', isRequired: true, defaultValue: null,
      validationRules: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null }, selectOptions: ['A', 'B'], displayOrder: 2,
      isActive: true, scope: 'plant', editable: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    });
    expect(form).toMatchObject({ options: 'A\nB', displayOrder: '2', isRequired: true });
    expect(toAttributeInput(form, 'edit')).not.toHaveProperty('name');
  });
});
