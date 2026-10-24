import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { MonthlyScorecardView, RcaActionTrackerView, ReliabilityTrendView } from '@/api/v2/types/ops-reports';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { ReportChrome } from '@/features/pla-analytics/components/report-chrome';
import { parseScope } from '@/features/pla-analytics/model/analytics-scope';

const kpi = (metric: string, value: string, quality = 'ok'): KpiAggregateView => ({ metric, numerator: null, denominator: null, value, unit: 'ratio', quality, reason: null, rows: 1, missing: 0 });
const oee = (quality: string) => [kpi('availability', '0.9', quality), kpi('performance', '0.95', quality), kpi('quality', '0.98', quality), kpi('oee', '0.84', quality)];
const month = (key: string, quality: string) => ({ month: key, oee: oee(quality), output: [], lossValue: [] });

const fixtures: { scorecard: MonthlyScorecardView; rca: RcaActionTrackerView; reliability: ReliabilityTrendView } = {
  scorecard: { months: [month('2026-09', 'provisional'), month('2026-10', 'ok')], valueMetric: 'margin', calculationRunIds: [] },
  rca: {
    openCases: { total: 0, overdue: 0, byStatus: [], byAge: [] },
    openActions: { total: 0, byDue: [], byAge: [] },
    closedActions: { done: 0, withDueDate: 0, onTime: 0, late: 0, onTimeRate: null },
    closedCases: { closed: 0, meanDaysToClose: null },
    asOf: '2026-10-19T00:00:00.000Z',
  },
  reliability: { months: [], units: [], assets: [], total: { fallingMtbf: false, months: [] }, failureDefinition: 'A failure is …', calculationRunIds: [] },
};
const ready = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: () => undefined });
const envelope = (data: unknown) => ({ data, isProvisional: true, coverage: { from: '', to: '', ratio: 1 } });

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewMoney: false }) }));
vi.mock('@/features/display-currency/use-display-currency', () => ({ useDisplayCurrency: () => ({ currency: 'USD' }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', unitName: () => 'Reactor 1' }) }));
vi.mock('./components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('./components/loss-breakdown-cards', () => ({ LossBreakdownCards: () => null }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useMonthlyScorecard: () => ready(envelope(fixtures.scorecard)),
  useRcaActionTracker: () => ready(fixtures.rca),
  useReliabilityTrend: () => ready(envelope(fixtures.reliability)),
}));

const { MonthlyScorecardReport } = await import('./scorecard/monthly-scorecard-report');
const { RcaActionTrackerReport } = await import('./rca/rca-action-tracker-report');
const { ReliabilityTrendReport } = await import('./reliability/reliability-trend-report');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-17T00:00:00.000Z&to=2026-10-19T00:00:00.000Z'), 0);
const onReports = (node: ReactNode, approvedOnly = true) => render(<MemoryRouter><ReportChrome approvedOnly={approvedOnly}>{node}</ReportChrome></MemoryRouter>);

describe('Executive scorecard', () => {
  it('OEE columns are OEE, Availability, Performance, Quality', () => {
    onReports(<MonthlyScorecardReport scope={SCOPE} dayStart="00:00" />);
    const names = within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(names.slice(1, 5)).toEqual(['OEE', 'Availability', 'Performance', 'Quality']);
  });

  it('Provisional: a marker on the month whose OEE the server marks provisional, none beside the title', () => {
    onReports(<MonthlyScorecardReport scope={{ ...SCOPE, approvedOnly: false }} dayStart="00:00" />, false);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByTestId('provisional-mark')).toBeInTheDocument();
    expect(within(rows[1]).queryByTestId('provisional-mark')).toBeNull();
    expect(screen.getAllByTestId('provisional-mark')).toHaveLength(1);
  });

  it('Approved only: the word never appears', () => {
    onReports(<MonthlyScorecardReport scope={SCOPE} dayStart="00:00" />);
    expect(screen.getByTestId('monthly-scorecard')).not.toHaveTextContent(/Provisional/);
  });
});

describe('Empty reports', () => {
  it('RCA actions: nothing open and nothing closed', () => {
    onReports(<RcaActionTrackerReport scope={SCOPE} />);
    expect(screen.getByText('No data for these dates')).toBeInTheDocument();
    expect(screen.getByText('Try other dates or units')).toBeInTheDocument();
    expect(screen.queryByTestId('rca-action-tracker')).toBeNull();
  });

  it('Reliability trend: no units', () => {
    onReports(<ReliabilityTrendReport scope={SCOPE} />);
    const card = screen.getByTestId('reliability-trend-mtbf');
    expect(within(card).getByText('No data for these dates')).toBeInTheDocument();
    expect(within(card).getByText('Try other dates or units')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
