import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, stubV2Fetch } from '@/test/v2-fetch';
import type { EquipmentReadinessView } from '@/api/v2/types/equipment-readiness';
import { EquipmentReadiness } from './equipment-readiness';
import { StepReadinessBadge } from './readiness-status';
import { stepReadiness } from './readiness-model';
import { setupStep } from './setup-steps';

const plant = vi.hoisted(() => ({ id: 'tenant-a' }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: { tenant: { id: plant.id } } }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Dubai', loading: false }) }));
vi.mock('@/features/ux-kit/use-operational-day-start', () => ({ useOperationalDayStart: () => '00:00' }));
const unitId = '10000000-0000-4000-8000-000000000001';
const productId = '10000000-0000-4000-8000-000000000002';
const productB = '10000000-0000-4000-8000-000000000003';
vi.mock('@/features/master-data/api/use-record-queries', () => ({ useRecordLookup: () => ({ items: [{ id: productId, code: 'HDPE-A', name: 'HDPE A' }, { id: productB, code: 'HDPE-B', name: 'HDPE B' }], isLoading: false, isError: false, complete: true }) }));
const from = '2027-01-01T00:00:00.000Z', to = '2027-01-02T00:00:00.000Z';
const snapshot = (tenantId = 'tenant-a', product = productId): EquipmentReadinessView => ({ tenantId, unitId, productId: product, operatingMode: 'normal', from, to, asOf: to, checks: [
  { id: 'profile', stepId: 'profiles', label: 'Approved profile coverage', status: 'ready', detail: 'Approved profile covers the full window.', coverage: 1 },
  { id: 'planning_rate', stepId: 'profiles', label: 'Approved planning rate', status: 'missing', detail: 'Approve a planning rate.', coverage: 0 },
  { id: 'state_coverage', stepId: 'telemetry', label: 'Known physical state coverage', status: 'needs_attention', detail: 'Some state time is unknown.', coverage: 0.8 },
  { id: 'events', stepId: 'events', label: 'Event and coding evidence', status: 'not_checked', detail: 'Review the coding gate.', coverage: null },
] });
function show(value = unitId) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><EquipmentReadiness unitId={value}><div data-testid="step-status"><StepReadinessBadge stepId="profiles" /></div></EquipmentReadiness></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  actAs('SuperAdmin'); plant.id = 'tenant-a'; vi.clearAllMocks(); sessionStorage.clear();
  sessionStorage.setItem(`proact:equipment-readiness:v2:tenant-a:user-1:${unitId}`, JSON.stringify({ productId, operatingMode: 'normal', range: { from, to } }));
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('automatic equipment readiness', () => {
  it('shows server evidence and gaps, with useful actions and no mutation requests', async () => {
    const calls: string[] = [];
    stubV2Fetch((call) => { calls.push(call.method); return jsonResponse(200, snapshot()); });
    show();
    await screen.findByText('Approved profile covers the full window.');
    expect(screen.getByRole('status')).toHaveTextContent('Passed 1 · Missing 1 · Needs attention 1 · Not checked 1');
    expect(screen.getByTestId('step-status')).toHaveTextContent('Missing');
    expect(screen.getByText(/Last checked:/)).toHaveTextContent('Asia/Dubai');
    expect(screen.getAllByRole('link', { name: `Go to ${setupStep('profiles').page}` })[0]).toHaveAttribute('href', '/setup/profiles');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh checks' }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(1));
    expect(new Set(calls)).toEqual(new Set(['GET']));
  });
  it('keys checks by the selected product and remembers the filter without storing readiness', async () => {
    const products: string[] = [];
    stubV2Fetch((call) => { const product = call.url.searchParams.get('productId')!; products.push(product); return jsonResponse(200, snapshot('tenant-a', product)); });
    show(); await screen.findByText('Approved profile covers the full window.');
    fireEvent.change(screen.getByLabelText('Product grade'), { target: { value: productB } });
    await waitFor(() => expect(products).toContain(productB));
    const saved = JSON.parse(sessionStorage.getItem(`proact:equipment-readiness:v2:tenant-a:user-1:${unitId}`)!);
    expect(saved.productId).toBe(productB); expect(saved.checks).toBeUndefined();
  });
  it('clears previously successful badges when refresh fails', async () => {
    let fail = false;
    stubV2Fetch(() => fail ? jsonResponse(503, { code: 'SERVICE_UNAVAILABLE', message: 'Readiness is temporarily unavailable', retryable: false }) : jsonResponse(200, snapshot()));
    show(); await screen.findByText('Approved profile covers the full window.');
    fail = true; fireEvent.click(screen.getByRole('button', { name: 'Refresh checks' }));
    await waitFor(() => expect(screen.queryByText('Approved profile covers the full window.')).toBeNull(), { timeout: 5000 });
    expect(screen.getByTestId('step-status')).toBeEmptyDOMElement();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('requires an actual selected unit before issuing any readiness request', () => {
    const calls: string[] = []; stubV2Fetch((call) => { calls.push(call.method); return jsonResponse(200, snapshot()); });
    show('');
    expect(screen.queryByRole('region', { name: 'Automatic equipment readiness' })).toBeNull();
    expect(calls).toEqual([]); expect(screen.getByTestId('step-status')).toBeEmptyDOMElement();
  });
  it('keeps unresolved checks visible instead of calling a partly checked step complete', () => {
    const checks = snapshot().checks;
    expect(stepReadiness(checks.filter((check) => check.stepId === 'profiles'))).toBe('missing');
    expect(stepReadiness([checks[0], checks[3]])).toBe('not_checked');
    expect(stepReadiness([])).toBe('not_checked');
  });
});
