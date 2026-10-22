import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { DictionaryImportPage } = await import('./dictionary-import-page');

const CSV = 'kind,equipmentClass,code,name,description,category,assetTypes,isPending\nequipment_class,,PU,Pumps,,,Pump,';
const RESULT = { dryRun: false, total: 3, created: 2, superseded: 1, unchanged: 0 };

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data/failure-dictionary/import']}>
        <DictionaryImportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const csvBox = () => screen.getByLabelText('Or paste the rows') as HTMLTextAreaElement;

describe('failure dictionary import page (SETUP_UX_FIXES Phase 4)', () => {
  let reply: (call: V2Call) => Response | undefined;
  let calls: V2Call[];
  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    reply = () => undefined;
    calls = stubV2Fetch((call) => (call.url.pathname.endsWith('/failure-dictionary/import') ? reply(call) : undefined));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has the header with a way back to the dictionary, the expected columns and a template', () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Import failure dictionary' })).toBeInTheDocument();
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toContain('/master-data/failure-dictionary');
    expect(screen.getByText('kind,equipmentClass,code,name,description,category,assetTypes,isPending')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-template')).toBeInTheDocument();
  });

  it('Check is the server dry run: counts inline, no dialog, the text kept', async () => {
    reply = () => jsonResponse(200, { ...RESULT, dryRun: true });
    show();
    fireEvent.change(csvBox(), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect((await screen.findByRole('status')).textContent).toContain('Check: 3 rows');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ csv: CSV, dryRun: true });
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
    expect(csvBox().value).toBe(CSV);
  });

  it('a stored import ends in the result dialog with the counts; Import stays disabled for the same rows', async () => {
    reply = () => jsonResponse(200, RESULT);
    show();
    fireEvent.change(csvBox(), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Failure dictionary imported')).toBeInTheDocument();
    expect(within(dialog).getByText(/3 rows: 2 new, 1 changed \(new version\), 0 unchanged/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Back to Failure dictionary' }).getAttribute('href')).toBe('/master-data/failure-dictionary');
    expect(screen.getByRole('button', { name: 'Import', hidden: true })).toBeDisabled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('a refused import is the red alert with the line problems, the text kept', async () => {
    reply = () => jsonResponse(422, errorBody('DICTIONARY_IMPORT_INVALID', 'invalid', { errors: [{ line: 2, message: 'code and name are required' }] }));
    show();
    fireEvent.change(csvBox(), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const alert = await screen.findByTestId('save-failure-alert');
    expect(alert.textContent).toContain('The rows were refused; nothing was stored');
    expect(screen.getByRole('list', { name: 'Row problems' }).textContent).toContain('Line 2: code and name are required');
    expect(csvBox().value).toBe(CSV);
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
  });

  it('a role that reads but does not write the dictionary gets no import form', () => {
    actAs('reliability_engineer');
    show();
    expect(screen.queryByLabelText('Or paste the rows')).toBeNull();
  });
});
