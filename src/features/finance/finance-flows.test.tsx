import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { FxRateView, ValuationPolicyView } from '@/api/v2/types/valuation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FxRateForm } = await import('./fx/fx-rate-form');
const { FxVersionActions } = await import('./fx/fx-version-actions');
const { FxRateTable } = await import('./fx/fx-rate-table');
const { PolicyApprove } = await import('./policies/policy-approve');
const { PolicyTable } = await import('./policies/policy-table');
const { PoliciesTab } = await import('./policies/policies-tab');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refusal = (code: string, extra: Record<string, unknown> = {}) => ({ code, message: code, correlationId: 'corr-1', retryable: false, ...extra });
const TZ = 'Asia/Tehran';

const POLICY: ValuationPolicyView = {
  id: 'p3', version: 3, approved: false, approvedBy: null, approvedAt: null, effectiveFrom: '2026-11-01T02:30:00.000Z', effectiveTo: null,
  body: { defaultBasis: 'contribution_margin', timeBasisRule: 'exclusive', reportingCurrencies: ['IRR', 'USD'], fxPolicy: 'snapshot' },
  reportingCurrencies: ['IRR', 'USD'], notes: null, createdBy: 'author-1', createdAt: '2026-10-10T00:00:00.000Z',
};

const FX: FxRateView = {
  id: 'f2', rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: '2690000', source: 'CBI', provisional: false, version: 2, state: 'draft', effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null,
  createdBy: 'author-1', approvedBy: null, approvedAt: null, rowVersion: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('finance — exchange rates and valuation policy commands', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    actAs('SuperAdmin', 'author-1');
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'author-1');
  });

  const posts = () => calls.filter((call) => call.method === 'POST');

  it('a draft rate is sent as decimal text with a UTC start from the plant clock; a 422 field error lands on the rate', async () => {
    reply = (call) => (call.method === 'POST' ? json(422, refusal('VALIDATION_FAILED', { fieldErrors: [{ field: 'rate', message: 'rate must be a decimal string with at most 10 decimals' }] })) : json(200, { items: [], nextCursor: null }));
    wrap(<FxRateForm timezone={TZ} onSaved={() => undefined} onCancel={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '585000.1234567891' } });
    fireEvent.change(screen.getByLabelText(`Valid from (${TZ}) date`), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(`Valid from (${TZ}) time`), { target: { value: '06:00' } });
    fireEvent.click(screen.getByTestId('fx-save'));
    await waitFor(() => expect(screen.getByTestId('field-error-rate').textContent).toMatch(/at most 10 decimals/));
    expect(posts()[0].url.pathname).toMatch(/\/v2\/fx-rates$/);
    expect(posts()[0].headers.get('Idempotency-Key')).toBeTruthy();
    expect(posts()[0].body).toEqual({ rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: '585000.1234567891', effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null, source: null, provisional: false });
  });

  it('SME V7: a provisional rate needs an end date before it is sent, then goes out flagged; the table says Provisional', async () => {
    reply = (call) => (call.method === 'POST' ? json(201, { ...FX, provisional: true }) : json(200, { items: [], nextCursor: null }));
    wrap(<FxRateForm timezone={TZ} onSaved={() => undefined} onCancel={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '600000' } });
    fireEvent.change(screen.getByLabelText(`Valid from (${TZ}) date`), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(`Valid from (${TZ}) time`), { target: { value: '00:00' } });
    fireEvent.click(screen.getByTestId('fx-provisional'));
    fireEvent.click(screen.getByTestId('fx-save'));
    await waitFor(() => expect(screen.getByTestId('field-error-effectiveTo').textContent).toMatch(/provisional rate needs an end date/));
    expect(posts()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Valid until (optional) date'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Valid until (optional) time'), { target: { value: '00:00' } });
    fireEvent.click(screen.getByTestId('fx-save'));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({ provisional: true, rate: '600000' });
    wrap(<FxRateTable rates={[{ ...FX, provisional: true }, { ...FX, id: 'f3' }]} />);
    expect(screen.getAllByTestId('fx-provisional-badge')).toHaveLength(1);
  });

  it('a rate the browser refuses never reaches the server (same currency, zero rate)', async () => {
    reply = () => json(200, { items: [], nextCursor: null });
    wrap(<FxRateForm timezone={TZ} onSaved={() => undefined} onCancel={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^From \(1 unit/), { target: { value: 'IRR' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('fx-save'));
    await waitFor(() => expect(screen.getByTestId('field-error-toCurrency').textContent).toMatch(/different/));
    expect(screen.getByTestId('field-error-rate').textContent).toMatch(/greater than 0/);
    expect(posts()).toHaveLength(0);
  });

  it('approving asks first; an overlap 409 stays in the dialog with the conflicting version, in plain words', async () => {
    reply = (call) =>
      call.method === 'POST'
        ? json(409, refusal('VERSION_OVERLAP', { details: { conflicts: [{ id: 'f1', version: 1, effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null }] } }))
        : json(200, { items: [], nextCursor: null });
    actAs('finance_approver', 'approver-2');
    wrap(<FxVersionActions rate={FX} />);
    fireEvent.click(screen.getByTestId('fx-approve'));
    expect(posts()).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve rate' }));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-code')).toBe('VERSION_OVERLAP'));
    expect(screen.getByTestId('refusal-conflict').textContent).toMatch(/Version 1: 2026-10-01 02:30 – ongoing/); // no site in the test: UTC
    expect(screen.getByTestId('refusal').textContent).not.toMatch(/VERSION_OVERLAP|corr-1/);
    expect(posts()[0].url.pathname).toMatch(/\/v2\/fx-rates\/f2\/approve$/);
    expect(posts()[0].body).toEqual({ supersede: false });
  });

  it('retiring a rate asks first and sends nothing until confirmed', async () => {
    reply = () => json(200, { ...FX, state: 'retired' });
    actAs('finance_approver', 'approver-2');
    wrap(<FxVersionActions rate={FX} />);
    fireEvent.click(screen.getByTestId('fx-retire'));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(posts()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retire rate' }));
    await waitFor(() => expect(posts()[0]?.url.pathname).toMatch(/\/v2\/fx-rates\/f2\/retire$/));
  });

  it('a SEPARATION_OF_DUTIES refusal from the server is still shown as such (fallback)', async () => {
    reply = (call) =>
      call.method === 'POST' ? json(403, refusal('SEPARATION_OF_DUTIES', { message: 'a valuation policy version is approved by someone other than its author' })) : json(200, { items: [], nextCursor: null });
    actAs('finance_approver', 'approver-2');
    wrap(<PolicyApprove policy={POLICY} status="unapproved" />);
    fireEvent.click(screen.getByTestId('policy-approve-start'));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve version 3' }));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-kind')).toBe('duties'));
    expect(screen.getByTestId('refusal').textContent).not.toMatch(/SEPARATION_OF_DUTIES/);
    expect(posts()[0].url.pathname).toMatch(/\/v2\/valuation-policies\/p3\/approve$/);
  });

  it('the policy table names the author and the status in words; no policy keys or ids', () => {
    reply = () => json(200, { items: [], nextCursor: null });
    const rows = [POLICY, { ...POLICY, id: 'p1', version: 1, reportingCurrencies: [], createdBy: null }, { ...POLICY, id: 'p2', version: 2, approved: true, approvedAt: '2026-10-10T00:00:00.000Z', createdBy: 'other' }];
    wrap(<PolicyTable policies={rows} />);
    const statuses = screen.getAllByTestId('policy-row').map((row) => row.getAttribute('data-status'));
    expect(statuses).toEqual(['unapproved', 'placeholder', 'approved']);
    const text = screen.getByRole('table').textContent ?? '';
    expect(text).toMatch(/You/);
    expect(text).toMatch(/Earlier setup \(no currency\)/);
    expect(text).toMatch(/Contribution margin/);
    expect(text).not.toMatch(/contribution_margin|XXX|p3/);
  });

  describe('controls follow the finance role sets (SME V1)', () => {
    it('the author who can approve sees the policy approval disabled with the separation-of-duties tooltip', () => {
      reply = () => json(200, {});
      actAs('finance_approver', 'author-1');
      wrap(<PolicyApprove policy={POLICY} status="unapproved" />);
      expect((screen.getByTestId('policy-approve-start') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('sod-disabled').getAttribute('title')).toMatch(/separation of duties/);
    });

    it('canApproveValuation / canMaintainValuation: an engineer sees neither approval nor "New policy version"; a viewer gets the Read-only hint', () => {
      reply = () => json(200, { items: [POLICY], nextCursor: null });
      actAs('Engineer');
      wrap(<PolicyApprove policy={POLICY} status="unapproved" />);
      expect(screen.queryByTestId('policy-approve-start')).toBeNull();
      actAs('viewer');
      wrap(<PoliciesTab />);
      expect(screen.queryByTestId('policy-new')).toBeNull();
      expect(screen.getByTestId('read-only-hint')).toBeTruthy();
    });

    it('canApproveValuation (FX): a manager or a finance maintainer sees no approve / retire; a finance approver does', () => {
      reply = () => json(200, {});
      for (const role of ['Manager', 'finance_maintainer']) {
        actAs(role);
        wrap(<FxVersionActions rate={FX} />);
        expect(screen.queryByTestId('fx-actions')).toBeNull();
      }
      actAs('finance_approver');
      wrap(<FxVersionActions rate={FX} />);
      expect(screen.getByTestId('fx-approve')).toBeTruthy();
      expect(screen.getByTestId('fx-retire')).toBeTruthy();
    });
  });
});
