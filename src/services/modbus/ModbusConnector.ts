// Modbus Connector - TCP/RTU communication support
// This can be easily replaced with backend services later

import { IConnector, ConnectionConfig, ConnectionStatus, StreamConfig } from '../integrations/base/IConnector';
import { BaseConnector } from '../integrations/base/BaseConnector';
import { globalEventBus } from '../events/EventBus';
import { UniversalConnectorDB } from '../storage/UniversalConnectorDB';

export interface ModbusConfig extends ConnectionConfig {
  protocol: 'tcp' | 'rtu';
  slaveId: number;
  timeout: number;
  retries: number;
  baudRate?: number; // For RTU
  dataBits?: number; // For RTU
  stopBits?: number; // For RTU
  parity?: 'none' | 'even' | 'odd'; // For RTU
}

export interface ModbusRegister {
  address: number;
  type: 'coil' | 'discrete' | 'holding' | 'input';
  value: any;
  timestamp: Date;
}

export interface ModbusMetrics {
  reads: number;
  writes: number;
  errors: number;
  lastRead?: Date;
  lastWrite?: Date;
  averageResponseTime: number;
}

export class ModbusConnector extends BaseConnector implements IConnector {
  declare protected config: ModbusConfig;
  declare protected metrics: ModbusMetrics;
  private pollSubscriptions: Map<string, (data: unknown) => void> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private lastPoll: number = 0;
  private db: UniversalConnectorDB;

  constructor(config: ModbusConfig) {
    super(config);
    
    this.config = config;
    this.status = {
      connected: false,
      errorCount: 0,
      lastError: undefined,
      responseTime: undefined,
      metadata: {}
    };
    
    this.metrics = {
      reads: 0,
      writes: 0,
      errors: 0,
      averageResponseTime: 0
    };

    this.db = new UniversalConnectorDB();
  }

  // BaseConnector hooks: this connector overrides the public operations directly.
  protected performConnect(): Promise<boolean> {
    return this.connect();
  }

  protected performDisconnect(): Promise<boolean> {
    return this.disconnect();
  }

  protected performRead(path: string, options?: Record<string, unknown>): Promise<unknown> {
    return this.read(path, options);
  }

  protected performWrite(path: string, data: unknown, options?: Record<string, unknown>): Promise<void> {
    return this.write(path, data, options);
  }

  protected performQuery(query: string, options?: Record<string, unknown>): Promise<unknown[]> {
    return this.query(query, options);
  }

  // IConnector implementation
  async connect(): Promise<boolean> {
    try {
      // Store connection in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'modbus',
        config: this.config,
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connecting',
        errorCount: 0,
        metadata: {
          protocol: this.config.protocol,
          slaveId: this.config.slaveId,
          endpoint: this.config.endpoint
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simulate Modbus connection
      // In production, this would use a proper Modbus library
      await this.simulateConnection();

      this.connected = true;
      this.status.connected = true;
      this.status.lastConnected = new Date();
      this.status.errorCount = 0;
      
      // Update connection status in IndexedDB
      await this.db.updateConnectionStatus(this.config.id, 'connected');
      
      // Start polling for subscribed registers
      this.startPolling();
      
      globalEventBus.publish('modbus.connected', { 
        endpoint: this.config.endpoint,
        protocol: this.config.protocol,
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      this.handleError(error);
      await this.db.updateConnectionStatus(this.config.id, 'error');
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      this.stopPolling();
      this.connected = false;
      this.status.connected = false;
      this.status.lastConnected = undefined;
      
      // Update connection status in IndexedDB
      await this.db.updateConnectionStatus(this.config.id, 'disconnected');
      
      globalEventBus.publish('modbus.disconnected', { 
        endpoint: this.config.endpoint,
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<ConnectionConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Update in IndexedDB
    await this.db.updateConnectionConfig(this.config.id, this.config);
    
    // Reconnect if currently connected
    if (this.isConnected()) {
      await this.disconnect();
      await this.connect();
    }
  }

  async validateConfig(config: ConnectionConfig): Promise<boolean> {
    try {
      // Basic validation for Modbus config
      const modbusConfig = config as ModbusConfig;
      return !!(modbusConfig.endpoint && modbusConfig.slaveId && modbusConfig.protocol);
    } catch {
      return false;
    }
  }

  async read(path: string, options?: Record<string, any>): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Modbus not connected');
    }

    try {
      const startTime = Date.now();
      
      // Parse path to get register details
      const registerInfo = this.parseRegisterPath(path);
      
      // Simulate Modbus read
      const value = await this.simulateModbusRead(registerInfo);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      this.metrics.reads++;
      this.metrics.lastRead = new Date();

      globalEventBus.publish('modbus.read', { 
        path,
        value,
        responseTime,
        timestamp: new Date()
      });
      
      return value;
      
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async write(path: string, data: any, options?: Record<string, any>): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Modbus not connected');
    }

    try {
      const startTime = Date.now();
      
      // Parse path to get register details
      const registerInfo = this.parseRegisterPath(path);
      
      // Simulate Modbus write
      await this.simulateModbusWrite(registerInfo, data);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      this.metrics.writes++;
      this.metrics.lastWrite = new Date();

      globalEventBus.publish('modbus.write', { 
        path,
        data,
        responseTime,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async query(query: string, options?: Record<string, any>): Promise<any[]> {
    // Modbus doesn't support SQL-like queries
    // This would be implemented as multiple register reads
    throw new Error('Modbus does not support query operations');
  }

  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    const subscriptionId = `modbus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.pollSubscriptions.set(subscriptionId, callback);

    globalEventBus.publish('modbus.subscription.created', { 
      subscriptionId, 
      topic,
      timestamp: new Date()
    });
    
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.pollSubscriptions.delete(subscriptionId);

    globalEventBus.publish('modbus.subscription.removed', { 
      subscriptionId,
      timestamp: new Date()
    });
  }

  async publish(topic: string, data: any): Promise<void> {
    // Modbus doesn't support publish operations
    // This would be implemented as register writes
    throw new Error('Modbus does not support publish operations');
  }

  async getDataQuality(): Promise<any> {
    return {
      completeness: this.metrics.reads > 0 ? 100 : 0,
      accuracy: 100 - (this.metrics.errors / Math.max(this.metrics.reads + this.metrics.writes, 1)) * 100,
      timeliness: this.metrics.averageResponseTime,
      validity: 100,
      consistency: 100,
      lastUpdated: new Date()
    };
  }

  async getMetrics(): Promise<Record<string, any>> {
    // Store metrics in IndexedDB
    await this.db.saveStreamMetrics({
      id: `${this.config.id}_metrics_${Date.now()}`,
      timestamp: new Date(),
      totalEvents: this.metrics.reads + this.metrics.writes,
      processedEvents: this.metrics.reads + this.metrics.writes,
      droppedEvents: 0,
      averageLatency: this.metrics.averageResponseTime,
      throughput: (this.metrics.reads + this.metrics.writes) / Math.max(this.metrics.averageResponseTime / 1000, 1),
      activeSources: 1,
      activeSinks: 0,
      activeProcessors: 0,
      errorRate: this.metrics.errors / Math.max(this.metrics.reads + this.metrics.writes, 1),
      dataQuality: {
        completeness: this.metrics.reads > 0 ? 100 : 0,
        accuracy: 100 - (this.metrics.errors / Math.max(this.metrics.reads + this.metrics.writes, 1)) * 100,
        timeliness: this.metrics.averageResponseTime,
        validity: 100,
        consistency: 100,
        lastUpdated: new Date()
      }
    });
    
    return {
      ...this.metrics,
      subscriptions: this.pollSubscriptions.size,
      connected: this.isConnected(),
      protocol: this.config.protocol,
      slaveId: this.config.slaveId
    };
  }

  async getHealth(): Promise<Record<string, any>> {
    const isHealthy = this.isConnected() && this.metrics.errors < 10;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      connected: this.isConnected(),
      lastError: this.status.lastError,
      errorCount: this.metrics.errors,
      responseTime: this.metrics.averageResponseTime,
      timestamp: new Date()
    };
  }

  async initialize(): Promise<void> {
    // Modbus connector is ready to use immediately
    return;
  }

  // Modbus specific methods

  async readHoldingRegisters(startAddress: number, count: number): Promise<number[]> {
    const path = `holding:${startAddress}:${count}`;
    return await this.read(path);
  }

  async readInputRegisters(startAddress: number, count: number): Promise<number[]> {
    const path = `input:${startAddress}:${count}`;
    return await this.read(path);
  }

  async readCoils(startAddress: number, count: number): Promise<boolean[]> {
    const path = `coil:${startAddress}:${count}`;
    return await this.read(path);
  }

  async readDiscreteInputs(startAddress: number, count: number): Promise<boolean[]> {
    const path = `discrete:${startAddress}:${count}`;
    return await this.read(path);
  }

  async writeHoldingRegister(address: number, value: number): Promise<void> {
    const path = `holding:${address}`;
    await this.write(path, value);
  }

  async writeHoldingRegisters(startAddress: number, values: number[]): Promise<void> {
    const path = `holding:${startAddress}:${values.length}`;
    await this.write(path, values);
  }

  async writeCoil(address: number, value: boolean): Promise<void> {
    const path = `coil:${address}`;
    await this.write(path, value);
  }

  async writeCoils(startAddress: number, values: boolean[]): Promise<void> {
    const path = `coil:${startAddress}:${values.length}`;
    await this.write(path, values);
  }

  // Private methods

  private async simulateConnection(): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate connection success/failure
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Connection failed - device not responding');
    }
  }

  private parseRegisterPath(path: string): {
    type: 'coil' | 'discrete' | 'holding' | 'input';
    address: number;
    count: number;
  } {
    const parts = path.split(':');
    const type = parts[0] as 'coil' | 'discrete' | 'holding' | 'input';
    const address = parseInt(parts[1]);
    const count = parts[2] ? parseInt(parts[2]) : 1;
    
    return { type, address, count };
  }

  private async simulateModbusRead(registerInfo: {
    type: string;
    address: number;
    count: number;
  }): Promise<any> {
    // Simulate read delay
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    // Simulate read success/failure
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Read failed - register not accessible');
    }
    
    // Generate simulated data based on register type
    switch (registerInfo.type) {
      case 'coil':
      case 'discrete':
        return Array.from({ length: registerInfo.count }, () => Math.random() > 0.5);
      case 'holding':
      case 'input':
        return Array.from({ length: registerInfo.count }, () => Math.floor(Math.random() * 65536));
      default:
        return 0;
    }
  }

  private async simulateModbusWrite(registerInfo: {
    type: string;
    address: number;
    count: number;
  }, data: any): Promise<void> {
    // Simulate write delay
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
    
    // Simulate write success/failure
    if (Math.random() < 0.03) { // 3% failure rate
      throw new Error('Write failed - register not writable');
    }
    
    // Validate data based on register type
    if (registerInfo.type === 'coil' || registerInfo.type === 'discrete') {
      if (typeof data !== 'boolean' && !Array.isArray(data)) {
        throw new Error('Invalid data type for coil/discrete register');
      }
    } else {
      if (typeof data !== 'number' && !Array.isArray(data)) {
        throw new Error('Invalid data type for holding/input register');
      }
    }
  }

  private startPolling(): void {
    if (this.pollSubscriptions.size === 0) return;
    
    this.pollingInterval = setInterval(async () => {
      if (!this.isConnected()) return;
      
      const now = Date.now();
      if (now - this.lastPoll < 1000) return; // Poll at most once per second
      
      this.lastPoll = now;
      
      // Poll subscribed registers
      for (const [subscriptionId, callback] of this.pollSubscriptions.entries()) {
        try {
          // This is a simplified polling implementation
          // In production, you'd poll specific registers based on subscription
          const simulatedData = {
            timestamp: new Date(),
            value: Math.random() * 100,
            address: Math.floor(Math.random() * 1000)
          };
          
          callback(simulatedData);
          
        } catch (error) {
          console.error('Polling error:', error);
        }
      }
    }, 1000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private handleError(error: any): void {
    this.status.errorCount++;
    this.status.lastError = error?.message || 'Unknown error';
    this.metrics.errors++;
    
    // Store error in IndexedDB
    this.db.saveStreamAlert({
      id: `${this.config.id}_error_${Date.now()}`,
      type: 'error',
      message: error?.message || 'Unknown error',
      timestamp: new Date(),
      source: this.config.name,
      severity: 3,
      acknowledged: false,
      metadata: { protocol: 'Modbus', connectorId: this.config.id },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('modbus.error', { 
      error: error?.message || error,
      timestamp: new Date()
    });
  }

  private updateResponseTime(responseTime: number): void {
    if (this.metrics.reads + this.metrics.writes > 0) {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.reads + this.metrics.writes - 1) + responseTime) / 
        (this.metrics.reads + this.metrics.writes);
    } else {
      this.metrics.averageResponseTime = responseTime;
    }
    
    this.status.responseTime = responseTime;
  }

  // Cleanup
  async destroy(): Promise<void> {
    await this.disconnect();
    this.pollSubscriptions.clear();
  }
}

// Modbus Universal Manager with bulk operations
export class ModbusUniversalManager {
  private connections: Map<string, ModbusConnector> = new Map();
  private db: UniversalConnectorDB;

  constructor() {
    this.db = new UniversalConnectorDB();
  }

  // Create and manage connections
  async createConnection(id: string, config: ModbusConfig): Promise<ModbusConnector> {
    const connector = new ModbusConnector(config);
    this.connections.set(id, connector);
    
    // Store in IndexedDB
    await this.db.saveConnectionConfig({
      id,
      name: config.name,
      type: 'modbus',
      config,
      enabled: config.enabled,
      lastConnection: undefined,
      connectionStatus: 'disconnected',
      errorCount: 0,
      metadata: {
        protocol: config.protocol,
        slaveId: config.slaveId,
        endpoint: config.endpoint
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('modbus.manager.connection.created', { 
      connectionId: id,
      config,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<ModbusConnector | undefined> {
    return this.connections.get(id);
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.destroy();
      this.connections.delete(id);
      
      // Remove from IndexedDB
      await this.db.deleteConnectionConfig(id);
      
      globalEventBus.publish('modbus.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, ModbusConnector>> {
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
      if (data.config && data.config.type === 'modbus') {
        const connector = new ModbusConnector(data.config);
        this.connections.set(id, connector);
        
        // Store in IndexedDB
        await this.db.saveConnectionConfig({
          id,
          name: data.config.name,
          type: 'modbus',
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

// Global Modbus universal manager instance
export const globalModbusUniversalManager = new ModbusUniversalManager();
