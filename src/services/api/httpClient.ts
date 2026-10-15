export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON-encoded (with `Content-Type: application/json`) unless it is FormData or a Content-Type is set. */
  body?: unknown;
  query?: Record<string, unknown>;
  skipAuth?: boolean;
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}

/** The body as fetch receives it; any other value is stringified the way fetch itself would. */
function toFetchBody(body: unknown, headers: Headers): BodyInit | null | undefined {
  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
    return JSON.stringify(body);
  }
  if (body === undefined || body === null) return null;
  return isBodyInit(body) ? body : String(body);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly body?: unknown,
  ) {
    // Extract validation error message if available
    let errorMessage = `API request failed with status ${status}: ${statusText}`;
    if (body && typeof body === 'object') {
      const errorBody = body as { message?: unknown };
      if (Array.isArray(errorBody.message)) {
        errorMessage = `Validation failed: ${errorBody.message.join(', ')}`;
      } else if (errorBody.message) {
        errorMessage = `Error: ${errorBody.message}`;
      }
    }
    super(errorMessage);
    this.name = 'ApiError';
  }
  
  getValidationErrors(): string[] {
    if (this.body && typeof this.body === 'object') {
      const errorBody = this.body as { message?: unknown };
      if (Array.isArray(errorBody.message)) {
        return errorBody.message.filter((item): item is string => typeof item === 'string');
      }
    }
    return [];
  }
}

type TokenProvider = () => string | null | undefined;
/** The acting tenant (`plantSelection?.tenant?.id || session?.tenant?.id`), sent as `X-Tenant-Id`. */
type TenantProvider = () => string | null | undefined;
/** Renews the access token; resolves false when the session can no longer be refreshed. */
type RefreshHandler = () => Promise<boolean>;

import { API_BASE_URL } from './apiBaseUrl';
import { createLogger } from '../../lib/logger';

const log = createLogger('HttpClient');

export class HttpClient {
  private tokenProvider?: TokenProvider;
  private tenantProvider?: TenantProvider;
  private refreshHandler?: RefreshHandler;
  private sessionKeyProvider?: () => string;
  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setTokenProvider(provider: TokenProvider) {
    this.tokenProvider = provider;
  }

  /**
   * Installs the acting-tenant source (`V2SessionBridge`, the same one the v2 client reads): every
   * authenticated request then carries `X-Tenant-Id`, so v1 screens act on the selected plant too.
   */
  setTenantProvider(provider: TenantProvider | undefined) {
    this.tenantProvider = provider;
  }

  /** Access tokens live 15 minutes (plan 3.11): a 401 is retried once after a refresh. */
  setRefreshHandler(handler: RefreshHandler | undefined) {
    this.refreshHandler = handler;
  }

  setSessionKeyProvider(provider: (() => string) | undefined) {
    this.sessionKeyProvider = provider;
  }

  // An installed provider is authoritative, including null after sign-out.
  private getToken(): string | null {
    try {
      const token: unknown = this.tokenProvider
        ? this.tokenProvider()
        : (JSON.parse(localStorage.getItem('proact_auth_state') ?? 'null') as { tokens?: { accessToken?: unknown } } | null)?.tokens?.accessToken;
      return typeof token === 'string' && token.split('.').length === 3 ? token : null;
    } catch {
      log.warn('Unable to read the current session token');
      return null;
    }
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const target = path.startsWith('http') ? path : `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    // A relative base URL ("/api" behind the same-origin reverse proxy) needs the page origin to resolve
    const url = new URL(target, typeof window !== 'undefined' ? window.location.origin : undefined);
    if (query) {
      Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null)
        .forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
          } else {
            url.searchParams.append(key, String(value));
          }
        });
    }
    return url.toString();
  }

  async request<TResponse = unknown>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    const scope = () => `${this.sessionKeyProvider?.() ?? ''}:${this.tenantProvider?.() ?? ''}`;
    const owner = scope();
    const assertCurrent = () => {
      options.signal?.throwIfAborted();
      if (!options.skipAuth && owner !== scope()) throw new DOMException('Session or plant changed', 'AbortError');
    };
    try {
      assertCurrent();
      const response = await this.send<TResponse>(path, options);
      assertCurrent();
      return response;
    } catch (error) {
      assertCurrent();
      if (!(await this.renewedAfter(error, options))) throw error;
      assertCurrent();
      const response = await this.send<TResponse>(path, options);
      assertCurrent();
      return response;
    }
  }

  /** True when a 401 on an authenticated, non-auth request was followed by a successful refresh. */
  private async renewedAfter(error: unknown, options: RequestOptions): Promise<boolean> {
    if (!(error instanceof ApiError) || error.status !== 401) return false;
    if (options.skipAuth || !this.refreshHandler || error.url.includes('/auth/')) return false;
    return this.refreshHandler();
  }

  private async send<TResponse>(path: string, options: RequestOptions): Promise<TResponse> {
    const { query, skipAuth, headers, body, ...rest } = options;
    const url = this.buildUrl(path, query);

    const requestHeaders = new Headers(headers);
    const token = skipAuth ? null : this.getToken();
    
    // never log the token or a part of it (plan 3.11, NFR03)
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
    const tenantId = skipAuth ? null : this.tenantProvider?.();
    if (tenantId && !requestHeaders.has('X-Tenant-Id')) {
      requestHeaders.set('X-Tenant-Id', tenantId);
    }

    const response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body: toFetchBody(body, requestHeaders),
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    const responseBody = isJson ? await response.json().catch(() => undefined) : await response.text();

    if (!response.ok) {
      log.warn('API request failed', { status: response.status });
      throw new ApiError(response.status, response.statusText, url, responseBody);
    }

    return responseBody as TResponse;
  }

  // Convenience methods for common HTTP verbs (axios-like API)
  async get<TResponse = unknown>(
    path: string,
    options?: { params?: Record<string, unknown>; skipAuth?: boolean },
  ): Promise<{ data: TResponse }> {
    const response = await this.request<TResponse>(path, {
      method: 'GET',
      query: options?.params,
      skipAuth: options?.skipAuth,
    });
    return { data: response };
  }

  async post<TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: { skipAuth?: boolean; headers?: Record<string, string> },
  ): Promise<{ data: TResponse }> {
    const response = await this.request<TResponse>(path, {
      method: 'POST',
      body,
      skipAuth: options?.skipAuth,
      headers: options?.headers,
    });
    return { data: response };
  }

  async put<TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: { skipAuth?: boolean; headers?: Record<string, string> },
  ): Promise<{ data: TResponse }> {
    const response = await this.request<TResponse>(path, {
      method: 'PUT',
      body,
      skipAuth: options?.skipAuth,
      headers: options?.headers,
    });
    return { data: response };
  }

  async patch<TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: { skipAuth?: boolean; headers?: Record<string, string> },
  ): Promise<{ data: TResponse }> {
    const response = await this.request<TResponse>(path, {
      method: 'PATCH',
      body,
      skipAuth: options?.skipAuth,
      headers: options?.headers,
    });
    return { data: response };
  }

  async delete(path: string, options?: { skipAuth?: boolean; headers?: Record<string, string> }): Promise<void> {
    await this.request(path, {
      method: 'DELETE',
      skipAuth: options?.skipAuth,
      headers: options?.headers,
    });
  }
}

export const httpClient = new HttpClient();


