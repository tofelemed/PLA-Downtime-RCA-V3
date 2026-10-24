import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RcaActionTrackerView } from '@/api/v2/types/ops-reports';
import { ReportChrome } from '@/features/pla-analytics/components/report-chrome';

const data: RcaActionTrackerView = {
  openCases: { total: 3, overdue: 1, byStatus: [{ key: 'Analysis', count: 3 }], byAge: [{ key: '0-30', count: 2 }, { key: '90+', count: 1 }] },
  openActions: { total: 5, byDue: [{ key: 'overdue', count: 2 }, { key: 'no_due_date', count: 3 }], byAge: [{ key: '0-30', count: 5 }] },
  closedActions: { done: 4, withDueDate: 4, onTime: 3, late: 1, onTimeRate: '0.75' },
  closedCases: { closed: 2, meanDaysToClose: '41.5' },
  asOf: '2027-03-05T00:00:00.000Z',
};

vi.mock('../components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useRcaActionTracker: () => ({ data, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { RcaActionTrackerReport } = await import('./rca-action-tracker-report');

describe('RcaActionTrackerReport (R10)', () => {
  it('shows the open pipeline in words and the on-time share of the closures', () => {
    render(
      <MemoryRouter>
        <RcaActionTrackerReport scope={{ unitIds: [], from: '', to: '', approvedOnly: true } as unknown as Parameters<typeof RcaActionTrackerReport>[0]['scope']} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('rca-open-cases')).toHaveTextContent('3');
    expect(screen.getByTestId('rca-actions-due')).toHaveTextContent('Overdue');
    expect(screen.getByTestId('rca-cases-age')).toHaveTextContent('Over 90 days');
    expect(screen.getByTestId('rca-on-time')).toHaveTextContent('75.0 %');
  });

  it('shows no Provisional marker with Revision = Provisional (actions and cases are not period revisions)', () => {
    render(
      <MemoryRouter>
        <ReportChrome approvedOnly={false}>
          <RcaActionTrackerReport scope={{ unitIds: [], from: '', to: '', approvedOnly: false } as unknown as Parameters<typeof RcaActionTrackerReport>[0]['scope']} />
        </ReportChrome>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('rca-open-cases')).toHaveTextContent('3');
    expect(screen.queryByTestId('provisional-mark')).toBeNull();
  });
});
