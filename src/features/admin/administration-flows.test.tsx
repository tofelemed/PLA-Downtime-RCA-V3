import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('administration screens on v2', () => {
  let calls: Call[];
  let client: QueryClient;
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
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers) };
      calls.push(call);
      const path = call.url.pathname;
      if (path === '/api/v2/users') return json(200, list([USER, GRANTEE], 'next'));
      if (path === '/api/v2/tasks') return json(200, list([TASK]));
      if (path === '/api/v2/tasks/summary') return json(200, SUMMARY);
      return json(200, list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(screen.getByText('RCA case').getAttribute('href')).toBe('/rca?case=c1');
    expect(calls.some((call) => call.url.pathname === '/api/v2/tasks/summary')).toBe(true);
  });

  it('keeps the admin panel at five sections and hides branding from plant administrators', async () => {
    wrap(<AdminPage />, '/admin');
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
    actAs('TenantAdmin');
    wrap(<AdminPage />, '/admin?tab=branding');
    await waitFor(() => expect(screen.getAllByRole('tablist').at(-1)?.querySelectorAll('[role="tab"]').length).toBe(4));
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
