import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { FailureDictionaryEntryView } from '@/api/v2/types/failure-dictionary';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FailureDictionaryPage } = await import('./failure-dictionary-page');

const PUMP: FailureDictionaryEntryView = {
  id: 'd1', kind: 'equipment_class', equipmentClass: '', code: 'PU', name: 'Pumps', description: null, category: null,
  assetTypes: [], isPending: false, effectiveFrom: '2027-01-01T00:00:00.000Z', effectiveTo: null, rowVersion: 1,
};

function replyWith(retire: Response) {
  return (call: V2Call) => {
    if (call.method === 'POST' && call.url.pathname.endsWith('/failure-dictionary/d1/retire')) return retire;
    if (call.url.pathname.endsWith('/failure-dictionary')) return jsonResponse(200, listPage([PUMP]));
    return undefined;
  };
}

async function confirmRetire() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><FailureDictionaryPage /></MemoryRouter>
    </QueryClientProvider>,
  );
  const table = await screen.findByRole('table', { name: 'Failure dictionary entries' });
  fireEvent.click(await within(table).findByRole('button', { name: 'Retire' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Retire entry' }));
  return dialog;
}

describe('Failure dictionary retire (save feedback, DECISIONS 2026-10-22)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    toast.mockReset();
    actAs('SuperAdmin');
  });

  it('keeps the dialog open with the red alert inside on a refusal, without an error toast', async () => {
    stubV2Fetch(replyWith(jsonResponse(409, errorBody('CONFLICT', 'Entry is in use'))));
    const dialog = await confirmRetire();
    expect(await within(dialog).findByTestId('save-failure-alert')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBe(dialog);
    expect(toast).not.toHaveBeenCalled();
  });

  it('closes with a toast on success', async () => {
    stubV2Fetch(replyWith(jsonResponse(200, { ...PUMP, effectiveTo: '2027-02-01T00:00:00.000Z' })));
    await confirmRetire();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'PU retired' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
