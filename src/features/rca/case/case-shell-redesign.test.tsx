import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';
import { CaseWorkspaceContext } from './case-context';
import { workspaceOf } from './workspace-of';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CaseNav } = await import('./case-nav');
const { CaseHeader } = await import('./case-header');
const { ClosedCaseNotice } = await import('./closed-case-notice');
const { OverviewPage } = await import('./overview/overview-page');
const { DefinitionPage } = await import('./definition/definition-page');
const { LinksPage } = await import('./links/links-page');
const { HistoryPage } = await import('./history/history-page');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const SHELL_CASE: RcaCaseView = {
  id: 'c1', title: 'Gearbox trip', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: 'u-lead',
  targetCloseDate: '2026-11-30', actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Extruder stopped for an hour', teamMemberIds: ['u-a'], rootCause: 'Inspection gap', templateId: null, teamCharter: 'Find why the gearbox tripped',
  recommendations: [], evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
  createdBy: 'u-author', consequenceClass: 'significant', residualRisk: null, closureRequestedBy: null, closureRequestedAt: null,
  closureApprovedBy: null, closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
};

const READINESS = {
  rcaId: 'c1', status: 'Analysis', next: [], investigation: { blockers: [], advice: [] }, closure: { blockers: [], effectiveness: null },
  approver: { canApprove: false, reason: null }, linkedRecurrences: 0, rules: { fiveWhyGuidelineLevels: 5, consequenceClass: 'significant' },
};
const LINK = {
  id: 'l1', rcaId: 'c1', linkType: 'event', targetId: 'e1', source: 'manual', reason: 'Approved availability loss of 28 t', linkedAt: '2026-10-18T14:20:00Z',
  evidence: { event: { start: '2026-10-17T04:30:00Z', physicalType: 'STOP' } },
};
const OUTCOME = {
  approvedHistoricalLoss: { lines: 0, quantities: [], values: [], basis: 'b' }, claimedAvoided: [], realized: [],
  note: 'Claimed avoided loss, approved historical loss and realized difference are separate figures; they are never added together.',
};
const HISTORY = {
  id: 'h1', at: '2026-10-18T14:41:00Z', action: 'rca_case.transitioned', entityType: 'rca_case', entityId: 'c1', actorId: 'u-a', actorName: 'Farid',
  service: null, reason: 'Ready for review', revision: 5, changedFields: ['status'], values: { status: { from: 'Monitoring', to: 'Closure Review' } },
  beforeHash: null, afterHash: null, detail: {},
};

function reply(path: string): unknown {
  if (path.endsWith('/readiness')) return READINESS;
  if (path.endsWith('/links')) return [LINK];
  if (path.endsWith('/outcome')) return OUTCOME;
  if (path.endsWith('/history')) return list([HISTORY]);
  if (path.endsWith('/analyses')) return { fiveWhy: null, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null };
  if (path.endsWith('/actions') || path.endsWith('/causes')) return [];
  return list([]);
}

let client: QueryClient;
function renderInCase(node: ReactNode, rca: RcaCaseView = SHELL_CASE, entry = '/rca/c1', canWrite = true) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <CaseWorkspaceContext.Provider value={workspaceOf(rca, canWrite)}>
          <Routes>
            <Route path="*" element={node} />
          </Routes>
        </CaseWorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CLOSED: RcaCaseView = { ...SHELL_CASE, status: 'Closed', actualCloseDate: '2026-10-18T14:41:00Z' };

describe('RCA case shell redesign', () => {
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(reply(new URL(url).pathname))));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tabs: one segmented row of six links, the active one marked', () => {
    renderInCase(<CaseNav />, SHELL_CASE, '/rca/c1/links');
    const nav = screen.getByRole('navigation', { name: 'Investigation sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(6);
    expect(screen.getByTestId('tab-links')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-links')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('tab-overview')).not.toHaveAttribute('aria-current');
  });

  it('header: one meta row with status, priority, unit, dates, trigger and approved loss; no timezone', async () => {
    renderInCase(<CaseHeader />);
    const meta = screen.getByTestId('case-meta');
    expect(within(meta).getByTestId('case-status')).toHaveTextContent('Analysis');
    expect(within(meta).getByText('High')).toBeInTheDocument();
    expect(await within(meta).findByTestId('case-trigger')).toBeInTheDocument();
    expect(within(meta).getByTestId('case-approved-loss')).toHaveTextContent('No approved loss yet');
    expect(meta.textContent).not.toMatch(/UTC|\+0[34]:/);
  });

  it('closed banner: one slim note with the lock, the short text and a link to the workflow', () => {
    renderInCase(<ClosedCaseNotice />, CLOSED, '/rca/c1/links');
    const notice = screen.getByTestId('closed-case-notice');
    expect(notice).toHaveTextContent('Closed investigation — reopen to change');
    expect(within(notice).getByRole('link', { name: 'Go to workflow' })).toHaveAttribute('href', '/rca/c1#rca-workflow');
  });

  it('overview: progress, definition and team in cards with workflow in the side column; no explanatory sentences', async () => {
    renderInCase(<OverviewPage />);
    const layout = screen.getByTestId('overview-layout');
    expect(within(layout).getByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(within(layout).getByRole('heading', { name: 'Definition' })).toBeInTheDocument();
    const side = within(layout).getByRole('complementary');
    expect(within(side).getByRole('heading', { name: 'Workflow' })).toBeInTheDocument();
    expect(within(side).getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(screen.queryByText(/What the investigation has so far/)).toBeNull();
    expect(screen.getByTestId('case-stepper').querySelector('[aria-current="step"]')).toHaveTextContent('Analysis');
    expect(screen.getByText('Find why the gearbox tripped')).toBeInTheDocument();
    expect(await screen.findByTestId('workflow-panel')).toBeInTheDocument();
  });

  it('overview: the fixed-team rule is behind the Team ⓘ, not a paragraph', () => {
    renderInCase(<OverviewPage />, { ...SHELL_CASE, status: 'Monitoring' });
    expect(screen.queryByText(/team is fixed until the investigation is reopened/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Team' })).toBeInTheDocument();
  });

  it('definition, read-only (closed): values as text, no inputs, Back to overview kept', () => {
    renderInCase(<DefinitionPage />, CLOSED, '/rca/c1/definition');
    const editor = screen.getByTestId('case-editor');
    expect(within(editor).queryByRole('textbox')).toBeNull();
    expect(within(editor).queryByRole('combobox')).toBeNull();
    expect(within(editor).getByText('Extruder stopped for an hour')).toBeInTheDocument();
    expect(within(editor).getByText('Inspection gap')).toBeInTheDocument();
    expect(within(screen.getByTestId('team-editor')).queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/rca/c1');
    expect(screen.queryByTestId('save-case')).toBeNull();
  });

  it('definition, writer on an open unlocked case: team lead and member selects are editable, Add member h-9', () => {
    renderInCase(<DefinitionPage />, SHELL_CASE, '/rca/c1/definition');
    const team = screen.getByTestId('team-editor');
    expect(team).toHaveAttribute('data-mode', 'edit');
    expect(within(team).getByRole('combobox', { name: 'Team lead' })).toBeEnabled();
    expect(within(team).getByRole('combobox', { name: 'Add a team member' })).toBeEnabled();
    expect(within(team).getByRole('button', { name: 'Add member' }).className).toMatch(/\bh-9\b/);
  });

  it('definition, editable: labelled inputs; field hints behind ⓘ instead of paragraphs', () => {
    renderInCase(<DefinitionPage />, SHELL_CASE, '/rca/c1/definition');
    expect(screen.getByLabelText('Title')).toHaveValue('Gearbox trip');
    expect(screen.getByLabelText('Team charter')).toHaveValue('Find why the gearbox tripped');
    expect(screen.getByLabelText('Root cause')).toHaveValue('Inspection gap');
    expect(screen.queryByText(/Mission, scope and goals of the investigation/)).toBeNull();
    expect(screen.queryByText(/automation never sets it/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Team charter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Root cause' })).toBeInTheDocument();
  });

  it('links & outcome: links in a compact table; work-order and outcome notes behind ⓘ', async () => {
    renderInCase(<LinksPage />, CLOSED, '/rca/c1/links');
    const row = await screen.findByTestId('link-row');
    expect(row.tagName).toBe('TR');
    expect(within(screen.getByTestId('links-tab')).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Link', 'Linked', 'Source', 'Reason', 'Evidence']);
    expect(screen.getByTestId('links-closed')).toHaveTextContent('reopen it to add a link');
    expect(screen.queryByText(/Work orders are referenced by their number/)).toBeNull();
    expect(await screen.findByTestId('outcome-panel')).toBeInTheDocument();
    expect(screen.queryByText(/they are never added together/)).toBeNull();
  });

  it('outcome ⓘ: only the server note when it sends one (no repeated rule); the short rule without a note', async () => {
    const view = renderInCase(<LinksPage />, CLOSED, '/rca/c1/links');
    await screen.findByTestId('outcome-panel');
    fireEvent.focus(screen.getByRole('button', { name: 'About Outcome' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe(OUTCOME.note);
    expect(screen.queryByText(/three separate figures/)).toBeNull();
    view.unmount();
    client.clear();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      return json(path.endsWith('/outcome') ? { ...OUTCOME, note: '' } : reply(path));
    }));
    renderInCase(<LinksPage />, CLOSED, '/rca/c1/links');
    await screen.findByTestId('outcome-panel');
    fireEvent.focus(screen.getByRole('button', { name: 'About Outcome' }));
    expect((await screen.findAllByText(/three separate figures, never added up/)).length).toBeGreaterThan(0);
  });

  it('links: an empty reason reads as a dash', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      return json(path.endsWith('/links') ? [{ ...LINK, reason: '' }] : reply(path));
    }));
    renderInCase(<LinksPage />, CLOSED, '/rca/c1/links');
    const row = await screen.findByTestId('link-row');
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^—$/);
  });

  it('history: entries in a compact table with when, by and the change', async () => {
    renderInCase(<HistoryPage />, SHELL_CASE, '/rca/c1/history');
    const entry = await screen.findByTestId('history-entry');
    expect(entry.tagName).toBe('TR');
    expect(within(screen.getByTestId('history-list')).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['When', 'By', 'Change']);
    expect(within(entry).getByTestId('history-reason')).toHaveTextContent('Ready for review');
  });
});
