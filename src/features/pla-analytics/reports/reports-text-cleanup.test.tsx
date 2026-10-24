import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const OEE_RESPONSE = {
  data: { label: 'Operational OEE (ISO 22400)', groups: [], total: [], calculationRunIds: ['run-1'] },
  isProvisional: true,
  coverage: { from: '', to: '', ratio: 0.5 },
  dataQuality: { missingCount: 3, provisionalCount: 0, notes: [] },
  asOf: '2026-10-18T02:30:00.000Z',
  policyVersion: ['oee-operational@1'],
};
const VALUE_RESPONSE = {
  data: { label: 'contribution margin', groups: [], total: { currencies: [] }, components: [], valuationStatus: 'approved' },
  isProvisional: true,
  coverage: { from: '', to: '', ratio: 1 },
};
const ready = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: () => undefined });

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', timezoneIsFallback: false, units: [], unitName: (id: string) => id }) }));
vi.mock('@/features/display-currency/use-display-currency', () => ({ useDisplayCurrency: () => ({ currency: 'USD' }) }));
vi.mock('@/api/v2/queries/reports', () => ({
  useOeeReport: () => ready(OEE_RESPONSE),
  useReport: () => ready(VALUE_RESPONSE),
  useDowntimeReport: () => ready(undefined),
}));
vi.mock('../components/scope-export', () => ({ ScopeExport: () => null }));

const { parseScope } = await import('../model/analytics-scope');
const { ReportChrome } = await import('../components/report-chrome');
const { AnalyticsCard } = await import('../components/analytics-card');
const { ReportsHeader } = await import('./reports-header');
const { OeeByDay } = await import('./production-report');
const { ReportExports } = await import('./report-exports');
const { LossValueCard } = await import('./loss-value-card');
const { EconomicBreakdownCard } = await import('./economic-breakdown-card');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z'), 0);
const onReports = (node: ReactNode) => render(<MemoryRouter><ReportChrome>{node}</ReportChrome></MemoryRouter>);
const elsewhere = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
const QUERY = ready({});

describe('Reports text cleanup: header', () => {
  it('keeps the h1 "Reports" and drops the description, scope line, revision badge and snapshot status', () => {
    elsewhere(<ReportsHeader />);
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    for (const gone of [/Approved figures of the chosen units/, /All units in your scope/, /Approved revisions only/, /Provisional/, /As of/, /Details/, /Incomplete data/, /UTC/]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByTestId('report-snapshot-details')).toBeNull();
  });

  it('has no hidden snapshot marker (the OEE card carries the units and runs)', () => {
    elsewhere(<ReportsHeader />);
    expect(screen.queryByTestId('report-snapshot')).toBeNull();
  });
});

describe('Reports text cleanup: cards on the Reports page', () => {
  const response = { isProvisional: true, coverage: { from: '', to: '', ratio: 0.4 } };

  it('drops the Provisional chip, the caption and "Operational" / "(ISO 22400)" / "by plant date" from the title', () => {
    onReports(
      <AnalyticsCard title="Operational OEE (ISO 22400) by plant date" testId="c" query={QUERY} response={response} note="A caption">
        x
      </AnalyticsCard>,
    );
    const card = screen.getByTestId('c');
    expect(within(card).getByText('OEE')).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/Provisional|A caption|Operational|ISO 22400|by plant date|Calculation details/);
  });

  it('shows a note the operator needs behind an ⓘ beside the title, reachable by keyboard', async () => {
    onReports(
      <AnalyticsCard title="Coding by crew and shift" testId="c" query={QUERY} response={response} info="Coding delay: from the end of a stop to its first coding.">
        x
      </AnalyticsCard>,
    );
    expect(screen.queryByText(/Coding delay:/)).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'About Coding by crew and shift' })).toHaveFocus();
    expect((await screen.findAllByText(/Coding delay: from the end of a stop/)).length).toBeGreaterThan(0);
  });

  it('other pages keep the caption and the chip', () => {
    elsewhere(
      <AnalyticsCard title="Operational OEE (ISO 22400)" testId="c" query={QUERY} response={response} note="A caption">
        x
      </AnalyticsCard>,
    );
    expect(screen.getByText('Operational OEE (ISO 22400)')).toBeInTheDocument();
    expect(screen.getByText('A caption')).toBeInTheDocument();
    expect(screen.getByText('Provisional')).toBeInTheDocument();
  });

  it('OEE and downtime: the OEE card is titled "OEE"', () => {
    onReports(<OeeByDay scope={SCOPE} />);
    const card = screen.getByTestId('report-oee');
    expect(within(card).getByText('OEE')).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/Operational|ISO 22400|by plant date|Provisional/);
  });

  it('Loss value: no "Valued from each period\'s calculation" caption (the valuation page keeps it)', () => {
    onReports(<LossValueCard scope={SCOPE} />);
    expect(screen.queryByText(/Valued from each period/)).toBeNull();
    expect(screen.queryByText(/Approved revisions only/i)).toBeNull();
  });

  it('the valuation page keeps the Loss value caption', () => {
    elsewhere(<LossValueCard scope={SCOPE} />);
    expect(screen.getByText(/Valued from each period/)).toBeInTheDocument();
  });

  it('Economic impact: no revision caption; "not broken down" moves behind the ⓘ', async () => {
    onReports(<EconomicBreakdownCard scope={SCOPE} />);
    expect(screen.queryByText(/Approved revisions only/)).toBeNull();
    expect(screen.queryByText(/not broken down/)).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /^About Economic impact by component/ })).toHaveFocus();
    expect((await screen.findAllByText(/listed as not broken down/)).length).toBeGreaterThan(0);
  });

  it('Exports: no "Exports contain approved revisions only…" paragraph', () => {
    onReports(<ReportExports scope={SCOPE} />);
    expect(screen.getByTestId('report-exports')).not.toHaveTextContent(/Exports contain approved revisions only/);
  });
});
