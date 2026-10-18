import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { LotDispositionView } from '@/api/v2/types/periods';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'UTC' }) }));

const { DispositionsSection } = await import('./dispositions-section');
const { RecordDispositionPage } = await import('./record-disposition-page');

const PERIOD = { id: 'p1', unitId: 'u1', utcStart: '2026-10-17T02:30:00.000Z', utcEnd: '2026-10-17T10:30:00.000Z', slices: [{ id: 's1', productId: 'prod-1', quantityUom: 't', actuals: null }] };
const APPROVED: LotDispositionView = {
  id: 'd-a', unitId: 'u1', productId: 'prod-1', lotCode: 'HD5502-20261017-A01', dispositionClass: 'downgrade', quantity: '2', uom: 't',
  productionStart: PERIOD.utcStart, productionEnd: PERIOD.utcEnd, labReleasedAt: null, recoveryOfId: null, remeasured: true, productionEventId: null,
  supersedesId: null, reason: null, evidenceRef: 'LAB-A', state: 'approved', authorId: 'leila', decidedBy: 'neda', decidedAt: PERIOD.utcEnd,
  decisionReason: null, supersededAt: null, createdAt: PERIOD.utcEnd, rowVersion: 1,
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('correcting an approved disposition (Marun E2E)', () => {
  let posts: Array<{ path: string; body: Record<string, unknown> }>;
  const open = (path: string) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/plans/:planId/periods/:periodId/actuals" element={<DispositionsSection planId="plan1" periodId="p1" timezone="UTC" />} />
            <Route path="/plans/:planId/periods/:periodId/dispositions/new" element={<RecordDispositionPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    posts = [];
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      if (init.method === 'POST') {
        posts.push({ path, body: JSON.parse(String(init.body)) });
        return json({ ...APPROVED, id: 'd-b', state: 'proposed', supersedesId: 'd-a' });
      }
      if (path.endsWith('/production-periods/p1')) return json({ data: PERIOD });
      if (path.endsWith('/lot-dispositions')) return json({ items: [APPROVED], nextCursor: null });
      return json({ items: [], nextCursor: null });
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('a disposition writer opens the correction of an approved lot and proposes it with supersedesId', async () => {
    actAs('production_engineer', 'leila');
    open('/plans/plan1/periods/p1/actuals?keep=scope');
    fireEvent.click(await screen.findByTestId('disposition-correct'));
    expect(await screen.findByRole('heading', { name: 'Correct a product disposition' })).toBeTruthy();
    const lot = (await screen.findByLabelText('Lot number')) as HTMLInputElement;
    expect(lot.value).toBe('HD5502-20261017-A01');
    fireEvent.change(screen.getByLabelText('Quantity (t)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose the correction' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].path).toMatch(/\/v2\/lot-dispositions$/);
    expect(posts[0].body).toMatchObject({ supersedesId: 'd-a', quantity: '3', lotCode: 'HD5502-20261017-A01', productId: 'prod-1' });
  });

  it('a reader without the disposition role is not offered the correction', async () => {
    actAs('viewer', 'vic');
    open('/plans/plan1/periods/p1/actuals');
    expect(await screen.findByText('HD5502-20261017-A01')).toBeTruthy();
    expect(screen.queryByTestId('disposition-correct')).toBeNull();
  });
});
