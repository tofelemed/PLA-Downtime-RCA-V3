import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { actAs } from '@/test/acting-user';
import { monthCloseFixture } from './month-close-test-fixtures';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const { MonthClosePage } = await import('./month-close-page');
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('month close page cleanup', () => {
  let view: MonthCloseView;
  let unconfigure: () => void;
  function mount(search = '?month=1405-07') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/month-close${search}`]}><MonthClosePage /></MemoryRouter>
    </QueryClientProvider>);
  }
  beforeEach(() => {
    view = monthCloseFixture(); actAs('manager_approver', 'manager');
    unconfigure = configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async () => json(view)));
  });
  afterEach(() => { unconfigure(); vi.unstubAllGlobals(); actAs('SuperAdmin'); });

  it('drops the header description, the count hint, the calendar suffix and the zone suffixes', async () => {
    view.prerequisites = { ...view.prerequisites, met: false, monthEnded: false, monthEndsAt: '2026-10-23T02:30:00Z' };
    mount(); await screen.findByTestId('close-prerequisites');
    const page = screen.getByTestId('month-close');
    expect(page).not.toHaveTextContent('Close the plant');
    expect(page).not.toHaveTextContent('Select a count');
    expect(page).not.toHaveTextContent('Solar Hijri month');
    expect(page).not.toHaveTextContent('Asia/Tehran');
    expect(page).not.toHaveTextContent('Working days skip');
    expect(page).not.toHaveTextContent('finance signs off independently');
    expect(page).not.toHaveTextContent('Settle open proposals');
    expect(page).not.toHaveTextContent('the quantities can be closed after that');
    expect(screen.getByTestId('close-headline')).toBeVisible();
    expect(screen.getByTestId('deadline-quantities')).toBeVisible();
    expect(screen.getByTestId('signoff-finance')).toBeVisible();
    expect(screen.getByTestId('step-close-quantities')).toBeDisabled();
    expect(screen.getByTestId('close-blocked')).toHaveTextContent('Month not ended yet.');
  });

  it('keeps the definitions behind info tooltips next to the card titles', async () => {
    mount(); await screen.findByTestId('close-prerequisites');
    expect(screen.getByRole('button', { name: 'About Status and deadlines' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'About Sign-offs' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Sign-offs' })).toBeVisible();
  });

  it('shows the uncovered days as a short line with the table in a compact card', async () => {
    view.prerequisites = { ...view.prerequisites, uncoveredDayCount: 1, uncoveredDays: [{ unitId: 'u1', unitName: 'Extruder 1', localDate: '2026-10-23', shifts: 3 }] };
    mount(); await screen.findByTestId('uncovered-days');
    const note = screen.getByTestId('uncovered-days');
    expect(note).toHaveTextContent('1 production day has no approved plan');
    expect(note).not.toHaveTextContent('Their periods are not counted');
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Operational date' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Plans' })).toBeVisible();
  });

  it('removes the section descriptions of the list tabs but keeps counts and the My work link', async () => {
    mount(); await screen.findByTestId('close-prerequisites');
    await userEvent.click(screen.getByRole('tab', { name: 'Periods' }));
    expect(screen.getByRole('heading', { name: /Periods/ })).toBeVisible();
    expect(screen.getByTestId('month-close')).not.toHaveTextContent('not a complete list');
    expect(screen.getByRole('link', { name: 'Open My work' })).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByTestId('month-close')).not.toHaveTextContent('newest first');
  });
});
