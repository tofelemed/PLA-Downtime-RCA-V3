import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { MonthClosePage } = await import('./month-close-page');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const VIEW: MonthCloseView = {
  monthKey: '1405-07',
  calendar: 'persian',
  firstDate: '2026-09-23',
  endDate: '2026-10-23',
  previousMonthKey: '1405-06',
  nextMonthKey: '1405-08',
  state: 'open',
  rowVersion: null,
  policy: { id: 'p1', version: 1, quantitiesCloseWorkingDay: 3, financeSignOffWorkingDay: 5, weekendDays: [4, 5], blockOnOpenProposals: true, materialityEnabled: false, materialityReviewerRoles: ['production_accountant'] },
  deadlines: {
    timezone: 'Asia/Tehran',
    quantitiesDue: '2026-10-26',
    quantitiesDueAt: '2026-10-26T20:30:00.000Z',
    financeDue: '2026-10-28',
    financeDueAt: '2026-10-28T20:30:00.000Z',
    quantitiesOverdue: true,
    financeOverdue: false,
    holidays: [],
  },
  signOffs: {
    quantitiesClosedBy: null,
    quantitiesClosedAt: null,
    materialityRequired: false,
    materialityReviewedBy: null,
    materialityReviewedAt: null,
    financeSignedOffBy: null,
    financeSignedOffAt: null,
    lockedBy: null,
    lockedAt: null,
  },
  prerequisites: {
    met: false,
    periods: 90,
    approved: 89,
    pendingCount: 1,
    pending: [{ periodId: 'per-1', unitId: 'u1', unitName: 'Demo unit 100', localDate: '2026-10-20', shiftName: 'B', workflow: 'in_review' }],
    openProposalCount: 0,
    openProposals: [],
  },
  materiality: { findings: [], adjustmentTotals: [] },
  reopenCount: 0,
  comment: null,
  history: [],
  asOf: '2026-10-27T08:00:00.000Z',
};

describe('month close screen (SME R1 / R4)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={['/month-close?month=1405-07']}>
          <MonthClosePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('shows the server deadlines, the overdue stage and the period that blocks the close', async () => {
    actAs('manager_approver', 'plant-manager');
    reply = () => json(200, VIEW);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('close-state').textContent).toBe('Open'));
    expect(calls[0].url.pathname).toMatch(/\/v2\/month-closes\/1405-07$/);
    expect(screen.getByTestId('deadline-quantities').getAttribute('data-overdue')).toBe('true');
    expect(screen.getByTestId('pending-periods').textContent).toContain('Demo unit 100');
    expect(screen.getByTestId('pending-periods').textContent).toContain('Waiting for approval');
    expect((screen.getByTestId('step-close-quantities') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('step-finance-sign-off')).toBeNull();
  });

  it('finance signs off a closed month; the quantity signer is told someone else must', async () => {
    actAs('finance_approver', 'plant-manager');
    const closed: MonthCloseView = {
      ...VIEW,
      state: 'quantities_closed',
      prerequisites: { ...VIEW.prerequisites, met: true, approved: 90, pendingCount: 0, pending: [] },
      signOffs: { ...VIEW.signOffs, quantitiesClosedBy: { id: 'plant-manager', name: 'Demo plant manager' }, quantitiesClosedAt: '2026-10-25T06:00:00.000Z' },
    };
    reply = () => json(200, closed);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('close-sod')).toBeTruthy());
    expect((screen.getByTestId('step-finance-sign-off') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a reopen sends the required reason to the server', async () => {
    actAs('finance_approver', 'finance-1');
    const signed: MonthCloseView = { ...VIEW, state: 'finance_signed_off', prerequisites: { ...VIEW.prerequisites, met: true, pendingCount: 0, pending: [] } };
    reply = (call) => (call.method === 'POST' ? json(200, { ...signed, state: 'open' }) : json(200, signed));
    renderPage();
    fireEvent.click(await screen.findByTestId('step-reopen'));
    fireEvent.change(await screen.findByTestId('step-reopen-text'), { target: { value: 'Demo: late lab result' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen month' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/month-closes\/1405-07\/reopen$/);
    expect(post?.body).toEqual({ reason: 'Demo: late lab result' });
  });
});
