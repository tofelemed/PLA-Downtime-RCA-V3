import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const query = vi.hoisted(() => ({ rca: null as RcaCaseView | null, actions: [] as RcaActionView[] }));
vi.mock('@/api/v2/queries/rca-cases', async original => ({
  ...await original<typeof import('@/api/v2/queries/rca-cases')>(),
  useRcaCase: () => ({ data: query.rca, isLoading: false, isError: false }),
  useRcaActions: () => ({ data: query.actions, isLoading: false, isError: false }),
}));

const { CaseWorkspacePage } = await import('./case/case-workspace-page');
const { RcaDraftBoundary } = await import('./rca-draft-boundary');
const { retainedDefinitionDrafts } = await import('./case/definition/retained-definition-drafts');
const CASE: RcaCaseView = {
  id: 'c1', title: 'Extruder vibration', status: 'Draft', priority: 'High', unitId: 'u1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Vibration after a coupling change', teamMemberIds: [], rootCause: 'Alignment', templateId: null, teamCharter: 'Eliminate repeat trips',
  recommendations: [], evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] }, createdBy: 'author', consequenceClass: 'minor',
  residualRisk: null, closureRequestedBy: null, closureRequestedAt: null, closureApprovedBy: null, closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
};
const ACTION: RcaActionView = {
  id: 'a1', rcaId: 'c1', title: 'Align the coupling', description: null, ownerId: 'owner', dueDate: '2026-10-20T00:00:00Z', status: 'open',
  actionType: null, evidenceExpected: 'Alignment report', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false,
  completedAt: null, completionVerifiedBy: null, verificationWindowStart: null, verificationWindowEnd: null, verificationMethod: null, verifierId: null, verificationWindowLocked: false, baseline: null, postAction: null,
  verificationStatus: 'due', verdict: null, claimedAvoidedLoss: null, cancelReason: null, cancelledBy: null, cancelledAt: null,
  recommendationId: null, linkedTask: null, taskCompletedAt: null,
  createdAt: '2026-10-01T00:00:00Z', rowVersion: 2,
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const BASE = '/rca/c1';
function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><RcaDraftBoundary /><output data-testid="location">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Browser Back</button><button onClick={() => navigate(1)}>Browser Forward</button>
    <Link to="/outside">Leave case</Link>
    <Routes><Route path="/rca/:caseId/*" element={<CaseWorkspacePage />} /><Route path="/outside" element={<Link to={`${BASE}/definition`}>Return to definition</Link>} /></Routes>
  </>;
}
const unload = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
const nav = (name: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Investigation sections' })).getByRole('link', { name }));

describe('RCA detail workspace and definition draft safety', () => {
  let client: QueryClient;
  let writes: { headers: Headers; body: Record<string, unknown>; path: string }[];
  let rejectSave: boolean;
  const app = (path: string) => <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter></QueryClientProvider>;
  beforeEach(() => {
    query.rca = structuredClone(CASE); query.actions = [structuredClone(ACTION)]; writes = []; rejectSave = false;
    actAs('SuperAdmin', 'writer'); retainedDefinitionDrafts.setOwner(null);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'token', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      const path = new URL(input).pathname;
      if (init.method === 'PATCH' || init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        writes.push({ headers: new Headers(init.headers), body, path });
        if (rejectSave) return json(412, { code: 'VERSION_CONFLICT', message: 'The record changed.', correlationId: 'test', retryable: false });
        if (path.endsWith('/rcas/c1')) { query.rca = { ...query.rca!, ...body, rowVersion: query.rca!.rowVersion + 1 }; return json(200, query.rca); }
        return json(200, { ...ACTION, ...body, rowVersion: 3 });
      }
      if (path.endsWith('/readiness')) return json(200, { rcaId: 'c1', status: 'Draft', next: [], investigation: { blockers: [], advice: [] }, closure: { blockers: [], effectiveness: null }, approver: { canApprove: false, reason: null }, linkedRecurrences: 0, rules: { fiveWhyGuidelineLevels: 5, consequenceClass: 'minor' } });
      if (path.endsWith('/links')) return json(200, []);
      if (path.endsWith('/analyses')) return json(200, { fiveWhy: null, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null });
      return json(200, { items: [], nextCursor: null });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); retainedDefinitionDrafts.setOwner(null); client.clear(); });

  it('shows saved facts on Overview and preserves query, focusable routes and Back/Forward through definition', async () => {
    render(app(`${BASE}/?origin=queue`));
    expect(screen.queryByTestId('case-editor')).toBeNull();
    expect(screen.getByText(CASE.description!)).toBeVisible();
    expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByRole('navigation', { name: 'Investigation sections' })).getAllByRole('link')).toHaveLength(6);
    fireEvent.click(screen.getByTestId('edit-definition'));
    await screen.findByTestId('case-editor');
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/definition?origin=queue`);
    expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-current', 'page');
    nav('Evidence');
    await screen.findByTestId('evidence-list');
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/evidence?origin=queue`);
    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }));
    await screen.findByTestId('case-editor');
    fireEvent.click(screen.getByRole('link', { name: 'Back to overview' }));
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}?origin=queue`);
  });

  it('offers explicit restoration after section navigation and SPA leave, with reload warning outside the case', async () => {
    render(app(`${BASE}/definition`));
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Unfinished alignment review' } });
    fireEvent.change(screen.getByLabelText('Team charter'), { target: { value: 'Retained charter' } });
    expect(unload()).toBe(true);
    nav('Overview');
    fireEvent.click(await screen.findByTestId('edit-definition'));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore definition draft' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Unfinished alignment review');
    expect(screen.getByLabelText('Team charter')).toHaveValue('Retained charter');
    fireEvent.click(screen.getByRole('link', { name: 'Leave case' }));
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Return to definition' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore definition draft' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Unfinished alignment review');
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByLabelText('Title')).toHaveValue(CASE.title);
    expect(unload()).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('preserves original If-Match after server changes, keeps a refused draft, and explicitly discards to latest', async () => {
    render(app(`${BASE}/definition`));
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'My unsaved title' } });
    fireEvent.click(screen.getByRole('link', { name: 'Leave case' }));
    query.rca = { ...CASE, rowVersion: 9, title: 'New server title', status: 'Monitoring' };
    fireEvent.click(screen.getByRole('link', { name: 'Return to definition' }));
    await screen.findByText(/investigation or plant timezone changed/i);
    fireEvent.click(screen.getByRole('button', { name: 'Restore definition draft' }));
    expect(screen.getByLabelText('Team lead')).toBeDisabled();
    rejectSave = true;
    fireEvent.click(screen.getByTestId('save-case'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].headers.get('If-Match')).toBe('"4"');
    expect(writes[0].body.title).toBe('My unsaved title');
    expect(writes[0].body).not.toHaveProperty('status');
    await waitFor(() => expect(screen.getByTestId('save-case')).not.toBeDisabled());
    expect(screen.getByLabelText('Title')).toHaveValue('My unsaved title');
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByLabelText('Title')).toHaveValue('New server title');
    expect(unload()).toBe(false);
    rejectSave = false;
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Latest-version edit' } });
    fireEvent.click(screen.getByTestId('save-case'));
    await screen.findByText('Saved.');
    expect(writes[1].headers.get('If-Match')).toBe('"9"');
    expect(unload()).toBe(false);
  });

  it.each(['viewer', 'SuperAdmin'])('clears retained definition and rendered state after authority/identity changes: %s', async role => {
    const view = render(app(`${BASE}/definition`));
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Private draft' } });
    expect(unload()).toBe(true);
    actAs(role, 'another-user'); view.rerender(app(`${BASE}/definition`));
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(CASE.title));
    expect(screen.queryByRole('button', { name: 'Restore definition draft' })).toBeNull();
    expect(unload()).toBe(false);
    if (role === 'viewer') { expect(screen.getByLabelText('Title')).toBeDisabled(); expect(screen.queryByTestId('save-case')).toBeNull(); }
  });

  it('keeps action summaries visible and unfinished evidence/new-action inputs mounted when disclosures close', async () => {
    render(app(`${BASE}/actions`));
    const row = await screen.findByTestId('action-row');
    expect(within(row).getByText(ACTION.title)).toBeVisible();
    expect(within(row).getByLabelText(`Status of ${ACTION.title}`)).toBeVisible();
    expect(within(row).getByTestId('verify-action')).toBeVisible();
    const detail = within(row).getByTestId('action-details');
    expect(detail).not.toHaveAttribute('open');
    fireEvent.click(within(detail).getByText('Evidence & effectiveness'));
    const evidence = within(detail).getByLabelText('Evidence reference');
    fireEvent.change(evidence, { target: { value: 'WO-HDPE-42' } });
    fireEvent.click(within(detail).getByText('Evidence & effectiveness'));
    fireEvent.click(within(detail).getByText('Evidence & effectiveness'));
    expect(within(detail).getByLabelText('Evidence reference')).toHaveValue('WO-HDPE-42');
    const add = screen.getByTestId('new-action-disclosure');
    fireEvent.click(within(add).getByText('Add action', { selector: 'summary' }));
    fireEvent.change(within(add).getByLabelText('Action'), { target: { value: 'Check alignment again' } });
    fireEvent.click(within(add).getByText('Add action', { selector: 'summary' }));
    fireEvent.click(within(add).getByText('Add action', { selector: 'summary' }));
    expect(within(add).getByLabelText('Action')).toHaveValue('Check alignment again');
    expect(writes).toHaveLength(0);
  });

  it('keeps action write controls hidden for viewers while summary and disclosure remain readable', async () => {
    actAs('viewer'); render(app(`${BASE}/actions`));
    const row = await screen.findByTestId('action-row');
    expect(within(row).getByLabelText(`Status of ${ACTION.title}`)).toBeDisabled();
    expect(screen.queryByTestId('new-action-disclosure')).toBeNull();
    fireEvent.click(within(row).getByText('Evidence & effectiveness'));
    expect(screen.queryByTestId('save-evidence')).toBeNull();
    expect(screen.queryByTestId('verify-action')).toBeNull();
    expect(screen.getByTestId('evidence-expected')).toHaveTextContent('Alignment report');
  });
});
