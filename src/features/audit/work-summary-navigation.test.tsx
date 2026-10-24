import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));
vi.mock('@/features/event-hub/event-hub-env', () => ({ EventHubEnvProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ units: [], unitsLoading: false }) }));
vi.mock('@/features/pla-analytics/reports/reports-header', () => ({ ReportsHeader: () => <h1>Reports</h1> }));
vi.mock('@/features/pla-analytics/hooks/use-production-day-start', () => ({ useProductionDayStart: () => ({ dayStart: '06:00', loading: false }) }));
// the Reports filter row now carries the report picker (Reports cleanup, 24 Oct 2026): render only that slot
vi.mock('@/features/pla-analytics/reports/reports-filters', () => ({ ReportsFilters: ({ picker }: { picker: ReactNode }) => <>{picker}</> }));
vi.mock('@/features/pla-analytics/reports/production-report', () => ({ OeeByDay: () => null, DowntimeReasonCard: () => null }));

const { AuditPage } = await import('./audit-page');
const { ReportsV2Page } = await import('@/features/pla-analytics/reports/reports-page');
const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-08T00:00:00.000Z';
const WINDOW = `from=${FROM}&to=${TO}`;
const workItems = { total: 2, open: 1, overdue: 0, byStatus: [], byPriority: [], createdByDay: [] };
const activity = { timezone: 'Asia/Tehran', rcaCases: workItems, tasks: workItems, audit: { total: 3, byAction: [], byEntityType: [], byDay: [] } };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe('Work summary under Audit Logs', () => {
  let calls: URL[];
  let client: QueryClient;
  const open = (path: string) => render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Routes>
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/reports" element={<ReportsV2Page />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  beforeEach(() => {
    actAs('SuperAdmin');
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const request = new URL(url);
      calls.push(request);
      if (request.pathname.endsWith('/reports/activity-summary')) return json({ data: activity, from: FROM, to: TO, asOf: TO });
      if (request.pathname.endsWith('/audit-logs/summary')) return json({ total: 3, byAction: [{ key: 'UPDATE', count: 3 }], byEntityType: [], byDay: [] });
      return json({ items: [], nextCursor: null, asOf: TO, scope: { tenantId: 'tenant-a' } });
    }));
  });
  afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('defaults to audit entries and loads work summary only when selected', async () => {
    open(`/audit?${WINDOW}&action=UPDATE&q=extruder`);
    expect(screen.getByRole('tab', { name: 'Entries' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(calls.some((url) => url.pathname.endsWith('/audit-logs'))).toBe(true));
    expect(calls.some((url) => url.pathname.endsWith('/activity-summary'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Work summary' }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('Investigations')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(within(screen.getByTestId('report-audit-activity')).getByRole('heading', { name: 'Audit activity' })).toBeInTheDocument();
    expect(within(screen.getByTestId('report-audit-activity')).getByText('3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Action filter')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    const request = calls.find((url) => url.pathname.endsWith('/activity-summary'));
    expect(request?.searchParams.get('from')).toBe(FROM);
    expect(request?.searchParams.get('to')).toBe(TO);
    expect(request?.searchParams.has('q')).toBe(false);
    expect(request?.searchParams.has('actions')).toBe(false);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Entries' }), { button: 0, ctrlKey: false });
    expect(screen.getByLabelText('Search actions, records and details')).toHaveValue('extruder');
    await waitFor(() => expect(screen.getByLabelText('Action filter')).toHaveTextContent('Changed'));
    expect(screen.getByTestId('location').textContent).toContain(`from=${encodeURIComponent(FROM)}`);
  });

  it('opens the summary directly without requesting audit entries', async () => {
    open(`/audit?view=work-summary&${WINDOW}`);
    expect(await screen.findByText('Investigations')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Work summary' })).toHaveAttribute('aria-selected', 'true');
    expect(calls.some((url) => url.pathname.includes('/audit-logs'))).toBe(false);
  });

  it('redirects old report activity links, preserving dates and dropping report-only filters', async () => {
    open(`/reports?view=activity&${WINDOW}&units=u1&approved=1`);
    expect(await screen.findByText('Investigations')).toBeInTheDocument();
    const location = screen.getByTestId('location').textContent ?? '';
    expect(location).toMatch(/^\/audit\?view=work-summary/);
    expect(location).toContain(`from=${encodeURIComponent(FROM)}`);
    expect(location).toContain(`to=${encodeURIComponent(TO)}`);
    expect(location).not.toContain('units=');
    expect(location).not.toContain('approved=');
  });

  it('cleanup (25 Oct 2026): no description or section captions; one labelled filter row; charts open on request', async () => {
    open(`/audit?${WINDOW}`);
    await waitFor(() => expect(screen.getByLabelText('Action filter')).toHaveTextContent('All actions'));
    expect(screen.queryByText(/Changes, work items and audit activity/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Period' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Filters' })).toBeNull();
    expect(screen.queryByText(/Activity uses the selected period/)).toBeNull();
    ['Search', 'Action', 'Record'].forEach((name) => expect(screen.getByText(name, { selector: 'label' })).toBeInTheDocument());
    expect(within(screen.getByTestId('audit-filters')).getByLabelText('From')).toBeInTheDocument();
    const activity = screen.getByTestId('audit-activity');
    expect(within(activity).getByRole('button', { name: 'About Activity' })).toBeInTheDocument();
    await waitFor(() => expect(within(activity).getByText('3')).toBeInTheDocument());
    const toggle = within(activity).getByRole('button', { name: 'Show charts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(within(activity).getByRole('button', { name: 'Hide charts' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByTestId('audit-entries')).getByText('Nothing was recorded for these filters.')).toBeInTheDocument();
  });

  it('work summary: no intro paragraph (ⓘ on the cards); only the period in the filter row', async () => {
    open(`/audit?view=work-summary&${WINDOW}`);
    expect(await screen.findByText('Investigations')).toBeInTheDocument();
    expect(screen.queryByText(/Records created on the chosen dates/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Investigations' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Search actions, records and details')).toBeNull();
    expect(within(screen.getByTestId('audit-filters')).getByLabelText('From')).toBeInTheDocument();
  });

  it('removes Work summary from Reports while retaining the production reports', () => {
    open(`/reports?${WINDOW}`);
    const reports = () => within(screen.getByTestId('report-view')).getAllByRole('option').map((option) => option.textContent);
    expect(reports()).toContain('OEE and downtime');
    fireEvent.change(screen.getByLabelText('Report type'), { target: { value: 'pla' } });
    expect(reports()).toEqual(expect.arrayContaining(['Reconciliation', 'Loss value']));
    fireEvent.change(screen.getByLabelText('Report type'), { target: { value: 'management' } });
    expect(reports()).toContain('Exports');
    expect(screen.queryByRole('option', { name: 'Work summary' })).not.toBeInTheDocument();
  });

  it.each(['Operator', 'Engineer', 'viewer'])('keeps summary behind the audit access gate for %s', async (role) => {
    actAs(role);
    open(`/audit?view=work-summary&${WINDOW}`);
    expect(await screen.findByText("You don't have permission to read the audit log.")).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Work summary' })).not.toBeInTheDocument();
    expect(calls.some((url) => url.pathname.endsWith('/activity-summary'))).toBe(false);
  });

  it.each(['TenantAdmin', 'Manager'])('allows existing audit readers (%s) to open the summary', async (role) => {
    actAs(role);
    open(`/audit?view=work-summary&${WINDOW}`);
    expect(await screen.findByText('Investigations')).toBeInTheDocument();
  });
});
