// Universal Connector IndexedDB Service
// This service provides persistent storage for all connector-related data
// Designed to be easily replaceable with backend APIs later

export interface ConnectorStorageConfig {
  dbName?: string;
  version?: number;
  maxStorageSize?: number; // in MB
  enableCompression?: boolean;
  enableEncryption?: boolean;
}

export interface DataSourceStorage {
  id: string;
  name: string;
  connectorType: string;
  config: any;
  enabled: boolean;
  lastData?: any;
  lastUpdate?: Date;
  errorCount: number;
  status: 'active' | 'inactive' | 'error' | 'connecting';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSinkStorage {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled: boolean;
  lastWrite?: Date;
  writeCount: number;
  errorCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamProcessorStorage {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled: boolean;
  order: number;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamMetricsStorage {
  id: string;
  timestamp: Date;
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageLatency: number;
  throughput: number;
  activeSources: number;
  activeSinks: number;
  activeProcessors: number;
  errorRate: number;
  dataQuality: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    validity: number;
    consistency: number;
    lastUpdated: Date;
  };
}

export interface StreamAlertStorage {
  id: string;
  type: 'warning' | 'error' | 'critical' | 'info';
  message: string;
  timestamp: Date;
  source: string;
  severity: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionConfigStorage {
  id: string;
  name: string;
  type: string; // 'modbus', 'mqtt', 'websocket', 'pi', 'database', etc.
  config: any;
  enabled: boolean;
  lastConnection?: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  errorCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class UniversalConnectorDB {
  private dbName: string;
  private version: number;
  private db: IDBDatabase | null = null;
  private fallbackStorage: Map<string, any[]> = new Map();
  private useFallback: boolean = false;
  private maxStorageSize: number;
  private enableCompression: boolean;
  private enableEncryption: boolean;

  constructor(config: ConnectorStorageConfig = {}) {
    this.dbName = config.dbName || 'ProActUniversalConnectorDB';
    this.version = config.version || 1;
    this.maxStorageSize = config.maxStorageSize || 100; // 100MB default
    this.enableCompression = config.enableCompression || false;
    this.enableEncryption = config.enableEncryption || false;
  }

  // Initialize the database
  async initialize(): Promise<void> {
    try {
      if (!this.isIndexedDBAvailable()) {
        this.useFallback = true;
        console.warn('IndexedDB not available, using fallback storage');
        return;
      }

      this.db = await this.openDatabase();
      console.log('Universal Connector IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.useFallback = true;
    }
  }

  // Check if IndexedDB is available
  isIndexedDBAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  // Get current storage type
  getStorageType(): 'indexeddb' | 'fallback' {
    return this.useFallback ? 'fallback' : 'indexeddb';
  }

  // Open IndexedDB
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  // Create object stores
  private createObjectStores(db: IDBDatabase): void {
    // Data Sources store
    if (!db.objectStoreNames.contains('dataSources')) {
      const sourceStore = db.createObjectStore('dataSources', { keyPath: 'id' });
      sourceStore.createIndex('connectorType', 'connectorType', { unique: false });
      sourceStore.createIndex('status', 'status', { unique: false });
      sourceStore.createIndex('enabled', 'enabled', { unique: false });
      sourceStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Data Sinks store
    if (!db.objectStoreNames.contains('dataSinks')) {
      const sinkStore = db.createObjectStore('dataSinks', { keyPath: 'id' });
      sinkStore.createIndex('type', 'type', { unique: false });
      sinkStore.createIndex('enabled', 'enabled', { unique: false });
      sinkStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Stream Processors store
    if (!db.objectStoreNames.contains('streamProcessors')) {
      const processorStore = db.createObjectStore('streamProcessors', { keyPath: 'id' });
      processorStore.createIndex('type', 'type', { unique: false });
      processorStore.createIndex('enabled', 'enabled', { unique: false });
      processorStore.createIndex('order', 'order', { unique: false });
      processorStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Stream Metrics store
    if (!db.objectStoreNames.contains('streamMetrics')) {
      const metricsStore = db.createObjectStore('streamMetrics', { keyPath: 'id' });
      metricsStore.createIndex('timestamp', 'timestamp', { unique: false });
      metricsStore.createIndex('source', 'source', { unique: false });
    }

    // Stream Alerts store
    if (!db.objectStoreNames.contains('streamAlerts')) {
      const alertsStore = db.createObjectStore('streamAlerts', { keyPath: 'id' });
      alertsStore.createIndex('type', 'type', { unique: false });
      alertsStore.createIndex('source', 'source', { unique: false });
      alertsStore.createIndex('acknowledged', 'acknowledged', { unique: false });
      alertsStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Connection Configs store
    if (!db.objectStoreNames.contains('connectionConfigs')) {
      const configStore = db.createObjectStore('connectionConfigs', { keyPath: 'id' });
      configStore.createIndex('type', 'type', { unique: false });
      configStore.createIndex('enabled', 'enabled', { unique: false });
      configStore.createIndex('connectionStatus', 'connectionStatus', { unique: false });
      configStore.createIndex('createdAt', 'createdAt', { unique: false });
    }
  }

  // Generic CRUD operations
  private async performTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    if (this.useFallback) {
      return this.performFallbackOperation(storeName, mode, operation);
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Fallback operations
  private async performFallbackOperation<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    // Simulate IndexedDB operations with Map storage
    const store = this.fallbackStorage.get(storeName) || [];
    
    // This is a simplified fallback - in production you'd implement proper CRUD
    return store as T;
  }

  // Data Sources operations
  async saveDataSource(source: DataSourceStorage): Promise<void> {
    source.updatedAt = new Date();
    await this.performTransaction('dataSources', 'readwrite', (store) => {
      return store.put(source);
    });
  }

  async getDataSource(id: string): Promise<DataSourceStorage | undefined> {
    return await this.performTransaction('dataSources', 'readonly', (store) => {
      return store.get(id);
    });
  }

  async getAllDataSources(): Promise<DataSourceStorage[]> {
    return await this.performTransaction('dataSources', 'readonly', (store) => {
      return store.getAll();
    });
  }

  async deleteDataSource(id: string): Promise<void> {
    await this.performTransaction('dataSources', 'readwrite', (store) => {
      return store.delete(id);
    });
  }

  // Data Sinks operations
  async saveDataSink(sink: DataSinkStorage): Promise<void> {
    sink.updatedAt = new Date();
    await this.performTransaction('dataSinks', 'readwrite', (store) => {
      return store.put(sink);
    });
  }

  async getDataSink(id: string): Promise<DataSinkStorage | undefined> {
    return await this.performTransaction('dataSinks', 'readonly', (store) => {
      return store.get(id);
    });
  }

  async getAllDataSinks(): Promise<DataSinkStorage[]> {
    return await this.performTransaction('dataSinks', 'readonly', (store) => {
      return store.getAll();
    });
  }

  async deleteDataSink(id: string): Promise<void> {
    await this.performTransaction('dataSinks', 'readwrite', (store) => {
      return store.delete(id);
    });
  }

  // Stream Processors operations
  async saveStreamProcessor(processor: StreamProcessorStorage): Promise<void> {
    processor.updatedAt = new Date();
    await this.performTransaction('streamProcessors', 'readwrite', (store) => {
      return store.put(processor);
    });
  }

  async getStreamProcessor(id: string): Promise<StreamProcessorStorage | undefined> {
    return await this.performTransaction('streamProcessors', 'readonly', (store) => {
      return store.get(id);
    });
  }

  async getAllStreamProcessors(): Promise<StreamProcessorStorage[]> {
    return await this.performTransaction('streamProcessors', 'readonly', (store) => {
      return store.getAll();
    });
  }

  async deleteStreamProcessor(id: string): Promise<void> {
    await this.performTransaction('streamProcessors', 'readwrite', (store) => {
      return store.delete(id);
    });
  }

  // Stream Metrics operations
  async saveStreamMetrics(metrics: StreamMetricsStorage): Promise<void> {
    await this.performTransaction('streamMetrics', 'readwrite', (store) => {
      return store.put(metrics);
    });
  }

  async getLatestMetrics(): Promise<StreamMetricsStorage | undefined> {
    const allMetrics = await this.performTransaction('streamMetrics', 'readonly', (store) => {
      return store.getAll();
    });
    
    if (allMetrics.length === 0) return undefined;
    
    // Return the most recent metrics
    return allMetrics.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }

  async getMetricsHistory(limit: number = 100): Promise<StreamMetricsStorage[]> {
    const allMetrics = await this.performTransaction('streamMetrics', 'readonly', (store) => {
      return store.getAll();
    });
    
    return allMetrics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Stream Alerts operations
  async saveStreamAlert(alert: StreamAlertStorage): Promise<void> {
    alert.updatedAt = new Date();
    await this.performTransaction('streamAlerts', 'readwrite', (store) => {
      return store.put(alert);
    });
  }

  async getStreamAlert(id: string): Promise<StreamAlertStorage | undefined> {
    return await this.performTransaction('streamAlerts', 'readonly', (store) => {
      return store.get(id);
    });
  }

  async getAllStreamAlerts(): Promise<StreamAlertStorage[]> {
    return await this.performTransaction('streamAlerts', 'readonly', (store) => {
      return store.getAll();
    });
  }

  async getActiveAlerts(): Promise<StreamAlertStorage[]> {
    const allAlerts = await this.getAllStreamAlerts();
    return allAlerts.filter(alert => !alert.acknowledged);
  }

  async acknowledgeAlert(id: string): Promise<void> {
    const alert = await this.getStreamAlert(id);
    if (alert) {
      alert.acknowledged = true;
      alert.updatedAt = new Date();
      await this.saveStreamAlert(alert);
    }
  }

  async deleteStreamAlert(id: string): Promise<void> {
    await this.performTransaction('streamAlerts', 'readwrite', (store) => {
      return store.delete(id);
    });
  }

  // Connection Configs operations
  async saveConnectionConfig(config: ConnectionConfigStorage): Promise<void> {
    config.updatedAt = new Date();
    await this.performTransaction('connectionConfigs', 'readwrite', (store) => {
      return store.put(config);
    });
  }

  async getConnectionConfig(id: string): Promise<ConnectionConfigStorage | undefined> {
    return await this.performTransaction('connectionConfigs', 'readonly', (store) => {
      return store.get(id);
    });
  }

  async getAllConnectionConfigs(): Promise<ConnectionConfigStorage[]> {
    return await this.performTransaction('connectionConfigs', 'readonly', (store) => {
      return store.getAll();
    });
  }

  async getConnectionConfigsByType(type: string): Promise<ConnectionConfigStorage[]> {
    const allConfigs = await this.getAllConnectionConfigs();
    return allConfigs.filter(config => config.type === type);
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    await this.performTransaction('connectionConfigs', 'readwrite', (store) => {
      return store.delete(id);
    });
  }

  // Bulk operations for easy migration to backend
  async exportAllData(): Promise<{
    dataSources: DataSourceStorage[];
    dataSinks: DataSinkStorage[];
    streamProcessors: StreamProcessorStorage[];
    streamMetrics: StreamMetricsStorage[];
    streamAlerts: StreamAlertStorage[];
    connectionConfigs: ConnectionConfigStorage[];
  }> {
    const [
      dataSources,
      dataSinks,
      streamProcessors,
      streamMetrics,
      streamAlerts,
      connectionConfigs
    ] = await Promise.all([
      this.getAllDataSources(),
      this.getAllDataSinks(),
      this.getAllStreamProcessors(),
      this.getMetricsHistory(1000), // Export last 1000 metrics
      this.getAllStreamAlerts(),
      this.getAllConnectionConfigs()
    ]);

    return {
      dataSources,
      dataSinks,
      streamProcessors,
      streamMetrics,
      streamAlerts,
      connectionConfigs
    };
  }

  async importAllData(data: {
    dataSources?: DataSourceStorage[];
    dataSinks?: DataSinkStorage[];
    streamProcessors?: StreamProcessorStorage[];
    streamMetrics?: StreamMetricsStorage[];
    streamAlerts?: StreamAlertStorage[];
    connectionConfigs?: ConnectionConfigStorage[];
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (data.dataSources) {
      for (const source of data.dataSources) {
        promises.push(this.saveDataSource(source));
      }
    }

    if (data.dataSinks) {
      for (const sink of data.dataSinks) {
        promises.push(this.saveDataSink(sink));
      }
    }

    if (data.streamProcessors) {
      for (const processor of data.streamProcessors) {
        promises.push(this.saveStreamProcessor(processor));
      }
    }

    if (data.streamMetrics) {
      for (const metrics of data.streamMetrics) {
        promises.push(this.saveStreamMetrics(metrics));
      }
    }

    if (data.streamAlerts) {
      for (const alert of data.streamAlerts) {
        promises.push(this.saveStreamAlert(alert));
      }
    }

    if (data.connectionConfigs) {
      for (const config of data.connectionConfigs) {
        promises.push(this.saveConnectionConfig(config));
      }
    }

    await Promise.all(promises);
  }

  // Cleanup and maintenance
  async clearAllData(): Promise<void> {
    if (this.useFallback) {
      this.fallbackStorage.clear();
      return;
    }

    if (!this.db) return;

    const storeNames = [
      'dataSources',
      'dataSinks',
      'streamProcessors',
      'streamMetrics',
      'streamAlerts',
      'connectionConfigs'
    ];

    for (const storeName of storeNames) {
      await this.performTransaction(storeName, 'readwrite', (store) => {
        return store.clear();
      });
    }
  }

  async getStorageSize(): Promise<number> {
    // This is a simplified size calculation
    // In production, you'd implement proper size calculation
    return 0;
  }

  async cleanupOldData(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoffDate = new Date(Date.now() - maxAge);

    // Clean up old metrics
    const oldMetrics = await this.performTransaction('streamMetrics', 'readonly', (store) => {
      return store.getAll();
    });

    for (const metric of oldMetrics) {
      if (new Date(metric.timestamp) < cutoffDate) {
        await this.performTransaction('streamMetrics', 'readwrite', (store) => {
          return store.delete(metric.id);
        });
      }
    }

    // Clean up old alerts (keep acknowledged ones for 7 days)
    const oldAlerts = await this.performTransaction('streamAlerts', 'readonly', (store) => {
      return store.getAll();
    });

    for (const alert of oldAlerts) {
      const alertAge = Date.now() - new Date(alert.timestamp).getTime();
      const shouldDelete = alert.acknowledged ? alertAge > 7 * 24 * 60 * 60 * 1000 : alertAge > maxAge;
      
      if (shouldDelete) {
        await this.performTransaction('streamAlerts', 'readwrite', (store) => {
          return store.delete(alert.id);
        });
      }
    }
  }

  // Close database
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Destroy database (for testing/cleanup)
  async destroy(): Promise<void> {
    await this.close();
    
    if (this.isIndexedDBAvailable()) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

// Global instance
export const globalUniversalConnectorDB = new UniversalConnectorDB();
export default globalUniversalConnectorDB;
