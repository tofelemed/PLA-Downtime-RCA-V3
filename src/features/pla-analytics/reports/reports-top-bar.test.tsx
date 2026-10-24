import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));
vi.mock('@/features/event-hub/event-hub-env', () => ({ EventHubEnvProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'Asia/Tehran', units: [], unitsLoading: false, unitName: (id: string) => id }) }));
vi.mock('@/features/pla-analytics/hooks/use-production-day-start', () => ({ useProductionDayStart: () => ({ dayStart: '06:00', loading: false }) }));
vi.mock('./reports-header', () => ({ ReportsHeader: () => <h1>Reports</h1> }));
vi.mock('./report-view-body', () => ({ ReportViewBody: ({ view }: { view: string }) => <div data-testid="shown-view">{view}</div> }));

const { ReportsV2Page } = await import('./reports-page');

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const open = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/reports${search}`]}>
      <Routes>
        <Route path="/reports" element={<><ReportsV2Page /><Location /></>} />
      </Routes>
    </MemoryRouter>,
  );

const optionsOf = (testId: string) => within(screen.getByTestId(testId)).getAllByRole('option').map((option) => option.textContent);
const params = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

describe('Reports top bar: report type → report', () => {
  it('defaults to OEE and downtime under Downtime, listing only Downtime reports', () => {
    open();
    expect(screen.getByLabelText('Report type')).toHaveValue('downtime');
    expect(screen.getByLabelText('Report')).toHaveValue('production');
    expect(optionsOf('report-type')).toEqual(['Production loss (PLA)', 'Downtime', 'Reliability & RCA', 'Management']);
    expect(optionsOf('report-view')).toEqual(['OEE and downtime', 'Shift handover', 'Chronic vs sporadic', 'Coding compliance']);
    expect(screen.getByTestId('shown-view')).toHaveTextContent('production');
  });

  it('changing the type selects its first report and writes ?view=, keeping the other params', () => {
    open('?units=u1&approved=0');
    fireEvent.change(screen.getByLabelText('Report type'), { target: { value: 'pla' } });
    expect(params().get('view')).toBe('daily');
    expect(params().get('units')).toBe('u1');
    expect(params().get('approved')).toBe('0');
    expect(optionsOf('report-view')).toEqual([
      'Daily production', 'Monthly statement', 'Reconciliation', 'Loss value', 'Rate loss', 'Plan adherence', 'Quality and off-grade', 'Grade transitions',
    ]);
    fireEvent.change(screen.getByLabelText('Report type'), { target: { value: 'reliability' } });
    expect(optionsOf('report-view')).toEqual(['Reliability trend', 'RCA actions']);
    fireEvent.change(screen.getByLabelText('Report type'), { target: { value: 'management' } });
    expect(params().get('view')).toBe('scorecard');
    expect(optionsOf('report-view')).toEqual(['Executive scorecard', 'Exports']);
  });

  it('changing the report writes ?view= and shows it', () => {
    open('?view=daily');
    fireEvent.change(screen.getByLabelText('Report'), { target: { value: 'value' } });
    expect(params().get('view')).toBe('value');
    expect(screen.getByTestId('shown-view')).toHaveTextContent('value');
  });

  it.each([
    ['rca', 'reliability'],
    ['exports', 'management'],
    ['reconciliation', 'pla'],
    ['compliance', 'downtime'],
  ])('an old ?view=%s link opens that report under its type', (view, type) => {
    open(`?view=${view}`);
    expect(screen.getByLabelText('Report type')).toHaveValue(type);
    expect(screen.getByLabelText('Report')).toHaveValue(view);
    expect(screen.getByTestId('shown-view')).toHaveTextContent(view);
  });

  it('an unknown view falls back to OEE and downtime', () => {
    open('?view=nope');
    expect(screen.getByLabelText('Report')).toHaveValue('production');
  });
});

describe('Reports top bar: dates and revision', () => {
  it('labels the dates From and To, each with a calendar button', () => {
    open();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.queryByLabelText('To (inclusive)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open calendar for From' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open calendar for To' })).toBeInTheDocument();
  });

  it('offers exactly "Approved only" (default) and "Provisional", kept in ?approved=', () => {
    open();
    expect(optionsOf('report-revision')).toEqual(['Approved only', 'Provisional']);
    const revision = screen.getByLabelText('Revision');
    expect(revision).toHaveValue('approved');
    fireEvent.change(revision, { target: { value: 'shown' } });
    expect(params().get('approved')).toBe('0');
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'approved' } });
    expect(params().get('approved')).toBeNull();
  });

  it('keeps the order type, report, dates, units, revision', () => {
    open();
    const bar = screen.getByTestId('reports-top-bar');
    const order = ['report-type', 'report-view', 'From', 'report-units', 'report-revision'].map((key) =>
      key === 'From' ? screen.getByLabelText('From') : within(bar).getByTestId(key),
    );
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index - 1].compareDocumentPosition(order[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('gives every control one height (h-9): selects, date fields, calendar buttons, units', () => {
    open();
    const bar = screen.getByTestId('reports-top-bar');
    const controls = within(bar).getAllByRole('combobox').concat(within(bar).getAllByRole('button'), [screen.getByLabelText('From'), screen.getByLabelText('To')]);
    expect(controls.length).toBeGreaterThanOrEqual(8);
    for (const control of controls) {
      expect(control.className).toMatch(/(^|\s)h-9(\s|$)/);
      expect(control.className).not.toMatch(/(^|\s)h-10(\s|$)/);
    }
  });

  it('is one wrapping row: the filters are items of the bar, not a nested group', () => {
    open();
    expect(screen.queryByTestId('reports-filters')).toBeNull();
    const bar = screen.getByTestId('reports-top-bar');
    const boxed = [...bar.children].filter((child) => !child.classList.contains('contents'));
    // type, report, units, revision (the From / To fieldset takes no box: its fields are items of the bar)
    expect(boxed).toHaveLength(4);
    const dates = screen.getByRole('group', { name: 'Period dates' });
    expect(dates.parentElement).toBe(bar);
    expect(dates).toHaveClass('contents');
  });
});
