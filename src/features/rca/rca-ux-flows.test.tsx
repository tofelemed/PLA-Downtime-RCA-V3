import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';
import { CaseWorkspaceContext } from './case/case-context';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { EventCaseSection } = await import('./pages/event-case-section');
const { FiveWhyTool } = await import('./case/analysis/tools/five-why/five-why-tool');
const { FaultTreeTool } = await import('./case/analysis/tools/fault-tree/fault-tree-tool');
const { ActionRow } = await import('./actions/action-row');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const NO_ANALYSES = { fiveWhy: null, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null };

const CASE = {
  id: 'c1', title: 'Pump trips', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Trips after the seal change', teamMemberIds: [], rootCause: 'Bearing wear', templateId: null, teamCharter: null,
  recommendations: [], evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
} as unknown as RcaCaseView;

const EVIDENCE = {
  kind: 'event', builtAt: '2026-10-10T00:00:00Z',
  event: { id: 'e1', unitId: 'u-1', assetId: 'a1', start: '2026-10-09T00:00:00Z', end: null, durationSeconds: null },
  revisions: [], causeCodes: { reasonCode: { id: 'r1', code: 'DP', name: 'Die plate blockage', versionId: null }, impactCode: null, failureMode: null },
  recurrence: { windowDays: 90, sameAsset: null, sameReason: null }, trendWindow: { from: '2026-10-09T00:00:00Z', to: '2026-10-09T02:00:00Z', signalIds: [] },
  approvedImpact: { lines: 0, quantities: [], values: [], basis: 'b' },
};

describe('RCA UX remediation flows (U1)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode, rca: RcaCaseView = CASE) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseWorkspaceContext.Provider value={{ rca, readOnly: false, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('F-2: shows the stop being investigated and prefills an editable title and problem statement', async () => {
    reply = (call) => {
      const path = call.url.pathname;
      if (path.endsWith('/rca-evidence')) return json(200, EVIDENCE);
      if (path.endsWith('/units')) return json(200, list([{ id: 'u-1', name: 'Unit 100' }]));
      if (path.endsWith('/assets')) return json(200, list([{ id: 'a1', name: 'Extruder E-1', retiredAt: null }]));
      return json(200, path.endsWith('/similar') ? [] : list([]));
    };
    wrap(<EventCaseSection eventId="e1" />);
    const card = await screen.findByTestId('event-header-card');
    expect(card.textContent).toContain('Unit 100');
    expect(card.textContent).toContain('Extruder E-1');
    expect(card.textContent).toContain('Die plate blockage');
    expect(screen.getByTestId('event-header-time').textContent).toContain('Ongoing');
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    expect(title.value).toMatch(/^Unit 100 · Die plate blockage · /);
    expect((screen.getByLabelText('Problem statement') as HTMLTextAreaElement).value).toMatch(/Stop on Unit 100, Extruder E-1 since .* \(ongoing\)/);
    fireEvent.change(title, { target: { value: 'My own title' } });
    expect(title.value).toBe('My own title');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/events/e1');
  });

  it('F-8: leaves an existing root cause alone by default and reports a failed root-cause save on its own', async () => {
    reply = (call) => {
      if (call.method === 'PUT') return json(200, { id: 'fw1', rowVersion: 1, updatedAt: '2026-10-11T00:00:00Z', ...call.body });
      if (call.method === 'PATCH') return json(409, { code: 'VERSION_CONFLICT', message: 'changed', correlationId: 'x', retryable: false });
      return call.url.pathname.endsWith('/readiness') ? json(404, {}) : json(200, NO_ANALYSES);
    };
    wrap(<FiveWhyTool />);
    expect((await screen.findByTestId('current-root-cause')).textContent).toContain('Bearing wear');
    const apply = screen.getByLabelText("Also set it as the investigation's root cause");
    expect(apply).toHaveAttribute('aria-checked', 'false');
    fireEvent.change(screen.getByLabelText('Answer (cause found)'), { target: { value: 'Seal leak' } });
    fireEvent.change(screen.getByLabelText('Root cause'), { target: { value: 'Seal' } });
    fireEvent.click(apply);
    fireEvent.click(screen.getByTestId('save-tool'));
    expect((await screen.findByTestId('root-cause-error')).textContent).toContain("The 5-Why was saved, but the investigation's root cause was not updated");
    expect(calls.some((call) => call.method === 'PUT')).toBe(true);
  });

  it('F-9: removing a filled 5-Why level is confirmed; an empty one goes at once', async () => {
    reply = (call) => (call.url.pathname.endsWith('/readiness') ? json(404, {}) : json(200, NO_ANALYSES));
    wrap(<FiveWhyTool />);
    fireEvent.change(await screen.findByLabelText('Answer (cause found)'), { target: { value: 'Seal leak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask another why' }));
    expect(screen.getAllByTestId('why-level')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove why 2' }));
    expect(screen.getAllByTestId('why-level')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ask another why' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove why 1' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove level' }));
    await waitFor(() => expect(screen.getAllByTestId('why-level')).toHaveLength(1));
  });

  it('F-9: removing a fault-tree node with nodes below it names how many move up', async () => {
    const faultTree = {
      id: 'ft1', rowVersion: 1, updatedAt: '2026-10-11T00:00:00Z', topEvent: 'Trip', topEventProbability: null, topEventProbabilityReason: null,
      nodes: [
        { id: 'n1', type: 'OrGate', description: 'Gate', parentId: null, probability: null },
        { id: 'n2', type: 'BasicEvent', description: 'Seal', parentId: 'n1', probability: null },
      ],
    };
    reply = () => json(200, { ...NO_ANALYSES, faultTree });
    wrap(<FaultTreeTool />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove node 1' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('1 node(s) below it');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove node' }));
    await waitFor(() => expect(screen.getAllByTestId('fault-tree-node')).toHaveLength(1));
  });

  it('F-9: cancelling an action is confirmed with a reason before the PATCH', async () => {
    const action = {
      id: 'a1', rcaId: 'c1', title: 'Realign', description: null, ownerId: null, dueDate: null, status: 'open', actionType: null,
      evidenceExpected: '', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null,
      completionVerifiedBy: null, verificationWindowStart: null, verificationWindowEnd: null, baseline: null, postAction: null,
      verificationStatus: 'not_planned', verdict: null, claimedAvoidedLoss: null, createdAt: '2026-10-01T00:00:00Z', rowVersion: 2,
    } as RcaActionView;
    reply = (call) => (call.method === 'PATCH' ? json(200, { ...action, status: 'cancelled', rowVersion: 3 }) : json(200, list([])));
    wrap(<ul><ActionRow action={action} /></ul>);
    fireEvent.change(screen.getByLabelText('Status of Realign'), { target: { value: 'cancelled' } });
    const dialog = await screen.findByRole('alertdialog');
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
    expect(within(dialog).getByRole('button', { name: 'Cancel action' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason for cancelling/), { target: { value: ' Replaced by the redesign ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel action' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ status: 'cancelled', cancelReason: 'Replaced by the redesign' }));
  });
});
