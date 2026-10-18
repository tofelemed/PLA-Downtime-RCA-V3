import { createLogger } from '@/lib/logger';
import { v2BaseUrl, v2Session, type V2Session } from './config';
import { SessionExpiredError, toV2Error } from './errors';
import { etagCache } from './etag-cache';
import { newIdempotencyKey } from './idempotency';
import { buildUrl, isApiUrl, QueryParams, retryAfterSeconds } from './request-url';

const log = createLogger('v2Client');

export type V2Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface V2RequestOptions {
  method: V2Method;
  /** path relative to the v2 base, parameters already filled (`/production-events/<id>`) */
  path: string;
  query?: QueryParams;
  body?: unknown;
  /** POST commands: the key of this attempt (one per user action, reused on retry) */
  idempotencyKey?: string;
  /** explicit `If-Match`, or `'cached'` for the ETag last read for this path */
  ifMatch?: string | 'cached';
  signal?: AbortSignal;
  /**
   * read another plant than the acting one (the plant selector browsing a plant before switching); the
   * server checks the caller may act on it (403 TENANT_NOT_ALLOWED otherwise)
   */
  tenantId?: string;
  /** a file to save as is: the body stays bytes (a CSV keeps its UTF-8 BOM, so it matches its published sha256) */
  asFile?: boolean;
}

export interface V2Response<T> {
  data: T;
  status: number;
  etag: string | null;
  correlationId: string;
}

/** Bounded 429 handling (spec: retried once, honouring Retry-After up to this many seconds). */
export const RATE_LIMIT_RETRIES = 1;
export const MAX_RETRY_AFTER_SECONDS = 30;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

interface RequestSession { session: V2Session; assertCurrent(): void }

function captureSession(signal?: AbortSignal): RequestSession {
  const session = v2Session();
  const key = session.getSessionKey?.();
  const tenant = session.getTenantId();
  return { session, assertCurrent: () => {
    signal?.throwIfAborted();
    if (session !== v2Session() || key !== session.getSessionKey?.() || tenant !== session.getTenantId()) {
      throw new DOMException('Session or plant changed', 'AbortError');
    }
  } };
}

function headersFor(options: V2RequestOptions, url: string, correlationId: string, session: V2Session): Headers {
  const headers = new Headers({ Accept: 'application/json', 'X-Correlation-Id': correlationId });
  const token = session.getAccessToken();
  if (token && isApiUrl(url, v2BaseUrl())) headers.set('Authorization', `Bearer ${token}`);
  const tenantId = options.tenantId ?? session.getTenantId();
  if (tenantId) headers.set('X-Tenant-Id', tenantId);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  const ifMatch = options.ifMatch === 'cached' ? etagCache.lookup(tenantId, options.path) : options.ifMatch;
  if (ifMatch) headers.set('If-Match', ifMatch);
  return headers;
}

async function readBody(response: Response, asFile = false): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get('Content-Type') ?? '';
  if (type.includes('application/json')) return response.json().catch(() => undefined);
  // binary files (PDF exports) and files to save stay bytes; text would corrupt a PDF and drop a CSV's BOM
  if (asFile || type.includes('application/pdf')) return response.blob().catch(() => undefined);
  return response.text().catch(() => undefined);
}

async function send(options: V2RequestOptions, correlationId: string, context: RequestSession): Promise<Response> {
  context.assertCurrent();
  const url = buildUrl(v2BaseUrl(), options.path, options.query);
  return fetch(url, {
    method: options.method,
    headers: headersFor(options, url, correlationId, context.session),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

/** Sends with the bounded retries: one token refresh on 401, Retry-After waits on 429. */
async function sendWithRetries(options: V2RequestOptions, correlationId: string, context: RequestSession): Promise<Response> {
  let refreshed = false;
  let rateLimited = 0;
  for (;;) {
    const response = await send(options, correlationId, context);
    context.assertCurrent();
    if (response.status === 401 && !refreshed) {
      refreshed = true;
      if (await context.session.refresh()) continue;
      return response;
    }
    if (response.status === 429 && rateLimited < RATE_LIMIT_RETRIES) {
      rateLimited += 1;
      const wait = retryAfterSeconds(response.headers.get('Retry-After'), MAX_RETRY_AFTER_SECONDS);
      log.warn(`429 on ${options.method} ${options.path}; retrying in ${wait}s`, { correlationId });
      await delay(wait * 1000, options.signal);
      continue;
    }
    return response;
  }
}

/**
 * One v2 call: auth header (API base only), `X-Correlation-Id`, `X-Tenant-Id`, `Idempotency-Key` on
 * POST, `If-Match` on request; errors become `V2ApiError` / `StaleRevisionError` / `SessionExpiredError`.
 */
export async function v2Request<T>(request: V2RequestOptions): Promise<V2Response<T>> {
  const context = captureSession(request.signal);
  const correlationId = newIdempotencyKey();
  // one key per attempt: every retry below re-sends the same key
  const options =
    request.method === 'POST' && !request.idempotencyKey
      ? { ...request, idempotencyKey: newIdempotencyKey() }
      : request;
  const response = await sendWithRetries(options, correlationId, context);
  const body = await readBody(response, options.asFile === true && response.ok);
  context.assertCurrent();
  const etag = response.headers.get('ETag');
  if (!response.ok) {
    const error = toV2Error(response.status, body, etag, correlationId);
    if (response.status === 401) {
      context.session.onSessionExpired();
      throw new SessionExpiredError({
        code: error.code,
        message: error.message,
        correlationId: error.correlationId,
        retryable: false,
      });
    }
    throw error;
  }
  if (options.method === 'GET') etagCache.remember(options.tenantId ?? context.session.getTenantId(), options.path, etag);
  return { data: body as T, status: response.status, etag, correlationId };
}
