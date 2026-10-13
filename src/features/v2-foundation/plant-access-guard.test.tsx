import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { DirectoryPlant as Tenant } from '@/api/v2/types/plant-directory';

const DEMO = { id: 'plant-demo', name: 'Demo Plant', organizationId: 'org-demo' } as Tenant;
const PARTNER = { id: 'plant-partner', name: 'Partner Plant', organizationId: 'org-partner' } as Tenant;
const setSelection = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'u1', role: 'OrgAdmin' }, tenant: DEMO, organization: { id: 'org-demo' } } }),
}));
vi.mock('@/contexts/PlantSelectionContext', () => ({
  usePlantSelection: () => ({ selection: { tenant: PARTNER }, setSelection, loading: false }),
}));

const { PlantAccessGuard } = await import('./plant-access-guard');
const { isTenantRefusal } = await import('./tenant-refusal');
const { V2ApiError } = await import('@/api/v2/errors');

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refusal = { code: 'TENANT_NOT_ALLOWED', message: 'not a member', correlationId: 'corr-1', retryable: false };

describe('PlantAccessGuard (403 TENANT_NOT_ALLOWED on the selected plant)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    setSelection.mockReset();
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => PARTNER.id, refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the refusal instead of the screen and switches back to the home plant', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(403, refusal)));
    render(<PlantAccessGuard><p>screen</p></PlantAccessGuard>, { wrapper });
    expect(screen.getByText('screen')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('plant-access-refused')).toBeInTheDocument());
    expect(screen.queryByText('screen')).not.toBeInTheDocument();
    expect(screen.getByText('You do not have access to this plant')).toBeInTheDocument();
    expect(screen.getByText(/Reference: corr-1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Switch to my plant (Demo Plant)' }));
    expect(setSelection).toHaveBeenCalledWith({ organization: { id: 'org-demo' }, tenant: DEMO });
  });

  it('leaves the screen alone when the flags load or fail for another reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { code: 'INTERNAL', message: 'boom', correlationId: 'c', retryable: false })));
    render(<PlantAccessGuard><p>screen</p></PlantAccessGuard>, { wrapper });
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error'));
    expect(screen.getByText('screen')).toBeInTheDocument();
    expect(screen.queryByTestId('plant-access-refused')).not.toBeInTheDocument();
  });

  it('isTenantRefusal only matches the tenant refusal code', () => {
    expect(isTenantRefusal(new V2ApiError(403, refusal))).toBe(true);
    expect(isTenantRefusal(new V2ApiError(403, { ...refusal, code: 'FORBIDDEN_ROLE' }))).toBe(false);
    expect(isTenantRefusal(new Error('network'))).toBe(false);
  });
});
