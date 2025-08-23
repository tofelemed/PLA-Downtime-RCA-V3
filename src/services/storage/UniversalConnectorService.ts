// Universal Connector Service Layer
// This service abstracts storage operations and can easily be replaced with backend APIs
// It provides a clean interface for all connector-related operations

import { globalUniversalConnectorDB, 
  DataSourceStorage, 
  DataSinkStorage, 
  StreamProcessorStorage, 
  StreamMetricsStorage, 
  StreamAlertStorage, 
  ConnectionConfigStorage 
} from './UniversalConnectorDB';

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
  private storageType: 'indexeddb' | 'fallback' | 'backend' = 'indexeddb';
  private isInitialized: boolean = false;

  constructor() {
    // In the future, this could check environment variables or config
    // to determine if we should use backend APIs instead of IndexedDB
    this.storageType = 'indexeddb';
  }

  // Initialize the service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.storageType === 'indexeddb') {
        await globalUniversalConnectorDB.initialize();
        this.storageType = globalUniversalConnectorDB.getStorageType();
      }
      
      this.isInitialized = true;
      console.log(`Universal Connector Service initialized with ${this.storageType} storage`);
    } catch (error) {
      console.error('Failed to initialize Universal Connector Service:', error);
      throw error;
    }
  }

  // Get current storage type
  getStorageType(): 'indexeddb' | 'fallback' | 'backend' {
    return this.storageType;
  }

  // Data Sources operations
  async saveDataSource(source: DataSourceStorage): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/data-sources', source);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.saveDataSource(source);
  }

  async getDataSource(id: string): Promise<DataSourceStorage | undefined> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/data-sources/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getDataSource(id);
  }

  async getAllDataSources(): Promise<DataSourceStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/data-sources');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getAllDataSources();
  }

  async deleteDataSource(id: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.delete(`/api/data-sources/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.deleteDataSource(id);
  }

  // Data Sinks operations
  async saveDataSink(sink: DataSinkStorage): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/data-sinks', sink);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.saveDataSink(sink);
  }

  async getDataSink(id: string): Promise<DataSinkStorage | undefined> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/data-sinks/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getDataSink(id);
  }

  async getAllDataSinks(): Promise<DataSinkStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/data-sinks');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getAllDataSinks();
  }

  async deleteDataSink(id: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.delete(`/api/data-sinks/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.deleteDataSink(id);
  }

  // Stream Processors operations
  async saveStreamProcessor(processor: StreamProcessorStorage): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/stream-processors', processor);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.saveStreamProcessor(processor);
  }

  async getStreamProcessor(id: string): Promise<StreamProcessorStorage | undefined> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/stream-processors/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getStreamProcessor(id);
  }

  async getAllStreamProcessors(): Promise<StreamProcessorStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/stream-processors');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getAllStreamProcessors();
  }

  async deleteStreamProcessor(id: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.delete(`/api/stream-processors/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.deleteStreamProcessor(id);
  }

  // Stream Metrics operations
  async saveStreamMetrics(metrics: StreamMetricsStorage): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/stream-metrics', metrics);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.saveStreamMetrics(metrics);
  }

  async getLatestMetrics(): Promise<StreamMetricsStorage | undefined> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/stream-metrics/latest');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getLatestMetrics();
  }

  async getMetricsHistory(limit: number = 100): Promise<StreamMetricsStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/stream-metrics/history?limit=${limit}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getMetricsHistory(limit);
  }

  // Stream Alerts operations
  async saveStreamAlert(alert: StreamAlertStorage): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/stream-alerts', alert);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.saveStreamAlert(alert);
  }

  async getStreamAlert(id: string): Promise<StreamAlertStorage | undefined> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/stream-alerts/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getStreamAlert(id);
  }

  async getAllStreamAlerts(): Promise<StreamAlertStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/stream-alerts');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getAllStreamAlerts();
  }

  async getActiveAlerts(): Promise<StreamAlertStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/stream-alerts/active');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getActiveAlerts();
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.patch(`/api/stream-alerts/${id}/acknowledge`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.acknowledgeAlert(id);
  }

  async deleteStreamAlert(id: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.delete(`/api/stream-alerts/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.deleteStreamAlert(id);
  }

  // Connection Configs operations
  async saveConnectionConfig(config: ConnectionConfigStorage): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/connection-configs', config);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.saveConnectionConfig(config);
  }

  async getConnectionConfig(id: string): Promise<ConnectionConfigStorage | undefined> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/connection-configs/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getConnectionConfig(id);
  }

  async getAllConnectionConfigs(): Promise<ConnectionConfigStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/connection-configs');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getAllConnectionConfigs();
  }

  async getConnectionConfigsByType(type: string): Promise<ConnectionConfigStorage[]> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get(`/api/connection-configs?type=${type}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.getConnectionConfigsByType(type);
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.delete(`/api/connection-configs/${id}`);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.deleteConnectionConfig(id);
  }

  // Bulk operations
  async exportAllData(): Promise<any> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.get('/api/export');
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.exportAllData();
  }

  async importAllData(data: any): Promise<void> {
    await this.ensureInitialized();
    
    if (this.storageType === 'backend') {
      // TODO: Replace with backend API call
      // return await this.backendApi.post('/api/import', data);
      throw new Error('Backend API not implemented yet');
    }
    
    return await globalUniversalConnectorDB.importAllData(data);
  }

  // Utility methods
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async cleanup(): Promise<void> {
    if (this.storageType === 'indexeddb' || this.storageType === 'fallback') {
      await globalUniversalConnectorDB.cleanupOldData();
    }
    // TODO: Add backend cleanup logic when implemented
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
