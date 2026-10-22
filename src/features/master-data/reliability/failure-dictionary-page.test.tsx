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

function showPage(reply: (call: V2Call) => Response | undefined) {
  stubV2Fetch(reply);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><FailureDictionaryPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const withCreate = (created: Response) => (call: V2Call) =>
  call.method === 'POST' && call.url.pathname.endsWith('/failure-dictionary') ? created : replyWith(jsonResponse(200, PUMP))(call);

async function fillEntryDialog() {
  fireEvent.click(await screen.findByTestId('dictionary-entry-new'));
  const dialog = await screen.findByTestId('dictionary-entry-dialog');
  fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'PU' } });
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Pumps' } });
  return dialog;
}

describe('Failure dictionary header actions (SETUP_UX_FIXES Phase 4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    toast.mockReset();
    actAs('SuperAdmin');
  });

  it('puts Import CSV and Add entry in the header, without the old bottom sections', async () => {
    showPage(replyWith(jsonResponse(200, PUMP)));
    await screen.findByRole('table', { name: 'Failure dictionary entries' });
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Import CSV' }).getAttribute('href')).toBe('/master-data/failure-dictionary/import');
    expect(within(header).getByRole('button', { name: 'Add entry' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add an entry' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Import (CSV)' })).toBeNull();
    expect(screen.queryByTestId('dictionary-entry-form')).toBeNull();
  });

  it('Add entry opens the form in a dialog that closes with a toast after the save', async () => {
    showPage(withCreate(jsonResponse(201, PUMP)));
    const dialog = await fillEntryDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add entry' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Entry added' }));
    await waitFor(() => expect(screen.queryByTestId('dictionary-entry-dialog')).toBeNull());
  });

  it('a refused entry keeps the dialog open with the red alert inside, the input kept', async () => {
    showPage(withCreate(jsonResponse(409, errorBody('DICTIONARY_CODE_EXISTS', 'exists'))));
    const dialog = await fillEntryDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and add another' }));
    expect(await within(dialog).findByTestId('save-failure-alert')).toBeInTheDocument();
    expect((within(dialog).getByLabelText('Code') as HTMLInputElement).value).toBe('PU');
  });

  it('a reader sees neither Import CSV nor Add entry', async () => {
    actAs('reliability_engineer');
    showPage(replyWith(jsonResponse(200, PUMP)));
    await screen.findByRole('table', { name: 'Failure dictionary entries' });
    expect(screen.queryByTestId('dictionary-import-open')).toBeNull();
    expect(screen.queryByTestId('dictionary-entry-new')).toBeNull();
  });
});
