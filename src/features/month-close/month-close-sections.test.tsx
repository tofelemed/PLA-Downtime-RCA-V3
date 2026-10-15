import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { actAs } from '@/test/acting-user';
import { monthCloseFixture, cappedMonthCloseFixture } from './month-close-test-fixtures';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const { MonthClosePage } = await import('./month-close-page');
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
interface Call { path: string; method: string }

function NavigationProbe() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="test-location">{location.search}</output>
    <button onClick={() => navigate(-1)}>Test Back</button><button onClick={() => navigate(1)}>Test Forward</button>
    <button onClick={() => navigate('/month-close?month=1405-06')}>Test external month change</button>
    <button onClick={() => navigate('/month-close?month=1405-07&section=history')}>Test external section change</button></>;
}

describe('month-close section navigation and command ownership', () => {
  let view: MonthCloseView;
  let calls: Call[];
  let unconfigure: () => void;
  let postReply: (() => Promise<Response>) | undefined;
  function mount(search = '?month=1405-07') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/month-close${search}`]}><MonthClosePage /><NavigationProbe /></MemoryRouter>
    </QueryClientProvider>);
  }
  beforeEach(() => {
    view = monthCloseFixture(); calls = []; postReply = undefined; actAs('manager_approver', 'manager');
    unconfigure = configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname; const method = init.method ?? 'GET'; calls.push({ path, method });
      if (method === 'POST' && postReply) return postReply();
      const month = path.split('/').at(-1)!;
      return json(method === 'GET' && month !== 'current' ? { ...view, monthKey: month } : view);
    }));
  });
  afterEach(() => { unconfigure(); vi.unstubAllGlobals(); actAs('SuperAdmin'); });

  it.each([
    ['overview', 'Overview', 'close-prerequisites'], ['periods', 'Periods', 'pending-periods'],
    ['days', 'Days', 'uncertified-days'], ['proposals', 'Proposals', 'open-proposals'], ['history', 'History', 'close-history-empty'],
  ])('loads and remounts the %s bookmark without changing its query', async (section, label, panel) => {
    const search = `?month=1405-07&section=${section}&source=review`;
    const first = mount(search); await screen.findByTestId(panel);
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('test-location')).toHaveTextContent(search);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    if (section !== 'overview') expect(screen.queryByTestId('close-sign-offs')).not.toBeInTheDocument();
    first.unmount(); mount(search); await screen.findByTestId(panel);
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('falls back from an invalid section to overview without replacing the URL', async () => {
    mount('?month=1405-07&section=missing&source=review');
    await screen.findByTestId('close-prerequisites');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('test-location')).toHaveTextContent('section=missing&source=review');
    expect(calls).toHaveLength(1);
  });

  it('count links, tabs and Back/Forward preserve context without additional monthly reads', async () => {
    view = cappedMonthCloseFixture(); mount('?month=1405-07&source=review');
    await userEvent.click(await screen.findByTestId('close-count-periods'));
    expect(screen.getByTestId('test-location')).toHaveTextContent('month=1405-07&source=review&section=periods');
    await userEvent.click(screen.getByRole('tab', { name: 'Days' }));
    await userEvent.click(screen.getByRole('button', { name: 'Test Back' }));
    expect(screen.getByRole('tab', { name: 'Periods' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Test Forward' }));
    expect(screen.getByRole('tab', { name: 'Days' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    for (const section of ['days', 'proposals']) {
      expect(screen.getByTestId(`close-count-${section}`)).toHaveAttribute('href', `/month-close?month=1405-07&source=review&section=${section}`);
    }
    expect(screen.getAllByTestId('close-sign-offs')).toHaveLength(1);
    expect(screen.queryByTestId('pending-periods')).not.toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('keyboard arrows select and focus tabs with a single visible associated panel', async () => {
    mount(); await screen.findByTestId('close-prerequisites');
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Periods' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: 'Periods' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Periods' })).toBeVisible();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus();
    expect(await screen.findByTestId('close-history-empty')).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  it('records one navigation when a mouse press and automatic tab focus activate the same section together', async () => {
    mount('?month=1405-07&section=proposals&source=review');
    await screen.findByTestId('open-proposals');
    const history = screen.getByRole('tab', { name: 'History' });
    // Native pointer activation delivers both callbacks before the controlled value rerenders.
    await act(async () => { fireEvent.mouseDown(history, { button: 0, ctrlKey: false }); fireEvent.focus(history); });
    expect(history).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Test Back' }));
    expect(screen.getByRole('tab', { name: 'Proposals' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('test-location')).toHaveTextContent('?month=1405-07&section=proposals&source=review');
    await userEvent.click(screen.getByRole('button', { name: 'Test Forward' }));
    expect(history).toHaveAttribute('aria-selected', 'true');
    expect(calls).toHaveLength(1);
  });

  it.each([['periods', 'pending'], ['days', 'uncertifiedDays'], ['proposals', 'openProposals']] as const)('discloses a missing %s sample without presenting an empty backlog', async (section, key) => {
    view = cappedMonthCloseFixture(); view.prerequisites[key] = [];
    mount(`?month=1405-07&section=${section}`);
    expect(await screen.findByText(/records reported; sample rows are unavailable/)).toBeVisible();
    expect(screen.getByText('Sample unavailable')).toBeVisible();
    expect(screen.queryByRole('navigation', { name: /pages/ })).not.toBeInTheDocument();
  });

  it('distinguishes policy-disabled blockers while retaining their reported counts and lists', async () => {
    view = cappedMonthCloseFixture(); view.policy.requireCertifiedDays = false; view.policy.blockOnOpenProposals = false;
    mount(); await screen.findByTestId('close-prerequisites');
    expect(screen.getByTestId('close-count-days')).toHaveTextContent('60');
    expect(screen.getByTestId('close-count-days')).toHaveTextContent('does not block close');
    expect(screen.getByTestId('close-count-proposals')).toHaveTextContent('56');
    expect(screen.getByTestId('close-count-proposals')).toHaveTextContent('do not block close');
    await userEvent.click(screen.getByRole('tab', { name: 'Days' }));
    expect(screen.getByText('Certification does not block close under this policy.')).toBeVisible();
    expect(screen.getByRole('table', { name: 'Days not certified' }).querySelectorAll('tbody tr')).toHaveLength(50);
  });

  it('shows explicit empty states for all lists and history', async () => {
    mount(); await screen.findByTestId('close-prerequisites');
    for (const [label, id] of [['Periods', 'pending-none'], ['Days', 'days-certified'], ['Proposals', 'proposals-none'], ['History', 'close-history-empty']]) {
      await userEvent.click(screen.getByRole('tab', { name: label })); expect(screen.getByTestId(id)).toBeVisible();
    }
  });

  it('shows history directly, including the actor, reason and server timestamp', async () => {
    view.history = [{ id: 'h1', action: 'reopen', fromState: 'finance_signed_off', toState: 'open', actor: { id: 'finance', name: 'Finance reviewer' },
      reason: 'Late laboratory result', detail: {}, createdAt: '2026-10-25T08:00:00Z' }];
    mount('?month=1405-07&section=history'); const history = await screen.findByTestId('close-history');
    expect(history).toHaveTextContent('Month reopened by Finance reviewer: Late laboratory result');
    expect(history.querySelector('time')).toHaveAttribute('datetime', '2026-10-25T08:00:00Z');
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument();
  });

  it('drops an unsubmitted confirmation when browser navigation changes the month', async () => {
    mount(); fireEvent.click(await screen.findByTestId('step-close-quantities'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1405-07');
    fireEvent.change(screen.getByTestId('step-close-quantities-text'), { target: { value: 'Old month notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test external month change', hidden: true }));
    await waitFor(() => expect(screen.getByTestId('month-label')).toHaveTextContent('1405-06'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('step-close-quantities'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1405-06');
    expect(screen.getByTestId('step-close-quantities-text')).toHaveValue('');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close quantities' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST')).toEqual([{ method: 'POST', path: '/api/v2/month-closes/1405-06/close-quantities' }]));
  });

  it('unmounts a confirmation on section navigation without sending a command', async () => {
    mount(); fireEvent.click(await screen.findByTestId('step-close-quantities'));
    fireEvent.click(screen.getByRole('button', { name: 'Test external section change', hidden: true }));
    await screen.findByTestId('close-history-empty');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('an already pending command keeps its original month even when navigation changes the view', async () => {
    let complete!: (response: Response) => void;
    postReply = () => new Promise<Response>((resolve) => { complete = resolve; });
    mount(); fireEvent.click(await screen.findByTestId('step-close-quantities'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close quantities' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Test external month change', hidden: true }));
    await waitFor(() => expect(screen.getByTestId('month-label')).toHaveTextContent('1405-06'));
    complete(json({ ...view, state: 'quantities_closed' }));
    await waitFor(() => expect(screen.getByTestId('step-close-quantities')).toBeEnabled());
    expect(calls.filter((call) => call.method === 'POST')).toEqual([{ method: 'POST', path: '/api/v2/month-closes/1405-07/close-quantities' }]);
  });
});
