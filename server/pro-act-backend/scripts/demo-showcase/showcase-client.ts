/**
 * HTTP client of the showcase seeder: one session per persona (the API rate limit is per user, so work
 * is spread over several personas), a fixed pace per session, retries with backoff on 429 / 5xx /
 * network errors, the acting plant in `X-Tenant-Id` and a body-derived `Idempotency-Key` on commands.
 * Demo tooling only — never imported by product code.
 */
import { createHash } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 6;
const MAX_PAGES = 500;
/** below the API's 300 requests / min / user, leaving room for the browser of a person testing */
const MIN_INTERVAL_MS = 230;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CallOptions {
  /** sends `Idempotency-Key` (derived from this purpose and the body) */
  command?: string;
  ifMatch?: number;
  /** statuses returned instead of thrown */
  accept?: readonly number[];
}

export interface ApiResult<T> {
  status: number;
  body: T;
}

interface ListPage<T> {
  items: T[];
  nextCursor: string | null;
  scope?: { tenantId?: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    what: string,
  ) {
    super(`${what} → HTTP ${status}: ${body.slice(0, 600)}`);
  }

  /** `code` of the API error envelope, when there is one */
  get code(): string | null {
    try {
      const parsed = JSON.parse(this.body) as { code?: unknown };
      return typeof parsed.code === 'string' ? parsed.code : null;
    } catch {
      return null;
    }
  }
}

/** One persona's session against one acting plant. */
export class PersonaSession {
  private token: string | null = null;
  private nextSlot = 0;
  private queue: Promise<void> = Promise.resolve();
  requests = 0;

  constructor(
    readonly email: string,
    private readonly password: string,
    private readonly baseUrl: string,
    readonly tenantId: string,
    private readonly seed: string,
  ) {}

  /** The user id of this persona (from the login response). */
  userId: string | null = null;

  async login(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok)
      throw new ApiError(response.status, text, `login ${this.email}`);
    const body = JSON.parse(text) as {
      access_token?: string;
      user?: { id?: string };
    };
    if (!body.access_token)
      throw new Error(`login ${this.email}: no access_token`);
    this.token = body.access_token;
    this.userId = body.user?.id ?? null;
  }

  get<T>(path: string, accept?: readonly number[]): Promise<T> {
    return this.call<T>('GET', path, undefined, { accept }).then((r) => r.body);
  }

  async call<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options: CallOptions = {},
  ): Promise<ApiResult<T>> {
    const headers = this.headers(body, options);
    for (let attempt = 1; ; attempt += 1) {
      await this.pace();
      const outcome = await this.once(method, path, body, headers);
      if (outcome instanceof Error) {
        if (attempt >= MAX_ATTEMPTS) throw outcome;
        await sleep(1000 * attempt);
        continue;
      }
      const { status, text, retryAfter } = outcome;
      if (status === 401 && attempt === 1) {
        await this.login();
        headers.Authorization = `Bearer ${this.token ?? ''}`;
        continue;
      }
      const retryable =
        status === 429 || status === 502 || status === 503 || status === 504;
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(retryAfter ?? 2000 * attempt);
        continue;
      }
      const ok =
        (status >= 200 && status < 300) ||
        (options.accept ?? []).includes(status);
      if (!ok)
        throw new ApiError(status, text, `${this.email} ${method} ${path}`);
      return { status, body: (text ? JSON.parse(text) : undefined) as T };
    }
  }

  post<T>(
    path: string,
    body: unknown,
    purpose: string,
    options: CallOptions = {},
  ): Promise<T> {
    return this.call<T>('POST', path, body, {
      ...options,
      command: purpose,
    }).then((r) => r.body);
  }

  /** Every page of a v2 keyset list; refuses a page scoped to another plant. */
  async listAll<T>(
    path: string,
    query: Record<string, string | readonly string[]> = {},
  ): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ limit: '200' });
      for (const [key, value] of Object.entries(query)) {
        (typeof value === 'string' ? [value] : value).forEach((v) =>
          params.append(key, v),
        );
      }
      if (cursor) params.set('cursor', cursor);
      const result = await this.get<ListPage<T>>(`${path}?${params}`);
      if (result.scope?.tenantId && result.scope.tenantId !== this.tenantId) {
        throw new Error(
          `${path} answered for ${result.scope.tenantId}, expected ${this.tenantId}`,
        );
      }
      items.push(...result.items);
      cursor = result.nextCursor;
      if (!cursor) return items;
    }
    throw new Error(`${path}: more than ${MAX_PAGES} pages`);
  }

  private headers(body: unknown, options: CallOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.token ?? ''}`,
    };
    if (this.tenantId) headers['X-Tenant-Id'] = this.tenantId;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.command) {
      const digest = createHash('sha256')
        .update(
          [
            this.seed,
            this.tenantId,
            options.command,
            JSON.stringify(body ?? null),
          ].join('|'),
        )
        .digest('hex');
      headers['Idempotency-Key'] = `showcase-${digest.slice(0, 48)}`;
    }
    if (options.ifMatch !== undefined)
      headers['If-Match'] = `"${options.ifMatch}"`;
    return headers;
  }

  /** Requests of one session are spaced by MIN_INTERVAL_MS (sessions run in parallel). */
  private pace(): Promise<void> {
    const turn = this.queue.then(async () => {
      const wait = this.nextSlot - Date.now();
      if (wait > 0) await sleep(wait);
      this.nextSlot = Date.now() + MIN_INTERVAL_MS;
    });
    this.queue = turn;
    this.requests += 1;
    return turn;
  }

  private async once(
    method: HttpMethod,
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<
    { status: number; text: string; retryAfter: number | null } | Error
  > {
    try {
      const response = await fetch(`${this.baseUrl}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const retry = Number(response.headers.get('retry-after'));
      return {
        status: response.status,
        text: await response.text(),
        retryAfter: Number.isFinite(retry) && retry > 0 ? retry * 1000 : null,
      };
    } catch (error: unknown) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }
}
