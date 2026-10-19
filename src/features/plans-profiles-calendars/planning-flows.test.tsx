import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { PlanPreviewView, PlanVersionView } from '@/api/v2/types/plans';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ProfileEditor } = await import('./profiles/profile-editor');
const { VersionActions } = await import('./profiles/version-actions');
const { OpenVersionActions } = await import('./plans/open-version-actions');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refusal = (code: string, extra: Record<string, unknown> = {}) => ({ code, message: code, correlationId: 'corr-1', retryable: false, ...extra });

const REFS = {
  timezone: 'Asia/Tehran',
  timezoneIsFallback: false,
  unitOptions: [{ value: 'u1', label: 'Unit 1' }],
  productOptions: [{ value: 'p1', label: 'HDPE (P1)' }],
  siteOptions: [],
  defaultSiteId: null,
  unitName: () => 'Unit 1',
  productName: () => 'HDPE',
  loading: false,
};

const VERSION = {
  id: 'v1', planId: 'plan-1', version: 1, scenarioId: 's', unitId: 'u1', validFrom: '2026-11-01T02:30:00.000Z', validTo: '2026-11-02T02:30:00.000Z',
  basis: 'quantity', headerTarget: '1000', targetSource: 'entered', distribution: 'scheduled_capacity', approvalState: 'draft', approvedBy: null, approvedAt: null,
  supersedesVersionId: null, calendarVersionId: null, changeReason: null, manualTargets: null, periodsGeneratedAt: null, generationWarnings: [], generationError: null,
  rowVersion: 3, createdAt: '', updatedAt: '', slices: [],
} as PlanVersionView;

const period = (shiftName: string, target: string, isExcluded = false) => ({
  id: null, sliceId: '0', productId: 'p1', unitId: 'u1', shiftInstanceId: null, calendarVersionId: null, utcStart: `2026-11-01T0${shiftName === 'A' ? 2 : 3}:30:00.000Z`,
  utcEnd: '2026-11-01T10:30:00.000Z', localDate: '2026-11-01', shiftName, scheduledSeconds: 21600, target, planningCapacityQty: target, sustainedCapacityQty: target,
  quantityUom: 't', profileId: 'pr', planningRateVersionId: null, sustainedRateVersionId: null, isExcluded, exclusionKind: null,
});

describe('plans, profiles, calendars — forms and commands (plan 3.4)', () => {
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
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a 422 field error from the API lands on the profile input it names', async () => {
    reply = () => json(422, refusal('VALIDATION_FAILED', { fieldErrors: [{ field: 'quantityUom', message: 'quantityUom must be shorter than or equal to 50 characters' }] }));
    wrap(<ProfileEditor profile={null} refs={REFS} cancelTo="/planning" onSaved={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^Unit/), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText(/^Product/), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText(/Quantity unit/), { target: { value: 'x'.repeat(60) } });
    fireEvent.change(screen.getByLabelText(/^Rate timebase/), { target: { value: 'h' } });
    fireEvent.change(screen.getByLabelText('Effective from date'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Effective from time'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(screen.getByTestId('field-error-quantityUom').textContent).toMatch(/50 characters/));
    const [post] = calls;
    expect(post.url.pathname).toMatch(/\/v2\/profiles$/);
    expect(post.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.body).toMatchObject({ unitId: 'u1', productId: 'p1', effectiveFrom: '2026-10-10T02:30:00.000Z' });
    expect(post.url.searchParams.has('tenantId')).toBe(false);
  });

  it('approving an overlapping rate shows the 409 with the conflicting version inline', async () => {
    reply = () => json(409, refusal('VERSION_OVERLAP', { details: { conflicts: [{ id: 'r0', version: 1, effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null }] } }));
    wrap(<VersionActions resource="rates" id="r2" state="draft" timezone="Asia/Tehran" />);
    fireEvent.click(screen.getByTestId('approve-version'));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-code')).toBe('VERSION_OVERLAP'));
    expect(screen.getByTestId('refusal-conflict').textContent).toMatch(/Version 1: 2026-10-01 06:00 \(\+03:30 Asia\/Tehran\) → open-ended/);
    expect(calls[0].url.pathname).toMatch(/\/v2\/rates\/r2\/approve$/);
    expect(calls[0].body).toEqual({ supersede: false });
  });

  it('PLAN03 preview: preview=true, rows and Σ from the server; a 403 approval is shown, not hidden', async () => {
    const preview: PlanPreviewView = {
      version: 1, distribution: 'scheduled_capacity', headerTarget: '1000', totals: [{ quantityUom: 't', target: '1000' }],
      periods: [period('A', '300'), period('B', '300'), period('C', '400')], warnings: [],
    };
    reply = (call) => (call.url.pathname.endsWith('/approve') ? json(403, refusal('FORBIDDEN_ROLE')) : json(200, preview));
    wrap(<OpenVersionActions version={VERSION} timezone="Asia/Tehran" productName={() => 'HDPE'} onGenerated={() => undefined} />);
    fireEvent.click(screen.getByTestId('plan-preview'));
    await waitFor(() => expect(screen.getByTestId('sum-badge').getAttribute('data-match')).toBe('true'));
    expect(calls[0].body).toEqual({ version: 1, preview: true });
    expect(calls[0].url.pathname).toMatch(/\/v2\/production-plans\/plan-1\/generate-periods$/);
    fireEvent.click(screen.getByTestId('approve-plan-submit'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Approve version' }));
    await waitFor(() => expect(screen.getAllByTestId('refusal').some((node) => node.getAttribute('data-kind') === 'role')).toBe(true));
    expect(calls[1].body).toEqual({ expectedVersion: 1 });
  });

  it('a stale draft edit (412) is reported as changed by someone else', async () => {
    reply = () => json(412, refusal('STALE_REVISION', { message: 'current revision 5' }));
    const profile = {
      id: 'pr', unitId: 'u1', productId: 'p1', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'h', capacityModel: 'single_stream', actualsPolicyId: null,
      oeePolicyId: null, valuationPolicyId: null, productMixConstraints: null, legacy: null, version: 1, state: 'draft', effectiveFrom: '2026-10-10T02:30:00.000Z',
      effectiveTo: null, approvedBy: null, approvedAt: null, rowVersion: 4, createdAt: '', updatedAt: '',
    } as const;
    wrap(<ProfileEditor profile={profile} refs={REFS} cancelTo="/planning" onSaved={() => undefined} />);
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-kind')).toBe('stale'));
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].headers.get('If-Match')).toBe('"4"');
  });
});
