/**
 * Backend API Helpers for E2E Testing
 * 
 * These utilities allow tests to interact directly with the backend API
 * to set up test data, verify state, and clean up after tests.
 */

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TestUser {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

/**
 * Authenticate with the backend and return tokens
 */
export async function authenticate(
  email: string = 'test@example.com',
  password: string = 'Test123!@#'
): Promise<AuthTokens & { user?: any }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // Try to register first if login fails
      console.log(`Login failed for ${email}, attempting to register...`);
      await registerUser(email, password, 'E2E Test User', 'SuperAdmin');
      // Retry login after registration
      const retryResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(`Login failed after registration: ${retryResponse.status} ${errorText}`);
      }
      
      const retryData = await retryResponse.json();
      return {
        accessToken: retryData.accessToken || retryData.access_token || retryData.tokens?.accessToken || retryData.tokens?.access_token || retryData.data?.accessToken || retryData.data?.access_token,
        refreshToken: retryData.refreshToken || retryData.refresh_token || retryData.tokens?.refreshToken || retryData.tokens?.refresh_token || retryData.data?.refreshToken || retryData.data?.refresh_token,
        user: retryData.user || null,
      };
    }

    const data = await response.json();
    const tokens = {
      accessToken: data.accessToken || data.access_token || data.tokens?.accessToken || data.tokens?.access_token || data.data?.accessToken || data.data?.access_token,
      refreshToken: data.refreshToken || data.refresh_token || data.tokens?.refreshToken || data.tokens?.refresh_token || data.data?.refreshToken || data.data?.refresh_token,
      user: data.user || null,
    };
    
    if (!tokens.accessToken) {
      console.error('No access token in response:', JSON.stringify(data, null, 2));
      throw new Error('No access token received from login');
    }
    
    return tokens;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Register a new test user
 */
export async function registerUser(
  email: string,
  password: string,
  name: string = 'Test User',
  role: string = 'SuperAdmin'
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name, role }),
  });

  if (!response.ok && response.status !== 409) {
    const error = await response.text();
    throw new Error(`Failed to register user: ${error}`);
  }
}

/**
 * Create an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    
    // Ensure dates in body are properly formatted as ISO strings
    if (typeof fetchOptions.body === 'string') {
      try {
        const bodyObj = JSON.parse(fetchOptions.body);
        // Convert any Date objects or ensure date strings are ISO format
        const processedBody = JSON.stringify(bodyObj, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          // If it's a string that looks like a date field, ensure it's ISO format
          if (typeof value === 'string' && (key.toLowerCase().includes('time') || key.toLowerCase().includes('date'))) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
          }
          return value;
        });
        fetchOptions.body = processedBody;
      } catch (e) {
        // If parsing fails, use body as-is
      }
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  
  return response.text() as unknown as T;
}

/**
 * Create test organization
 */
export async function createTestOrganization(
  token: string,
  name: string = `Test Org ${Date.now()}`
): Promise<any> {
  return apiRequest('/organizations', {
    method: 'POST',
    token,
    body: JSON.stringify({ name, code: `TEST-${Date.now()}` }),
  });
}

/**
 * Create test tenant
 */
export async function createTestTenant(
  token: string,
  organizationId: string,
  name: string = `Test Tenant ${Date.now()}`
): Promise<any> {
  return apiRequest('/tenants', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name,
      code: `TEST-TENANT-${Date.now()}`,
      organizationId,
    }),
  });
}

/**
 * Create test unit
 */
export async function createTestUnit(
  token: string,
  tenantId: string,
  name: string = `Test Unit ${Date.now()}`
): Promise<any> {
  return apiRequest('/units', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name,
      code: `TEST-UNIT-${Date.now()}`,
      tenantId,
    }),
  });
}

/**
 * Create test product
 */
export async function createTestProduct(
  token: string,
  tenantId: string,
  name: string = `Test Product ${Date.now()}`
): Promise<any> {
  return apiRequest('/products', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name,
      code: `TEST-PRODUCT-${Date.now()}`,
      tenantId,
    }),
  });
}

/**
 * Create test production plan
 */
export async function createTestProductionPlan(
  token: string,
  tenantId: string,
  data: Partial<any> = {}
): Promise<any> {
  return apiRequest('/production-plans', {
    method: 'POST',
    token,
    body: JSON.stringify({
      tenantId,
      name: `Test Plan ${Date.now()}`,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      ...data,
    }),
  });
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  token: string,
  resourceIds: { [resource: string]: string[] }
): Promise<void> {
  for (const [resource, ids] of Object.entries(resourceIds)) {
    for (const id of ids) {
      try {
        await apiRequest(`/${resource}/${id}`, {
          method: 'DELETE',
          token,
        });
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Failed to cleanup ${resource}/${id}:`, error);
      }
    }
  }
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
    } catch (error) {
      // Backend not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Backend did not become ready in time');
}

