import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TransitionPerformanceView } from '@/api/v2/types/ops-reports';
import { ReportChrome } from '@/features/pla-analytics/components/report-chrome';
import { parseScope } from '@/features/pla-analytics/model/analytics-scope';

const row = {
  eventId: 'e1', unitId: 'u1', unitName: 'Unit 1', start: '2026-10-17T08:00:00Z', end: '2026-10-17T10:00:00Z', seconds: '7200',
  fromProductId: 'p1', fromProduct: 'A', toProductId: 'p2', toProduct: 'B', catalystFamily: null, operatingMode: null,
  standardId: 's1', referenceSeconds: '3600', referenceOffgrade: null, excessSeconds: '3600', uom: 't', allowanceLoss: '1', excessLoss: '2',
  offGrade: '0', noStandard: false, calculated: true,
};
const data = { transitions: [row], truncated: false, pairs: [] } as unknown as TransitionPerformanceView;

vi.mock('../components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('../components/loss-breakdown-cards', () => ({ LossBreakdownCards: () => null }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useTransitionPerformance: () => ({ data, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { TransitionsReport } = await import('./transitions-report');

function renderReport(approvedOnly: boolean) {
  const scope = { ...parseScope(new URLSearchParams('from=2026-10-17T00:00:00.000Z&to=2026-10-18T00:00:00.000Z'), 0), approvedOnly };
  return render(
    <MemoryRouter>
      <ReportChrome approvedOnly={approvedOnly}>
        <TransitionsReport scope={scope} />
      </ReportChrome>
    </MemoryRouter>,
  );
}

describe('TransitionsReport provisional marker', () => {
  it('marks the loss columns (read from the shown runs) with Revision = Provisional', () => {
    renderReport(false);
    expect(within(screen.getByTestId('transition-list')).getAllByTestId('provisional-mark')).toHaveLength(1);
    expect(within(screen.getByTestId('transition-pairs')).queryByTestId('provisional-mark')).toBeNull();
  });

  it('shows no marker with Approved only', () => {
    renderReport(true);
    expect(screen.queryByTestId('provisional-mark')).toBeNull();
  });
});
