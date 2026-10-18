import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView, RcaEvidenceItem } from '@/api/v2/types/rca';
import { CaseWorkspaceContext } from './case/case-context';
import { DEFAULT_ACTION_FILTERS } from './model/action-queue-filters';
import { EMPTY_CASE_FILTERS } from './model/case-filters';
import { EMPTY_EVIDENCE_FORM } from './model/evidence-form';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ActionQueueTab } = await import('./actions/action-queue-tab');
const { MyRcaActionsList } = await import('./actions/my-rca-actions-list');
const { OwnerActionsScreen } = await import('./actions/owner-actions-screen');
const { ActionCancelInfo } = await import('./actions/action-cancel-info');
const { CaseTable } = await import('./pages/case-table');
const { CaseSummary } = await import('./pages/case-summary');
const { RecommendationQueue } = await import('./recommendations/recommendation-queue');
const { EvidenceDetailPage } = await import('./case/evidence/evidence-detail-page');
const { EvidenceTaskFields } = await import('./case/evidence/evidence-fields');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const USERS = list([{ id: 'u-9', name: 'Sara Karimi' }, { id: 'u-2', name: 'Reza Ahmadi' }]);

const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Realign the coupling', description: null, ownerId: 'u-9', dueDate: '2026-01-05T00:00:00Z', status: 'open', actionType: null,
  evidenceExpected: '', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null, completionVerifiedBy: null,
  verificationWindowStart: null, verificationWindowEnd: null, verificationMethod: null, verifierId: null, verificationWindowLocked: false, baseline: null, postAction: null, verificationStatus: 'not_planned', verdict: null,
  claimedAvoidedLoss: null, cancelReason: null, cancelledBy: null, cancelledAt: null, recommendationId: null, linkedTask: null, taskCompletedAt: null,
  createdAt: '2026-01-01T00:00:00Z', rowVersion: 2,
} satisfies RcaActionView;

const CASE = {
  id: 'c1', title: 'Pump trips', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null, targetCloseDate: null,
  actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
} as const;

describe('RCA U3 flows', () => {
  let routes: Record<string, unknown>;
  let urls: URL[];
  let client: QueryClient;
  const wrap = (node: ReactNode, entry = '/') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    routes = { '/users/directory': USERS, '/units': list([{ id: 'u-1', name: 'Unit 100' }]) };
    urls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      const hit = Object.entries(routes).find(([suffix]) => parsed.pathname.endsWith(suffix));
      return json(hit ? hit[1] : list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  const requestTo = (suffix: string) => urls.find((url) => url.pathname.endsWith(suffix));

  it('F-7: the Actions tab asks for my actions by due date and links each investigation', async () => {
    routes['/rca-actions'] = list([{ ...ACTION, case: { id: 'c1', title: 'Pump trips', status: 'Analysis', unitId: 'u-1' } }]);
    const onChange = vi.fn();
    wrap(<ActionQueueTab filters={DEFAULT_ACTION_FILTERS} onChange={onChange} />);
    expect(await screen.findByRole('link', { name: 'Pump trips' })).toHaveAttribute('href', '/rca/c1/actions');
    const request = requestTo('/rca-actions');
    expect(request?.searchParams.get('mine')).toBe('true');
    expect(request?.searchParams.get('sort')).toBe('dueDate');
    expect(request?.searchParams.has('overdue')).toBe(false);
    expect(screen.getByTestId('action-overdue')).toHaveTextContent('Overdue');
    await waitFor(() => expect(screen.getByText('Sara Karimi')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Mine'));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_ACTION_FILTERS, mine: false });
  });

  it('F-7: MyRcaActionsList pages overdue actions and links the full tab', async () => {
    wrap(<MyRcaActionsList overdue limit={3} />);
    await waitFor(() => expect(requestTo('/rca-actions')).toBeDefined());
    const params = requestTo('/rca-actions')?.searchParams;
    expect(params?.get('overdue')).toBe('true');
    expect(params?.get('mine')).toBe('true');
    expect(params?.get('limit')).toBe('3');
    expect(screen.getByRole('link', { name: 'All RCA actions' })).toHaveAttribute('href', '/rca?tab=actions&overdue=true');
  });

  it('Marun G2: "All RCA actions" opens the full tab with every action I own, whatever its status', async () => {
    wrap(<MyRcaActionsList />);
    await waitFor(() => expect(requestTo('/rca-actions')).toBeDefined());
    expect(requestTo('/rca-actions')?.searchParams.getAll('status')).toEqual(['open', 'in_progress']);
    expect(screen.getByRole('link', { name: 'All RCA actions' })).toHaveAttribute('href', '/rca?tab=actions&mine=true&status=all');
  });

  it('Marun G2: the owner list filters by status from the URL, stays mine and does not link to itself', async () => {
    wrap(<OwnerActionsScreen />, '/rca?tab=actions&mine=true&status=all');
    await waitFor(() => expect(requestTo('/rca-actions')).toBeDefined());
    expect(requestTo('/rca-actions')?.searchParams.get('mine')).toBe('true');
    expect(requestTo('/rca-actions')?.searchParams.has('status')).toBe(false);
    expect(screen.getByTestId('owner-action-status')).toHaveTextContent('All');
    expect(screen.queryByTestId('all-rca-actions-link')).toBeNull();
    urls = [];
    wrap(<OwnerActionsScreen />, '/rca?status=done');
    await waitFor(() => expect(requestTo('/rca-actions')).toBeDefined());
    expect(requestTo('/rca-actions')?.searchParams.getAll('status')).toEqual(['done']);
  });

  it('lists the trigger event and the action progress of each investigation', async () => {
    routes['/rcas'] = list([{ ...CASE, trigger: { eventId: 'e1', startTime: '2026-10-09T06:00:00Z', unitId: 'u-1' }, actions: { total: 5, done: 3, overdue: 1 } }]);
    wrap(<CaseTable filters={{ ...EMPTY_CASE_FILTERS, priority: 'Critical', open: 'true' }} empty={{ text: 'none' }} />);
    expect(await screen.findByTestId('case-trigger')).toHaveAttribute('href', '/events/e1');
    expect(screen.getByTestId('case-actions')).toHaveTextContent('3/5 done · 1 overdue');
    const params = requestTo('/rcas')?.searchParams;
    expect(params?.get('open')).toBe('true');
    expect(params?.get('priority')).toBe('Critical');
  });

  it('"Open critical" has no caveat tooltip any more', async () => {
    routes['/rcas/summary'] = { total: 3, open: 2, overdue: 0, critical: 1, overdueActions: 0, effectivenessPending: 0, byStatus: [], asOf: 'x' };
    wrap(<CaseSummary filters={EMPTY_CASE_FILTERS} onPick={() => undefined} />);
    expect(await screen.findByRole('button', { name: 'Open critical: 1' })).not.toHaveAttribute('title');
  });

  it('F-9: shows why, by whom and when an action was cancelled', async () => {
    wrap(<ActionCancelInfo action={{ status: 'cancelled', cancelReason: 'Replaced by the redesign', cancelledBy: 'u-9', cancelledAt: '2026-10-10T08:00:00Z' }} />);
    const info = screen.getByTestId('action-cancel-info');
    expect(info).toHaveTextContent('Reason: Replaced by the redesign');
    await waitFor(() => expect(info).toHaveTextContent('Cancelled by Sara Karimi at'));
  });

  it('F-1: the recommendation queue shows reason, asset and start of the event', async () => {
    routes['/rca-recommendations'] = list([{
      id: 'r1', eventId: 'e1', occurrenceId: null, unitId: 'u-1', trigger: 'repeat', source: { kind: 'policy', id: 'p', version: 1 }, firedOn: 'event',
      provisional: false, outcome: 'recommended', state: 'open', rcaId: null, detail: {}, firedAt: '2026-10-10T00:00:00Z', confirmedAt: null, resolvedAt: null,
      event: { reasonCodeId: 'rc', reasonName: 'Die plate blockage', assetId: 'a1', assetName: 'Extruder E-1', startTime: '2026-10-09T06:00:00Z' },
    }]);
    wrap(<RecommendationQueue />);
    expect(await screen.findByText('Die plate blockage')).toBeInTheDocument();
    expect(screen.getByText('Extruder E-1')).toBeInTheDocument();
    for (const header of ['Reason', 'Asset', 'Start']) expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
  });

  it('evidence: names the task assignee and who verified it when', async () => {
    const item = {
      id: 'ev-1', title: 'Vibration photo', description: null, type: 'Photo', source: null, collectedAt: null, collectedBy: null, category: null, location: null,
      occurredAt: null, assetId: null, severity: 'Medium', tags: [], verified: true, fiveP: 'Parts', task: 'Bring the photo', taskDueDate: null, taskStatus: 'pending',
      taskAssigneeId: 'u-2', verifiedBy: 'u-9', verifiedAt: '2026-10-02T08:00:00Z', nodeIds: [], timeSeries: null, attachments: [],
    } satisfies RcaEvidenceItem;
    const rca = { ...CASE, evidence: [item], logicTree: [], eventDiagram: { nodes: [], edges: [] } } as unknown as RcaCaseView;
    wrap(
      <CaseWorkspaceContext.Provider value={{ rca, readOnly: true, basePath: '/rca/c1' }}>
        <Routes><Route path="/rca/:caseId/evidence/:evidenceId" element={<EvidenceDetailPage />} /></Routes>
      </CaseWorkspaceContext.Provider>,
      '/rca/c1/evidence/ev-1',
    );
    await waitFor(() => expect(screen.getByTestId('evidence-verified')).toHaveTextContent(/^Verified by Sara Karimi at /));
    expect(screen.getByText('Reza Ahmadi')).toBeInTheDocument();
  });

  it('evidence: the collection task picks an assignee among the plant members', async () => {
    const onChange = vi.fn();
    wrap(<EvidenceTaskFields form={EMPTY_EVIDENCE_FORM} onChange={onChange} />);
    await screen.findByRole('option', { name: 'Reza Ahmadi' });
    fireEvent.change(screen.getByLabelText('Assigned to'), { target: { value: 'u-2' } });
    expect(onChange).toHaveBeenCalledWith({ taskAssigneeId: 'u-2' });
  });
});
