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
    const response = await httpClient.get('/connectivity/events/sources', {
      params: { tenantId },
    });
    return response.data;
  },

  // Pull events from any source
  async pullEvents(request: PullEventsRequest): Promise<PullEventsResponse> {
    const response = await httpClient.post('/connectivity/events/pull', request);
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
    const response = await httpClient.delete(`/connectivity/opcua/connections/${id}`);
    return response.data;
  },

  async getOPCUAConnection(id: string) {
    const response = await httpClient.get(`/connectivity/opcua/connections/${id}`);
    return response.data;
  },

  async testOPCUAConnection(id: string, tenantId: string, testData: any) {
    const response = await httpClient.post(`/connectivity/opcua/connections/${id}/test`, testData, {
      params: { tenantId },
    });
    return response.data;
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
    const response = await httpClient.delete(`/connectivity/modbus/connections/${id}`);
    return response.data;
  },

  async getModbusConnection(id: string) {
    const response = await httpClient.get(`/connectivity/modbus/connections/${id}`);
    return response.data;
  },

  async testModbusConnection(id: string, tenantId: string, testData: any) {
    const response = await httpClient.post(`/connectivity/modbus/connections/${id}/test`, testData, {
      params: { tenantId },
    });
    return response.data;
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
    const response = await httpClient.delete(`/connectivity/mqtt/connections/${id}`);
    return response.data;
  },

  async getMQTTConnection(id: string) {
    const response = await httpClient.get(`/connectivity/mqtt/connections/${id}`);
    return response.data;
  },

  async testMQTTConnection(id: string, tenantId: string, testData: any) {
    const response = await httpClient.post(`/connectivity/mqtt/connections/${id}/test`, testData, {
      params: { tenantId },
    });
    return response.data;
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
    const response = await httpClient.delete(`/connectivity/ethernetip/connections/${id}`);
    return response.data;
  },

  async getEtherNetIPConnection(id: string) {
    const response = await httpClient.get(`/connectivity/ethernetip/connections/${id}`);
    return response.data;
  },

  async testEtherNetIPConnection(id: string, tenantId: string, testData: any) {
    const response = await httpClient.post(`/connectivity/ethernetip/connections/${id}/test`, testData, {
      params: { tenantId },
    });
    return response.data;
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
    const response = await httpClient.post('/connectivity/health/check', null, {
      params: { tenantId },
    });
    return response.data;
  },

  // Protocol overview
  async getProtocolOverview(tenantId: string) {
    const response = await httpClient.get('/connectivity/overview', {
      params: { tenantId },
    });
    return response.data;
  },
};

