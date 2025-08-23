// Modbus Connector - TCP/RTU communication support
// This can be easily replaced with backend services later

import { IConnector, ConnectionConfig, ConnectionStatus, StreamConfig } from '../integrations/base/IConnector';
import { globalEventBus } from '../events/EventBus';

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

export class ModbusConnector implements IConnector {
  private config: ModbusConfig;
  private status: ConnectionStatus;
  private metrics: ModbusMetrics;
  private isConnected: boolean = false;
  private subscriptions: Map<string, (data: any) => void> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private lastPoll: number = 0;

  constructor(config: ModbusConfig) {
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
  }

  // IConnector implementation
  async connect(): Promise<boolean> {
    try {
      // Simulate Modbus connection
      // In production, this would use a proper Modbus library
      await this.simulateConnection();
      
      this.isConnected = true;
      this.status.connected = true;
      this.status.lastConnected = new Date();
      this.status.errorCount = 0;
      
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
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      this.stopPolling();
      this.isConnected = false;
      this.status.connected = false;
      this.status.lastConnected = undefined;
      
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
    return this.isConnected;
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<ConnectionConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
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
    
    this.subscriptions.set(subscriptionId, callback);
    
    globalEventBus.publish('modbus.subscription.created', { 
      subscriptionId, 
      topic,
      timestamp: new Date()
    });
    
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    
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
    return {
      ...this.metrics,
      subscriptions: this.subscriptions.size,
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
    count?: number;
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
    if (this.subscriptions.size === 0) return;
    
    this.pollingInterval = setInterval(async () => {
      if (!this.isConnected()) return;
      
      const now = Date.now();
      if (now - this.lastPoll < 1000) return; // Poll at most once per second
      
      this.lastPoll = now;
      
      // Poll subscribed registers
      for (const [subscriptionId, callback] of this.subscriptions.entries()) {
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
  destroy(): void {
    this.disconnect();
    this.subscriptions.clear();
  }
}

// Modbus Manager for handling multiple connections
export class ModbusManager {
  private connections: Map<string, ModbusConnector> = new Map();

  createConnection(id: string, config: ModbusConfig): ModbusConnector {
    const connector = new ModbusConnector(config);
    this.connections.set(id, connector);
    
    globalEventBus.publish('modbus.manager.connection.created', { 
      connectionId: id,
      config,
      timestamp: new Date()
    });
    
    return connector;
  }

  getConnection(id: string): ModbusConnector | undefined {
    return this.connections.get(id);
  }

  removeConnection(id: string): boolean {
    const connection = this.connections.get(id);
    if (connection) {
      connection.destroy();
      this.connections.delete(id);
      
      globalEventBus.publish('modbus.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  getAllConnections(): Map<string, ModbusConnector> {
    return new Map(this.connections);
  }

  destroy(): void {
    for (const connection of this.connections.values()) {
      connection.destroy();
    }
    this.connections.clear();
  }
}

// Global Modbus manager instance
export const globalModbusManager = new ModbusManager();
