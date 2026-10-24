import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { RoleDelegationView } from '@/api/v2/types/role-delegations';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { DelegationsPage } = await import('./delegations-page');
const { delegationsDescription } = await import('./delegations-description');

const DELEGATION: RoleDelegationView = {
  id: 'd1',
  delegatorId: 'manager',
  delegatorName: 'Parisa Manager',
  delegateId: 'deputy',
  delegateName: 'Reza Deputy',
  role: 'manager_approver',
  scopeKind: 'tenant',
  scopeId: 'tenant-a',
  validFrom: '2026-10-15T00:00:00.000Z',
  validUntil: '2099-10-22T00:00:00.000Z',
  reason: 'annual leave',
  inForce: true,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  createdBy: 'manager',
  createdAt: '2026-10-15T00:00:00.000Z',
  rowVersion: 1,
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/** SME R1 / R6: who holds an approval role for whom; holders delegate their own role, the parties may revoke. */
describe('delegations page (SME R1 / R6)', () => {
  const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ items: [DELEGATION], nextCursor: null, asOf: '2026-10-15T00:00:00.000Z', scope: { tenantId: 'tenant-a' } })),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('the delegator sees the delegation in force, may revoke it and may delegate', async () => {
    actAs('manager_approver', 'manager');
    wrap(<DelegationsPage />);
    await waitFor(() => expect(screen.getByText('Reza Deputy')).toBeTruthy());
    expect(screen.getByText('In force', { selector: 'span, div' })).toBeTruthy();
    expect(screen.getByTestId('delegation-revoke')).toBeTruthy();
    expect(screen.getByTestId('delegation-new')).toBeTruthy();
  });

  it('a metrology approver may delegate their role (owner 15 Oct 2026)', async () => {
    actAs('metrology_approver', 'metrology');
    wrap(<DelegationsPage />);
    await waitFor(() => expect(screen.getByText('Reza Deputy')).toBeTruthy());
    expect(screen.getByTestId('delegation-new')).toBeTruthy();
  });

  it('another member reads it but neither delegates nor revokes', async () => {
    actAs('production_engineer', 'someone');
    wrap(<DelegationsPage />);
    await waitFor(() => expect(screen.getByText('Reza Deputy')).toBeTruthy());
    expect(screen.queryByTestId('delegation-revoke')).toBeNull();
    expect(screen.queryByTestId('delegation-new')).toBeNull();
  });
});

describe('Approval delegations cleanup (25 Oct 2026)', () => {
  const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [DELEGATION], nextCursor: null, asOf: '2026-10-15T00:00:00.000Z', scope: { tenantId: 'tenant-a' } })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('the description sits behind ⓘ; the list is a card with its count, the Show filter and times without a zone', async () => {
    actAs('manager_approver', 'manager');
    wrap(<DelegationsPage />);
    await waitFor(() => expect(screen.getByText('Reza Deputy')).toBeTruthy());
    expect(screen.queryByText(/Hand an approval role to a delegate/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Approval delegations' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Approval delegations', level: 2 })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Show' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'In force', pressed: true })).toBeTruthy();
    expect(screen.queryByText(/Asia\/Tehran|\+03:30/)).toBeNull();
  });

  it('New delegation opens a dialog: the role holder hands over their own role as text, first field focused, Cancel closes', async () => {
    actAs('manager_approver', 'manager');
    wrap(<DelegationsPage />);
    fireEvent.click(await screen.findByTestId('delegation-new'));
    const dialog = await screen.findByRole('dialog', { name: 'New delegation' });
    expect(within(dialog).getByTestId('delegation-delegator-text')).toBeTruthy();
    expect(within(dialog).queryByTestId('delegation-delegator')).toBeNull();
    await waitFor(() => expect(within(dialog).getByTestId('delegation-delegate')).toHaveFocus());
    expect(within(dialog).getByTestId('delegation-save')).toBeDisabled();
    const names = within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Delegate'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a plant administrator chooses who hands over; Esc closes the dialog', async () => {
    actAs('TenantAdmin', 'admin');
    wrap(<DelegationsPage />);
    fireEvent.click(await screen.findByTestId('delegation-new'));
    const dialog = await screen.findByRole('dialog', { name: 'New delegation' });
    expect(within(dialog).getByTestId('delegation-delegator')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Revoke opens a confirm with a labelled reason, focused; the confirm waits for the reason', async () => {
    actAs('manager_approver', 'manager');
    wrap(<DelegationsPage />);
    fireEvent.click(await screen.findByTestId('delegation-revoke'));
    const confirm = await screen.findByRole('alertdialog', { name: 'End this delegation now?' });
    await waitFor(() => expect(within(confirm).getByLabelText('Reason')).toHaveFocus());
    expect(within(confirm).getByRole('button', { name: 'Revoke delegation' })).toBeDisabled();
    fireEvent.change(within(confirm).getByLabelText('Reason'), { target: { value: 'back early' } });
    expect(within(confirm).getByRole('button', { name: 'Revoke delegation' })).toBeEnabled();
    fireEvent.keyDown(confirm, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

describe('New delegation by a role holder (security: delegator is the current user)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('submits a POST whose delegatorId is the signed-in role holder', async () => {
    const posted: unknown[] = [];
    const people = [
      { id: 'manager', name: 'Parisa Manager', isActive: true },
      { id: 'deputy', name: 'Reza Deputy', isActive: true },
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (init?.method === 'POST' && path.endsWith('/role-delegations')) {
        posted.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify(DELEGATION), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (path.endsWith('/users/directory')) return json({ items: people, nextCursor: null, asOf: '2026-10-15T00:00:00.000Z', scope: { tenantId: 'tenant-a' } });
      return json({ items: [], nextCursor: null, asOf: '2026-10-15T00:00:00.000Z', scope: { tenantId: 'tenant-a' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('manager_approver', 'manager');
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DelegationsPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByTestId('delegation-new'));
    const dialog = await screen.findByRole('dialog', { name: 'New delegation' });
    await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Reza Deputy' })).toBeTruthy());
    fireEvent.change(within(dialog).getByTestId('delegation-delegate'), { target: { value: 'deputy' } });
    fireEvent.change(within(dialog).getByLabelText('From date'), { target: { value: '2026-10-20' } });
    fireEvent.change(within(dialog).getByLabelText('Until (at most 90 days) date'), { target: { value: '2026-10-25' } });
    fireEvent.change(within(dialog).getByTestId('delegation-reason'), { target: { value: 'annual leave' } });
    fireEvent.click(within(dialog).getByTestId('delegation-save'));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ delegatorId: 'manager', delegateId: 'deputy', role: 'manager_approver', scopeKind: 'tenant', scopeId: 'tenant-a' });
  });
});

describe('Approval delegations wording (QA re-test 2026-10-19)', () => {
  it('tells only SuperAdmin that SuperAdmin may complete every stage', () => {
    expect(delegationsDescription(false)).not.toMatch(/SuperAdmin/);
    expect(delegationsDescription(true)).toMatch(/As SuperAdmin you may complete every stage personally/);
  });
});
