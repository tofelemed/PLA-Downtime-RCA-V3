import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';
import type { WorkflowActions } from './hooks/use-workflow-actions';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { PeriodGrid } = await import('./components/period-grid');
const { PeriodNeighbourNav } = await import('./components/period-neighbour-nav');
const { StickyWorkflowBar } = await import('./workflow/sticky-workflow-bar');
const { WorkflowBar } = await import('./workflow/workflow-bar');
const { DetailToolbar } = await import('./components/detail-toolbar');

const PLAN = { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' };
const row = (periodId: string, utcStart: string, localDate: string) => ({ periodId, unitId: 'u1', utcStart, utcEnd: utcStart, localDate, shiftName: 'Day' });
const VIEW = {
  periodId: 'p2', unitId: 'u1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', baseRunId: 'run-1', contentHash: 'h', lines: [],
  publishedRevision: null, revision: { id: 'rev', revision: 3, lifecycle: 'draft', isStale: false, submittedBy: null, submittedHash: null },
} as unknown as ReconciliationView;

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe('period navigation, sticky workflow and month-lock wording (UX audit D-5, D-7, D-10)', () => {
  let urls: URL[];
  let client: QueryClient;
  let listReply: (url: URL) => unknown;
  const wrap = (node: ReactNode, path = '/plans/plan1') =>
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{node}<Location /></>} /></Routes></MemoryRouter></QueryClientProvider>);

  beforeEach(() => {
    urls = [];
    listReply = () => ({ items: [], nextCursor: null });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      if (!parsed.pathname.endsWith('/loss-accounting')) urls.push(parsed);
      return new Response(JSON.stringify(listReply(parsed)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('Manager', 'user-me');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('Go to date starts the server window at that plant date and keeps the date and state in the URL', async () => {
    wrap(<PeriodGrid unitId="u1" from={PLAN.from} to={PLAN.to} timezone="UTC" onOpen={() => undefined} />, '/plans/plan1?state=draft');
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0].searchParams.get('from')).toBe(PLAN.from);
    expect(urls[0].searchParams.getAll('workflowState')).toEqual(['draft']);
    fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '2026-10-12' } });
    await waitFor(() => expect(urls.some((u) => u.searchParams.get('from') === '2026-10-12T00:00:00.000Z')).toBe(true));
    expect(screen.getByTestId('location')).toHaveTextContent('/plans/plan1?state=draft&date=2026-10-12');
    fireEvent.click(screen.getByTestId('grid-date-clear'));
    expect(screen.getByTestId('location')).toHaveTextContent('/plans/plan1?state=draft');
  });

  it('previous / next link to the neighbouring periods from the server list, same section and selection', async () => {
    listReply = (url) => (url.searchParams.get('sort') === '-utcStart'
      ? { items: [row('p1', '2026-10-07T22:00:00.000Z', '2026-10-07')], nextCursor: 'more' }
      : { items: [row('p3', '2026-10-08T14:00:00.000Z', '2026-10-08')], nextCursor: null });
    wrap(<PeriodNeighbourNav planId="plan1" period={VIEW} plan={PLAN} section="review" search="?view=approved" />);
    await waitFor(() => expect(screen.getByTestId('period-next')).toHaveAttribute('href', '/plans/plan1/periods/p3/review?view=approved'));
    expect(screen.getByTestId('period-previous')).toHaveAttribute('href', '/plans/plan1/periods/p1/review?view=approved');
    const next = urls.find((u) => u.searchParams.get('sort') === null);
    expect(next?.searchParams.get('from')).toBe(VIEW.utcEnd);
    expect(next?.searchParams.getAll('unitIds')).toEqual(['u1']);
    const previous = urls.find((u) => u.searchParams.get('sort') === '-utcStart');
    expect(previous?.searchParams.get('limit')).toBe('1');
    expect(previous?.searchParams.get('from')).toBe(PLAN.from);
    expect(previous?.searchParams.get('to')).toBe(VIEW.utcStart);
  });

  it('without a neighbour the link is shown disabled', async () => {
    wrap(<PeriodNeighbourNav planId="plan1" period={VIEW} plan={PLAN} section="" search="" />);
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(screen.getByTestId('period-next')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('period-previous')).not.toHaveAttribute('href');
  });

  describe('sticky workflow bar', () => {
    const actions = (patch: Partial<WorkflowActions> = {}) => ({ pending: null, problem: null, recomputeState: null, submit: vi.fn(async () => true), ...patch }) as unknown as WorkflowActions;

    it('shows the lifecycle, submits from any section and surfaces the recompute state (L4)', () => {
      const shared = actions({ recomputeState: 'running' });
      wrap(<StickyWorkflowBar view={VIEW} actions={shared} reviewHref="/plans/plan1/periods/p2/review" unsavedLines={false} compact={false} />);
      expect(screen.getByTestId('sticky-lifecycle')).toHaveTextContent('Revision 3 · Draft');
      expect(screen.getByTestId('sticky-recompute-state')).toHaveTextContent('Recomputing…');
      fireEvent.click(screen.getByTestId('sticky-submit'));
      expect(shared.submit).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('sticky-review-link')).toHaveAttribute('href', '/plans/plan1/periods/p2/review');
    });

    it('disables Submit with the blocking reasons', () => {
      wrap(<StickyWorkflowBar view={{ ...VIEW, baseRunId: null }} actions={actions()} reviewHref={null} unsavedLines compact={false} />);
      const submit = screen.getByTestId('sticky-submit');
      expect(submit).toBeDisabled();
      expect(submit).toHaveAttribute('aria-describedby', 'sticky-submit-blockers');
      expect(screen.getByTestId('disabled-reason')).toHaveTextContent('Not calculated yet: recompute first. Unsaved loss-line changes');
    });

    it('in Review & close (compact) it keeps only the state, and a viewer never gets Submit', () => {
      const first = wrap(<StickyWorkflowBar view={VIEW} actions={actions()} reviewHref={null} unsavedLines={false} compact />);
      expect(screen.queryByTestId('sticky-submit')).toBeNull();
      first.unmount();
      actAs('viewer');
      wrap(<StickyWorkflowBar view={VIEW} actions={actions()} reviewHref={null} unsavedLines={false} compact={false} />);
      expect(screen.queryByTestId('sticky-submit')).toBeNull();
    });
  });

  it('an approved period offers "Reopen for revision…", not "Unlock" (D-7)', () => {
    const approved = { ...VIEW, revision: { ...VIEW.revision, lifecycle: 'approved' } } as ReconciliationView;
    wrap(<WorkflowBar view={approved} shown="current" onShowCurrent={() => undefined} />);
    expect(screen.getByTestId('wf-revise')).toHaveTextContent('Reopen for revision…');
    expect(screen.queryByText(/Unlock/)).toBeNull();
  });

  it('the disabled Approved view says why (D-13)', () => {
    wrap(<DetailToolbar view="current" onView={() => undefined} ledger="plan" onLedger={() => undefined} canShowApproved={false} />);
    expect(screen.getByTestId('view-approved')).toBeDisabled();
    expect(screen.getByTestId('view-approved')).toHaveAttribute('aria-describedby', 'view-approved-reason');
    expect(screen.getByTestId('disabled-reason')).toHaveTextContent('No approved revision yet');
  });
});
