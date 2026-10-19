import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { CodingGateView } from '@/api/v2/types/stop-coding';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodingGatePanel } = await import('./coding-gate-panel');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const GATE: CodingGateView = {
  mode: 'warn',
  target: '0.95',
  stops: 3,
  coded: 1,
  investigationPending: 1,
  uncoded: 1,
  codedRatio: '0.8',
  codedSeconds: '4800',
  stoppedSeconds: '6000',
  passes: false,
  issues: [
    { code: 'STOPS_UNCODED', message: '1 stop(s)', sliceId: null },
    { code: 'CODING_COVERAGE_LOW', message: 'below', sliceId: null },
  ],
  verification: { verified: 0, unverified: 3, failureDetailed: 1, validated: 0, unvalidated: 1 },
};

const view = (gate: CodingGateView | undefined) =>
  ({ periodId: 'p1', unitId: 'u1', utcStart: '2026-10-15T06:00:00.000Z', utcEnd: '2026-10-15T14:00:00.000Z', codingGate: gate }) as unknown as ReconciliationView;

/** SME D12 / D13: the server's gate verdict and verification counts on the period page, bulk verify of the shift. */
describe('coding gate panel (SME D12 / D13)', () => {
  let bodies: unknown[];
  const wrap = (node: ReactNode) =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>
      </MemoryRouter>,
    );

  beforeEach(() => {
    bodies = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(init.body ? JSON.parse(String(init.body)) : null);
        return json({ done: ['e1', 'e2'], skipped: [{ eventId: 'e3', reason: 'NOT_CODED' }], at: '2026-10-15T06:00:00.000Z' });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('shows the warn verdict, the failed rules and what waits for verification', () => {
    actAs('viewer');
    wrap(<CodingGatePanel view={view(GATE)} />);
    const panel = screen.getByTestId('coding-gate');
    expect(panel.dataset.mode).toBe('warn');
    expect(panel.textContent).toContain('shown as a warning');
    expect(panel.textContent).toContain('80 %');
    expect(screen.getByTestId('coding-gate-issues').querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId('coding-verification').textContent).toContain('waiting: 3');
    expect(screen.queryByTestId('verify-shift')).toBeNull();
  });

  it('a block gate says the submission is blocked; nothing to show without stops', () => {
    const { unmount } = wrap(<CodingGatePanel view={view({ ...GATE, mode: 'block' })} />);
    expect(screen.getByTestId('coding-gate').textContent).toContain('submission is blocked');
    unmount();
    wrap(<CodingGatePanel view={view({ ...GATE, stops: 0 })} />);
    expect(screen.queryByTestId('coding-gate')).toBeNull();
  });

  it('E-7: the uncoded count opens the Event Hub on the period\'s uncoded stops of the unit', () => {
    actAs('viewer');
    wrap(<CodingGatePanel view={view(GATE)} />);
    const link = screen.getByTestId('coding-gate-uncoded-link');
    expect(link).toHaveTextContent('1 stop uncoded');
    const target = new URL(link.getAttribute('href') ?? '', 'http://test');
    expect(target.pathname).toBe('/events');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      from: '2026-10-15T06:00:00.000Z', to: '2026-10-15T14:00:00.000Z', window: 'This period', units: 'u1', kinds: 'downtime', coding: 'uncoded',
    });
  });

  it('E-7: verifying the shift asks first, stating how many stops wait; cancel sends nothing', async () => {
    actAs('production_engineer');
    wrap(<CodingGatePanel view={view(GATE)} />);
    fireEvent.click(screen.getByTestId('verify-shift'));
    expect(await screen.findByRole('alertdialog', { name: 'Verify 3 stops of this shift?' })).toBeInTheDocument();
    const review = screen.getByTestId('verify-shift-review-link');
    expect(review).toHaveTextContent('Review the 3 stops waiting for verification');
    const target = new URL(review.getAttribute('href') ?? '', 'http://test');
    expect(target.searchParams.get('verified')).toBe('not_verified');
    expect(target.searchParams.get('coding')).toBeNull();
    expect(target.searchParams.get('units')).toBe('u1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(bodies).toHaveLength(0);
  });

  it('a production engineer verifies the shift and sees what was skipped', async () => {
    actAs('production_engineer');
    wrap(<CodingGatePanel view={view(GATE)} />);
    fireEvent.click(screen.getByTestId('verify-shift'));
    fireEvent.click(await screen.findByRole('button', { name: 'Verify 3 stops' }));
    await waitFor(() => expect(screen.getByTestId('verify-outcome').textContent).toContain('2 verified, 1 skipped'));
    expect(bodies[0]).toEqual({ periodId: 'p1' });
  });
});
