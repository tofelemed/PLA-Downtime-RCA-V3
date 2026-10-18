import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ExportPanel } = await import('./export-panel');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const VIEW = {
  periodId: 'per-1',
  unitId: 'u1',
  utcStart: '2026-10-17T02:30:00.000Z',
  utcEnd: '2026-10-17T10:30:00.000Z',
  rowVersion: 3,
  revision: { id: 'rev-1', revision: 1, lifecycle: 'approved', afterClose: false },
  publishedRevision: 1,
} as unknown as ReconciliationView;

const completedJob = (id: string) => ({ id, state: 'completed', rowCount: 3, expiresAt: null, contentHash: 'abc', error: null });

describe('export panel: the offered download is the job of the requested format (Marun E2E)', () => {
  let releasePdf: () => void = () => undefined;

  beforeEach(() => {
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const path = new URL(url).pathname;
        if ((init.method ?? 'GET') === 'POST') {
          posts += 1;
          if (posts === 1) return json(202, { jobId: 'job-csv' });
          // the PDF request is still on its way while the CSV job is ready
          await new Promise<void>((resolve) => {
            releasePdf = resolve;
          });
          return json(202, { jobId: 'job-pdf' });
        }
        return json(200, completedJob(path.endsWith('job-pdf') ? 'job-pdf' : 'job-csv'));
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('manager_approver', 'manager-1');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('never labels the previous CSV job as the PDF just requested', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ExportPanel view={VIEW} timezone="Asia/Tehran" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByTestId('export-start'));
    expect((await screen.findByTestId('export-download')).textContent).toContain('Download CSV');
    fireEvent.click(screen.getByTestId('export-start-pdf'));
    await waitFor(() => expect(screen.queryByTestId('export-download')).toBeNull());
    releasePdf();
    expect((await screen.findByTestId('export-download')).textContent).toContain('Download PDF');
  });
});
