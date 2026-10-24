import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChronicSporadicView } from '@/api/v2/types/ops-reports';

const data: ChronicSporadicView = {
  groupBy: 'reason',
  rows: [
    { key: 'r1', label: 'FEED Feeder trips', stops: '40', seconds: '4000', meanSeconds: '100', quadrant: 'chronic' },
    { key: 'r2', label: 'GBX Gearbox', stops: '2', seconds: '36000', meanSeconds: '18000', quadrant: 'sporadic' },
  ],
  truncated: true,
  medianStops: '21',
  medianMeanSeconds: '9050',
  calculationRunIds: [],
};

vi.mock('../components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useChronicSporadic: () => ({ data: { data, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { ChronicSporadicReport } = await import('./chronic-sporadic-report');

describe('ChronicSporadicReport (R7)', () => {
  it('names each cause’s pattern; the medians it is cut at sit behind the card’s ⓘ; the truncation line stays', async () => {
    render(<ChronicSporadicReport scope={{ unitIds: [], from: '', to: '', approvedOnly: true } as unknown as Parameters<typeof ChronicSporadicReport>[0]['scope']} />);
    expect(screen.getByText('Chronic')).toBeInTheDocument();
    expect(screen.getByText('Sporadic')).toBeInTheDocument();
    expect(screen.queryByTestId('chronic-medians')).toBeNull();
    expect(screen.getByText('Showing the 100 causes with the most downtime.')).toHaveClass('text-xs', 'text-muted-foreground');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'About Chronic and sporadic losses' })).toHaveFocus();
    expect((await screen.findAllByTestId('chronic-medians'))[0]).toHaveTextContent('Cut at the medians');
  });
});
