// Universal Connector Service Layer
// This service uses backend APIs exclusively for all connector-related operations

import { 
  DataSourceStorage, 
  DataSinkStorage, 
  StreamProcessorStorage, 
  StreamMetricsStorage, 
  StreamAlertStorage, 
  ConnectionConfigStorage 
} from './UniversalConnectorDB';
import { streamingApi, StreamDataSourceDto, StreamDataSinkDto, StreamProcessorDto, StreamMetricDto, StreamAlertDto, StreamConnectionConfigDto } from '../api/streamingApi';

export interface IUniversalConnectorService {
  // Data Sources
  saveDataSource(source: DataSourceStorage): Promise<void>;
  getDataSource(id: string): Promise<DataSourceStorage | undefined>;
  getAllDataSources(): Promise<DataSourceStorage[]>;
  deleteDataSource(id: string): Promise<void>;
  
  // Data Sinks
  saveDataSink(sink: DataSinkStorage): Promise<void>;
  getDataSink(id: string): Promise<DataSinkStorage | undefined>;
  getAllDataSinks(): Promise<DataSinkStorage[]>;
  deleteDataSink(id: string): Promise<void>;
  
  // Stream Processors
  saveStreamProcessor(processor: StreamProcessorStorage): Promise<void>;
  getStreamProcessor(id: string): Promise<StreamProcessorStorage | undefined>;
  getAllStreamProcessors(): Promise<StreamProcessorStorage[]>;
  deleteStreamProcessor(id: string): Promise<void>;
  
  // Stream Metrics
  saveStreamMetrics(metrics: StreamMetricsStorage): Promise<void>;
  getLatestMetrics(): Promise<StreamMetricsStorage | undefined>;
  getMetricsHistory(limit?: number): Promise<StreamMetricsStorage[]>;
  
  // Stream Alerts
  saveStreamAlert(alert: StreamAlertStorage): Promise<void>;
  getStreamAlert(id: string): Promise<StreamAlertStorage | undefined>;
  getAllStreamAlerts(): Promise<StreamAlertStorage[]>;
  getActiveAlerts(): Promise<StreamAlertStorage[]>;
  acknowledgeAlert(id: string): Promise<void>;
  deleteStreamAlert(id: string): Promise<void>;
  
  // Connection Configs
  saveConnectionConfig(config: ConnectionConfigStorage): Promise<void>;
  getConnectionConfig(id: string): Promise<ConnectionConfigStorage | undefined>;
  getAllConnectionConfigs(): Promise<ConnectionConfigStorage[]>;
  getConnectionConfigsByType(type: string): Promise<ConnectionConfigStorage[]>;
  deleteConnectionConfig(id: string): Promise<void>;
  
  // Bulk operations
  exportAllData(): Promise<any>;
  importAllData(data: any): Promise<void>;
  
  // Utility
  getStorageType(): 'indexeddb' | 'fallback' | 'backend';
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}

export class UniversalConnectorService implements IUniversalConnectorService {
  private storageType: 'indexeddb' | 'fallback' | 'backend' = 'backend';
  private isInitialized: boolean = false;

  constructor() {
    // Use backend API exclusively
    this.storageType = 'backend';
  }

  // Mapping functions between frontend storage and backend DTOs
  private mapDtoToDataSourceStorage(dto: StreamDataSourceDto): DataSourceStorage {
    return {
      id: dto.id,
      name: dto.name,
      connectorType: dto.connectorType,
      config: dto.config || {},
      enabled: dto.enabled,
      lastData: dto.lastData,
      lastUpdate: dto.lastUpdate ? new Date(dto.lastUpdate) : undefined,
      errorCount: dto.errorCount,
      status: dto.status as 'active' | 'inactive' | 'error' | 'connecting',
      metadata: dto.metadata,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    };
  }

  private mapDataSourceStorageToPayload(storage: DataSourceStorage): any {
    return {
      id: storage.id,
      name: storage.name,
      connectorType: storage.connectorType,
      config: storage.config,
      enabled: storage.enabled,
      lastData: storage.lastData,
      lastUpdate: storage.lastUpdate?.toISOString(),
      errorCount: storage.errorCount,
      status: storage.status,
      metadata: storage.metadata,
    };
  }

  private mapDtoToDataSinkStorage(dto: StreamDataSinkDto): DataSinkStorage {
    return {
      id: dto.id,
      name: dto.name,
      type: dto.type,
      config: dto.config || {},
      enabled: dto.enabled,
      lastWrite: dto.lastWrite ? new Date(dto.lastWrite) : undefined,
      writeCount: dto.writeCount,
      errorCount: dto.errorCount,
      metadata: dto.metadata,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    };
  }

  private mapDataSinkStorageToPayload(storage: DataSinkStorage): any {
    return {
      id: storage.id,
      name: storage.name,
      type: storage.type,
      config: storage.config,
      enabled: storage.enabled,
      lastWrite: storage.lastWrite?.toISOString(),
      writeCount: storage.writeCount,
      errorCount: storage.errorCount,
      metadata: storage.metadata,
    };
  }

  private mapDtoToStreamProcessorStorage(dto: StreamProcessorDto): StreamProcessorStorage {
    return {
      id: dto.id,
      name: dto.name,
      type: dto.type,
      config: dto.config || {},
      enabled: dto.enabled,
      order: dto.order,
      inputSchema: dto.inputSchema,
      outputSchema: dto.outputSchema,
      metadata: dto.metadata,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    };
  }

  private mapStreamProcessorStorageToPayload(storage: StreamProcessorStorage): any {
    return {
      id: storage.id,
      name: storage.name,
      type: storage.type,
      config: storage.config,
      enabled: storage.enabled,
      order: storage.order,
      inputSchema: storage.inputSchema,
      outputSchema: storage.outputSchema,
      metadata: storage.metadata,
    };
  }

  private mapDtoToStreamMetricsStorage(dto: StreamMetricDto): StreamMetricsStorage {
    return {
      id: dto.id,
      timestamp: new Date(dto.timestamp),
      totalEvents: dto.totalEvents,
      processedEvents: dto.processedEvents,
      droppedEvents: dto.droppedEvents,
      averageLatency: dto.averageLatency,
      throughput: dto.throughput,
      activeSources: dto.activeSources,
      activeSinks: dto.activeSinks,
      activeProcessors: dto.activeProcessors,
      errorRate: dto.errorRate,
      dataQuality: dto.dataQuality || {
        completeness: 100,
        accuracy: 100,
        timeliness: 100,
        validity: 100,
        consistency: 100,
        lastUpdated: new Date(dto.timestamp),
      },
    };
  }

  private mapStreamMetricsStorageToPayload(storage: StreamMetricsStorage): any {
    return {
      id: storage.id,
      timestamp: storage.timestamp.toISOString(),
      totalEvents: storage.totalEvents,
      processedEvents: storage.processedEvents,
      droppedEvents: storage.droppedEvents,
      averageLatency: storage.averageLatency,
      throughput: storage.throughput,
      activeSources: storage.activeSources,
      activeSinks: storage.activeSinks,
      activeProcessors: storage.activeProcessors,
      errorRate: storage.errorRate,
      dataQuality: storage.dataQuality,
    };
  }

  private mapDtoToStreamAlertStorage(dto: StreamAlertDto): StreamAlertStorage {
    return {
      id: dto.id,
      type: dto.type,
      message: dto.message,
      timestamp: new Date(dto.timestamp),
      source: dto.source,
      severity: dto.severity,
      acknowledged: dto.acknowledged,
      metadata: dto.metadata,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    };
  }

  private mapStreamAlertStorageToPayload(storage: StreamAlertStorage): any {
    return {
      id: storage.id,
      type: storage.type,
      message: storage.message,
      timestamp: storage.timestamp.toISOString(),
      source: storage.source,
      severity: storage.severity,
      acknowledged: storage.acknowledged,
      metadata: storage.metadata,
    };
  }

  private mapDtoToConnectionConfigStorage(dto: StreamConnectionConfigDto): ConnectionConfigStorage {
    return {
      id: dto.id,
      name: dto.name,
      type: dto.type,
      config: dto.config || {},
      enabled: dto.enabled,
      lastConnection: dto.lastConnection ? new Date(dto.lastConnection) : undefined,
      connectionStatus: dto.connectionStatus,
      errorCount: dto.errorCount,
      metadata: dto.metadata,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    };
  }

  private mapConnectionConfigStorageToPayload(storage: ConnectionConfigStorage): any {
    return {
      id: storage.id,
      name: storage.name,
      type: storage.type,
      config: storage.config,
      enabled: storage.enabled,
      lastConnection: storage.lastConnection?.toISOString(),
      connectionStatus: storage.connectionStatus,
      errorCount: storage.errorCount,
      metadata: storage.metadata,
    };
  }

  // Initialize the service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    this.storageType = 'backend';
    console.log('Universal Connector Service initialized with backend storage');
  }

  // Get current storage type
  getStorageType(): 'indexeddb' | 'fallback' | 'backend' {
    return 'backend';
  }

  // Data Sources operations
  async saveDataSource(source: DataSourceStorage): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.upsertDataSource(this.mapDataSourceStorageToPayload(source));
  }

  async getDataSource(id: string): Promise<DataSourceStorage | undefined> {
    await this.ensureInitialized();
    const dto = await streamingApi.getDataSource(id);
    return this.mapDtoToDataSourceStorage(dto);
  }

  async getAllDataSources(): Promise<DataSourceStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.listDataSources();
    return dtos.map(dto => this.mapDtoToDataSourceStorage(dto));
  }

  async deleteDataSource(id: string): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.deleteDataSource(id);
  }

  // Data Sinks operations
  async saveDataSink(sink: DataSinkStorage): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.upsertDataSink(this.mapDataSinkStorageToPayload(sink));
  }

  async getDataSink(id: string): Promise<DataSinkStorage | undefined> {
    await this.ensureInitialized();
    const dto = await streamingApi.getDataSink(id);
    return this.mapDtoToDataSinkStorage(dto);
  }

  async getAllDataSinks(): Promise<DataSinkStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.listDataSinks();
    return dtos.map(dto => this.mapDtoToDataSinkStorage(dto));
  }

  async deleteDataSink(id: string): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.deleteDataSink(id);
  }

  // Stream Processors operations
  async saveStreamProcessor(processor: StreamProcessorStorage): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.upsertProcessor(this.mapStreamProcessorStorageToPayload(processor));
  }

  async getStreamProcessor(id: string): Promise<StreamProcessorStorage | undefined> {
    await this.ensureInitialized();
    const dto = await streamingApi.getProcessor(id);
    return this.mapDtoToStreamProcessorStorage(dto);
  }

  async getAllStreamProcessors(): Promise<StreamProcessorStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.listProcessors();
    return dtos.map(dto => this.mapDtoToStreamProcessorStorage(dto));
  }

  async deleteStreamProcessor(id: string): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.deleteProcessor(id);
  }

  // Stream Metrics operations
  async saveStreamMetrics(metrics: StreamMetricsStorage): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.saveMetric(this.mapStreamMetricsStorageToPayload(metrics));
  }

  async getLatestMetrics(): Promise<StreamMetricsStorage | undefined> {
    await this.ensureInitialized();
    const dto = await streamingApi.getLatestMetric();
    if (!dto) return undefined;
    return this.mapDtoToStreamMetricsStorage(dto);
  }

  async getMetricsHistory(limit: number = 100): Promise<StreamMetricsStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.getMetricHistory({ limit });
    return dtos.map(dto => this.mapDtoToStreamMetricsStorage(dto));
  }

  // Stream Alerts operations
  async saveStreamAlert(alert: StreamAlertStorage): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.upsertAlert(this.mapStreamAlertStorageToPayload(alert));
  }

  async getStreamAlert(id: string): Promise<StreamAlertStorage | undefined> {
    await this.ensureInitialized();
    const dto = await streamingApi.getAlert(id);
    return this.mapDtoToStreamAlertStorage(dto);
  }

  async getAllStreamAlerts(): Promise<StreamAlertStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.listAlerts();
    return dtos.map(dto => this.mapDtoToStreamAlertStorage(dto));
  }

  async getActiveAlerts(): Promise<StreamAlertStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.getActiveAlerts();
    return dtos.map(dto => this.mapDtoToStreamAlertStorage(dto));
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.acknowledgeAlert(id);
  }

  async deleteStreamAlert(id: string): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.deleteAlert(id);
  }

  // Connection Configs operations
  async saveConnectionConfig(config: ConnectionConfigStorage): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.upsertConnectionConfig(this.mapConnectionConfigStorageToPayload(config));
  }

  async getConnectionConfig(id: string): Promise<ConnectionConfigStorage | undefined> {
    await this.ensureInitialized();
    const dto = await streamingApi.getConnectionConfig(id);
    return this.mapDtoToConnectionConfigStorage(dto);
  }

  async getAllConnectionConfigs(): Promise<ConnectionConfigStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.listConnectionConfigs();
    return dtos.map(dto => this.mapDtoToConnectionConfigStorage(dto));
  }

  async getConnectionConfigsByType(type: string): Promise<ConnectionConfigStorage[]> {
    await this.ensureInitialized();
    const dtos = await streamingApi.listConnectionConfigs({ type });
    return dtos.map(dto => this.mapDtoToConnectionConfigStorage(dto));
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.deleteConnectionConfig(id);
  }

  // Bulk operations
  async exportAllData(): Promise<any> {
    await this.ensureInitialized();
    return await streamingApi.exportAllData();
  }

  async importAllData(data: any): Promise<void> {
    await this.ensureInitialized();
    await streamingApi.importAllData(data);
  }

  // Utility methods
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async cleanup(): Promise<void> {
    // Backend cleanup is handled server-side
    // No local cleanup needed when using backend exclusively
  }

  // Method to switch to backend mode (for future use)
  async switchToBackend(backendUrl: string, apiKey?: string): Promise<void> {
    // TODO: Implement backend switching logic
    // This would involve:
    // 1. Validating backend connectivity
    // 2. Migrating existing data
    // 3. Updating storage type
    // 4. Setting up backend API client
    throw new Error('Backend switching not implemented yet');
  }

  // Method to migrate data from IndexedDB to backend
  async migrateToBackend(backendUrl: string, apiKey?: string): Promise<void> {
    // TODO: Implement migration logic
    // This would involve:
    // 1. Exporting all data from IndexedDB
    // 2. Sending data to backend
    // 3. Verifying migration success
    // 4. Switching to backend mode
    throw new Error('Migration not implemented yet');
  }
}

// Global instance
export const globalUniversalConnectorService = new UniversalConnectorService();
export default globalUniversalConnectorService;
