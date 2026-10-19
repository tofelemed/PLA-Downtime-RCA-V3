import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ChangeProposalView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ChangeProposalsPanel } = await import('./change-proposals-panel');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const VIEW = {
  periodId: 'per-1',
  unitId: 'u1',
  utcStart: '2026-10-20T02:30:00.000Z',
  utcEnd: '2026-10-20T10:30:00.000Z',
  rowVersion: 3,
  revision: { id: 'rev-1', revision: 1, lifecycle: 'approved', afterClose: false },
  publishedRevision: 1,
  openProposalId: null,
} as unknown as ReconciliationView;

const MANUAL: ChangeProposalView = {
  id: 'cp-1',
  periodId: 'per-1',
  unitId: 'u1',
  approvedRevisionId: 'rev-1',
  trigger: 'manual_correction',
  state: 'open',
  inputHash: null,
  before: {},
  after: null,
  affectedReports: [],
  detail: {},
  resolvedBy: null,
  resolvedAt: null,
  resolutionReason: null,
  createdRevisionId: null,
  manual: { proposedBy: 'accountant-1', reason: 'Demo: lab re-test', evidenceType: 'lot_sample', evidenceRef: 'LOT-42' },
  createdAt: '2026-10-27T06:00:00.000Z',
  updatedAt: '2026-10-27T06:00:00.000Z',
  rowVersion: 1,
};

describe('change proposals panel: manual correction (SME R4)', () => {
  let calls: Call[];
  let proposals: ChangeProposalView[];

  const renderPanel = (view: ReconciliationView = VIEW, entry = '/') =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={[entry]}>
          <ChangeProposalsPanel view={view} timezone="Asia/Tehran" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    proposals = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
        calls.push(call);
        if (call.method === 'POST') return json(201, MANUAL);
        if (call.url.pathname.includes('reason-codes')) return json(200, { items: [{ id: 'speed-loss', code: 'SPEED-LOSS', name: 'Reduced extrusion rate', parentId: null }], nextCursor: null });
        return json(200, { items: proposals, nextCursor: null });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('a deep link to a proposal beyond the first 20 asks the server for the page starting at it', async () => {
    actAs('production_accountant', 'accountant-2');
    const older = { ...MANUAL, id: 'cp-old', state: 'accepted' as const };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const call = { method: 'GET', url: new URL(url), body: null };
        calls.push(call);
        const focused = call.url.searchParams.get('focus') === 'cp-old';
        return json(200, focused ? { items: [older], nextCursor: null } : { items: [MANUAL], nextCursor: 'next-page' });
      }),
    );
    renderPanel(VIEW, '/plans/plan-1/periods/per-1/history#change-proposal-cp-old');
    expect(await screen.findByTestId('focused-list-notice')).toBeTruthy();
    await waitFor(() => expect(document.getElementById('change-proposal-cp-old')).not.toBeNull());
    expect(calls.some((call) => call.url.searchParams.get('focus') === 'cp-old')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Show all from the start' }));
    await waitFor(() => expect(document.getElementById('change-proposal-cp-1')).not.toBeNull());
    expect(screen.queryByTestId('focused-list-notice')).toBeNull();
  });

  it('production accounting proposes a correction with reason and evidence', async () => {
    actAs('production_accountant', 'accountant-1');
    renderPanel();
    fireEvent.click(await screen.findByTestId('propose-correction'));
    fireEvent.change(await screen.findByTestId('correction-reason'), { target: { value: 'Demo: lab re-test' } });
    fireEvent.change(screen.getByTestId('correction-evidence-type'), { target: { value: 'lot_sample' } });
    fireEvent.change(screen.getByTestId('correction-evidence-ref'), { target: { value: 'LOT-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose correction' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/period-change-proposals$/);
    expect(post?.body).toEqual({ periodId: 'per-1', approvedRevision: 1, reason: 'Demo: lab re-test', evidenceType: 'lot_sample', evidenceRef: 'LOT-42' });
  });

  it('a production engineer cannot propose; nothing is offered while a proposal is open', async () => {
    actAs('production_engineer', 'engineer-1');
    renderPanel();
    await screen.findByTestId('change-proposals');
    expect(screen.queryByTestId('propose-correction')).toBeNull();
  });

  it('the proposer sees the reason and evidence but no decision controls; another approver decides', async () => {
    proposals = [MANUAL];
    actAs('production_accountant', 'accountant-1');
    const { unmount } = renderPanel({ ...VIEW, openProposalId: 'cp-1' });
    expect((await screen.findByTestId('manual-proposal')).textContent).toContain('LOT-42');
    expect(screen.queryByTestId('proposal-accept')).toBeNull();
    expect(screen.queryByTestId('propose-correction')).toBeNull();
    unmount();
    actAs('manager_approver', 'manager-1');
    renderPanel({ ...VIEW, openProposalId: 'cp-1' });
    expect(await screen.findByTestId('proposal-accept')).toBeTruthy();
  });

  it('Marun E2E: a reused proposal shows every cause, the approved value and the re-coded line', async () => {
    proposals = [{
      ...MANUAL,
      id: 'cp-2',
      trigger: 'valuation_change',
      manual: null,
      detail: { reason: 'valuation_policy_changed', triggers: [
        { trigger: 'event_change', reason: 'loss_event_changed', at: '2026-10-18T15:33:35.000Z' },
        { trigger: 'valuation_change', reason: 'valuation_policy_changed', at: '2026-10-18T15:50:00.000Z' },
      ] },
      before: { revision: 2, values: { view: 'contribution_margin', policyVersion: 2, amounts: [{ currency: 'USD', amount: '2250', status: 'valued' }] } },
      after: { codingChanges: [{ autoKey: 'k', sliceId: 's', kind: 'availability', quantity: '14', before: 'speed-loss', after: null }] },
    }];
    actAs('manager_approver', 'maryam');
    renderPanel({ ...VIEW, openProposalId: 'cp-2' });
    expect((await screen.findByTestId('proposal-triggers')).textContent).toBe('Event changed, then Valuation policy changed');
    expect(screen.getByTestId('proposal-values').textContent).toContain('Contribution margin');
    expect(screen.getByTestId('proposal-values').textContent).toContain('2,250.00');
    await waitFor(() => expect(screen.getByTestId('proposal-coding-changes').textContent).toContain('Reason changed: SPEED-LOSS'));
    expect(screen.getByTestId('proposal-coding-changes').textContent).toContain('→ none · availability loss line 14.00');
  });
});
