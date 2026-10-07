import { connectivityApi, EventSource, PullEventsRequest, PullEventsResponse } from './api/connectivityApi';

/**
 * Unified Event Pulling Service
 * Pulls events from any configured source (PI, OPC UA, Modbus, MQTT, etc.)
 */
class EventPullService {
  private static instance: EventPullService;
  private activePulls: Map<string, Promise<PullEventsResponse>> = new Map();

  static getInstance(): EventPullService {
    if (!EventPullService.instance) {
      EventPullService.instance = new EventPullService();
    }
    return EventPullService.instance;
  }

  /**
   * Get all available event sources
   */
  async getAvailableSources(tenantId: string): Promise<EventSource[]> {
    try {
      return await connectivityApi.getEventSources(tenantId);
    } catch (error) {
      console.error('Failed to get available sources:', error);
      throw error;
    }
  }

  /**
   * Pull events from PI system
   */
  async pullFromPI(
    tenantId: string,
    options: {
      startTimeUtc?: string;
      endTimeUtc?: string;
      scopeType?: 'database' | 'element';
      scopeId?: string;
      templateName?: string;
      maxCount?: number;
      autoCreateProductionEvents?: boolean;
    } = {}
  ): Promise<PullEventsResponse> {
    // Get PI sources
    const sources = await this.getAvailableSources(tenantId);
    const piSource = sources.find(s => s.type === 'PI' && s.enabled);

    if (!piSource) {
      throw new Error('No enabled PI source found for tenant');
    }

    const request: PullEventsRequest = {
      sourceType: 'PI',
      sourceId: piSource.id,
      tenantId,
      startTimeUtc: options.startTimeUtc,
      endTimeUtc: options.endTimeUtc,
      filters: {
        scopeType: options.scopeType,
        scopeId: options.scopeId,
        templateName: options.templateName,
      },
      maxCount: options.maxCount || 500,
      autoCreateProductionEvents: options.autoCreateProductionEvents !== false,
    };

    return await this.pullFromSourceInternal(request);
  }

  /**
   * Pull events from any source
   */
  async pullFromSource(
    tenantId: string,
    sourceType: PullEventsRequest['sourceType'],
    sourceId: string,
    options: {
      startTimeUtc?: string;
      endTimeUtc?: string;
      filters?: Record<string, any>;
      maxCount?: number;
      autoCreateProductionEvents?: boolean;
    } = {}
  ): Promise<PullEventsResponse> {
    const request: PullEventsRequest = {
      sourceType,
      sourceId,
      tenantId,
      startTimeUtc: options.startTimeUtc,
      endTimeUtc: options.endTimeUtc,
      filters: options.filters,
      maxCount: options.maxCount || 500,
      autoCreateProductionEvents: options.autoCreateProductionEvents !== false,
    };

    return await this.pullFromSourceInternal(request);
  }

  /**
   * Internal method to handle pulling with duplicate prevention
   */
  private async pullFromSourceInternal(request: PullEventsRequest): Promise<PullEventsResponse> {
    // Prevent duplicate pulls
    const pullKey = `${request.sourceType}-${request.sourceId}-${request.tenantId}`;
    if (this.activePulls.has(pullKey)) {
      console.warn(`Pull already in progress for ${pullKey}, returning existing promise`);
      return await this.activePulls.get(pullKey)!;
    }

    const pullPromise = connectivityApi.pullEvents(request);
    this.activePulls.set(pullKey, pullPromise);

    try {
      const result = await pullPromise;
      return result;
    } catch (error) {
      console.error('Event pull failed:', error);
      throw error;
    } finally {
      this.activePulls.delete(pullKey);
    }
  }

  /**
   * Get PI sources specifically
   */
  async getPISources(tenantId: string): Promise<EventSource[]> {
    const sources = await this.getAvailableSources(tenantId);
    return sources.filter(s => s.type === 'PI');
  }

  /**
   * Get sources by type
   */
  async getSourcesByType(tenantId: string, type: string): Promise<EventSource[]> {
    const sources = await this.getAvailableSources(tenantId);
    return sources.filter(s => s.type === type);
  }
}

export const eventPullService = EventPullService.getInstance();

