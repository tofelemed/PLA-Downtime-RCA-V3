/**
 * Master Data Integration Tests
 * 
 * Tests master data API integration with real backend data.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestAuthTokens, authenticatedRequest, waitForBackend } from './api-test-helpers';

interface OrganizationRecord { id: string; name: string; code: string }
interface TenantRecord { id: string; organizationId: string }

describe('Master Data Integration Tests', () => {
  let tokens: { accessToken: string; refreshToken: string };
  let createdOrgId: string;
  let createdTenantId: string;

  beforeAll(async () => {
    await waitForBackend();
    tokens = await getTestAuthTokens();
  }, 60_000); // waitForBackend polls for up to 30 s

  afterAll(async () => {
    // Cleanup
    if (createdTenantId) {
      try {
        await authenticatedRequest(`/tenants/${createdTenantId}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      } catch (error) {
        console.warn('Failed to cleanup tenant:', error);
      }
    }
    if (createdOrgId) {
      try {
        await authenticatedRequest(`/organizations/${createdOrgId}`, {
          method: 'DELETE',
          token: tokens.accessToken,
        });
      } catch (error) {
        console.warn('Failed to cleanup organization:', error);
      }
    }
  });

  it('should create organization via API', async () => {
    const orgData = {
      name: `Test Org ${Date.now()}`,
      code: `TEST-ORG-${Date.now()}`,
    };

    const org = await authenticatedRequest<OrganizationRecord>('/organizations', {
      method: 'POST',
      body: orgData,
      token: tokens.accessToken,
    });

    expect(org).toBeDefined();
    expect(org.id).toBeDefined();
    expect(org.name).toBe(orgData.name);
    createdOrgId = org.id;
  });

  it('should list organizations', async () => {
    const orgs = await authenticatedRequest<OrganizationRecord[]>('/organizations', {
      method: 'GET',
      token: tokens.accessToken,
    });

    expect(Array.isArray(orgs)).toBe(true);
    expect(orgs.length).toBeGreaterThan(0);
  });

  it('should get organization by ID', async () => {
    if (!createdOrgId) {
      // Create one first
      const org = await authenticatedRequest<OrganizationRecord>('/organizations', {
        method: 'POST',
        body: {
          name: `Test Org ${Date.now()}`,
          code: `TEST-${Date.now()}`,
        },
        token: tokens.accessToken,
      });
      createdOrgId = org.id;
    }

    const org = await authenticatedRequest<OrganizationRecord>(`/organizations/${createdOrgId}`, {
      method: 'GET',
      token: tokens.accessToken,
    });

    expect(org).toBeDefined();
    expect(org.id).toBe(createdOrgId);
  });

  it('should create tenant for organization', async () => {
    if (!createdOrgId) {
      const org = await authenticatedRequest<OrganizationRecord>('/organizations', {
        method: 'POST',
        body: {
          name: `Test Org ${Date.now()}`,
          code: `TEST-${Date.now()}`,
        },
        token: tokens.accessToken,
      });
      createdOrgId = org.id;
    }

    const tenantData = {
      name: `Test Tenant ${Date.now()}`,
      code: `TEST-TENANT-${Date.now()}`,
      organizationId: createdOrgId,
    };

    const tenant = await authenticatedRequest<TenantRecord>('/tenants', {
      method: 'POST',
      body: tenantData,
      token: tokens.accessToken,
    });

    expect(tenant).toBeDefined();
    expect(tenant.id).toBeDefined();
    expect(tenant.organizationId).toBe(createdOrgId);
    createdTenantId = tenant.id;
  });

  it('should update organization', async () => {
    if (!createdOrgId) {
      const org = await authenticatedRequest<OrganizationRecord>('/organizations', {
        method: 'POST',
        body: {
          name: `Test Org ${Date.now()}`,
          code: `TEST-${Date.now()}`,
        },
        token: tokens.accessToken,
      });
      createdOrgId = org.id;
    }

    const updatedName = `Updated Org ${Date.now()}`;
    const updated = await authenticatedRequest<OrganizationRecord>(`/organizations/${createdOrgId}`, {
      method: 'PUT',
      body: { name: updatedName },
      token: tokens.accessToken,
    });

    expect(updated.name).toBe(updatedName);
  });
});

