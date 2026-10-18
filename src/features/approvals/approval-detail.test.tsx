import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Toaster } from '@/components/ui/toaster';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'UTC' }) }));
const { ApprovalDetailPage } = await import('./approval-detail-page');

const base: ApprovalItem = {
  id: 'profile-1', kind: 'profile', kindLabel: 'Production profile', title: 'normal profile', summary: 'Product HDPE-BL3 · t / h', state: 'draft',
  createdAt: '2026-10-01T00:00:00.000000Z', unitId: 'unit-1', unitName: 'EX-01', authorId: 'author', authorName: 'Engineer A', requiredRoles: ['manager_approver'],
  reviewHref: '/planning/profiles/profile-1', resource: 'profiles', commandId: 'profile-1', version: 2, rowVersion: 3, supersede: true,
  actions: [{ action: 'approve', disabledReason: null }, { action: 'retire', disabledReason: null }],
};
const PLAN: ApprovalItem = { ...base, id: 'pv-1', kind: 'plan', kindLabel: 'Production plan version', title: 'October plan', resource: 'production-plans', commandId: 'plan-1', version: 7, supersede: false, reviewHref: '/planning/plans/plan-1', actions: [{ action: 'approve', disabledReason: null }, { action: 'return', disabledReason: null }] };
const DISPOSITION: ApprovalItem = { ...base, id: 'd-1', kind: 'disposition', kindLabel: 'Quality disposition', title: 'Lot 42 downgrade', resource: 'lot-dispositions', commandId: 'd-1', supersede: false, actions: [{ action: 'approve', disabledReason: null }, { action: 'reject', disabledReason: null }] };
const PERIOD: ApprovalItem = { ...base, id: 'per-1', kind: 'period-review', kindLabel: 'Period reconciliation', title: 'EX-01 · 17 Oct · Shift A', state: 'in_review', resource: null, commandId: 'per-1', version: null, supersede: false, reviewHref: '/plans/plan-1/periods/per-1', actions: [] };

interface Call { method: string; url: URL; body: Record<string, unknown> | null }
let item: ApprovalItem | null;
let calls: Call[];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const posts = () => calls.filter((call) => call.method === 'POST');

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
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
    calls.push(call);
    if (call.method === 'POST') return json(200, { state: 'approved' });
    if (call.url.pathname.includes('/approval-inbox/')) {
      return item ? json(200, item) : json(404, { code: 'NOT_FOUND', message: 'This record is not pending your approval', correlationId: 't' });
    }
    if (call.url.pathname.endsWith('/approval-inbox')) return json(200, { items: [], nextCursor: null, asOf: 'now', scope: { tenantId: 'tenant-a' } });
    return json(200, { state: 'draft', operatingMode: 'normal', validFrom: '2026-10-01T00:00:00Z', evidence: 'Trial run report TR-7', rowVersion: 3, version: { rowVersion: 3 } });
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
  it('shows what needs approval, the record content and who may decide, from the inbox read', async () => {
    mount(base);
    expect(await screen.findByRole('heading', { level: 1, name: 'normal profile' })).toBeTruthy();
    const summary = screen.getByTestId('approval-summary');
    expect(within(summary).getByText('Engineer A')).toBeTruthy();
    expect(within(summary).getByText(/version 2/)).toBeTruthy();
    expect(within(summary).getByText('manager approver')).toBeTruthy();
    expect(await screen.findByText('Trial run report TR-7')).toBeTruthy();
    expect(screen.getByTestId('approval-eligibility').textContent).toContain('You can decide here: Approve, Retire.');
    expect(screen.getByRole('link', { name: 'Open full workspace' }).getAttribute('href')).toBe('/planning/profiles/profile-1');
    expect(calls.some((call) => call.url.pathname.endsWith('/approval-inbox/profile/profile-1'))).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it('approves a profile version with the existing command, then returns to the inbox with a toast', async () => {
    mount(base);
    await decide('Approve');
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url.pathname).toMatch(/\/profiles\/profile-1\/approve$/);
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

  it('rejects a quality disposition only with a reason', async () => {
    mount(DISPOSITION);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog');
    await within(dialog).findByText('Current record details');
    expect(within(dialog).getByRole('button', { name: 'Reject' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: 'Lab certificate missing' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(posts()[0]?.body).toEqual({ reason: 'Lab certificate missing' }));
  });

  it('explains separation of duties for the author and offers only what is allowed', async () => {
    mount({ ...base, actions: [{ action: 'approve', disabledReason: 'A different approver must decide your own request.' }, { action: 'retire', disabledReason: null }] });
    const eligibility = await screen.findByTestId('approval-eligibility');
    expect(eligibility.textContent).toContain('Approve is not available to you: A different approver must decide your own request.');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retire' })).toBeTruthy();
  });

  it('a workspace-only review shows its summary and leads to the review workspace', async () => {
    mount(PERIOD);
    expect(await screen.findByText('This review is decided in its workspace, where its evidence and gates are checked.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open review workspace' }).getAttribute('href')).toBe('/plans/plan-1/periods/per-1');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('a record decided elsewhere says it is no longer pending, with the way back', async () => {
    mount(null);
    expect(await screen.findByRole('heading', { level: 1, name: 'No longer pending' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Pending Approvals' }).getAttribute('href')).toBe('/approvals');
  });
});
