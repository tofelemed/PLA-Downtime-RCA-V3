/**
 * Integration Test Helpers for Vitest
 * 
 * These utilities allow Vitest tests to interact with the backend API
 * for integration testing with real data.
 */

import { httpClient } from '../../services/api/httpClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4004/api';

export interface TestAuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authenticate and get tokens for testing
 */
export async function getTestAuthTokens(
  email: string = 'test@example.com',
  password: string = 'Test123!@#'
): Promise<TestAuthTokens> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      // POST /auth/login answers { access_token, refresh_token, expires_in, token_type, user }
      const data: { access_token?: string; refresh_token?: string } = await response.json();
      if (!data.access_token || !data.refresh_token) {
        throw new Error('Login response carries no access_token / refresh_token');
      }
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    }

    // Try to register if login fails
    await registerTestUser(email, password, 'Test User', 'SuperAdmin');
    return getTestAuthTokens(email, password);
  } catch (error) {
    throw new Error(`Failed to authenticate: ${error}`);
  }
}

/**
 * Register a test user
 */
export async function registerTestUser(
  email: string,
  password: string,
  name: string = 'Test User',
  role: string = 'SuperAdmin'
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, role }),
  });

  if (!response.ok && response.status !== 409) {
    const error = await response.text();
    throw new Error(`Failed to register: ${error}`);
  }
}

/**
 * Create authenticated API request using httpClient
 */
export async function authenticatedRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token: string;
  }
): Promise<T> {
  // Set token provider
  httpClient.setTokenProvider(() => options.token);

  const method = options.method || 'GET';
  const requestOptions: any = {
    method,
    skipAuth: false,
  };

  if (options.body) {
    requestOptions.body = options.body;
  }

  if (method === 'GET') {
    return httpClient.get<T>(endpoint).then(r => r.data);
  } else if (method === 'POST') {
    return httpClient.post<T>(endpoint, options.body).then(r => r.data);
  } else if (method === 'PUT') {
    return httpClient.put<T>(endpoint, options.body).then(r => r.data);
  } else if (method === 'PATCH') {
    return httpClient.patch<T>(endpoint, options.body).then(r => r.data);
  } else if (method === 'DELETE') {
    await httpClient.delete(endpoint);
    return undefined as T;
  }

  throw new Error(`Unsupported method: ${method}`);
}

/**
 * Wait for backend to be ready
 */
export async function waitForBackend(maxAttempts: number = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Backend not ready
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Backend not ready');
}

