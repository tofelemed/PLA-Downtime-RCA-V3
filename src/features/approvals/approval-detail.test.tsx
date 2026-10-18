import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ApprovalChanges, ApprovalItem } from '@/api/v2/types/approvals';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { RestatementView } from '@/api/v2/types/restatement';
import { Toaster } from '@/components/ui/toaster';
import { actAs } from '@/test/acting-user';
import { approvalItem } from '@/test/approval-item';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'UTC' }) }));
const { ApprovalDetailPage } = await import('./approval-detail-page');

const PERIOD_TARGET = { periodId: 'p1', planId: 'plan-1', revision: 2, monthKey: null, eventId: null, profileId: null };
const PROFILE = approvalItem({ title: 'normal profile', version: 2, reviewHref: '/planning/profiles/profile-1#profile-version' });
const RATE = approvalItem({ id: 'rate-2', kind: 'rate', kindLabel: 'Production rate', title: 'planning rate', resource: 'rates', commandId: 'rate-2', reviewHref: '/planning/profiles/profile-1#rate-rate-2' });
const PLAN = approvalItem({ id: 'pv-1', kind: 'plan', kindLabel: 'Production plan version', title: 'October plan', resource: 'production-plans', commandId: 'plan-1', version: 7, supersede: false, actions: [{ action: 'approve', disabledReason: null }, { action: 'return', disabledReason: null }] });
const workflow = (extra: Partial<ApprovalItem>): ApprovalItem => approvalItem({ resource: null, version: null, supersede: false, actions: [], target: PERIOD_TARGET, ...extra });
const PERIOD = workflow({ id: 'rev-2', kind: 'period-review', kindLabel: 'Period reconciliation', title: 'EX-01 · 17 Oct · Shift A', state: 'in_review', authorId: 'preparer', reviewHref: '/plans/plan-1/periods/p1/review#period-review' });
const POSTING = workflow({ id: 'rev-2', kind: 'finance-posting', kindLabel: 'Restatement posting', title: '2026-10-17 · restatement 2', state: 'awaiting_posting', reviewHref: '/plans/plan-1/periods/p1/review#restatement' });
const PROPOSAL = workflow({ id: 'cp-1', kind: 'change-proposal', kindLabel: 'Period change proposal', title: 'Approved-period change', state: 'open', reviewHref: '/plans/plan-1/periods/p1/history#change-proposal-cp-1' });

const field = (key: string, label: string, [before, after]: [string | null, string], extra: Partial<ApprovalChanges['fields'][number]> = {}) =>
  ({ key, label, before, after, unit: null, currency: null, format: 'text' as const, group: null, changed: before !== null && before !== after, ...extra });
const RATE_CHANGES: ApprovalChanges = {
  kind: 'rate', id: 'rate-2', mode: 'diff', beforeLabel: 'Approved now', afterLabel: 'Pending',
  fields: [field('rate', 'Rate', ['28', '29'], { unit: 't/h', format: 'quantity' }), field('rateKind', 'Rate kind', ['planning', 'planning'])],
};
const FULL: ApprovalChanges = { kind: 'profile', id: 'profile-1', mode: 'full', beforeLabel: null, afterLabel: 'Pending', fields: [field('operatingMode', 'Operating mode', [null, 'normal'])] };

const VIEW = {
  periodId: 'p1', unitId: 'u1', utcStart: '2026-10-17T06:00:00.000Z', utcEnd: '2026-10-17T14:00:00.000Z', rowVersion: 4,
  revision: { id: 'rev-2', revision: 2, lifecycle: 'in_review', supersedesId: null, submittedBy: 'preparer', submittedHash: 'b'.repeat(64), isStale: false, openedBy: null },
  publishedRevision: 1, baseRunId: 'run1', contentHash: 'hash', openProposalId: 'cp-1', bridgeReview: null,
  slices: [{ sliceId: 's1', uom: 't', target: '1000', actual: '850', gap: '150', attributed: '140', toleranceAdjustment: '0', unadjustedResidual: '10', residual: '10', overAccounted: '0', overproduction: '0', tolerance: '0', flags: [] }],
  candidates: [], lines: [],
} as unknown as ReconciliationView;
const RESTATEMENT: RestatementView = {
  periodId: 'p1', revision: 2, lifecycle: 'approved', afterClose: false, supersededRevision: 1, operationalEffectiveDate: '2026-10-17', posting: null,
  totals: [], actuals: [], lines: [],
};
const PROPOSAL_VIEW = {
  id: 'cp-1', periodId: 'p1', unitId: 'u1', approvedRevisionId: 'rev-1', trigger: 'event_change', state: 'open', inputHash: null, before: {}, after: null,
  affectedReports: [], detail: {}, resolvedBy: null, resolvedAt: null, resolutionReason: null, createdRevisionId: null, manual: null,
  createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z', rowVersion: 1,
};

interface Call { method: string; url: URL; body: Record<string, unknown> | null }
let item: ApprovalItem | null;
let changes: ApprovalChanges;
let restatement: RestatementView;
let calls: Call[];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const posts = () => calls.filter((call) => call.method === 'POST');

function respond(call: Call): Response {
  const path = call.url.pathname;
  if (call.method === 'POST') {
    if (path.endsWith('/posting')) restatement = { ...restatement, posting: { postingDate: '2026-11-03', treatment: 'correction', note: null, decidedBy: 'f1', decidedAt: '2026-11-03T08:00:00Z' } } as RestatementView;
    return json(200, path.endsWith('/posting') ? restatement : { state: 'approved' });
  }
  if (path.endsWith('/changes')) return json(200, changes);
  if (path.includes('/approval-inbox/')) return item ? json(200, item) : json(404, { code: 'NOT_FOUND', message: 'This record is not pending your approval', correlationId: 't' });
  if (path.endsWith('/approval-inbox')) return json(200, { items: [], nextCursor: null, asOf: 'now', scope: { tenantId: 'tenant-a' } });
  if (path.endsWith('/reconciliation')) return json(200, VIEW);
  if (path.endsWith('/change-proposals')) return json(200, { items: [PROPOSAL_VIEW], nextCursor: null });
  if (path.endsWith('/restatement')) return json(200, restatement);
  return json(200, { state: 'draft', operatingMode: 'normal', evidence: 'Trial run report TR-7', rowVersion: 3, version: { rowVersion: 3 } });
}

function mount(current: ApprovalItem | null, path = current ? `/approvals/${current.kind}/${current.id}` : '/approvals/profile/gone-1') {
  item = current;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/approvals" element={<p>Inbox page</p>} />
          <Route path="/approvals/:kind/:id" element={<ApprovalDetailPage />} />
        </Routes>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  actAs('Manager', 'manager-1');
  calls = [];
  changes = FULL;
  restatement = RESTATEMENT;
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
    calls.push(call);
    return respond(call);
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function decide(action: string, reason?: string) {
  fireEvent.click(await screen.findByRole('button', { name: action }));
  const dialog = await screen.findByRole('alertdialog');
  await within(dialog).findByText('Current record details');
  if (reason) fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole('button', { name: action }));
}

describe('approval detail page', () => {
  it('shows the full pending content, who may decide and the exact workspace link, from the inbox read', async () => {
    mount(PROFILE);
    expect(await screen.findByRole('heading', { level: 1, name: 'normal profile' })).toBeTruthy();
    const changesTable = await screen.findByTestId('approval-changes');
    expect(changesTable.getAttribute('data-mode')).toBe('full');
    expect(within(changesTable).getByText(/no approved predecessor/)).toBeTruthy();
    expect(screen.getByTestId('approval-eligibility').textContent).toContain('You can decide here: Approve, Retire.');
    expect(screen.getByRole('link', { name: 'Open in workspace' }).getAttribute('href')).toBe('/planning/profiles/profile-1#profile-version');
    expect(within(screen.getByTestId('approval-summary')).getByText('Engineer A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Record content/ }));
    expect(await screen.findByText('Trial run report TR-7')).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it('rate approval: shows exactly what changes (28 → 29 t/h), then approves with the existing command', async () => {
    changes = RATE_CHANGES;
    mount(RATE);
    const rows = await screen.findAllByTestId('approval-change-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toMatch(/Rate\s*Changed\s*28\.00\s*t\/h\s*29\.00\s*t\/h/);
    expect(screen.getByText('1 field differ from the approved now.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show unchanged fields (1)' }));
    expect(screen.getAllByTestId('approval-change-row')).toHaveLength(2);
    await decide('Approve');
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/rates\/rate-2\/approve$/);
    expect(posts()[0].body).toEqual({ supersede: false });
    expect(await screen.findByText('Inbox page')).toBeTruthy();
    expect(await screen.findByText('Approved')).toBeTruthy();
  });

  it('returns a plan version for revision with its reason and the reviewed version', async () => {
    mount(PLAN);
    await decide('Return to author', 'Quantities of week 3 are missing');
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/production-plans\/plan-1\/return$/);
    expect(posts()[0].body).toEqual({ expectedVersion: 7, reason: 'Quantities of week 3 are missing' });
    expect(await screen.findByText('Returned to author')).toBeTruthy();
  });

  it('explains separation of duties for the author and offers only what is allowed', async () => {
    mount({ ...PROFILE, actions: [{ action: 'approve', disabledReason: 'A different approver must decide your own request.' }, { action: 'retire', disabledReason: null }] });
    const eligibility = await screen.findByTestId('approval-eligibility');
    expect(eligibility.textContent).toContain('Approve is not available to you: A different approver must decide your own request.');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retire' })).toBeTruthy();
  });

  it('period revision: shows the reconciliation equation in place and refuses approval to the submitter', async () => {
    actAs('production_accountant', 'preparer');
    mount({ ...PERIOD, canDecide: false, decisionBlockedReason: 'A different approver must decide your own request.' });
    const form = await screen.findByTestId('inline-period-review');
    expect(within(form).getByText('Unaccounted')).toBeTruthy();
    expect(within(form).getByTestId('approve-gate').textContent).toContain('You submitted this revision');
    expect(within(form).getByTestId('wf-approve').hasAttribute('disabled')).toBe(true);
    expect(within(form).getByTestId('wf-reject').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('approval-eligibility').textContent).toContain('You cannot decide this record: A different approver must decide your own request.');
    expect(posts()).toHaveLength(0);
  });

  it('period revision: an independent approver approves in place with an optional comment', async () => {
    actAs('production_accountant', 'approver');
    mount(PERIOD);
    fireEvent.click(await screen.findByTestId('wf-approve'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByTestId('approve-summary').textContent).toMatch(/Unaccounted\s*10\.00\s*t/);
    fireEvent.change(within(dialog).getByTestId('wf-approve-comment'), { target: { value: 'Checked against the shift log' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve revision' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/production-periods\/p1\/approve$/);
    expect(posts()[0].body).toEqual({ revision: 2, submittedHash: 'b'.repeat(64), comment: 'Checked against the shift log' });
    expect(await screen.findByText('Revision approved')).toBeTruthy();
  });

  it('restatement posting: finance sets the posting date and treatment in place and returns to the inbox', async () => {
    actAs('finance_approver', 'finance-1');
    mount(POSTING);
    const form = await screen.findByTestId('inline-restatement-posting');
    expect(within(form).getByText(/Restates approved revision 1/)).toBeTruthy();
    fireEvent.change(within(form).getByTestId('posting-date'), { target: { value: '2026-11-03' } });
    fireEvent.change(within(form).getByTestId('posting-treatment'), { target: { value: 'estimate_change' } });
    fireEvent.click(within(form).getByTestId('posting-save'));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/production-periods\/p1\/revisions\/2\/posting$/);
    expect(posts()[0].body).toEqual({ postingDate: '2026-11-03', treatment: 'estimate_change' });
    expect(await screen.findByText('Inbox page')).toBeTruthy();
    expect(await screen.findByText('Posting saved')).toBeTruthy();
  });

  it('change proposal: an approver accepts it in place with a reason', async () => {
    actAs('production_accountant', 'approver');
    mount(PROPOSAL);
    const form = await screen.findByTestId('inline-change-proposal');
    fireEvent.click(within(form).getByTestId('proposal-accept'));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: 'Late stop coding confirmed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept change' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/period-change-proposals\/cp-1\/accept$/);
    expect(posts()[0].body).toEqual({ reason: 'Late stop coding confirmed' });
    expect(await screen.findByText('Change accepted: a new draft revision is open')).toBeTruthy();
  });

  it('a record decided elsewhere says it is no longer pending, with the way back', async () => {
    mount(null);
    expect(await screen.findByRole('heading', { level: 1, name: 'No longer pending' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Pending Approvals' }).getAttribute('href')).toBe('/approvals');
  });
});
