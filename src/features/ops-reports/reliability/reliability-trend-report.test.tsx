import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReliabilityTrendView } from '@/api/v2/types/ops-reports';
import type { KpiAggregateView } from '@/api/v2/types/reports';

const kpi = (metric: string, value: string | null): KpiAggregateView => ({ metric, numerator: null, denominator: null, value, unit: 'seconds', quality: 'ok', reason: null, rows: 1, missing: 0 });
const row = (mtbf: string | null) => ({ unitId: 'u1', assetId: null, label: null, exposureSeconds: null, failures: null, mtbf: kpi('mtbf', mtbf), meanDowntimeToRestore: kpi('mean_downtime_to_restore', '600'), mttr: kpi('mttr', null) });

const data: ReliabilityTrendView = {
  months: ['2027-01', '2027-02'],
  units: [{ unitId: 'u1', assetId: null, label: null, fallingMtbf: true, months: [{ month: '2027-01', row: row('7200') }, { month: '2027-02', row: row('3600') }] }],
  assets: [],
  total: { fallingMtbf: false, months: [] },
  failureDefinition: 'A failure is …',
  calculationRunIds: [],
};

vi.mock('../components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', unitName: () => 'Reactor 1' }) }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useReliabilityTrend: () => ({ data: { data, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { ReliabilityTrendReport } = await import('./reliability-trend-report');

describe('ReliabilityTrendReport (R6)', () => {
  it('shows each month of the unit and flags a falling MTBF', () => {
    render(<ReliabilityTrendReport scope={{ unitIds: [], from: '', to: '', approvedOnly: true } as unknown as Parameters<typeof ReliabilityTrendReport>[0]['scope']} />);
    expect(screen.getByText('MTBF falling')).toBeInTheDocument();
    expect(screen.getAllByTestId('reliability-series')[0]).toHaveTextContent('Reactor 1');
  });

  it('puts the failure definition behind the ⓘ of the MTBF card, not under its title', async () => {
    render(<ReliabilityTrendReport scope={{ unitIds: [], from: '', to: '', approvedOnly: true } as unknown as Parameters<typeof ReliabilityTrendReport>[0]['scope']} />);
    expect(screen.queryByText('A failure is …')).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'About MTBF by month' })).toHaveFocus();
    expect((await screen.findAllByText('A failure is …')).length).toBeGreaterThan(0);
  });
});
