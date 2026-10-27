import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { actAs } from '@/test/acting-user';
import { approvalCommand } from './approval-command';
import { approvalItem } from '@/test/approval-item';
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'UTC' }) }));
const { ApprovalInboxPage } = await import('./approval-inbox-page');
const item = (extra: Partial<ApprovalItem> = {}): ApprovalItem => approvalItem({ reviewHref: '/planning/profiles/profile-1', ...extra });
interface Call { method: string; url: URL; body: Record<string, unknown> | null; headers: Headers }
let rows: ApprovalItem[], calls: Call[], reject = false, recordVersion = 3, client: QueryClient;
let pausedInbox: Promise<Response> | null = null;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function mount(path = '/approvals') { return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><ApprovalInboxPage /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => {
  actAs('SuperAdmin', 'author'); rows = [item()]; calls = []; reject = false; recordVersion = 3; pausedInbox = null;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null, headers: new Headers(init.headers) }; calls.push(call);
    if (call.method === 'POST') { if (reject) return json(409, { code: 'INVALID_TRANSITION', message: 'This record has already been decided.', correlationId: 'test' }); rows = rows.filter((entry) => !call.url.pathname.includes(`/${entry.commandId}/`)); return json(200, { state: call.url.pathname.endsWith('/retire') ? 'retired' : 'approved' }); }
    if (call.url.pathname.endsWith('/approval-inbox')) {
      if (posts().length && pausedInbox) return pausedInbox;
      const offset = Number(call.url.searchParams.get('cursor') ?? 0);
      const limit = Number(call.url.searchParams.get('limit') ?? 20);
      return json(200, { items: rows.slice(offset, offset + limit), nextCursor: offset + limit < rows.length ? String(offset + limit) : null, asOf: '2026-10-17T00:00:00Z', scope: { tenantId: 'tenant-a' } });
    }
    return json(200, { state: 'draft', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'h', rowVersion: recordVersion, version: 1 });
  }));
});
afterEach(() => { client.clear(); vi.unstubAllGlobals(); });
const posts = () => calls.filter((call) => call.method === 'POST');
describe('pending approvals UI', () => {
  it('reads on render without extra text and routes to the existing workspace', async () => { mount(); expect(await screen.findByText('Extruder HDPE')).toBeTruthy(); expect(screen.queryByText('Manager (approver)')).toBeNull(); expect(screen.queryByText(/Approvals follow your assigned roles|grouped by workflow/)).toBeNull(); expect(screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/planning/profiles/profile-1'); expect(posts()).toHaveLength(0); });
  it('approves its own SuperAdmin draft with an idempotency key and refreshes the inbox', async () => { mount(); await screen.findByText('Extruder HDPE'); fireEvent.click(screen.getByRole('button', { name: 'Approve' })); const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details'); fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' })); await waitFor(() => expect(posts()).toHaveLength(1)); expect(posts()[0].url.pathname).toMatch(/profiles\/profile-1\/approve$/); expect(posts()[0].body).toEqual({ supersede: false }); expect(posts()[0].headers.get('Idempotency-Key')).toBeTruthy(); expect(await screen.findByText('No pending approvals for your roles')).toBeTruthy(); });
  it('removes a retired draft and keeps the other pending record visible', async () => { rows = [item(), item({ id: 'profile-2', commandId: 'profile-2', title: 'Another pending profile' })]; mount(); await screen.findByText('Extruder HDPE'); fireEvent.click(screen.getAllByRole('button', { name: 'Retire' })[0]); const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details'); fireEvent.click(within(dialog).getByRole('button', { name: 'Retire' })); await waitFor(() => expect(posts()).toHaveLength(1)); expect(posts()[0].url.pathname).toMatch(/profiles\/profile-1\/retire$/); await waitFor(() => expect(screen.queryByText('Extruder HDPE')).toBeNull()); expect(screen.getByText('Another pending profile')).toBeTruthy(); });
  it('removes the approved row immediately even while the follow-up read is waiting', async () => {
    let release!: (response: Response) => void;
    pausedInbox = new Promise<Response>((resolve) => { release = resolve; });
    try {
      mount(); await screen.findByText('Extruder HDPE'); fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details'); fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
      expect(await screen.findByText('No pending approvals for your roles')).toBeTruthy();
      expect(screen.queryByText('Extruder HDPE')).toBeNull(); expect(posts()).toHaveLength(1);
    } finally { release(json(200, { items: [], nextCursor: null, asOf: 'now', scope: { tenantId: 'tenant-a' } })); }
  });
  it('returns to remaining pending records after retiring the last row on a later page, before refetch finishes', async () => {
    rows = Array.from({length: 21}, (_, index) => item({ id: `profile-${index + 1}`, commandId: `profile-${index + 1}`, title: `Pending profile ${index + 1}` }));
    let release!: (response: Response) => void;
    pausedInbox = new Promise<Response>((resolve) => { release = resolve; });
    try {
      mount(); await screen.findByText('Pending profile 1'); fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      await screen.findByText('Pending profile 21'); fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
      const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details'); fireEvent.click(within(dialog).getByRole('button', { name: 'Retire' }));
      expect(await screen.findByText('Pending profile 1')).toBeTruthy(); expect(screen.queryByText('Pending profile 21')).toBeNull(); expect(screen.queryByText('No pending approvals for your roles')).toBeNull();
    } finally { release(json(200, { items: rows, nextCursor: null, asOf: 'now', scope: { tenantId: 'tenant-a' } })); }
  });
  it('explains ordinary author separation while retaining permitted retirement', async () => { actAs('Manager', 'author'); rows = [item({ actions: [{ action: 'approve', disabledReason: 'A different approver must decide your own request.' }, { action: 'retire', disabledReason: null }] })]; mount(); expect(await screen.findByText('A different approver must decide your own request.')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull(); expect(screen.getByRole('button', { name: 'Retire' })).toBeTruthy(); });
  it('requires a reason before rejecting a proposed quality disposition', async () => { rows = [item({ kind: 'disposition', resource: 'lot-dispositions', supersede: false, actions: [{ action: 'reject', disabledReason: null }] })]; mount(); await screen.findByText('Extruder HDPE'); fireEvent.click(screen.getByRole('button', { name: 'Reject' })); const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details'); const button = within(dialog).getByRole('button', { name: 'Reject' }); expect(button.hasAttribute('disabled')).toBe(true); fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: 'Lab certificate is missing' } }); fireEvent.click(button); await waitFor(() => expect(posts()).toHaveLength(1)); expect(posts()[0].body).toEqual({ reason: 'Lab certificate is missing' }); });
  it('keeps a failed decision visible and does not retry automatically', async () => { reject = true; mount(); await screen.findByText('Extruder HDPE'); fireEvent.click(screen.getByRole('button', { name: 'Approve' })); const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details'); fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' })); expect(await within(dialog).findByText('Decision could not be saved')).toBeTruthy(); expect(posts()).toHaveLength(1); expect(screen.getByRole('alertdialog')).toBeTruthy(); });
  it('blocks a decision when current details differ from the inbox revision', async () => { recordVersion = 4; mount(); await screen.findByText('Extruder HDPE'); fireEvent.click(screen.getByRole('button', { name: 'Approve' })); const dialog = await screen.findByRole('alertdialog'); expect(await within(dialog).findByText('This record changed. Close this dialog and refresh the inbox before deciding.')).toBeTruthy(); expect(within(dialog).getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(true); expect(posts()).toHaveLength(0); });
  it('lets SuperAdmin decide for finance, quality and source-owner roles', async () => {
    rows = ['finance_approver', 'quality_approver', 'production_accountant'].map((role, index) => item({ id: `role-${index}`, commandId: `role-${index}`, title: `Request for ${role}`, requiredRoles: [role] }));
    mount(); await screen.findByText('Request for finance_approver');
    expect(screen.getByRole('columnheader', { name: 'State' })).toBeTruthy();
    expect(screen.queryByText('SuperAdmin can act for every approval role')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(3);
  });
  it('lets SuperAdmin continue a review-stage decision in the existing workspace', async () => {
    rows = [item({ id: 'rev-1', kind: 'period-review', kindLabel: 'Period reconciliation', state: 'in_review', resource: null, actions: [], reviewHref: '/plans/plan-1/periods/period-1/review#period-review' })];
    mount(); await screen.findByText('In review');
    expect(screen.getByRole('link', { name: 'Review & decide Extruder HDPE' }).getAttribute('href')).toBe('/approvals/period-review/rev-1');
    expect(screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/plans/plan-1/periods/period-1/review#period-review');
  });
  it('rows show the record and its change only, no summary sentence or version line', async () => {
    rows = [item({ headline: null, summary: 'Set the posting date and treatment after reviewing the approved restatement delta', version: 2 })];
    mount(); await screen.findByText('Extruder HDPE');
    expect(screen.queryByText(/Set the posting date/)).toBeNull();
    expect(screen.queryByText('Version 2')).toBeNull();
  });
  it('each pending record opens its approval page', async () => { mount(); await screen.findByText('Extruder HDPE'); expect(screen.getByRole('link', { name: 'Review & decide Extruder HDPE' }).getAttribute('href')).toBe('/approvals/profile/profile-1'); expect(screen.getByRole('link', { name: 'Extruder HDPE' }).getAttribute('href')).toBe('/approvals/profile/profile-1'); });
  it('groups rows by workflow and shows the one-line change of each row', async () => {
    rows = [item(), item({ id: 'rate-2', kind: 'rate', kindLabel: 'Production rate', commandId: 'rate-2', title: 'planning rate', resource: 'rates', headline: { key: 'rate', label: 'Rate', before: '28', after: '29', unit: 't/h', currency: null, format: 'quantity', group: null, changed: true } })];
    mount(); await screen.findByText('planning rate');
    const groups = screen.getAllByTestId('approval-group');
    expect(groups.map((group) => group.getAttribute('data-kind'))).toEqual(['profile', 'rate']);
    expect(within(groups[1]).getByRole('heading', { name: /Production rate/ })).toBeTruthy();
    const headline = within(groups[1]).getByTestId('approval-headline');
    expect(headline.textContent).toMatch(/Rate\s*28\.00\s*t\/h.*→.*29\.00\s*t\/h/);
  });
  it('“Only what I can decide” asks the server for decidable records and explains the empty result', async () => {
    mount(); await screen.findByText('Extruder HDPE');
    rows = [];
    fireEvent.click(screen.getByLabelText('Only what I can decide'));
    await waitFor(() => expect(calls.some((call) => call.url.searchParams.get('decidable') === 'true')).toBe(true));
    expect(await screen.findByText(/Nothing waits for your decision/)).toBeTruthy();
  });
  it('states read in sentence case, like other badges; required roles stay on the approval page', async () => {
    rows = [item({ id: 'post-1', kind: 'finance-posting', kindLabel: 'Restatement posting', state: 'awaiting_posting', resource: null, actions: [], requiredRoles: ['finance_approver'] })];
    mount(); expect(await screen.findByText('Awaiting posting')).toBeTruthy();
    expect(screen.queryByText('Finance approver')).toBeNull();
  });
  it('the Workflow filter comes from the address (?kind=), so a reload keeps it', async () => {
    mount('/approvals?kind=fx-rate'); await screen.findByText('Extruder HDPE');
    expect((screen.getByLabelText('Workflow') as HTMLSelectElement).value).toBe('fx-rate');
    expect(calls.some((call) => call.url.searchParams.get('kind') === 'fx-rate')).toBe(true);
  });
  it('filters workflows on the server', async () => { mount(); await screen.findByText('Extruder HDPE'); fireEvent.change(screen.getByLabelText('Workflow'), { target: { value: 'fx-rate' } }); await waitFor(() => expect(calls.some((call) => call.url.searchParams.get('kind') === 'fx-rate')).toBe(true)); });
});
describe('loss accounting drafts in the inbox', () => {
  const draft = () => item({ id: 'lv-1', commandId: 'lv-1', kind: 'loss-accounting', kindLabel: 'Loss accounting', title: 'Loss accounting', summary: 'day accounting · declared · target: declared', state: 'proposed', unitId: null, unitName: null, resource: 'loss-accounting/versions', reviewHref: '/approvals/loss-accounting/lv-1', supersede: false, version: null, actions: [{ action: 'approve', disabledReason: null }, { action: 'reject', disabledReason: null }] });
  it('lists the draft with Approve and Reject; approving posts the loss accounting decision with an idempotency key', async () => {
    rows = [draft()]; mount(); await screen.findByText('Loss accounting', { selector: 'td *, td' });
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' })); const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/loss-accounting\/versions\/lv-1\/approve$/); expect(posts()[0].headers.get('Idempotency-Key')).toBeTruthy();
  });
  it('rejecting needs a reason, which travels with the decision', async () => {
    rows = [draft()]; mount(); await screen.findByRole('button', { name: 'Reject' });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' })); const dialog = await screen.findByRole('alertdialog'); await within(dialog).findByText('Current record details');
    expect((within(dialog).getByRole('button', { name: 'Reject' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'wrong unit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/loss-accounting\/versions\/lv-1\/reject$/); expect(posts()[0].body).toEqual({ reason: 'wrong unit' });
  });
  it('is a known workflow with the reason-bearing command body', () => {
    expect(approvalCommand({ item: draft(), action: 'reject', reason: ' wrong unit ', supersede: false })).toEqual({ path: '/loss-accounting/versions/lv-1/reject', body: { reason: 'wrong unit' } });
    expect(() => approvalCommand({ item: draft(), action: 'reject', reason: '', supersede: false })).toThrow(/reason/);
  });
});
describe('workflow command contracts', () => {
  it('uses reviewed plan version and preserves return reason', () => { const request = approvalCommand({ item: item({ resource: 'production-plans', commandId: 'plan-1', version: 7, actions: [{ action: 'return', disabledReason: null }] }), action: 'return', reason: 'Fix quantities', supersede: false }); expect(request).toEqual({ path: '/production-plans/plan-1/return', body: { expectedVersion: 7, reason: 'Fix quantities' } }); });
  it('uses If-Match for rule activation', () => { const request = approvalCommand({ item: item({ resource: 'rules', actions: [{ action: 'activate', disabledReason: null }] }), action: 'activate', reason: 'Reviewed rule', supersede: false }); expect(request.ifMatch).toBe('"3"'); expect(request.body).toEqual({ reason: 'Reviewed rule' }); });
  it('blocks commands absent from the record and forbids unsupported command resources', () => { expect(() => approvalCommand({ item: item({ actions: [] }), action: 'approve', reason: '', supersede: false })).toThrow(/not available/); expect(() => approvalCommand({ item: item({ resource: 'users' }), action: 'approve', reason: '', supersede: false })).toThrow(/workspace/); });
});
