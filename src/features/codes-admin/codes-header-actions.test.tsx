import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodesAdminPage } = await import('./codes-admin-page');
const { CodeMappingsTab } = await import('./codes/code-mappings-tab');

const show = (node: JSX.Element, path = '/master-data/codes-rules') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const header = () => screen.getByRole('banner');

// SETUP_UX_FIXES Phase 4: the add action of a table page sits in the page header, the form in a dialog
describe('Codes & rules add actions', () => {
  let reply: (call: V2Call) => Response | undefined;
  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    reply = () => undefined;
    stubV2Fetch((call) => reply(call));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('"New code" is in the header on Code libraries and opens the create dialog', async () => {
    show(<CodesAdminPage />);
    fireEvent.click(within(header()).getByTestId('code-new'));
    expect(await screen.findByTestId('code-create-dialog')).toBeInTheDocument();
    expect(within(screen.getByTestId('codes-admin')).queryByTestId('code-new')).toBeNull();
  });

  it('"New rule" is in the header on the Rules tab, "New code" is not', () => {
    show(<CodesAdminPage />, '/master-data/codes-rules?tab=rules');
    expect(within(header()).getByTestId('rule-new')).toBeInTheDocument();
    expect(screen.queryByTestId('code-new')).toBeNull();
    expect(within(screen.getByTestId('codes-admin')).queryByTestId('rule-new')).toBeNull();
  });

  it('a viewer gets the Read-only hint and neither add action', () => {
    actAs('viewer');
    show(<CodesAdminPage />);
    expect(within(header()).getByTestId('read-only-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('code-new')).toBeNull();
  });

  it('"Add mapping" opens the form in a dialog; a saved version closes it with a toast', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, { id: 'm1' }) : undefined);
    show(<CodeMappingsTab reasonId="reason-1" active />);
    expect(screen.queryByTestId('mr-kind')).toBeNull();
    fireEvent.click(screen.getByTestId('mapping-new'));
    const dialog = await screen.findByTestId('mapping-dialog');
    fireEvent.change(within(dialog).getByLabelText('Mapping'), { target: { value: 'reason_to_oee' } });
    fireEvent.change(within(dialog).getByLabelText('Default'), { target: { value: 'availability' } });
    fireEvent.click(within(dialog).getByTestId('mr-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Default mapping saved as the next version' }));
    await waitFor(() => expect(screen.queryByTestId('mapping-dialog')).toBeNull());
  });

  it('a refused mapping is the red alert inside the dialog, which stays open', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(409, errorBody('CONFLICT', 'Already the default')) : undefined);
    show(<CodeMappingsTab reasonId="reason-1" active />);
    fireEvent.click(screen.getByTestId('mapping-new'));
    const dialog = await screen.findByTestId('mapping-dialog');
    fireEvent.change(within(dialog).getByLabelText('Default'), { target: { value: 'planned' } });
    fireEvent.click(within(dialog).getByTestId('mr-save'));
    expect(await within(dialog).findByTestId('save-failure-alert')).toBeInTheDocument();
    expect(screen.getByTestId('mapping-dialog')).toBe(dialog);
  });

  it('a retired code offers no "Add mapping"', () => {
    show(<CodeMappingsTab reasonId="reason-1" active={false} />);
    expect(screen.queryByTestId('mapping-new')).toBeNull();
  });
});
