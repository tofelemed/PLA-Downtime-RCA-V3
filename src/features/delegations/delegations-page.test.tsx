import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('Approval delegations wording (QA re-test 2026-10-19)', () => {
  it('tells only SuperAdmin that SuperAdmin may complete every stage', () => {
    expect(delegationsDescription(false)).not.toMatch(/SuperAdmin/);
    expect(delegationsDescription(true)).toMatch(/As SuperAdmin you may complete every stage personally/);
  });
});
