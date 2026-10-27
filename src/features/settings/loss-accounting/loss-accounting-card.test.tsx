import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureV2Session } from '@/api/v2/config';
import type { LossAccountingInForceView, LossAccountingVersionView } from '@/api/v2/types/loss-accounting';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { LossAccountingCard } = await import('./loss-accounting-card');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const UNIT_ID = '6f1c1e0e-5b1f-4a4e-9f55-2d1d3c1b7a10';
const PRODUCT_ID = '9a3d6c1e-2b4f-4c5d-8e6f-7a8b9c0d1e2f';
const COMPUTED = { grain: 'shift', dayStart: '06:00', lossBasis: 'computed', targetSource: 'plan', accountingUnitId: null, accountingProductId: null, stopsCrossCheck: true, identityTolerance: 0 } as const;
const DECLARED = { ...COMPUTED, grain: 'day', dayStart: '00:00', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: UNIT_ID } as const;

const inForce = (policy: LossAccountingInForceView['policy']): LossAccountingInForceView => ({ policyId: 'p1', version: 1, unitId: null, effectiveFrom: '2026-01-01T00:00:00.000Z', notes: null, policy });

const DRAFT: LossAccountingVersionView = {
  id: 'v2', version: 2, unitId: null, state: 'proposed', inForce: false, effectiveFrom: '2026-10-27T08:00:00.000Z', effectiveTo: null, basedOnId: 'p1',
  createdBy: 'author-1', createdAt: '2026-10-27T08:00:00.000Z', approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, rejectionReason: null,
  selfDecided: false, notes: null, requestedEffectiveFrom: null, backdateReason: null, policy: DECLARED,
};

describe('Plant settings: Loss accounting card', () => {
  let calls: Call[];
  let current: LossAccountingInForceView;
  let refuseDecision: boolean;

  const renderCard = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <LossAccountingCard />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    current = inForce(DECLARED);
    refuseDecision = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
        calls.push(call);
        if (call.method === 'POST' && call.url.pathname.endsWith('/loss-accounting/versions')) return json(201, DRAFT);
        if (call.method === 'POST') return refuseDecision ? json(403, { code: 'SEPARATION_OF_DUTIES', message: 'The author cannot approve their own version' }) : json(200, { ...DRAFT, state: 'approved', inForce: true });
        if (call.url.pathname.endsWith('/products')) return json(200, { items: [{ id: PRODUCT_ID, code: 'HD5502', name: 'HDPE film', uom: 't', isActive: true }], nextCursor: null });
        if (call.url.pathname.endsWith('/units')) return json(200, { items: [{ id: UNIT_ID, name: 'Extruder1' }], nextCursor: null });
        if (call.url.pathname.endsWith('/loss-accounting')) return json(200, current);
        return json(200, { items: [DRAFT], nextCursor: null });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('shows the version in force in plain words with the unit name; a reader has no Change… button', async () => {
    actAs('viewer', 'viewer-1');
    renderCard();
    await waitFor(() => expect(screen.getByTestId('loss-in-force')).toHaveTextContent('Daily accounting from 00:00 · declared by the OT production loss event · target: OT planned figure · unit: Extruder1'));
    expect(screen.queryByTestId('loss-change')).toBeNull();
  });

  it('names the accounting product in the summary once it is known', async () => {
    current = inForce({ ...DECLARED, accountingProductId: PRODUCT_ID });
    actAs('viewer', 'viewer-1');
    renderCard();
    await waitFor(() => expect(screen.getByTestId('loss-in-force')).toHaveTextContent('unit: Extruder1 · product: HDPE film'));
  });

  it('the identity tolerance accepts a value above 0', async () => {
    actAs('production_accountant', 'author-1');
    renderCard();
    fireEvent.click(await screen.findByTestId('loss-change'));
    const tolerance = await screen.findByTestId('loss-tolerance');
    fireEvent.change(tolerance, { target: { value: '0.5' } });
    expect(tolerance).toHaveValue(0.5);
    expect(tolerance).toHaveAttribute('min', '0');
    expect(Number(tolerance.getAttribute('max'))).toBeGreaterThan(0.5);
    expect((tolerance as HTMLInputElement).validity.valid).toBe(true);
  });

  it('shows a computed shift policy in one line', async () => {
    current = inForce(COMPUTED);
    actAs('viewer', 'viewer-1');
    renderCard();
    await waitFor(() => expect(screen.getByTestId('loss-in-force')).toHaveTextContent('Shift accounting · computed from measurements and stops'));
  });

  it('a writer drafts a declared version for the accounting unit; the POST carries exactly the DTO keys', async () => {
    current = inForce(COMPUTED);
    actAs('production_accountant', 'author-1');
    renderCard();
    fireEvent.click(await screen.findByTestId('loss-change'));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).queryByTestId('loss-unit')).toBeNull();
    expect(within(panel).queryByTestId('loss-product')).toBeNull();
    fireEvent.change(within(panel).getByTestId('loss-grain'), { target: { value: 'day' } });
    fireEvent.change(within(panel).getByTestId('loss-basis'), { target: { value: 'declared' } });
    fireEvent.click(within(panel).getByTestId('loss-save'));
    expect(await within(panel).findByText('Choose the unit the accounting is kept on')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await waitFor(() => expect(within(panel).getByTestId('loss-unit').querySelectorAll('option')).toHaveLength(2));
    fireEvent.change(within(panel).getByTestId('loss-unit'), { target: { value: UNIT_ID } });
    expect(within(panel).getByText(/no plan covers the day/)).toBeInTheDocument();
    await waitFor(() => expect(within(panel).getByTestId('loss-product').querySelectorAll('option')).toHaveLength(2));
    fireEvent.change(within(panel).getByTestId('loss-product'), { target: { value: PRODUCT_ID } });
    fireEvent.click(within(panel).getByTestId('loss-save'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      grain: 'day', dayStart: '00:00', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: UNIT_ID, accountingProductId: PRODUCT_ID, stopsCrossCheck: true, identityTolerance: 0,
    });
  });

  it('a past effective date needs its reason and is sent as effectiveFrom with backdateReason', async () => {
    actAs('production_accountant', 'author-1');
    renderCard();
    fireEvent.click(await screen.findByTestId('loss-change'));
    const commissioning = await screen.findByTestId('loss-commissioning');
    fireEvent.change(within(commissioning).getByLabelText('Effective from (commissioning only) date'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByTestId('loss-save'));
    expect(await screen.findByText('Give the reason for backdating')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(within(commissioning).getByLabelText(/Reason for backdating/), { target: { value: 'unit in service since start-up' } });
    fireEvent.click(screen.getByTestId('loss-save'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ backdateReason: 'unit in service since start-up' });
  });

  it('an approver sees the proposed draft with Approve and Reject…; rejecting needs a reason', async () => {
    actAs('manager_approver', 'checker-1');
    renderCard();
    expect(screen.queryByTestId('loss-change')).toBeNull();
    fireEvent.click(await screen.findByTestId('loss-versions-toggle'));
    const version = await screen.findByTestId('loss-version');
    expect(version).toHaveTextContent('Proposed');
    fireEvent.click(within(version).getByTestId('loss-reject'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Reject version' })).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('wf-reason'), { target: { value: 'wrong unit' } });
    expect(within(dialog).getByRole('button', { name: 'Reject version' })).toBeEnabled();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('approving posts the decision; the server refusal (separation of duties) is shown as it is', async () => {
    refuseDecision = true;
    actAs('manager_approver', 'checker-1');
    renderCard();
    fireEvent.click(await screen.findByTestId('loss-versions-toggle'));
    fireEvent.click(await screen.findByTestId('loss-approve'));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.url.pathname).toMatch(/\/v2\/loss-accounting\/versions\/v2\/approve$/));
    expect(await screen.findByText("The decision was not saved")).toBeInTheDocument();
  });

  it('the author sees approval disabled (separation of duties); a writer who cannot approve sees no decision', async () => {
    actAs('production_accountant', 'author-1');
    const view = renderCard();
    fireEvent.click(await screen.findByTestId('loss-versions-toggle'));
    await screen.findByTestId('loss-version');
    expect(screen.getByTestId('sod-disabled')).toBeInTheDocument();
    view.unmount();
    actAs('integration_admin', 'integration-1');
    renderCard();
    fireEvent.click(await screen.findByTestId('loss-versions-toggle'));
    await screen.findByTestId('loss-version');
    expect(screen.queryByTestId('loss-approve')).toBeNull();
  });
});
