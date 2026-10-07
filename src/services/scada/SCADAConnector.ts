// SCADA Connector - Supervisory Control and Data Acquisition support
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

export type SCADAProtocol = 'modbus' | 'opcua' | 'dnp3' | 'iec60870' | 'bacnet' | 'ethernetip' | 'profinet' | 'custom';

export interface SCADAOptions {
  protocol: SCADAProtocol;
  host: string;
  port: number;
  deviceId?: number;
  timeout?: number;
  retries?: number;
  scanRate?: number;
  authentication?: {
    type: 'none' | 'username' | 'certificate' | 'token';
    username?: string;
    password?: string;
    certificate?: string;
    token?: string;
  };
  security?: {
    encryption?: boolean;
    ssl?: boolean;
    tls?: boolean;
    certificateValidation?: boolean;
  };
  // Protocol-specific options
  modbus?: {
    functionCode?: number;
    byteOrder?: 'big-endian' | 'little-endian';
    wordOrder?: 'big-endian' | 'little-endian';
  };
  opcua?: {
    securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy?: string;
    nodeId?: string;
  };
  dnp3?: {
    master?: boolean;
    unsolicited?: boolean;
    integrityScan?: number;
  };
}

export interface SCADATag {
  id: string;
  name: string;
  address: string;
  dataType: 'boolean' | 'int16' | 'int32' | 'float32' | 'float64' | 'string' | 'binary';
  access: 'read' | 'write' | 'readwrite';
  description?: string;
  units?: string;
  scaling?: {
    factor: number;
    offset: number;
  };
  limits?: {
    min?: number;
    max?: number;
    alarmHigh?: number;
    alarmLow?: number;
    warningHigh?: number;
    warningLow?: number;
  };
  quality?: 'Good' | 'Uncertain' | 'Bad';
  timestamp?: Date;
  value?: any;
}

export interface SCADAMessage {
  tagId: string;
  tagName: string;
  value: any;
  timestamp: Date;
  quality: 'Good' | 'Uncertain' | 'Bad';
  source: string;
  metadata?: Record<string, any>;
}

export interface SCADAMetrics {
  tagsRead: number;
  tagsWritten: number;
  alarms: number;
  errors: number;
  lastRead?: Date;
  lastWrite?: Date;
  averageResponseTime: number;
  connectionUptime: number;
  activeTags: number;
  scanRate: number;
}

export interface SCADASubscription {
  id: string;
  tagIds: string[];
  callback: (data: SCADAMessage[]) => void;
  active: boolean;
  scanRate: number;
  lastExecution?: Date;
  executionCount: number;
}

export interface SCADAAlarm {
  id: string;
  tagId: string;
  type: 'high' | 'low' | 'deviation' | 'quality' | 'communication';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  value?: any;
  limit?: number;
}

export class SCADAConnector extends BaseConnector implements IConnector {
  private scadaClient: any = null;
  private scadaOptions: SCADAOptions;
  private activeTags: Map<string, SCADATag> = new Map();
  private activeSubscriptions: Map<string, SCADASubscription> = new Map();
  protected transforms: TransformConfig[] = [];
  protected filters: FilterConfig[] = [];
  private connectionStartTime: number = 0;
  private streamingActive: boolean = false;
  private scanTimer?: NodeJS.Timeout;
  private alarms: Map<string, SCADAAlarm> = new Map();
  private messageBuffer: SCADAMessage[] = [];
  private db: UniversalConnectorDB;

  constructor(config: ConnectionConfig, scadaOptions: SCADAOptions) {
    super(config);
    
    this.scadaOptions = {
      timeout: 30000,
      retries: 3,
      scanRate: 1000,
      authentication: { type: 'none' },
      security: { encryption: false, ssl: false, tls: false, certificateValidation: false },
      ...scadaOptions
    };

    this.metrics = {
      tagsRead: 0,
      tagsWritten: 0,
      alarms: 0,
      errors: 0,
      averageResponseTime: 0,
      connectionUptime: 0,
      activeTags: 0,
      scanRate: this.scadaOptions.scanRate || 1000
    };

    this.db = new UniversalConnectorDB();
  }

  // Abstract method implementations
  protected async performConnect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to SCADA system: ${this.scadaOptions.protocol}://${this.scadaOptions.host}:${this.scadaOptions.port}`);
      
      // Store connection in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'scada',
        config: { ...this.config, scadaOptions: this.scadaOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connecting',
        errorCount: 0,
        metadata: {
          protocol: this.scadaOptions.protocol,
          host: this.scadaOptions.host,
          port: this.scadaOptions.port,
          systemType: 'SCADA'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate successful connection
      this.scadaClient = {
        connected: true,
        readTags: this.simulateReadTags.bind(this),
        writeTags: this.simulateWriteTags.bind(this),
        scanTags: this.simulateScanTags.bind(this),
        getAlarms: this.simulateGetAlarms.bind(this),
        acknowledgeAlarm: this.simulateAcknowledgeAlarm.bind(this),
        disconnect: this.simulateDisconnect.bind(this)
      };

      this.connectionStartTime = Date.now();
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'scada',
        config: { ...this.config, scadaOptions: this.scadaOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connected',
        errorCount: 0,
        metadata: {
          protocol: this.scadaOptions.protocol,
          host: this.scadaOptions.host,
          port: this.scadaOptions.port,
          systemType: 'SCADA'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Start scanning if streaming is enabled
      if (this.streamingActive) {
        this.startScanning();
      }
      
      console.log(`✅ Connected to SCADA system: ${this.scadaOptions.protocol}://${this.scadaOptions.host}:${this.scadaOptions.port}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to SCADA system:`, error);
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'scada',
        config: { ...this.config, scadaOptions: this.scadaOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'error',
        errorCount: 1,
        metadata: {
          protocol: this.scadaOptions.protocol,
          host: this.scadaOptions.host,
          port: this.scadaOptions.port,
          systemType: 'SCADA'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return false;
    }
  }

  protected async performDisconnect(): Promise<boolean> {
    try {
      if (this.scadaClient) {
        await this.scadaClient.disconnect();
        this.scadaClient = null;
      }
      
      // Stop scanning
      this.stopScanning();
      
      // Stop all streaming
      await this.stopStreaming();
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'scada',
        config: { ...this.config, scadaOptions: this.scadaOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'disconnected',
        errorCount: this.metrics.errors,
        metadata: {
          protocol: this.scadaOptions.protocol,
          host: this.scadaOptions.host,
          port: this.scadaOptions.port,
          systemType: 'SCADA'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`🔌 Disconnected from SCADA system: ${this.scadaOptions.protocol}://${this.scadaOptions.host}:${this.scadaOptions.port}`);
      return true;
    } catch (error) {
      console.error(`❌ Error disconnecting from SCADA system:`, error);
      return false;
    }
  }

  protected async performRead(path: string, options?: Record<string, any>): Promise<any> {
    const tagId = path;
    const tag = this.activeTags.get(tagId);
    
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    return this.readTag(tagId);
  }

  protected async performWrite(path: string, data: any, options?: Record<string, any>): Promise<void> {
    const tagId = path;
    const tag = this.activeTags.get(tagId);
    
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    if (tag.access === 'read') {
      throw new Error(`Tag ${tagId} is read-only`);
    }

    await this.writeTag(tagId, data);
  }

  protected async performQuery(query: string, options?: Record<string, any>): Promise<any[]> {
    // SCADA query can be tag names, addresses, or custom queries
    const queryType = options?.type || 'tags';
    
    if (queryType === 'tags') {
      const tagNames = query.split(',').map(t => t.trim());
      const results = [];
      
      for (const tagName of tagNames) {
        const tag = Array.from(this.activeTags.values()).find(t => t.name === tagName);
        if (tag) {
          results.push(tag);
        }
      }
      
      return results;
    } else if (queryType === 'alarms') {
      return Array.from(this.alarms.values());
    } else if (queryType === 'addresses') {
      const address = query;
      const results = [];
      
      for (const tag of this.activeTags.values()) {
        if (tag.address.includes(address)) {
          results.push(tag);
        }
      }
      
      return results;
    }
    
    return [];
  }

  // SCADA specific methods

  async addTag(tag: SCADATag): Promise<void> {
    this.activeTags.set(tag.id, tag);
    this.metrics.activeTags = this.activeTags.size;
    
    globalEventBus.publish('scada.tag.added', {
      tag,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  async removeTag(tagId: string): Promise<void> {
    const tag = this.activeTags.get(tagId);
    if (tag) {
      this.activeTags.delete(tagId);
      this.metrics.activeTags = this.activeTags.size;
      
      globalEventBus.publish('scada.tag.removed', {
        tag,
        timestamp: new Date(),
        connectorId: this.config.id
      });
    }
  }

  async readTag(tagId: string): Promise<SCADATag> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    const startTime = Date.now();
    
    try {
      const tag = this.activeTags.get(tagId);
      if (!tag) {
        throw new Error(`Tag ${tagId} not found`);
      }

      const result = await this.scadaClient.readTags([tagId]);
      const responseTime = Date.now() - startTime;
      
      this.updateMetrics('read', responseTime);
      
      // Update tag value
      if (result && result[tagId]) {
        tag.value = result[tagId].value;
        tag.quality = result[tagId].quality;
        tag.timestamp = result[tagId].timestamp;
      }

      globalEventBus.publish('scada.tag.read', {
        tagId,
        tag,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      return tag;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async writeTag(tagId: string, value: any): Promise<void> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    const startTime = Date.now();
    
    try {
      const tag = this.activeTags.get(tagId);
      if (!tag) {
        throw new Error(`Tag ${tagId} not found`);
      }

      if (tag.access === 'read') {
        throw new Error(`Tag ${tagId} is read-only`);
      }

      await this.scadaClient.writeTags({ [tagId]: value });
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics('write', responseTime);
      
      // Update tag value
      tag.value = value;
      tag.timestamp = new Date();

      globalEventBus.publish('scada.tag.written', {
        tagId,
        tag,
        value,
        timestamp: new Date(),
        connectorId: this.config.id
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async readMultipleTags(tagIds: string[]): Promise<Record<string, SCADATag>> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.scadaClient.readTags(tagIds);
      const responseTime = Date.now() - startTime;
      
      this.updateMetrics('read', responseTime);
      
      // Update tag values
      for (const tagId of tagIds) {
        const tag = this.activeTags.get(tagId);
        if (tag && result[tagId]) {
          tag.value = result[tagId].value;
          tag.quality = result[tagId].quality;
          tag.timestamp = result[tagId].timestamp;
        }
      }

      globalEventBus.publish('scada.tags.read', {
        tagIds,
        result,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async writeMultipleTags(tags: Record<string, any>): Promise<void> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    const startTime = Date.now();
    
    try {
      await this.scadaClient.writeTags(tags);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics('write', responseTime);
      
      // Update tag values
      for (const [tagId, value] of Object.entries(tags)) {
        const tag = this.activeTags.get(tagId);
        if (tag) {
          tag.value = value;
          tag.timestamp = new Date();
        }
      }

      globalEventBus.publish('scada.tags.written', {
        tags,
        timestamp: new Date(),
        connectorId: this.config.id
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    // Convert topic to tagIds for internal use
    const tagIds = topic.split(',').map(t => t.trim());
    
    const options = {
      scanRate: this.scadaOptions.scanRate || 1000,
      filter: undefined
    };
    const subscriptionId = `scada_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: SCADASubscription = {
      id: subscriptionId,
      tagIds,
      callback,
      active: true,
      scanRate: options?.scanRate || this.scadaOptions.scanRate || 1000,
      executionCount: 0
    };

    this.activeSubscriptions.set(subscriptionId, subscription);

    console.log(`📡 Created SCADA subscription: ${subscriptionId} for ${tagIds.length} tags`);
    
    globalEventBus.publish('scada.subscription.created', {
      subscriptionId,
      tagIds,
      timestamp: new Date(),
      connectorId: this.config.id
    });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    subscription.active = false;
    this.activeSubscriptions.delete(subscriptionId);

    console.log(`🔌 Removed SCADA subscription: ${subscriptionId}`);
    
    globalEventBus.publish('scada.subscription.removed', {
      subscriptionId,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  async getAlarms(options?: {
    acknowledged?: boolean;
    severity?: string[];
    type?: string[];
    startTime?: Date;
    endTime?: Date;
  }): Promise<SCADAAlarm[]> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    try {
      const alarms = await this.scadaClient.getAlarms(options);
      return Array.isArray(alarms) ? alarms : [];
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async acknowledgeAlarm(alarmId: string, acknowledgedBy: string): Promise<void> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    try {
      await this.scadaClient.acknowledgeAlarm(alarmId, acknowledgedBy);
      
      const alarm = this.alarms.get(alarmId);
      if (alarm) {
        alarm.acknowledged = true;
        alarm.acknowledgedBy = acknowledgedBy;
        alarm.acknowledgedAt = new Date();
      }

      globalEventBus.publish('scada.alarm.acknowledged', {
        alarmId,
        acknowledgedBy,
        timestamp: new Date(),
        connectorId: this.config.id
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getSystemStatus(): Promise<any> {
    if (!this.scadaClient) {
      throw new Error('Not connected to SCADA system');
    }

    try {
      return {
        protocol: this.scadaOptions.protocol,
        host: this.scadaOptions.host,
        port: this.scadaOptions.port,
        connected: this.isConnected(),
        activeTags: this.metrics.activeTags,
        activeSubscriptions: this.activeSubscriptions.size,
        alarms: this.alarms.size,
        unacknowledgedAlarms: Array.from(this.alarms.values()).filter(a => !a.acknowledged).length,
        uptime: this.metrics.connectionUptime,
        scanRate: this.metrics.scanRate,
        lastScan: this.metrics.lastRead
      };
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
      metadata: { protocol: 'SCADA' },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`🔧 Added SCADA transform: ${transform.name}`);
  }

  async removeTransform(transformId: string): Promise<void> {
    this.transforms = this.transforms.filter(t => t.id !== transformId);
    
    // Remove transform from IndexedDB
    await this.db.deleteStreamProcessor(transformId);
    
    console.log(`🗑️ Removed SCADA transform: ${transformId}`);
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
      metadata: { protocol: 'SCADA', isFilter: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`🔍 Added SCADA filter: ${filter.name}`);
  }

  async removeFilter(filterId: string): Promise<void> {
    this.filters = this.transforms.filter(f => f.id !== filterId);
    
    // Remove filter from IndexedDB
    await this.db.deleteStreamProcessor(filterId);
    
    console.log(`🗑️ Removed SCADA filter: ${filterId}`);
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
      throw new Error('Not connected to SCADA system');
    }

    this.streamingActive = true;
    console.log(`🚀 Starting SCADA streaming for ${this.config.name}`);

    // Store streaming config in IndexedDB using stream processor
    await this.db.saveStreamProcessor({
      id: `${this.config.id}_stream`,
      name: `SCADA Stream ${this.config.name}`,
      type: 'stream',
      config,
      enabled: true,
      order: 0,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'SCADA', isStream: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Start scanning
    this.startScanning();

    globalEventBus.publish('scada.streaming.started', {
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
    console.log(`🛑 Stopped SCADA streaming for ${this.config.name}`);

    // Stop scanning
    this.stopScanning();

    // Update streaming status in IndexedDB
    await this.db.saveStreamProcessor({
      id: `${this.config.id}_stream`,
      name: `SCADA Stream ${this.config.name}`,
      type: 'stream',
      config: { enabled: false },
      enabled: false,
      order: 0,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'SCADA', isStream: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    globalEventBus.publish('scada.streaming.stopped', {
      connectorId: this.config.id,
      connectorName: this.config.name,
      timestamp: new Date()
    });
  }

  isStreaming(): boolean {
    return this.streamingActive;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions.keys());
  }

  // Metrics and health
  async getMetrics(): Promise<Record<string, any>> {
    this.metrics.connectionUptime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
    
    // Store metrics in IndexedDB
    await this.db.saveStreamMetrics({
      id: `${this.config.id}_metrics_${Date.now()}`,
      timestamp: new Date(),
      totalEvents: this.metrics.tagsRead + this.metrics.tagsWritten,
      processedEvents: this.metrics.tagsRead + this.metrics.tagsWritten,
      droppedEvents: 0,
      averageLatency: this.metrics.averageResponseTime,
      throughput: (this.metrics.tagsRead + this.metrics.tagsWritten) / Math.max(this.metrics.connectionUptime / 1000, 1),
      activeSources: 1,
      activeSinks: 0,
      activeProcessors: this.transforms.length + this.filters.length,
      errorRate: this.metrics.errors / Math.max(this.metrics.tagsRead + this.metrics.tagsWritten, 1),
      dataQuality: {
        completeness: 100 - (this.metrics.errors / Math.max(this.metrics.tagsRead + this.metrics.tagsWritten, 1)) * 100,
        accuracy: 100 - (this.metrics.errors / Math.max(this.metrics.tagsRead + this.metrics.tagsWritten, 1)) * 100,
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
      activeSubscriptions: this.activeSubscriptions.size,
      isStreaming: this.streamingActive,
      alarms: this.alarms.size,
      unacknowledgedAlarms: Array.from(this.alarms.values()).filter(a => !a.acknowledged).length
    };
  }

  async getHealth(): Promise<Record<string, any>> {
    const baseHealth = await super.getHealth();
    
    return {
      ...baseHealth,
      scada: {
        protocol: this.scadaOptions.protocol,
        host: this.scadaOptions.host,
        port: this.scadaOptions.port,
        activeTags: this.metrics.activeTags,
        activeSubscriptions: this.activeSubscriptions.size,
        isStreaming: this.streamingActive,
        connectionUptime: this.metrics.connectionUptime,
        scanRate: this.metrics.scanRate
      }
    };
  }

  // Protected methods

  protected updateMetrics(operation: 'read' | 'write', responseTime: number): void {
    if (operation === 'read') {
      this.metrics.tagsRead++;
      this.metrics.lastRead = new Date();
    } else if (operation === 'write') {
      this.metrics.tagsWritten++;
      this.metrics.lastWrite = new Date();
    }

    // Update average response time
    const totalOperations = this.metrics.tagsRead + this.metrics.tagsWritten;
    const totalTime = this.metrics.averageResponseTime * (totalOperations - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / totalOperations;
  }

  private handleError(error: any): void {
    this.metrics.errors++;
    this.status.errorCount++;
    this.status.lastError = error?.message || 'Unknown SCADA error';
    
    // Store error in IndexedDB
    this.db.saveStreamAlert({
      id: `${this.config.id}_error_${Date.now()}`,
      type: 'error',
      message: error?.message || 'Unknown SCADA error',
      timestamp: new Date(),
      source: this.config.name,
      severity: 3,
      acknowledged: false,
      metadata: { protocol: 'SCADA', connectorId: this.config.id },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('scada.error', {
      error: error?.message || error,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  private startScanning(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    this.scanTimer = setInterval(async () => {
      if (this.streamingActive && this.activeSubscriptions.size > 0) {
        await this.scanAllSubscriptions();
      }
    }, this.scadaOptions.scanRate || 1000);
  }

  private stopScanning(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }
  }

  private async scanAllSubscriptions(): Promise<void> {
    for (const subscription of this.activeSubscriptions.values()) {
      if (subscription.active) {
        try {
          const tags = await this.readMultipleTags(subscription.tagIds);
          const messages: SCADAMessage[] = [];
          
          for (const [tagId, tag] of Object.entries(tags)) {
            if (tag) {
              messages.push({
                tagId,
                tagName: tag.name,
                value: tag.value,
                timestamp: tag.timestamp || new Date(),
                quality: tag.quality || 'Good',
                source: this.config.name
              });
            }
          }
          
          if (messages.length > 0) {
            subscription.callback(messages);
            subscription.lastExecution = new Date();
            subscription.executionCount++;
          }
        } catch (error) {
          console.error(`Error scanning subscription ${subscription.id}:`, error);
        }
      }
    }
  }

  // Simulation methods for development/testing
  private async simulateReadTags(tagIds: string[]): Promise<Record<string, any>> {
    console.log(`📖 Simulated SCADA read tags: ${tagIds.join(', ')}`);
    
    // Simulate read delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    const result: Record<string, any> = {};
    
    for (const tagId of tagIds) {
      const tag = this.activeTags.get(tagId);
      if (tag) {
        // Generate simulated values based on data type
        let value: any;
        switch (tag.dataType) {
          case 'boolean':
            value = Math.random() > 0.5;
            break;
          case 'int16':
            value = Math.floor(Math.random() * 65536) - 32768;
            break;
          case 'int32':
            value = Math.floor(Math.random() * 4294967296) - 2147483648;
            break;
          case 'float32':
          case 'float64':
            value = Math.random() * 1000;
            break;
          case 'string':
            value = `Value_${Math.floor(Math.random() * 1000)}`;
            break;
          default:
            value = Math.random() * 100;
        }
        
        // Apply scaling if defined
        if (tag.scaling) {
          value = value * tag.scaling.factor + tag.scaling.offset;
        }
        
        result[tagId] = {
          value,
          quality: 'Good' as const,
          timestamp: new Date()
        };
      }
    }
    
    return result;
  }

  private async simulateWriteTags(tags: Record<string, any>): Promise<void> {
    console.log(`✏️ Simulated SCADA write tags:`, tags);
    
    // Simulate write delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
    
    // Update tag values
    for (const [tagId, value] of Object.entries(tags)) {
      const tag = this.activeTags.get(tagId);
      if (tag) {
        tag.value = value;
        tag.timestamp = new Date();
      }
    }
  }

  private async simulateScanTags(): Promise<void> {
    console.log(`🔍 Simulated SCADA scan tags`);
    
    // Simulate scan delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
  }

  private async simulateGetAlarms(options?: any): Promise<SCADAAlarm[]> {
    console.log(`🚨 Simulated SCADA get alarms`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
    
    // Generate simulated alarms
    const alarms: SCADAAlarm[] = [];
    const alarmTypes = ['high', 'low', 'deviation', 'quality', 'communication'];
    const severities = ['critical', 'high', 'medium', 'low'];
    
    for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
      const alarm: SCADAAlarm = {
        id: `alarm_${Date.now()}_${i}`,
        tagId: `tag_${Math.floor(Math.random() * 10) + 1}`,
        type: alarmTypes[Math.floor(Math.random() * alarmTypes.length)] as any,
        severity: severities[Math.floor(Math.random() * severities.length)] as any,
        message: `Simulated alarm ${i + 1}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        acknowledged: Math.random() > 0.7,
        value: Math.random() * 100,
        limit: Math.random() * 100
      };
      
      alarms.push(alarm);
      this.alarms.set(alarm.id, alarm);
    }
    
    return alarms;
  }

  private async simulateAcknowledgeAlarm(alarmId: string, acknowledgedBy: string): Promise<void> {
    console.log(`✅ Simulated SCADA acknowledge alarm: ${alarmId} by ${acknowledgedBy}`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async simulateDisconnect(): Promise<void> {
    console.log(`🔌 Simulated SCADA disconnect`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// SCADA Universal Manager with bulk operations
export class SCADAUniversalManager {
  private connections: Map<string, SCADAConnector> = new Map();
  private db: UniversalConnectorDB;

  constructor() {
    this.db = new UniversalConnectorDB();
  }

  // Create and manage connections
  async createConnection(id: string, config: ConnectionConfig, options: SCADAOptions): Promise<SCADAConnector> {
    const connector = new SCADAConnector(config, options);
    this.connections.set(id, connector);
    
    // Store in IndexedDB
    await this.db.saveConnectionConfig({
      id,
      name: config.name,
      type: 'scada',
      config: { ...config, scadaOptions: options },
      enabled: config.enabled,
      lastConnection: undefined,
      connectionStatus: 'disconnected',
      errorCount: 0,
      metadata: {
        protocol: options.protocol,
        host: options.host,
        port: options.port,
        systemType: 'SCADA'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('scada.manager.connection.created', { 
      connectionId: id,
      config,
      options,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<SCADAConnector | undefined> {
    return this.connections.get(id);
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(id);
      
      // Remove from IndexedDB
      await this.db.deleteConnectionConfig(id);
      
      globalEventBus.publish('scada.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, SCADAConnector>> {
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
      if (data.config && data.config.type === 'scada') {
        const connector = new SCADAConnector(data.config, data.config.scadaOptions || {});
        this.connections.set(id, connector);
        
        // Store in IndexedDB
        await this.db.saveConnectionConfig({
          id,
          name: data.config.name,
          type: 'scada',
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

// Global SCADA universal manager instance
export const globalSCADAUniversalManager = new SCADAUniversalManager();
