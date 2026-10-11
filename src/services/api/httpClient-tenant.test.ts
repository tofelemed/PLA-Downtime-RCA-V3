import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from './httpClient';

const TENANT = '11111111-1111-4111-8111-111111111111';

const ok = () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });

/** v1 requests act on the selected plant: the tenant provider becomes `X-Tenant-Id` (viewer R2). */
describe('HttpClient acting tenant header', () => {
  afterEach(() => vi.unstubAllGlobals());

  function clientWith(tenantId: string | null) {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpClient('http://api.test/api');
    client.setTokenProvider(() => 'header.payload.sig');
    client.setTenantProvider(() => tenantId);
    return { client, fetchMock };
  }

  const sentHeaders = (fetchMock: ReturnType<typeof vi.fn>): Headers =>
    (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;

  it('sends X-Tenant-Id with the acting tenant on authenticated requests', async () => {
    const { client, fetchMock } = clientWith(TENANT);
    await client.post('tasks', { title: 't' });
    const headers = sentHeaders(fetchMock);
    expect(headers.get('X-Tenant-Id')).toBe(TENANT);
    expect(headers.get('Authorization')).toBe('Bearer header.payload.sig');
  });

  it('sends no header without a tenant, on unauthenticated requests, or once uninstalled', async () => {
    const none = clientWith(null);
    await none.client.get('units');
    expect(sentHeaders(none.fetchMock).has('X-Tenant-Id')).toBe(false);

    const skipped = clientWith(TENANT);
    await skipped.client.post('auth/login', {}, { skipAuth: true });
    expect(sentHeaders(skipped.fetchMock).has('X-Tenant-Id')).toBe(false);

    const uninstalled = clientWith(TENANT);
    uninstalled.client.setTenantProvider(undefined);
    await uninstalled.client.get('units');
    expect(sentHeaders(uninstalled.fetchMock).has('X-Tenant-Id')).toBe(false);
  });

  it('keeps an X-Tenant-Id a caller set explicitly', async () => {
    const { client, fetchMock } = clientWith(TENANT);
    await client.request('tasks', { method: 'GET', headers: { 'X-Tenant-Id': 'explicit' } });
    expect(sentHeaders(fetchMock).get('X-Tenant-Id')).toBe('explicit');
  });
});
