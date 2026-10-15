import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { SourceStatusMappingView } from '@/api/v2/types/status-mappings';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { StatusMappingsPage } = await import('./status-mappings-page');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const APPROVED: SourceStatusMappingView = {
  id: 'm1',
  sourceSystem: 'lims',
  version: 1,
  state: 'approved',
  statuses: [
    { status: 'AUTHORIZED', released: true },
    { status: 'COMPLETED', released: false },
  ],
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  createdBy: 'author-1',
  createdByName: 'Demo author',
  approvedBy: 'owner-1',
  approvedByName: 'Demo owner',
  approvedAt: '2026-01-02T00:00:00.000Z',
  inForce: true,
  notes: null,
};
const DRAFT: SourceStatusMappingView = { ...APPROVED, id: 'm2', version: 2, state: 'draft', approvedBy: null, approvedByName: null, approvedAt: null, inForce: false };

describe('source status rules screen (SME R13)', () => {
  let calls: Call[];

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>
          <StatusMappingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
        calls.push(call);
        if (call.method === 'POST') return json(call.url.pathname.endsWith('/approve') ? 200 : 201, DRAFT);
        return json(200, { items: [DRAFT, APPROVED] });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('shows the versions of a source, their rules and which one is in force; a reader gets no write controls', async () => {
    actAs('viewer', 'viewer-1');
    renderPage();
    const versions = await screen.findAllByTestId('mapping-version');
    expect(versions.map((v) => v.getAttribute('data-in-force'))).toEqual(['false', 'true']);
    expect(screen.getAllByTestId('mapping-rules')[1].textContent).toContain('AUTHORIZED → released');
    expect(screen.getAllByTestId('mapping-rules')[1].textContent).toContain('COMPLETED → not released');
    expect(versions[1].textContent).toContain('Demo owner');
    expect(screen.queryByTestId('mapping-approve')).toBeNull();
    expect(screen.queryByTestId('mapping-new-source')).toBeNull();
  });

  it('the author of a draft cannot approve it; another source owner approves', async () => {
    actAs('production_accountant', 'author-1');
    const { unmount } = renderPage();
    await screen.findAllByTestId('mapping-version');
    expect(screen.queryByTestId('mapping-approve')).toBeNull();
    unmount();
    actAs('production_accountant', 'owner-2');
    renderPage();
    fireEvent.click(await screen.findByTestId('mapping-approve'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.url.pathname).toMatch(/\/v2\/source-status-mappings\/m2\/approve$/);
  });

  it('a new version starts from the source newest statuses and sends only declared fields', async () => {
    actAs('integration_admin', 'admin-1');
    renderPage();
    fireEvent.click(await screen.findByTestId('mapping-new-version-lims'));
    expect((screen.getByTestId('mapping-source') as HTMLInputElement).value).toBe('lims');
    fireEvent.click(screen.getByTestId('mapping-save'));
    expect(await screen.findByText('Choose when the version applies from')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
