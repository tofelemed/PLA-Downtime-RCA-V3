// BACnet Connector - Building Automation and Control Networks
// This can be easily replaced with backend services later

import { 
  IConnector, 
  ConnectionConfig, 
  ConnectionStatus, 
  StreamConfig, 
  TransformConfig, 
  FilterConfig 
} from '../integrations/base/IConnector';
import { BaseConnector } from '../integrations/base/BaseConnector';
import { globalEventBus } from '../events/EventBus';
import { UniversalConnectorDB } from '../storage/UniversalConnectorDB';

export interface BACnetOptions {
  deviceId: number;
  networkInterface?: string;
  port?: number;
  timeout?: number;
  retries?: number;
  maxApdu?: number;
  segmentation?: 'no-segmentation' | 'segmentation-both' | 'segmentation-transmit' | 'segmentation-receive';
  vendorId?: number;
  objectList?: BACnetObject[];
}

export interface BACnetObject {
  objectType: number;
  instanceNumber: number;
  properties: BACnetProperty[];
}

export interface BACnetProperty {
  propertyIdentifier: number;
  value: any;
  priority?: number;
  timestamp?: Date;
}

export interface BACnetMessage {
  deviceId: number;
  objectType: number;
  instanceNumber: number;
  propertyIdentifier: number;
  value: any;
  timestamp: Date;
  priority?: number;
  source: string;
}

export interface BACnetMetrics {
  reads: number;
  writes: number;
  errors: number;
  lastRead?: Date;
  lastWrite?: Date;
  averageResponseTime: number;
  connectionUptime: number;
  activeObjects: number;
}

export class BACnetConnector extends BaseConnector implements IConnector {
  private bacnetClient: any = null;
  private bacnetOptions: BACnetOptions;
  private activeObjects: Map<string, BACnetObject> = new Map();
  protected transforms: TransformConfig[] = [];
  protected filters: FilterConfig[] = [];
  private connectionStartTime: number = 0;
  private streamingActive: boolean = false;
  private db: UniversalConnectorDB;

  constructor(config: ConnectionConfig, bacnetOptions: BACnetOptions) {
    super(config);
    
    this.bacnetOptions = {
      port: 47808,
      timeout: 30000,
      retries: 3,
      maxApdu: 1476,
      segmentation: 'no-segmentation',
      vendorId: 842,
      ...bacnetOptions
    };

    this.metrics = {
      reads: 0,
      writes: 0,
      errors: 0,
      averageResponseTime: 0,
      connectionUptime: 0,
      activeObjects: 0
    };

    this.db = new UniversalConnectorDB();
  }

  // Abstract method implementations
  protected async performConnect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to BACnet network: Device ${this.bacnetOptions.deviceId}`);
      
      // Store connection in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'bacnet',
        config: { ...this.config, bacnetOptions: this.bacnetOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connecting',
        errorCount: 0,
        metadata: {
          deviceId: this.bacnetOptions.deviceId,
          port: this.bacnetOptions.port,
          maxApdu: this.bacnetOptions.maxApdu,
          segmentation: this.bacnetOptions.segmentation,
          protocol: 'BACnet'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.bacnetClient = {
        connected: true,
        readProperty: this.simulateReadProperty.bind(this),
        writeProperty: this.simulateWriteProperty.bind(this),
        discoverObjects: this.simulateDiscoverObjects.bind(this),
        disconnect: this.simulateDisconnect.bind(this)
      };

      this.connectionStartTime = Date.now();
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'bacnet',
        config: { ...this.config, bacnetOptions: this.bacnetOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connected',
        errorCount: 0,
        metadata: {
          deviceId: this.bacnetOptions.deviceId,
          port: this.bacnetOptions.port,
          maxApdu: this.bacnetOptions.maxApdu,
          segmentation: this.bacnetOptions.segmentation,
          protocol: 'BACnet'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Connected to BACnet network: Device ${this.bacnetOptions.deviceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to BACnet network:`, error);
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'bacnet',
        config: { ...this.config, bacnetOptions: this.bacnetOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'error',
        errorCount: 1,
        metadata: {
          deviceId: this.bacnetOptions.deviceId,
          port: this.bacnetOptions.port,
          maxApdu: this.bacnetOptions.maxApdu,
          segmentation: this.bacnetOptions.segmentation,
          protocol: 'BACnet'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return false;
    }
  }

  protected async performDisconnect(): Promise<boolean> {
    try {
      if (this.bacnetClient) {
        await this.bacnetClient.disconnect();
        this.bacnetClient = null;
      }
      
      await this.stopStreaming();
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'bacnet',
        config: { ...this.config, bacnetOptions: this.bacnetOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'disconnected',
        errorCount: this.metrics.errors,
        metadata: {
          deviceId: this.bacnetOptions.deviceId,
          port: this.bacnetOptions.port,
          maxApdu: this.bacnetOptions.maxApdu,
          segmentation: this.bacnetOptions.segmentation,
          protocol: 'BACnet'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`🔌 Disconnected from BACnet network`);
      return true;
    } catch (error) {
      console.error(`❌ Error disconnecting from BACnet network:`, error);
      return false;
    }
  }

  protected async performRead(path: string, options?: Record<string, any>): Promise<any> {
    const [deviceId, objectType, instance, property] = path.split('/');
    return this.readProperty(parseInt(deviceId), parseInt(objectType), parseInt(instance), parseInt(property));
  }

  protected async performWrite(path: string, data: any, options?: Record<string, any>): Promise<void> {
    const [deviceId, objectType, instance, property] = path.split('/');
    await this.writeProperty(parseInt(deviceId), parseInt(objectType), parseInt(instance), parseInt(property), data);
  }

  protected async performQuery(query: string, options?: Record<string, any>): Promise<any[]> {
    const deviceId = parseInt(query) || this.bacnetOptions.deviceId;
    return this.discoverObjects(deviceId);
  }

  // BACnet specific methods
  async readProperty(deviceId: number, objectType: number, instance: number, property: number): Promise<any> {
    if (!this.bacnetClient) {
      throw new Error('Not connected to BACnet network');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.bacnetClient.readProperty(deviceId, objectType, instance, property);
      const responseTime = Date.now() - startTime;
      
      this.updateMetrics('read', responseTime);
      
      globalEventBus.publish('bacnet.property.read', {
        deviceId,
        objectType,
        instance,
        property,
        value: result,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async writeProperty(deviceId: number, objectType: number, instance: number, property: number, value: any): Promise<void> {
    if (!this.bacnetClient) {
      throw new Error('Not connected to BACnet network');
    }

    const startTime = Date.now();
    
    try {
      await this.bacnetClient.writeProperty(deviceId, objectType, instance, property, value);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics('write', responseTime);
      
      globalEventBus.publish('bacnet.property.written', {
        deviceId,
        objectType,
        instance,
        property,
        value,
        timestamp: new Date(),
        connectorId: this.config.id
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async discoverObjects(deviceId: number): Promise<BACnetObject[]> {
    if (!this.bacnetClient) {
      throw new Error('Not connected to BACnet network');
    }

    try {
      const objects = await this.bacnetClient.discoverObjects(deviceId);
      return Array.isArray(objects) ? objects : [];
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // Transform pipeline
  async addTransform(transform: TransformConfig): Promise<void> {
    this.transforms.push(transform);
    this.transforms.sort((a, b) => a.order - b.order);
    
    // Store transform in IndexedDB
    await this.db.saveStreamProcessor({
      id: transform.id,
      name: transform.name,
      type: transform.type,
      config: transform.config,
      enabled: transform.enabled,
      order: transform.order,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'BACnet' },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async removeTransform(transformId: string): Promise<void> {
    this.transforms = this.transforms.filter(t => t.id !== transformId);
    
    // Remove transform from IndexedDB
    await this.db.deleteStreamProcessor(transformId);
  }

  getTransforms(): TransformConfig[] {
    return [...this.transforms];
  }

  // Filter pipeline
  async addFilter(filter: FilterConfig): Promise<void> {
    this.filters.push(filter);
    this.filters.sort((a, b) => a.order - b.order);
    
    // Store filter in IndexedDB
    await this.db.saveStreamProcessor({
      id: filter.id,
      name: filter.name,
      type: filter.type,
      config: filter.config,
      enabled: filter.enabled,
      order: filter.order,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'BACnet', isFilter: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async removeFilter(filterId: string): Promise<void> {
    this.filters = this.filters.filter(f => f.id !== filterId);
    
    // Remove filter from IndexedDB
    await this.db.deleteStreamProcessor(filterId);
  }

  getFilters(): FilterConfig[] {
    return [...this.filters];
  }

  // Streaming support
  async startStreaming(config: StreamConfig): Promise<void> {
    if (this.streamingActive) {
      throw new Error('Streaming is already active');
    }

    if (!this.isConnected()) {
      throw new Error('Not connected to BACnet network');
    }

    this.streamingActive = true;
    console.log(`🚀 Starting BACnet streaming for ${this.config.name}`);

    // Store streaming config in IndexedDB using stream processor
    await this.db.saveStreamProcessor({
      id: `${this.config.id}_stream`,
      name: `BACnet Stream ${this.config.name}`,
      type: 'stream',
      config,
      enabled: true,
      order: 0,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'BACnet', isStream: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    globalEventBus.publish('bacnet.streaming.started', {
      connectorId: this.config.id,
      connectorName: this.config.name,
      timestamp: new Date()
    });
  }

  async stopStreaming(): Promise<void> {
    if (!this.streamingActive) {
      return;
    }

    this.streamingActive = false;
    console.log(`🛑 Stopped BACnet streaming for ${this.config.name}`);

    // Update streaming status in IndexedDB
    await this.db.saveStreamProcessor({
      id: `${this.config.id}_stream`,
      name: `BACnet Stream ${this.config.name}`,
      type: 'stream',
      config: { enabled: false },
      enabled: false,
      order: 0,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'BACnet', isStream: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    globalEventBus.publish('bacnet.streaming.stopped', {
      connectorId: this.config.id,
      connectorName: this.config.name,
      timestamp: new Date()
    });
  }

  isStreaming(): boolean {
    return this.streamingActive;
  }

  // Metrics and health
  async getMetrics(): Promise<Record<string, any>> {
    this.metrics.connectionUptime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
    
    // Store metrics in IndexedDB
    await this.db.saveStreamMetrics({
      id: `${this.config.id}_metrics_${Date.now()}`,
      timestamp: new Date(),
      totalEvents: this.metrics.reads + this.metrics.writes,
      processedEvents: this.metrics.reads + this.metrics.writes,
      droppedEvents: 0,
      averageLatency: this.metrics.averageResponseTime,
      throughput: (this.metrics.reads + this.metrics.writes) / Math.max(this.metrics.connectionUptime / 1000, 1),
      activeSources: 1,
      activeSinks: 0,
      activeProcessors: this.transforms.length + this.filters.length,
      errorRate: this.metrics.errors / Math.max(this.metrics.reads + this.metrics.writes, 1),
      dataQuality: {
        completeness: 100 - (this.metrics.errors / Math.max(this.metrics.reads + this.metrics.writes, 1)) * 100,
        accuracy: 100 - (this.metrics.errors / Math.max(this.metrics.reads + this.metrics.writes, 1)) * 100,
        timeliness: this.metrics.averageResponseTime,
        validity: 100,
        consistency: 100,
        lastUpdated: new Date()
      }
    });
    
    return {
      ...this.metrics,
      transforms: this.transforms.length,
      filters: this.filters.length,
      isStreaming: this.streamingActive
    };
  }

  async getHealth(): Promise<Record<string, any>> {
    const baseHealth = await super.getHealth();
    
    return {
      ...baseHealth,
      bacnet: {
        deviceId: this.bacnetOptions.deviceId,
        port: this.bacnetOptions.port,
        maxApdu: this.bacnetOptions.maxApdu,
        segmentation: this.bacnetOptions.segmentation,
        isStreaming: this.streamingActive,
        connectionUptime: this.metrics.connectionUptime
      }
    };
  }

  // Protected methods
  protected updateMetrics(operation: 'read' | 'write', responseTime: number): void {
    if (operation === 'read') {
      this.metrics.reads++;
      this.metrics.lastRead = new Date();
    } else if (operation === 'write') {
      this.metrics.writes++;
      this.metrics.lastWrite = new Date();
    }

    const totalOperations = this.metrics.reads + this.metrics.writes;
    const totalTime = this.metrics.averageResponseTime * (totalOperations - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / totalOperations;
  }

  private handleError(error: any): void {
    this.metrics.errors++;
    this.status.errorCount++;
    this.status.lastError = error?.message || 'Unknown BACnet error';
    
    // Store error in IndexedDB
    this.db.saveStreamAlert({
      id: `${this.config.id}_error_${Date.now()}`,
      type: 'error',
      message: error?.message || 'Unknown BACnet error',
      timestamp: new Date(),
      source: this.config.name,
      severity: 3,
      acknowledged: false,
      metadata: { protocol: 'BACnet', connectorId: this.config.id },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('bacnet.error', {
      error: error?.message || error,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  // Simulation methods
  private async simulateReadProperty(deviceId: number, objectType: number, instance: number, property: number): Promise<any> {
    console.log(`📖 Simulated BACnet read: Device ${deviceId}, Object ${objectType}, Instance ${instance}, Property ${property}`);
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Generate simulated values based on object type
    const value = Math.random() * 100;
    
    return {
      value,
      timestamp: new Date(),
      quality: 'Good'
    };
  }

  private async simulateWriteProperty(deviceId: number, objectType: number, instance: number, property: number, value: any): Promise<void> {
    console.log(`✏️ Simulated BACnet write: Device ${deviceId}, Object ${objectType}, Instance ${instance}, Property ${property} = ${value}`);
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
  }

  private async simulateDiscoverObjects(deviceId: number): Promise<BACnetObject[]> {
    console.log(`🔍 Simulated BACnet discover objects: Device ${deviceId}`);
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Generate simulated objects
    return [
      {
        objectType: 0, // Analog Input
        instanceNumber: 1,
        properties: [
          { propertyIdentifier: 85, value: 'Temperature Sensor 1' }, // Object Name
          { propertyIdentifier: 36, value: 25.5 }, // Present Value
          { propertyIdentifier: 28, value: 'Celsius' } // Units
        ]
      },
      {
        objectType: 1, // Analog Output
        instanceNumber: 1,
        properties: [
          { propertyIdentifier: 85, value: 'Heating Valve 1' }, // Object Name
          { propertyIdentifier: 36, value: 75.0 }, // Present Value
          { propertyIdentifier: 28, value: 'Percent' } // Units
        ]
      }
    ];
  }

  private async simulateDisconnect(): Promise<void> {
    console.log(`🔌 Simulated BACnet disconnect`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// BACnet Universal Manager with bulk operations
export class BACnetUniversalManager {
  private connections: Map<string, BACnetConnector> = new Map();
  private db: UniversalConnectorDB;

  constructor() {
    this.db = new UniversalConnectorDB();
  }

  // Create and manage connections
  async createConnection(id: string, config: ConnectionConfig, options: BACnetOptions): Promise<BACnetConnector> {
    const connector = new BACnetConnector(config, options);
    this.connections.set(id, connector);
    
    // Store in IndexedDB
    await this.db.saveConnectionConfig({
      id,
      name: config.name,
      type: 'bacnet',
      config: { ...config, bacnetOptions: options },
      enabled: config.enabled,
      lastConnection: undefined,
      connectionStatus: 'disconnected',
      errorCount: 0,
      metadata: {
        deviceId: options.deviceId,
        port: options.port,
        maxApdu: options.maxApdu,
        segmentation: options.segmentation,
        protocol: 'BACnet'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('bacnet.manager.connection.created', { 
      connectionId: id,
      config,
      options,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<BACnetConnector | undefined> {
    return this.connections.get(id);
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(id);
      
      // Remove from IndexedDB
      await this.db.deleteConnectionConfig(id);
      
      globalEventBus.publish('bacnet.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, BACnetConnector>> {
    return new Map(this.connections);
  }

  // Bulk operations
  async bulkConnect(connectionIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      connectionIds.map(async (id) => {
        const connection = this.connections.get(id);
        if (connection) {
          try {
            results[id] = await connection.connect();
          } catch (error) {
            results[id] = false;
            console.error(`Failed to connect ${id}:`, error);
          }
        } else {
          results[id] = false;
        }
      })
    );
    
    return results;
  }

  async bulkDisconnect(connectionIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      connectionIds.map(async (id) => {
        const connection = this.connections.get(id);
        if (connection) {
          try {
            results[id] = await connection.disconnect();
          } catch (error) {
            results[id] = false;
            console.error(`Failed to disconnect ${id}:`, error);
          }
        } else {
          results[id] = false;
        }
      })
    );
    
    return results;
  }

  async bulkRead(operations: Array<{ connectionId: string; path: string; options?: Record<string, any> }>): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    await Promise.all(
      operations.map(async (op) => {
        const connection = this.connections.get(op.connectionId);
        if (connection && connection.isConnected()) {
          try {
            results[op.connectionId] = await connection.read(op.path, op.options);
          } catch (error) {
            results[op.connectionId] = { error: error instanceof Error ? error.message : 'Unknown error' };
          }
        } else {
          results[op.connectionId] = { error: 'Connection not available' };
        }
      })
    );
    
    return results;
  }

  async bulkWrite(operations: Array<{ connectionId: string; path: string; data: any; options?: Record<string, any> }>): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      operations.map(async (op) => {
        const connection = this.connections.get(op.connectionId);
        if (connection && connection.isConnected()) {
          try {
            await connection.write(op.path, op.data, op.options);
            results[op.connectionId] = true;
          } catch (error) {
            results[op.connectionId] = false;
            console.error(`Failed to write to ${op.connectionId}:`, error);
          }
        } else {
          results[op.connectionId] = false;
        }
      })
    );
    
    return results;
  }

  // Health monitoring
  async getSystemHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      try {
        health[id] = await connection.getHealth();
      } catch (error) {
        health[id] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    return health;
  }

  async getSystemMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      try {
        metrics[id] = await connection.getMetrics();
      } catch (error) {
        metrics[id] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    return metrics;
  }

  // Data persistence
  async exportConnections(): Promise<Record<string, any>> {
    const exportData: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      exportData[id] = {
        config: connection.getConfig(),
        status: connection.getStatus(),
        metrics: await connection.getMetrics(),
        health: await connection.getHealth()
      };
    }
    
    return exportData;
  }

  async importConnections(importData: Record<string, any>): Promise<void> {
    for (const [id, data] of Object.entries(importData)) {
      if (data.config && data.config.type === 'bacnet') {
        const connector = new BACnetConnector(data.config, data.config.bacnetOptions || {});
        this.connections.set(id, connector);
        
        // Store in IndexedDB
        await this.db.saveConnectionConfig({
          id,
          name: data.config.name,
          type: 'bacnet',
          config: data.config,
          enabled: data.config.enabled,
          lastConnection: undefined,
          connectionStatus: 'disconnected',
          errorCount: 0,
          metadata: data.config.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  // Cleanup
  async destroy(): Promise<void> {
    for (const connection of this.connections.values()) {
      await connection.destroy();
    }
    this.connections.clear();
  }
}

// Global BACnet universal manager instance
export const globalBACnetUniversalManager = new BACnetUniversalManager();
