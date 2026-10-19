import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { LossLineEditor } = await import('./editor/loss-line-editor');
const { WorkflowBar } = await import('./workflow/workflow-bar');
const { ReconciliationSummary } = await import('./components/reconciliation-summary');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refusal = (code: string, details?: Record<string, unknown>) => ({ code, message: code, correlationId: 'corr-1', retryable: false, ...(details ? { details } : {}) });

const VIEW: ReconciliationView = {
  periodId: 'p1', unitId: 'unit-1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', rowVersion: 4,
  revision: {
    id: 'rev-1', revision: 1, lifecycle: 'draft', supersedesId: null, currentRunId: 'run-1', currentLineSetId: null, isStale: false, staleReason: null,
    submittedBy: null, submittedAt: null, submittedHash: null, submittedRunId: null, approvedBy: null, approvedAt: null, approvalSnapshotId: null,
    rejectedBy: null, rejectedAt: null, rejectReason: null, cancelledBy: null, cancelledAt: null, afterClose: false, comment: null,
  },
  publishedRevision: null, baseRunId: 'run-1', contentHash: 'a'.repeat(64),
  tolerance: { policyId: null, version: 1, mode: 'zero', value: 0, epsilon: 0.000001, allowUnaccountedClassification: false },
  slices: [{ sliceId: 's1', uom: 't', target: '1000', actual: '850', gap: '150', attributed: '90', toleranceAdjustment: '0', unadjustedResidual: '60', residual: '60', overAccounted: '0', overproduction: '0', tolerance: '0', flags: ['unaccounted'] }],
  candidates: [{ lossLineId: 'l1', autoKey: 'k1', sliceId: 's1', kind: 'availability', quantity: '90', basis: 'planning_rate', reasonCodeId: null, impactCodeId: null, causeEventId: 'e1', state: 'proposed', effectiveQuantity: '90' }],
  lines: [],
  openProposalId: null,
};

describe('plan dashboard editor and workflow (plan 3.5)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) => render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('Manager', 'user-me');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  const acceptAndSave = () => {
    fireEvent.change(screen.getByTestId('candidate-decision'), { target: { value: 'accept' } });
    fireEvent.click(screen.getByTestId('save-lines'));
  };

  it('a failed save (T33) shows the error, keeps the unsaved decision and sends one atomic PUT with If-Match and baseRunId', async () => {
    reply = () => json(500, refusal('INTERNAL_ERROR'));
    wrap(<LossLineEditor view={VIEW} timezone="UTC" />);
    acceptAndSave();
    await waitFor(() => expect(screen.getByTestId('workflow-problem').getAttribute('data-code')).toBe('INTERNAL_ERROR'));
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].url.pathname).toMatch(/\/v2\/production-periods\/p1\/draft-lines$/);
    expect(puts[0].headers.get('If-Match')).toBe('"4"');
    expect(puts[0].body).toEqual({ revision: 1, baseRunId: 'run-1', lines: [{ action: 'accept', autoKey: 'k1' }] });
    expect(screen.getByTestId('loss-line-editor').getAttribute('data-dirty')).toBe('true');
  });

  it('409 RUN_CHANGED opens the candidate diff; rebase reloads the view', async () => {
    reply = (call) =>
      call.method === 'PUT'
        ? json(409, refusal('RUN_CHANGED', { currentRunId: 'run-2', added: [], removed: [], changed: [{ autoKey: 'k1', before: '90', after: '95' }] }))
        : json(200, { ...VIEW, baseRunId: 'run-2', candidates: [{ ...VIEW.candidates[0], quantity: '95' }] });
    wrap(<LossLineEditor view={VIEW} timezone="UTC" />);
    acceptAndSave();
    await waitFor(() => expect(screen.getByTestId('candidate-diff').textContent).toContain('90 → 95'));
    fireEvent.click(screen.getByTestId('rebase'));
    await waitFor(() => expect(screen.queryByTestId('conflict-dialog')).toBeNull());
  });

  it('a new run arriving while the user edits (realtime) rebases the draft and says which decisions were dropped', () => {
    reply = () => json(200, {});
    const { rerender } = wrap(<LossLineEditor view={VIEW} timezone="UTC" />);
    fireEvent.change(screen.getByTestId('candidate-decision'), { target: { value: 'accept' } });
    const next: ReconciliationView = { ...VIEW, rowVersion: 5, baseRunId: 'run-2', candidates: [{ ...VIEW.candidates[0], autoKey: 'k9' }] };
    rerender(<QueryClientProvider client={client}><MemoryRouter><LossLineEditor view={next} timezone="UTC" /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId('rebase-dropped').textContent).toContain('1 decision dropped');
    expect(screen.getByTestId('loss-line-editor').getAttribute('data-dirty')).toBe('true');
  });

  it('a 422 allocation refusal is shown on the line with the server’s remaining allocation', async () => {
    reply = () => json(422, refusal('ALLOCATION_EXCEEDED', { issues: [{ code: 'ALLOCATION_EXCEEDED', message: 'line 0: over budget', sliceId: 's1', line: 0, expectedRemainingAllocation: '60' }] }));
    wrap(<LossLineEditor view={VIEW} timezone="UTC" />);
    acceptAndSave();
    await waitFor(() => expect(screen.getByTestId('line-issue').textContent).toContain('still available to allocate'));
    expect(screen.getByTestId('line-issue').getAttribute('data-code')).toBe('ALLOCATION_EXCEEDED');
    expect(screen.getByTestId('line-issue').textContent).not.toContain('ALLOCATION_EXCEEDED');
    expect(screen.getByTestId('line-issue').textContent).toContain('60');
  });

  it('the submitter sees approve disabled with the separation-of-duties reason', () => {
    reply = () => json(200, { items: [] });
    const submitted: ReconciliationView = { ...VIEW, revision: { ...VIEW.revision, lifecycle: 'in_review', submittedBy: 'user-me', submittedHash: 'b'.repeat(64) } };
    wrap(<WorkflowBar view={submitted} shown="current" onShowCurrent={() => undefined} />);
    expect((screen.getByTestId('wf-approve') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('approve-gate').getAttribute('data-code')).toBe('SEPARATION_OF_DUTIES');
  });

  it('submit sends the run and content hash the user read; 422 gates are listed', async () => {
    reply = () => json(422, refusal('RESIDUAL_UNEXPLAINED', { issues: [{ code: 'RESIDUAL_UNEXPLAINED', message: 'residual 60', sliceId: 's1' }] }));
    wrap(<WorkflowBar view={VIEW} shown="current" onShowCurrent={() => undefined} />);
    fireEvent.click(screen.getByTestId('wf-submit'));
    await waitFor(() => expect(screen.getByTestId('gate-issues').querySelector('[data-code="RESIDUAL_UNEXPLAINED"]')).not.toBeNull());
    expect(screen.getByTestId('gate-issues').textContent).not.toContain('RESIDUAL_UNEXPLAINED');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toEqual({ revision: 1, runId: 'run-1', contentHash: 'a'.repeat(64) });
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('approve asks first: revision, attributed and Unaccounted with its state from the view, and sends the optional comment (A-6)', async () => {
    const inReview: ReconciliationView = { ...VIEW, revision: { ...VIEW.revision, lifecycle: 'in_review', submittedBy: 'someone-else', submittedHash: 'b'.repeat(64) } };
    reply = (call) => (call.method === 'POST' ? json(200, { ...inReview, revision: { ...inReview.revision, lifecycle: 'approved' } }) : json(200, { items: [] }));
    wrap(<WorkflowBar view={inReview} shown="current" onShowCurrent={() => undefined} />);
    fireEvent.click(screen.getByTestId('wf-approve'));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Approve revision 1?');
    expect(within(dialog).getByTestId('approve-summary')).toHaveTextContent('Attributed 90.00 t');
    expect(within(dialog).getByTestId('approve-summary')).toHaveTextContent('Unaccounted 60.00 t');
    expect(within(dialog).getByTestId('residual-state')).toHaveTextContent('Above tolerance');
    fireEvent.change(screen.getByTestId('wf-approve-comment'), { target: { value: '  checked the logs ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve revision' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ revision: 1, submittedHash: 'b'.repeat(64), comment: 'checked the logs' });
  });

  it('a candidate links to its cause event with the page as back target and shows "Not coded" in words (A-3, D-1)', () => {
    reply = () => json(200, { items: [] });
    wrap(<LossLineEditor view={VIEW} timezone="UTC" />);
    const link = screen.getByRole('link', { name: 'from a recorded event' });
    expect(link).toHaveAttribute('href', '/events/e1');
    expect(screen.getByTestId('line-not-coded')).toHaveTextContent('Not coded');
  });

  it('the reconciliation summary reads as the identity of server figures, with the residual state and checks (D-3)', () => {
    reply = () => json(200, {});
    wrap(<ReconciliationSummary view={VIEW} />);
    const figures = screen.getByTestId('slice-figures');
    for (const label of ['Target', 'Actual (good)', 'Gap', 'Attributed', 'Tolerance adj.', 'Unaccounted', 'Checks', 'Over-accounted', 'Overproduction', 'Tolerance threshold']) {
      expect(figures).toHaveTextContent(label);
    }
    expect(screen.getByTestId('figure-residual')).toHaveAttribute('data-value', '60');
    expect(screen.getByTestId('residual-state')).toHaveTextContent('Above tolerance');
    expect(screen.queryByTestId('reconciliation-ledger-note')).toBeNull();
  });

  it('QA capacity view: the reconciliation says it stays on the plan ledger', () => {
    wrap(<ReconciliationSummary view={VIEW} ledger="capacity" />);
    expect(screen.getByTestId('reconciliation-ledger-note')).toHaveTextContent('always on the plan ledger');
  });

  describe('controls follow the period role sets (owner decision 2026-10-12)', () => {
    const inReview: ReconciliationView = { ...VIEW, revision: { ...VIEW.revision, lifecycle: 'in_review', submittedBy: 'someone-else', submittedHash: 'b'.repeat(64) } };
    const bar = (view: ReconciliationView) => wrap(<WorkflowBar view={view} shown="current" onShowCurrent={() => undefined} />);

    it('canApproveRevisions: an engineer sees no approve / reject; a manager and a production accountant do (SME R1)', () => {
      reply = () => json(200, { items: [] });
      actAs('Engineer');
      bar(inReview);
      expect(screen.queryByTestId('wf-approve')).toBeNull();
      expect(screen.queryByTestId('wf-reason')).toBeNull();
      actAs('Manager', 'user-me');
      const manager = bar(inReview);
      expect((screen.getByTestId('wf-approve') as HTMLButtonElement).disabled).toBe(false);
      manager.unmount();
      actAs('production_accountant', 'user-me');
      bar(inReview);
      expect((screen.getByTestId('wf-approve') as HTMLButtonElement).disabled).toBe(false);
    });

    it('canWritePeriods: an engineer submits a draft; a viewer sees the Read-only hint and no action', () => {
      reply = () => json(200, { items: [] });
      actAs('production_engineer');
      bar(VIEW);
      expect(screen.getByTestId('wf-submit')).toBeTruthy();
      actAs('viewer');
      bar(VIEW);
      expect(screen.getAllByTestId('wf-submit')).toHaveLength(1);
      expect(screen.getByTestId('read-only-hint')).toBeTruthy();
    });
  });
});
