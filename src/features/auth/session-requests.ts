import { authApi, type AuthenticatedUser, type LoginResponse } from '@/services/api/authApi';
import { v2Request } from '@/api/v2/client';
import type { DirectoryOrganization, DirectoryPlant } from '@/api/v2/types/plant-directory';
import { readSessionOrganization } from './read-session-organization';
import { createLogger } from '@/lib/logger';

const log = createLogger('SavedSession');

export const SESSION_TIMEOUT_MS = 15_000;
export const AUTH_STORAGE_KEY = 'proact_auth_state';
export interface AuthTokens { accessToken: string; refreshToken: string; expiresAt: number }
export interface AuthSession {
  user: AuthenticatedUser;
  organization: DirectoryOrganization | null;
  tenant: DirectoryPlant | null;
  token: string;
}
export interface StoredAuthState { tokens: AuthTokens; user: AuthenticatedUser }

export const mapTokens = (response: LoginResponse): AuthTokens => ({
  accessToken: response.access_token, refreshToken: response.refresh_token,
  expiresAt: Date.now() + response.expires_in * 1000,
});

function validStoredAuth(stored: StoredAuthState): boolean {
  return Boolean(stored.user?.id && stored.tokens?.accessToken && stored.tokens.refreshToken &&
    Number.isFinite(stored.tokens.expiresAt));
}

export function readStoredAuth(): StoredAuthState | null {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null') as StoredAuthState | null;
    if (!stored) return null;
    if (!validStoredAuth(stored)) throw new Error('Invalid saved session');
    return { user: stored.user, tokens: stored.tokens };
  } catch {
    try { localStorage.removeItem(AUTH_STORAGE_KEY); }
    catch { log.warn('Browser session storage is unavailable'); }
    return null;
  }
}

export function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) return false;
  return error.status === 401 || error.status === 403;
}

/** Abort the transport and settle even if a transport ignores cancellation. Includes body reads. */
export async function boundedSessionRequest<T>(
  work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error('Session request timed out')), SESSION_TIMEOUT_MS);
  let onAbort: () => void = () => undefined;
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  try {
    controller.signal.throwIfAborted();
    return await Promise.race([work(controller.signal), cancelled]);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
    parent?.removeEventListener('abort', abort);
    controller.abort();
  }
}

export async function readSessionProfile(user: AuthenticatedUser, signal: AbortSignal): Promise<AuthenticatedUser> {
  const profile = await authApi.getProfile(signal, user.homeTenantId ?? user.tenantId);
  if (profile.userId !== user.id) throw new Error('Session identity changed');
  return {
    ...user, id: profile.userId, email: profile.email, role: profile.role,
    tenantId: profile.homeTenantId ?? profile.tenantId, organizationId: profile.organizationId,
    homeTenantId: profile.homeTenantId ?? profile.tenantId ?? null, scopes: profile.scopes ?? [],
  };
}

export async function readSessionDetails(state: StoredAuthState, signal: AbortSignal): Promise<AuthSession> {
  const { user } = state;
  const [organization, plant] = await Promise.all([
    user.organizationId ? readSessionOrganization(user.organizationId, user.tenantId, signal) : null,
    user.tenantId ? v2Request<DirectoryPlant>({
      method: 'GET', path: `/tenants/${user.tenantId}`, tenantId: user.tenantId, signal,
    }) : null,
  ]);
  signal.throwIfAborted();
  return { user, organization, tenant: plant?.data ?? null, token: state.tokens.accessToken };
}
