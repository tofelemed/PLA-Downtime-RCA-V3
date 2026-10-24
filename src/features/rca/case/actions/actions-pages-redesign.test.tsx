import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView, RcaRecommendationItem } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const query = vi.hoisted(() => ({ rca: null as RcaCaseView | null, actions: [] as RcaActionView[] }));
vi.mock('@/api/v2/queries/rca-cases', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/rca-cases')>()),
  useRcaCase: () => ({ data: query.rca, isLoading: false, isError: false }),
  useRcaActions: () => ({ data: query.actions, isLoading: false, isError: false }),
}));

const { CaseWorkspacePage } = await import('../case-workspace-page');

const REC: RcaRecommendationItem = { id: 'rec-1', title: 'Realign the coupling', description: null, priority: 'High', ownerId: null, dueDate: null, status: 'Completed', estimatedCost: null, actions: [] };
const REC2: RcaRecommendationItem = { ...REC, id: 'rec-2', title: 'Train the fitters', priority: 'Low', status: 'Open' };
const CASE = {
  id: 'c1', title: 'Extruder vibration', status: 'Draft', priority: 'High', unitId: 'u1', assetId: null, teamLeadId: null, targetCloseDate: null,
  actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4, description: null, teamMemberIds: [],
  rootCause: null, templateId: null, teamCharter: null, recommendations: [REC, REC2], evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
  createdBy: 'author', consequenceClass: 'minor', residualRisk: null, closureRequestedBy: null, closureRequestedAt: null, closureApprovedBy: null,
  closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
} as unknown as RcaCaseView;
const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Align the coupling', description: null, ownerId: null, dueDate: null, status: 'open', actionType: null,
  evidenceExpected: 'Alignment report', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null,
  completionVerifiedBy: null, verificationWindowStart: null, verificationWindowEnd: null, verificationMethod: 'Laser check', verifierId: null,
  verificationWindowLocked: false, baseline: null, postAction: null, verificationStatus: 'not_planned', verdict: null, claimedAvoidedLoss: null,
  cancelReason: null, cancelledBy: null, cancelledAt: null, recommendationId: null, linkedTask: null, taskCompletedAt: null,
  createdAt: '2026-10-01T00:00:00Z', rowVersion: 2,
} as unknown as RcaActionView;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

let client: QueryClient;
let writes: { method: string; path: string }[];
const app = (path: string) => (
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route path="/rca/:caseId/*" element={<CaseWorkspacePage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  query.rca = structuredClone(CASE);
  query.actions = [structuredClone(ACTION)];
  writes = [];
  actAs('SuperAdmin', 'writer');
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  configureV2Session({ getAccessToken: () => 'token', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
    const path = new URL(input).pathname;
    if (init.method === 'PATCH' || init.method === 'POST') {
      writes.push({ method: init.method, path });
      if (path.endsWith('/rcas/c1')) {
        query.rca = { ...query.rca!, ...JSON.parse(String(init.body)), rowVersion: query.rca!.rowVersion + 1 };
        return json(200, query.rca);
      }
      return json(200, { ...ACTION, rowVersion: 3 });
    }
    if (path.endsWith('/readiness')) return json(200, { rcaId: 'c1', status: 'Draft', next: [], investigation: { blockers: [], advice: [] }, closure: { blockers: [], effectiveness: null }, approver: { canApprove: false, reason: null }, linkedRecurrences: 0, rules: { fiveWhyGuidelineLevels: 5, consequenceClass: 'minor' } });
    if (path.endsWith('/links')) return json(200, []);
    return json(200, { items: [], nextCursor: null });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.clear();
});

describe('recommendations (RCA detail redesign)', () => {
  it('sits in a card with its count and a filter row of labelled h-9 controls', async () => {
    render(app('/rca/c1/actions'));
    const card = await screen.findByTestId('recommendations-card');
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
    expect(within(card).getByRole('heading', { level: 2, name: 'Recommendations' })).toBeInTheDocument();
    expect(within(card).getByTestId('card-count')).toHaveTextContent('2 · 1 closed');
    expect(within(card).getByLabelText('Search recommendations')).toHaveClass('h-9');
    expect(within(card).getByLabelText('Status')).toHaveClass('h-9');
    expect(within(card).getByLabelText('Priority')).toHaveClass('h-9');
    expect(within(card).getByTestId('rec')).toHaveTextContent('Realign the coupling');
  });

  it('keeps its own empty messages: add when there is none, clear filters when none matches', async () => {
    render(app('/rca/c1/actions'));
    fireEvent.change(await screen.findByLabelText('Search recommendations'), { target: { value: 'zzz' } });
    const empty = await within(screen.getByTestId('recommendations-card')).findByTestId('own-empty');
    expect(empty).toHaveTextContent('None matches the filters.');
    fireEvent.click(within(empty).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(screen.getByTestId('rec')).toHaveTextContent('Train the fitters'));
  });

  it('with no recommendation, the empty message offers to add one', async () => {
    query.rca = { ...structuredClone(CASE), recommendations: [] };
    render(app('/rca/c1/actions'));
    const empty = await within(await screen.findByTestId('recommendations-card')).findByTestId('own-empty');
    expect(empty).toHaveTextContent('No recommendation yet.');
    expect(within(empty).getByRole('link', { name: /Add recommendation/ })).toHaveAttribute('href', '/rca/c1/actions/recommendations/new');
  });
});

describe('recommendation form (RCA detail redesign)', () => {
  it('shows the cost message under its field and a footer with Delete left, Cancel then Save right', async () => {
    render(app('/rca/c1/actions/recommendations/rec-1/edit'));
    const cost = await screen.findByLabelText('Estimated cost');
    expect(cost).toHaveClass('h-9');
    fireEvent.change(cost, { target: { value: 'lots' } });
    expect(screen.getByTestId('field-error-rec-cost')).toHaveTextContent('Enter the estimated cost as a number, e.g. 1250.50.');
    expect(cost).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('save-recommendation')).toBeDisabled();
    const footer = screen.getByTestId('form-footer');
    expect(within(footer).getAllByRole('button').map((button) => button.textContent)).toEqual(['Delete', 'Cancel', 'Save recommendation']);
  });

  it('delete confirm: title, buttons, Esc closes without deleting', async () => {
    render(app('/rca/c1/actions/recommendations/rec-1/edit'));
    fireEvent.click(within(await screen.findByTestId('form-footer')).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Delete this recommendation?' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete recommendation']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(writes).toHaveLength(0);
  });
});

describe('actions (RCA detail redesign)', () => {
  it('sits in a card with its count; each action shows its facts as a definition list', async () => {
    render(app('/rca/c1/actions'));
    const card = await screen.findByTestId('actions-card');
    expect(within(card).getByRole('heading', { level: 2, name: 'Actions' })).toBeInTheDocument();
    expect(within(card).getByTestId('card-count')).toHaveTextContent('1');
    const meta = within(card).getByTestId('action-meta');
    expect(meta.tagName).toBe('DL');
    expect(within(meta).getByText('Verification method').tagName).toBe('DT');
    expect(within(meta).getByText('Laser check').tagName).toBe('DD');
    expect(within(card).getByLabelText('Status of Align the coupling')).toHaveClass('h-9');
  });

  it('new action form: the baseline note is behind an ⓘ, not a paragraph', async () => {
    render(app('/rca/c1/actions'));
    const form = await screen.findByTestId('action-form');
    expect(within(form).queryByText(/The baseline is counted by the server/)).toBeNull();
    expect(within(form).getByRole('button', { name: 'About Baseline metric' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Action')).toHaveClass('h-9');
    expect(within(form).getByLabelText('Type of action')).toHaveClass('h-9');
  });

  it('edit action form: Cancel left of Save changes', async () => {
    render(app('/rca/c1/actions'));
    fireEvent.click(await screen.findByTestId('edit-action'));
    const form = screen.getByTestId('action-edit-form');
    const footer = within(form).getByTestId('form-footer');
    expect(within(footer).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Save changes']);
  });

  it('cancel dialog: title, labelled reason focused, Keep then Cancel action, Esc closes without a PATCH', async () => {
    render(app('/rca/c1/actions'));
    fireEvent.change(await screen.findByLabelText('Status of Align the coupling'), { target: { value: 'cancelled' } });
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Cancel "Align the coupling"?' })).toBeInTheDocument();
    const reason = within(dialog).getByLabelText(/Reason for cancelling/);
    expect(reason).toHaveAttribute('rows', '3');
    await waitFor(() => expect(reason).toHaveFocus());
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Keep action', 'Cancel action']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(writes).toHaveLength(0);
  });
});
