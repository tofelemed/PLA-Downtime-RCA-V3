import { EventBus, globalEventBus } from '@/services/events/EventBus';
import { IConnector, ConnectionStatus, ConnectionConfig } from '../integrations/base/IConnector';

// Profinet specific interfaces
export interface ProfinetConfig extends ConnectionConfig {
  host: string;
  port: number;
  deviceId: string;
  rack: number;
  slot: number;
  timeout: number;
  scanRate: number;
  blocks: ProfinetBlock[];
  security?: ProfinetSecurity;
  metadata?: Record<string, any>;
}

export interface ProfinetBlock {
  name: string;
  number: number;
  type: ProfinetBlockType;
  dataType: ProfinetDataType;
  readOnly: boolean;
  description?: string;
  offset: number;
  length: number;
  scaling?: {
    rawMin: number;
    rawMax: number;
    scaledMin: number;
    scaledMax: number;
  };
}

export type ProfinetBlockType = 'DB' | 'M' | 'I' | 'Q' | 'PIW' | 'PQW';
export type ProfinetDataType = 
  | 'BOOL'
  | 'BYTE'
  | 'CHAR'
  | 'WORD'
  | 'INT'
  | 'DWORD'
  | 'DINT'
  | 'LWORD'
  | 'LINT'
  | 'REAL'
  | 'LREAL'
  | 'STRING'
  | 'TIME'
  | 'DATE'
  | 'TIME_OF_DAY';

export interface ProfinetSecurity {
  username?: string;
  password?: string;
  certificate?: string;
  encryption?: boolean;
}

export interface ProfinetMessage {
  id: string;
  timestamp: Date;
  block: string;
  value: any;
  quality: 'good' | 'bad' | 'uncertain';
  source: string;
  blockNumber: number;
}

export interface ProfinetMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  lastMessage: Date;
  connectionUptime: number;
  errors: number;
  blocksRead: number;
  blocksWritten: number;
  deviceStatus: 'online' | 'offline' | 'error';
}

// Default configuration template for new connections
export const DEFAULT_PROFINET_CONFIG: Partial<ProfinetConfig> = {
  type: 'profinet',
  enabled: false,
  timeout: 5000,
  scanRate: 1000,
  rack: 0,
  slot: 0,
  blocks: [],
  security: {},
  metadata: {}
};

// IndexedDB Storage Service
class ProfinetStorageService {
  private dbName = 'ProfinetDB';
  private dbVersion = 2; // Incremented for new schema
  private stores = {
    config: 'profinet_config',
    messages: 'profinet_messages',
    blocks: 'profinet_blocks',
    connections: 'profinet_connections'
  };

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Config store for connection settings
        if (!db.objectStoreNames.contains(this.stores.config)) {
          const store = db.createObjectStore(this.stores.config, { keyPath: 'id' });
          store.createIndex('enabled', 'enabled', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        
        // Connections store for multiple connection management
        if (!db.objectStoreNames.contains(this.stores.connections)) {
          const store = db.createObjectStore(this.stores.connections, { keyPath: 'id' });
          store.createIndex('enabled', 'enabled', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        
        // Messages store for historical data
        if (!db.objectStoreNames.contains(this.stores.messages)) {
          const store = db.createObjectStore(this.stores.messages, { keyPath: 'id' });
          store.createIndex('block', 'block', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('quality', 'quality', { unique: false });
          store.createIndex('blockNumber', 'blockNumber', { unique: false });
          store.createIndex('connectionId', 'connectionId', { unique: false });
        }
        
        // Blocks store for block definitions
        if (!db.objectStoreNames.contains(this.stores.blocks)) {
          const store = db.createObjectStore(this.stores.blocks, { keyPath: 'name' });
          store.createIndex('number', 'number', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('connectionId', 'connectionId', { unique: false });
        }
      };
    });
  }

  async saveConnectionConfig(config: ProfinetConfig): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.connections], 'readwrite');
      const store = transaction.objectStore(this.stores.connections);
      const request = store.put(config);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConnectionConfig(id: string): Promise<ProfinetConfig | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.connections], 'readonly');
      const store = transaction.objectStore(this.stores.connections);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConnectionConfigs(): Promise<ProfinetConfig[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.connections], 'readonly');
      const store = transaction.objectStore(this.stores.connections);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.connections], 'readwrite');
      const store = transaction.objectStore(this.stores.connections);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessage(message: ProfinetMessage & { connectionId: string }): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.messages], 'readwrite');
      const store = transaction.objectStore(this.stores.messages);
      const request = store.put(message);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(connectionId?: string, block?: string, limit?: number): Promise<ProfinetMessage[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.messages], 'readonly');
      const store = transaction.objectStore(this.stores.messages);
      
      let request: IDBRequest;
      
      if (connectionId && block) {
        const index = store.index('block');
        request = index.getAll(IDBKeyRange.only(block));
      } else if (connectionId) {
        const index = store.index('connectionId');
        request = index.getAll(connectionId);
      } else if (block) {
        const index = store.index('block');
        request = index.getAll(block);
      } else {
        const index = store.index('timestamp');
        request = index.getAll();
      }
      
      request.onsuccess = () => {
        let messages = request.result || [];
        messages = messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (limit) {
          messages = messages.slice(0, limit);
        }
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveBlock(block: ProfinetBlock & { connectionId: string }): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.blocks], 'readwrite');
      const store = transaction.objectStore(this.stores.blocks);
      const request = store.put(block);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBlocks(connectionId?: string): Promise<ProfinetBlock[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.blocks], 'readonly');
      const store = transaction.objectStore(this.stores.blocks);
      
      let request: IDBRequest;
      
      if (connectionId) {
        const index = store.index('connectionId');
        request = index.getAll(connectionId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupOldData(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const db = await this.initDB();
    const transaction = db.transaction([this.stores.messages], 'readwrite');
    const store = transaction.objectStore(this.stores.messages);
    const index = store.index('timestamp');
    const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));
    
    let deletedCount = 0;
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async migrateToBackend(connectionId: string): Promise<any> {
    const config = await this.getConnectionConfig(connectionId);
    const messages = await this.getMessages(connectionId);
    const blocks = await this.getBlocks(connectionId);
    
    return {
      connectionId,
      config,
      messages,
      blocks,
      migrationTimestamp: new Date().toISOString()
    };
  }
}

// Main Profinet Connector Implementation
export class ProfinetConnector implements IConnector {
  private config: ProfinetConfig;
  private status: ConnectionStatus;
  private metrics: ProfinetMetrics;
  private storage: ProfinetStorageService;
  private eventBus: EventBus;
  private connectionStartTime?: Date;
  private scanInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private messageCount: number = 0;
  private lastMessageTime: Date = new Date();

  constructor(config: ProfinetConfig, eventBus: EventBus) {
    this.config = config;
    this.status = { connected: false, errorCount: 0 };
    this.metrics = {
      totalMessages: 0,
      messagesPerSecond: 0,
      lastMessage: new Date(),
      connectionUptime: 0,
      errors: 0,
      blocksRead: 0,
      blocksWritten: 0,
      deviceStatus: 'offline'
    };
    
    this.storage = new ProfinetStorageService();
    this.eventBus = eventBus;
    
    this.initializeStorage();
  }

  async connect(): Promise<boolean> {
    try {
      this.status = { connected: false, errorCount: this.status.errorCount };
      this.eventBus.publish('profinet:connecting', { config: this.config });
      
      // Simulate connection process
      await this.simulateConnection();
      
      this.status = { connected: true, errorCount: 0, lastConnected: new Date() };
      this.connectionStartTime = new Date();
      this.metrics.deviceStatus = 'online';
      
      // Start scanning blocks
      this.startBlockScanning();
      
      // Start heartbeat
      this.startHeartbeat();
      
      this.eventBus.publish('profinet:connected', { config: this.config });
      this.emitToBackend('profinet:connected', { config: this.config });
      
      return true;
    } catch (error) {
      this.status = { connected: false, errorCount: this.status.errorCount + 1, lastError: error.message };
      this.metrics.errors++;
      this.metrics.deviceStatus = 'error';
      this.eventBus.publish('profinet:connection_failed', { error: error.message });
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      this.status = { connected: true, errorCount: this.status.errorCount };
      this.eventBus.publish('profinet:disconnecting', {});
      
      // Stop scanning and heartbeat
      this.stopBlockScanning();
      this.stopHeartbeat();
      
      this.status = { connected: false, errorCount: this.status.errorCount };
      this.metrics.deviceStatus = 'offline';
      
      if (this.connectionStartTime) {
        this.metrics.connectionUptime = Date.now() - this.connectionStartTime.getTime();
      }
      
      this.eventBus.publish('profinet:disconnected', {});
      this.emitToBackend('profinet:disconnected', {});
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      this.eventBus.publish('profinet:disconnect_failed', { error: error.message });
      return false;
    }
  }

  async readBlock(blockName: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Profinet device');
    }
    
    try {
      const block = this.config.blocks.find(b => b.name === blockName);
      if (!block) {
        throw new Error(`Block ${blockName} not found in configuration`);
      }
      
      // Simulate reading from device
      const value = await this.simulateBlockRead(block);
      const quality = this.determineQuality(value);
      
      // Create message
      const message: ProfinetMessage & { connectionId: string } = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        block: blockName,
        value,
        quality,
        source: this.config.host,
        blockNumber: block.number,
        connectionId: this.config.id
      };
      
      // Save message to IndexedDB
      await this.storage.saveMessage(message);
      
      // Update metrics
      this.updateMetrics(message);
      
      // Publish event
      this.eventBus.publish('profinet:block:read', { message });
      this.emitToBackend('profinet:block:read', { message });
      
      return value;
      
    } catch (error) {
      this.metrics.errors++;
      this.eventBus.publish('profinet:block:read_failed', { block: blockName, error: error.message });
      throw error;
    }
  }

  async writeBlock(blockName: string, value: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Profinet device');
    }
    
    try {
      const block = this.config.blocks.find(b => b.name === blockName);
      if (!block) {
        throw new Error(`Block ${blockName} not found in configuration`);
      }
      
      if (block.readOnly) {
        throw new Error(`Block ${blockName} is read-only`);
      }
      
      // Simulate writing to device
      await this.simulateBlockWrite(block, value);
      
      // Create message
      const message: ProfinetMessage & { connectionId: string } = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        block: blockName,
        value,
        quality: 'good',
        source: this.config.host,
        blockNumber: block.number,
        connectionId: this.config.id
      };
      
      // Save message to IndexedDB
      await this.storage.saveMessage(message);
      
      // Update metrics
      this.updateMetrics(message);
      this.metrics.blocksWritten++;
      
      // Publish event
      this.eventBus.publish('profinet:block:written', { message });
      this.emitToBackend('profinet:block:written', { message });
      
    } catch (error) {
      this.metrics.errors++;
      this.eventBus.publish('profinet:block:write_failed', { block: blockName, error: error.message });
      throw error;
    }
  }

  async readMultipleBlocks(blockNames: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const blockName of blockNames) {
      try {
        results[blockName] = await this.readBlock(blockName);
      } catch (error) {
        results[blockName] = { error: error.message };
      }
    }
    
    return results;
  }

  async writeMultipleBlocks(blocks: Record<string, any>): Promise<void> {
    for (const [blockName, value] of Object.entries(blocks)) {
      await this.writeBlock(blockName, value);
    }
  }

  async getBlockList(): Promise<ProfinetBlock[]> {
    return this.config.blocks;
  }

  async addBlock(block: ProfinetBlock): Promise<void> {
    // Check if block already exists
    const existingBlock = this.config.blocks.find(b => b.name === block.name);
    if (existingBlock) {
      throw new Error(`Block ${block.name} already exists`);
    }
    
    // Add block to configuration
    this.config.blocks.push(block);
    
    // Save block to IndexedDB
    await this.storage.saveBlock({ ...block, connectionId: this.config.id });
    
    // Save updated config to IndexedDB
    await this.storage.saveConnectionConfig(this.config);
    
    this.eventBus.publish('profinet:block:added', { block });
    this.emitToBackend('profinet:block:added', { block });
  }

  async removeBlock(blockName: string): Promise<void> {
    const blockIndex = this.config.blocks.findIndex(b => b.name === blockName);
    if (blockIndex === -1) {
      throw new Error(`Block ${blockName} not found`);
    }
    
    // Remove block from configuration
    this.config.blocks.splice(blockIndex, 1);
    
    // Save updated config to IndexedDB
    await this.storage.saveConnectionConfig(this.config);
    
    this.eventBus.publish('profinet:block:removed', { blockName });
    this.emitToBackend('profinet:block:removed', { blockName });
  }

  async getMetrics(): Promise<ProfinetMetrics> {
    // Update real-time metrics
    if (this.connectionStartTime && this.isConnected()) {
      this.metrics.connectionUptime = Date.now() - this.connectionStartTime.getTime();
    }
    
    return this.metrics;
  }

  async getMessages(block?: string, limit?: number): Promise<ProfinetMessage[]> {
    return this.storage.getMessages(this.config.id, block, limit);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Load existing blocks from IndexedDB
      const existingBlocks = await this.storage.getBlocks(this.config.id);
      if (existingBlocks.length > 0) {
        this.config.blocks = existingBlocks;
      }
      
      // Save initial config to IndexedDB
      await this.storage.saveConnectionConfig(this.config);
      
    } catch (error) {
      console.error('Failed to initialize Profinet storage:', error);
    }
  }

  private async simulateConnection(): Promise<void> {
    // Simulate network delay and connection process
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
    
    // Simulate connection failure (8% chance)
    if (Math.random() < 0.08) {
      throw new Error('Connection timeout - device not responding');
    }
  }

  private startBlockScanning(): void {
    if (this.scanInterval) return;
    
    this.scanInterval = setInterval(async () => {
      if (!this.isConnected()) return;
      
      try {
        // Scan all configured blocks
        for (const block of this.config.blocks) {
          if (block.readOnly) {
            await this.readBlock(block.name);
          }
        }
      } catch (error) {
        console.error('Block scanning failed:', error);
      }
    }, this.config.scanRate);
  }

  private stopBlockScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isConnected()) return;
      
      try {
        // Send heartbeat to device
        await this.sendHeartbeat();
      } catch (error) {
        console.error('Heartbeat failed:', error);
        this.metrics.deviceStatus = 'error';
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    // Simulate heartbeat
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate heartbeat failure (2% chance)
    if (Math.random() < 0.02) {
      throw new Error('Heartbeat timeout');
    }
    
    this.metrics.deviceStatus = 'online';
  }

  private async simulateBlockRead(block: ProfinetBlock): Promise<any> {
    // Simulate reading delay
    await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 120));
    
    // Generate simulated value based on block type and data type
    let value: any;
    
    switch (block.dataType) {
      case 'BOOL':
        value = Math.random() > 0.5;
        break;
      case 'BYTE':
        value = Math.floor(Math.random() * 256);
        break;
      case 'WORD':
        value = Math.floor(Math.random() * 65536);
        break;
      case 'INT':
        value = Math.floor(Math.random() * 65536) - 32768;
        break;
      case 'DWORD':
        value = Math.floor(Math.random() * 4294967296);
        break;
      case 'DINT':
        value = Math.floor(Math.random() * 4294967296) - 2147483648;
        break;
      case 'REAL':
        value = Math.random() * 1000;
        break;
      case 'STRING':
        value = `Block_${block.name}_${Date.now()}`;
        break;
      case 'TIME':
        value = Math.floor(Math.random() * 86400000); // milliseconds in a day
        break;
      default:
        value = Math.random() * 100;
    }
    
    // Apply scaling if configured
    if (block.scaling) {
      const normalized = (value - block.scaling.rawMin) / (block.scaling.rawMax - block.scaling.rawMin);
      value = block.scaling.scaledMin + normalized * (block.scaling.scaledMax - block.scaling.scaledMin);
    }
    
    return value;
  }

  private async simulateBlockWrite(block: ProfinetBlock, value: any): Promise<void> {
    // Simulate writing delay
    await new Promise(resolve => setTimeout(resolve, 120 + Math.random() * 250));
    
    // Simulate write failure (3% chance)
    if (Math.random() < 0.03) {
      throw new Error('Write failed - device busy');
    }
  }

  private determineQuality(value: any): 'good' | 'bad' | 'uncertain' {
    // Simulate quality issues (3% chance of bad quality)
    if (Math.random() < 0.03) {
      return Math.random() > 0.5 ? 'bad' : 'uncertain';
    }
    return 'good';
  }

  private updateMetrics(message: ProfinetMessage): void {
    this.metrics.totalMessages++;
    this.metrics.lastMessage = message.timestamp;
    this.metrics.blocksRead++;
    
    // Calculate messages per second
    const now = new Date();
    const timeDiff = (now.getTime() - this.lastMessageTime.getTime()) / 1000;
    if (timeDiff > 0) {
      this.metrics.messagesPerSecond = 1 / timeDiff;
    }
    this.lastMessageTime = now;
  }

  // Backend migration support
  private emitToBackend(event: string, data: any): void {
    console.log(`[Backend] ${event}:`, data);
  }

  async migrateToBackend(): Promise<any> {
    return await this.storage.migrateToBackend(this.config.id);
  }

  // Cleanup
  async destroy(): Promise<void> {
    this.stopBlockScanning();
    this.stopHeartbeat();
  }

  // Required IConnector interface methods
  getConfig(): ConnectionConfig {
    return this.config;
  }

  async updateConfig(config: Partial<ConnectionConfig>): Promise<void> {
    this.config = { ...this.config, ...config } as ProfinetConfig;
    await this.storage.saveConnectionConfig(this.config);
  }

  async validateConfig(config: ConnectionConfig): Promise<boolean> {
    const profinetConfig = config as ProfinetConfig;
    return !!(profinetConfig.host && profinetConfig.port && profinetConfig.blocks && profinetConfig.blocks.length > 0);
  }

  async read(path: string): Promise<any> {
    return this.readBlock(path);
  }

  async write(path: string, value: any): Promise<void> {
    return this.writeBlock(path, value);
  }

  async delete(path: string): Promise<void> {
    await this.removeBlock(path);
  }

  async list(path?: string): Promise<string[]> {
    const blocks = await this.getBlockList();
    return blocks.map(block => block.name);
  }

  async exists(path: string): Promise<boolean> {
    const blocks = await this.getBlockList();
    return blocks.some(block => block.name === path);
  }

  async getMetadata(path: string): Promise<any> {
    const blocks = await this.getBlockList();
    const block = blocks.find(b => b.name === path);
    return block || null;
  }

  async setMetadata(path: string, metadata: any): Promise<void> {
    const blocks = await this.getBlockList();
    const blockIndex = blocks.findIndex(b => b.name === path);
    if (blockIndex !== -1) {
      blocks[blockIndex] = { ...blocks[blockIndex], ...metadata };
      await this.storage.saveBlock({ ...blocks[blockIndex], connectionId: this.config.id });
    }
  }

  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    const subscriptionId = `profinet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.eventBus.subscribe(`profinet:block:${topic}`, callback);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    // For simplicity, we'll unsubscribe from all topics
    // In a real implementation, you'd track subscriptions by ID
    this.eventBus.unsubscribe(`profinet:block:*`);
  }

  // Additional required IConnector interface methods
  async query(filter: any): Promise<any[]> {
    const blocks = await this.getBlockList();
    return blocks.filter(block => 
      Object.entries(filter).every(([key, value]) => 
        block[key as keyof ProfinetBlock] === value
      )
    );
  }

  async publish(topic: string, data: any): Promise<void> {
    this.eventBus.publish(`profinet:${topic}`, data);
  }

  async getDataQuality(): Promise<any> {
    return {
      overallQuality: this.isConnected() ? 'good' : 'bad',
      blockQuality: {},
      lastUpdate: new Date()
    };
  }

  async getHealth(): Promise<{ status: string; details: any }> {
    return {
      status: this.isConnected() ? 'healthy' : 'unhealthy',
      details: {
        connectionStatus: this.getStatus(),
        metrics: await this.getMetrics(),
        lastMessage: this.metrics.lastMessage,
        deviceStatus: this.metrics.deviceStatus
      }
    };
  }

  async getCapabilities(): Promise<string[]> {
    return ['read', 'write', 'subscribe', 'query', 'metadata', 'heartbeat'];
  }

  async getSchema(): Promise<any> {
    return {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              number: { type: 'number' },
              type: { type: 'string' },
              dataType: { type: 'string' },
              readOnly: { type: 'boolean' }
            }
          }
        }
      }
    };
  }

  async initialize(): Promise<void> {
    await this.initializeStorage();
  }

  async reset(): Promise<void> {
    this.stopBlockScanning();
    this.stopHeartbeat();
    this.metrics = {
      totalMessages: 0,
      messagesPerSecond: 0,
      lastMessage: new Date(),
      connectionUptime: 0,
      errors: 0,
      blocksRead: 0,
      blocksWritten: 0,
      deviceStatus: 'offline'
    };
  }
}

// Profinet Manager for handling multiple connections
export class ProfinetManager {
  protected connections: Map<string, ProfinetConnector> = new Map();
  protected storage: ProfinetStorageService;

  constructor() {
    this.storage = new ProfinetStorageService();
  }

  async createConnection(id: string, config: ProfinetConfig): Promise<ProfinetConnector> {
    // Save configuration to IndexedDB
    await this.storage.saveConnectionConfig(config);
    
    const connector = new ProfinetConnector(config, globalEventBus);
    this.connections.set(id, connector);
    
    globalEventBus.publish('profinet.manager.connection.created', { 
      connectionId: id,
      config,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<ProfinetConnector | undefined> {
    // Check if connection exists in memory
    let connector = this.connections.get(id);
    
    if (!connector) {
      // Try to load from IndexedDB and create connector
      const config = await this.storage.getConnectionConfig(id);
      if (config) {
        connector = new ProfinetConnector(config, globalEventBus);
        this.connections.set(id, connector);
      }
    }
    
    return connector;
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.destroy();
      this.connections.delete(id);
      
      // Remove from IndexedDB
      await this.storage.deleteConnectionConfig(id);
      
      globalEventBus.publish('profinet.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, ProfinetConnector>> {
    // Load all configurations from IndexedDB
    const configs = await this.storage.getAllConnectionConfigs();
    
    for (const config of configs) {
      if (!this.connections.has(config.id)) {
        const connector = new ProfinetConnector(config, globalEventBus);
        this.connections.set(config.id, connector);
      }
    }
    
    return new Map(this.connections);
  }

  async getAllConnectionConfigs(): Promise<ProfinetConfig[]> {
    return await this.storage.getAllConnectionConfigs();
  }

  async destroy(): Promise<void> {
    for (const connection of this.connections.values()) {
      await connection.destroy();
    }
    this.connections.clear();
  }

  async migrateAllToBackend(): Promise<any[]> {
    const configs = await this.storage.getAllConnectionConfigs();
    const migrations = [];
    
    for (const config of configs) {
      const migration = await this.storage.migrateToBackend(config.id);
      migrations.push(migration);
    }
    
    return migrations;
  }
}

// Factory function to create Profinet connectors
export async function createProfinetConnector(
  config: Partial<ProfinetConfig> & { id: string; name: string; host: string; port: number; deviceId: string }
): Promise<ProfinetConnector> {
  const fullConfig: ProfinetConfig = {
    ...DEFAULT_PROFINET_CONFIG,
    ...config,
    blocks: config.blocks || []
  } as ProfinetConfig;

  const storage = new ProfinetStorageService();
  await storage.saveConnectionConfig(fullConfig);
  
  return new ProfinetConnector(fullConfig, globalEventBus);
}

// Global Profinet manager instance
export const globalProfinetManager = new ProfinetManager();

// Initialize default connection if none exists (for backward compatibility)
export async function initializeDefaultConnection(): Promise<ProfinetConnector | null> {
  try {
    const configs = await globalProfinetManager.getAllConnectionConfigs();
    
    if (configs.length === 0) {
      // Create a default configuration
      const defaultConfig: ProfinetConfig = {
        id: 'profinet_default',
        name: 'Default Profinet',
        type: 'profinet',
        endpoint: 'localhost:102',
        enabled: false,
        host: 'localhost',
        port: 102,
        deviceId: 'PLC001',
        rack: 0,
        slot: 0,
        timeout: 5000,
        scanRate: 1000,
        blocks: []
      };
      
      return await globalProfinetManager.createConnection('profinet_default', defaultConfig);
    }
    
    return null; // No default connection needed
  } catch (error) {
    console.error('Failed to initialize default Profinet connection:', error);
    return null;
  }
}

// Export for universal integration
export { ProfinetConnector as Connector, ProfinetManager as Manager };

// Configuration Management Interface for Universal Integration
export interface ProfinetConnectionTemplate {
  id: string;
  name: string;
  description?: string;
  host: string;
  port: number;
  deviceId: string;
  rack: number;
  slot: number;
  timeout: number;
  scanRate: number;
  enabled: boolean;
  blocks: ProfinetBlock[];
  security?: ProfinetSecurity;
  metadata?: Record<string, any>;
}

export interface ProfinetConnectionStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'failed';
  lastConnected?: Date;
  lastError?: string;
  errorCount: number;
  metrics: {
    totalMessages: number;
    messagesPerSecond: number;
    blocksRead: number;
    blocksWritten: number;
    connectionUptime: number;
    deviceStatus: 'online' | 'offline' | 'error';
  };
}

export interface ProfinetConnectionSummary {
  id: string;
  name: string;
  type: 'profinet';
  endpoint: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'failed';
  blockCount: number;
  lastActivity?: Date;
}

// Enhanced Manager with Universal Integration Support
export class ProfinetUniversalManager extends ProfinetManager {
  
  // Create connection from template
  async createConnectionFromTemplate(template: ProfinetConnectionTemplate): Promise<ProfinetConnector> {
    const config: ProfinetConfig = {
      id: template.id,
      name: template.name,
      type: 'profinet',
      endpoint: `${template.host}:${template.port}`,
      enabled: template.enabled,
      host: template.host,
      port: template.port,
      deviceId: template.deviceId,
      rack: template.rack,
      slot: template.slot,
      timeout: template.timeout,
      scanRate: template.scanRate,
      blocks: template.blocks,
      security: template.security,
      metadata: template.metadata
    };
    
    return await this.createConnection(template.id, config);
  }
  
  // Get connection status for all connections
  async getAllConnectionStatuses(): Promise<ProfinetConnectionStatus[]> {
    const connections = await this.getAllConnections();
    const statuses: ProfinetConnectionStatus[] = [];
    
    for (const [id, connector] of connections) {
      const status = connector.getStatus();
      const metrics = await connector.getMetrics();
      
      statuses.push({
        id,
        name: connector.getConfig().name,
        status: status.connected ? 'connected' : 
                status.errorCount > 0 ? 'failed' : 'disconnected',
        lastConnected: status.lastConnected,
        lastError: status.lastError,
        errorCount: status.errorCount,
        metrics: {
          totalMessages: metrics.totalMessages,
          messagesPerSecond: metrics.messagesPerSecond,
          blocksRead: metrics.blocksRead,
          blocksWritten: metrics.blocksWritten,
          connectionUptime: metrics.connectionUptime,
          deviceStatus: metrics.deviceStatus
        }
      });
    }
    
    return statuses;
  }
  
  // Get connection summary for universal integration dashboard
  async getConnectionSummaries(): Promise<ProfinetConnectionSummary[]> {
    const configs = await this.getAllConnectionConfigs();
    const statuses = await this.getAllConnectionStatuses();
    
    return configs.map(config => {
      const status = statuses.find(s => s.id === config.id);
      return {
        id: config.id,
        name: config.name,
        type: 'profinet' as const,
        endpoint: config.endpoint,
        enabled: config.enabled,
        status: status?.status || 'disconnected',
        blockCount: config.blocks.length,
        lastActivity: status?.lastConnected
      };
    });
  }
  
  // Bulk operations for universal integration
  async enableAllConnections(): Promise<void> {
    const configs = await this.getAllConnectionConfigs();
    
    for (const config of configs) {
      if (!config.enabled) {
        config.enabled = true;
        await this.storage.saveConnectionConfig(config);
        
        // Update in-memory connector if exists
        const connector = this.connections.get(config.id);
        if (connector) {
          await connector.updateConfig({ enabled: true });
        }
      }
    }
  }
  
  async disableAllConnections(): Promise<void> {
    const configs = await this.getAllConnectionConfigs();
    
    for (const config of configs) {
      if (config.enabled) {
        config.enabled = false;
        await this.storage.saveConnectionConfig(config);
        
        // Update in-memory connector if exists
        const connector = this.connections.get(config.id);
        if (connector) {
          await connector.updateConfig({ enabled: false });
          await connector.disconnect();
        }
      }
    }
  }
  
  // Connection health monitoring
  async getConnectionHealth(id: string): Promise<any> {
    const connector = await this.getConnection(id);
    if (!connector) {
      throw new Error(`Connection ${id} not found`);
    }
    
    const health = await connector.getHealth();
    const metrics = await connector.getMetrics();
    const status = connector.getStatus();
    
    return {
      id,
      name: connector.getConfig().name,
      health,
      metrics,
      status,
      timestamp: new Date().toISOString()
    };
  }
  
  // Data export for backend migration
  async exportConnectionData(id: string): Promise<any> {
    const connector = await this.getConnection(id);
    if (!connector) {
      throw new Error(`Connection ${id} not found`);
    }
    
    const config = connector.getConfig();
    const messages = await connector.getMessages();
    const blocks = await connector.getBlockList();
    const metrics = await connector.getMetrics();
    const status = connector.getStatus();
    
    return {
      connectionId: id,
      exportTimestamp: new Date().toISOString(),
      config,
      messages,
      blocks,
      metrics,
      status,
      dataVersion: '1.0'
    };
  }
  
  // Import connection from external source
  async importConnection(data: any): Promise<ProfinetConnector> {
    if (!data.config || !data.config.id) {
      throw new Error('Invalid import data: missing configuration');
    }
    
    // Validate the imported configuration
    const isValid = await this.validateImportedConfig(data.config);
    if (!isValid) {
      throw new Error('Invalid imported configuration');
    }
    
    // Create or update the connection
    const connector = await this.createConnection(data.config.id, data.config);
    
    // Import blocks if provided
    if (data.blocks && Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        try {
          await connector.addBlock(block);
        } catch (error) {
          console.warn(`Failed to import block ${block.name}:`, error);
        }
      }
    }
    
    return connector;
  }
  
  private async validateImportedConfig(config: any): Promise<boolean> {
    // Basic validation
    if (!config.id || !config.name || !config.host || !config.port || !config.deviceId) {
      return false;
    }
    
    // Validate port range
    if (config.port < 1 || config.port > 65535) {
      return false;
    }
    
    // Validate timeout and scan rate
    if (config.timeout < 100 || config.scanRate < 100) {
      return false;
    }
    
    return true;
  }
  
  // Cleanup and maintenance
  async cleanupOldMessages(retentionDays: number): Promise<number> {
    const configs = await this.getAllConnectionConfigs();
    let totalCleaned = 0;
    
    for (const config of configs) {
      const cleaned = await this.storage.cleanupOldData(retentionDays);
      totalCleaned += cleaned;
    }
    
    return totalCleaned;
  }
  
  async getStorageStats(): Promise<any> {
    const configs = await this.getAllConnectionConfigs();
    const stats = {
      totalConnections: configs.length,
      enabledConnections: configs.filter(c => c.enabled).length,
      totalBlocks: configs.reduce((sum, c) => sum + c.blocks.length, 0),
      storageSize: 0, // Would need to implement actual size calculation
      lastCleanup: new Date().toISOString()
    };
    
    return stats;
  }
}

// Utility functions for universal integration
export const ProfinetUtils = {
  // Validate configuration before saving
  validateConfig(config: Partial<ProfinetConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.id) errors.push('Connection ID is required');
    if (!config.name) errors.push('Connection name is required');
    if (!config.host) errors.push('Host address is required');
    if (!config.port) errors.push('Port number is required');
    if (!config.deviceId) errors.push('Device ID is required');
    if (config.port && (config.port < 1 || config.port > 65535)) {
      errors.push('Port must be between 1 and 65535');
    }
    if (config.timeout && config.timeout < 100) {
      errors.push('Timeout must be at least 100ms');
    }
    if (config.scanRate && config.scanRate < 100) {
      errors.push('Scan rate must be at least 100ms');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  // Generate default block configuration
  generateDefaultBlocks(): ProfinetBlock[] {
    return [
      {
        name: 'SystemStatus_DB',
        number: 1,
        type: 'DB',
        dataType: 'BOOL',
        readOnly: true,
        description: 'System operational status',
        offset: 0,
        length: 1
      },
      {
        name: 'Temperature_DB',
        number: 2,
        type: 'DB',
        dataType: 'REAL',
        readOnly: false,
        description: 'Process temperature data block',
        offset: 0,
        length: 4,
        scaling: {
          rawMin: 0,
          rawMax: 100,
          scaledMin: 0,
          scaledMax: 100
        }
      },
      {
        name: 'Pressure_M',
        number: 100,
        type: 'M',
        dataType: 'REAL',
        readOnly: false,
        description: 'Process pressure memory',
        offset: 0,
        length: 4
      }
    ];
  },
  
  // Create connection from minimal parameters
  createMinimalConfig(id: string, name: string, host: string, port: number, deviceId: string): ProfinetConfig {
    return {
      id,
      name,
      type: 'profinet',
      endpoint: `${host}:${port}`,
      enabled: false,
      host,
      port,
      deviceId,
      rack: 0,
      slot: 0,
      timeout: 5000,
      scanRate: 1000,
      blocks: this.generateDefaultBlocks(),
      security: {}
    };
  },
  
  // Format connection endpoint
  formatEndpoint(host: string, port: number): string {
    return `${host}:${port}`;
  },
  
  // Parse connection endpoint
  parseEndpoint(endpoint: string): { host: string; port: number } | null {
    const match = endpoint.match(/^(.+):(\d+)$/);
    if (!match) return null;
    
    const [, host, portStr] = match;
    const port = parseInt(portStr, 10);
    
    if (port < 1 || port > 65535) return null;
    
    return { host, port };
  }
};

// Export the enhanced manager for universal integration
export const globalProfinetUniversalManager = new ProfinetUniversalManager();
