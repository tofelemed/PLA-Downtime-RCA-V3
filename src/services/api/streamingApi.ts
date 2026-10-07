import { httpClient } from './httpClient';

// DTOs matching backend
export interface StreamDataSourceDto {
  id: string;
  name: string;
  connectorType: string;
  config?: Record<string, any>;
  enabled: boolean;
  lastData?: any;
  lastUpdate?: string | null;
  errorCount: number;
  status: string;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamDataSinkDto {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  enabled: boolean;
  lastWrite?: string | null;
  writeCount: number;
  errorCount: number;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamProcessorDto {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  enabled: boolean;
  order: number;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamMetricDto {
  id: string;
  timestamp: string;
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageLatency: number;
  throughput: number;
  activeSources: number;
  activeSinks: number;
  activeProcessors: number;
  errorRate: number;
  dataQuality?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamAlertDto {
  id: string;
  type: 'warning' | 'error' | 'critical' | 'info';
  message: string;
  timestamp: string;
  source: string;
  severity: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamConnectionConfigDto {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  enabled: boolean;
  lastConnection?: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  errorCount: number;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

// Payload types
export interface UpsertStreamDataSourcePayload {
  id: string;
  name: string;
  connectorType: string;
  config?: Record<string, any>;
  enabled?: boolean;
  lastData?: Record<string, any>;
  lastUpdate?: string;
  errorCount?: number;
  status?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
}

export interface UpsertStreamDataSinkPayload {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  enabled?: boolean;
  lastWrite?: string;
  writeCount?: number;
  errorCount?: number;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
}

export interface UpsertStreamProcessorPayload {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  enabled?: boolean;
  order?: number;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
}

export interface UpsertStreamMetricPayload {
  id: string;
  timestamp: string;
  totalEvents?: number;
  processedEvents?: number;
  droppedEvents?: number;
  averageLatency?: number;
  throughput?: number;
  activeSources?: number;
  activeSinks?: number;
  activeProcessors?: number;
  errorRate?: number;
  dataQuality?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
}

export interface UpsertStreamAlertPayload {
  id: string;
  type: 'warning' | 'error' | 'critical' | 'info';
  message: string;
  timestamp: string;
  source: string;
  severity?: number;
  acknowledged?: boolean;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
}

export interface UpsertStreamConnectionConfigPayload {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  enabled?: boolean;
  lastConnection?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting' | 'error';
  errorCount?: number;
  metadata?: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
}

// Query types
export interface StreamDataSourceQuery {
  tenantId?: string;
  organizationId?: string;
  connectorType?: string;
  status?: string;
  enabled?: boolean;
}

export interface StreamDataSinkQuery {
  tenantId?: string;
  organizationId?: string;
  type?: string;
  enabled?: boolean;
}

export interface StreamProcessorQuery {
  tenantId?: string;
  organizationId?: string;
  type?: string;
  enabled?: boolean;
}

export interface StreamMetricQuery {
  tenantId?: string;
  organizationId?: string;
  limit?: number;
}

export interface StreamAlertQuery {
  tenantId?: string;
  organizationId?: string;
  type?: string;
  acknowledged?: boolean;
}

export interface StreamConnectionConfigQuery {
  tenantId?: string;
  organizationId?: string;
  type?: string;
  enabled?: boolean;
}

class StreamingApi {
  private basePath = '/streaming';

  // Data Sources
  async upsertDataSource(payload: UpsertStreamDataSourcePayload): Promise<StreamDataSourceDto> {
    const response = await httpClient.post<StreamDataSourceDto>(`${this.basePath}/data-sources`, payload);
    return response;
  }

  async listDataSources(query?: StreamDataSourceQuery): Promise<StreamDataSourceDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.connectorType) params.append('connectorType', query.connectorType);
    if (query?.status) params.append('status', query.status);
    if (query?.enabled !== undefined) params.append('enabled', String(query.enabled));
    
    const response = await httpClient.get<StreamDataSourceDto[]>(
      `${this.basePath}/data-sources${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getDataSource(id: string): Promise<StreamDataSourceDto> {
    const response = await httpClient.get<StreamDataSourceDto>(`${this.basePath}/data-sources/${id}`);
    return response;
  }

  async deleteDataSource(id: string): Promise<void> {
    await httpClient.delete(`${this.basePath}/data-sources/${id}`);
  }

  // Data Sinks
  async upsertDataSink(payload: UpsertStreamDataSinkPayload): Promise<StreamDataSinkDto> {
    const response = await httpClient.post<StreamDataSinkDto>(`${this.basePath}/data-sinks`, payload);
    return response;
  }

  async listDataSinks(query?: StreamDataSinkQuery): Promise<StreamDataSinkDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.type) params.append('type', query.type);
    if (query?.enabled !== undefined) params.append('enabled', String(query.enabled));
    
    const response = await httpClient.get<StreamDataSinkDto[]>(
      `${this.basePath}/data-sinks${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getDataSink(id: string): Promise<StreamDataSinkDto> {
    const response = await httpClient.get<StreamDataSinkDto>(`${this.basePath}/data-sinks/${id}`);
    return response;
  }

  async deleteDataSink(id: string): Promise<void> {
    await httpClient.delete(`${this.basePath}/data-sinks/${id}`);
  }

  // Stream Processors
  async upsertProcessor(payload: UpsertStreamProcessorPayload): Promise<StreamProcessorDto> {
    const response = await httpClient.post<StreamProcessorDto>(`${this.basePath}/processors`, payload);
    return response;
  }

  async listProcessors(query?: StreamProcessorQuery): Promise<StreamProcessorDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.type) params.append('type', query.type);
    if (query?.enabled !== undefined) params.append('enabled', String(query.enabled));
    
    const response = await httpClient.get<StreamProcessorDto[]>(
      `${this.basePath}/processors${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getProcessor(id: string): Promise<StreamProcessorDto> {
    const response = await httpClient.get<StreamProcessorDto>(`${this.basePath}/processors/${id}`);
    return response;
  }

  async deleteProcessor(id: string): Promise<void> {
    await httpClient.delete(`${this.basePath}/processors/${id}`);
  }

  // Metrics
  async saveMetric(payload: UpsertStreamMetricPayload): Promise<StreamMetricDto> {
    const response = await httpClient.post<StreamMetricDto>(`${this.basePath}/metrics`, payload);
    return response;
  }

  async getLatestMetric(query?: StreamMetricQuery): Promise<StreamMetricDto | null> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    
    const response = await httpClient.get<StreamMetricDto | null>(
      `${this.basePath}/metrics/latest${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getMetricHistory(query?: StreamMetricQuery): Promise<StreamMetricDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.limit) params.append('limit', String(query.limit));
    
    const response = await httpClient.get<StreamMetricDto[]>(
      `${this.basePath}/metrics/history${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  // Alerts
  async upsertAlert(payload: UpsertStreamAlertPayload): Promise<StreamAlertDto> {
    const response = await httpClient.post<StreamAlertDto>(`${this.basePath}/alerts`, payload);
    return response;
  }

  async listAlerts(query?: StreamAlertQuery): Promise<StreamAlertDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.type) params.append('type', query.type);
    if (query?.acknowledged !== undefined) params.append('acknowledged', String(query.acknowledged));
    
    const response = await httpClient.get<StreamAlertDto[]>(
      `${this.basePath}/alerts${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getActiveAlerts(query?: StreamAlertQuery): Promise<StreamAlertDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.type) params.append('type', query.type);
    
    const response = await httpClient.get<StreamAlertDto[]>(
      `${this.basePath}/alerts/active${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getAlert(id: string): Promise<StreamAlertDto> {
    const response = await httpClient.get<StreamAlertDto>(`${this.basePath}/alerts/${id}`);
    return response;
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await httpClient.patch(`${this.basePath}/alerts/${id}/acknowledge`, {});
  }

  async deleteAlert(id: string): Promise<void> {
    await httpClient.delete(`${this.basePath}/alerts/${id}`);
  }

  // Connection Configs
  async upsertConnectionConfig(payload: UpsertStreamConnectionConfigPayload): Promise<StreamConnectionConfigDto> {
    const response = await httpClient.post<StreamConnectionConfigDto>(`${this.basePath}/connection-configs`, payload);
    return response;
  }

  async listConnectionConfigs(query?: StreamConnectionConfigQuery): Promise<StreamConnectionConfigDto[]> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    if (query?.type) params.append('type', query.type);
    if (query?.enabled !== undefined) params.append('enabled', String(query.enabled));
    
    const response = await httpClient.get<StreamConnectionConfigDto[]>(
      `${this.basePath}/connection-configs${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async getConnectionConfig(id: string): Promise<StreamConnectionConfigDto> {
    const response = await httpClient.get<StreamConnectionConfigDto>(`${this.basePath}/connection-configs/${id}`);
    return response;
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    await httpClient.delete(`${this.basePath}/connection-configs/${id}`);
  }

  // Bulk operations
  async exportAllData(query?: StreamDataSourceQuery): Promise<any> {
    const params = new URLSearchParams();
    if (query?.tenantId) params.append('tenantId', query.tenantId);
    if (query?.organizationId) params.append('organizationId', query.organizationId);
    
    const response = await httpClient.get<any>(
      `${this.basePath}/export${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response;
  }

  async importAllData(payload: any): Promise<void> {
    await httpClient.post(`${this.basePath}/import`, payload);
  }
}

export const streamingApi = new StreamingApi();

