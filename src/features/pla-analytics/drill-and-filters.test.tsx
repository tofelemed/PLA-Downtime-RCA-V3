import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { LossTreeGroupView, ScopeWaterfallView } from '@/api/v2/types/pla-analytics';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', units: [], unitName: (id: string) => id }) }));
vi.mock('@/features/pla-analytics/hooks/use-production-day-start', () => ({ useProductionDayStart: () => ({ dayStart: '06:00', loading: false }) }));
vi.mock('@/features/plan-dashboard/components/waterfall-chart', () => ({ WaterfallChart: () => <div>chart</div> }));
const waterfall = vi.hoisted(() => ({ data: null as ScopeWaterfallView | null }));
vi.mock('@/api/v2/queries/pla-analytics', async (original) => ({
  ...await original<typeof import('@/api/v2/queries/pla-analytics')>(),
  useScopeWaterfall: () => ({ data: { data: waterfall.data, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { parseScope } = await import('./model/analytics-scope');
const { lossGroupLink } = await import('./model/links');
const { LossTable } = await import('./components/loss-table');
const { WaterfallTab } = await import('./tabs/waterfall-tab');
const { WindowRangeControl } = await import('./components/window-range-control');
const { LedgerApprovedToggles } = await import('./components/ledger-approved-toggles');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-11T00:00:00.000Z&to=2026-10-18T00:00:00.000Z&window=Last 7 days'), 0);
const wrap = (node: ReactNode) => render(<MemoryRouter initialEntries={['/pla?tab=losses']}>{node}</MemoryRouter>);
const group = (key: string | null, label: string | null) => ({ key, label, unit: 't', amount: '10', share: '0.5', cumulativeShare: '0.5', lines: 2, eventLines: 2, status: 'quantity' }) as LossTreeGroupView;
const bar = (key: string, kind: 'total' | 'step') => ({ key, label: key, kind, delta: kind === 'step' ? '-5' : null, start: '100', end: '95' });

describe('PLA drill-downs and the filter bar (UX audit D-6, D-13)', () => {
  it('loss-table rows with an event filter are links; rows without one stay text', () => {
    wrap(<LossTable groups={[group('r1', 'Pump trip'), group(null, null)]} total={undefined} metric="qty" groupTitle="Reason" testId="loss-table" rowLink={(g) => lossGroupLink(SCOPE, 'reason', g)} />);
    const [coded, notCoded] = screen.getAllByTestId('loss-group');
    expect(coded.tagName).toBe('A');
    expect(coded.getAttribute('href')).toMatch(/^\/events\?.*reasons=r1/);
    expect(notCoded.tagName).toBe('SPAN');
    expect(notCoded).toHaveTextContent('Not coded');
  });

  it('waterfall loss bars are listed as links to their loss events; totals are not', () => {
    waterfall.data = { ledger: 'plan', bars: [bar('target', 'total'), bar('availability', 'step'), bar('quality', 'step'), bar('unaccounted', 'step'), bar('actual', 'total')], excluded: [], closes: true, opening: '100', closing: '95', uom: 't' } as unknown as ScopeWaterfallView;
    wrap(<WaterfallTab scope={SCOPE} />);
    const drills = within(screen.getByTestId('waterfall-drills')).getAllByTestId('waterfall-drill');
    expect(drills.map((d) => d.getAttribute('data-key'))).toEqual(['availability', 'quality', 'unaccounted']);
    expect(drills[0].getAttribute('href')).toContain('oee=availability');
    expect(drills[0].getAttribute('href')).toContain('breakdown=loss-events');
    expect(drills[1].getAttribute('href')).toMatch(/^\/pla-analytics\/reconciliation\?.*periods=quality/);
    expect(drills[2].getAttribute('href')).toMatch(/^\/pla-analytics\/reconciliation\?/);
  });

  it('the window is a preset select plus From / To fields, with no dates inside the select', () => {
    const onChange = vi.fn();
    wrap(<WindowRangeControl scope={SCOPE} timeZone="UTC" onChange={onChange} />);
    const select = screen.getByLabelText('Window') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('7d');
    expect(select.selectedOptions[0]).toHaveTextContent(/^Last 7 days$/);
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-11');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-17');
    fireEvent.change(select, { target: { value: '30d' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ windowLabel: 'Last 30 days' }));
  });

  it('QA PLA M1: a production day reads as one day, its dates are typed in the plant format, and re-choosing it keeps 06:00–06:00', () => {
    const onChange = vi.fn();
    const day = parseScope(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z'), 0);
    wrap(<WindowRangeControl scope={day} timeZone="Asia/Tehran" onChange={onChange} />);
    const select = screen.getByLabelText('Window') as HTMLSelectElement;
    expect(select).toHaveValue('');
    expect(select.selectedOptions[0]).toHaveTextContent('Chosen dates');
    const to = screen.getByLabelText('To');
    expect(to).toHaveAttribute('type', 'text');
    expect(to).toHaveValue('2026-10-17');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-16' } });
    fireEvent.blur(screen.getByLabelText('From'));
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-10-16T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z', windowLabel: 'Chosen dates' });
  });

  it('the ledger (segmented) and the revision (select) are labelled server filters', () => {
    const onChange = vi.fn();
    wrap(<LedgerApprovedToggles ledger="plan" approvedOnly={false} showLedger showApproved onChange={onChange} />);
    const row = screen.getByTestId('pla-scope-toggles');
    expect(row).toHaveAccessibleName('Ledger');
    expect(within(row).getByTestId('ledger-plan')).toHaveAttribute('data-state', 'on');
    fireEvent.click(within(row).getByTestId('ledger-capacity'));
    expect(onChange).toHaveBeenCalledWith({ ledger: 'capacity' });
    const revision = screen.getByLabelText('Revision');
    expect(revision).toHaveValue('shown');
    fireEvent.change(revision, { target: { value: 'approved' } });
    expect(onChange).toHaveBeenCalledWith({ approvedOnly: true });
  });
});
