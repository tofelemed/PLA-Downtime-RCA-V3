import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';
import { CaseWorkspaceContext } from './case/case-context';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { HistoryPage } = await import('./case/history/history-page');
const { ActionForm } = await import('./actions/action-form');
const { ActionRow } = await import('./actions/action-row');
const { CausesPanel } = await import('./case/causes/causes-panel');
const { WorkflowPanel } = await import('./case/workflow/workflow-panel');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const USERS = list([{ id: 'user-1', name: 'Ali Rezaei' }, { id: 'u2', name: 'Sara Karimi' }]);
const REC = { id: 'r1', title: 'Replace the seals', description: null, priority: 'High', ownerId: null, dueDate: null, status: 'Open', estimatedCost: null, actions: [] };

const CASE = {
  id: 'c1', title: 'Pump trips', status: 'Monitoring', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: null, teamMemberIds: [], rootCause: null, templateId: null, teamCharter: null, recommendations: [REC],
  evidence: [{ id: 'ev1', title: 'Vibration trend', nodeIds: [] }], logicTree: [{ id: 'n1', parentId: null, label: 'Seal leak' }],
  eventDiagram: { nodes: [], edges: [] },
} as unknown as RcaCaseView;

const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Realign', description: null, ownerId: 'u2', dueDate: null, status: 'open', actionType: null,
  evidenceExpected: 'A report', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null,
  completionVerifiedBy: null, verificationWindowStart: null, verificationWindowEnd: null, verificationMethod: null, verifierId: null, verificationWindowLocked: false, baseline: null, postAction: null,
  verificationStatus: 'not_planned', verdict: null, claimedAvoidedLoss: null, cancelReason: null, cancelledBy: null, cancelledAt: null,
  recommendationId: 'r1', linkedTask: null, taskCompletedAt: null, createdAt: '2026-01-01T00:00:00Z', rowVersion: 2,
} satisfies RcaActionView;

const HISTORY = list([
  {
    id: 'h1', at: '2026-10-05T08:00:00Z', action: 'rca_case.transitioned', entityType: 'rca_case', entityId: 'c1', actorId: 'user-1',
    actorName: 'Ali Rezaei', service: null, reason: 'Actions in place', revision: 5, changedFields: ['status'],
    values: { status: { from: 'Analysis', to: 'Monitoring' } }, beforeHash: 'a', afterHash: 'b', detail: {},
  },
  {
    id: 'h2', at: '2026-10-04T08:00:00Z', action: 'rca_action.updated', entityType: 'rca_action', entityId: 'a1', actorId: 'u2',
    actorName: 'Sara Karimi', service: null, reason: null, revision: null, changedFields: ['ownerId', 'title'],
    values: { ownerId: { from: null, to: 'u2' } }, beforeHash: 'c', afterHash: 'd', detail: {},
  },
  {
    id: 'h3', at: '2026-10-03T08:00:00Z', action: 'rca_case.logic_tree_reset', entityType: 'rca_case', entityId: 'c1', actorId: null,
    actorName: null, service: null, reason: null, revision: null, changedFields: [], values: {}, beforeHash: null, afterHash: null, detail: {},
  },
]);

const CAUSE = {
  id: 'k-1', rcaId: 'c1', kind: 'root', causeCodeId: 'code-old', causeCode: { code: 'MEC-01', name: 'Worn seal', active: false },
  statement: 'Seal worn beyond limit', evidenceIds: ['ev1'], nodeIds: [], createdBy: 'user-1', createdAt: '2026-10-02T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z', rowVersion: 1,
};
const CODES = list([{ id: 'code-1', code: 'MEC-02', name: 'Misalignment', isActive: true, parentId: null }]);

describe('RCA history, recommendation → action → task, typed causes (items 2, 5, 7)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode, rca: RcaCaseView = CASE) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseWorkspaceContext.Provider value={{ rca, readOnly: false, canWrite: true, closed: false, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    actAs('SuperAdmin', 'user-1');
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('item 2: the History tab lists entries with plain labels, actor, before → after and reason', async () => {
    reply = (call) => (call.url.pathname.endsWith('/rcas/c1/history') ? json(200, HISTORY) : json(200, USERS));
    wrap(<HistoryPage />);
    const entries = await screen.findAllByTestId('history-entry');
    expect(entries).toHaveLength(3);
    expect(within(entries[0]).getByTestId('history-action').textContent).toBe('Status changed');
    expect(within(entries[0]).getByTestId('history-actor').textContent).toBe('Ali Rezaei');
    expect(within(entries[0]).getByTestId('history-value').textContent).toBe('Status: Analysis → Monitoring');
    expect(within(entries[0]).getByTestId('history-reason').textContent).toBe('Reason: Actions in place');
    expect(within(entries[1]).getByTestId('history-action').textContent).toBe('Action changed');
    await waitFor(() => expect(within(entries[1]).getByTestId('history-value').textContent).toBe('Owner: none → Sara Karimi'));
    expect(within(entries[1]).getByTestId('history-fields').textContent).toBe('Changed: Title');
    expect(within(entries[2]).getByTestId('history-action').textContent).toBe('Investigation logic tree reset');
    expect(calls.find((call) => call.url.pathname.endsWith('/history'))?.url.searchParams.get('limit')).toBe('20');
  });

  it('item 5: the action form sends the chosen recommendation', async () => {
    reply = (call) => (call.method === 'POST' ? json(201, { ...ACTION, id: 'a2' }) : json(200, USERS));
    wrap(<ActionForm rcaId="c1" />);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'Replace seal' } });
    fireEvent.change(screen.getByLabelText('Implements recommendation'), { target: { value: 'r1' } });
    fireEvent.click(screen.getByTestId('add-action'));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ title: 'Replace seal', recommendationId: 'r1' }));
  });

  it('item 5: the action row shows its recommendation and the completed-task hint', () => {
    reply = () => json(200, USERS);
    const linked = { ...ACTION, linkedTask: { id: 't1', status: 'Completed', assigneeId: 'u2', dueDate: null, completedAt: '2026-10-06T00:00:00Z' }, taskCompletedAt: '2026-10-06T00:00:00Z' };
    wrap(<ul><ActionRow action={linked} /></ul>);
    expect(screen.getByTestId('action-recommendation').textContent).toBe('Implements: Replace the seals');
    expect(screen.getByRole('link', { name: 'Completed' })).toHaveAttribute('href', '/tasks/t1');
    expect(screen.getByTestId('action-task-completed-hint').textContent).toContain('Task completed — record completion evidence to complete the action');
  });

  it('item 5: a task created from an action sends rcaActionId; 409 ACTION_TASK_EXISTS reads in words', async () => {
    reply = (call) =>
      call.method === 'POST'
        ? json(409, { code: 'ACTION_TASK_EXISTS', message: 'this action already has an open task', correlationId: 'x', retryable: false })
        : json(200, USERS);
    wrap(<ul><ActionRow action={ACTION} /></ul>);
    fireEvent.click(screen.getByTestId('create-action-task'));
    expect((await screen.findByTestId('action-task-exists')).textContent).toContain('This action already has an open task.');
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.url.pathname).toBe('/api/v2/tasks');
    expect(post?.body).toMatchObject({ title: 'Realign', assigneeId: 'u2', linkType: 'RCA', linkId: 'c1', rcaActionId: 'a1' });
    expect(calls.some((call) => call.method === 'GET' && call.url.pathname === '/api/v2/tasks')).toBe(false);
  });

  it('item 7: the causes panel lists causes by kind (retired code marked) and adds a coded cause', async () => {
    reply = (call) => {
      if (call.method === 'POST') return json(201, { ...CAUSE, id: 'k-2', kind: 'direct' });
      if (call.url.pathname.endsWith('/rcas/c1/causes')) return json(200, [CAUSE]);
      if (call.url.pathname.endsWith('/rca-causes')) return json(200, CODES);
      return json(200, USERS);
    };
    wrap(<CausesPanel />);
    const root = await screen.findByTestId('causes-root');
    expect(within(root).getByText('Seal worn beyond limit')).toBeInTheDocument();
    expect(within(root).getByTestId('cause-code-retired').textContent).toBe('Retired');
    expect(within(root).getByText('Evidence: Vibration trend')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-cause'));
    const editor = screen.getByTestId('cause-editor');
    fireEvent.change(within(editor).getByLabelText('Kind'), { target: { value: 'direct' } });
    await within(editor).findByRole('option', { name: 'MEC-02 — Misalignment' });
    fireEvent.change(within(editor).getByLabelText('Cause code'), { target: { value: 'code-1' } });
    fireEvent.change(within(editor).getByLabelText(/^Statement/), { target: { value: ' Coupling misaligned ' } });
    fireEvent.click(within(editor).getByLabelText('Seal leak'));
    fireEvent.click(within(editor).getByTestId('save-cause'));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      kind: 'direct', causeCodeId: 'code-1', statement: 'Coupling misaligned', evidenceIds: [], nodeIds: ['n1'],
    }));
    expect(calls.find((call) => call.method === 'POST')?.url.pathname).toBe('/api/v2/rcas/c1/causes');
  });

  it('item 7: causes are read-only once closure is requested (the rule behind the Causes ⓘ); a CAUSES_LOCKED refusal reads in words', async () => {
    reply = (call) => (call.url.pathname.endsWith('/rcas/c1/causes') ? json(200, [CAUSE]) : json(200, USERS));
    const view = wrap(<CausesPanel />, { ...CASE, status: 'Closure Review' } as RcaCaseView);
    await screen.findByTestId('cause-item');
    expect(screen.queryByText(/Causes are locked once closure is requested/)).toBeNull();
    const info = within(screen.getByTestId('causes-locked')).getByRole('button', { name: 'About Causes' });
    fireEvent.focus(info);
    expect((await screen.findAllByText(/Causes are locked once closure is requested/)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('add-cause')).toBeNull();
    expect(screen.queryByTestId('edit-cause')).toBeNull();
    view.unmount();
    reply = (call) => {
      if (call.method === 'POST') return json(422, { code: 'CAUSES_LOCKED', message: 'causes are locked once closure is requested', correlationId: 'x', retryable: false });
      return call.url.pathname.endsWith('/rcas/c1/causes') ? json(200, []) : json(200, CODES);
    };
    wrap(<CausesPanel />);
    fireEvent.click(await screen.findByTestId('add-cause'));
    fireEvent.change(screen.getByLabelText(/^Statement/), { target: { value: 'Late lubrication' } });
    fireEvent.click(screen.getByTestId('save-cause'));
    expect((await screen.findByTestId('rca-refusal')).textContent).toContain('Causes are locked once closure is requested');
  });

  it('item 7: readiness shows the coded root-cause blocker with a link to the causes, and the count', async () => {
    const readiness = {
      rcaId: 'c1', status: 'Monitoring', next: [{ to: 'Closure Review', gates: ['closure'] }], investigation: { blockers: [], advice: [] },
      closure: { blockers: [{ code: 'CODED_ROOT_CAUSE_MISSING', field: 'causes', message: 'a coded root cause is required' }], effectiveness: null, rootCauseRule: { coded: true, codedRootCauses: 0 } },
      approver: { canApprove: false, reason: null }, linkedRecurrences: 0, rules: { fiveWhyGuidelineLevels: 5, consequenceClass: null },
    };
    reply = (call) => (call.url.pathname.endsWith('/readiness') ? json(200, readiness) : json(200, USERS));
    wrap(<WorkflowPanel />);
    const blockers = await screen.findByTestId('closure-blockers');
    expect(blockers.textContent).toContain('At least one root cause with a cause code is required.');
    expect(within(blockers).getByTestId('coded-root-cause-link')).toHaveAttribute('href', '/rca/c1/analysis#causes');
    expect(screen.getByTestId('workflow-coded-root-causes').textContent).toBe('Coded root causes: 0');
  });
});
