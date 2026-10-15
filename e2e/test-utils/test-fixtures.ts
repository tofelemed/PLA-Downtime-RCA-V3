/**
 * Test Data Fixtures
 * 
 * Provides pre-configured test data for common scenarios.
 * All data is created via backend API calls.
 */

import { apiRequest, authenticate, AuthTokens, NamedEntityRef } from './api-helpers';

export interface TestFixture {
  tokens: AuthTokens;
  organization: NamedEntityRef;
  tenant: NamedEntityRef;
  unit: NamedEntityRef;
  product: NamedEntityRef;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete test fixture with organization, tenant, unit, and product
 */
export async function createTestFixture(): Promise<TestFixture> {
  // Authenticate
  const tokens = await authenticate();
  
  // Create organization with unique timestamp and random suffix
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const organization = await apiRequest<NamedEntityRef>('/organizations', {
    method: 'POST',
    token: tokens.accessToken,
    body: JSON.stringify({
      name: `E2E Test Org ${uniqueId}`,
      code: `E2E-ORG-${uniqueId}`,
    }),
  });

  // Create tenant with unique timestamp and random suffix
  const tenantUniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const tenant = await apiRequest<NamedEntityRef>('/tenants', {
    method: 'POST',
    token: tokens.accessToken,
    body: JSON.stringify({
      name: `E2E Test Tenant ${tenantUniqueId}`,
      code: `E2E-TENANT-${tenantUniqueId}`,
      organizationId: organization.id,
    }),
  });

  // Create unit
  const unit = await apiRequest<NamedEntityRef>('/units', {
    method: 'POST',
    token: tokens.accessToken,
    body: JSON.stringify({
      name: `E2E Test Unit ${Date.now()}`,
      code: `E2E-UNIT-${Date.now()}`,
      tenantId: tenant.id,
    }),
  });

  // Products belong to a tenant (B18); plans refuse products of another or no tenant (plan 2.3)
  const product = await apiRequest<NamedEntityRef>('/products', {
    method: 'POST',
    token: tokens.accessToken,
    body: JSON.stringify({
      name: `E2E Test Product ${Date.now()}`,
      code: `E2E-PRODUCT-${Date.now()}`,
      tenantId: tenant.id,
    }),
  });

  // Cleanup function
  const cleanup = async () => {
    try {
      if (product?.id) {
        await apiRequest(`/products/${product.id}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      }
      if (unit?.id) {
        await apiRequest(`/units/${unit.id}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      }
      if (tenant?.id) {
        await apiRequest(`/tenants/${tenant.id}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      }
      if (organization?.id) {
        await apiRequest(`/organizations/${organization.id}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  return {
    tokens,
    organization,
    tenant,
    unit,
    product,
    cleanup,
  };
}

/**
 * Create a minimal test fixture (just auth and organization)
 */
export async function createMinimalFixture(): Promise<{
  tokens: AuthTokens;
  organization: NamedEntityRef;
  cleanup: () => Promise<void>;
}> {
  const tokens = await authenticate();
  
  const organization = await apiRequest<NamedEntityRef>('/organizations', {
    method: 'POST',
    token: tokens.accessToken,
    body: JSON.stringify({
      name: `E2E Minimal Org ${Date.now()}`,
      code: `E2E-MIN-${Date.now()}`,
    }),
  });

  const cleanup = async () => {
    try {
      if (organization?.id) {
        await apiRequest(`/organizations/${organization.id}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  return { tokens, organization, cleanup };
}

