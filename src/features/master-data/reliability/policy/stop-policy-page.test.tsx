import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { MicroStopPolicyView, TransitionAllowanceView } from '@/api/v2/types/reliability';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { StopPolicyPage } = await import('./stop-policy-page');

const MICRO: MicroStopPolicyView = {
  id: 'p1', unitId: null, version: 4, microStopSeconds: 60, microStopSecondsByAssetClass: { Bagger: 120 },
  tripReasonCodes: ['ELEC-MTR'], effectiveFrom: '2026-10-14T00:00:00.000Z', notes: null,
};
const ALLOWANCE: TransitionAllowanceView = { id: 'p1', unitId: null, version: 4, transitionAllowanceInPlan: 'planned', effectiveFrom: MICRO.effectiveFrom, notes: null };

function reply(call: V2Call) {
  if (call.url.pathname.endsWith('/micro-stop-policies/current')) return jsonResponse(200, MICRO);
  if (call.url.pathname.endsWith('/transition-allowance-policies/current')) return jsonResponse(200, ALLOWANCE);
  if (call.method === 'POST' && call.url.pathname.endsWith('/transition-allowance-policies')) {
    return jsonResponse(403, errorBody('TENANT_SCOPE_REQUIRED', 'This change is not limited to your units; a tenant-wide grant is required'));
  }
  if (call.method === 'POST') return jsonResponse(201, { ...MICRO, version: 5 });
  return undefined;
}

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data/stop-policy']}>
        <StopPolicyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Stop and plan policy page (SME D6, engine 2.5.6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('shows the plant settings in force and records a micro-stop version carrying the class thresholds', async () => {
    const calls = stubV2Fetch(reply);
    actAs('manager_approver');
    renderPage();
    expect(await screen.findByTestId('micro-stop-current')).toHaveTextContent('Version 4 · plant-wide · in force since');
    expect(screen.getByTestId('micro-stop-current')).toHaveTextContent('ELEC-MTR');
    fireEvent.change(screen.getByLabelText(/Micro-stop threshold/), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record new version (effective now)' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toBe('/api/v2/micro-stop-policies');
    expect(post?.body).toEqual({ microStopSeconds: 90, microStopSecondsByAssetClass: { Bagger: 120 }, tripReasonCodes: ['ELEC-MTR'] });
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('explains both grade-change choices and shows what the server refuses', async () => {
    stubV2Fetch(reply);
    actAs('manager_approver');
    renderPage();
    expect(await screen.findByText('Plans already allow for standard grade changes')).toBeInTheDocument();
    expect(screen.getByText('Count the allowance against the plan')).toBeInTheDocument();
    expect(screen.getByText(/Periods already calculated keep the version/)).toBeInTheDocument();
    const record = screen.getByRole('button', { name: 'Record (effective from now)' });
    expect(record).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Count the allowance against the plan/));
    fireEvent.click(record);
    expect(await screen.findByText('The server refused the change')).toBeInTheDocument();
  });

  it('a reader sees the settings without any way to record a version', async () => {
    stubV2Fetch(reply);
    actAs('master_data_admin');
    renderPage();
    expect(await screen.findByTestId('transition-allowance')).toBeInTheDocument();
    expect(screen.getByText('Only manager approvers record new versions.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record/ })).toBeNull();
  });
});
