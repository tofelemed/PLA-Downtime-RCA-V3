import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { StandbyImportPage } = await import('./standby-import-page');

const refused = () =>
  jsonResponse(422, errorBody('STANDBY_IMPORT_INVALID', 'The import has 1 invalid row(s)', { errors: [{ line: 1, message: 'assetId / assetCode must name an asset of this plant' }] }));

function renderPage(reply: (call: V2Call) => Response | undefined) {
  const calls = stubV2Fetch(reply);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data/standby-equipment/import']}><StandbyImportPage /></MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

const box = () => screen.getByLabelText('Or paste the rows') as HTMLTextAreaElement;

describe('Standby log import page (SETUP_UX_FIXES Phase 4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('checks the rows here, then shows the row problems the server refused, the rows kept', async () => {
    actAs('operator');
    const calls = renderPage((call) => (call.url.pathname.endsWith('/standby-records/import') ? refused() : undefined));
    fireEvent.change(box(), { target: { value: 'assetCode,kind,startedAt,outcome\nP-9,demand,2026-10-01 08:00,success' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/startedAt must be an ISO 8601 time/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    const rows = 'assetCode,kind,startedAt,outcome\nP-9,demand,2026-10-01T08:00:00Z,success';
    fireEvent.change(box(), { target: { value: rows } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByTestId('save-failure-alert')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Row problems' }).textContent).toContain('Row 1: assetId / assetCode must name an asset');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ records: [{ assetCode: 'P-9', kind: 'demand', startedAt: '2026-10-01T08:00:00Z', endedAt: null, outcome: 'success' }] });
    expect(box().value).toBe(rows);
  });

  it('a stored log import ends in the result dialog with its counts', async () => {
    renderPage((call) => (call.url.pathname.endsWith('/standby-records/import') ? jsonResponse(201, { total: 3, created: 2, updated: 1 }) : undefined));
    fireEvent.change(box(), { target: { value: 'assetCode,kind,startedAt,outcome\nP-101B,demand,2026-10-01T08:00:00Z,success' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Standby log imported')).toBeInTheDocument();
    expect(within(dialog).getByText('Imported 3 entries: 2 new, 1 replaced (same externalRef).')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Back to Standby equipment' }).getAttribute('href')).toBe('/master-data/standby-equipment');
  });

  it('a role that may not write the log gets no import form', () => {
    actAs('master_data_admin');
    renderPage(() => undefined);
    expect(screen.queryByLabelText('Or paste the rows')).toBeNull();
  });
});
