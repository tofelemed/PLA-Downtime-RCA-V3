import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionController } from './session-controller';
import { AUTH_STORAGE_KEY, SESSION_TIMEOUT_MS } from './session-requests';
import { httpClient } from '@/services/api/httpClient';
import { configureV2Session } from '@/api/v2/config';

const user = { id: 'alice', name: 'Alice', email: 'alice@example.test', role: 'manager', isActive: true,
  tenantId: 'plant-a', homeTenantId: 'plant-a', organizationId: 'org-a', scopes: [] };
const loginResponse = (id = 'alice') => ({ user: { ...user, id }, access_token: `header.${id}.signature`,
  refresh_token: `refresh-${id}`, expires_in: 900, token_type: 'Bearer' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function save(expiresAt = Date.now() + 900_000) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user,
    tokens: { accessToken: 'header.saved.signature', refreshToken: 'saved-refresh', expiresAt },
    tenant: { id: 'foreign-plant', name: 'Stale plant' }, organization: { id: 'foreign-org' },
  }));
}
const stored = () => JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null');

describe('session startup and refresh recovery', () => {
  let controller: SessionController;
  let responses: Map<string, () => Promise<Response>>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let unconfigure: () => void;

  function start() {
    controller = new SessionController();
    httpClient.setTokenProvider(controller.getAccessToken);
    httpClient.setSessionKeyProvider(controller.getSessionKey);
    httpClient.setRefreshHandler(controller.refreshSession);
    unconfigure = configureV2Session({ getAccessToken: controller.getAccessToken, getSessionKey: controller.getSessionKey,
      getTenantId: () => null, refresh: controller.refreshSession, onSessionExpired: controller.expireSession });
    return controller;
  }
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    responses = new Map([
      ['/auth/login', async () => json(loginResponse())],
      ['/auth/refresh', async () => json(loginResponse())],
      ['/auth/logout', async () => json({ message: 'ok' })],
      ['/auth/profile', async () => json({ ...user, userId: user.id })],
      ['/v2/organizations', async () => json({ items: [{ id: 'org-a', name: 'Organization A', code: 'A' }], nextCursor: null })],
      ['/v2/tenants/plant-a', async () => json({ id: 'plant-a', organizationId: 'org-a', name: 'Plant A', code: 'A' })],
    ]);
    fetchMock = vi.fn(async (url: string) => {
      const route = [...responses.entries()].find(([path]) => new URL(url).pathname.endsWith(path));
      if (!route) throw new Error('Unexpected route');
      return route[1]();
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    controller?.cancelPending(); unconfigure?.();
    httpClient.setRefreshHandler(undefined); httpClient.setSessionKeyProvider(undefined);
    vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear();
  });

  it('finishes immediately without a saved sign-in and makes no requests', async () => {
    await start().restoreSession();
    expect(controller.getSnapshot()).toMatchObject({ session: null, isLoading: false, startupError: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts signed out when both reading and clearing browser storage are denied', async () => {
    const denied = () => { throw new DOMException('Storage disabled', 'SecurityError'); };
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);
    try {
      await start().restoreSession();
      expect(controller.getSnapshot()).toMatchObject({ session: null, isLoading: false });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { get.mockRestore(); remove.mockRestore(); }
  });

  it('waits for a slow profile without exposing cached grants or cached foreign plant details', async () => {
    save(); const slow = deferred<Response>(); responses.set('/auth/profile', () => slow.promise);
    const restore = start().restoreSession();
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.getSnapshot()).toMatchObject({ session: null, isLoading: true });
    slow.resolve(json({ userId: user.id, email: user.email, role: 'viewer', tenantId: 'plant-a', organizationId: 'org-a' }));
    await restore;
    expect(controller.getSnapshot().session).toMatchObject({ user: { role: 'viewer', scopes: [] }, tenant: { id: 'plant-a' }, organization: { id: 'org-a' } });
  });

  it('bounds a lost restore response at 15 seconds and lets retry recover using retained credentials', async () => {
    save(); responses.set('/auth/profile', () => new Promise(() => undefined));
    const restore = start().restoreSession();
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS); await restore;
    expect(controller.getSnapshot()).toMatchObject({ session: null, isLoading: false, startupError: expect.stringContaining('Retry') });
    expect(stored().tokens.accessToken).toBe('header.saved.signature');
    responses.set('/auth/profile', async () => json({ ...user, userId: user.id }));
    await controller.restoreSession();
    expect(controller.getSnapshot().session?.user.id).toBe('alice');
    expect(controller.getSnapshot().startupError).toBeNull();
  });

  it('persists successful login credentials before a lost metadata response, then offers recovery', async () => {
    responses.set('/v2/organizations', () => new Promise(() => undefined));
    const login = start().login(user.email, 'private-password');
    await vi.advanceTimersByTimeAsync(1);
    expect(stored().tokens.accessToken).toBe('header.alice.signature');
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS); expect(await login).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ session: null, startupError: expect.stringContaining('sign-in is saved'), loginError: null });
  });

  it('bounds a response that returned HTTP 200 headers but never finishes its body', async () => {
    save(); const incomplete = json({});
    vi.spyOn(incomplete, 'json').mockReturnValue(new Promise(() => undefined));
    responses.set('/auth/profile', async () => incomplete);
    const restore = start().restoreSession();
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS); await restore;
    expect(controller.getSnapshot()).toMatchObject({ session: null, isLoading: false, startupError: expect.any(String) });
    expect(stored().tokens.refreshToken).toBe('saved-refresh');
  });

  it.each([503, 502])('does not call a login infrastructure error %i invalid credentials', async (status) => {
    responses.set('/auth/login', async () => json({}, status));
    expect(await start().login(user.email, 'private-password')).toBe(false);
    expect(controller.getSnapshot().loginError).toContain('temporarily unavailable');
  });

  it('bounds a lost login response and ignores its eventual success after the deadline', async () => {
    const slow = deferred<Response>(); responses.set('/auth/login', () => slow.promise);
    const login = start().login(user.email, 'private-password');
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS); expect(await login).toBe(false);
    expect(controller.getSnapshot().loginError).toContain('temporarily unavailable');
    slow.resolve(json(loginResponse())); await vi.advanceTimersByTimeAsync(0);
    expect(controller.getSnapshot().session).toBeNull(); expect(stored()).toBeNull();
  });

  it('returns invalid login credentials to the sign-in form', async () => {
    responses.set('/auth/login', async () => json({}, 401));
    expect(await start().login(user.email, 'bad-password')).toBe(false);
    expect(controller.getSnapshot().loginError).toContain('Check your credentials');
    expect(stored()).toBeNull();
  });

  it('retains expired access credentials during a refresh outage without granting a cached session', async () => {
    save(Date.now() - 1); responses.set('/auth/refresh', async () => json({}, 503));
    await start().restoreSession();
    expect(controller.getSnapshot()).toMatchObject({ session: null, isLoading: false, startupError: expect.any(String) });
    expect(stored().tokens.refreshToken).toBe('saved-refresh');
  });

  it('keeps an established session and its credentials when refresh returns 503', async () => {
    save(); await start().restoreSession();
    responses.set('/auth/refresh', async () => json({}, 503));
    await expect(controller.refreshSession()).rejects.toMatchObject({ status: 503 });
    expect(controller.getSnapshot().session?.user.id).toBe('alice');
    expect(stored().tokens.refreshToken).toBe('saved-refresh');
  });

  it('bounds a stalled established-session refresh without discarding valid credentials', async () => {
    save(); await start().restoreSession(); responses.set('/auth/refresh', () => new Promise(() => undefined));
    const refresh = controller.refreshSession().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS);
    expect(await refresh).toBeInstanceOf(Error);
    expect(controller.getSnapshot().session?.user.id).toBe('alice');
    expect(stored().tokens.refreshToken).toBe('saved-refresh');
  });

  it('does not accept a different identity returned by refresh', async () => {
    save(); await start().restoreSession(); responses.set('/auth/refresh', async () => json(loginResponse('bob')));
    await expect(controller.refreshSession()).rejects.toThrow('identity changed');
    expect(controller.getSnapshot().session?.user.id).toBe('alice'); expect(stored().user.id).toBe('alice');
  });

  it('requires fresh plant details when refresh removes access to the displayed plant', async () => {
    save(); await start().restoreSession();
    responses.set('/auth/refresh', async () => json({ ...loginResponse(), user: { ...user, tenantId: 'plant-b', homeTenantId: 'plant-b' } }));
    await controller.refreshSession();
    expect(controller.getSnapshot()).toMatchObject({ session: null, startupError: expect.stringContaining('access changed') });
    expect(stored().tokens.refreshToken).toBe('refresh-alice');
  });

  it('ends an established session for a genuinely invalid refresh token', async () => {
    save(); await start().restoreSession(); responses.set('/auth/refresh', async () => json({}, 401));
    expect(await controller.refreshSession()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ session: null, loginError: expect.stringContaining('expired') });
    expect(stored()).toBeNull();
  });

  it('deduplicates concurrent refreshes and persists the rotated token before any later bootstrap error', async () => {
    save(); await start().restoreSession(); const slow = deferred<Response>(); responses.set('/auth/refresh', () => slow.promise);
    const first = controller.refreshSession(); const second = controller.refreshSession();
    expect(first).toBe(second); slow.resolve(json(loginResponse())); await first;
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
    expect(stored().tokens.refreshToken).toBe('refresh-alice');
    responses.set('/v2/organizations', async () => json({}, 503)); await controller.restoreSession();
    expect(stored().tokens.refreshToken).toBe('refresh-alice'); expect(controller.getSnapshot().session).toBeNull();
  });

  it('refreshes a rejected stored access token once before retrying profile', async () => {
    save(); let calls = 0;
    responses.set('/auth/profile', async () => ++calls === 1 ? json({}, 401) : json({ ...user, userId: user.id }));
    await start().restoreSession(); expect(calls).toBe(2);
    expect(controller.getSnapshot().session?.user.id).toBe('alice');
  });

  it('does not restore cached authority when both profile and refresh reject authentication', async () => {
    save(); responses.set('/auth/profile', async () => json({}, 401)); responses.set('/auth/refresh', async () => json({}, 401));
    await start().restoreSession(); expect(controller.getSnapshot().session).toBeNull(); expect(stored()).toBeNull();
  });

  it('does not clear credentials when a metadata 401 is followed by a refresh infrastructure failure', async () => {
    save(); responses.set('/v2/organizations', async () => json({}, 401)); responses.set('/auth/refresh', async () => json({}, 503));
    await start().restoreSession(); expect(controller.getSnapshot().session).toBeNull();
    expect(stored().tokens.refreshToken).toBe('saved-refresh');
    expect(controller.getSnapshot().startupError).toContain('Retry');
  });

  it.each(['login', 'profile', 'refresh'] as const)('signs out immediately and ignores a late %s response', async (stage) => {
    if (stage !== 'login') save(stage === 'refresh' ? Date.now() - 1 : undefined);
    const slow = deferred<Response>(); responses.set(`/auth/${stage}`, () => slow.promise);
    start(); const operation = stage === 'login' ? controller.login(user.email, 'private-password') : controller.restoreSession();
    await vi.advanceTimersByTimeAsync(0); await controller.logout();
    expect(controller.getSnapshot().session).toBeNull(); expect(stored()).toBeNull();
    slow.resolve(json(stage === 'profile' ? { ...user, userId: user.id } : loginResponse()));
    await operation; await vi.advanceTimersByTimeAsync(0);
    expect(controller.getSnapshot().session).toBeNull(); expect(stored()).toBeNull();
  });

  it('a superseding account login cannot be overwritten by earlier metadata', async () => {
    const slow = deferred<Response>(); responses.set('/v2/organizations', () => slow.promise);
    const first = start().login(user.email, 'private-password'); await vi.advanceTimersByTimeAsync(0);
    responses.set('/auth/login', async () => json(loginResponse('bob')));
    responses.set('/v2/organizations', async () => json({ items: [{ id: 'org-a' }], nextCursor: null }));
    expect(await controller.login('bob@example.test', 'private-password')).toBe(true);
    slow.resolve(json({ items: [{ id: 'org-a' }], nextCursor: null })); await first;
    expect(controller.getSnapshot().session?.user.id).toBe('bob'); expect(stored().user.id).toBe('bob');
  });

  it('keeps the latest tenant choice when earlier details arrive last', async () => {
    save(); await start().restoreSession(); const slow = deferred<Response>();
    responses.set('/v2/tenants/plant-b', () => slow.promise);
    responses.set('/v2/tenants/plant-c', async () => json({ id: 'plant-c' }));
    const first = controller.selectTenant('plant-b'); await controller.selectTenant('plant-c');
    slow.resolve(json({ id: 'plant-b' })); await first;
    expect(controller.getSnapshot().session?.tenant?.id).toBe('plant-c');
  });
});
