import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { v2Request } from './client';
import { configureV2Session, v2BaseUrl } from './config';
import { SessionExpiredError, StaleRevisionError, V2ApiError } from './errors';
import { etagCache } from './etag-cache';
import { isApiUrl } from './request-url';
import { v2 } from './v2';

type Call = { url: string; init: RequestInit };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('v2 client (plan 3.1)', () => {
  let calls: Call[];
  let responses: Response[];
  const session = {
    token: 'header.payload.signature',
    refresh: vi.fn(async () => false),
    expired: vi.fn(),
  };

  const header = (index: number, name: string) => new Headers(calls[index].init.headers).get(name);

  beforeEach(() => {
    calls = [];
    responses = [];
    session.refresh.mockReset().mockResolvedValue(false);
    session.expired.mockReset();
    etagCache.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const next = responses.shift();
        if (!next) throw new Error('no response queued');
        return next;
      }),
    );
    configureV2Session({
      getAccessToken: () => session.token,
      getTenantId: () => 'tenant-a',
      refresh: session.refresh,
      onSessionExpired: session.expired,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the bearer token, tenant and a correlation id to the configured API base only', async () => {
    responses.push(json(200, { items: [] }));
    await v2Request({ method: 'GET', path: '/production-events', query: { unitIds: ['u1', 'u2'], limit: 10 } });
    expect(calls[0].url).toBe(`${v2BaseUrl()}/production-events?unitIds=u1&unitIds=u2&limit=10`);
    expect(header(0, 'Authorization')).toBe(`Bearer ${session.token}`);
    expect(header(0, 'X-Tenant-Id')).toBe('tenant-a');
    expect(header(0, 'X-Correlation-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(isApiUrl('https://evil.example/api/v2/x', v2BaseUrl())).toBe(false);
    expect(isApiUrl(`${v2BaseUrl()}/x`, v2BaseUrl())).toBe(true);
  });

  it('keeps a downloaded file byte for byte, including the UTF-8 BOM of a CSV export (Marun E2E)', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62, 0x0d, 0x0a]);
    responses.push(new Response(bytes, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="x.csv"' } }));
    const { data } = await v2Request<Blob>({ method: 'GET', path: '/exports/e1/download', asFile: true });
    const read = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(data);
    });
    expect(Array.from(new Uint8Array(read))).toEqual(Array.from(bytes));
  });

  it('412 surfaces StaleRevisionError with the latest revision', async () => {
    responses.push(
      json(412, {
        code: 'STALE_REVISION',
        message: 'The resource changed since it was read (current revision 7)',
        correlationId: 'c-1',
        retryable: false,
      }),
    );
    const error = await v2
      .patch('/api/v2/production-events/{id}', { path: { id: 'e1' }, body: { description: 'x' }, ifMatch: '"6"' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StaleRevisionError);
    expect((error as StaleRevisionError).latestRevision).toBe(7);
    expect((error as StaleRevisionError).correlationId).toBe('c-1');
    expect(header(0, 'If-Match')).toBe('"6"');
  });

  it('429 is retried once after Retry-After with the same Idempotency-Key, then gives up', async () => {
    responses.push(json(429, { code: 'RATE_LIMITED', message: 'slow down', correlationId: null, retryable: true }, { 'Retry-After': '0' }));
    responses.push(json(201, { id: 'e1' }));
    const ok = await v2.post('/api/v2/production-events', { body: {} as never, idempotencyKey: 'key-1' });
    expect(ok.data).toEqual({ id: 'e1' });
    expect(calls).toHaveLength(2);
    expect(header(0, 'Idempotency-Key')).toBe('key-1');
    expect(header(1, 'Idempotency-Key')).toBe('key-1');

    calls = [];
    responses.push(json(429, { code: 'RATE_LIMITED', message: 'slow', correlationId: null, retryable: true }, { 'Retry-After': '0' }));
    responses.push(json(429, { code: 'RATE_LIMITED', message: 'slow', correlationId: null, retryable: true }, { 'Retry-After': '0' }));
    const error = await v2Request({ method: 'POST', path: '/production-events', body: {} }).catch((e: unknown) => e);
    expect((error as V2ApiError).status).toBe(429);
    expect(calls).toHaveLength(2);
    expect(header(0, 'Idempotency-Key')).toBe(header(1, 'Idempotency-Key'));
  });

  it('maps the error envelope fieldErrors to form fields', async () => {
    responses.push(
      json(422, {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        fieldErrors: [{ field: 'endTime', message: 'must be after startTime', constraint: 'isAfter' }],
        correlationId: 'c-2',
        retryable: false,
      }),
    );
    const error = (await v2Request({ method: 'POST', path: '/production-events', body: {} }).catch((e: unknown) => e)) as V2ApiError;
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrorMap()).toEqual({ endTime: 'must be after startTime' });
  });

  it('401 refreshes once and retries; a failed refresh ends the session', async () => {
    session.refresh.mockResolvedValueOnce(true);
    responses.push(json(401, { code: 'UNAUTHORIZED', message: 'expired', correlationId: null, retryable: false }));
    responses.push(json(200, { ok: true }));
    await expect(v2Request({ method: 'GET', path: '/feature-flags' })).resolves.toMatchObject({ data: { ok: true } });
    expect(session.expired).not.toHaveBeenCalled();

    responses.push(json(401, { code: 'UNAUTHORIZED', message: 'expired', correlationId: null, retryable: false }));
    const error = await v2Request({ method: 'GET', path: '/feature-flags' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionExpiredError);
    expect(session.expired).toHaveBeenCalledTimes(1);
  });

  it('remembers ETags of GETs and sends them as If-Match on request', async () => {
    responses.push(json(200, { id: 'e1', rowVersion: 3 }, { ETag: '"3"' }));
    await v2Request({ method: 'GET', path: '/production-events/e1' });
    responses.push(json(200, { id: 'e1', rowVersion: 4 }));
    await v2Request({ method: 'PATCH', path: '/production-events/e1', body: {}, ifMatch: 'cached' });
    expect(header(1, 'If-Match')).toBe('"3"');
  });

  it('retains the session when authentication infrastructure returns a retryable 503', async () => {
    responses.push(json(503, {
      code: 'SERVICE_UNAVAILABLE', message: 'Authentication service temporarily unavailable',
      correlationId: 'auth-outage', retryable: true,
    }));
    await expect(v2Request({ method: 'GET', path: '/organizations' })).rejects.toMatchObject({
      status: 503, code: 'SERVICE_UNAVAILABLE', retryable: true,
    });
    expect(session.refresh).not.toHaveBeenCalled();
    expect(session.expired).not.toHaveBeenCalled();
    responses.push(json(200, { items: [] }));
    await expect(v2Request({ method: 'GET', path: '/organizations' })).resolves.toMatchObject({ data: { items: [] } });
    expect(header(1, 'Authorization')).toBe('Bearer header.payload.signature');
  });

  it('does not expire the session when refreshing a 401 fails with infrastructure errors', async () => {
    responses.push(json(401, {}));
    session.refresh.mockRejectedValueOnce(new V2ApiError(503, { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable', retryable: true, correlationId: null }));
    await expect(v2Request({ method: 'GET', path: '/organizations' })).rejects.toMatchObject({ status: 503 });
    expect(session.expired).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it.each([200, 401])('ignores a late %i from a previous sign-in without expiring the new session', async (status) => {
    let key = 'first';
    let finish!: (response: Response) => void;
    configureV2Session({ getAccessToken: () => session.token, getSessionKey: () => key,
      getTenantId: () => 'tenant-a', refresh: session.refresh, onSessionExpired: session.expired });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const request = v2Request({ method: 'GET', path: '/organizations' });
    key = 'second'; finish(json(status, {}));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(session.expired).not.toHaveBeenCalled(); expect(session.refresh).not.toHaveBeenCalled();
  });

  it('discards an in-flight response when the selected plant changes', async () => {
    let tenant = 'plant-a'; let finish!: (response: Response) => void;
    configureV2Session({ getAccessToken: () => session.token, getTenantId: () => tenant,
      refresh: session.refresh, onSessionExpired: session.expired });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const request = v2Request({ method: 'GET', path: '/production-events' });
    tenant = 'plant-b'; finish(json(200, { items: ['old-plant'] }));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
