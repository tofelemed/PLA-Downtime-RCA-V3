import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView } from '@/api/v2/types/rca';
import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import type { RcaCaseReadinessView } from '@/api/v2/types/rca-workflow';
import { actAs } from '@/test/acting-user';
import { CaseWorkspaceContext } from './case-context';
import { workspaceOf } from './workspace-of';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CaseHeader } = await import('./case-header');
const { MoveControls } = await import('./workflow/move-controls');
const { DefinitionPage } = await import('./definition/definition-page');
const { CauseItem } = await import('./causes/cause-item');
const { ReevaluateNotice } = await import('./overview/reevaluate-notice');
const { AddLinkForm } = await import('../links/add-link-form');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const CASE: RcaCaseView = {
  id: 'c1', title: 'Gearbox trip', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Extruder stopped', teamMemberIds: [], rootCause: null, templateId: null, teamCharter: null,
  recommendations: [], evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
  createdBy: 'u-author', consequenceClass: null, residualRisk: null, closureRequestedBy: null, closureRequestedAt: null,
  closureApprovedBy: null, closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
};

const READINESS = {
  rcaId: 'c1', status: 'Analysis', next: [{ to: 'Monitoring', gates: ['investigation'] }],
  investigation: { blockers: [], advice: [] }, closure: { blockers: [], effectiveness: null },
  approver: { canApprove: true, reason: null }, linkedRecurrences: 0, rules: { fiveWhyGuidelineLevels: 5, consequenceClass: null },
} as unknown as RcaCaseReadinessView;

const CAUSE = {
  id: 'k1', rcaId: 'c1', kind: 'root', statement: 'Inspection plan missed contamination', causeCodeId: null, causeCode: null,
  evidenceIds: [], nodeIds: [], rowVersion: 1,
} as unknown as RcaCaseCauseView;

const REEVALUATE = {
  id: 'r1', eventId: 'e1', occurrenceId: null, unitId: 'u-1', trigger: 'reevaluate', source: { kind: 'rca', id: 'c1', version: 1 },
  firedOn: '2026-10-20', provisional: false, outcome: 'recommended', state: 'open', rcaId: 'c1', event: null, detail: {},
  firedAt: '2026-10-20T00:00:00Z', confirmedAt: null, resolvedAt: null,
};

function reply(path: string): unknown {
  if (path.endsWith('/links')) return [];
  if (path.endsWith('/outcome')) return { approvedHistoricalLoss: { lines: 0, quantities: [], values: [], basis: 'b' }, claimedAvoided: [], realized: [], note: '' };
  if (path.endsWith('/rca-recommendations')) return list([REEVALUATE]);
  return list([]);
}

let client: QueryClient;
function renderInCase(node: ReactNode, rca: RcaCaseView = CASE) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rca/c1']}>
        <CaseWorkspaceContext.Provider value={workspaceOf(rca, true)}>
          <Routes>
            <Route path="*" element={node} />
          </Routes>
        </CaseWorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The open dialog: its title, the secondary button before the primary one, and Esc closes it. */
async function expectDialog(title: string, primary: string, secondary = 'Cancel') {
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByRole('heading', { name: title })).toBeInTheDocument();
  const buttons = within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());
  expect(buttons.indexOf(secondary)).toBeGreaterThanOrEqual(0);
  expect(buttons.indexOf(secondary)).toBeLessThan(buttons.indexOf(primary));
  return dialog;
}

async function expectEscCloses() {
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

describe('RCA case shell dialogs: title, fields, buttons, Esc', () => {
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView ??= () => undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(reply(new URL(url).pathname))));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Delete investigation (header): destructive confirm, one-line description, Cancel focused, Esc closes', async () => {
    renderInCase(<CaseHeader />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await expectDialog('Delete this investigation?', 'Delete investigation');
    expect(within(dialog).getByRole('button', { name: 'Delete investigation' }).className).toMatch(/destructive/);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByText(/analysis records are deleted with it/)).toBeInTheDocument();
    await expectEscCloses();
  });

  it('Accept the investigation (workflow move): confirm names the move, Esc closes without moving', async () => {
    const fetch = vi.mocked(globalThis.fetch);
    renderInCase(<MoveControls readiness={READINESS} />);
    fireEvent.click(screen.getByTestId('workflow-move-monitoring'));
    const dialog = await expectDialog('Accept the investigation?', 'Accept the investigation');
    expect(within(dialog).getByRole('button', { name: 'Accept the investigation' })).toHaveFocus();
    await expectEscCloses();
    expect(fetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('workflow reason and residual risk: labelled textareas (3 rows) with their explanation behind ⓘ', () => {
    const closing = { ...READINESS, status: 'Monitoring', next: [{ to: 'Closure Review', gates: ['closure_request'] }, { to: 'Analysis', gates: ['note'] }] } as unknown as RcaCaseReadinessView;
    renderInCase(<MoveControls readiness={closing} />, { ...CASE, status: 'Monitoring' });
    expect(screen.getByLabelText('Residual risk (for the closure request)')).toHaveAttribute('rows', '3');
    expect(screen.getByLabelText('Reason (to go back, reject or reopen)')).toHaveAttribute('rows', '3');
    expect(screen.getByRole('button', { name: 'About Reason (to go back, reject or reopen)' })).toBeInTheDocument();
    expect(screen.queryByText(/Required for these moves/)).toBeNull();
  });

  it('Discard changes (definition): destructive confirm with "Keep editing", Esc keeps the edits', async () => {
    renderInCase(<DefinitionPage />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    const dialog = await expectDialog('Discard your changes?', 'Discard changes', 'Keep editing');
    expect(within(dialog).getByRole('button', { name: 'Discard changes' }).className).toMatch(/destructive/);
    await expectEscCloses();
    expect(screen.getByLabelText('Title')).toHaveValue('Edited title');
    const bar = screen.getByTestId('definition-save-bar');
    const order = within(bar).getAllByRole('button').map((button) => button.textContent);
    expect(order).toEqual(['Discard changes', 'Save investigation']);
  });

  it('Delete cause: destructive confirm naming the action, Esc closes', async () => {
    renderInCase(<CauseItem cause={CAUSE} canWrite onEdit={() => undefined} />);
    fireEvent.click(screen.getByTestId('delete-cause'));
    const dialog = await expectDialog('Delete this cause?', 'Delete cause');
    expect(within(dialog).getByRole('button', { name: 'Delete cause' }).className).toMatch(/destructive/);
    await expectEscCloses();
  });

  it('Dismiss re-evaluation (overview notice): required labelled Reason, confirm disabled until written, Esc closes', async () => {
    renderInCase(<ReevaluateNotice />, { ...CASE, status: 'Closed' });
    fireEvent.click(await screen.findByTestId('dismiss-recommendation'));
    const dialog = await expectDialog('Dismiss this recommendation?', 'Dismiss recommendation');
    expect(within(dialog).getByLabelText(/Reason/)).toHaveAttribute('rows', '3');
    expect(within(dialog).getByRole('button', { name: 'Dismiss recommendation' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Seasonal' } });
    expect(within(dialog).getByRole('button', { name: 'Dismiss recommendation' })).toBeEnabled();
    await expectEscCloses();
  });

  it('Add a link: labelled h-9 controls in one row; the Reason popover opens with its search and Esc closes it', async () => {
    renderInCase(<AddLinkForm rcaId="c1" />);
    expect(screen.getByRole('heading', { name: 'Add a link' })).toBeInTheDocument();
    expect(screen.getByLabelText('Link').className).toMatch(/h-9/);
    expect(screen.getByLabelText('Unit').className).toMatch(/h-9/);
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: /Reason/ }));
    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByPlaceholderText('Search code or name…')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Export menu (header): opens with its items and Esc closes it', async () => {
    renderInCase(<CaseHeader />);
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Evidence (CSV)' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Copy link to this investigation' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});
