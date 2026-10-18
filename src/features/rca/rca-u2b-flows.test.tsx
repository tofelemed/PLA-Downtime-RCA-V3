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

const { ActionForm } = await import('./actions/action-form');
const { ActionRow } = await import('./actions/action-row');
const { RecommendationQueue } = await import('./recommendations/recommendation-queue');
const { FiveWhyTool } = await import('./case/analysis/tools/five-why/five-why-tool');
const { FaultTreeTool } = await import('./case/analysis/tools/fault-tree/fault-tree-tool');
const { CaseTrace } = await import('./case/case-trace');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const NO_ANALYSES = { fiveWhy: null, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null };
const USERS = list([{ id: 'user-1', name: 'Ali Rezaei' }, { id: 'u2', name: 'Sara Karimi' }]);

const CASE = {
  id: 'c1', title: 'Pump trips', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Trips after the seal change', teamMemberIds: [], rootCause: null, templateId: null, teamCharter: null,
  recommendations: [], evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
} as unknown as RcaCaseView;

const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Realign', description: null, ownerId: 'u2', dueDate: '2026-01-05T00:00:00.000Z', status: 'open', actionType: null,
  evidenceExpected: 'A report', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null,
  completionVerifiedBy: null, verificationWindowStart: null, verificationWindowEnd: null, baseline: null, postAction: null,
  verificationStatus: 'not_planned', verdict: null, claimedAvoidedLoss: null, createdAt: '2026-01-01T00:00:00Z', rowVersion: 2,
} as RcaActionView;

describe('RCA UX remediation flows (U2b)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseWorkspaceContext.Provider value={{ rca: CASE, readOnly: false, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
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

  it('A-8: a new action is owned by the chosen member (you by default)', async () => {
    reply = (call) => (call.method === 'POST' ? json(201, { ...ACTION, id: 'a2' }) : json(200, USERS));
    wrap(<ActionForm rcaId="c1" />);
    const owner = (await screen.findByLabelText('Owner')) as HTMLSelectElement;
    expect(owner.value).toBe('user-1');
    await within(owner).findByRole('option', { name: 'Sara Karimi' });
    fireEvent.change(owner, { target: { value: 'u2' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'Replace seal' } });
    fireEvent.click(screen.getByTestId('add-action'));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ title: 'Replace seal', ownerId: 'u2' }));
  });

  it('A-8: an action past its due day shows "Overdue" and its planning can be edited (only changes are sent)', async () => {
    reply = (call) => (call.method === 'PATCH' ? json(200, { ...ACTION, title: 'Realign coupling', rowVersion: 3 }) : json(200, USERS));
    wrap(<ul><ActionRow action={ACTION} /></ul>);
    expect(screen.getByTestId('action-overdue').textContent).toBe('Overdue');
    fireEvent.click(screen.getByTestId('edit-action'));
    const form = screen.getByTestId('action-edit-form');
    expect(within(form).getByTestId('save-action-edit')).toBeDisabled();
    fireEvent.change(within(form).getByLabelText(/^Action/), { target: { value: 'Realign coupling' } });
    fireEvent.click(within(form).getByTestId('save-action-edit'));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ title: 'Realign coupling' }));
    await waitFor(() => expect(screen.queryByTestId('action-edit-form')).toBeNull());
  });

  it('A-8: the owner sees why they cannot mark their own action done (CA4)', () => {
    reply = () => json(200, USERS);
    actAs('reliability_engineer', 'u2');
    wrap(<ul><ActionRow action={ACTION} /></ul>);
    expect(screen.queryByTestId('mark-done')).toBeNull();
    expect(screen.getByTestId('disabled-reason').textContent).toContain('You own this action');
  });

  it('A-8: another reliability engineer may mark the action done', () => {
    reply = () => json(200, USERS);
    actAs('reliability_engineer', 'someone-else');
    wrap(<ul><ActionRow action={ACTION} /></ul>);
    expect(screen.getByTestId('mark-done')).toBeInTheDocument();
  });

  it('F-1: lists open recommendations with the event link, create, link-to-existing and dismiss', async () => {
    const rec = {
      id: 'r1', eventId: 'e1', occurrenceId: null, unitId: 'u-1', trigger: 'duration', source: { kind: 'policy', id: 'p', version: 3 },
      firedOn: '2026-10-10', provisional: false, outcome: 'recommended', state: 'open', rcaId: null,
      detail: { seconds: 7200, thresholdSeconds: 3600 }, firedAt: '2026-10-10T08:00:00Z', confirmedAt: null, resolvedAt: null,
    };
    reply = (call) => {
      if (call.url.pathname.endsWith('/units')) return json(200, list([{ id: 'u-1', name: 'Unit 100' }]));
      return json(200, list(call.url.pathname.endsWith('/rca-recommendations') ? [rec] : []));
    };
    wrap(<RecommendationQueue />);
    const event = await screen.findByTestId('recommendation-event');
    expect(event).toHaveAttribute('href', '/events/e1');
    await waitFor(() => expect(event.textContent).toBe('Event on Unit 100'));
    expect(screen.getByText(/Long unplanned stop/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create investigation' })).toHaveAttribute('href', '/rca/new?eventId=e1');
    expect(screen.getByRole('link', { name: 'Link to existing' })).toHaveAttribute('href', '/rca/new?eventId=e1&mode=existing');
    expect(screen.getByTestId('dismiss-recommendation')).toBeInTheDocument();
    const request = calls.find((call) => call.url.pathname.endsWith('/rca-recommendations'));
    expect(request?.url.searchParams.get('state')).toBe('open');
  });

  it('F-6: shows unsaved changes, and on a concurrent save offers "Reload latest" keeping the typed text', async () => {
    let saved = false;
    reply = (call) => {
      if (call.method === 'PUT') return json(412, { code: 'VERSION_CONFLICT', message: 'changed', correlationId: 'x', retryable: false });
      if (call.url.pathname.endsWith('/readiness')) return json(404, {});
      const fiveWhy = saved ? { id: 'fw1', rowVersion: 2, updatedAt: '2026-10-11T00:00:00Z', problem: 'Their problem', whyLevels: [{ level: 1, question: 'Why?', answer: 'Theirs', justification: null }], rootCause: '' } : null;
      return json(200, { ...NO_ANALYSES, fiveWhy });
    };
    wrap(<FiveWhyTool />);
    fireEvent.change(await screen.findByLabelText('Answer (cause found)'), { target: { value: 'My seal answer' } });
    expect((await screen.findByTestId('save-state')).textContent).toBe('Unsaved changes');
    saved = true;
    fireEvent.click(screen.getByTestId('save-tool'));
    fireEvent.click(await screen.findByTestId('reload-latest'));
    expect(((await screen.findByLabelText(/Your unsaved text/)) as HTMLTextAreaElement).value).toContain('Answer: My seal answer');
    await waitFor(() => expect((screen.getByLabelText('Answer (cause found)') as HTMLInputElement).value).toBe('Theirs'));
    expect(screen.queryByTestId('tool-conflict')).toBeNull();
  });

  it('F-10: the fault tree is drawn as an indented tree with "add below"', async () => {
    const faultTree = {
      id: 'ft1', rowVersion: 1, updatedAt: '2026-10-11T00:00:00Z', topEvent: 'Trip', topEventProbability: null, topEventProbabilityReason: null,
      nodes: [
        { id: 'n1', type: 'OrGate', description: 'Gate', parentId: null, probability: null },
        { id: 'n2', type: 'BasicEvent', description: 'Seal', parentId: 'n1', probability: null },
      ],
    };
    reply = () => json(200, { ...NO_ANALYSES, faultTree });
    wrap(<FaultTreeTool />);
    const below = await screen.findByRole('list', { name: 'Below Gate' });
    expect(within(below).getAllByTestId('fault-tree-node')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add a node below Seal' }));
    expect(screen.getAllByTestId('fault-tree-node')).toHaveLength(3);
    expect(within(screen.getByRole('list', { name: 'Below Seal' })).getAllByTestId('fault-tree-node')).toHaveLength(1);
  });

  it('G-3: the header names the trigger event and the approved loss from the links page queries', async () => {
    const link = {
      id: 'l1', rcaId: 'c1', linkType: 'event', targetId: 'e1', targetRevision: 1, unitId: 'u-1', source: 'user', linkedBy: null,
      linkedAt: '2026-10-02T00:00:00Z', reason: null, evidence: { event: { physicalType: 'downtime', start: '2026-10-01T06:00:00Z' } },
    };
    const outcome = {
      rcaId: 'c1', claimedAvoided: [], realized: [], note: 'n',
      approvedHistoricalLoss: { lines: 2, quantities: [{ kind: 'lost_production', uom: 't', quantity: '412' }], values: [{ currency: 'USD', amount: '38000', valuedLines: 2, unvaluedLines: 0 }], basis: 'b' },
    };
    reply = (call) => json(200, call.url.pathname.endsWith('/links') ? [link] : outcome);
    wrap(<CaseTrace />);
    const trigger = await screen.findByTestId('case-trigger');
    expect(within(trigger).getByRole('link')).toHaveAttribute('href', '/events/e1');
    expect(trigger.textContent).toContain('Downtime from');
    const loss = await screen.findByTestId('case-approved-loss');
    expect(loss.textContent).toContain('412');
    expect(loss.textContent).toContain('t');
    expect(loss.textContent).toContain('USD');
    expect(calls.filter((call) => call.url.pathname.endsWith('/links'))).toHaveLength(1);
  });
});
