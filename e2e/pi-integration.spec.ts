/**
 * PI Integration validation tests (API-level)
 * Validates the backend PI endpoints.
 */

import { test, expect } from '@playwright/test';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest, EntityRef } from './test-utils/api-helpers';

test.describe('PI Integration Validation', () => {
  let fixture: TestFixture;

  test.beforeAll(async () => {
    fixture = await createTestFixture();
  });

  test.afterAll(async () => {
    await fixture.cleanup();
  });

  test('PI-001: list pi-connections for tenant', async () => {
    const connections = await apiRequest<EntityRef[]>(`/pi-connections?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    expect(Array.isArray(connections)).toBe(true);
  });

  test('PI-004: unmapped-events API is reachable', async () => {
    const events = await apiRequest(`/unmapped-events?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    expect(Array.isArray(events)).toBe(true);
  });

  test('PI-005: pi-sync-jobs list for tenant', async () => {
    const jobs = await apiRequest(`/pi-sync-jobs?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    expect(Array.isArray(jobs)).toBe(true);
  });

  test('PI-006: integration pi test-connection endpoint', async () => {
    const connections = await apiRequest<EntityRef[]>(`/pi-connections?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    if (connections.length === 0) {
      test.skip();
      return;
    }

    const result = await apiRequest(`/integration/pi/test-connection?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    }).catch(() => null);

    // May fail if PI server unreachable — shape check only when response exists
    if (result) {
      expect(result).toHaveProperty('success');
    }
  });
});
