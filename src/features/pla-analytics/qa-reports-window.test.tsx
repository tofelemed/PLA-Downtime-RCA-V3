import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { KpiAggregateView, OeeReportView, ReportGroupView } from '@/api/v2/types/reports';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewAnalysis: true }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'Asia/Tehran', units: [], unitName: (id: string) => id }) }));
vi.mock('@/features/pla-analytics/hooks/use-production-day-start', () => ({ useProductionDayStart: () => ({ dayStart: '06:00', loading: false }) }));

const { parseScope, scopeToParams, CHOSEN_DATES } = await import('./model/analytics-scope');
const { WindowRangeControl } = await import('./components/window-range-control');
const { PlantDaysInput } = await import('./components/plant-days-input');
const { OeeGroupTable } = await import('./components/oee-group-table');
const { AnalyticsCard } = await import('./components/analytics-card');
const { ReportsFilters } = await import('./reports/reports-filters');

const TEHRAN = 'Asia/Tehran';
const NOW = Date.parse('2026-10-19T11:34:00.000Z'); // 19 Oct 15:04 plant time
const REPORTS = { approvedByDefault: true, productionDays: { timeZone: TEHRAN, dayStart: '06:00' } };
const wrap = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('QA Reports N1: production days and machine URL values', () => {
  it('the Reports default "Last 7 days" is the 7 complete production days, 06:00–06:00, and the URL says window=7d', () => {
    const scope = parseScope(new URLSearchParams(), NOW, REPORTS);
    expect(scope).toMatchObject({ from: '2026-10-12T02:30:00.000Z', to: '2026-10-19T02:30:00.000Z', windowLabel: 'Last 7 days' });
    expect(scopeToParams(scope, REPORTS).get('window')).toBe('7d');
  });

  it('chosen dates are written as window=dates; links with the old label text still read', () => {
    const chosen = parseScope(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z&window=dates'), NOW);
    expect(chosen.windowLabel).toBe(CHOSEN_DATES);
    expect(scopeToParams(chosen).toString()).toContain('window=dates');
    expect(scopeToParams(chosen).toString()).not.toMatch(/Chosen|Last/);
    const legacy = parseScope(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z&window=Chosen+dates'), NOW);
    expect(legacy.windowLabel).toBe(CHOSEN_DATES);
    expect(parseScope(new URLSearchParams('window=Last 7 days'), NOW).windowLabel).toBe('Last 7 days');
  });

  it('PLA (no snapping) keeps its rolling window to the minute', () => {
    const scope = parseScope(new URLSearchParams('window=7d'), NOW);
    expect(scope.to).toBe('2026-10-19T11:34:00.000Z');
  });

  it('typing 17 → 17 over a rolling window picks the 06:00–06:00 production day, never the clock time', () => {
    const onChange = vi.fn();
    render(<PlantDaysInput label="Period dates" value={{ from: '2026-10-12T11:34:00.000Z', to: '2026-10-19T11:34:00.000Z' }} timeZone={TEHRAN} dayStart="06:00" onChange={onChange} />);
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To (inclusive)');
    expect(from).toHaveValue('2026-10-12');
    expect(to).toHaveValue('2026-10-19');
    fireEvent.change(from, { target: { value: '2026-10-17' } });
    fireEvent.blur(from);
    fireEvent.change(to, { target: { value: '2026-10-17' } });
    fireEvent.blur(to);
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' });
  });

  it('QA PLA N8: a date typed in another format says how to type it and keeps the window', () => {
    const onChange = vi.fn();
    render(<PlantDaysInput label="Period dates" value={{ from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' }} timeZone={TEHRAN} dayStart="06:00" onChange={onChange} />);
    const from = screen.getByLabelText('From');
    fireEvent.change(from, { target: { value: '17/10/2026' } });
    fireEvent.blur(from);
    expect(screen.getByText('Use YYYY-MM-DD, e.g. 2026-10-17')).toBeInTheDocument();
    expect(from).toHaveAttribute('aria-invalid', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('QA PLA window labels (N6, shift C)', () => {
  it('a rolling window shows its real bounds with times', () => {
    const scope = parseScope(new URLSearchParams('window=7d'), NOW);
    wrap(<WindowRangeControl scope={scope} timeZone={TEHRAN} onChange={vi.fn()} />);
    expect(screen.getByTestId('pla-window')).toHaveTextContent('Last 7 days · 2026-10-12 15:04 – 2026-10-19 15:04');
  });

  it('a shift-C window reads as part of one production day', () => {
    const scope = parseScope(new URLSearchParams('from=2026-10-17T18:30:00.000Z&to=2026-10-18T02:30:00.000Z&window=dates'), NOW);
    wrap(<WindowRangeControl scope={scope} timeZone={TEHRAN} onChange={vi.fn()} />);
    expect(screen.getByTestId('pla-window')).toHaveTextContent('Chosen dates · Production day 2026-10-17 · 22:00–06:00');
  });
});

const kpi = (metric: string, value: string | null, reason: string | null = null): KpiAggregateView => ({ metric, numerator: null, denominator: null, value, unit: 'ratio', quality: value === null ? 'unavailable' : 'ok', reason, rows: 1, missing: value === null ? 1 : 0 });
const METRICS = ['availability', 'performance', 'quality', 'oee'];
const row = (key: string, value: string | null, noApprovedPlan?: boolean): ReportGroupView => ({ key, label: key, metrics: METRICS.map((m) => kpi(m, value, value === null ? 'no_data' : null)), noApprovedPlan });

describe('QA Reports N4: days without an approved plan', () => {
  const report = { policy: 'operational', label: 'Operational OEE (ISO 22400)', groupBy: 'day', groups: [row('2026-10-17', '0.9', false), row('2026-10-18', null, true), row('2026-10-20', null)], total: METRICS.map((m) => kpi(m, '0.9')), calculationRunIds: [] } as OeeReportView;

  it('says "No approved plan covers this period" once per row, with "—" in the figures', () => {
    wrap(<OeeGroupTable report={report} groupTitle="Plant date" labelOf={(key) => key ?? ''} testId="t" />);
    const [covered, noPlan, unavailable] = screen.getAllByTestId('oee-group').map((cell) => cell.closest('tr') as HTMLElement);
    expect(within(covered).queryByTestId('oee-row-note')).toBeNull();
    expect(within(noPlan).getAllByTestId('no-plan')).toHaveLength(1);
    expect(within(noPlan).getByTestId('no-plan')).toHaveTextContent('No approved plan covers this period · Open Plans');
    expect(within(noPlan).queryByText(/Not available/)).toBeNull();
    expect(within(noPlan).getAllByText('—')).toHaveLength(4);
    expect(within(unavailable).getAllByText(/Not available/)).toHaveLength(1);
  });
});

describe('QA Reports: "Provisional" follows the revisions choice on every card', () => {
  const query = { isLoading: false, isError: false, error: null, data: {}, refetch: () => undefined };
  const response = { isProvisional: true, coverage: { from: '', to: '', ratio: 0.38 } };

  it('approved-only with missing periods: incomplete, no "Provisional" badge', () => {
    wrap(<AnalyticsCard title="OEE" testId="c" query={query} response={response} approvedOnly>x</AnalyticsCard>);
    expect(screen.queryByText('Provisional')).toBeNull();
  });

  it('approved else draft: the badge stays', () => {
    wrap(<AnalyticsCard title="OEE" testId="c" query={query} response={response}>x</AnalyticsCard>);
    expect(screen.getByText('Provisional')).toBeInTheDocument();
  });

  it('the Revisions select offers choices, approved first', () => {
    wrap(<ReportsFilters scope={parseScope(new URLSearchParams(), NOW, REPORTS)} dayStart="06:00" onChange={vi.fn()} />);
    const options = within(screen.getByTestId('report-revision')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Approved revisions only', 'Include open drafts (provisional figures)']);
  });
});
