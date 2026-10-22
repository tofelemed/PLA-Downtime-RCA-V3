import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, setSelection: vi.fn(), loading: false }) }));

const { DictionaryEntryForm } = await import('./dictionary-entry-form');

const ENTRY = { id: 'd1', kind: 'equipment_class', code: 'PU', name: 'Pumps', equipmentClass: null, assetTypes: [], isPending: false, rowVersion: 1 };

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter>
        <DictionaryEntryForm classes={[]} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const add = () => {
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'PU' } });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pumps' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
};

describe('failure dictionary entry form (Setup UX Phase 2)', () => {
  let reply = () => jsonResponse(201, ENTRY);
  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    reply = () => jsonResponse(201, ENTRY);
    stubV2Fetch((call) => (call.method === 'POST' && call.url.pathname === '/api/v2/failure-dictionary' ? reply() : undefined));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows a refusal as a red alert, never a neutral status line, and keeps the input', async () => {
    reply = () => jsonResponse(409, errorBody('DICTIONARY_CODE_EXISTS', 'An entry with this code is already in force'));
    show();
    add();
    const alert = await screen.findByTestId('save-failure-alert');
    expect(alert.querySelector('[role="alert"][data-code="DICTIONARY_CODE_EXISTS"]')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe('PU');
    expect(toast).not.toHaveBeenCalled();
  });

  it('confirms an added entry with a toast and empties code and name', async () => {
    show();
    add();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Entry added' }));
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
    expect(screen.queryByTestId('save-failure-alert')).toBeNull();
  });
});
