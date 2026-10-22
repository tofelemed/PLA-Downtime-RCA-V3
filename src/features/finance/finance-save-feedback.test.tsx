import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { DemandStatusView, FxRateView, ValuationPolicyView } from '@/api/v2/types/valuation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const { FxRatesTab } = await import('./fx/fx-rates-tab');
const { FxVersionActions } = await import('./fx/fx-version-actions');
const { PolicyNewPage } = await import('./policies/policy-new-page');
const { PolicyApprove } = await import('./policies/policy-approve');
const { DemandActions } = await import('./demand/demand-actions');
const { DemandStatusesTab } = await import('./demand/demand-statuses-tab');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const EMPTY = { items: [], nextCursor: null };
const VERSION = { createdBy: 'author-1', approvedBy: null, approvedAt: null, rowVersion: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };

const FX: FxRateView = {
  ...VERSION, id: 'f2', rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: '600000', source: null, provisional: false, version: 2, state: 'draft',
  effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveTo: null,
};
const POLICY: ValuationPolicyView = {
  id: 'p4', version: 4, approved: false, approvedBy: null, approvedAt: null, effectiveFrom: '2099-01-01T00:00:00.000Z', effectiveTo: null,
  body: { defaultBasis: 'contribution_margin' }, reportingCurrencies: ['IRR', 'USD'], notes: null, createdBy: 'author-1', createdAt: '2026-10-10T00:00:00.000Z',
};
const DEMAND = { ...VERSION, id: 'd1', productId: 'prod-1', status: 'demand_constrained', evidence: 'orders', version: 1, state: 'draft', effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveTo: null } as DemandStatusView;
const PRODUCTS = { items: [{ id: 'prod-1', code: 'HD-1', name: 'HDPE film' }], nextCursor: null };

describe('finance — save feedback (DECISIONS 2026-10-22)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode, path = '/finance') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/finance/policies/new" element={node} />
            <Route path="/finance/policies/:id" element={<p>policy page</p>} />
            <Route path="*" element={node} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  const posts = () => calls.filter((call) => call.method === 'POST');
  const setDateTime = (label: string, date: string, time: string) => {
    fireEvent.change(screen.getByLabelText(`${label} date`), { target: { value: date } });
    fireEvent.change(screen.getByLabelText(`${label} time`), { target: { value: time } });
  };

  beforeEach(() => {
    actAs('SuperAdmin', 'author-1');
    calls = [];
    toast.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('an exchange rate draft closes the add dialog and ends in the result dialog: View rate · Back to Exchange rates', async () => {
    reply = (call) => (call.method === 'POST' ? json(201, FX) : json(200, EMPTY));
    wrap(<FxRatesTab />);
    fireEvent.click(screen.getByTestId('fx-new'));
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '600000' } });
    setDateTime('Valid from (UTC)', '2026-10-01', '00:00');
    fireEvent.click(screen.getByTestId('fx-save'));
    const result = await screen.findByTestId('save-result-dialog');
    expect(screen.queryByTestId('fx-form')).toBeNull();
    expect(within(result).getByText('Exchange rate draft saved')).toBeTruthy();
    expect(within(result).getByText('1 USD = 600,000 IRR, version 2')).toBeTruthy();
    expect(within(result).getByRole('link', { name: 'View rate' }).getAttribute('href')).toBe('/finance/fx/f2');
    expect(within(result).getByRole('link', { name: 'Back to Exchange rates' }).getAttribute('href')).toBe('/finance?tab=fx');
    expect(toast).not.toHaveBeenCalled();
  });

  it('a refused exchange rate draft is the red alert at the top of the add dialog; the input stays and no toast', async () => {
    reply = (call) =>
      call.method === 'POST'
        ? json(422, { code: 'VALIDATION_FAILED', message: 'invalid', correlationId: 'corr-1', retryable: false, fieldErrors: [{ field: 'rate', message: 'rate is too large' }] })
        : json(200, EMPTY);
    wrap(<FxRatesTab />);
    fireEvent.click(screen.getByTestId('fx-new'));
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '600000' } });
    setDateTime('Valid from (UTC)', '2026-10-01', '00:00');
    fireEvent.click(screen.getByTestId('fx-save'));
    const alert = await screen.findByTestId('save-failure-alert');
    expect(within(screen.getByTestId('fx-form')).getByTestId('save-failure-alert')).toBe(alert);
    expect(screen.getByTestId('fx-form').firstElementChild).toBe(alert);
    expect((screen.getByLabelText('Rate') as HTMLInputElement).value).toBe('600000');
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it('a new policy version ends in the result dialog (View policy version · Back to Valuation · Next); Cancel is a fixed link', async () => {
    reply = (call) => (call.method === 'POST' ? json(201, POLICY) : json(200, EMPTY));
    wrap(<PolicyNewPage />, '/finance/policies/new');
    const cancel = await screen.findByRole('link', { name: 'Cancel' });
    expect(cancel.getAttribute('href')).toBe('/finance?tab=policies');
    fireEvent.change(screen.getByLabelText('Default management view'), { target: { value: 'contribution_margin' } });
    setDateTime('Starts (UTC)', '2099-01-01', '00:00');
    fireEvent.click(screen.getByTestId('policy-save'));
    const result = await screen.findByTestId('save-result-dialog');
    expect(posts()).toHaveLength(1);
    expect(within(result).getByText('Version 4 saved (not approved)')).toBeTruthy();
    expect(within(result).getByRole('link', { name: 'View policy version' }).getAttribute('href')).toBe('/finance/policies/p4');
    expect(within(result).getByRole('link', { name: 'Back to Valuation' }).getAttribute('href')).toBe('/finance?tab=policies');
    expect(within(result).getByRole('link', { name: /^Next: / })).toBeTruthy();
    expect((screen.getByTestId('policy-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('dismissing the policy result dialog opens the new version, so it cannot be saved twice', async () => {
    reply = (call) => (call.method === 'POST' ? json(201, POLICY) : json(200, EMPTY));
    wrap(<PolicyNewPage />, '/finance/policies/new');
    fireEvent.change(await screen.findByLabelText('Default management view'), { target: { value: 'contribution_margin' } });
    setDateTime('Starts (UTC)', '2099-01-01', '00:00');
    fireEvent.click(screen.getByTestId('policy-save'));
    await screen.findByTestId('save-result-dialog');
    fireEvent.keyDown(screen.getByTestId('save-result-dialog'), { key: 'Escape' });
    expect(await screen.findByText('policy page')).toBeTruthy();
  });

  it('approving a policy version or an exchange rate is a toast', async () => {
    actAs('finance_approver', 'approver-2');
    reply = (call) => (call.url.pathname.includes('valuation-policies') ? json(200, { ...POLICY, approved: true }) : json(200, { ...FX, state: 'approved' }));
    wrap(<PolicyApprove policy={POLICY} status="unapproved" />);
    fireEvent.click(screen.getByTestId('policy-approve-start'));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve version 4' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Version 4 approved' }));
    wrap(<FxVersionActions rate={FX} />);
    fireEvent.click(screen.getByTestId('fx-retire'));
    fireEvent.click(await screen.findByRole('button', { name: 'Retire rate' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'USD → IRR version 2 retired' }));
  });

  it('retiring a demand status asks first, sends nothing until confirmed, then reports with a toast', async () => {
    actAs('finance_approver', 'approver-2');
    reply = () => json(200, { ...DEMAND, state: 'retired' });
    wrap(<DemandActions status={DEMAND} />);
    fireEvent.click(screen.getByTestId('demand-retire'));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(posts()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retire status' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Demand status retired' }));
    expect(posts()[0].url.pathname).toMatch(/\/v2\/demand-statuses\/d1\/retire$/);
  });

  it('a refused demand retirement stays in the confirmation with the reason; no toast', async () => {
    actAs('finance_approver', 'approver-2');
    reply = () => json(409, { code: 'INVALID_STATE', message: 'already retired', correlationId: 'corr-2', retryable: false });
    wrap(<DemandActions status={DEMAND} />);
    fireEvent.click(screen.getByTestId('demand-retire'));
    fireEvent.click(await screen.findByRole('button', { name: 'Retire status' }));
    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(within(dialog).getByTestId('refusal')).toBeTruthy());
    expect(toast).not.toHaveBeenCalled();
  });

  it('approving a demand status is a toast', async () => {
    actAs('finance_approver', 'approver-2');
    reply = () => json(200, { ...DEMAND, state: 'approved' });
    wrap(<DemandActions status={DEMAND} />);
    fireEvent.click(screen.getByTestId('demand-approve'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Demand status approved' }));
  });

  it('a demand status draft closes the add dialog and ends in the result dialog, like an exchange rate', async () => {
    reply = (call) => {
      if (call.method === 'POST') return json(201, DEMAND);
      return json(200, call.url.pathname.endsWith('/products') ? PRODUCTS : EMPTY);
    };
    wrap(<DemandStatusesTab />);
    fireEvent.click(screen.getByTestId('demand-new'));
    await screen.findByRole('option', { name: 'HD-1 · HDPE film' });
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'prod-1' } });
    setDateTime('Valid from (UTC)', '2026-10-01', '00:00');
    fireEvent.change(screen.getByLabelText('Evidence'), { target: { value: 'orders' } });
    fireEvent.click(screen.getByTestId('demand-save'));
    const result = await screen.findByTestId('save-result-dialog');
    expect(screen.queryByTestId('demand-form')).toBeNull();
    expect(within(result).getByText(/^HDPE film — /)).toBeTruthy();
    expect(within(result).getByRole('link', { name: 'View status' }).getAttribute('href')).toBe('/finance?tab=demand#demand-status-d1');
    expect(within(result).getByRole('link', { name: 'Back to Demand' }).getAttribute('href')).toBe('/finance?tab=demand');
  });
});
