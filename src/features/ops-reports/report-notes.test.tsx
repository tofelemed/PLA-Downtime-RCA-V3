import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const ready = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: () => undefined });
const kpi = { metric: 'x', numerator: null, denominator: null, value: null, unit: 'ratio', quality: 'unavailable', reason: null, rows: 0, missing: 0 };
const envelope = (data: unknown) => ready({ data, isProvisional: true, coverage: { from: '', to: '', ratio: 0.5 } });

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', unitName: (id: string) => id }) }));
vi.mock('@/features/display-currency/use-display-currency', () => ({ useDisplayCurrency: () => ({ currency: 'USD' }) }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewMoney: false }) }));
vi.mock('./components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('./daily/event-status-card', () => ({ EventStatusCard: () => null }));
vi.mock('./quality/prime-yield-trend', () => ({ PrimeYieldTrend: () => null }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useCodingCompliance: () => envelope({ byCrew: [], byShift: [], calculationRunIds: [] }),
  useRateLoss: () => envelope({ months: [], total: { equivalentDowntime: kpi, performance: kpi }, calculationRunIds: [] }),
  usePlanAdherence: () => envelope({ rows: [], calculationRunIds: [] }),
}));
vi.mock('@/api/v2/queries/pla-analytics', () => ({
  useLossTree: () => envelope({ groupBy: 'reason', metric: 'qty', groups: [], totals: [] }),
}));

const { parseScope } = await import('@/features/pla-analytics/model/analytics-scope');
const { ReportChrome } = await import('@/features/pla-analytics/components/report-chrome');
const { CodingComplianceReport } = await import('./compliance/coding-compliance-report');
const { RateLossReport } = await import('./rate/rate-loss-report');
const { PlanAdherenceReport } = await import('./plan/plan-adherence-report');
const { LossBreakdownCards } = await import('./components/loss-breakdown-cards');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z&approved=1'), 0);
const onReports = (node: ReactNode) => render(<MemoryRouter><ReportChrome>{node}</ReportChrome></MemoryRouter>);

async function noteBehindInfo(button: string, note: RegExp) {
  expect(screen.queryByText(note)).toBeNull();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: button })).toHaveFocus();
  expect((await screen.findAllByText(note)).length).toBeGreaterThan(0);
}

describe('Operating reports: notes behind an ⓘ, no captions, no Provisional chip', () => {
  it('Coding compliance: "Coding delay…" is behind the ⓘ of its card', async () => {
    onReports(<CodingComplianceReport scope={SCOPE} />);
    expect(screen.queryByText('Provisional')).toBeNull();
    await noteBehindInfo('About Coding by crew and shift', /Coding delay: from the end of a stop/);
  });

  it('Rate loss: "Equivalent downtime: …" is behind the ⓘ', async () => {
    onReports(<RateLossReport scope={SCOPE} />);
    await noteBehindInfo('About Running below rate, by month', /Equivalent downtime: the rate lost/);
  });

  it('Plan adherence: "Volume adherence…" is behind the ⓘ', async () => {
    onReports(<PlanAdherenceReport scope={SCOPE} />);
    await noteBehindInfo('About Plan adherence by grade', /Volume adherence counts each day/);
  });

  it('Loss breakdowns: no loss-lines caption', () => {
    onReports(<LossBreakdownCards scope={SCOPE} groupBy="reason" title="Top 5 losses" testId="t" />);
    expect(screen.getByTestId('t-qty')).not.toHaveTextContent(/loss lines of each period|approved revisions only|Provisional/i);
  });
});
