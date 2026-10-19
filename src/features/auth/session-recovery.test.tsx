import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlantSelectionProvider, usePlantSelection } from '@/contexts/PlantSelectionContext';
import { V2SessionBridge } from '@/features/v2-foundation/v2-session-bridge';
import { LoginForm } from '@/components/LoginForm';
import { SessionRecovery } from './session-recovery';
import { AUTH_STORAGE_KEY, SESSION_TIMEOUT_MS } from './session-requests';

const user = { id: 'alice', name: 'Alice', email: 'alice@example.test', role: 'viewer', isActive: true,
  tenantId: 'plant-a', homeTenantId: 'plant-a', organizationId: 'org-a', scopes: [] };
const tokens = { accessToken: 'header.alice.signature', refreshToken: 'refresh-alice', expiresAt: Date.now() + 900_000 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function Screen() {
  const auth = useAuth();
  const plant = usePlantSelection();
  if (auth.isLoading) return <div role="status">Loading session</div>;
  if (auth.startupError) return <SessionRecovery />;
  if (!auth.session) return <LoginForm />;
  return <div>Signed in: {auth.session.user.name}; plant: {plant.selection?.tenant?.id ?? auth.session.tenant?.id}</div>;
}
const mount = () => render(<QueryClientProvider client={new QueryClient()}><AuthProvider><PlantSelectionProvider>
  <V2SessionBridge /><Screen />
</PlantSelectionProvider></AuthProvider></QueryClientProvider>);
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('session recovery controls', () => {
  let failProfile: boolean;
  let loginStatus: number;
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); failProfile = false; loginStatus = 200;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/auth/profile')) return failProfile ? new Promise<Response>(() => undefined) : response({ ...user, userId: user.id });
      if (path.endsWith('/auth/login')) return response({ user, access_token: tokens.accessToken, refresh_token: tokens.refreshToken, expires_in: 900 }, loginStatus);
      if (path.endsWith('/auth/logout')) return response({});
      if (path.endsWith('/v2/organizations')) return response({ items: [{ id: 'org-a', name: 'Organization A' }], nextCursor: null });
      if (path.endsWith('/v2/tenants/plant-a')) return response({ id: 'plant-a', name: 'Plant A', organizationId: 'org-a' });
      throw new Error('Unexpected route');
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

  it('shows bounded recovery instead of cached identity, and the Retry session button restores it', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, tokens })); failProfile = true;
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS); });
    expect(screen.getByRole('heading', { name: 'Unable to load your session' })).toBeVisible();
    expect(screen.queryByText(/Signed in:/)).not.toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    failProfile = false; fireEvent.click(screen.getByRole('button', { name: 'Retry session' })); await settle();
    expect(screen.getByText('Signed in: Alice; plant: plant-a')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets the recovery screen sign out without waiting for server availability', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, tokens })); failProfile = true;
    mount(); await act(async () => { await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS); });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' })); await settle();
    expect(screen.getByRole('button', { name: 'Secure sign in' })).toBeVisible();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('shows a service outage, retains entered fields and enables a successful login retry', async () => {
    loginStatus = 503; mount(); await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'private-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Secure sign in' })); await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByLabelText('Password')).toHaveValue('private-password');
    expect(screen.getByRole('button', { name: 'Secure sign in' })).toBeEnabled();
    loginStatus = 200; fireEvent.click(screen.getByRole('button', { name: 'Secure sign in' })); await settle();
    expect(screen.getByText('Signed in: Alice; plant: plant-a')).toBeVisible();
  });

  it('keeps invalid credentials distinct from a recoverable service outage', async () => {
    loginStatus = 401; mount(); await settle();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Secure sign in' })); await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Check your credentials');
    expect(screen.getByRole('button', { name: 'Secure sign in' })).toBeEnabled();
  });
});
