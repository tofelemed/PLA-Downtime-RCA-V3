import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, HttpClient } from './httpClient';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Plan 3.11: access tokens live 15 minutes, so a v1 request retries once after a refresh. */
describe('HttpClient refresh on 401', () => {
  afterEach(() => vi.unstubAllGlobals());

  function clientWith(responses: Response[], refreshed: boolean) {
    let token = 'header.old.sig';
    const fetchMock = vi.fn(async () => responses.shift() as Response);
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpClient('http://api.test/api');
    client.setTokenProvider(() => token);
    const refresh = vi.fn(async () => {
      token = 'header.new.sig';
      return refreshed;
    });
    client.setRefreshHandler(refresh);
    return { client, fetchMock, refresh };
  }

  it('refreshes once and retries the request with the new token', async () => {
    const { client, fetchMock, refresh } = clientWith([json(401, {}), json(200, { ok: true })], true);
    await expect(client.request('units')).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer header.new.sig');
  });

  it('gives up when the refresh fails or the retry is still 401', async () => {
    const failed = clientWith([json(401, {})], false);
    await expect(failed.client.request('units')).rejects.toBeInstanceOf(ApiError);
    const stillDenied = clientWith([json(401, {}), json(401, {})], true);
    await expect(stillDenied.client.request('units')).rejects.toMatchObject({ status: 401 });
    expect(stillDenied.refresh).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for auth endpoints or unauthenticated requests', async () => {
    const auth = clientWith([json(401, {})], true);
    await expect(auth.client.request('auth/refresh', { method: 'POST', skipAuth: true })).rejects.toBeInstanceOf(ApiError);
    const profile = clientWith([json(401, {})], true);
    await expect(profile.client.request('auth/profile')).rejects.toBeInstanceOf(ApiError);
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(profile.refresh).not.toHaveBeenCalled();
  });

  it('surfaces a transient refresh failure instead of misreporting invalid credentials', async () => {
    const { client, fetchMock, refresh } = clientWith([json(401, {})], true);
    refresh.mockRejectedValueOnce(new ApiError(503, 'Unavailable', '/auth/refresh', {}));
    await expect(client.request('units')).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a null token provider as authoritative over saved credentials', async () => {
    localStorage.setItem('proact_auth_state', JSON.stringify({ tokens: { accessToken: 'header.old.sig' } }));
    const { client, fetchMock } = clientWith([json(200, {})], false);
    client.setTokenProvider(() => null);
    await client.request('units');
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
    localStorage.clear();
  });

  it.each([200, 401])('discards a late %i after a session change without refreshing the new user', async (status) => {
    let key = 'first'; let finish!: (response: Response) => void;
    const { client, refresh } = clientWith([], true);
    client.setSessionKeyProvider(() => key);
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const request = client.request('units'); key = 'second'; finish(json(status, {}));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
