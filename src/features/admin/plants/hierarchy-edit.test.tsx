import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';
import { changesOf, validateEdit } from './use-hierarchy-editor';

const setSelection = vi.fn();
const selection = {
  organization: { id: 'o1', code: 'OWN', name: 'Own organization' },
  tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1', timezone: 'Asia/Tehran' },
};
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection, loading: false }) }));

const { OrganizationEditPage, PlantEditPage } = await import('./hierarchy-form-page');
const { PlantsPage } = await import('./plants-page');
const { HierarchyEditLink } = await import('@/features/master-data/hierarchy/hierarchy-edit-link');

interface Call {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const ORG = { id: 'o1', code: 'OWN', name: 'Own organization', description: null, isActive: true, canAddPlants: true, canDelete: false, canEdit: true, rowVersion: 3 };
const OTHER_ORG = { ...ORG, id: 'o2', code: 'OTHER', name: 'Other organization', canAddPlants: false, canEdit: false };
const PLANT = {
  id: 'tenant-a', code: 'P1', name: 'Own plant', description: 'Line 1', organizationId: 'o1', organizationName: 'Own organization', timezone: 'Asia/Tehran',
  calendarSystem: 'gregorian', digits: 'latin', weekStart: 'saturday', isActive: true, canDelete: false, canEdit: true, rowVersion: 7,
  timezoneEditable: false, timezoneLockedReason: 'The time zone can no longer change: this plant already has production events, whose local dates and shifts were worked out in the current time zone.',
};
const STALE = { code: 'STALE_REVISION', message: 'The resource changed since it was read', correlationId: null, retryable: false };

type Responder = (call: Call) => Response | undefined;

describe('organization and plant editing (Setup › Organizations & plants)', () => {
  let calls: Call[];
  let client: QueryClient;
  let respond: Responder;

  const wrap = (node: ReactNode, path: string, route: string) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={node} />
            <Route path="/setup/plants" element={<p>Organizations and plants list</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    setSelection.mockReset();
    respond = () => undefined;
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call: Call = { method: init.method ?? 'GET', path: new URL(url).pathname, headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      const custom = respond(call);
      if (custom) return custom;
      if (call.path === '/api/v2/organizations/o1') return json(200, ORG);
      if (call.path === '/api/v2/organizations/o2') return json(200, OTHER_ORG);
      if (call.path === '/api/v2/tenants/tenant-a') return json(200, PLANT);
      if (call.path === '/api/v2/organizations') return json(200, list([ORG, OTHER_ORG]));
      if (call.path === '/api/v2/tenants') return json(200, list([PLANT, { ...PLANT, id: 'tenant-c', name: 'Foreign plant', canEdit: false }]));
      return json(200, list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  const patches = () => calls.filter((call) => call.method === 'PATCH');

  it('renames an organization under its row version, keeps the code read-only and updates the header selection', async () => {
    actAs('OrgAdmin');
    wrap(<OrganizationEditPage />, '/setup/plants/organizations/o1/edit', '/setup/plants/organizations/:organizationId/edit');
    const name = await screen.findByLabelText(/^Name/);
    const code = screen.getByLabelText(/^Code/);
    expect(code).toHaveValue('OWN');
    expect(code).toHaveAttribute('readonly');
    expect(screen.getByText(/Codes can’t change after creation/)).toBeTruthy();
    respond = (call) => (call.method === 'PATCH' ? json(200, { ...ORG, name: 'Polymers Co', rowVersion: 4 }) : undefined);
    fireEvent.change(name, { target: { value: '  Polymers Co ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Organizations and plants list')).toBeTruthy();
    expect(patches()).toHaveLength(1);
    expect(patches()[0]).toMatchObject({ path: '/api/v2/organizations/o1', body: { name: 'Polymers Co' } });
    expect(patches()[0].headers.get('If-Match')).toBe('"3"');
    expect(setSelection).toHaveBeenCalledWith(expect.objectContaining({ organization: expect.objectContaining({ id: 'o1', name: 'Polymers Co' }) }));
  });

  it('shows a locked plant time zone with the server reason and never sends it', async () => {
    wrap(<PlantEditPage />, '/setup/plants/tenant-a/edit', '/setup/plants/:plantId/edit');
    const zone = await screen.findByLabelText(/^Time zone/);
    expect(zone).toBeDisabled();
    expect(screen.getByText(/already has production events/)).toBeTruthy();
    respond = (call) => (call.method === 'PATCH' ? json(200, { ...PLANT, description: null, rowVersion: 8 }) : undefined);
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Organizations and plants list')).toBeTruthy();
    expect(patches()[0]).toMatchObject({ path: '/api/v2/tenants/tenant-a', body: { description: null } });
    expect(patches()[0].headers.get('If-Match')).toBe('"7"');
  });

  it('on a stale revision loads the latest version, keeps my text and saves against the new revision', async () => {
    wrap(<OrganizationEditPage />, '/setup/plants/organizations/o1/edit', '/setup/plants/organizations/:organizationId/edit');
    const name = await screen.findByLabelText(/^Name/);
    let patched = 0;
    respond = (call) => {
      if (call.method === 'PATCH') return (patched += 1) === 1 ? json(412, STALE) : json(200, { ...ORG, name: 'My name', rowVersion: 5 });
      if (call.path === '/api/v2/organizations/o1' && patched > 0) return json(200, { ...ORG, name: 'Their name', rowVersion: 4 });
      return undefined;
    };
    fireEvent.change(name, { target: { value: 'My name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const alert = await screen.findByTestId('hierarchy-conflict');
    expect(within(alert).getByText(/Their name/)).toBeTruthy();
    expect(screen.getByLabelText(/^Name/)).toHaveValue('My name');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Organizations and plants list')).toBeTruthy();
    expect(patches().map((call) => call.headers.get('If-Match'))).toEqual(['"3"', '"4"']);
  });

  it('shows another organization read-only to an organization administrator (the server refuses edits)', async () => {
    actAs('OrgAdmin');
    wrap(<OrganizationEditPage />, '/setup/plants/organizations/o2/edit', '/setup/plants/organizations/:organizationId/edit');
    expect(await screen.findByText(/Only a super administrator or the organization’s administrator can change this organization/)).toBeTruthy();
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('refuses the edit page to a plant administrator without calling the server', () => {
    actAs('TenantAdmin');
    wrap(<PlantEditPage />, '/setup/plants/tenant-a/edit', '/setup/plants/:plantId/edit');
    expect(screen.getByText(/Only a super administrator or the organization’s administrator can edit this/)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('offers Edit only on rows the server marks editable', async () => {
    actAs('OrgAdmin');
    wrap(<PlantsPage />, '/setup/plants', '/setup/plants');
    expect(await screen.findByRole('link', { name: 'Edit organization Own organization' })).toHaveAttribute('href', '/setup/plants/organizations/o1/edit');
    expect(screen.queryByRole('link', { name: 'Edit organization Other organization' })).toBeNull();
    expect(await screen.findByRole('link', { name: 'Edit plant Own plant' })).toHaveAttribute('href', '/setup/plants/tenant-a/edit');
    expect(screen.queryByRole('link', { name: 'Edit plant Foreign plant' })).toBeNull();
  });

  it('links hierarchy tree nodes to the edit page for permitted users only', () => {
    wrap(<HierarchyEditLink kind="plant" id="tenant-a" name="Own plant" canEdit />, '/master-data/hierarchy', '/master-data/hierarchy');
    expect(screen.getByRole('link', { name: 'Edit plant Own plant' })).toHaveAttribute('href', '/setup/plants/tenant-a/edit?from=hierarchy');
    actAs('Operator');
    wrap(<HierarchyEditLink kind="organization" id="o1" name="Own organization" canEdit />, '/master-data/hierarchy', '/master-data/hierarchy');
    expect(screen.queryByRole('link', { name: 'Edit organization Own organization' })).toBeNull();
  });
});

describe('hierarchy edit form model', () => {
  const base = { id: 'p', code: 'P', name: 'Plant', description: 'Old', rowVersion: 1, canEdit: true, timezone: 'UTC', timezoneEditable: true };
  it('sends only what changed, a cleared description as null, and a time zone only while editable', () => {
    expect(changesOf({ code: 'P', name: ' Plant ', description: '', timezone: 'Asia/Tehran' }, base)).toEqual({ description: null, timezone: 'Asia/Tehran' });
    expect(changesOf({ code: 'P', name: 'Plant', description: 'Old', timezone: 'Asia/Tehran' }, { ...base, timezoneEditable: false })).toEqual({});
  });
  it('requires a name and keeps an existing time zone', () => {
    expect(validateEdit({ code: 'P', name: ' ', description: '', timezone: '' }, base)).toEqual({ name: 'Enter a name.', timezone: 'Choose the plant’s time zone.' });
  });
});
