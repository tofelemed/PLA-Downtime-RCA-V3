import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { RepairEvidenceView, WorkOrderOperationView } from '@/api/v2/types/reliability';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { WorkOrdersPage } = await import('./work-orders-page');
const { RepairEvidencePanel } = await import('./repair-evidence-panel');

const OPERATION: WorkOrderOperationView = {
  id: 'o1', workOrderId: '4000123', operationId: '0020', unitId: 'u1', assetId: null, eventId: 'e1', kind: 'repair', description: null,
  startedAt: '2026-10-01T10:00:00.000Z', endedAt: '2026-10-01T12:00:00.000Z', waitingSeconds: 1800, waitingReason: 'Seal kit from store', source: 'SAP PM',
};
const EVIDENCE: RepairEvidenceView = {
  eventId: 'e1', operations: 3, activeOperations: 3, openOperations: 0, waitingSeconds: 1800, activeRepairSeconds: 10800,
  repairStart: '2026-10-01T09:00:00.000Z', repairEnd: '2026-10-01T12:30:00.000Z', reason: null,
};

const wrap = (node: ReactNode, entry = '/') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('Work-order operations (SME D10)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('lists the operations of one stop from the URL and imports a CMMS export', async () => {
    const calls = stubV2Fetch((call: V2Call) => {
      if (call.url.pathname.endsWith('/work-order-operations/import')) return jsonResponse(200, { total: 1, created: 1, updated: 0, linked: 1 });
      if (call.url.pathname.endsWith('/work-order-operations')) return jsonResponse(200, listPage([OPERATION]));
      return undefined;
    });
    actAs('reliability_engineer');
    wrap(<WorkOrdersPage />, '/master-data/work-orders?eventId=e1');
    const table = await screen.findByRole('table', { name: 'Work-order operations' });
    await waitFor(() => expect(within(table).getByText('4000123 / 0020')).toBeInTheDocument());
    expect(within(table).getByText(/Seal kit from store/)).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith('/work-order-operations'))?.url.searchParams.getAll('eventIds')).toEqual(['e1']);
    const panel = screen.getByTestId('work-orders-import');
    fireEvent.change(within(panel).getByRole('textbox'), { target: { value: '[{"workOrderId":"4000123","operationId":"0020","kind":"repair","startedAt":"2026-10-01T10:00:00Z","assetCode":"P-101"}]' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Import' }));
    expect(await within(panel).findByText('Imported 1 operation(s): 1 new, 0 updated, 1 linked to a stop.')).toBeInTheDocument();
  });

  it('a stop page shows active repair vs waiting as the server counts it', async () => {
    stubV2Fetch((call) => (call.url.pathname.endsWith('/repair-evidence') ? jsonResponse(200, EVIDENCE) : undefined));
    actAs('Operator');
    wrap(<RepairEvidencePanel eventId="e1" />);
    const facts = await screen.findByTestId('repair-evidence');
    expect(facts).toHaveTextContent('Active repair');
    expect(facts).toHaveTextContent('3 h');
    expect(facts).toHaveTextContent('Waiting (parts, permit, crew)');
    expect(facts).toHaveTextContent('3 active of 3');
    expect(screen.queryByText('Open in work-order operations')).toBeNull();
  });

  it('a stop without CMMS operations says it gives no active repair time', async () => {
    stubV2Fetch((call) => (call.url.pathname.endsWith('/repair-evidence') ? jsonResponse(200, { ...EVIDENCE, operations: 0, activeOperations: 0, activeRepairSeconds: null, reason: 'no_operations' }) : undefined));
    wrap(<RepairEvidencePanel eventId="e1" />);
    expect(await screen.findByText(/gives no active repair time/)).toBeInTheDocument();
  });
});
