/**
 * RCA Auto-Creation E2E Tests
 * Validates backend auto-creates RCAs when trigger rules match and autoCreateRca is enabled.
 */

import { test, expect } from '@playwright/test';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest, EntityRef } from './test-utils/api-helpers';

interface RcaSummary {
  id: string;
  eventId: string;
  status: string;
  priority: string;
}

interface ProductionEventSummary {
  id: string;
  rcaId?: string | null;
}

test.describe('RCA Auto-Creation', () => {
  let fixture: TestFixture;
  let triggerConfigId: string | undefined;
  let createdEventId: string | undefined;
  let createdRcaId: string | undefined;

  test.beforeAll(async () => {
    fixture = await createTestFixture();
  });

  test.afterAll(async () => {
    if (createdRcaId) {
      try {
        await apiRequest(`/rcas/${createdRcaId}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch {
        /* ignore */
      }
    }
    if (createdEventId) {
      try {
        await apiRequest(`/production-events/${createdEventId}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch {
        /* ignore */
      }
    }
    if (triggerConfigId) {
      try {
        await apiRequest(`/rca-trigger-configs/${triggerConfigId}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch {
        /* ignore */
      }
    }
    await fixture.cleanup();
  });

  test('AUTO-RCA: creates RCA when event matches critical severity rule', async () => {
    const configs = await apiRequest(
      `/rca-trigger-configs?tenantId=${fixture.tenant.id}&isActive=true`,
      { method: 'GET', token: fixture.tokens.accessToken },
    );

    let config = configs[0];
    if (!config) {
      config = await apiRequest('/rca-trigger-configs', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          tenantId: fixture.tenant.id,
          organizationId: fixture.organization.id,
          name: 'E2E Auto RCA Config',
          description: 'Test config for auto RCA',
          isActive: true,
          autoCreateRca: true,
          globalSettings: {
            alwaysAllowManualCreation: true,
            showWarningForLowImpact: false,
            requireApprovalForLowImpact: false,
          },
          rules: [
            {
              id: 'e2e-critical-rule',
              name: 'Critical Severity',
              description: 'Auto RCA for critical events',
              eventType: 'All',
              enabled: true,
              priority: 100,
              conditions: { severities: ['Critical'] },
            },
          ],
        }),
      });
    } else {
      config = await apiRequest(`/rca-trigger-configs/${config.id}`, {
        method: 'PATCH',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          autoCreateRca: true,
          rules: [
            {
              id: 'e2e-critical-rule',
              name: 'Critical Severity',
              eventType: 'All',
              enabled: true,
              priority: 100,
              conditions: { severities: ['Critical'] },
            },
          ],
        }),
      });
    }

    triggerConfigId = config.id;
    expect(config.autoCreateRca).toBe(true);

    const unit = fixture.unit;
    const event = await apiRequest<EntityRef>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        eventId: `E2E-AUTO-RCA-${Date.now()}`,
        tenantId: fixture.tenant.id,
        organizationId: fixture.organization.id,
        unitId: unit.id,
        eventType: 'ProductionLoss',
        description: 'E2E auto RCA test event',
        startTime: new Date().toISOString(),
        status: 'Open',
        severity: 'Critical',
        cost: 150000,
        duration: 120,
        source: 'Manual',
      }),
    });

    createdEventId = event.id;
    expect(event.id).toBeDefined();

    const rcas = await apiRequest<RcaSummary[]>(`/rcas?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    const linkedRca = rcas.find((r) => r.eventId === event.id);
    expect(linkedRca).toBeDefined();
    expect(linkedRca.status).toBe('Draft');
    expect(linkedRca.priority).toBe('Critical');
    createdRcaId = linkedRca.id;

    const refreshedEvent = await apiRequest<ProductionEventSummary>(`/production-events/${event.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    expect(refreshedEvent.rcaId).toBe(linkedRca.id);
  });

  test('AUTO-RCA: does not create RCA when autoCreateRca is disabled', async () => {
    const configs = await apiRequest(
      `/rca-trigger-configs?tenantId=${fixture.tenant.id}&isActive=true`,
      { method: 'GET', token: fixture.tokens.accessToken },
    );
    const config = configs[0];
    if (!config) {
      test.skip();
      return;
    }

    await apiRequest(`/rca-trigger-configs/${config.id}`, {
      method: 'PATCH',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({ autoCreateRca: false }),
    });

    const event = await apiRequest<EntityRef>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        eventId: `E2E-NO-AUTO-${Date.now()}`,
        tenantId: fixture.tenant.id,
        organizationId: fixture.organization.id,
        unitId: fixture.unit.id,
        eventType: 'ProductionLoss',
        description: 'E2E no auto RCA test',
        startTime: new Date().toISOString(),
        status: 'Open',
        severity: 'Critical',
        cost: 200000,
        source: 'Manual',
      }),
    });

    const rcas = await apiRequest<RcaSummary[]>(`/rcas?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    const linkedRca = rcas.find((r) => r.eventId === event.id);
    expect(linkedRca).toBeUndefined();

    await apiRequest(`/production-events/${event.id}`, {
      method: 'DELETE',
      token: fixture.tokens.accessToken,
    });

    await apiRequest(`/rca-trigger-configs/${config.id}`, {
      method: 'PATCH',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({ autoCreateRca: true }),
    });
  });
});
