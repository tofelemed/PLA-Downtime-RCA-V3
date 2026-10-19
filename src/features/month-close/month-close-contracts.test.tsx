import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { MonthCloseState, MonthCloseStep, MonthCloseView } from '@/api/v2/types/month-close';
import { actAs } from '@/test/acting-user';
import { monthCloseFixture, cappedMonthCloseFixture } from './month-close-test-fixtures';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const { MonthClosePage } = await import('./month-close-page');
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
interface Call { path: string; method: string; body: unknown; headers: Headers }

function LocationProbe() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="test-location">{location.search}</output>
    <button onClick={() => navigate(-1)}>Test Back</button><button onClick={() => navigate(1)}>Test Forward</button></>;
}

describe('month-close contracts retained during section restructuring', () => {
  let view: MonthCloseView;
  let calls: Call[];
  let postStatus: number;
  let unconfigure: () => void;
  function mount(search = '?month=1405-07') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/month-close${search}`]}><MonthClosePage /><LocationProbe /></MemoryRouter>
    </QueryClientProvider>);
  }
  beforeEach(() => {
    view = monthCloseFixture(); calls = []; postStatus = 200; actAs('SuperAdmin', 'user-1');
    unconfigure = configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname; const method = init.method ?? 'GET';
      calls.push({ path, method, body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) });
      if (method === 'POST' && postStatus !== 200) return json(postStatus, {
        code: 'MONTH_PREREQUISITES', message: 'Month prerequisites changed; refresh and retry.', retryable: false, correlationId: 'close-refusal',
      });
      const key = path.split('/').at(-1)!;
      return json(200, method === 'GET' && key !== 'current' ? { ...view, monthKey: key } : view);
    }));
  });
  afterEach(() => { unconfigure(); vi.unstubAllGlobals(); actAs('SuperAdmin'); });

  it('uses the server month keys and preserves section/unrelated query state through month Back/Forward', async () => {
    mount('?month=1405-07&section=history&source=review');
    await screen.findByTestId('month-label');
    fireEvent.click(screen.getByTestId('month-previous'));
    await waitFor(() => expect(screen.getByTestId('month-label')).toHaveTextContent('Shahrivar 1405'));
    expect(screen.getByTestId('test-location')).toHaveTextContent('month=1405-06&section=history&source=review');
    fireEvent.click(screen.getByRole('button', { name: 'Test Back' }));
    await waitFor(() => expect(screen.getByTestId('month-label')).toHaveTextContent('Mehr 1405'));
    fireEvent.click(screen.getByRole('button', { name: 'Test Forward' }));
    await waitFor(() => expect(screen.getByTestId('month-label')).toHaveTextContent('Shahrivar 1405'));
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('the original URL without a month reads current once without a write', async () => {
    mount(''); await screen.findByTestId('month-label');
    expect(calls).toHaveLength(1); expect(calls[0].path).toMatch(/\/month-closes\/current$/);
    expect(calls[0].headers.get('X-Tenant-Id')).toBe('tenant-a'); expect(calls[0].method).toBe('GET');
  });

  it('retains complete prerequisite counts independently from capped samples without inventing period links', async () => {
    view = cappedMonthCloseFixture(); mount();
    expect(await screen.findByTestId('step-close-quantities')).toBeDisabled();
    expect(screen.getByTestId('close-count-periods-value')).toHaveTextContent('70');
    expect(screen.getByTestId('close-count-days-value')).toHaveTextContent('60');
    expect(screen.getByTestId('close-count-proposals-value')).toHaveTextContent('56');
    await userEvent.click(screen.getByRole('tab', { name: 'Periods' }));
    const pending = await screen.findByTestId('pending-periods');
    expect(pending.querySelectorAll('tbody tr')).toHaveLength(50); expect(pending.querySelector('table a[href^="/plans/"]')).toBeNull();
    // a row without its plan (an older server) says so and leads to Plans, never to an invented period link
    expect(within(pending).getAllByTestId('no-plan')[0]).toHaveTextContent('No approved plan covers this period');
    expect(screen.getByText(/First 50 of 70 shown/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open my queue' })).toHaveAttribute('href', '/my-queue');
    await userEvent.click(screen.getByRole('tab', { name: 'Days' }));
    const days = screen.getByTestId('uncertified-days');
    expect(days.querySelectorAll('tbody tr')).toHaveLength(50); expect(days.querySelector('a')).toBeNull();
    expect(screen.getByText(/First 50 of 60 shown/)).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Proposals' }));
    expect(screen.getByText(/56 open change proposals/)).toBeVisible();
    expect(screen.getByText(/First 50 of 56 shown/)).toBeVisible();
    expect(screen.getByTestId('open-proposals').querySelectorAll('tbody tr')).toHaveLength(50);
    expect(screen.getByTestId('open-proposals').querySelectorAll('a')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open period' })).toHaveAttribute('href', '/plans/plan-a/periods/period-0');
  });

  it.each<MonthCloseState>(['open', 'quantities_closed', 'finance_signed_off', 'locked'])('viewer has no mutation controls in %s', async (state) => {
    actAs('viewer'); view.state = state; mount(); await screen.findByTestId('close-actions');
    expect(screen.getByTestId('close-actions').querySelectorAll('button')).toHaveLength(0);
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('keeps required materiality review separate from quantity and finance sign-offs', async () => {
    actAs('production_accountant', 'accountant'); view.state = 'quantities_closed';
    view.signOffs.materialityRequired = true; view.materiality.findings = [{ quantity: '2.5', uom: 't', threshold: '1' }];
    mount(); expect(await screen.findByTestId('step-materiality-review')).toBeEnabled();
    expect(screen.queryByTestId('step-finance-sign-off')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-close-quantities')).not.toBeInTheDocument();
    expect(screen.getByTestId('materiality-findings')).toHaveTextContent('2.5 t adjusted (threshold 1 t)');
  });

  it('blocks finance sign-off until the required review exists even for an independent signer', async () => {
    actAs('finance_approver', 'finance'); view.state = 'quantities_closed'; view.signOffs.materialityRequired = true;
    view.signOffs.quantitiesClosedBy = { id: 'manager', name: 'Manager' }; mount();
    expect(await screen.findByTestId('step-finance-sign-off')).toBeDisabled();
    expect(screen.queryByTestId('close-sod')).not.toBeInTheDocument();
  });

  it.each<[MonthCloseStep, MonthCloseState, string, string]>([
    ['close-quantities', 'open', 'manager_approver', 'Close quantities'],
    ['materiality-review', 'quantities_closed', 'production_accountant', 'Confirm review'],
    ['finance-sign-off', 'quantities_closed', 'finance_approver', 'Sign off'],
    ['lock', 'finance_signed_off', 'finance_approver', 'Lock month'],
  ])('retains the %s endpoint, explicit confirmation, comment and idempotency key', async (step, state, role, confirm) => {
    actAs(role, 'independent-user'); view.state = state;
    view.signOffs.quantitiesClosedBy = { id: 'manager', name: 'Manager' };
    view.signOffs.materialityRequired = step === 'materiality-review';
    mount(); fireEvent.click(await screen.findByTestId(`step-${step}`));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByTestId(`step-${step}-text`), { target: { value: '  Reviewed evidence  ' } });
    if (step === 'lock') fireEvent.change(screen.getByTestId('step-lock-confirm'), { target: { value: 'Mehr 1405' } });
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: confirm }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.path).toMatch(new RegExp(`/month-closes/1405-07/${step}$`));
    expect(post.body).toEqual({ comment: 'Reviewed evidence' });
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('locking is destructive and needs the month typed as shown; it says it cannot be undone', async () => {
    actAs('finance_approver', 'independent-user'); view.state = 'finance_signed_off';
    view.signOffs.quantitiesClosedBy = { id: 'manager', name: 'Manager' };
    mount(); fireEvent.click(await screen.findByTestId('step-lock'));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Lock Mehr 1405?');
    expect(dialog).toHaveTextContent('cannot be undone');
    const confirm = within(dialog).getByRole('button', { name: 'Lock month' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('step-lock-confirm'), { target: { value: '1405-07' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('step-lock-confirm'), { target: { value: ' mehr  1405 ' } });
    expect(confirm).toBeEnabled();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('keeps a refused confirmation open with the entered comment and error', async () => {
    actAs('manager_approver'); postStatus = 409; mount();
    fireEvent.click(await screen.findByTestId('step-close-quantities'));
    fireEvent.change(screen.getByTestId('step-close-quantities-text'), { target: { value: 'Review notes' } });
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close quantities' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByTestId('step-close-quantities-text')).toHaveValue('Review notes');
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toBeVisible());
  });

  it('a locked month has no lock or reopen action for finance', async () => {
    actAs('finance_approver'); view.state = 'locked'; mount();
    await screen.findByTestId('locked-note');
    expect(screen.queryByTestId('step-lock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-reopen')).not.toBeInTheDocument();
  });

  it.each([true, false])('a locked month explains after-close proposals with blocking policy %s', async (blockOnOpenProposals) => {
    view = cappedMonthCloseFixture(); view.state = 'locked'; view.policy.blockOnOpenProposals = blockOnOpenProposals;
    mount(); await screen.findByTestId('close-prerequisites');
    expect(screen.getByTestId('close-prerequisites')).toHaveTextContent('Month locked.');
    expect(screen.getByTestId('close-count-proposals')).toHaveTextContent('after-close correction workflow');
    expect(screen.queryByText(/before closing/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Proposals' }));
    expect(screen.getByTestId('open-proposals')).toHaveTextContent('Review open proposals from their period through the after-close correction workflow.');
    expect(screen.queryByText(/before closing/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open period' })).toHaveAttribute('href', '/plans/plan-a/periods/period-0');
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('QA P-7: finance sees its own steps disabled with the reason until they are reachable', async () => {
    actAs('finance_approver', 'kamran'); view.state = 'open'; mount();
    const signOff = await screen.findByTestId('step-finance-sign-off');
    expect(signOff).toBeDisabled();
    expect(signOff).toHaveAccessibleDescription(/Plant management closes the quantities first/);
    const lock = screen.getByTestId('step-lock');
    expect(lock).toBeDisabled();
    expect(lock).toHaveAccessibleDescription(/Finance signs off the month first/);
    expect(screen.queryByTestId('step-close-quantities')).not.toBeInTheDocument();
  });

  it('QA P-0: days no approved plan covers are information with a way to Plans; pending periods link to their page', async () => {
    actAs('manager_approver', 'reza');
    view.prerequisites.uncoveredDayCount = 2;
    view.prerequisites.uncoveredDays = [
      { unitId: 'u1', unitName: 'HDPE Extruder 1', localDate: '2026-10-18', shifts: 3 },
      { unitId: 'u1', unitName: 'HDPE Extruder 1', localDate: '2026-10-19', shifts: 1 },
    ];
    view.prerequisites.pending = [{ periodId: 'p-9', unitId: 'u1', unitName: 'HDPE Extruder 1', localDate: '2026-10-17', shiftName: 'A', workflow: 'draft', planId: 'plan-a' }];
    view.prerequisites.pendingCount = 1;
    mount();
    const notice = await screen.findByTestId('uncovered-days');
    expect(notice).toHaveTextContent('2 production days have no approved plan.');
    expect(notice).toHaveTextContent('not counted above');
    expect(within(notice).getByRole('link', { name: 'Open Plans' })).toHaveAttribute('href', '/planning?tab=plans');
    expect(within(notice).getAllByRole('row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('tab', { name: 'Periods' }));
    expect(await screen.findByTestId('pending-open')).toHaveAttribute('href', '/plans/plan-a/periods/p-9');
  });
});
