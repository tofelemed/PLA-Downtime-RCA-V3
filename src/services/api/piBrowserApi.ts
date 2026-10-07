import { httpClient } from './httpClient';

export interface PIBrowserRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | boolean>;
  data?: any;
}

export interface PISyncResult {
  success: boolean;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  productionEventsUpdated?: number;
  productionEventsSkipped?: number;
  unmappedEventsCreated?: number;
  errors: string[];
  events: any[];
}

export const piBrowserApi = {
  async testConnection(tenantId: string) {
    return httpClient.request<{ connected: boolean; message: string }>(
      `pi-browser/${tenantId}/test-connection`,
      { method: 'GET', skipAuth: false },
    );
  },

  async request<T = any>(tenantId: string, payload: PIBrowserRequest): Promise<T> {
    return httpClient.request<T>(`pi-browser/${tenantId}/request`, {
      method: 'POST',
      body: payload,
    });
  },

  async getEventFrames(
    tenantId: string,
    params: {
      scopeType?: 'database' | 'element';
      scopeId?: string;
      startTimeUtc: string;
      endTimeUtc: string;
      templateName?: string;
      maxCount?: number;
      startIndex?: number;
    },
  ) {
    return httpClient.request(`pi-browser/${tenantId}/eventframes`, {
      method: 'GET',
      query: params as Record<string, unknown>,
    });
  },

  async triggerSync(
    tenantId: string,
    body?: {
      startTimeUtc?: string;
      endTimeUtc?: string;
      scopeType?: 'database' | 'element';
      scopeId?: string;
      templateName?: string;
      maxCount?: number;
      autoCreateProductionEvents?: boolean;
    },
  ): Promise<PISyncResult> {
    return httpClient.request<PISyncResult>(`pi-browser/${tenantId}/sync`, {
      method: 'POST',
      body: body || {},
    });
  },
};
