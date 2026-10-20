import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';
import { filtersFromParams, isChipActive, paramsFromFilters, toCaseQuery } from '../model/case-filters';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaListPage } = await import('./rca-list-page');

const CODE = '22222222-2222-4222-8222-222222222222';
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = { items: [], nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' } };
const SUMMARY = { total: 0, open: 0, overdue: 0, critical: 0, overdueActions: 0, effectivenessPending: 0, byStatus: [], asOf: '2026-10-19T00:00:00Z' };
const CAUSE = { id: CODE, code: 'MIS-01', name: 'Coupling misalignment', description: null, category: null, parentId: null, isActive: false, activeChildren: 0, rowVersion: 1 };

describe('item 1.1: the case list honours ?causeCodeId', () => {
  let urls: URL[];
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    urls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      if (parsed.pathname.endsWith('/rcas/summary')) return json(SUMMARY);
      return json(parsed.pathname.endsWith(`/rca-causes/${CODE}`) ? CAUSE : list);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a well-formed cause code in the URL and sends it to the server; a malformed one is dropped', () => {
    const filters = filtersFromParams(new URLSearchParams(`causeCodeId=${CODE}&status=Closed`));
    expect(filters.causeCodeId).toBe(CODE);
    expect(toCaseQuery(filters).causeCodeId).toBe(CODE);
    expect(paramsFromFilters(filters)).toEqual({ status: 'Closed', causeCodeId: CODE });
    expect(paramsFromFilters({ ...filters, causeCodeId: undefined })).toEqual({ status: 'Closed' });
    expect(filtersFromParams(new URLSearchParams('causeCodeId=nope')).causeCodeId).toBeUndefined();
    expect(isChipActive({ kind: 'all' }, filtersFromParams(new URLSearchParams(`causeCodeId=${CODE}`)))).toBe(false);
  });

  it('shows a removable "Cause: CODE — Name" chip and lists the cases of that code', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`/rca?causeCodeId=${CODE}`]}>
          <RcaListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const chip = await screen.findByTestId('case-cause-filter');
    await waitFor(() => expect(chip).toHaveTextContent('Cause: MIS-01 — Coupling misalignment (retired)'));
    const caseRequests = () => urls.filter((url) => url.pathname.endsWith('/v2/rcas'));
    await waitFor(() => expect(caseRequests().some((url) => url.searchParams.get('causeCodeId') === CODE)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Remove the filter Cause: MIS-01/ }));
    await waitFor(() => expect(screen.queryByTestId('case-cause-filter')).toBeNull());
    await waitFor(() => expect(caseRequests().some((url) => !url.searchParams.has('causeCodeId'))).toBe(true));
  });
});
