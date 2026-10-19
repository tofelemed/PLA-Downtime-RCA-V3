import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { EventRevisionView, ProductionEventHistoryView, ProductionEventView } from '@/api/v2/types/events';
import { actAs } from '@/test/acting-user';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodeEventDialog } = await import('./components/code-event-dialog');
const { EvidencePanel } = await import('./components/evidence-panel');
const { MultiCheckSelect } = await import('./components/multi-check-select');
const { WindowSelect } = await import('./components/window-select');
const { ImpactedPeriodsPreview } = await import('./components/impacted-periods-preview');
const { RcaPolicyPage } = await import('./rca-policy/rca-policy-page');
const { EventRcaChip } = await import('@/features/rca/components/event-rca-chip');
const { EVENT_RCA_STATE_LABELS } = await import('@/features/ux-kit/labels');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [], allReasonCodes: [],
  unitName: () => 'HDPE Extruder 1', reasonName: () => '—',
};

const period = (extra: Record<string, unknown>) => ({
  periodId: 'p1', planId: 'plan-1', unitId: 'u1', utcStart: '2026-10-17T02:30:00.000Z', utcEnd: '2026-10-17T10:30:00.000Z', localDate: '2026-10-17',
  shiftName: 'A', isExcluded: false, exclusionKind: null, stateReadiness: 'ready', workflowState: 'approved', revision: null, publishedRevision: null,
  run: null, plan: null, coverageRatio: null, qualityStates: [], productIds: [], sla: null, ...extra,
});

let body: unknown = { items: [], nextCursor: null };
let client: QueryClient;
const wrap = (node: ReactNode, path = '/events/e1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  body = { items: [], nextCursor: null };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('Event Hub round-3 QA fixes', () => {
  it('L6: the Code dialog of an ended stop gives its span, not "since"', () => {
    const ended = {
      id: 'e1', unitId: 'u1', startTime: '2026-10-17T22:30:00.000Z', endTime: '2026-10-17T23:00:00.000Z', isOpen: false, classification: { physicalType: 'downtime' },
      states: { physical: 'ended', coding: 'uncoded', rca: 'none' }, reasonCodeId: null, rowVersion: 1,
    } as unknown as ProductionEventView;
    wrap(<CodeEventDialog event={ended} onClose={() => undefined} onDone={() => undefined} />);
    const description = screen.getByTestId('code-dialog').querySelector('p');
    expect(description?.textContent).toMatch(/^HDPE Extruder 1, .+ – .+$/);
    expect(description?.textContent).not.toContain('since');
  });

  it('L12: the Evidence tab lists filled fields only and counts the empty ones', () => {
    const revision = {
      id: 'r1', revision: 1, kind: 'source', changeReason: null, actorId: null, actorKind: 'connector', sourceRevision: null, createdAt: '2026-10-17T05:00:00.000Z',
      effectiveFacts: {}, sourceFacts: { description: 'Gearbox trip', comment: '', failureMode: null, tags: [], extra: {} },
    } as unknown as EventRevisionView;
    const history = { revisions: [revision], coding: [], reviewItems: [], relations: [] } as ProductionEventHistoryView;
    wrap(<EvidencePanel history={history} eventId="e1" />);
    const delivery = screen.getByTestId('evidence-panel').querySelector('dl');
    expect(delivery?.querySelectorAll('dt')).toHaveLength(1);
    expect(screen.getByTestId('evidence-empty-count')).toHaveTextContent('4 empty fields not shown');
    expect(delivery?.textContent).not.toContain('—');
  });

  it('L19: a filter button names one or two chosen values, and counts more', () => {
    const options = ['A', 'B', 'C'].map((value) => ({ value, label: `Shift ${value}` }));
    const { rerender } = render(<MultiCheckSelect label="Shifts" options={options} selected={['A']} onChange={() => undefined} testId="shifts" />);
    expect(screen.getByTestId('shifts')).toHaveTextContent('Shifts: Shift A');
    rerender(<MultiCheckSelect label="Shifts" options={options} selected={['A', 'C']} onChange={() => undefined} testId="shifts" />);
    expect(screen.getByTestId('shifts')).toHaveTextContent('Shifts: Shift A, Shift C');
    rerender(<MultiCheckSelect label="Shifts" options={options} selected={['A', 'B', 'C']} onChange={() => undefined} testId="shifts" />);
    expect(screen.getByTestId('shifts')).toHaveTextContent('Shifts: 3 selected');
  });

  it('L1: the window select lists the current preset once, selected', () => {
    wrap(<WindowSelect unitIds={[]} label="Last 7 days" bounds={{ from: null, to: null }} onChange={() => undefined} />);
    const select = screen.getByTestId('event-window') as HTMLSelectElement;
    expect([...select.options].filter((option) => option.text === 'Last 7 days')).toHaveLength(1);
    expect(select.selectedOptions[0].text).toBe('Last 7 days');
  });

  it('L14 / N5: periods read "· Shift A", an approved one opens ?view=approved, a period without a plan says so', async () => {
    body = { items: [period({}), period({ periodId: 'p2', planId: null, workflowState: 'none', shiftName: 'B', localDate: '2026-10-19' })], nextCursor: null };
    wrap(<ImpactedPeriodsPreview unitId="u1" from="2026-10-17T02:30:00.000Z" to="2026-10-19T18:30:00.000Z" />);
    await waitFor(() => expect(screen.getAllByTestId('impacted-period')).toHaveLength(2));
    const [approved, unplanned] = screen.getAllByTestId('impacted-period');
    const link = within(approved).getByTestId('period-link');
    expect(link.textContent).toMatch(/· Shift A$/);
    expect(link.getAttribute('href')).toMatch(/\/plans\/plan-1\/periods\/p1\?view=approved$/);
    expect(within(unplanned).getByTestId('no-plan')).toHaveTextContent('No approved plan covers this period');
    expect(within(unplanned).queryByTestId('impacted-period-workflow')).toBeNull();
  });

  it('L7: the RCA trigger page shows no "New version" to a role that cannot change it', async () => {
    actAs('Operator');
    wrap(<RcaPolicyPage />, '/events/rca-triggers');
    await waitFor(() => expect(screen.getByTestId('rca-policy-read-only')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'New version' })).toBeNull();
    expect(document.body.textContent).not.toContain('Recommend an RCA');
  });

  it('L10: investigation chips use the glossary words from ux-kit', () => {
    const { rerender } = wrap(<EventRcaChip rcaState="completed" />);
    expect(screen.getByTestId('event-rca-chip')).toHaveTextContent('Investigation completed');
    rerender(
      <MemoryRouter>
        <EventRcaChip rcaState="required" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('event-rca-chip')).toHaveTextContent('Investigation recommended');
    expect(Object.values(EVENT_RCA_STATE_LABELS).join(' ')).not.toMatch(/\bRCA\b/);
  });
});
