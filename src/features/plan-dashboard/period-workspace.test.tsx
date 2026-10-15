import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const query = vi.hoisted(() => ({ view: null as ReconciliationView | null, placeholder: false, error: false }));
vi.mock('@/api/v2/queries/period-overview', async (original) => ({
  ...await original<typeof import('@/api/v2/queries/period-overview')>(),
  useReconciliation: (_id: string, shown: string) => ({ data: shown === 'approved' && query.view ? { ...query.view, revision: { ...query.view.revision, id: 'approved', lifecycle: 'approved' } } : query.view, isLoading: false, isError: query.error, isPlaceholderData: query.placeholder }),
}));
vi.mock('@/api/v2/queries/production-periods', async (original) => ({
  ...await original<typeof import('@/api/v2/queries/production-periods')>(), usePeriodAccounting: () => ({ data: null }),
}));
vi.mock('./hooks/use-plan-context', () => ({ usePlanContext: () => ({ tenantId: 'tenant-a', zone: { timezone: 'UTC' }, plan: { data: { name: 'HDPE', version: { version: 2 } } }, state: 'ready', unitName: 'unit100' }) }));
vi.mock('./components/period-header', () => ({ PeriodHeader: () => <div>Period identity</div> }));
vi.mock('./components/ledger-comparison', () => ({ LedgerComparison: ({ ledger }: { ledger: string }) => <div>Ledger comparison: {ledger}</div> }));
vi.mock('./components/actuals-provenance', () => ({ ActualsProvenance: () => <div>Source provenance</div> }));
vi.mock('./adjustments/adjustments-section', () => ({ AdjustmentsSection: () => <div>Actuals adjustments</div> }));
vi.mock('./dispositions/dispositions-section', () => ({ DispositionsSection: () => <div>Product dispositions</div> }));
vi.mock('./workflow/workflow-bar', () => ({ WorkflowBar: () => <div>Approval workflow</div> }));
vi.mock('./workflow/bridge-review-panel', () => ({ BridgeReviewPanel: () => <div>Bridge review</div> }));
vi.mock('./coding/coding-gate-panel', () => ({ CodingGatePanel: () => <div>Stop coding</div> }));
vi.mock('./sla/sla-panel', () => ({ SlaPanel: () => <div>Hold and deadlines</div> }));
vi.mock('./day/day-certification-panel', () => ({ PeriodDayPanel: () => <div>Production day</div> }));
vi.mock('./restatement/restatement-panel', () => ({ RestatementPanel: () => <div>Restatement</div> }));
vi.mock('./components/waterfall-panel', () => ({ WaterfallPanel: () => <div>Loss waterfall</div> }));
vi.mock('./components/valuation-tiles', () => ({ ValuationTiles: () => <div>Valuation figures</div> }));
vi.mock('./workflow/period-history', () => ({ PeriodHistory: () => <div>Revision history, proposals and exports</div> }));

const { PeriodPage } = await import('./period-page');
const { PeriodDraftBoundary } = await import('./period-draft-boundary');
const { retainedPeriodDrafts } = await import('./model/retained-period-drafts');
const { reconciliationKey } = await import('./hooks/use-draft-editor');

const BASE = '/plans/plan1/periods/period1';
const VIEW: ReconciliationView = {
  periodId: 'period1', unitId: 'unit100', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', rowVersion: 4,
  revision: { id: 'rev1', revision: 2, lifecycle: 'draft', supersedesId: 'approved', currentRunId: 'run1', currentLineSetId: null, isStale: false, staleReason: null,
    submittedBy: null, submittedAt: null, submittedHash: null, submittedRunId: null, approvedBy: null, approvedAt: null, approvalSnapshotId: null,
    rejectedBy: null, rejectedAt: null, rejectReason: null, cancelledBy: null, cancelledAt: null, afterClose: false, comment: null },
  publishedRevision: 1, baseRunId: 'run1', contentHash: 'hash',
  tolerance: { policyId: null, version: 1, mode: 'zero', value: 0, epsilon: 0.000001, allowUnaccountedClassification: false },
  slices: [{ sliceId: 'slice1', uom: 't', target: '1000', actual: '850', gap: '150', attributed: '90', toleranceAdjustment: '0', unadjustedResidual: '60', residual: '60', overAccounted: '0', overproduction: '0', tolerance: '0', flags: ['unaccounted'] }],
  candidates: [{ lossLineId: 'line1', autoKey: 'candidate1', sliceId: 'slice1', kind: 'availability', quantity: '90', basis: 'planning_rate', reasonCodeId: null, impactCodeId: null, causeEventId: 'event1', state: 'proposed', effectiveQuantity: '90' }],
  lines: [], openProposalId: null,
};

function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><PeriodDraftBoundary /><output data-testid="location">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Browser Back</button><button onClick={() => navigate(1)}>Browser Forward</button><Link to="/outside">Leave period</Link>
    <Routes><Route path="/plans/:planId/periods/:periodId/*" element={<PeriodPage />} />
      <Route path="/plans/:planId/periods/:periodId/adjustments/new" element={<div>Original adjustment form</div>} />
      <Route path="/outside" element={<Link to={BASE}>Return to period</Link>} /></Routes></>;
}

describe('period workspace navigation and retained editing', () => {
  let client: QueryClient;
  let writes: { headers: Headers; body: Record<string, unknown> }[];
  const open = (path = BASE) => render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter></QueryClientProvider>);
  const nav = (name: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Period sections' })).getByRole('link', { name }));
  const decide = () => fireEvent.change(screen.getByTestId('candidate-decision'), { target: { value: 'accept' } });
  const unload = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
  beforeEach(() => {
    query.view = structuredClone(VIEW); query.placeholder = false; query.error = false;
    retainedPeriodDrafts.setOwner(null); writes = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    actAs('production_accountant', 'accountant');
    configureV2Session({ getAccessToken: () => 'token', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'PUT') { writes.push({ headers: new Headers(init.headers), body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ code: 'RUN_CHANGED', message: 'Inputs changed', correlationId: 'test', retryable: false }), { status: 409, headers: { 'Content-Type': 'application/json' } }); }
      return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); retainedPeriodDrafts.setOwner(null); client.clear(); });

  it('loads a child bookmark with both selectors and preserves query context across Back / Forward', async () => {
    open(`${BASE}/history?view=approved&ledger=capacity&keep=scope`);
    await screen.findByText('Revision history, proposals and exports');
    expect(screen.getByTestId('view-approved')).toHaveAttribute('data-state', 'on');
    expect(screen.getByTestId('ledger-capacity')).toHaveAttribute('data-state', 'on');
    nav('Value');
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/value?view=approved&ledger=capacity&keep=scope`);
    expect(screen.getByText('Valuation figures')).toBeVisible();
    fireEvent.click(screen.getByText('Browser Back'));
    await screen.findByText('Revision history, proposals and exports');
    fireEvent.click(screen.getByText('Browser Forward'));
    expect(screen.getByText('Valuation figures')).toBeVisible();
    expect(screen.queryByTestId('save-lines')).not.toBeInTheDocument();
  });

  it('retains all groups in their task sections while hiding secondary reads from reconciliation', async () => {
    open();
    expect(screen.getByTestId('reconciliation-summary')).toBeVisible();
    expect(screen.queryByText('Actuals adjustments')).not.toBeInTheDocument();
    nav('Actuals & quality');
    for (const text of ['Source provenance', 'Actuals adjustments', 'Product dispositions']) expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByTestId('loss-line-editor')).not.toBeVisible();
    nav('Review & close');
    for (const text of ['Approval workflow', 'Bridge review', 'Stop coding', 'Hold and deadlines', 'Restatement', 'Production day']) expect(screen.getByText(text)).toBeVisible();
    nav('History & exports');
    await screen.findByText('Revision history, proposals and exports');
    nav('Reconciliation');
    await screen.findByText('Loss waterfall');
  });

  it('keeps an unsaved decision and unfinished manual form across section changes', () => {
    open(); decide();
    fireEvent.click(screen.getByTestId('add-manual-line'));
    fireEvent.change(screen.getByLabelText('Quantity (t)'), { target: { value: '12.5' } });
    nav('Actuals & quality');
    expect(screen.getByText(/Unsaved loss-line changes\./)).toBeVisible();
    nav('Reconciliation');
    expect(screen.getByTestId('candidate-decision')).toHaveValue('accept');
    expect(screen.getByLabelText('Quantity (t)')).toHaveValue('12.5');
    expect(screen.getByTestId('save-lines')).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('keeps a rejected save and conflict review through section navigation', async () => {
    open(); decide(); fireEvent.click(screen.getByTestId('save-lines'));
    await screen.findByTestId('conflict-dialog');
    fireEvent.click(within(screen.getByTestId('conflict-dialog')).getAllByRole('button', { name: 'Close' })[0]);
    nav('Actuals & quality'); nav('Reconciliation');
    expect(screen.getByTestId('candidate-decision')).toHaveValue('accept');
    expect(screen.getByTestId('loss-line-editor')).toHaveAttribute('data-dirty', 'true');
    expect(writes[0].headers.get('If-Match')).toBe('"4"');
    expect(writes[0].body.baseRunId).toBe('run1');
  });

  it('retains edits on leaving, warns on reload outside the period, and clears on explicit discard', () => {
    open(); decide(); fireEvent.click(screen.getByText('Leave period'));
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByText('Return to period'));
    expect(screen.getByText('Restore loss-line draft')).toBeVisible();
    expect(screen.queryByTestId('save-lines')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Restore loss-line draft'));
    expect(screen.getByTestId('candidate-decision')).toHaveValue('accept');
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(unload()).toBe(false);
  });

  it('restores unfinished manual input after leaving the period without sending incomplete lines', () => {
    open(); fireEvent.click(screen.getByTestId('add-manual-line'));
    fireEvent.change(screen.getByLabelText('Quantity (t)'), { target: { value: '12.5' } });
    fireEvent.click(screen.getByText('Leave period'));
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByText('Return to period'));
    fireEvent.click(screen.getByText('Restore loss-line draft'));
    expect(screen.getByLabelText('Quantity (t)')).toHaveValue('12.5');
    expect(screen.getByTestId('save-lines')).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('clears retained edits after a successful atomic save', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => new Response(JSON.stringify(init.method === 'PUT' ? { ...VIEW, rowVersion: 5 } : { items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    open(); decide(); expect(unload()).toBe(true);
    fireEvent.click(screen.getByTestId('save-lines'));
    await waitFor(() => expect(screen.getByTestId('loss-line-editor')).toHaveAttribute('data-dirty', 'false'));
    expect(unload()).toBe(false);
    fireEvent.click(screen.getByText('Leave period')); fireEvent.click(screen.getByText('Return to period'));
    expect(screen.queryByText('Restore loss-line draft')).not.toBeInTheDocument();
  });

  it('restores original concurrency metadata and explicitly rebases even when the latest view is already loaded', async () => {
    open(); decide(); fireEvent.click(screen.getByText('Leave period'));
    query.view = { ...VIEW, rowVersion: 9, baseRunId: 'run2', candidates: [] };
    client.setQueryData(reconciliationKey('tenant-a', VIEW.periodId), query.view);
    fireEvent.click(screen.getByText('Return to period'));
    expect(screen.getByText(/Saved figures changed since that draft/)).toBeVisible();
    fireEvent.click(screen.getByText('Restore loss-line draft'));
    fireEvent.click(screen.getByTestId('save-lines'));
    await screen.findByTestId('conflict-dialog');
    expect(writes[0].headers.get('If-Match')).toBe('"4"');
    expect(writes[0].body.baseRunId).toBe('run1');
    fireEvent.click(screen.getByTestId('rebase'));
    await waitFor(() => expect(screen.getByTestId('rebase-dropped')).toHaveTextContent('1 decision(s) dropped'));
    fireEvent.click(screen.getByTestId('save-lines'));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1].headers.get('If-Match')).toBe('"9"');
    expect(writes[1].body.baseRunId).toBe('run2');
    expect(writes[0].body.lines).toEqual([{ action: 'accept', autoKey: 'candidate1' }]);
    expect(writes[1].body.lines).toEqual([]);
  });

  it('clears pending edits when authority changes and keeps viewers read-only', () => {
    const app = open(); decide();
    actAs('viewer', 'accountant');
    app.rerender(<QueryClientProvider client={client}><MemoryRouter><Harness /></MemoryRouter></QueryClientProvider>);
    expect(unload()).toBe(false);
    expect(screen.queryByTestId('save-lines')).not.toBeInTheDocument();
    expect(screen.queryByText('Restore loss-line draft')).not.toBeInTheDocument();
  });

  it('keeps the original specific form route ahead of the wildcard and corrects unknown sections', () => {
    const app = open(`${BASE}/adjustments/new`);
    expect(screen.getByText('Original adjustment form')).toBeVisible(); app.unmount();
    open(`${BASE}/wrong?keep=scope`);
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}?keep=scope`);
    expect(screen.getByTestId('period-section-heading')).toHaveTextContent('Reconciliation');
  });

  it('never renders draft controls from placeholder data during an approved-view fetch', () => {
    query.placeholder = true; open(`${BASE}?view=approved`);
    expect(screen.queryByTestId('save-lines')).not.toBeInTheDocument();
    expect(screen.queryByTestId('period-section-heading')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Period sections' })).toBeVisible();
  });
});
