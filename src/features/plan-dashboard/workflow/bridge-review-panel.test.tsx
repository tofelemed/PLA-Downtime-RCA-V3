import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { BridgeReviewView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';
import { approveGate } from '../model/display';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { BridgeReviewPanel } = await import('./bridge-review-panel');

const BRIDGE: BridgeReviewView = {
  overLimit: 'second_review',
  findings: [{ ref: 'l9', sliceId: 's1', quantity: '20', limit: '10', basis: 'absolute' }],
  required: true,
  review: null,
};

const view = (bridgeReview: BridgeReviewView): ReconciliationView =>
  ({
    periodId: 'p1',
    unitId: 'u1',
    utcStart: '2026-10-08T06:00:00.000Z',
    utcEnd: '2026-10-08T14:00:00.000Z',
    revision: { revision: 2, lifecycle: 'in_review', submittedBy: 'preparer', submittedHash: 'b'.repeat(64), isStale: false },
    lines: [{ authorId: 'preparer' }],
    bridgeReview,
  }) as unknown as ReconciliationView;

/** SME R8: a bridge above the unit limit waits for a second independent reviewer, who never approves too. */
describe('bridge review (SME R8)', () => {
  let bodies: unknown[];
  const wrap = (node: ReactNode) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>);

  beforeEach(() => {
    bodies = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(init.body ? JSON.parse(String(init.body)) : null);
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('blocks approval until reviewed, and blocks the reviewer from approving', () => {
    expect(approveGate(view(BRIDGE), 'approver').code).toBe('BRIDGE_REVIEW_REQUIRED');
    const reviewed = { ...BRIDGE, review: { by: 'reviewer', at: '2026-10-08T16:00:00.000Z' } };
    expect(approveGate(view(reviewed), 'reviewer').code).toBe('SEPARATION_OF_DUTIES');
    expect(approveGate(view(reviewed), 'approver').allowed).toBe(true);
    expect(approveGate(view({ ...BRIDGE, required: false, findings: [] }), 'approver').allowed).toBe(true);
  });

  it('an independent production accountant confirms the bridge with the submitted hash', async () => {
    actAs('production_accountant', 'reviewer');
    wrap(<BridgeReviewPanel view={view(BRIDGE)} />);
    fireEvent.click(screen.getByTestId('bridge-review-confirm'));
    await waitFor(() => expect(bodies.some((b) => b !== null)).toBe(true));
    expect(bodies.find((b) => b !== null)).toEqual({ revision: 2, submittedHash: 'b'.repeat(64) });
  });

  it('the submitter sees no confirm button', () => {
    actAs('production_accountant', 'preparer');
    wrap(<BridgeReviewPanel view={view(BRIDGE)} />);
    expect(screen.getByTestId('bridge-review')).toBeTruthy();
    expect(screen.queryByTestId('bridge-review-confirm')).toBeNull();
  });
});
