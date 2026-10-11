import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FxRateForm } = await import('./fx/fx-rate-form');
const { FxVersionActions } = await import('./fx/fx-version-actions');
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

describe('finance — FX rates and valuation policy commands', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) => render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);

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

  it('an FX draft is sent as decimal text; a 422 field error lands on the rate input', async () => {
    reply = () => json(422, refusal('VALIDATION_FAILED', { fieldErrors: [{ field: 'rate', message: 'rate must be a decimal string with at most 10 decimals' }] }));
    wrap(<FxRateForm timezone={TZ} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '585000.1234567891' } });
    fireEvent.change(screen.getByLabelText(/^From \(Asia/), { target: { value: '2026-10-01T06:00' } });
    fireEvent.click(screen.getByTestId('fx-save'));
    await waitFor(() => expect(screen.getByTestId('field-error-rate').textContent).toMatch(/at most 10 decimals/));
    expect(calls[0].url.pathname).toMatch(/\/v2\/fx-rates$/);
    expect(calls[0].headers.get('Idempotency-Key')).toBeTruthy();
    expect(calls[0].body).toEqual({ fromCurrency: 'USD', toCurrency: 'IRR', rate: '585000.1234567891', effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null, source: null });
  });

  it('an FX rate the browser refuses never reaches the server (same currency, zero rate)', async () => {
    reply = () => json(201, {});
    wrap(<FxRateForm timezone={TZ} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^From \(1 unit/), { target: { value: 'IRR' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('fx-save'));
    await waitFor(() => expect(screen.getByTestId('field-error-toCurrency').textContent).toMatch(/must differ/));
    expect(screen.getByTestId('field-error-rate').textContent).toMatch(/> 0/);
    expect(calls).toHaveLength(0);
  });

  it('approving an overlapping FX rate shows the 409 with the conflicting version inline', async () => {
    reply = () => json(409, refusal('VERSION_OVERLAP', { details: { conflicts: [{ id: 'f1', version: 1, effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null }] } }));
    wrap(<FxVersionActions id="f2" state="draft" timezone={TZ} />);
    fireEvent.click(screen.getByTestId('fx-approve'));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-code')).toBe('VERSION_OVERLAP'));
    expect(screen.getByTestId('refusal-conflict').textContent).toMatch(/Version 1: 2026-10-01 06:00 \(\+03:30 Asia\/Tehran\) → open-ended/);
    expect(calls[0].url.pathname).toMatch(/\/v2\/fx-rates\/f2\/approve$/);
    expect(calls[0].body).toEqual({ supersede: false });
  });

  it('a SEPARATION_OF_DUTIES refusal from the server is still shown as such (fallback)', async () => {
    reply = () => json(403, refusal('SEPARATION_OF_DUTIES', { message: 'a valuation policy version is approved by someone other than its author' }));
    actAs('Manager', 'approver-2');
    wrap(<PolicyApprove policy={POLICY} status="unapproved" timezone={TZ} />);
    fireEvent.click(screen.getByTestId('policy-approve-start'));
    fireEvent.click(screen.getByTestId('policy-approve-submit'));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-kind')).toBe('duties'));
    expect(screen.getByTestId('refusal').textContent).toMatch(/Separation of duties \(SEPARATION_OF_DUTIES\)/);
    expect(calls[0].url.pathname).toMatch(/\/v2\/valuation-policies\/p3\/approve$/);
  });

  it('the policy table names the author and offers no approval for approved or XXX versions', () => {
    const rows = [POLICY, { ...POLICY, id: 'p1', version: 1, reportingCurrencies: [], createdBy: null }, { ...POLICY, id: 'p2', version: 2, approved: true, approvedAt: '2026-10-10T00:00:00.000Z', createdBy: 'other' }];
    wrap(<PolicyTable policies={rows} timezone={TZ} onCopy={() => undefined} />);
    const [v3, v1, v2] = screen.getAllByTestId('policy-row');
    expect(v3.textContent).toMatch(/You/);
    expect(v3.querySelector('[data-testid="policy-approve-start"]')).not.toBeNull();
    expect(v1.getAttribute('data-status')).toBe('placeholder');
    expect(v1.querySelector('[data-testid="policy-approve-start"]')).toBeNull();
    expect(v2.textContent).toMatch(/Approved — immutable/);
  });

  describe('controls follow PROFILE_* (FX) and POLICY_ROLES (owner decision 2026-10-12)', () => {
    it('the author who can approve sees the policy approval disabled with the separation-of-duties tooltip', () => {
      reply = () => json(200, {});
      actAs('Manager', 'author-1');
      wrap(<PolicyApprove policy={POLICY} status="unapproved" timezone={TZ} />);
      expect((screen.getByTestId('policy-approve-start') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('sod-disabled').getAttribute('title')).toMatch(/separation of duties/);
    });

    it('canManagePolicies: an engineer sees neither approval nor "New policy version"; a viewer gets the Read-only hint', () => {
      reply = () => json(200, { items: [POLICY], nextCursor: null });
      actAs('Engineer');
      wrap(<PolicyApprove policy={POLICY} status="unapproved" timezone={TZ} />);
      expect(screen.queryByTestId('policy-approve-start')).toBeNull();
      actAs('viewer');
      wrap(<PoliciesTab timezone={TZ} />);
      expect(screen.queryByTestId('policy-new')).toBeNull();
      expect(screen.getByTestId('read-only-hint')).toBeTruthy();
    });

    it('canApproveProfiles (FX): a master-data admin sees no approve / retire; a manager does', () => {
      reply = () => json(200, {});
      actAs('master_data_admin');
      wrap(<FxVersionActions id="f2" state="draft" timezone={TZ} />);
      expect(screen.queryByTestId('fx-actions')).toBeNull();
      actAs('Manager');
      wrap(<FxVersionActions id="f2" state="draft" timezone={TZ} />);
      expect(screen.getByTestId('fx-approve')).toBeTruthy();
      expect(screen.getByTestId('fx-retire')).toBeTruthy();
    });
  });
});
