import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';
import type { RcaActionBaseline } from '@/api/v2/types/rca-workflow';
import type { PagerModel } from '@/features/ux-kit/data-table/pager-model';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { CaseWorkspaceContext } from './case/case-context';
import { noConnectionsText } from './case/analysis/tools/event-diagram/diagram-model';
import { EMPTY_CASE_FILTERS } from './model/case-filters';
import { fieldChangeText, itemChangesOf } from './model/history-item-changes';
import { historyTotalOf, withTotal } from './model/history-pager';
import { runHourPolicyNote } from './model/policy-drift';
import { criteriaSourceText } from './model/rca-labels';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CaseTable } = await import('./pages/case-table');
const { MyRcaActionsList } = await import('./actions/my-rca-actions-list');
const { HistoryPage } = await import('./case/history/history-page');
const { EventDiagramTool } = await import('./case/analysis/tools/event-diagram/event-diagram-tool');
const { ActionBaseline } = await import('./actions/action-baseline');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[], extra: Record<string, unknown> = {}) => ({ items, nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' }, ...extra });

const CASE = {
  id: 'c1', title: 'Gearbox failure', status: 'Closed', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null, targetCloseDate: null,
  actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 22,
  eventDiagram: { nodes: [{ id: 'n1', label: 'Oil low', position: { x: 0, y: 0 } }], edges: [] },
} as unknown as RcaCaseView;

const BASELINE = {
  metric: 'recurrences', windowDays: 90, value: '2', declared: false, computedAt: '2026-10-17T10:00:00Z',
  criteria: { requiredReduction: 0.5, minExposureHours: 720, minimumCoverage: 0.95, zeroRepeat: false },
} as unknown as RcaActionBaseline;

const action = (patch: Partial<RcaActionView>): RcaActionView => ({ id: 'a1', baseline: BASELINE, baselinePolicyVersion: 1, ...patch }) as RcaActionView;

describe('RCA QA re-test round 3', () => {
  let urls: URL[];
  let routes: Record<string, unknown>;
  let client: QueryClient;
  const wrap = (node: ReactNode, readOnly = false) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseWorkspaceContext.Provider value={{ rca: CASE, readOnly, canWrite: true, closed: readOnly, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    urls = [];
    routes = { '/users/directory': list([]), '/units': list([{ id: 'u-1', name: 'Unit 100' }]) };
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      const hit = Object.entries(routes).find(([suffix]) => parsed.pathname.endsWith(suffix));
      return json(hit ? hit[1] : list([]));
    }));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('M3: one value-basis label from the valuation vocabulary, and the server basis as a capitalised sentence', () => {
    expect(valueBasisLabel('contribution_margin')).toBe('Value basis: Contribution margin');
    expect(valueBasisLabel('economic_impact', 'at link time')).toBe('Value basis: Economic impact (lost sales + incremental costs) (at link time)');
    expect(basisSentence('approved plan lines of approved periods.')).toBe('Approved plan lines of approved periods.');
  });

  it('L1: the list Trigger column names the stop', async () => {
    routes['/rcas'] = list([{ ...CASE, status: 'Analysis', trigger: { eventId: 'e1', startTime: '2026-10-17T04:30:00Z', unitId: 'u-1' }, actions: { total: 0, done: 0, overdue: 0 } }]);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseTable filters={EMPTY_CASE_FILTERS} empty={{ text: 'none' }} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const trigger = await screen.findByTestId('case-trigger');
    expect(trigger.textContent).toMatch(/^Stop \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it('L8: list-field changes name the item and its fields; older entries say the item was not recorded', () => {
    const entry = { detail: { itemChanges: { evidence: [{ item: 'Oil sample', change: 'edited', fields: ['taskStatus', 'occurredAt'] }, { item: 'Photo', change: 'added', fields: [] }] } } };
    expect(itemChangesOf(entry, 'evidence')).toHaveLength(2);
    expect(fieldChangeText(entry, 'evidence', 'Evidence')).toBe('Evidence: “Oil sample” edited (request status, observed time); “Photo” added');
    expect(fieldChangeText({ detail: {} }, 'evidence', 'Evidence')).toBe('Evidence (which item changed was not recorded)');
    expect(fieldChangeText({ detail: {} }, 'title', 'Title')).toBe('Title');
  });

  it('L8: the pager names the total on the first page from the server count', async () => {
    const pager = { pageIndex: 0, pageSize: 20, totalCount: null, pageCount: null } as PagerModel;
    expect(withTotal(pager, historyTotalOf([{ totalCount: 43 }]))).toMatchObject({ totalCount: 43, pageCount: 3 });
    expect(historyTotalOf([{}])).toBeNull();
    routes['/rcas/c1/history'] = {
      ...list([{ id: 'h1', at: '2026-10-05T08:00:00Z', action: 'rca_case.updated', entityType: 'rca_case', entityId: 'c1', actorId: null, actorName: 'Farid', service: null, reason: null, revision: 3, changedFields: ['evidence'], values: {}, beforeHash: 'a', afterHash: 'b', detail: { itemChanges: { evidence: [{ item: 'Oil sample', change: 'edited', fields: ['verified'] }] } } }]),
      nextCursor: 'next',
      totalCount: 43,
    };
    wrap(<HistoryPage />);
    const [entry] = await screen.findAllByTestId('history-entry');
    expect(within(entry).getByTestId('history-fields').textContent).toBe('Changed: Evidence: “Oil sample” edited (verified)');
    await waitFor(() => expect(screen.getByText(/of 43/)).toBeInTheDocument());
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('L11: the thresholds name the policy version the server reports for an older baseline', () => {
    expect(criteriaSourceText(1)).toBe('Thresholds frozen from RCA policy v1 when the verification was planned.');
    wrap(<ActionBaseline action={action({ baseline: BASELINE, baselinePolicyVersion: 1 })} />);
    expect(screen.getByTestId('baseline-criteria-source').textContent).toBe('Thresholds frozen from RCA policy v1 when the verification was planned.');
  });

  it('M7: residual-risk note when the current run-hour minimum differs from the frozen one', () => {
    const current = { version: 2, effectiveness: { minExposureHours: 600 } };
    expect(runHourPolicyNote([action({})], current)).toBe(
      "The actions' thresholds were frozen from RCA policy v1 (at least 720 run hours after an action). The current policy v2 asks for at least 600 run hours; it applies to new baselines.",
    );
    expect(runHourPolicyNote([action({})], { version: 1, effectiveness: { minExposureHours: 720 } })).toBeNull();
    expect(runHourPolicyNote([action({ baseline: null })], current)).toBeNull();
    expect(runHourPolicyNote([action({ baselinePolicyVersion: null })], current)).toContain('the RCA policy in force when their verification was planned');
  });

  it('L6 / N2: a read-only diagram has no how-to-connect hint and no interactivity toggle; the attribution stays', () => {
    expect(noConnectionsText(true)).toBe('No connections recorded.');
    expect(noConnectionsText(false)).toContain('Add connection');
    const { container } = wrap(<EventDiagramTool />, true);
    expect(screen.getByTestId('diagram-no-connections').textContent).toBe('No connections recorded.');
    expect(container.querySelector('.react-flow__controls-interactive')).toBeNull();
    expect(container.querySelector('.react-flow__attribution')).not.toBeNull();
  });

  it('L6: an editable diagram keeps the hint and the interactivity toggle', () => {
    const { container } = wrap(<EventDiagramTool />, false);
    expect(screen.getByTestId('diagram-no-connections').textContent).toContain('Add connection');
    expect(container.querySelector('.react-flow__controls-interactive')).not.toBeNull();
  });

  it('L16: MyRcaActionsList offers a Status filter when embedded with statusFilter', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MyRcaActionsList mine statusFilter status="done" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('owner-action-status')).toHaveTextContent('Done');
    await waitFor(() => expect(urls.find((url) => url.pathname.endsWith('/rca-actions'))?.searchParams.getAll('status')).toEqual(['done']));
  });

  it('L16: without statusFilter (or with overdue) there is no filter', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MyRcaActionsList overdue statusFilter />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId('owner-action-status')).toBeNull();
  });
});
