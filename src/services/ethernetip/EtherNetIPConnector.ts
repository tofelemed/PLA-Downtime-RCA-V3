import { EventBus, globalEventBus } from '@/services/events/EventBus';
import { IConnector, ConnectionStatus, ConnectionConfig } from '../integrations/base/IConnector';

// EtherNet/IP specific interfaces
export interface EtherNetIPConfig extends ConnectionConfig {
  host: string;
  port: number;
  slot: number;
  timeout: number;
  scanRate: number;
  tags: EtherNetIPTag[];
  security?: EtherNetIPSecurity;
  metadata?: Record<string, any>;
}

export interface EtherNetIPTag {
  name: string;
  address: string;
  dataType: EtherNetIPDataType;
  readOnly: boolean;
  description?: string;
  scaling?: {
    rawMin: number;
    rawMax: number;
    scaledMin: number;
    scaledMax: number;
  };
}

export type EtherNetIPDataType = 
  | 'BOOL'
  | 'SINT'
  | 'INT'
  | 'DINT'
  | 'LINT'
  | 'USINT'
  | 'UINT'
  | 'UDINT'
  | 'ULINT'
  | 'REAL'
  | 'LREAL'
  | 'STRING'
  | 'BYTE'
  | 'WORD'
  | 'DWORD'
  | 'LWORD';

export interface EtherNetIPSecurity {
  username?: string;
  password?: string;
  certificate?: string;
}

export interface EtherNetIPMessage {
  id: string;
  timestamp: Date;
  tag: string;
  value: any;
  quality: 'good' | 'bad' | 'uncertain';
  source: string;
}

export interface EtherNetIPMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  lastMessage: Date;
  connectionUptime: number;
  errors: number;
  tagsRead: number;
  tagsWritten: number;
}

// Default configuration template for new connections
export const DEFAULT_ETHERNETIP_CONFIG: Partial<EtherNetIPConfig> = {
  type: 'ethernetip',
  enabled: false,
  timeout: 5000,
  scanRate: 1000,
  slot: 0,
  tags: [],
  security: {}
};

// IndexedDB Storage Service
class EtherNetIPStorageService {
  private dbName = 'EtherNetIPDB';
  private dbVersion = 2; // Incremented for new schema
  private stores = {
    config: 'ethernetip_config',
    messages: 'ethernetip_messages',
    tags: 'ethernetip_tags',
    connections: 'ethernetip_connections'
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
          store.createIndex('tag', 'tag', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('quality', 'quality', { unique: false });
          store.createIndex('connectionId', 'connectionId', { unique: false });
        }
        
        // Tags store for tag definitions
        if (!db.objectStoreNames.contains(this.stores.tags)) {
          const store = db.createObjectStore(this.stores.tags, { keyPath: 'name' });
          store.createIndex('address', 'address', { unique: false });
          store.createIndex('connectionId', 'connectionId', { unique: false });
        }
      };
    });
  }

  async saveConnectionConfig(config: EtherNetIPConfig): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.config], 'readwrite');
      const store = transaction.objectStore(this.stores.config);
      const request = store.put(config);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConnectionConfig(id: string): Promise<EtherNetIPConfig | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.config], 'readonly');
      const store = transaction.objectStore(this.stores.config);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConnectionConfigs(): Promise<EtherNetIPConfig[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.config], 'readonly');
      const store = transaction.objectStore(this.stores.config);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.config], 'readwrite');
      const store = transaction.objectStore(this.stores.config);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessage(message: EtherNetIPMessage & { connectionId: string }): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.messages], 'readwrite');
      const store = transaction.objectStore(this.stores.messages);
      const request = store.put(message);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(connectionId?: string, tag?: string, limit?: number): Promise<EtherNetIPMessage[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.messages], 'readonly');
      const store = transaction.objectStore(this.stores.messages);
      
      let request: IDBRequest;
      
      if (connectionId && tag) {
        const index = store.index('tag');
        request = index.getAll(IDBKeyRange.only(tag));
      } else if (connectionId) {
        const index = store.index('connectionId');
        request = index.getAll(connectionId);
      } else if (tag) {
        const index = store.index('tag');
        request = index.getAll(tag);
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

  async saveTag(tag: EtherNetIPTag & { connectionId: string }): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.tags], 'readwrite');
      const store = transaction.objectStore(this.stores.tags);
      const request = store.put(tag);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTags(connectionId?: string): Promise<EtherNetIPTag[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.tags], 'readonly');
      const store = transaction.objectStore(this.stores.tags);
      
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
    const tags = await this.getTags(connectionId);
    
    return {
      connectionId,
      config,
      messages,
      tags,
      migrationTimestamp: new Date().toISOString()
    };
  }
}

// Main EtherNet/IP Connector Implementation
export class EtherNetIPConnector implements IConnector {
  private config: EtherNetIPConfig;
  private status: ConnectionStatus;
  private metrics: EtherNetIPMetrics;
  private storage: EtherNetIPStorageService;
  private eventBus: EventBus;
  private connectionStartTime?: Date;
  private scanInterval?: NodeJS.Timeout;
  private messageCount: number = 0;
  private lastMessageTime: Date = new Date();

  constructor(config: EtherNetIPConfig, eventBus: EventBus) {
    this.config = config;
    this.status = { connected: false, errorCount: 0 };
    this.metrics = {
      totalMessages: 0,
      messagesPerSecond: 0,
      lastMessage: new Date(),
      connectionUptime: 0,
      errors: 0,
      tagsRead: 0,
      tagsWritten: 0
    };
    
    this.storage = new EtherNetIPStorageService();
    this.eventBus = eventBus;
    
    this.initializeStorage();
  }

  async connect(): Promise<boolean> {
    try {
      this.status = { connected: false, errorCount: this.status.errorCount };
      this.eventBus.publish('ethernetip:connecting', { config: this.config });
      
      // Simulate connection process
      await this.simulateConnection();
      
      this.status = { connected: true, errorCount: 0, lastConnected: new Date() };
      this.connectionStartTime = new Date();
      
      // Start scanning tags
      this.startTagScanning();
      
      this.eventBus.publish('ethernetip:connected', { config: this.config });
      this.emitToBackend('ethernetip:connected', { config: this.config });
      
      return true;
    } catch (error) {
      this.status = { connected: false, errorCount: this.status.errorCount + 1, lastError: error.message };
      this.metrics.errors++;
      this.eventBus.publish('ethernetip:connection_failed', { error: error.message });
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      this.status = { connected: true, errorCount: this.status.errorCount };
      this.eventBus.publish('ethernetip:disconnecting', {});
      
      // Stop scanning
      this.stopTagScanning();
      
      this.status = { connected: false, errorCount: this.status.errorCount };
      
      if (this.connectionStartTime) {
        this.metrics.connectionUptime = Date.now() - this.connectionStartTime.getTime();
      }
      
      this.eventBus.publish('ethernetip:disconnected', {});
      this.emitToBackend('ethernetip:disconnected', {});
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      this.eventBus.publish('ethernetip:disconnect_failed', { error: error.message });
      return false;
    }
  }

  async readTag(tagName: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to EtherNet/IP device');
    }
    
    try {
      const tag = this.config.tags.find(t => t.name === tagName);
      if (!tag) {
        throw new Error(`Tag ${tagName} not found in configuration`);
      }
      
      // Simulate reading from device
      const value = await this.simulateTagRead(tag);
      const quality = this.determineQuality(value);
      
      // Create message
      const message: EtherNetIPMessage & { connectionId: string } = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        tag: tagName,
        value,
        quality,
        source: this.config.host,
        connectionId: this.config.id
      };
      
      // Save message to IndexedDB
      await this.storage.saveMessage(message);
      
      // Update metrics
      this.updateMetrics(message);
      
      // Publish event
      this.eventBus.publish('ethernetip:tag:read', { message });
      this.emitToBackend('ethernetip:tag:read', { message });
      
      return value;
      
    } catch (error) {
      this.metrics.errors++;
      this.eventBus.publish('ethernetip:tag:read_failed', { tag: tagName, error: error.message });
      throw error;
    }
  }

  async writeTag(tagName: string, value: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to EtherNet/IP device');
    }
    
    try {
      const tag = this.config.tags.find(t => t.name === tagName);
      if (!tag) {
        throw new Error(`Tag ${tagName} not found in configuration`);
      }
      
      if (tag.readOnly) {
        throw new Error(`Tag ${tagName} is read-only`);
      }
      
      // Simulate writing to device
      await this.simulateTagWrite(tag, value);
      
      // Create message
      const message: EtherNetIPMessage & { connectionId: string } = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        tag: tagName,
        value,
        quality: 'good',
        source: this.config.host,
        connectionId: this.config.id
      };
      
      // Save message to IndexedDB
      await this.storage.saveMessage(message);
      
      // Update metrics
      this.updateMetrics(message);
      this.metrics.tagsWritten++;
      
      // Publish event
      this.eventBus.publish('ethernetip:tag:written', { message });
      this.emitToBackend('ethernetip:tag:written', { message });
      
    } catch (error) {
      this.metrics.errors++;
      this.eventBus.publish('ethernetip:tag:write_failed', { tag: tagName, error: error.message });
      throw error;
    }
  }

  async readMultipleTags(tagNames: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const tagName of tagNames) {
      try {
        results[tagName] = await this.readTag(tagName);
      } catch (error) {
        results[tagName] = { error: error.message };
      }
    }
    
    return results;
  }

  async writeMultipleTags(tags: Record<string, any>): Promise<void> {
    for (const [tagName, value] of Object.entries(tags)) {
      await this.writeTag(tagName, value);
    }
  }

  async getTagList(): Promise<EtherNetIPTag[]> {
    return this.config.tags;
  }

  async addTag(tag: EtherNetIPTag): Promise<void> {
    // Check if tag already exists
    const existingTag = this.config.tags.find(t => t.name === tag.name);
    if (existingTag) {
      throw new Error(`Tag ${tag.name} already exists`);
    }
    
    // Add tag to configuration
    this.config.tags.push(tag);
    
    // Save tag to IndexedDB
    await this.storage.saveTag({ ...tag, connectionId: this.config.id });
    
    // Save updated config to IndexedDB
    await this.storage.saveConnectionConfig(this.config);
    
    this.eventBus.publish('ethernetip:tag:added', { tag });
    this.emitToBackend('ethernetip:tag:added', { tag });
  }

  async removeTag(tagName: string): Promise<void> {
    const tagIndex = this.config.tags.findIndex(t => t.name === tagName);
    if (tagIndex === -1) {
      throw new Error(`Tag ${tagName} not found`);
    }
    
    // Remove tag from configuration
    this.config.tags.splice(tagIndex, 1);
    
    // Save updated config to IndexedDB
    await this.storage.saveConnectionConfig(this.config);
    
    this.eventBus.publish('ethernetip:tag:removed', { tagName });
    this.emitToBackend('ethernetip:tag:removed', { tagName });
  }

  async getMetrics(): Promise<EtherNetIPMetrics> {
    // Update real-time metrics
    if (this.connectionStartTime && this.isConnected()) {
      this.metrics.connectionUptime = Date.now() - this.connectionStartTime.getTime();
    }
    
    return this.metrics;
  }

  async getMessages(tag?: string, limit?: number): Promise<EtherNetIPMessage[]> {
    return this.storage.getMessages(this.config.id, tag, limit);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Load existing tags from IndexedDB
      const existingTags = await this.storage.getTags(this.config.id);
      if (existingTags.length > 0) {
        this.config.tags = existingTags;
      }
      
      // Save initial config to IndexedDB
      await this.storage.saveConnectionConfig(this.config);
      
    } catch (error) {
      console.error('Failed to initialize EtherNet/IP storage:', error);
    }
  }

  private async simulateConnection(): Promise<void> {
    // Simulate network delay and connection process
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate connection failure (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Connection timeout - device not responding');
    }
  }

  private startTagScanning(): void {
    if (this.scanInterval) return;
    
    this.scanInterval = setInterval(async () => {
      if (!this.isConnected()) return;
      
      try {
        // Scan all configured tags
        for (const tag of this.config.tags) {
          if (tag.readOnly) {
            await this.readTag(tag.name);
          }
        }
      } catch (error) {
        console.error('Tag scanning failed:', error);
      }
    }, this.config.scanRate);
  }

  private stopTagScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
  }

  private async simulateTagRead(tag: EtherNetIPTag): Promise<any> {
    // Simulate reading delay
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    // Generate simulated value based on tag type
    let value: any;
    
    switch (tag.dataType) {
      case 'BOOL':
        value = Math.random() > 0.5;
        break;
      case 'SINT':
        value = Math.floor(Math.random() * 256) - 128;
        break;
      case 'INT':
        value = Math.floor(Math.random() * 65536) - 32768;
        break;
      case 'DINT':
        value = Math.floor(Math.random() * 4294967296) - 2147483648;
        break;
      case 'REAL':
        value = Math.random() * 1000;
        break;
      case 'STRING':
        value = `Tag_${tag.name}_${Date.now()}`;
        break;
      default:
        value = Math.random() * 100;
    }
    
    // Apply scaling if configured
    if (tag.scaling) {
      const normalized = (value - tag.scaling.rawMin) / (tag.scaling.rawMax - tag.scaling.rawMin);
      value = tag.scaling.scaledMin + normalized * (tag.scaling.scaledMax - tag.scaling.scaledMin);
    }
    
    return value;
  }

  private async simulateTagWrite(tag: EtherNetIPTag, value: any): Promise<void> {
    // Simulate writing delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Simulate write failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Write failed - device busy');
    }
  }

  private determineQuality(value: any): 'good' | 'bad' | 'uncertain' {
    // Simulate quality issues (5% chance of bad quality)
    if (Math.random() < 0.05) {
      return Math.random() > 0.5 ? 'bad' : 'uncertain';
    }
    return 'good';
  }

  private updateMetrics(message: EtherNetIPMessage): void {
    this.metrics.totalMessages++;
    this.metrics.lastMessage = message.timestamp;
    this.metrics.tagsRead++;
    
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
    this.stopTagScanning();
  }

  // Required IConnector interface methods
  getConfig(): ConnectionConfig {
    return this.config;
  }

  async updateConfig(config: Partial<ConnectionConfig>): Promise<void> {
    this.config = { ...this.config, ...config } as EtherNetIPConfig;
    await this.storage.saveConnectionConfig(this.config);
  }

  async validateConfig(config: ConnectionConfig): Promise<boolean> {
    const ethernetConfig = config as EtherNetIPConfig;
    return !!(ethernetConfig.host && ethernetConfig.port && ethernetConfig.tags && ethernetConfig.tags.length > 0);
  }

  async read(path: string): Promise<any> {
    return this.readTag(path);
  }

  async write(path: string, value: any): Promise<void> {
    return this.writeTag(path, value);
  }

  async delete(path: string): Promise<void> {
    await this.removeTag(path);
  }

  async list(path?: string): Promise<string[]> {
    const tags = await this.getTagList();
    return tags.map(tag => tag.name);
  }

  async exists(path: string): Promise<boolean> {
    const tags = await this.getTagList();
    return tags.some(tag => tag.name === path);
  }

  async getMetadata(path: string): Promise<any> {
    const tags = await this.getTagList();
    const tag = tags.find(t => t.name === path);
    return tag || null;
  }

  async setMetadata(path: string, metadata: any): Promise<void> {
    const tags = await this.getTagList();
    const tagIndex = tags.findIndex(t => t.name === path);
    if (tagIndex !== -1) {
      tags[tagIndex] = { ...tags[tagIndex], ...metadata };
      await this.storage.saveTag({ ...tags[tagIndex], connectionId: this.config.id });
    }
  }

  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    const subscriptionId = `ethernetip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.eventBus.subscribe(`ethernetip:tag:${topic}`, callback);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    // For simplicity, we'll unsubscribe from all topics
    // In a real implementation, you'd track subscriptions by ID
    this.eventBus.unsubscribe(`ethernetip:tag:*`);
  }

  // Additional required IConnector interface methods
  async query(filter: any): Promise<any[]> {
    const tags = await this.getTagList();
    return tags.filter(tag => 
      Object.entries(filter).every(([key, value]) => 
        tag[key as keyof EtherNetIPTag] === value
      )
    );
  }

  async publish(topic: string, data: any): Promise<void> {
    this.eventBus.publish(`ethernetip:${topic}`, data);
  }

  async getDataQuality(): Promise<any> {
    return {
      overallQuality: this.isConnected() ? 'good' : 'bad',
      tagQuality: {},
      lastUpdate: new Date()
    };
  }

  async getHealth(): Promise<{ status: string; details: any }> {
    return {
      status: this.isConnected() ? 'healthy' : 'unhealthy',
      details: {
        connectionStatus: this.getStatus(),
        metrics: await this.getMetrics(),
        lastMessage: this.metrics.lastMessage
      }
    };
  }

  async getCapabilities(): Promise<string[]> {
    return ['read', 'write', 'subscribe', 'query', 'metadata'];
  }

  async getSchema(): Promise<any> {
    return {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: { type: 'string' },
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
    this.stopTagScanning();
    this.metrics = {
      totalMessages: 0,
      messagesPerSecond: 0,
      lastMessage: new Date(),
      connectionUptime: 0,
      errors: 0,
      tagsRead: 0,
      tagsWritten: 0
    };
  }
}

// EtherNet/IP Manager for handling multiple connections
export class EtherNetIPManager {
  protected connections: Map<string, EtherNetIPConnector> = new Map();
  protected storage: EtherNetIPStorageService;

  constructor() {
    this.storage = new EtherNetIPStorageService();
  }

  async createConnection(id: string, config: EtherNetIPConfig): Promise<EtherNetIPConnector> {
    // Save configuration to IndexedDB
    await this.storage.saveConnectionConfig(config);
    
    const connector = new EtherNetIPConnector(config, globalEventBus);
    this.connections.set(id, connector);
    
    globalEventBus.publish('ethernetip.manager.connection.created', { 
      connectionId: id,
      config,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<EtherNetIPConnector | undefined> {
    // Check if connection exists in memory
    let connector = this.connections.get(id);
    
    if (!connector) {
      // Try to load from IndexedDB and create connector
      const config = await this.storage.getConnectionConfig(id);
      if (config) {
        connector = new EtherNetIPConnector(config, globalEventBus);
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
      
      globalEventBus.publish('ethernetip.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, EtherNetIPConnector>> {
    // Load all configurations from IndexedDB
    const configs = await this.storage.getAllConnectionConfigs();
    
    for (const config of configs) {
      if (!this.connections.has(config.id)) {
        const connector = new EtherNetIPConnector(config, globalEventBus);
        this.connections.set(config.id, connector);
      }
    }
    
    return new Map(this.connections);
  }

  async getAllConnectionConfigs(): Promise<EtherNetIPConfig[]> {
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

// Factory function to create EtherNet/IP connectors
export async function createEtherNetIPConnector(
  config: Partial<EtherNetIPConfig> & { id: string; name: string; host: string; port: number }
): Promise<EtherNetIPConnector> {
  const fullConfig: EtherNetIPConfig = {
    ...DEFAULT_ETHERNETIP_CONFIG,
    ...config,
    tags: config.tags || []
  } as EtherNetIPConfig;

  const storage = new EtherNetIPStorageService();
  await storage.saveConnectionConfig(fullConfig);
  
  return new EtherNetIPConnector(fullConfig, globalEventBus);
}

// Global EtherNet/IP manager instance
export const globalEtherNetIPManager = new EtherNetIPManager();

// Initialize default connection if none exists (for backward compatibility)
export async function initializeDefaultConnection(): Promise<EtherNetIPConnector | null> {
  try {
    const configs = await globalEtherNetIPManager.getAllConnectionConfigs();
    
    if (configs.length === 0) {
      // Create a default configuration
      const defaultConfig: EtherNetIPConfig = {
        id: 'ethernetip_default',
        name: 'Default EtherNet/IP',
        type: 'ethernetip',
        endpoint: 'localhost:44818',
        enabled: false,
        host: 'localhost',
        port: 44818,
        slot: 0,
        timeout: 5000,
        scanRate: 1000,
        tags: []
      };
      
      return await globalEtherNetIPManager.createConnection('ethernetip_default', defaultConfig);
    }
    
    return null; // No default connection needed
  } catch (error) {
    console.error('Failed to initialize default EtherNet/IP connection:', error);
    return null;
  }
}

// Export for universal integration
export { EtherNetIPConnector as Connector, EtherNetIPManager as Manager };

// Configuration Management Interface for Universal Integration
export interface EtherNetIPConnectionTemplate {
  id: string;
  name: string;
  description?: string;
  host: string;
  port: number;
  slot: number;
  timeout: number;
  scanRate: number;
  enabled: boolean;
  tags: EtherNetIPTag[];
  security?: EtherNetIPSecurity;
  metadata?: Record<string, any>;
}

export interface EtherNetIPConnectionStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'failed';
  lastConnected?: Date;
  lastError?: string;
  errorCount: number;
  metrics: {
    totalMessages: number;
    messagesPerSecond: number;
    tagsRead: number;
    tagsWritten: number;
    connectionUptime: number;
  };
}

export interface EtherNetIPConnectionSummary {
  id: string;
  name: string;
  type: 'ethernetip';
  endpoint: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'failed';
  tagCount: number;
  lastActivity?: Date;
}

// Enhanced Manager with Universal Integration Support
export class EtherNetIPUniversalManager extends EtherNetIPManager {
  
  // Create connection from template
  async createConnectionFromTemplate(template: EtherNetIPConnectionTemplate): Promise<EtherNetIPConnector> {
    const config: EtherNetIPConfig = {
      id: template.id,
      name: template.name,
      type: 'ethernetip',
      endpoint: `${template.host}:${template.port}`,
      enabled: template.enabled,
      host: template.host,
      port: template.port,
      slot: template.slot,
      timeout: template.timeout,
      scanRate: template.scanRate,
      tags: template.tags,
      security: template.security,
      metadata: template.metadata
    };
    
    return await this.createConnection(template.id, config);
  }
  
  // Get connection status for all connections
  async getAllConnectionStatuses(): Promise<EtherNetIPConnectionStatus[]> {
    const connections = await this.getAllConnections();
    const statuses: EtherNetIPConnectionStatus[] = [];
    
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
          tagsRead: metrics.tagsRead,
          tagsWritten: metrics.tagsWritten,
          connectionUptime: metrics.connectionUptime
        }
      });
    }
    
    return statuses;
  }
  
  // Get connection summary for universal integration dashboard
  async getConnectionSummaries(): Promise<EtherNetIPConnectionSummary[]> {
    const configs = await this.getAllConnectionConfigs();
    const statuses = await this.getAllConnectionStatuses();
    
    return configs.map(config => {
      const status = statuses.find(s => s.id === config.id);
      return {
        id: config.id,
        name: config.name,
        type: 'ethernetip' as const,
        endpoint: config.endpoint,
        enabled: config.enabled,
        status: status?.status || 'disconnected',
        tagCount: config.tags.length,
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
    const tags = await connector.getTagList();
    const metrics = await connector.getMetrics();
    const status = connector.getStatus();
    
    return {
      connectionId: id,
      exportTimestamp: new Date().toISOString(),
      config,
      messages,
      tags,
      metrics,
      status,
      dataVersion: '1.0'
    };
  }
  
  // Import connection from external source
  async importConnection(data: any): Promise<EtherNetIPConnector> {
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
    
    // Import tags if provided
    if (data.tags && Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        try {
          await connector.addTag(tag);
        } catch (error) {
          console.warn(`Failed to import tag ${tag.name}:`, error);
        }
      }
    }
    
    return connector;
  }
  
  private async validateImportedConfig(config: any): Promise<boolean> {
    // Basic validation
    if (!config.id || !config.name || !config.host || !config.port) {
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
      totalTags: configs.reduce((sum, c) => sum + c.tags.length, 0),
      storageSize: 0, // Would need to implement actual size calculation
      lastCleanup: new Date().toISOString()
    };
    
    return stats;
  }
}

// Utility functions for universal integration
export const EtherNetIPUtils = {
  // Validate configuration before saving
  validateConfig(config: Partial<EtherNetIPConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.id) errors.push('Connection ID is required');
    if (!config.name) errors.push('Connection name is required');
    if (!config.host) errors.push('Host address is required');
    if (!config.port) errors.push('Port number is required');
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
  
  // Generate default tag configuration
  generateDefaultTags(): EtherNetIPTag[] {
    return [
      {
        name: 'SystemStatus',
        address: 'B3:0',
        dataType: 'BOOL',
        readOnly: true,
        description: 'System operational status'
      },
      {
        name: 'Temperature',
        address: 'N7:0',
        dataType: 'REAL',
        readOnly: false,
        description: 'Process temperature',
        scaling: {
          rawMin: 0,
          rawMax: 100,
          scaledMin: 0,
          scaledMax: 100
        }
      },
      {
        name: 'Pressure',
        address: 'N7:1',
        dataType: 'REAL',
        readOnly: false,
        description: 'Process pressure'
      }
    ];
  },
  
  // Create connection from minimal parameters
  createMinimalConfig(id: string, name: string, host: string, port: number): EtherNetIPConfig {
    return {
      id,
      name,
      type: 'ethernetip',
      endpoint: `${host}:${port}`,
      enabled: false,
      host,
      port,
      slot: 0,
      timeout: 5000,
      scanRate: 1000,
      tags: this.generateDefaultTags(),
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
export const globalEtherNetIPUniversalManager = new EtherNetIPUniversalManager();
