/**
 * Minimal v2 API client for the demo valuation seeder: logs in once, sends the tenant on every request
 * (`X-Tenant-Id`) and refuses any list page whose scope is another tenant. Writes go through the public
 * API, so validation, versioning, approval rules, revisions and the audit log all apply.
 */
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PAGES = 200;

export interface ListPage<T> {
  items: T[];
  nextCursor: string | null;
  scope: { tenantId: string };
}

export interface Credentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token?: string;
  accessToken?: string;
  tokens?: { accessToken?: string };
  user?: { tenantId?: string | null };
}

export interface WriteOptions {
  idempotencyKey?: string;
  ifMatch?: number;
}

/** Repeated keys for arrays (`?a=x&a=y`), as the v2 list filters expect. */
function searchParams(
  query: Record<string, string | readonly string[]>,
): URLSearchParams {
  const params = new URLSearchParams({ limit: '200' });
  for (const [key, value] of Object.entries(query)) {
    const values: readonly string[] =
      typeof value === 'string' ? [value] : value;
    values.forEach((v) => params.append(key, v));
  }
  return params;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    what: string,
  ) {
    super(`${what} failed with HTTP ${status}: ${body.slice(0, 500)}`);
  }
}

export class DemoApiClient {
  private token: string | null = null;
  private tenantId: string | null = null;

  constructor(private readonly baseUrl: string) {}

  /** Logs in; returns the account's own tenant (used by `--demo-plant`). */
  async login(credentials: Credentials): Promise<string | null> {
    const response = await this.send('POST', '/api/auth/login', credentials);
    const body = (await response.json()) as LoginResponse;
    this.token =
      body.access_token ?? body.accessToken ?? body.tokens?.accessToken ?? null;
    if (!this.token) throw new Error('login returned no access token');
    return body.user?.tenantId ?? null;
  }

  useTenant(tenantId: string): void {
    this.tenantId = tenantId;
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.send('GET', path);
    return (await response.json()) as T;
  }

  async write<T>(
    method: 'POST' | 'PUT',
    path: string,
    body: unknown,
    options: WriteOptions = {},
  ): Promise<{ status: number; body: T }> {
    const response = await this.send(method, path, body, options);
    return { status: response.status, body: (await response.json()) as T };
  }

  /** Every page of a v2 list (keyset cursor); throws when a page is scoped to another tenant. */
  async listAll<T>(
    path: string,
    query: Record<string, string | readonly string[]> = {},
  ): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = searchParams(query);
      if (cursor) params.set('cursor', cursor);
      const result = await this.get<ListPage<T>>(`${path}?${params}`);
      this.assertScope(result.scope?.tenantId, path);
      items.push(...result.items);
      cursor = result.nextCursor;
      if (!cursor) return items;
    }
    throw new Error(`${path}: more than ${MAX_PAGES} pages`);
  }

  private assertScope(scopeTenant: string | undefined, path: string): void {
    if (scopeTenant !== this.tenantId) {
      throw new Error(
        `${path} answered for tenant ${scopeTenant ?? '(none)'}, expected ${this.tenantId}; nothing more is written`,
      );
    }
  }

  private async send(
    method: string,
    path: string,
    body?: unknown,
    options: WriteOptions = {},
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(body !== undefined, options),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ApiError(
        response.status,
        await response.text(),
        `${method} ${path}`,
      );
    }
    return response;
  }

  private headers(json: boolean, options: WriteOptions) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (json) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.tenantId) headers['X-Tenant-Id'] = this.tenantId;
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options.ifMatch !== undefined) {
      headers['If-Match'] = `"${options.ifMatch}"`;
    }
    return headers;
  }
}
