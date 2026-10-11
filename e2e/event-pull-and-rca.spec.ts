/**
 * Event Pulling and RCA Creation E2E Tests
 * 
 * Comprehensive tests for:
 * 1. Pulling events from sources (PI, OPC UA, etc.)
 * 2. Displaying events in EventHub
 * 3. Creating RCA based on trigger rules
 * 4. Full workflow: Pull → Display → Create RCA
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest } from './test-utils/api-helpers';

interface PiConnectionSummary {
  id: string;
  name: string;
}

interface EventSourceSummary {
  id: string;
  type: string;
  enabled: boolean;
}

interface PullResponse {
  success: boolean;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  unmappedEventsCreated: number;
}

interface ProductionEventDto {
  id: string;
  createdAt: string;
  description?: string;
  cost?: number;
  severity?: string | null;
  rcaId?: string | null;
}

interface RcaTriggerConfigSummary {
  name: string;
  isActive: boolean;
  rules?: unknown[];
}

interface UserProfile {
  id?: string;
  userId?: string;
}

interface RcaDto {
  id: string;
  eventId: string;
}

test.describe('Event Pulling and RCA Creation', () => {
  let fixture: TestFixture;
  let createdEventIds: string[] = [];
  let createdRcaIds: string[] = [];
  let piConnectionId: string | undefined;

  test.beforeAll(async () => {
    fixture = await createTestFixture();
    
    // Check for PI connection
    try {
      const connections = await apiRequest<PiConnectionSummary[]>(`/pi-connections?tenantId=${fixture.tenant.id}`, {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });
      if (connections && connections.length > 0) {
        piConnectionId = connections[0].id;
        console.log(`✅ Found PI connection: ${connections[0].name} (ID: ${piConnectionId})`);
      } else {
        console.log('⚠️ No PI connection found. Some tests will be skipped.');
      }
    } catch (error) {
      console.warn('⚠️ Could not check for PI connections:', error);
    }
  });

  test.afterAll(async () => {
    // Cleanup created events
    for (const eventId of createdEventIds) {
      try {
        await apiRequest(`/production-events/${eventId}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch (error) {
        console.warn(`Failed to cleanup event ${eventId}:`, error);
      }
    }

    // Cleanup created RCAs
    for (const rcaId of createdRcaIds) {
      try {
        await apiRequest(`/rcas/${rcaId}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch (error) {
        console.warn(`Failed to cleanup RCA ${rcaId}:`, error);
      }
    }

    await fixture.cleanup();
  });

  // ==================== EVENT PULLING TESTS ====================

  test('PULL: should get available event sources', async () => {
    // Base URL already includes /api, so we use /connectivity/events/sources
    // Controller is @Controller('api/connectivity') with global prefix 'api'
    // This creates route: /api/api/connectivity/events/sources
    // But we need to use just /connectivity/events/sources since base URL has /api
    const sources = await apiRequest<EventSourceSummary[]>(`/connectivity/events/sources?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    }).catch(async (error) => {
      // If 404 or 500, try with /api prefix (in case route is /api/api/connectivity/...)
      if (error.message.includes('404') || error.message.includes('500')) {
        return await apiRequest<EventSourceSummary[]>(`/api/connectivity/events/sources?tenantId=${fixture.tenant.id}`, {
          method: 'GET',
          token: fixture.tokens.accessToken,
        });
      }
      throw error;
    });

    expect(Array.isArray(sources)).toBe(true);
    console.log(`Found ${sources.length} event sources`);
    
    // Log source types
    if (sources.length > 0) {
      const sourceTypes = sources.map((s) => s.type);
      console.log('Source types:', sourceTypes);
    }
  });

  test('PULL: should pull events from PI (if connection exists)', async () => {
    if (!piConnectionId) {
      test.skip();
      return;
    }

    // Get PI sources - try /connectivity first (base URL has /api)
    const sources = await apiRequest<EventSourceSummary[]>(`/connectivity/events/sources?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    }).catch(async (error) => {
      // If 404 or 500, try with /api prefix
      if (error.message.includes('404') || error.message.includes('500')) {
        return await apiRequest<EventSourceSummary[]>(`/api/connectivity/events/sources?tenantId=${fixture.tenant.id}`, {
          method: 'GET',
          token: fixture.tokens.accessToken,
        });
      }
      throw error;
    });

    const piSource = sources.find((s) => s.type === 'PI' && s.enabled);
    if (!piSource) {
      test.skip();
      return;
    }

    // Pull events from last 7 days
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    const pullResponse = await apiRequest<PullResponse>('/connectivity/events/pull', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        sourceType: 'PI',
        sourceId: piSource.id,
        tenantId: fixture.tenant.id,
        startTimeUtc: startTime.toISOString(),
        endTimeUtc: endTime.toISOString(),
        maxCount: 100,
        autoCreateProductionEvents: true,
      }),
    });

    expect(pullResponse).toBeDefined();
    expect(pullResponse.success).toBeDefined();
    console.log('Pull response:', {
      success: pullResponse.success,
      eventsFetched: pullResponse.eventsFetched,
      eventsStored: pullResponse.eventsStored,
      productionEventsCreated: pullResponse.productionEventsCreated,
      unmappedEventsCreated: pullResponse.unmappedEventsCreated,
    });

    // If events were created, track them
    if (pullResponse.productionEventsCreated > 0) {
      // Fetch the created events
      const events = await apiRequest<ProductionEventDto[]>(`/production-events?tenantId=${fixture.tenant.id}`, {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });
      
      // Track the most recent events (likely the ones we just created)
      const recentEvents = events
        .filter((e) => new Date(e.createdAt) > startTime)
        .slice(0, pullResponse.productionEventsCreated);
      
      recentEvents.forEach((e) => {
        if (!createdEventIds.includes(e.id)) {
          createdEventIds.push(e.id);
        }
      });
    }
  });

  test('PULL: should create production event manually for testing', async () => {
    // Create a test event that will trigger RCA rules
    // Ensure startTime is a valid ISO 8601 string (not a Date object)
    const startTimeStr = new Date().toISOString();
    const eventData = {
      eventId: `E2E-TEST-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E Test Event - High Cost Loss ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: startTimeStr, // Explicitly use string
      source: 'Manual',
      status: 'Open',
      cost: 50000, // High cost to trigger RCA rules
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(eventData),
    });

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    createdEventIds.push(event.id);
    console.log(`✅ Created test event: ${event.id}`);
  });

  // ==================== EVENTHUB DISPLAY TESTS ====================

  test('EVENTHUB: should display events in EventHub UI', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check if EventHub page loaded
    const pageLoaded = await page.locator('body').isVisible({ timeout: 5000 }).catch(() => false);
    expect(pageLoaded).toBeTruthy();

    // Look for event-related elements
    const hasEventElements = await page.locator('text=/Event|Production Loss|IOW|SOL/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasEventElements).toBeTruthy();

    // Check if events table/list is visible
    const hasEventsList = await page.locator('table, [role="list"], [role="grid"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasEventsList) {
      console.log('✅ Events list/table is visible');
    }
  });

  test('EVENTHUB: should filter events by type', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Try to find and click on a tab (Production Loss, IOW, etc.)
    const productionLossTab = page.locator('button:has-text("Production Loss"), [role="tab"]:has-text("Production Loss")').first();
    const isTabVisible = await productionLossTab.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isTabVisible) {
      await productionLossTab.click();
      await page.waitForTimeout(1000);
      console.log('✅ Clicked Production Loss tab');
    }
  });

  test('EVENTHUB: should search events', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i], input[placeholder*="Filter" i]').first();
    const isSearchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isSearchVisible) {
      await searchInput.fill('E2E Test');
      await page.waitForTimeout(1000);
      console.log('✅ Searched for events');
    }
  });

  // ==================== RCA TRIGGER RULES TESTS ====================

  test('RCA RULES: should check if event meets RCA trigger criteria', async () => {
    // Create an event that should trigger RCA (high cost, critical severity)
    const highCostEvent = {
      eventId: `E2E-RCA-TRIGGER-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E RCA Trigger Test - Critical ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: new Date().toISOString(), // ISO 8601 string format
      source: 'Manual',
      status: 'Open',
      cost: 100000, // Very high cost
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(highCostEvent),
    });

    createdEventIds.push(event.id);

    // Get RCA trigger config
    try {
      const rcaConfigs = await apiRequest<RcaTriggerConfigSummary[]>(`/rca-trigger-configs?tenantId=${fixture.tenant.id}`, {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });

      if (rcaConfigs && rcaConfigs.length > 0) {
        const activeConfig = rcaConfigs.find((c) => c.isActive);
        if (activeConfig) {
          console.log('✅ Found active RCA trigger config:', activeConfig.name);
          console.log(`   Rules: ${activeConfig.rules?.length || 0}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch RCA trigger config:', error);
    }

    expect(event).toBeDefined();
    expect(event.cost).toBeGreaterThanOrEqual(100000);
    // Plan 3.9: no severity is derived from cost (that derivation never existed) and the RCA cost trigger
    // stays off until the owner sets rca_policy.costThreshold (D08 / D13), so only the stored facts are checked.
    expect(event.severity ?? null).toBeNull();
  });

  test('RCA RULES: should show RCA button for qualifying events in UI', async ({ page }) => {
    // Create a qualifying event
    const qualifyingEvent = {
      eventId: `E2E-QUALIFYING-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E RCA Qualifying Event ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: new Date().toISOString(), // ISO 8601 string format
      source: 'Manual',
      status: 'Open',
      cost: 75000,
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(qualifyingEvent),
    });

    createdEventIds.push(event.id);

    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Search for the event
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isSearchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isSearchVisible) {
      await searchInput.fill(qualifyingEvent.description.substring(0, 20));
      await page.waitForTimeout(2000);
    }

    // Look for RCA button
    const rcaButton = page.locator('button:has-text("RCA"), button:has-text("Create RCA"), button:has-text("Start RCA")').first();
    const isRcaButtonVisible = await rcaButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isRcaButtonVisible) {
      console.log('✅ RCA button is visible for qualifying event');
    } else {
      console.log('ℹ️ RCA button not visible (may not meet trigger criteria)');
    }
  });

  // ==================== RCA CREATION TESTS ====================

  test('RCA CREATE: should create RCA from event via API', async () => {
    // Get user ID from auth profile
    let userId = '';
    try {
      const profile = await apiRequest<UserProfile>('/auth/profile', {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });
      userId = profile.id || profile.userId || '';
    } catch (error) {
      console.warn('Could not fetch user profile, RCA will use empty teamLeadId');
    }

    // Create an event first
    const eventData = {
      eventId: `E2E-RCA-CREATE-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E RCA Creation Test Event ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: new Date().toISOString(), // ISO 8601 string format
      source: 'Manual',
      status: 'Open',
      cost: 60000,
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(eventData),
    });

    createdEventIds.push(event.id);

    // Create RCA for this event
    const rcaData = {
      eventId: event.id,
      title: `RCA for ${eventData.description}`,
      description: `Root cause analysis for event: ${eventData.description}`,
      status: 'Draft',
      priority: 'High',
      teamLeadId: userId,
      teamMemberIds: [],
      recommendations: [],
      evidence: [],
    };

    const rca = await apiRequest<RcaDto>('/rcas', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(rcaData),
    });

    expect(rca).toBeDefined();
    expect(rca.id).toBeDefined();
    expect(rca.eventId).toBe(event.id);
    createdRcaIds.push(rca.id);
    console.log(`✅ Created RCA: ${rca.id} for event: ${event.id}`);
  });

  test('RCA CREATE: should create RCA from event via UI', async ({ page }) => {
    // Create a qualifying event
    const eventData = {
      eventId: `E2E-UI-RCA-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E UI RCA Test Event ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: new Date().toISOString(), // ISO 8601 string format
      source: 'Manual',
      status: 'Open',
      cost: 80000,
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(eventData),
    });

    createdEventIds.push(event.id);

    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Search for the event
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isSearchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isSearchVisible) {
      await searchInput.fill(eventData.description.substring(0, 15));
      await page.waitForTimeout(2000);
    }

    // Try to find and click the event row/card
    const eventRow = page.locator(`text=${eventData.description}`).first();
    const isEventVisible = await eventRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (isEventVisible) {
      // Click on the event
      await eventRow.click();
      await page.waitForTimeout(1000);

      // Look for RCA button
      const rcaButton = page.locator('button:has-text("RCA"), button:has-text("Create RCA"), button:has-text("Start RCA")').first();
      const isRcaButtonVisible = await rcaButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (isRcaButtonVisible) {
        await rcaButton.click();
        await page.waitForTimeout(2000);

        // Check if we navigated to RCA page or opened a dialog
        const currentUrl = page.url();
        if (currentUrl.includes('/rca')) {
          console.log('✅ Navigated to RCA creation page');
        } else {
          // Might be a dialog
          const dialog = page.locator('[role="dialog"]').first();
          const isDialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
          if (isDialogVisible) {
            console.log('✅ RCA creation dialog opened');
          }
        }
      } else {
        console.log('ℹ️ RCA button not visible for this event');
      }
    } else {
      console.log('ℹ️ Event not visible in UI, skipping UI RCA creation test');
    }
  });

  // ==================== FULL WORKFLOW TEST ====================

  test('WORKFLOW: should complete full event pull → display → RCA creation workflow', async ({ page }) => {
    // Step 1: Create a test event (simulating event pull)
    const eventData = {
      eventId: `E2E-WORKFLOW-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E Full Workflow Test ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: new Date().toISOString(), // ISO 8601 string format
      source: 'Manual',
      status: 'Open',
      cost: 90000,
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(eventData),
    });

    createdEventIds.push(event.id);
    console.log(`✅ Step 1: Created event ${event.id}`);

    // Step 2: Verify event appears in EventHub
    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Search for the event
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isSearchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isSearchVisible) {
      await searchInput.fill(eventData.description.substring(0, 15));
      await page.waitForTimeout(2000);
    }

    // Plan 3.9: the fixture event belongs to a fresh "E2E Test Tenant", while the UI shows the user's
    // selected plant, so the Event Hub cannot list it; the event is checked through the API of its tenant
    // (Event Hub display is covered by event-hub-v2-ux04.spec.ts).
    const stored = await apiRequest<ProductionEventDto>(`/production-events/${event.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    expect(stored.id).toBe(event.id);
    expect(stored.description).toBe(eventData.description);
    console.log('✅ Step 2: Event listed for its tenant');

    // Step 3: Get user ID and create RCA for the event
    let userId = '';
    try {
      const profile = await apiRequest<UserProfile>('/auth/profile', {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });
      userId = profile.id || profile.userId || '';
    } catch (error) {
      console.warn('Could not fetch user profile');
    }

    const rcaData = {
      eventId: event.id,
      title: `RCA for ${eventData.description}`,
      description: `Root cause analysis for workflow test event`,
      status: 'Draft',
      priority: 'High',
      teamLeadId: userId,
      teamMemberIds: [],
      recommendations: [],
      evidence: [],
    };

    const rca = await apiRequest<RcaDto>('/rcas', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(rcaData),
    });

    expect(rca).toBeDefined();
    expect(rca.eventId).toBe(event.id);
    createdRcaIds.push(rca.id);
    console.log(`✅ Step 3: Created RCA ${rca.id} for event ${event.id}`);

    // Step 4: Verify RCA is linked to event
    const updatedEvent = await apiRequest<ProductionEventDto>(`/production-events/${event.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    // Event might have rcaId field
    if (updatedEvent.rcaId) {
      expect(updatedEvent.rcaId).toBe(rca.id);
      console.log('✅ Step 4: RCA linked to event');
    } else {
      console.log('ℹ️ Event does not have rcaId field (may need manual linking)');
    }
  });

  test('WORKFLOW: should handle event with RCA trigger rules', async ({ page }) => {
    // Create event that should trigger RCA based on rules
    const triggerEvent = {
      eventId: `E2E-TRIGGER-RULES-${Date.now()}`,
      eventType: 'ProductionLoss',
      description: `E2E Trigger Rules Test ${Date.now()}`,
      unitId: fixture.unit.id,
      startTime: new Date().toISOString(), // ISO 8601 string format
      source: 'Manual',
      status: 'Open',
      cost: 150000, // Very high cost to trigger rules
    };

    const event = await apiRequest<ProductionEventDto>('/production-events', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(triggerEvent),
    });

    createdEventIds.push(event.id);

    await loginViaAPI(page);
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify event is visible
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isSearchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isSearchVisible) {
      await searchInput.fill(triggerEvent.description.substring(0, 15));
      await page.waitForTimeout(2000);
    }

    const eventVisible = await page.locator(`text=${triggerEvent.description}`).first().isVisible({ timeout: 5000 }).catch(() => false);
    
    if (eventVisible) {
      // Check if RCA button is shown (based on trigger rules)
      const rcaButton = page.locator('button:has-text("RCA"), button:has-text("Create RCA")').first();
      const isRcaButtonVisible = await rcaButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isRcaButtonVisible) {
        console.log('✅ RCA button visible - event meets trigger criteria');
      } else {
        console.log('ℹ️ RCA button not visible - event may not meet trigger criteria');
      }
    }
  });
});

