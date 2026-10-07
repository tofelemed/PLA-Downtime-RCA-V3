// MQTT Connector for real-time messaging
// This can be easily replaced with backend services later

import { 
  IStreamingConnector, 
  ConnectionConfig, 
  StreamConfig, 
  TransformConfig, 
  FilterConfig 
} from '../integrations/base/IConnector';
import { BaseConnector } from '../integrations/base/BaseConnector';
import { globalEventBus } from '../events/EventBus';

export interface MQTTOptions {
  clientId?: string;
  username?: string;
  password?: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  clean?: boolean;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  will?: {
    topic: string;
    payload: string;
    qos: 0 | 1 | 2;
    retain: boolean;
  };
}

export interface MQTTMessage {
  topic: string;
  payload: string | Buffer;
  qos: number;
  retain: boolean;
  dup: boolean;
  messageId?: number;
  metadata?: Record<string, any>;
}

export interface MQTTSubscription {
  topic: string;
  qos: number;
  callback: (message: MQTTMessage) => void;
}

export class MQTTConnector extends BaseConnector implements IStreamingConnector {
  private mqttClient: any = null; // Will be replaced with actual MQTT client
  private mqttOptions: MQTTOptions;
  private activeStreams: Set<string> = new Set();
  protected transforms: TransformConfig[] = [];
  protected filters: FilterConfig[] = [];
  private mqttSubscriptions: Map<string, MQTTSubscription> = new Map();
  private messageBuffer: MQTTMessage[] = [];
  private bufferSize: number = 1000;
  private streamingActive: boolean = false;

  constructor(config: ConnectionConfig, mqttOptions: MQTTOptions = {}) {
    super(config);
    
    this.mqttOptions = {
      clientId: `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
      clean: true,
      qos: 1,
      retain: false,
      ...mqttOptions
    };

    // Override authentication if provided in MQTT options
    if (mqttOptions.username && mqttOptions.password) {
      this.config.authentication = {
        type: 'basic',
        username: mqttOptions.username,
        password: mqttOptions.password
      };
    }
  }

  // Abstract method implementations
  protected async performConnect(): Promise<boolean> {
    try {
      // In a real implementation, this would create an MQTT client
      // For now, we'll simulate the connection
      console.log(`🔌 Connecting to MQTT broker: ${this.config.endpoint}`);
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful connection
      this.mqttClient = {
        connected: true,
        publish: this.simulatePublish.bind(this),
        subscribe: this.simulateSubscribe.bind(this),
        unsubscribe: this.simulateUnsubscribe.bind(this),
        end: this.simulateEnd.bind(this)
      };

      console.log(`✅ Connected to MQTT broker: ${this.config.endpoint}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to MQTT broker:`, error);
      return false;
    }
  }

  protected async performDisconnect(): Promise<boolean> {
    try {
      if (this.mqttClient) {
        await this.mqttClient.end();
        this.mqttClient = null;
      }
      
      // Stop all streaming
      await this.stopStreaming();
      
      console.log(`🔌 Disconnected from MQTT broker: ${this.config.endpoint}`);
      return true;
    } catch (error) {
      console.error(`❌ Error disconnecting from MQTT broker:`, error);
      return false;
    }
  }

  protected async performRead(path: string, options?: Record<string, any>): Promise<any> {
    // For MQTT, reading typically means subscribing to a topic and waiting for messages
    // This is a simplified implementation
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MQTT read timeout'));
      }, options?.timeout || 5000);

      // Subscribe to the topic temporarily
      this.subscribe(path, (message) => {
        clearTimeout(timeout);
        resolve(message);
      }).then(() => {
        // Unsubscribe after receiving the message
        setTimeout(() => {
          // Clean up subscription
        }, 1000);
      });
    });
  }

  protected async performWrite(path: string, data: any, options?: Record<string, any>): Promise<void> {
    if (!this.mqttClient) {
      throw new Error('Not connected to MQTT broker');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    const qos = options?.qos || this.mqttOptions.qos || 1;
    const retain = options?.retain || this.mqttOptions.retain || false;

    await this.mqttClient.publish(path, message, { qos, retain });
  }

  protected async performQuery(query: string, options?: Record<string, any>): Promise<any[]> {
    // MQTT doesn't support traditional queries, but we can implement pattern-based subscriptions
    const pattern = query; // Treat query as topic pattern
    const results: any[] = [];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(results);
      }, options?.timeout || 5000);

      const subscription = this.subscribe(pattern, (message) => {
        results.push(message);
        
        if (options?.maxResults && results.length >= options.maxResults) {
          clearTimeout(timeout);
          resolve(results);
        }
      });
    });
  }

  // Streaming connector implementation
  async startStreaming(config: StreamConfig): Promise<void> {
    if (this.streamingActive) {
      throw new Error('Streaming is already active');
    }

    if (!this.isConnected()) {
      throw new Error('Not connected to MQTT broker');
    }

    this.streamingActive = true;
    console.log(`🚀 Starting MQTT streaming for ${this.config.name}`);

    // Start processing message buffer
    this.startMessageProcessing();

    // Emit streaming started event
    globalEventBus.publish('mqtt.streaming.started', {
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
    console.log(`🛑 Stopped MQTT streaming for ${this.config.name}`);

    // Emit streaming stopped event
    globalEventBus.publish('mqtt.streaming.stopped', {
      connectorId: this.config.id,
      connectorName: this.config.name,
      timestamp: new Date()
    });
  }

  isStreaming(): boolean {
    return this.streamingActive;
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams);
  }

  async pauseStream(streamId: string): Promise<void> {
    if (this.activeStreams.has(streamId)) {
      this.activeStreams.delete(streamId);
      console.log(`⏸️ Paused stream: ${streamId}`);
    }
  }

  async resumeStream(streamId: string): Promise<void> {
    if (!this.activeStreams.has(streamId)) {
      this.activeStreams.add(streamId);
      console.log(`▶️ Resumed stream: ${streamId}`);
    }
  }

  // Transform pipeline
  async addTransform(transform: TransformConfig): Promise<void> {
    this.transforms.push(transform);
    // Sort by order
    this.transforms.sort((a, b) => a.order - b.order);
    
    console.log(`🔧 Added transform: ${transform.name}`);
  }

  async removeTransform(transformId: string): Promise<void> {
    this.transforms = this.transforms.filter(t => t.id !== transformId);
    console.log(`🗑️ Removed transform: ${transformId}`);
  }

  getTransforms(): TransformConfig[] {
    return [...this.transforms];
  }

  // Filter pipeline
  async addFilter(filter: FilterConfig): Promise<void> {
    this.filters.push(filter);
    // Sort by order
    this.filters.sort((a, b) => a.order - b.order);
    
    console.log(`🔍 Added filter: ${filter.name}`);
  }

  async removeFilter(filterId: string): Promise<void> {
    this.filters = this.filters.filter(f => f.id !== filterId);
    console.log(`🗑️ Removed filter: ${filterId}`);
  }

  getFilters(): FilterConfig[] {
    return [...this.filters];
  }

  // Enhanced MQTT-specific methods
  async subscribe(topic: string, callback: (message: MQTTMessage) => void, qos: number = 1): Promise<string> {
    if (!this.mqttClient) {
      throw new Error('Not connected to MQTT broker');
    }

    const subscription: MQTTSubscription = {
      topic,
      qos,
      callback
    };

    const subscriptionId = `mqtt_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.mqttSubscriptions.set(subscriptionId, subscription);

    // Subscribe to the topic
    await this.mqttClient.subscribe(topic, { qos });

    console.log(`📡 Subscribed to MQTT topic: ${topic} (QoS: ${qos})`);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.mqttSubscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Unsubscribe from the topic
    await this.mqttClient.unsubscribe(subscription.topic);
    this.mqttSubscriptions.delete(subscriptionId);

    console.log(`🔌 Unsubscribed from MQTT topic: ${subscription.topic}`);
  }

  async publish(topic: string, message: string | Buffer, options?: { qos?: number; retain?: boolean }): Promise<void> {
    if (!this.mqttClient) {
      throw new Error('Not connected to MQTT broker');
    }

    const qos = options?.qos || this.mqttOptions.qos || 1;
    const retain = options?.retain || this.mqttOptions.retain || false;

    await this.mqttClient.publish(topic, message, { qos, retain });
    
    // Emit publish event
    globalEventBus.publish('mqtt.message.published', {
      topic,
      message: typeof message === 'string' ? message : message.toString(),
      qos,
      retain,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  // Message processing pipeline
  private startMessageProcessing(): void {
    // Process messages in the background
    setInterval(() => {
      if (this.streamingActive && this.messageBuffer.length > 0) {
        this.processMessageBuffer();
      }
    }, 100); // Process every 100ms
  }

  private processMessageBuffer(): void {
    while (this.messageBuffer.length > 0) {
      const message = this.messageBuffer.shift();
      if (message) {
        this.processMessage(message);
      }
    }
  }

  private processMessage(message: MQTTMessage): void {
    try {
      // Apply filters
      let shouldProcess = this.applyFilters(message);
      if (!shouldProcess) {
        return;
      }

      // Apply transforms
      let processedMessage = this.applyTransforms(message);

      // Emit processed message event
      globalEventBus.publish('mqtt.message.processed', {
        originalMessage: message,
        processedMessage,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      // Notify subscribers
      this.notifySubscribers(message.topic, processedMessage);

    } catch (error) {
      console.error('Error processing MQTT message:', error);
      
      // Emit error event
      globalEventBus.publish('mqtt.message.error', {
        message,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        connectorId: this.config.id
      });
    }
  }

  private applyFilters(message: MQTTMessage): boolean {
    for (const filter of this.filters) {
      if (!filter.enabled) continue;

      try {
        switch (filter.type) {
          case 'topic':
            if (!this.matchesTopicPattern(message.topic, filter.config.pattern)) {
              return false;
            }
            break;
          case 'payload':
            if (!this.matchesPayloadFilter(message.payload, filter.config.condition)) {
              return false;
            }
            break;
          case 'qos':
            if (message.qos !== filter.config.qos) {
              return false;
            }
            break;
        }
      } catch (error) {
        console.error(`Error applying filter ${filter.name}:`, error);
      }
    }

    return true;
  }

  private applyTransforms(message: MQTTMessage): MQTTMessage {
    let transformedMessage = { ...message };

    for (const transform of this.transforms) {
      if (!transform.enabled) continue;

      try {
        switch (transform.type) {
          case 'payload':
            transformedMessage.payload = this.transformPayload(message.payload, transform.config);
            break;
          case 'topic':
            transformedMessage.topic = this.transformTopic(message.topic, transform.config);
            break;
          case 'enrich':
            transformedMessage = this.enrichMessage(transformedMessage, transform.config);
            break;
        }
      } catch (error) {
        console.error(`Error applying transform ${transform.name}:`, error);
      }
    }

    return transformedMessage;
  }

  private matchesTopicPattern(topic: string, pattern: string): boolean {
    // Simple wildcard matching for MQTT topics
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/#/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  private matchesPayloadFilter(payload: string | Buffer, condition: any): boolean {
    // Simple payload filtering
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();
    
    if (condition.type === 'contains') {
      return payloadStr.includes(condition.value);
    } else if (condition.type === 'regex') {
      const regex = new RegExp(condition.value);
      return regex.test(payloadStr);
    }
    
    return true;
  }

  private transformPayload(payload: string | Buffer, config: any): string | Buffer {
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();
    
    switch (config.operation) {
      case 'uppercase':
        return payloadStr.toUpperCase();
      case 'lowercase':
        return payloadStr.toLowerCase();
      case 'trim':
        return payloadStr.trim();
      case 'replace':
        return payloadStr.replace(new RegExp(config.search, 'g'), config.replace);
      default:
        return payload;
    }
  }

  private transformTopic(topic: string, config: any): string {
    switch (config.operation) {
      case 'prefix':
        return `${config.value}${topic}`;
      case 'suffix':
        return `${topic}${config.value}`;
      case 'replace':
        return topic.replace(new RegExp(config.search, 'g'), config.replace);
      default:
        return topic;
    }
  }

  private enrichMessage(message: MQTTMessage, config: any): MQTTMessage {
    const enriched = { ...message };
    
    if (config.metadata) {
      enriched.metadata = {
        ...enriched.metadata,
        ...config.metadata
      };
    }
    
    if (config.timestamp) {
      enriched.metadata = {
        ...enriched.metadata,
        processedAt: new Date().toISOString()
      };
    }
    
    return enriched;
  }

  private notifySubscribers(topic: string, message: MQTTMessage): void {
    for (const [subscriptionId, subscription] of this.mqttSubscriptions.entries()) {
      if (this.matchesTopicPattern(topic, subscription.topic)) {
        try {
          subscription.callback(message);
        } catch (error) {
          console.error(`Error in MQTT subscription callback ${subscriptionId}:`, error);
        }
      }
    }
  }

  // Simulation methods for development/testing
  private async simulatePublish(topic: string, message: string | Buffer, options?: any): Promise<void> {
    console.log(`📤 Simulated MQTT publish: ${topic} -> ${message}`);
    
    // Simulate message delivery to subscribers
    setTimeout(() => {
      const mqttMessage: MQTTMessage = {
        topic,
        payload: message,
        qos: options?.qos || 1,
        retain: options?.retain || false,
        dup: false
      };
      
      this.messageBuffer.push(mqttMessage);
    }, Math.random() * 100); // Random delay
  }

  private async simulateSubscribe(topic: string, options?: any): Promise<void> {
    console.log(`📡 Simulated MQTT subscribe: ${topic}`);
  }

  private async simulateUnsubscribe(topic: string): Promise<void> {
    console.log(`🔌 Simulated MQTT unsubscribe: ${topic}`);
  }

  private async simulateEnd(): Promise<void> {
    console.log(`🔌 Simulated MQTT disconnect`);
  }

  // Override base methods for MQTT-specific behavior
  async getHealth(): Promise<Record<string, any>> {
    const baseHealth = await super.getHealth();
    
    return {
      ...baseHealth,
      mqtt: {
        clientId: this.mqttOptions.clientId,
        isStreaming: this.streamingActive,
        activeStreams: this.getActiveStreams(),
        activeSubscriptions: this.mqttSubscriptions.size,
        messageBufferSize: this.messageBuffer.length,
        transforms: this.transforms.length,
        filters: this.filters.length
      }
    };
  }
}

// MQTT Manager for handling multiple connections
export class MQTTManager {
  private connections: Map<string, MQTTConnector> = new Map();

  createConnection(id: string, config: ConnectionConfig, options?: MQTTOptions): MQTTConnector {
    const connector = new MQTTConnector(config, options);
    this.connections.set(id, connector);
    
    globalEventBus.publish('mqtt.manager.connection.created', { 
      connectionId: id,
      config,
      options,
      timestamp: new Date()
    });
    
    return connector;
  }

  getConnection(id: string): MQTTConnector | undefined {
    return this.connections.get(id);
  }

  removeConnection(id: string): boolean {
    const connection = this.connections.get(id);
    if (connection) {
      connection.destroy();
      this.connections.delete(id);
      
      globalEventBus.publish('mqtt.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  getAllConnections(): Map<string, MQTTConnector> {
    return new Map(this.connections);
  }

  destroy(): void {
    for (const connection of this.connections.values()) {
      connection.destroy();
    }
    this.connections.clear();
  }
}

// Global MQTT manager instance
export const globalMQTTManager = new MQTTManager();
