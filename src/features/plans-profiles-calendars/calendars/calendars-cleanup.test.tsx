import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));

const REFS = {
  timezone: 'Asia/Tehran',
  timezoneIsFallback: false,
  unitOptions: [{ value: 'u1', label: 'Unit 1' }],
  productOptions: [],
  siteOptions: [],
  defaultSiteId: 's1',
  unitName: () => 'Unit 1',
  productName: () => 'HDPE',
  loading: false,
};
vi.mock('../hooks/use-planning-refs', () => ({ usePlanningRefs: () => REFS }));

const { PlanningPage } = await import('../planning-page');
const { NewCalendarVersionPage } = await import('./calendar-editor-page');

const VERSION = {
  id: 'cal-1', version: 1, state: 'published', siteId: 's1', unitId: null, timezone: 'Asia/Tehran', operationalDayStart: '06:00', effectiveFrom: '2026-10-17',
  effectiveTo: null, shiftTemplates: [{ name: 'A', startLocal: '06:00', endLocal: '18:00', daysOfWeek: [] }], workingIntervals: [], holidays: [], exclusions: [], rowVersion: 1,
};
const CREW = { id: 'crew-1', siteId: 's1', name: 'Crew A', rowVersion: 1, createdAt: '' };

function open(at = '/setup/calendars') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/setup/calendars" element={<PlanningPage view="calendars" />} />
          <Route path="/planning/calendars/new" element={<NewCalendarVersionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const footerLabels = (dialog: HTMLElement) => within(within(dialog).getByTestId('form-buttons')).getAllByRole('button').map((b) => b.textContent);

describe('Calendars & crews cleanup', () => {
  let crews: unknown[];
  beforeEach(() => {
    actAs('SuperAdmin');
    crews = [CREW];
    stubV2Fetch((call) => {
      if (call.method !== 'GET') return undefined;
      if (call.url.pathname.endsWith('/calendar-versions')) return jsonResponse(200, listPage([VERSION]));
      if (call.url.pathname.endsWith('/crews')) return jsonResponse(200, listPage(crews));
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('says the calendar note behind an ⓘ beside the title, not in a banner; New calendar version is beside the title', async () => {
    open();
    await screen.findByTestId('calendar-version-row');
    expect(screen.queryByText(/Create and publish the plant calendar here/)).toBeNull();
    expect(screen.getByTestId('decision-banner')).toHaveAttribute('data-decision', 'calendar');
    expect(within(screen.getByTestId('decision-banner')).getByRole('button', { name: /About/ })).toBeInTheDocument();
    const header = screen.getByRole('heading', { level: 1 }).closest('header');
    expect(header?.querySelector('[data-testid="calendar-new"]')).toBeTruthy();
  });

  it('versions sit in a titled card without the scope hint or a repeated "Applies to" column; data kept', async () => {
    open();
    await screen.findByTestId('calendar-version-row');
    expect(screen.queryByText(/newest published version in force wins/)).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Calendar versions' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Applies to' })).toBeNull();
    for (const name of ['Version', 'Time zone', 'Effective from', 'Effective to', 'Shifts', 'State']) expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar of')).toHaveClass('h-9');
  });

  it('crews: a card with a centred empty state until a crew is chosen; no crews says so', async () => {
    open();
    expect(await screen.findByText('No crew chosen')).toBeInTheDocument();
    expect(screen.getByTestId('crew-empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Crews and rotations' })).toBeInTheDocument();
  });

  it('crews: without any crew the card says so', async () => {
    crews = [];
    open();
    expect(await screen.findByText('No crews')).toBeInTheDocument();
  });

  it('Add crew: title with ⓘ (no description), name focused, missing name under the field, Cancel then Add crew, Esc closes', async () => {
    open();
    await screen.findByText('No crew chosen');
    fireEvent.click(screen.getByTestId('crew-add'));
    const dialog = await screen.findByRole('dialog', { name: 'Add crew' });
    expect(within(dialog).queryByText(/only label shift instances/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Add crew' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/Crew name/)));
    expect(footerLabels(dialog)).toEqual(['Cancel', 'Add crew']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add crew' }));
    expect(await within(dialog).findByText('Enter the crew name.')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Add rotation: typed plant-format dates (h-9, calendar button), each missing field said under it, Cancel then Add rotation', async () => {
    open();
    await screen.findByText('No crew chosen');
    await waitFor(() => expect(screen.getByTestId('rotation-add')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('rotation-add'));
    const dialog = await screen.findByRole('dialog', { name: 'Add rotation' });
    expect(within(dialog).queryByText(/re-assigns the crew/)).toBeNull();
    const anchor = within(dialog).getByLabelText(/^Cycle day 1/);
    expect(anchor).toHaveAttribute('type', 'text');
    expect(anchor).toHaveClass('h-9');
    expect(within(dialog).getAllByRole('button', { name: /calendar/i }).length).toBeGreaterThan(0);
    expect(footerLabels(dialog)).toEqual(['Cancel', 'Add rotation']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add rotation' }));
    for (const text of ['Choose a crew.', 'Enter the shift cycle.', 'Enter cycle day 1.', 'Enter the date it applies from.']) expect(await within(dialog).findByText(text)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('new calendar version: effective dates are typed in the plant format (h-9); the preview waits in a centred empty state', async () => {
    open('/planning/calendars/new');
    const from = await screen.findByLabelText(/^Effective from \(operational date\)/);
    expect(from).toHaveAttribute('type', 'text');
    expect(from).toHaveClass('h-9');
    expect(screen.getByTestId('preview-empty')).toHaveTextContent('No preview yet');
  });
});
