import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { PlanVersionView } from '@/api/v2/types/plans';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { VersionActions } = await import('./profiles/version-actions');
const { OpenVersionActions } = await import('./plans/open-version-actions');
const { CrewRotationEditor } = await import('./calendars/crew-rotation-editor');
const { PlansTab } = await import('./plans/plans-tab');

const VERSION = {
  id: 'v1', planId: 'plan-1', version: 1, unitId: 'u1', validFrom: '2026-11-01T02:30:00.000Z', validTo: '2026-11-02T02:30:00.000Z', basis: 'quantity',
  headerTarget: '1000', distribution: 'scheduled_capacity', approvalState: 'draft', periodsGeneratedAt: null, generationError: null, rowVersion: 3, slices: [],
} as unknown as PlanVersionView;

describe('planning screens show only the controls the role can use (owner decision 2026-10-12)', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );
  const openVersion = (version: PlanVersionView = VERSION) =>
    wrap(<OpenVersionActions version={version} timezone="UTC" productName={() => 'P'} onGenerated={() => undefined} />);

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('canWritePlans: an engineer edits and generates but cannot approve; an operator sees neither', () => {
    actAs('Engineer');
    openVersion();
    expect(screen.getByTestId('plan-edit')).toBeTruthy();
    expect(screen.getByTestId('plan-generate')).toBeTruthy();
    expect(screen.queryByTestId('approve-plan-submit')).toBeNull();
    actAs('Operator');
    openVersion();
    expect(screen.getAllByTestId('open-version-actions')).toHaveLength(2);
    expect(screen.getAllByTestId('plan-edit')).toHaveLength(1);
  });

  it('canApprovePlans: a manager approves; the author of the version gets the separation-of-duties tooltip', () => {
    actAs('Manager', 'me');
    openVersion();
    expect(screen.getByTestId('approve-plan-submit').hasAttribute('disabled')).toBe(false);
    openVersion({ ...VERSION, createdBy: 'me' });
    const disabled = screen.getAllByTestId('approve-plan-submit')[1];
    expect(disabled.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('sod-disabled').getAttribute('title')).toMatch(/separation of duties/);
  });

  it('SuperAdmin approves their own plan and profile drafts', () => {
    actAs('SuperAdmin', 'me');
    openVersion({ ...VERSION, createdBy: 'me' });
    expect(screen.getByTestId('approve-plan-submit').hasAttribute('disabled')).toBe(false);
    wrap(<VersionActions resource="profiles" id="p1" state="draft" authorId="me" timezone="UTC" />);
    expect(screen.getByTestId('approve-version').hasAttribute('disabled')).toBe(false);
    expect(screen.queryByTestId('sod-disabled')).toBeNull();
  });

  it('canApproveProfiles / canWriteProfiles: a master-data admin edits drafts, never approves or retires', () => {
    actAs('master_data_admin');
    wrap(<VersionActions resource="profiles" id="p1" state="draft" timezone="UTC" onEdit={() => undefined} />);
    expect(screen.getByText('Edit draft')).toBeTruthy();
    expect(screen.queryByTestId('approve-version')).toBeNull();
    expect(screen.queryByText('Retire')).toBeNull();
  });

  it('a manager approves and retires a rate; an engineer sees no rate action at all', () => {
    actAs('Manager');
    wrap(<VersionActions resource="rates" id="r1" state="draft" timezone="UTC" testId="as-manager" />);
    expect(screen.getByTestId('approve-version')).toBeTruthy();
    expect(screen.getByText('Retire')).toBeTruthy();
    actAs('Engineer');
    wrap(<VersionActions resource="rates" id="r1" state="draft" timezone="UTC" testId="as-engineer" />);
    expect(screen.queryByTestId('as-engineer')).toBeNull();
  });

  it('canWriteCalendars: crews are added by master-data admins, not by engineers', () => {
    actAs('master_data_admin');
    wrap(<CrewRotationEditor siteId="s1" timezone="UTC" />);
    expect(screen.getByTestId('crew-add')).toBeTruthy();
    actAs('production_engineer');
    wrap(<CrewRotationEditor siteId="s1" timezone="UTC" />);
    expect(screen.getAllByTestId('crew-add')).toHaveLength(1);
  });

  it('a viewer gets the Read-only hint instead of "New plan"', () => {
    actAs('viewer');
    wrap(<PlansTab />);
    expect(screen.queryByTestId('plan-new')).toBeNull();
    expect(screen.getByTestId('read-only-hint')).toBeTruthy();
  });
});
