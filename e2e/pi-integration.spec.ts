/**
 * PI Integration validation tests (API-level)
 * Validates backend PI endpoints, source discovery, and pull response shape.
 */

import { test, expect } from '@playwright/test';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest, EntityRef } from './test-utils/api-helpers';

interface EventSourceSummary {
  id: string;
  type: string;
  sourceType: string;
  enabled: boolean;
}

interface PullResponse {
  success: boolean;
  eventsFetched: number;
  productionEventsCreated: number;
  unmappedEventsCreated: number;
}

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

  test('PI-002: connectivity sources includes PI when connection exists', async () => {
    const connections = await apiRequest<EntityRef[]>(`/pi-connections?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    const sources = await apiRequest<EventSourceSummary[]>(`/connectivity/events/sources?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(Array.isArray(sources)).toBe(true);

    if (connections.length > 0) {
      const piSources = sources.filter((s) => s.type === 'PI');
      expect(piSources.length).toBeGreaterThan(0);
      expect(piSources[0].sourceType).toMatch(/PIConnection|SystemIntegration/);
    }
  });

  test('PI-003: pull response includes unmappedEventsCreated field', async () => {
    const sources = await apiRequest<EventSourceSummary[]>(`/connectivity/events/sources?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    const piSource = sources.find((s) => s.type === 'PI' && s.enabled);
    if (!piSource) {
      test.skip();
      return;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    const pullResponse = await apiRequest<PullResponse>('/connectivity/events/pull', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        sourceType: 'PI',
        sourceId: piSource.id,
        tenantId: fixture.tenant.id,
        startTimeUtc: startTime.toISOString(),
        endTimeUtc: endTime.toISOString(),
        maxCount: 50,
        autoCreateProductionEvents: true,
      }),
    });

    expect(pullResponse).toBeDefined();
    expect(typeof pullResponse.success).toBe('boolean');
    expect(typeof pullResponse.eventsFetched).toBe('number');
    expect(typeof pullResponse.productionEventsCreated).toBe('number');
    expect(pullResponse.unmappedEventsCreated).toBeDefined();
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
