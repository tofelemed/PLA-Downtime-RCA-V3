import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { PeriodAdjustmentView, PeriodDetailView } from '@/api/v2/types/periods';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { AdjustmentActions } = await import('./adjustments/adjustment-actions');
const { AdjustmentForm } = await import('./adjustments/adjustment-form');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ADJUSTMENT: PeriodAdjustmentView = {
  id: 'adj-1', sliceId: 's1', kind: 'good', quantity: '-5', uom: 't', basis: 'measured', reason: 'weighbridge recount', evidenceRef: 'WB-1',
  state: 'proposed', authorId: 'someone-else', decidedBy: null,
};

const PERIOD = {
  id: 'p1', unitId: 'u1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z',
  slices: [{ id: 's1', productId: 'prod-1', quantityUom: 't' }], adjustments: [],
} as unknown as PeriodDetailView;

describe('actuals adjustments in the period workspace', () => {
  let calls: Call[];
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url, 'http://localhost'), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return call.method === 'GET' ? json(200, { items: [], nextCursor: null }) : json(200, { ...ADJUSTMENT, state: 'approved' });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('Manager', 'user-me');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('a manager approves a proposed adjustment with one click', async () => {
    wrap(<AdjustmentActions adjustment={ADJUSTMENT} />);
    fireEvent.click(screen.getByTestId('adjustment-approve'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/actuals\/adjustments\/adj-1\/approve$/);
    expect(post?.body).toEqual({});
  });

  it('rejecting needs a reason in the confirmation dialog', async () => {
    wrap(<AdjustmentActions adjustment={ADJUSTMENT} />);
    fireEvent.click(screen.getByTestId('adjustment-reject'));
    const confirm = await screen.findByRole('button', { name: 'Reject adjustment' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('wf-reason'), { target: { value: 'ticket belongs to another shift' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/adj-1\/reject$/);
    expect(post?.body).toEqual({ reason: 'ticket belongs to another shift' });
  });

  it('the author of an adjustment cannot approve it (separation of duties)', () => {
    wrap(<AdjustmentActions adjustment={{ ...ADJUSTMENT, authorId: 'user-me' }} />);
    expect((screen.getByTestId('adjustment-approve') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('adjustment-reject') as HTMLButtonElement).disabled).toBe(true);
  });

  it('proposing posts exactly the declared fields', async () => {
    const saved = vi.fn();
    wrap(<AdjustmentForm period={PERIOD} timezone="UTC" backTo="/plans/x/periods/p1" onSaved={saved} />);
    fireEvent.click(screen.getByTestId('adjustment-save'));
    expect(await screen.findByTestId('field-error-adjQuantity')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Change/), { target: { value: '-5' } });
    fireEvent.change(screen.getByLabelText(/^Evidence/), { target: { value: 'WB-1' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'weighbridge recount' } });
    fireEvent.click(screen.getByTestId('adjustment-save'));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/actuals\/adjustments$/);
    expect(post?.body).toEqual({ sliceId: 's1', kind: 'good', quantity: '-5', basis: 'measured', reason: 'weighbridge recount', evidenceRef: 'WB-1' });
  });
});
