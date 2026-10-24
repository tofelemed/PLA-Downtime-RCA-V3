import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView, RcaEvidenceItem } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const query = vi.hoisted(() => ({ rca: null as RcaCaseView | null }));
vi.mock('@/api/v2/queries/rca-cases', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/rca-cases')>()),
  useRcaCase: () => ({ data: query.rca, isLoading: false, isError: false }),
  useRcaActions: () => ({ data: [], isLoading: false, isError: false }),
}));

const { CaseWorkspacePage } = await import('../case-workspace-page');

const ITEM: RcaEvidenceItem = {
  id: 'ev-1', title: 'Vibration trend', description: 'Rising vibration before the trip', type: 'Document', source: 'P101.VIB', collectedAt: null,
  collectedBy: null, category: null, location: null, occurredAt: null, assetId: null, severity: 'High', tags: ['pump'], verified: false,
  fiveP: 'Parts', task: 'Export the trend', taskDueDate: null, taskStatus: 'pending', taskAssigneeId: null, verifiedBy: null, verifiedAt: null,
  nodeIds: [], timeSeries: null, attachments: [],
};
const CASE = {
  id: 'c1', title: 'Extruder vibration', status: 'Draft', priority: 'High', unitId: 'u1', assetId: null, teamLeadId: null, targetCloseDate: null,
  actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4, description: null, teamMemberIds: [],
  rootCause: null, templateId: null, teamCharter: null, recommendations: [], evidence: [ITEM], logicTree: [], eventDiagram: { nodes: [], edges: [] },
  createdBy: 'author', consequenceClass: 'minor', residualRisk: null, closureRequestedBy: null, closureRequestedAt: null, closureApprovedBy: null,
  closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
} as unknown as RcaCaseView;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

let client: QueryClient;
const app = (path: string) => (
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route path="/rca/:caseId/*" element={<CaseWorkspacePage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  query.rca = structuredClone(CASE);
  actAs('SuperAdmin', 'writer');
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  configureV2Session({ getAccessToken: () => 'token', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
    const path = new URL(input).pathname;
    if (init.method === 'PATCH') {
      query.rca = { ...query.rca!, ...JSON.parse(String(init.body)), rowVersion: query.rca!.rowVersion + 1 };
      return json(200, query.rca);
    }
    if (path.endsWith('/readiness')) return json(200, { rcaId: 'c1', status: 'Draft', next: [], investigation: { blockers: [], advice: [] }, closure: { blockers: [], effectiveness: null }, approver: { canApprove: false, reason: null }, linkedRecurrences: 0, rules: { fiveWhyGuidelineLevels: 5, consequenceClass: 'minor' } });
    if (path.endsWith('/links')) return json(200, []);
    return json(200, { items: [], nextCursor: null });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.clear();
});

describe('evidence list (RCA detail redesign)', () => {
  it('sits in a card with its count, a labelled search and type counts that do not wrap', async () => {
    render(app('/rca/c1/evidence'));
    const card = await screen.findByTestId('evidence-card');
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
    expect(within(card).getByRole('heading', { level: 2, name: 'Evidence' })).toBeInTheDocument();
    expect(within(card).getByTestId('card-count')).toHaveTextContent('1');
    const search = within(card).getByLabelText('Search evidence');
    expect(search).toHaveClass('h-9');
    const byType = within(card).getByLabelText('Evidence by type');
    expect(within(byType).getByText(/Document/)).toHaveClass('whitespace-nowrap');
    expect(within(card).getByTestId('evidence-list')).toHaveTextContent('Vibration trend');
  });

  it('keeps its own empty message with the add action when nothing is collected', async () => {
    query.rca = { ...structuredClone(CASE), evidence: [] };
    render(app('/rca/c1/evidence'));
    const empty = await screen.findByTestId('own-empty');
    expect(empty).toHaveTextContent('Nothing collected yet.');
    expect(within(empty).getByRole('link', { name: /Add evidence/ })).toHaveAttribute('href', '/rca/c1/evidence/new');
    expect(screen.queryByText('No data for these dates')).toBeNull();
  });

  it('offers to clear a search that finds nothing', async () => {
    render(app('/rca/c1/evidence'));
    fireEvent.change(await screen.findByLabelText('Search evidence'), { target: { value: 'zzz' } });
    const empty = await screen.findByTestId('own-empty');
    expect(empty).toHaveTextContent('No evidence matches the search.');
    fireEvent.click(within(empty).getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(screen.getByTestId('evidence-list')).toHaveTextContent('Vibration trend'));
  });
});

describe('evidence detail (RCA detail redesign)', () => {
  it('renders the values as text in definition lists, with the request in a side card', async () => {
    render(app('/rca/c1/evidence/ev-1'));
    const detail = await screen.findByTestId('evidence-detail');
    expect(detail.tagName).toBe('DL');
    expect(within(detail).getByText('Source').tagName).toBe('DT');
    expect(within(detail).getByText('P101.VIB').tagName).toBe('DD');
    expect(within(detail).getByText('Category').nextElementSibling).toHaveTextContent('Not recorded');
    const request = screen.getByTestId('evidence-request-card');
    expect(within(request).getByRole('heading', { level: 2, name: 'Evidence request' })).toBeInTheDocument();
    expect(within(request).getByText('Export the trend')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('link', { name: /All evidence/ })).toHaveAttribute('href', '/rca/c1/evidence');
  });

  it('delete confirm: title, buttons, Esc closes without deleting', async () => {
    render(app('/rca/c1/evidence/ev-1'));
    fireEvent.click(await within(await screen.findByTestId('evidence-detail-card')).findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Delete this evidence?' })).toBeInTheDocument();
    const buttons = within(dialog).getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Cancel', 'Delete evidence']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(query.rca?.evidence).toHaveLength(1);
  });

  it('delete confirm removes the item and returns to the list', async () => {
    render(app('/rca/c1/evidence/ev-1'));
    fireEvent.click(await within(await screen.findByTestId('evidence-detail-card')).findByRole('button', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete evidence' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/rca/c1/evidence'));
    expect(query.rca?.evidence).toHaveLength(0);
  });

  it('read-only: no edit or delete', async () => {
    actAs('viewer');
    render(app('/rca/c1/evidence/ev-1'));
    await screen.findByTestId('evidence-detail');
    expect(within(screen.getByTestId('evidence-detail-card')).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Edit/ })).toBeNull();
  });
});

describe('closed investigation (evidence pages)', () => {
  const closed = () => ({ ...structuredClone(CASE), status: 'Closed', actualCloseDate: '2026-10-18T14:41:00Z' } as RcaCaseView);

  it('list: the evidence as rows, with no Add evidence', async () => {
    query.rca = closed();
    render(app('/rca/c1/evidence'));
    const card = await screen.findByTestId('evidence-card');
    expect(within(card).getByTestId('evidence-list')).toHaveTextContent('Vibration trend');
    expect(screen.queryByTestId('add-evidence')).toBeNull();
    expect(screen.queryByRole('link', { name: /Add evidence/ })).toBeNull();
  });

  it('detail: values as text with no Edit or Delete', async () => {
    query.rca = closed();
    render(app('/rca/c1/evidence/ev-1'));
    expect(await screen.findByTestId('evidence-detail')).toHaveTextContent('P101.VIB');
    expect(screen.queryByRole('link', { name: /Edit evidence/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('evidence form (RCA detail redesign)', () => {
  it('labels above h-9 controls and a footer with Cancel left of the primary', async () => {
    render(app('/rca/c1/evidence/new'));
    const form = await screen.findByTestId('evidence-form');
    expect(within(form).getByLabelText(/^Title/)).toHaveClass('h-9');
    expect(within(form).getByLabelText(/^Source/)).toHaveClass('h-9');
    expect(within(form).getByLabelText('Description')).toHaveAttribute('rows', '3');
    const footer = within(form).getByTestId('form-footer');
    expect(within(footer).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Add evidence']);
  });

  it('date and time fields are compact (h-9) in the evidence form and the historian query', async () => {
    const series = { streams: 'P101.VIB', mode: 'summary', start: '2026-10-01T06:00:00.000Z', end: '2026-10-01T08:00:00.000Z', interval: null, intervals: 12, summaryTypes: 'max' };
    query.rca = { ...structuredClone(CASE), evidence: [{ ...ITEM, type: 'Time Series', timeSeries: series } as unknown as RcaEvidenceItem] };
    render(app('/rca/c1/evidence/ev-1/edit'));
    const form = await screen.findByTestId('evidence-form');
    for (const label of ['Observed at', 'From', 'To']) {
      expect(within(form).getByLabelText(`${label} date`)).toHaveClass('h-9');
      expect(within(form).getByLabelText(`${label} time`)).toHaveClass('h-9');
    }
  });

  it('shows the title validation under the field once it is left empty', async () => {
    render(app('/rca/c1/evidence/new'));
    const title = await screen.findByLabelText(/^Title/);
    expect(screen.queryByTestId('field-error-ev-title')).toBeNull();
    fireEvent.blur(title);
    expect(screen.getByTestId('field-error-ev-title')).toHaveTextContent('Enter a title.');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('save-evidence')).toBeDisabled();
  });

  it('saves a new item and opens it', async () => {
    render(app('/rca/c1/evidence/new'));
    fireEvent.change(await screen.findByLabelText(/^Title/), { target: { value: 'Seal photo' } });
    fireEvent.click(screen.getByTestId('save-evidence'));
    await waitFor(() => expect(query.rca?.evidence).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/rca\/c1\/evidence\/ev-/));
  });
});

describe('evidence form leave confirm (app unsaved-changes dialog)', () => {
  it('asks before a tab link drops typed input: title, buttons, Esc stays on the form', async () => {
    const { UnsavedChangesDialogHost } = await import('@/features/ux-kit/unsaved-changes-dialog-host');
    render(
      <>
        <UnsavedChangesDialogHost />
        {app('/rca/c1/evidence/new')}
      </>,
    );
    fireEvent.change(await screen.findByLabelText(/^Title/), { target: { value: 'Half typed' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Investigation sections' })).getByRole('link', { name: /Overview/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Leave this page?' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Stay on this page', 'Leave and discard']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Half typed');
    expect(screen.getByTestId('location')).toHaveTextContent('/rca/c1/evidence/new');
  });
});
