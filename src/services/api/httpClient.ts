export interface RequestOptions extends RequestInit {
  query?: Record<string, unknown>;
  skipAuth?: boolean;
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
      const errorBody = body as any;
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
      const errorBody = this.body as any;
      if (Array.isArray(errorBody.message)) {
        return errorBody.message;
      }
    }
    return [];
  }
}

type TokenProvider = () => string | null | undefined;

import { API_BASE_URL } from './apiBaseUrl';

export class HttpClient {
  private tokenProvider?: TokenProvider;
  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setTokenProvider(provider: TokenProvider) {
    this.tokenProvider = provider;
  }

  // Enhanced token getter that also checks localStorage directly as fallback
  private getToken(): string | null {
    let token: string | null = null;

    // First try the token provider
    try {
      const providerToken = this.tokenProvider?.();
      if (providerToken && typeof providerToken === 'string' && providerToken.trim().length > 0) {
        token = providerToken;
      }
    } catch (error) {
      console.warn('[HttpClient] Token provider failed, trying localStorage fallback', error);
    }

    // Fallback: Check localStorage directly
    if (!token) {
      try {
        const authStateRaw = localStorage.getItem('proact_auth_state');
        if (authStateRaw) {
          const authState = JSON.parse(authStateRaw);
          const storedToken = authState?.tokens?.accessToken;
          if (storedToken && typeof storedToken === 'string' && storedToken.trim().length > 0) {
            token = storedToken;
            
            // Update token provider if we got token from localStorage
            if (!this.tokenProvider || !this.tokenProvider()) {
              httpClient.setTokenProvider(() => {
                try {
                  const auth = JSON.parse(localStorage.getItem('proact_auth_state') || '{}');
                  return auth?.tokens?.accessToken || null;
                } catch {
                  return null;
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn('[HttpClient] Failed to read token from localStorage', error);
      }
    }

    // Validate token format (basic JWT structure check)
    if (token) {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('[HttpClient] Invalid token format (not a JWT), clearing');
        localStorage.removeItem('proact_auth_state');
        return null;
      }
    }

    return token;
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
    const { query, skipAuth, headers, body, ...rest } = options;
    const url = this.buildUrl(path, query);

    const requestHeaders = new Headers(headers);
    const token = skipAuth ? null : this.getToken();
    
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
      console.log(`[HttpClient] ✅ Token attached to request: ${path}`, { 
        tokenLength: token.length, 
        tokenPreview: token.substring(0, 20) + '...',
        hasAuthHeader: true
      });
    } else if (!skipAuth) {
      console.error(`[HttpClient] ❌ No token available for authenticated request to ${path}`);
      console.error(`[HttpClient] Token provider:`, this.tokenProvider);
      console.error(`[HttpClient] localStorage token:`, (() => {
        try {
          const auth = JSON.parse(localStorage.getItem('proact_auth_state') || '{}');
          return auth?.tokens?.accessToken ? 'EXISTS' : 'MISSING';
        } catch {
          return 'ERROR';
        }
      })());
    }

    let resolvedBody = body;
    if (body && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
      resolvedBody = JSON.stringify(body);
    }

    const response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body: resolvedBody,
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    const responseBody = isJson ? await response.json().catch(() => undefined) : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        console.error(`[HttpClient] ❌ 401 Unauthorized for ${path}`);
        console.error(`[HttpClient] Request had token:`, !!token);
        console.error(`[HttpClient] Token preview:`, token ? token.substring(0, 30) + '...' : 'N/A');
        console.error(`[HttpClient] Response body:`, responseBody);
        
        // Don't automatically clear/redirect - let AuthContext handle token refresh/clearing
        // The AuthContext will handle token refresh or clearing on persistent 401s
      } else if (response.status === 400) {
        // Log validation errors for 400 Bad Request
        console.error(`[HttpClient] ❌ 400 Bad Request for ${path}`);
        console.error(`[HttpClient] Request URL:`, url);
        if (isJson && responseBody) {
          console.error(`[HttpClient] Validation errors:`, JSON.stringify(responseBody, null, 2));
          // If it's a validation error array, show it nicely
          if (Array.isArray(responseBody.message)) {
            console.error(`[HttpClient] Validation issues:`, responseBody.message.join(', '));
          } else if (responseBody.message) {
            console.error(`[HttpClient] Error message:`, responseBody.message);
          }
        } else {
          console.error(`[HttpClient] Response body:`, responseBody);
        }
      }
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


