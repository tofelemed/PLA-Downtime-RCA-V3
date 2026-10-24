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

describe('Failure dictionary is paged and filtered on the server (SETUP_UX_FIXES Phase 5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  const tableCalls = (calls: V2Call[]) =>
    calls.filter((c) => c.url.pathname.endsWith('/failure-dictionary') && c.url.searchParams.get('kinds') !== 'equipment_class');

  it('asks for 20 entries by code with the filters of the address; classes come from their own query', async () => {
    const calls = stubV2Fetch((call) => (call.url.pathname.endsWith('/failure-dictionary') ? jsonResponse(200, listPage([PUMP], 'next-1')) : undefined));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/master-data/failure-dictionary?q=pump&kind=failure_mode&class=PU']}><FailureDictionaryPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('table', { name: 'Failure dictionary entries' });
    const params = tableCalls(calls)[0].url.searchParams;
    expect(params.get('limit')).toBe('20');
    expect(params.get('sort')).toBe('code');
    expect(params.get('q')).toBe('pump');
    expect(params.getAll('kinds')).toEqual(['failure_mode']);
    expect(params.get('equipmentClass')).toBe('PU');
    expect(calls.some((c) => c.url.searchParams.get('kinds') === 'equipment_class')).toBe(true);
    expect((screen.getByLabelText('List') as HTMLSelectElement).value).toBe('failure_mode');
    expect(await screen.findByRole('button', { name: /next page/i })).toBeEnabled();
  });

  it('choosing a list asks the server again; the whole dictionary is never loaded for the table', async () => {
    const calls = stubV2Fetch((call) => (call.url.pathname.endsWith('/failure-dictionary') ? jsonResponse(200, listPage([PUMP])) : undefined));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><FailureDictionaryPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('table', { name: 'Failure dictionary entries' });
    fireEvent.change(screen.getByLabelText('List'), { target: { value: 'failure_cause' } });
    await waitFor(() => expect(tableCalls(calls).some((c) => c.url.searchParams.getAll('kinds').includes('failure_cause'))).toBe(true));
    expect(tableCalls(calls).every((c) => c.url.searchParams.get('limit') === '20')).toBe(true);
  });
});

// Configuration cleanup (24 Oct 2026): no header description, the table in a report card with ⓘ, labelled h-9 filters
describe('Failure dictionary cleanup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    toast.mockReset();
    actAs('SuperAdmin');
  });

  it('drops the ISO description under the title; the card keeps it behind its ⓘ', async () => {
    showPage(replyWith(jsonResponse(200, PUMP)));
    const card = await screen.findByTestId('dictionary-card');
    expect(screen.queryByText(/ISO 14224-aligned failure codes/)).toBeNull();
    expect(within(card).getByRole('heading', { level: 2, name: 'Entries in force' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'About Entries in force' })).toBeInTheDocument();
    expect(await within(card).findByRole('button', { name: 'Retire' })).toBeInTheDocument();
  });

  it('filters: Search, List and Equipment class with labels above, h-9', async () => {
    showPage(replyWith(jsonResponse(200, PUMP)));
    const filters = await screen.findByTestId('dictionary-filters');
    expect(filters.className).toContain('items-end');
    expect(within(filters).getByText('Search')).toBeInTheDocument();
    expect(within(filters).getByLabelText('List')).toHaveClass('h-9');
    expect(within(filters).getByLabelText('Equipment class')).toHaveClass('h-9');
  });

  it('an empty dictionary says so in its own words, not the generic report empty', async () => {
    showPage(() => undefined);
    expect(await screen.findByText(/No entries yet\. Failure fields stay free text/)).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
  });

  it('Add dictionary entry: List focused, Cancel before the primary buttons, Cancel and Esc close it', async () => {
    showPage(replyWith(jsonResponse(200, PUMP)));
    fireEvent.click(await screen.findByTestId('dictionary-entry-new'));
    const dialog = await screen.findByTestId('dictionary-entry-dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('List')).toHaveFocus());
    const names = within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Add entry'));
    expect(within(dialog).getByTestId('dictionary-entry-form').className).toContain('[&_input:not([type=checkbox]):not([type=radio])]:h-9');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('dictionary-entry-dialog')).toBeNull());
    fireEvent.click(screen.getByTestId('dictionary-entry-new'));
    fireEvent.keyDown(await screen.findByTestId('dictionary-entry-dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('dictionary-entry-dialog')).toBeNull());
  });
});
