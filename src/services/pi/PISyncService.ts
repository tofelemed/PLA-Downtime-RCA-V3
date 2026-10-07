import { PIClient } from './PIClient';
import { piBrowserApi } from '../api/piBrowserApi';

export interface SyncParams {
  tenantId: string;
  scopeType: 'element' | 'database';
  scopeId: string;
  startTimeUtc: string;
  endTimeUtc: string;
  maxCount?: number;
}

export class PISyncService {
  private client: PIClient;

  constructor(client: PIClient) {
    this.client = client;
  }

  async syncRange(params: SyncParams) {
    const { tenantId, scopeType, scopeId, startTimeUtc, endTimeUtc, maxCount = 200 } = params;

    // Unified backend path — full attribute mapping, dedup, watermarks, WebSocket broadcast
    if (this.client.tenantId || tenantId) {
      const result = await piBrowserApi.triggerSync(this.client.tenantId || tenantId, {
        scopeType,
        scopeId,
        startTimeUtc,
        endTimeUtc,
        maxCount,
        autoCreateProductionEvents: true,
      });
      return {
        fetched: result.eventsFetched,
        stored: result.eventsStored,
        createdAppEvents: result.productionEventsCreated,
        updatedAppEvents: result.productionEventsUpdated || 0,
        skippedAppEvents: result.productionEventsSkipped || 0,
        unmappedAppEvents: result.unmappedEventsCreated || 0,
      };
    }

    throw new Error('PI sync requires a tenant with a saved backend PI connection');
  }
}
