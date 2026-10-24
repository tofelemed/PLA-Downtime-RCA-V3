import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { KpiAggregateView } from '@/api/v2/types/reports';

const kpi = (metric: string, value: string, quality = 'ok'): KpiAggregateView => ({ metric, numerator: null, denominator: null, value, unit: 'ratio', quality, reason: null, rows: 1, missing: 0 });
/** server order: A, P, Q, OEE */
const metrics = (quality: string) => [kpi('availability', '0.9', quality), kpi('performance', '0.95', quality), kpi('quality', '0.98', quality), kpi('oee', '0.84', quality)];

const responses = {
  oee: {
    data: { label: 'Operational OEE (ISO 22400)', groups: [{ key: '2026-10-17', label: null, metrics: metrics('provisional') }, { key: '2026-10-18', label: null, metrics: metrics('ok') }], total: metrics('ok'), calculationRunIds: ['run-2', 'run-1'] },
    isProvisional: true,
    coverage: { from: '', to: '', ratio: 1 },
  },
  value: { data: { label: 'contribution margin', groups: [], total: { currencies: [] }, components: [], valuationStatus: 'approved' }, isProvisional: true, coverage: { from: '', to: '', ratio: 1 } },
};
const ready = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: () => undefined });

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', timezoneIsFallback: false, units: [], unitName: (id: string) => id }) }));
vi.mock('@/features/display-currency/use-display-currency', () => ({ useDisplayCurrency: () => ({ currency: 'USD' }) }));
vi.mock('@/api/v2/queries/reports', () => ({
  useOeeReport: () => ready(responses.oee),
  useReport: () => ready(responses.value),
  useDowntimeReport: () => ready(undefined),
}));

const { parseScope } = await import('../model/analytics-scope');
const { ReportChrome } = await import('../components/report-chrome');
const { AnalyticsCard } = await import('../components/analytics-card');
const { OeeByDay } = await import('./production-report');
const { LossValueCard } = await import('./loss-value-card');
const { reportText } = await import('../model/report-text');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-17T00:00:00.000Z&to=2026-10-19T00:00:00.000Z'), 0);
const onReports = (node: ReactNode, approvedOnly = true) => render(<MemoryRouter><ReportChrome approvedOnly={approvedOnly}>{node}</ReportChrome></MemoryRouter>);
const elsewhere = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
const headers = (table: HTMLElement) => within(table).getAllByRole('columnheader').map((cell) => cell.textContent);

describe('Reports tables: OEE column order', () => {
  it('OEE and downtime: OEE, Availability, Performance, Quality whatever the server order', () => {
    onReports(<OeeByDay scope={SCOPE} />);
    expect(headers(screen.getByRole('table'))).toEqual(['Plant date', 'OEE', 'Availability', 'Performance', 'Quality']);
    const firstRow = screen.getAllByRole('row')[1];
    expect([...firstRow.querySelectorAll('[data-metric]')].map((cell) => cell.getAttribute('data-metric'))).toEqual(['oee', 'availability', 'performance', 'quality']);
  });

  it('other pages keep the server order', () => {
    elsewhere(<OeeByDay scope={SCOPE} />);
    expect(headers(screen.getByRole('table'))).toEqual(['Plant date', 'Availability', 'Performance', 'Quality', 'OEE']);
  });
});

describe('Reports tables: one look', () => {
  it('small uppercase muted headers, right-aligned tabular numbers, compact rows', () => {
    onReports(<OeeByDay scope={SCOPE} />);
    const head = screen.getAllByRole('columnheader')[1];
    expect(head).toHaveClass('uppercase', 'text-xs', 'text-muted-foreground');
    const cell = screen.getAllByRole('cell')[1];
    expect(cell).toHaveClass('text-right', 'tabular-nums', 'py-1.5');
  });

  it('the card has the dashboard look: titled section, title left', () => {
    onReports(<OeeByDay scope={SCOPE} />);
    const card = screen.getByTestId('report-oee');
    expect(card.tagName).toBe('SECTION');
    expect(within(card).getByRole('heading', { name: 'OEE' })).toBeInTheDocument();
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
  });

  it('other pages keep the plain table header', () => {
    elsewhere(<OeeByDay scope={SCOPE} />);
    expect(screen.getAllByRole('columnheader')[1]).not.toHaveClass('uppercase');
  });

  it('the OEE card carries the shown units and calculation runs (end-to-end tests read them)', () => {
    onReports(<OeeByDay scope={{ ...SCOPE, unitIds: ['u1', 'u2'] }} />);
    const card = screen.getByTestId('report-oee');
    expect(card).toBeVisible();
    expect(card).toHaveAttribute('data-unit-ids', 'u1,u2');
    expect(card).toHaveAttribute('data-run-ids', 'run-1,run-2');
  });
});

describe('Reports tables: Provisional marker', () => {
  it('Provisional: a marker on each row the server marks provisional, none beside the title', () => {
    onReports(<OeeByDay scope={{ ...SCOPE, approvedOnly: false }} />, false);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByTestId('provisional-mark')).toHaveTextContent('Provisional');
    expect(within(rows[1]).queryByTestId('provisional-mark')).toBeNull();
    expect(screen.getAllByTestId('provisional-mark')).toHaveLength(1);
  });

  it('Approved only: the word never appears', () => {
    onReports(<OeeByDay scope={SCOPE} />, true);
    expect(screen.getByTestId('report-oee')).not.toHaveTextContent(/Provisional/);
  });

  it('Provisional, no per-row quality: one marker beside the card title', () => {
    onReports(
      <AnalyticsCard title="Output by product" testId="c" query={ready({})} response={{ isProvisional: true }}>
        x
      </AnalyticsCard>,
      false,
    );
    const heading = screen.getByRole('heading', { name: 'Output by product' });
    expect(heading.parentElement).toContainElement(screen.getByTestId('provisional-mark'));
    expect(screen.getAllByText('Provisional')).toHaveLength(1);
  });

  it('Provisional, approved response: no marker', () => {
    onReports(
      <AnalyticsCard title="Output by product" testId="c" query={ready({})} response={{ isProvisional: false }}>
        x
      </AnalyticsCard>,
      false,
    );
    expect(screen.queryByText('Provisional')).toBeNull();
  });

  it('Approved only, provisional response: no marker', () => {
    onReports(
      <AnalyticsCard title="Output by product" testId="c" query={ready({})} response={{ isProvisional: true }}>
        x
      </AnalyticsCard>,
    );
    expect(screen.queryByText('Provisional')).toBeNull();
  });
});

describe('Reports tables: empty state', () => {
  const expectEmpty = (card: HTMLElement) => {
    expect(within(card).getByText('No data for these dates')).toBeInTheDocument();
    expect(within(card).getByText('Try other dates or units')).toBeInTheDocument();
    expect(within(card).queryByRole('table')).toBeNull();
    expect(within(card).getByText('No data for these dates').closest('[data-state="empty"]')).toHaveClass('text-center');
  };

  it('OEE and downtime: no days', () => {
    const saved = responses.oee.data.groups;
    responses.oee.data.groups = [];
    onReports(<OeeByDay scope={SCOPE} />);
    expectEmpty(screen.getByTestId('report-oee'));
    responses.oee.data.groups = saved;
  });

  it('Loss value (a PLA report): no units', () => {
    onReports(<LossValueCard scope={SCOPE} />);
    expectEmpty(screen.getByTestId('report-loss-value'));
  });
});

describe('reportText', () => {
  it('titles: drops the words and starts with a capital', () => {
    expect(reportText('operational OEE (ISO 22400) by plant date')).toBe('Operational OEE');
    expect(reportText('Operational OEE (ISO 22400)')).toBe('OEE');
  });

  it('tooltips: drops the words but never changes the case', () => {
    expect(reportText('good output ÷ scheduled time (ISO 22400).', 'note')).toBe('good output ÷ scheduled time.');
    expect(reportText('Operational OEE: good output.', 'note')).toBe('OEE: good output.');
  });
});
