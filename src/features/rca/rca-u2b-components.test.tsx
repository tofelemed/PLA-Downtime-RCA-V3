import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { EMPTY_CASE_FILTERS } from './model/case-filters';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CaseSummary } = await import('./pages/case-summary');
const { CaseTable } = await import('./pages/case-table');
const { CaseStepper } = await import('./case/overview/case-stepper');
const { EventRcaChip } = await import('./components/event-rca-chip');
const { ConnectionDialog } = await import('./case/analysis/tools/event-diagram/connection-dialog');
const { TaskOverdueBadge } = await import('./case/evidence/task-overdue-badge');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });

describe('RCA U2b components', () => {
  let routes: Record<string, unknown>;
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    routes = {};
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const hit = Object.entries(routes).find(([suffix]) => path.endsWith(suffix));
      return json(hit ? hit[1] : list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('F-12: the summary counts are toggle buttons that filter the list', async () => {
    routes['/rcas/summary'] = { total: 7, open: 5, overdue: 2, critical: 1, overdueActions: 0, effectivenessPending: 0, byStatus: [{ status: 'Analysis', count: 3 }, { status: null, count: 1 }], asOf: 'x' };
    const onPick = vi.fn();
    wrap(<CaseSummary filters={{ ...EMPTY_CASE_FILTERS, due: 'overdue' }} onPick={onPick} />);
    const overdue = await screen.findByRole('button', { name: 'Overdue: 2' });
    expect(overdue).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All investigations: 7' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Analysis: 3' }));
    expect(onPick).toHaveBeenCalledWith({ kind: 'status', status: 'Analysis' });
    expect(screen.getByText('No status: 1').tagName).toBe('SPAN');
  });

  it('F-12: the case list names the team lead', async () => {
    routes['/rcas'] = list([{ id: 'c1', title: 'Pump trips', status: 'Analysis', priority: 'High', unitId: null, assetId: null, teamLeadId: 'u2', targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 1, trigger: null, actions: { total: 0, done: 0, overdue: 0 } }]);
    routes['/users/directory'] = list([{ id: 'u2', name: 'Sara Karimi' }]);
    wrap(<CaseTable filters={EMPTY_CASE_FILTERS} empty={{ text: 'none' }} />);
    expect(await screen.findByRole('columnheader', { name: 'Lead' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Sara Karimi')).toBeInTheDocument());
  });

  it('F-4: the stepper marks the current stage for assistive technology and lists the checklist', () => {
    const steps = [{ key: 'definition', label: 'Definition', done: true, hint: 'ok' }];
    render(<CaseStepper status="Published" steps={steps} />);
    const stages = within(screen.getByRole('navigation', { name: 'Investigation stages' })).getAllByRole('listitem');
    expect(stages).toHaveLength(6);
    const current = stages.find((stage) => stage.getAttribute('aria-current') === 'step');
    expect(current?.textContent).toContain('Analysis');
    expect(stages[0].textContent).toContain('(done)');
    expect(screen.getByTestId('case-progress').textContent).toContain('Definition');
  });

  it('G-4: the event RCA chip links a case and names a recommendation', () => {
    const view = wrap(<EventRcaChip rcaState="completed" caseId="c9" />);
    expect(screen.getByTestId('event-rca-chip')).toHaveAttribute('href', '/rca/c9');
    expect(screen.getByTestId('event-rca-chip').textContent).toContain('RCA completed');
    view.unmount();
    const second = wrap(<EventRcaChip rcaState="required" />);
    expect(screen.getByTestId('event-rca-chip').textContent).toBe('RCA recommended');
    second.unmount();
    const { container } = wrap(<EventRcaChip rcaState="none" />);
    expect(container.textContent).toBe('');
  });

  it('F-10: "Add connection" connects two different events from the keyboard', () => {
    const node = (id: string, label: string) => ({ id, label, type: null, timestamp: null, description: null, asset: null, severity: null, position: { x: 0, y: 0 } });
    const diagram: RcaEventDiagram = { nodes: [node('n1', 'Alarm'), node('n2', 'Trip')], edges: [] };
    const onAdd = vi.fn();
    render(<ConnectionDialog diagram={diagram} onAdd={onAdd} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/From \(cause\)/), { target: { value: 'n1' } });
    fireEvent.change(screen.getByLabelText(/To \(effect\)/), { target: { value: 'n1' } });
    expect(screen.getByRole('alert').textContent).toBe('Choose two different events.');
    expect(screen.getByTestId('save-connection')).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/To \(effect\)/), { target: { value: 'n2' } });
    fireEvent.click(screen.getByTestId('save-connection'));
    expect(onAdd).toHaveBeenCalledWith('n1', 'n2');
  });

  it('F-11: an evidence task past its due day and not completed is marked overdue', () => {
    const inClient = (node: ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
    const view = render(inClient(<TaskOverdueBadge item={{ taskDueDate: '2020-01-01T00:00:00.000Z', taskStatus: 'pending' }} />));
    expect(screen.getByTestId('evidence-task-overdue').textContent).toBe('Overdue');
    view.rerender(inClient(<TaskOverdueBadge item={{ taskDueDate: '2020-01-01T00:00:00.000Z', taskStatus: 'completed' }} />));
    expect(screen.queryByTestId('evidence-task-overdue')).toBeNull();
  });
});
