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

const { DictionaryImportPanel } = await import('./dictionary-import-panel');

const CSV = 'kind,equipmentClass,code,name,description,category,assetTypes,isPending\nequipment_class,,PU,Pumps,,,Pump,';
const RESULT = { dryRun: false, total: 3, created: 2, superseded: 1, unchanged: 0 };

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter>
        <DictionaryImportPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const csvBox = () => screen.getByLabelText(/^CSV/) as HTMLTextAreaElement;

describe('failure dictionary import feedback (DECISIONS 2026-10-22)', () => {
  let reply: (call: V2Call) => Response | undefined;
  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    reply = () => undefined;
    stubV2Fetch((call) => (call.url.pathname.endsWith('/failure-dictionary/import') ? reply(call) : undefined));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a stored import ends in the result dialog with the counts and empties the text', async () => {
    reply = () => jsonResponse(200, RESULT);
    show();
    fireEvent.change(csvBox(), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Failure dictionary imported')).toBeTruthy();
    expect(within(dialog).getByText(/3 rows: 2 new, 1 changed \(new version\), 0 unchanged/)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Back to Failure dictionary' }).getAttribute('href')).toBe('/master-data/failure-dictionary');
    expect(csvBox().value).toBe('');
    expect(toast).not.toHaveBeenCalled();
  });

  it('a check counts inline without a dialog and keeps the text', async () => {
    reply = () => jsonResponse(200, { ...RESULT, dryRun: true });
    show();
    fireEvent.change(csvBox(), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect((await screen.findByRole('status')).textContent).toContain('Check: 3 rows');
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
    expect(csvBox().value).toBe(CSV);
  });

  it('a refused import is the red alert with the row problems, the text kept', async () => {
    reply = () => jsonResponse(422, errorBody('DICTIONARY_IMPORT_INVALID', 'invalid', { errors: [{ line: 2, message: 'code and name are required' }] }));
    show();
    fireEvent.change(csvBox(), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const alert = await screen.findByTestId('save-failure-alert');
    expect(alert.textContent).toContain('The import was refused; nothing was stored');
    expect(screen.getByRole('list', { name: 'Row problems' }).textContent).toContain('Line 2: code and name are required');
    expect(csvBox().value).toBe(CSV);
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
});
