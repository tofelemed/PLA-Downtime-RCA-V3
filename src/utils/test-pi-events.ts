/**
 * Test Utility: Pull Events from PI System
 * 
 * This utility can be called from the browser console or integrated into the UI.
 * Usage: Import and call testPIEventPull() with tenantId
 */

import { eventPullService } from '../services/EventPullService';
import { piIntegrationApi } from '../services/api/piIntegrationApi';
import { connectivityApi } from '../services/api/connectivityApi';

export interface TestPIEventPullResult {
  success: boolean;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  unmappedEventsCreated: number;
  errors: string[];
  message: string;
}

/**
 * Test pulling events from PI system
 */
export async function testPIEventPull(tenantId: string): Promise<TestPIEventPullResult> {
  try {
    // Step 1: Get available event sources
    const sources = await connectivityApi.getEventSources(tenantId);
    const piSources = sources.filter(s => s.type === 'PI' && s.enabled);

    if (piSources.length === 0) {
      return {
        success: false,
        eventsFetched: 0,
        eventsStored: 0,
        productionEventsCreated: 0,
        unmappedEventsCreated: 0,
        errors: ['No enabled PI sources found. Please configure a PI connection first.'],
        message: 'No PI sources available'
      };
    }

    const piSource = piSources[0];

    // Step 2: Get PI connection details
    const piConnections = await piIntegrationApi.listConnections({ tenantId });
    if (piConnections.length === 0) {
      return {
        success: false,
        eventsFetched: 0,
        eventsStored: 0,
        productionEventsCreated: 0,
        unmappedEventsCreated: 0,
        errors: ['No PI connections found in database.'],
        message: 'No PI connections found'
      };
    }

    // Step 3: Pull events (last 1 hour)
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 3600 * 1000).toISOString();

    const result = await eventPullService.pullFromSource(
      tenantId,
      'PI',
      piSource.id,
      {
        startTimeUtc: startTime,
        endTimeUtc: endTime,
        maxCount: 100,
        autoCreateProductionEvents: true,
      }
    );

    return {
      success: result.success,
      eventsFetched: result.eventsFetched,
      eventsStored: result.eventsStored,
      productionEventsCreated: result.productionEventsCreated,
      unmappedEventsCreated: result.unmappedEventsCreated || 0,
      errors: result.errors || [],
      message: result.success 
        ? `Pulled ${result.eventsFetched} events, created ${result.productionEventsCreated} production events, ${result.unmappedEventsCreated || 0} unmapped`
        : `Failed to pull events: ${result.errors?.join(', ') || 'Unknown error'}`
    };

  } catch (error: any) {
    return {
      success: false,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      unmappedEventsCreated: 0,
      errors: [error.message || 'Unknown error'],
      message: `Error: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Get available PI sources for a tenant
 */
export async function getPISources(tenantId: string) {
  try {
    const sources = await connectivityApi.getEventSources(tenantId);
    return sources.filter(s => s.type === 'PI');
  } catch (error: any) {
    console.error('Failed to get PI sources:', error);
    return [];
  }
}

/**
 * Get PI connections for a tenant
 */
export async function getPIConnections(tenantId: string) {
  try {
    return await piIntegrationApi.listConnections({ tenantId });
  } catch (error: any) {
    console.error('Failed to get PI connections:', error);
    return [];
  }
}

