import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ExceptionTarget, ReconciliationExceptionView } from '@/api/v2/types/reconciliation-exceptions';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const { CloseExceptions } = await import('./close-exceptions');
const { exceptionHref } = await import('./exception-model');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const item = (id: string, extra: Partial<ReconciliationExceptionView>): ReconciliationExceptionView => ({
  id, type: 'residual_beyond_tolerance', periodId: `p-${id}`, unitId: 'u1', unitName: 'Extruder', planId: 'plan-1',
  localDate: '2027-03-01', shiftName: 'A', utcStart: '2027-03-01T02:30:00.000Z', utcEnd: '2027-03-01T10:30:00.000Z',
  workflowState: 'draft', revision: 1, count: 1, message: 'Residual 150 t beyond tolerance in the latest calculation',
  target: { screen: 'period', planId: 'plan-1', periodId: `p-${id}`, section: 'reconciliation' }, ...extra,
});

const ITEMS: ReconciliationExceptionView[] = [
  item('1', {}),
  item('2', { type: 'uncoded_stop_time', message: '2 stops without a reason in this period', target: { screen: 'events', unitId: 'u1', from: '2027-03-01T02:30:00.000Z', to: '2027-03-01T10:30:00.000Z', filter: 'uncoded' } }),
  item('3', { type: 'duplicate_merge_pending', message: '1 duplicate-stop suggestion waits for a decision', target: { screen: 'stop_merge', eventId: 'ev-1', reconciliationId: 'sr-1' } }),
  item('4', { type: 'bridge_required', planId: null, message: 'Loss candidates exceed the plan gap: a bridge decision is needed (1 slice)', target: { screen: 'none' } }),
];

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

describe('Month close → Exceptions (plan 2.4)', () => {
  let urls: URL[];
  let unconfigure: () => void;
  const mount = (search = '?section=exceptions') => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/month-close${search}`]}><CloseExceptions view={{ firstDate: '2027-03-01', endDate: '2027-04-01' }} /><LocationProbe /></MemoryRouter>
    </QueryClientProvider>,
  );
  const exceptionCalls = () => urls.filter((url) => url.pathname.endsWith('/reconciliation/exceptions'));

  beforeEach(() => {
    urls = []; actAs('production_accountant', 'accountant');
    unconfigure = configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(input); urls.push(url);
      if (url.pathname.endsWith('/units')) return json({ items: [{ id: 'u1', code: 'EX1', name: 'Extruder', siteId: null }, { id: 'u2', code: 'BM1', name: 'Blow moulding', siteId: null }], nextCursor: null });
      return json({ items: ITEMS, nextCursor: null, asOf: '2027-03-02T00:00:00.000Z', scope: { tenantId: 'tenant-a' } });
    }));
  });
  afterEach(() => { unconfigure(); vi.unstubAllGlobals(); actAs('SuperAdmin'); });

  it('asks the server for the month’s periods and shows its rows and messages as served', async () => {
    mount();
    await screen.findByText('Residual 150 t beyond tolerance in the latest calculation');
    const call = exceptionCalls()[0];
    expect(call.searchParams.get('fromDate')).toBe('2027-03-01');
    expect(call.searchParams.get('toDate')).toBe('2027-04-01');
    expect(call.searchParams.getAll('types')).toEqual([]);
    expect(screen.getAllByTestId('exception-row')).toHaveLength(4);
  });

  it('each row links to the screen that fixes it; a period without a plan says so', async () => {
    mount();
    await screen.findByText('2 stops without a reason in this period');
    const links = screen.getAllByTestId('exception-link').map((a) => a.getAttribute('href'));
    expect(links[0]).toBe('/plans/plan-1/periods/p-1');
    expect(links[1]).toMatch(/^\/events\?/);
    expect(links[2]).toBe('/events/ev-1?tab=related#stop-merge-sr-1');
    const rows = screen.getAllByRole('row');
    expect(within(rows[rows.length - 1]).getByTestId('no-plan')).toBeInTheDocument();
  });

  it('filters by problem type and unit on the server and keeps them in the URL', async () => {
    mount();
    await screen.findAllByTestId('exception-row');
    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'uncoded_stop_time' } });
    await waitFor(() => expect(exceptionCalls().some((url) => url.searchParams.getAll('types').includes('uncoded_stop_time'))).toBe(true));
    await screen.findByRole('option', { name: 'Blow moulding' });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'u2' } });
    await waitFor(() => expect(exceptionCalls().some((url) => url.searchParams.getAll('unitIds').includes('u2'))).toBe(true));
    expect(screen.getByTestId('location')).toHaveTextContent('problem=uncoded_stop_time');
    expect(screen.getByTestId('location')).toHaveTextContent('unit=u2');
  });

  it('a shared link restores the filters; an unknown problem reads as all', async () => {
    mount('?section=exceptions&problem=stale_submission&unit=u1');
    await waitFor(() => expect(exceptionCalls()[0]?.searchParams.getAll('types')).toEqual(['stale_submission']));
    expect(exceptionCalls()[0].searchParams.getAll('unitIds')).toEqual(['u1']);
  });

  it('maps every server target to a link (or none)', () => {
    const targets: Array<[ExceptionTarget, string | null]> = [
      [{ screen: 'period', planId: 'p', periodId: 'x', section: 'actuals' }, '/plans/p/periods/x/actuals'],
      [{ screen: 'period', planId: 'p', periodId: 'x', section: 'review' }, '/plans/p/periods/x/review'],
      [{ screen: 'stop_merges', unitId: 'u1', from: 'a', to: 'b' }, '/approvals?kind=stop-merge'],
      [{ screen: 'none' }, null],
    ];
    for (const [target, href] of targets) expect(exceptionHref(target)).toBe(href);
  });
});
