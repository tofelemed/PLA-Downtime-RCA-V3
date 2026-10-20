import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import type { DisplayCurrency } from '@/features/display-currency/display-currency-store';
import { actAs } from '@/test/acting-user';
import { CaseWorkspaceContext } from './case-context';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const saved = vi.hoisted(() => ({ names: [] as string[] }));
vi.mock('@/features/ux-kit/save-blob', () => ({ saveBlob: (_blob: Blob, name: string) => saved.names.push(name) }));

const { CaseExportPdf } = await import('./case-export-pdf');

const CASE = { id: 'c1', title: 'Gearbox failure on E-201', status: 'Closed', rowVersion: 3 } as unknown as RcaCaseView;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const job = (state: string, error: { code: string; message: string } | null = null) => ({
  id: 'job-12345678', reportType: 'rca_case', format: 'pdf', revisionSelector: 'case', state, rowCount: 9, sizeBytes: 100, contentHash: 'abc',
  requestedAt: '2026-10-20T06:00:00Z', finishedAt: null, expiresAt: null, downloadUrl: null, error,
});

describe('item 2.5 case "Export PDF"', () => {
  let posts: unknown[];
  let jobState: ReturnType<typeof job>;
  let refuse: boolean;
  const renderButton = (currency: DisplayCurrency = 'USD') =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DisplayCurrencyContext.Provider value={{ currency, setCurrency: () => undefined }}>
          <MemoryRouter>
            <CaseWorkspaceContext.Provider value={{ rca: CASE, readOnly: true, canWrite: false, closed: true, basePath: '/rca/c1' }}>
              <CaseExportPdf />
            </CaseWorkspaceContext.Provider>
          </MemoryRouter>
        </DisplayCurrencyContext.Provider>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    posts = [];
    saved.names = [];
    refuse = false;
    jobState = job('completed');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return refuse ? json({ code: 'MONEY_NOT_VISIBLE', message: 'money is not visible to your role' }, 403) : json({ jobId: 'job-12345678', statusUrl: '/api/v2/exports/job-12345678' }, 202);
        }
        if (path.endsWith('/download')) return new Response(new Blob(['%PDF-1.3']), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
        return json(jobState);
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('requests the case PDF in the display currency, follows the job and downloads the file', async () => {
    renderButton('IRR');
    fireEvent.click(screen.getByTestId('case-export-pdf-start'));
    await waitFor(() => expect(screen.getByTestId('case-export-pdf')).toHaveAttribute('data-state', 'completed'));
    expect(posts).toEqual([{ reportType: 'rca_case', format: 'pdf', revisionSelector: 'case', rcaId: 'c1', currency: 'IRR' }]);
    expect(screen.getByTestId('case-export-pdf-state')).toHaveTextContent('PDF ready');
    fireEvent.click(screen.getByTestId('case-export-pdf-download'));
    await waitFor(() => expect(saved.names).toEqual(['traverse-forge-investigation-gearbox-failure-on-e-201-job-1234.pdf']));
  });

  it('shows a running job, then a failed one with its reason', async () => {
    jobState = job('failed', { code: 'RENDER_FAILED', message: 'the export could not be rendered' });
    renderButton();
    fireEvent.click(screen.getByTestId('case-export-pdf-start'));
    expect(await screen.findByText(/the export could not be rendered/i)).toBeInTheDocument();
    expect(screen.getByTestId('case-export-pdf-state')).toHaveTextContent('The PDF failed');
    expect(screen.getByTestId('case-export-pdf-start')).toBeEnabled();
  });

  it('a running job keeps the button busy', async () => {
    jobState = job('running');
    renderButton();
    fireEvent.click(screen.getByTestId('case-export-pdf-start'));
    await waitFor(() => expect(screen.getByTestId('case-export-pdf-state')).toHaveTextContent('Preparing the PDF…'));
    expect(screen.getByTestId('case-export-pdf-start')).toBeDisabled();
    expect(posts[0]).toMatchObject({ currency: 'USD' });
  });

  it('a refused request says so in plain words', async () => {
    refuse = true;
    renderButton();
    fireEvent.click(screen.getByTestId('case-export-pdf-start'));
    expect(await screen.findByText('The PDF could not be made')).toBeInTheDocument();
    expect(screen.queryByTestId('case-export-pdf-state')).toBeNull();
  });

  it('is not offered to a role without money (the server refuses the PDF)', () => {
    actAs('Operator', 'u-2');
    renderButton();
    expect(screen.queryByTestId('case-export-pdf')).toBeNull();
  });
});
