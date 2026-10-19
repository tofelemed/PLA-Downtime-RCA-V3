import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';
import { actionAccessOf, statusChoices } from './model/action-access';
import { buildActionBody, buildOwnerEvidencePatch, EMPTY_ACTION_FORM, verifierIsOwner } from './model/action-form';
import { buildActionEditPatch } from './model/action-edit';
import { caseJson, recommendationsCsv } from './model/case-export';
import { ACTION_STATUSES } from './model/action-queue-filters';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ActionRow } = await import('./actions/action-row');
const { ActionEditForm } = await import('./actions/action-edit-form');
const { RcaListPage } = await import('./pages/rca-list-page');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-18T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Repair the gearbox', description: null, ownerId: 'omid', dueDate: '2026-10-19T00:00:00Z', status: 'open', actionType: 'repair',
  evidenceExpected: 'work-order operation and acceptance test', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null,
  completionVerifiedBy: null, verificationWindowStart: null, verificationWindowEnd: null, verificationMethod: 'Acceptance test', verifierId: 'farid',
  verificationWindowLocked: false, baseline: null, postAction: null, verificationStatus: 'not_planned', verdict: null, claimedAvoidedLoss: null, cancelReason: null,
  cancelledBy: null, cancelledAt: null, recommendationId: null, linkedTask: null, taskCompletedAt: null, createdAt: '2026-10-18T00:00:00Z', rowVersion: 3,
} satisfies RcaActionView;

const NAMES = { user: (id: string | null) => (id ? `name:${id}` : ''), asset: () => '', unit: () => 'Extruder 1' };

describe('Marun E2E RCA fixes: models', () => {
  it('an owner who is not an RCA writer works the action (open / in progress, evidence), never plans it', () => {
    const owner = actionAccessOf(ACTION, { canWriteRca: false, userId: 'omid' });
    expect(owner).toEqual({ canPlan: false, canWork: true, ownerOnly: true });
    expect(statusChoices(ACTION_STATUSES, owner, 'open')).toEqual(['open', 'in_progress']);
    expect(actionAccessOf({ ...ACTION, status: 'done' }, { canWriteRca: false, userId: 'omid' }).canWork).toBe(false);
    expect(actionAccessOf(ACTION, { canWriteRca: false, userId: 'someone' }).canWork).toBe(false);
    expect(actionAccessOf(ACTION, { canWriteRca: true, userId: 'farid' })).toEqual({ canPlan: true, canWork: true, ownerOnly: false });
    expect(buildOwnerEvidencePatch({ actionType: 'repair', evidenceRef: ' WO-1 ', completedAt: '2026-10-18', attachments: [] })).toEqual({
      completionEvidenceRef: 'WO-1',
      completionAttachments: [],
    });
  });

  it('verification method and verifier are sent, and a verifier who is the owner is caught before saving', () => {
    const form = { ...EMPTY_ACTION_FORM, title: 'x', ownerId: 'omid', verifierId: 'farid', verificationMethod: ' Test run ' };
    expect(buildActionBody(form, 'Asia/Tehran')).toMatchObject({ verifierId: 'farid', verificationMethod: 'Test run' });
    expect(verifierIsOwner({ ownerId: 'omid', verifierId: 'omid' })).toBe(true);
    expect(verifierIsOwner({ ownerId: 'omid', verifierId: '' })).toBe(false);
    const edit = buildActionEditPatch(
      { title: ACTION.title, ownerId: 'omid', dueDate: '2026-10-19', windowStart: '', windowEnd: '', recommendationId: '', verificationMethod: 'Acceptance test', verifierId: '' },
      ACTION,
      'Asia/Tehran',
    );
    expect(edit).toEqual({ verifierId: null });
  });

  it('exports: the JSON carries actions, causes, links, closure and outcome; recommendation due days in plant time', () => {
    const rca = {
      id: 'c1', title: 'Gearbox trip', status: 'Closed', priority: 'High', unitId: 'u1', teamLeadId: null, teamMemberIds: [], targetCloseDate: null,
      actualCloseDate: null, description: null, teamCharter: null, rootCause: 'Inspection gap', evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
      recommendations: [{ id: 'r1', title: 'Revise inspection', description: null, priority: 'High', ownerId: 'leila', dueDate: '2026-10-18T20:30:00.000Z', status: 'Completed', estimatedCost: null }],
      residualRisk: 'Low', closureApprovedBy: 'maryam', closureApprovedAt: '2026-10-18T18:11:00Z', effectivenessVerdict: 'insufficient_evidence',
      consequenceClass: 'significant', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
    } as unknown as RcaCaseView;
    const document = JSON.parse(
      caseJson(rca, NAMES, {
        actions: [ACTION],
        causes: [{ id: 'k1', rcaId: 'c1', kind: 'root', causeCodeId: 'x', causeCode: { code: 'ME-INSPECTION-GAP', name: 'Gap', active: true }, statement: 'Gap', evidenceIds: [], nodeIds: [], createdBy: null, createdAt: '', updatedAt: '', rowVersion: 1 }],
        links: [{ id: 'l1', rcaId: 'c1', linkType: 'event', targetId: 'e1', targetRevision: 1, unitId: 'u1', source: 'manual', linkedBy: 'farid', linkedAt: '2026-10-18T00:00:00Z', reason: null, evidence: null }],
        outcome: null,
        analyses: null,
        history: [],
      }, 'Asia/Tehran'),
    ) as Record<string, unknown>;
    expect(document).toMatchObject({
      plantTimeZone: 'Asia/Tehran',
      actions: [{ title: 'Repair the gearbox', verifier: 'name:farid', verificationMethod: 'Acceptance test' }],
      causes: [{ kind: 'root', rootCause: true, code: 'ME-INSPECTION-GAP' }],
      links: [{ type: 'event', targetId: 'e1', linkedBy: 'name:farid' }],
      closure: { residualRisk: 'Low', approvedBy: 'name:maryam', effectivenessVerdict: 'insufficient_evidence' },
    });
    const csv = recommendationsCsv(rca, NAMES, { timeZone: 'Asia/Tehran', money: true }).split('\n');
    expect(csv[0]).toContain('"Due date (Asia/Tehran)","Due (UTC)"');
    expect(csv[1]).toContain('"2026-10-19","2026-10-18T20:30:00.000Z"');
  });
});

describe('Marun E2E RCA fixes: screens', () => {
  let client: QueryClient;
  let routes: Record<string, unknown>;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    routes = { '/users/directory': list([{ id: 'omid', name: 'Omid' }, { id: 'farid', name: 'Farid' }]) };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const hit = Object.entries(routes).find(([suffix]) => parsed.pathname.endsWith(suffix));
      return json(hit ? hit[1] : list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('the owner (an operator) gets the progress statuses and the evidence fields, not the type, date or "Mark done"', async () => {
    actAs('operator', 'omid');
    wrap(<ActionRow action={ACTION} />);
    const status = screen.getByLabelText('Status of Repair the gearbox');
    expect(status).not.toBeDisabled();
    expect([...status.querySelectorAll('option')].map((o) => o.value)).toEqual(['open', 'in_progress']);
    expect(screen.getByLabelText('Evidence reference')).toBeInTheDocument();
    expect(screen.queryByLabelText('Type of action')).toBeNull();
    expect(screen.queryByTestId('mark-done')).toBeNull();
    expect(screen.queryByTestId('edit-action')).toBeNull();
    expect(await screen.findByTestId('action-meta')).toHaveTextContent('verified by: Acceptance test');
  });

  it('another operator sees the action read-only', () => {
    actAs('operator', 'someone-else');
    wrap(<ActionRow action={ACTION} />);
    expect(screen.getByLabelText('Status of Repair the gearbox')).toBeDisabled();
    expect(screen.queryByLabelText('Evidence reference')).toBeNull();
  });

  it('a writer other than the named verifier cannot mark it done; the window is read-only once done', () => {
    actAs('reliability_engineer', 'leila');
    wrap(<ActionRow action={ACTION} />);
    expect(screen.queryByTestId('mark-done')).toBeNull();
    expect(screen.getByText(/is the named verifier of this action/)).toBeInTheDocument();
    wrap(<ActionEditForm action={{ ...ACTION, status: 'done', verificationWindowLocked: true }} onDone={() => undefined} />);
    expect(screen.getByTestId('window-locked')).toHaveTextContent('fixed once the action is done');
    expect(screen.getByLabelText('Verify until')).toBeDisabled();
  });

  it('/rca for an operator lists their RCA actions instead of refusing the page', async () => {
    actAs('operator', 'omid');
    routes['/rca-actions'] = list([{ ...ACTION, case: { id: 'c1', title: 'Gearbox trip', status: 'Monitoring', unitId: 'u1' } }]);
    wrap(<RcaListPage />);
    expect(await screen.findByTestId('rca-owner-actions')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Gearbox trip' })).toHaveAttribute('href', '/rca/c1/actions');
    expect(screen.queryByTestId('new-case')).toBeNull();
  });
});
