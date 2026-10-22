import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const setSelection = vi.fn();
const selection = {
  organization: { id: 'o1', code: 'OWN', name: 'Own organization' },
  tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' },
};
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection, loading: false }) }));

const { PlantNewPage, OrganizationNewPage } = await import('./hierarchy-form-page');

const ORG = { id: 'o1', code: 'OWN', name: 'Own organization', description: null, isActive: true, canAddPlants: true, canDelete: false, canEdit: true, rowVersion: 1 };
const CREATED = {
  id: 'tenant-b', code: 'P2', name: 'Plant B', description: null, organizationId: 'o1', organizationName: 'Own organization', timezone: 'Asia/Tehran',
  calendarSystem: 'jalali', digits: 'latin', weekStart: 'saturday', isActive: true, canDelete: true, canEdit: true, rowVersion: 1,
};
const DIRECTORY_KEY = ['v2', 'directory', 'user-1', 'tenants'];

describe('after creating a plant (owner decision 22 Oct 2026)', () => {
  let calls: V2Call[];
  let client: QueryClient;

  const show = (node: JSX.Element, path: string) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/setup/plants/*" element={node} />
            <Route path="/setup/plants" element={<p>Organizations and plants list</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const createPlant = async () => {
    show(<PlantNewPage />, '/setup/plants/new?organizationId=o1');
    await waitFor(() => expect(calls.some((call) => call.url.pathname === '/api/v2/organizations')).toBe(true));
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'P2' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Plant B' } });
    fireEvent.change(screen.getByLabelText(/^Time zone/), { target: { value: 'Asia/Tehran' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plant' }));
    return screen.findByRole('alertdialog', { name: 'Plant Plant B created. Switch to it now?' });
  };

  beforeEach(() => {
    actAs('OrgAdmin');
    setSelection.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(DIRECTORY_KEY, [selection.tenant]);
    calls = stubV2Fetch((call) => {
      if (call.method === 'POST' && call.url.pathname === '/api/v2/tenants') return jsonResponse(201, CREATED);
      if (call.method === 'POST' && call.url.pathname === '/api/v2/organizations') return jsonResponse(201, { ...ORG, id: 'o9', name: 'New Co' });
      if (call.url.pathname === '/api/v2/organizations') return jsonResponse(200, listPage([ORG]));
      return undefined;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('refreshes the plant directory and switches to the new plant on request', async () => {
    await createPlant();
    expect(client.getQueryState(DIRECTORY_KEY)?.isInvalidated).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Plant B' }));
    expect(setSelection).toHaveBeenCalledWith({
      organization: { id: 'o1', code: 'OWN', name: 'Own organization', canEdit: true },
      tenant: { id: 'tenant-b', code: 'P2', name: 'Plant B', organizationId: 'o1', timezone: 'Asia/Tehran', calendarSystem: 'jalali', digits: 'latin', weekStart: 'saturday', canEdit: true },
    });
    expect(await screen.findByText('Organizations and plants list')).toBeTruthy();
  });

  it('keeps the current plant when the user stays', async () => {
    await createPlant();
    fireEvent.click(screen.getByRole('button', { name: 'Stay in Own plant' }));
    expect(await screen.findByText('Organizations and plants list')).toBeTruthy();
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('refreshes the directory after creating an organization, without offering a switch', async () => {
    actAs('SuperAdmin');
    show(<OrganizationNewPage />, '/setup/plants/organizations/new');
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'New Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organization' }));
    expect(await screen.findByText('Organizations and plants list')).toBeTruthy();
    expect(client.getQueryState(DIRECTORY_KEY)?.isInvalidated).toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
