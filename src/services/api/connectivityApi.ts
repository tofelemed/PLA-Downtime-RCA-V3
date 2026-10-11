import { httpClient } from './httpClient';

export interface EventSource {
  type: string;
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  sourceType: string;
}

export interface PullEventsRequest {
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI' | 'SystemIntegration';
  sourceId: string;
  tenantId: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  filters?: Record<string, any>;
  maxCount?: number;
  autoCreateProductionEvents?: boolean;
}

export interface PullEventsResponse {
  success: boolean;
  sourceType: string;
  sourceId: string;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  productionEventsUpdated?: number;
  productionEventsSkipped?: number;
  unmappedEventsCreated?: number;
  errors: string[];
  events: any[];
  metadata?: Record<string, any>;
}

export const connectivityApi = {
  // Get available event sources
  async getEventSources(tenantId: string): Promise<EventSource[]> {
    const response = await httpClient.get<EventSource[]>('/connectivity/events/sources', {
      params: { tenantId },
    });
    return response.data;
  },

  // Pull events from any source
  async pullEvents(request: PullEventsRequest): Promise<PullEventsResponse> {
    const response = await httpClient.post<PullEventsResponse>('/connectivity/events/pull', request);
    return response.data;
  },

  // OPC UA connections
  async getOPCUAConnections(tenantId: string) {
    const response = await httpClient.get('/connectivity/opcua/connections', {
      params: { tenantId },
    });
    return response.data;
  },

  async createOPCUAConnection(data: any) {
    const response = await httpClient.post('/connectivity/opcua/connections', data);
    return response.data;
  },

  async updateOPCUAConnection(id: string, data: any) {
    const response = await httpClient.patch(`/connectivity/opcua/connections/${id}`, data);
    return response.data;
  },

  async deleteOPCUAConnection(id: string) {
    await httpClient.delete(`/connectivity/opcua/connections/${id}`);
  },

  async getOPCUAConnection(id: string) {
    const response = await httpClient.get(`/connectivity/opcua/connections/${id}`);
    return response.data;
  },

  async testOPCUAConnection(id: string, tenantId: string, testData: any) {
    return httpClient.request(`/connectivity/opcua/connections/${id}/test`, {
      method: 'POST',
      body: testData,
      query: { tenantId },
    });
  },

  // Modbus connections
  async getModbusConnections(tenantId: string) {
    const response = await httpClient.get('/connectivity/modbus/connections', {
      params: { tenantId },
    });
    return response.data;
  },

  async createModbusConnection(data: any) {
    const response = await httpClient.post('/connectivity/modbus/connections', data);
    return response.data;
  },

  async updateModbusConnection(id: string, data: any) {
    const response = await httpClient.patch(`/connectivity/modbus/connections/${id}`, data);
    return response.data;
  },

  async deleteModbusConnection(id: string) {
    await httpClient.delete(`/connectivity/modbus/connections/${id}`);
  },

  async getModbusConnection(id: string) {
    const response = await httpClient.get(`/connectivity/modbus/connections/${id}`);
    return response.data;
  },

  async testModbusConnection(id: string, tenantId: string, testData: any) {
    return httpClient.request(`/connectivity/modbus/connections/${id}/test`, {
      method: 'POST',
      body: testData,
      query: { tenantId },
    });
  },

  // MQTT connections
  async getMQTTConnections(tenantId: string) {
    const response = await httpClient.get('/connectivity/mqtt/connections', {
      params: { tenantId },
    });
    return response.data;
  },

  async createMQTTConnection(data: any) {
    const response = await httpClient.post('/connectivity/mqtt/connections', data);
    return response.data;
  },

  async updateMQTTConnection(id: string, data: any) {
    const response = await httpClient.patch(`/connectivity/mqtt/connections/${id}`, data);
    return response.data;
  },

  async deleteMQTTConnection(id: string) {
    await httpClient.delete(`/connectivity/mqtt/connections/${id}`);
  },

  async getMQTTConnection(id: string) {
    const response = await httpClient.get(`/connectivity/mqtt/connections/${id}`);
    return response.data;
  },

  async testMQTTConnection(id: string, tenantId: string, testData: any) {
    return httpClient.request(`/connectivity/mqtt/connections/${id}/test`, {
      method: 'POST',
      body: testData,
      query: { tenantId },
    });
  },

  // EtherNet/IP connections
  async getEtherNetIPConnections(tenantId: string) {
    const response = await httpClient.get('/connectivity/ethernetip/connections', {
      params: { tenantId },
    });
    return response.data;
  },

  async createEtherNetIPConnection(data: any) {
    const response = await httpClient.post('/connectivity/ethernetip/connections', data);
    return response.data;
  },

  async updateEtherNetIPConnection(id: string, data: any) {
    const response = await httpClient.patch(`/connectivity/ethernetip/connections/${id}`, data);
    return response.data;
  },

  async deleteEtherNetIPConnection(id: string) {
    await httpClient.delete(`/connectivity/ethernetip/connections/${id}`);
  },

  async getEtherNetIPConnection(id: string) {
    const response = await httpClient.get(`/connectivity/ethernetip/connections/${id}`);
    return response.data;
  },

  async testEtherNetIPConnection(id: string, tenantId: string, testData: any) {
    return httpClient.request(`/connectivity/ethernetip/connections/${id}/test`, {
      method: 'POST',
      body: testData,
      query: { tenantId },
    });
  },

  // System integrations
  async getSystemIntegrations(tenantId: string) {
    const response = await httpClient.get('/connectivity/integrations', {
      params: { tenantId },
    });
    return response.data;
  },

  async createSystemIntegration(data: any) {
    const response = await httpClient.post('/connectivity/integrations', data);
    return response.data;
  },

  async getPIConnections(tenantId: string) {
    const response = await httpClient.get('/connectivity/integrations/pi', {
      params: { tenantId },
    });
    return response.data;
  },

  async getCMMSConnections(tenantId: string) {
    const response = await httpClient.get('/connectivity/integrations/cmms', {
      params: { tenantId },
    });
    return response.data;
  },

  // Health monitoring
  async getSystemHealth(tenantId: string) {
    const response = await httpClient.get('/connectivity/health', {
      params: { tenantId },
    });
    return response.data;
  },

  async performHealthCheck(tenantId: string) {
    return httpClient.request('/connectivity/health/check', {
      method: 'POST',
      body: null,
      query: { tenantId },
    });
  },

  // Protocol overview
  async getProtocolOverview(tenantId: string) {
    const response = await httpClient.get('/connectivity/overview', {
      params: { tenantId },
    });
    return response.data;
  },
};

