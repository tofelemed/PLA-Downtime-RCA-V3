import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const { CaseWorkspaceContext } = await import('./case/case-context');
const { ClosedCaseNotice } = await import('./case/closed-case-notice');
const { workspaceOf } = await import('./case/workspace-of');
const { ActionsTab } = await import('./actions/actions-tab');
const { DefinitionSummary } = await import('./case/overview/definition-summary');
const { useCopyCaseLink } = await import('./case/use-copy-case-link');
const { NewCasePage } = await import('./pages/new-case-page');
const { EventRcaPanel } = await import('./event-rca-panel');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Add a lube-oil check', description: null, ownerId: 'user-1', dueDate: '2026-10-19T00:00:00Z', status: 'in_progress', actionType: null,
  evidenceExpected: '', completionEvidenceRef: null, completionAttachments: [], hasEvidence: false, completedAt: null, completionVerifiedBy: null,
  verificationWindowStart: null, verificationWindowEnd: null, verificationMethod: null, verifierId: null, verificationWindowLocked: false, baseline: null, postAction: null,
  verificationStatus: 'evaluated', verdict: 'insufficient_evidence', claimedAvoidedLoss: null, cancelReason: null, cancelledBy: null, cancelledAt: null,
  recommendationId: null, linkedTask: null, taskCompletedAt: null, createdAt: '2026-10-01T00:00:00Z', rowVersion: 2,
} satisfies RcaActionView;

const CLOSED = {
  id: 'c1', title: 'Gearbox trip', status: 'Closed', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null, teamMemberIds: [], targetCloseDate: null,
  actualCloseDate: '2026-10-18T14:41:00Z', description: 'Gearbox tripped', teamCharter: null, rootCause: 'Inspection gap', recommendations: [], evidence: [], logicTree: [],
  eventDiagram: { nodes: [], edges: [] }, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z', rowVersion: 21,
} as unknown as RcaCaseView;

describe('QA audit RCA fixes: screens', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode, entry = '/rca/c1') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="*" element={node} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  const inClosedCase = (node: ReactNode) => <CaseWorkspaceContext.Provider value={workspaceOf(CLOSED, true)}>{node}</CaseWorkspaceContext.Provider>;

  beforeEach(() => {
    actAs('reliability_engineer');
    toast.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(new URL(url).pathname.endsWith('/actions') ? [ACTION] : list([]))));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('H1: a closed investigation tells its writer to reopen it and offers no edit control', async () => {
    wrap(
      inClosedCase(
        <>
          <ClosedCaseNotice />
          <DefinitionSummary />
          <ActionsTab rcaId="c1" />
        </>,
      ),
    );
    expect(screen.getByTestId('closed-case-notice')).toHaveTextContent('Closed investigation — reopen to change');
    expect(await screen.findByTestId('action-row')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-definition')).toBeNull();
    expect(screen.queryByTestId('edit-action')).toBeNull();
    expect(screen.queryByTestId('new-action-disclosure')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Status of Add a lube-oil check' })).toBeDisabled();
    // M2: the badge carries the verdict, never "Verified"
    expect(screen.getByTestId('verification-status')).toHaveTextContent('Not enough evidence yet');
  });

  it('H1: the notice is not shown to a reader, nor on an open investigation', () => {
    actAs('viewer');
    const { unmount } = wrap(<CaseWorkspaceContext.Provider value={workspaceOf(CLOSED, false)}><ClosedCaseNotice /></CaseWorkspaceContext.Provider>);
    expect(screen.queryByTestId('closed-case-notice')).toBeNull();
    unmount();
    actAs('reliability_engineer');
    wrap(<CaseWorkspaceContext.Provider value={workspaceOf({ ...CLOSED, status: 'Analysis' }, true)}><ClosedCaseNotice /></CaseWorkspaceContext.Provider>);
    expect(screen.queryByTestId('closed-case-notice')).toBeNull();
  });

  it('L15: a non-writer on /rca/new gets the "New investigation" heading and title with the refusal', async () => {
    actAs('operator');
    wrap(<NewCasePage />, '/rca/new');
    expect(screen.getByRole('heading', { level: 1, name: 'New investigation' })).toBeInTheDocument();
    expect(screen.getByText(/Only reliability engineers and manager approvers open investigations/)).toBeInTheDocument();
    expect(document.title).toContain('New investigation');
  });

  it('L12: the title is marked required and the disabled Create says why', () => {
    wrap(<NewCasePage />, '/rca/new');
    expect(screen.getByLabelText(/^Title/)).toBeRequired();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByTestId('create-case')).toBeDisabled();
    expect(screen.getByTestId('disabled-reason')).toHaveTextContent('Enter a title to create the investigation.');
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Seal leak' } });
    expect(screen.getByTestId('create-case')).toBeEnabled();
    expect(screen.queryByTestId('disabled-reason')).toBeNull();
  });

  it('L12: Cancel with typed values asks before leaving', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<NewCasePage />, '/rca/new');
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Seal leak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Seal leak');
    confirm.mockRestore();
  });

  it('L14: an event whose investigation is completed no longer offers "Create or link investigation"', () => {
    const event = { id: 'e1', rcaId: 'c1', states: { physical: 'closed', coding: 'coded', rca: 'completed' } } as unknown as ProductionEventView;
    const { unmount } = wrap(<EventRcaPanel event={event} />);
    expect(screen.queryByTestId('open-link-rca')).toBeNull();
    expect(screen.getByTestId('event-rca-case')).toHaveTextContent('Open the linked investigation');
    unmount();
    wrap(<EventRcaPanel event={{ ...event, states: { ...event.states, rca: 'required' } }} />);
    expect(screen.getByTestId('open-link-rca')).toHaveTextContent('Create or link investigation');
  });
});

describe('QA L13: Copy link', () => {
  const original = navigator.clipboard;
  afterEach(() => Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true }));

  it('awaits the clipboard and confirms with a toast', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    toast.mockReset();
    const { result } = renderHook(() => useCopyCaseLink());
    await act(() => result.current());
    expect(writeText).toHaveBeenCalledWith(window.location.href.split('?')[0]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link copied' }));
  });

  it('a refused clipboard is caught and says so (no unhandled rejection)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError'))) }, configurable: true });
    toast.mockReset();
    const { result } = renderHook(() => useCopyCaseLink());
    await act(() => result.current());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not copy the link', variant: 'destructive' }));
  });
});
