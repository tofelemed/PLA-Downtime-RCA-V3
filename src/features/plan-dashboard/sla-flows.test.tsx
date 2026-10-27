import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { PeriodSlaDetailView } from '@/api/v2/types/period-sla';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { WorkflowBar } = await import('./workflow/workflow-bar');
const { SlaPanel } = await import('./sla/sla-panel');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const VIEW: ReconciliationView = {
  periodId: 'p1', unitId: 'unit-1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', isDayGrain: false, lossBasis: 'computed', rowVersion: 4,
  revision: {
    id: 'rev-1', revision: 1, lifecycle: 'in_review', supersedesId: null, currentRunId: 'run-1', currentLineSetId: 'set-1', isStale: false, staleReason: null,
    submittedBy: 'preparer-1', submittedAt: '2026-10-08T15:00:00.000Z', submittedHash: 'b'.repeat(64), submittedRunId: 'run-1', approvedBy: null, approvedAt: null, approvalSnapshotId: null,
    rejectedBy: null, rejectedAt: null, rejectReason: null, cancelledBy: null, cancelledAt: null, afterClose: false, comment: null,
  },
  publishedRevision: null, baseRunId: 'run-1', contentHash: 'b'.repeat(64),
  tolerance: { policyId: null, version: 1, mode: 'zero', value: 0, epsilon: 0.000001, allowUnaccountedClassification: false },
  slices: [{ sliceId: 's1', uom: 't', target: '1000', actual: '850', gap: '150', attributed: '150', toleranceAdjustment: '0', unadjustedResidual: '0', residual: '0', overAccounted: '0', overproduction: '0', tolerance: '0', flags: [] }],
  candidates: [{ lossLineId: 'l1', autoKey: 'k1', sliceId: 's1', kind: 'availability', quantity: '25', basis: 'planning_rate', reasonCodeId: null, impactCodeId: null, causeEventId: 'e1', state: 'accepted', effectiveQuantity: '25' }],
  lines: [],
  openProposalId: null,
};

const DETAIL: PeriodSlaDetailView = {
  periodId: 'p1',
  sla: {
    stage: 'preparation', submitDueAt: '2026-10-09T18:00:00.000Z', approveDueAt: '2026-10-10T06:00:00.000Z', dueAt: '2026-10-09T18:00:00.000Z', overdue: true,
    ageSeconds: 50 * 3600, pausedSeconds: 0, onHold: false, escalationLevel: 1, escalatedTo: 'production_accountant', rejections: 3, rejectionEscalated: true,
    dayEnd: '2026-10-09T02:30:00.000Z', policyVersion: 1,
  },
  holds: [],
  lastRejection: { at: '2026-10-09T06:00:00.000Z', by: 'reviewer-1', reason: 'the event supports only 15 t', failedLines: ['k1'], resubmitDueAt: '2026-10-09T18:00:00.000Z', rejection: 3, escalated: true, escalatedTo: 'production_accountant' },
};

/** GET /production-periods/p1: the period whose actuals quality the SLA line shows */
const periodOf = (qualityState: string) => json(200, { data: { id: 'p1', slices: [{ id: 's1', actuals: { qualityState } }] } });
const isPeriodRead = (call: Call) => call.method === 'GET' && /\/production-periods\/p1$/.test(call.url.pathname);

describe('reconciliation SLA in the period workspace (SME R3 / R6)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  const wrap = (node: ReactNode) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>);

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

  it('a production accountant rejects with a reason and the failed line', async () => {
    actAs('production_accountant', 'reviewer-1');
    reply = (call) => (call.method === 'POST' ? json(200, { ...VIEW, revision: { ...VIEW.revision, lifecycle: 'draft' } }) : json(200, { items: [] }));
    wrap(<WorkflowBar view={VIEW} shown="current" onShowCurrent={() => undefined} />);
    fireEvent.click(screen.getByTestId('wf-reject'));
    fireEvent.change(await screen.findByTestId('wf-reason'), { target: { value: 'the event supports only 15 t' } });
    fireEvent.click(screen.getByTestId('wf-failed-line'));
    fireEvent.click(screen.getByRole('button', { name: 'Return revision' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/production-periods\/p1\/reject$/);
    expect(post?.body).toEqual({ revision: 1, reason: 'the event supports only 15 t', failedLines: ['k1'] });
  });

  it('the preparer sees the reason, the failed line, the new due time and the escalation', async () => {
    actAs('production_engineer', 'preparer-1');
    reply = (call) => (isPeriodRead(call) ? periodOf('partial') : json(200, DETAIL));
    wrap(<SlaPanel view={{ ...VIEW, revision: { ...VIEW.revision, lifecycle: 'draft' } }} timezone="Asia/Tehran" />);
    expect(await screen.findByTestId('sla-overdue')).toBeTruthy();
    expect(screen.getByTestId('sla-escalated').textContent).toMatch(/production accountant/i);
    expect(screen.getByTestId('sla-failed-lines').textContent).toContain('Proposed loss 1 · availability · 25 t');
    expect(screen.getByTestId('sla-rejection').textContent).toMatch(/corrected submission due/);
    expect((await screen.findByTestId('sla-data-state')).textContent).toBe('Data: partly covered');
  });

  it('waiting for the lab sends the kind and the reason', async () => {
    actAs('production_engineer', 'preparer-1');
    reply = (call) => {
      if (isPeriodRead(call)) return periodOf('complete');
      return call.method === 'POST' ? json(200, { ...DETAIL, sla: { ...DETAIL.sla, onHold: true, stage: 'waiting_for_data' } }) : json(200, { ...DETAIL, lastRejection: null });
    };
    wrap(<SlaPanel view={VIEW} timezone="Asia/Tehran" />);
    // Marun E2E: complete data reads as complete; the hold is an action, not a state
    expect((await screen.findByTestId('sla-data-state')).textContent).toBe('Data complete');
    expect(screen.getByTestId('hold-open').textContent).toBe('Pause for late data…');
    fireEvent.click(await screen.findByTestId('hold-open'));
    fireEvent.change(await screen.findByTestId('hold-text'), { target: { value: 'Demo: waiting for the MFI lab result' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start waiting' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/production-periods\/p1\/data-holds$/);
    expect(post?.body).toEqual({ kind: 'lab', reason: 'Demo: waiting for the MFI lab result' });
  });
});
