// Enhanced WebSocket Connector - Multi-protocol real-time streaming support
// This can be easily replaced with backend services later

import { globalEventBus } from '../events/EventBus';
import { IConnector, ConnectionConfig, ConnectionStatus, StreamConfig } from '../integrations/base/IConnector';

export interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  topic?: string;
  metadata?: Record<string, any>;
}

export interface WebSocketConfig extends ConnectionConfig {
  protocols?: string[];
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  maxMessageSize?: number;
  compression?: boolean;
  authentication?: {
    type: 'none' | 'token' | 'basic' | 'custom';
    token?: string;
    username?: string;
    password?: string;
    headers?: Record<string, string>;
  };
}

export interface WebSocketMetrics {
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  connectionTime: number;
  lastMessageTime?: Date;
  reconnectCount: number;
  errorCount: number;
  latency: number;
}

export interface WebSocketSubscription {
  id: string;
  topic: string;
  callback: (message: WebSocketMessage) => void;
  active: boolean;
  createdAt: Date;
  lastMessage?: Date;
  messageCount: number;
}

export class WebSocketConnector implements IConnector {
  private config: WebSocketConfig;
  private socket: WebSocket | null = null;
  private status: ConnectionStatus;
  private metrics: WebSocketMetrics;
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private messageQueue: WebSocketMessage[] = [];
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private messageIdCounter: number = 0;

  constructor(config: WebSocketConfig) {
    this.config = config;
    this.status = {
      connected: false,
      errorCount: 0,
      lastError: undefined,
      responseTime: undefined,
      metadata: {}
    };
    
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      connectionTime: 0,
      reconnectCount: 0,
      errorCount: 0,
      latency: 0
    };
  }

  // IConnector implementation
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.socket?.readyState === WebSocket.OPEN) {
      return true;
    }

    try {
      this.isConnecting = true;
      this.status.lastError = undefined;
      
      // Create WebSocket connection
      this.socket = new WebSocket(this.config.endpoint, this.config.protocols);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Wait for connection
      await this.waitForConnection();
      
      // Authenticate if needed
      if (this.config.authentication && this.config.authentication.type !== 'none') {
        await this.authenticate();
      }
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Process queued messages
      this.processMessageQueue();
      
      // Subscribe to existing subscriptions
      await this.resubscribeAll();
      
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.metrics.connectionTime = Date.now();
      
      globalEventBus.publish('websocket.connected', { 
        endpoint: this.config.endpoint,
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      this.isConnecting = false;
      this.handleConnectionError(error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      this.stopHeartbeat();
      this.clearReconnectTimer();
      
      if (this.socket) {
        this.socket.close(1000, 'Normal closure');
        this.socket = null;
      }
      
      this.status.connected = false;
      this.status.lastConnected = undefined;
      
      globalEventBus.publish('websocket.disconnected', { 
        endpoint: this.config.endpoint,
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      this.handleConnectionError(error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<WebSocketConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Reconnect if currently connected
    if (this.isConnected()) {
      await this.disconnect();
      await this.connect();
    }
  }

  async validateConfig(config: ConnectionConfig): Promise<boolean> {
    try {
      const url = new URL(config.endpoint);
      return url.protocol === 'ws:' || url.protocol === 'wss:';
    } catch {
      return false;
    }
  }

  async read(path: string, options?: Record<string, any>): Promise<any> {
    // WebSocket doesn't support direct read operations
    // This would need to be implemented as a request-response pattern
    throw new Error('WebSocket does not support direct read operations');
  }

  async write(path: string, data: any, options?: Record<string, any>): Promise<void> {
    await this.publish(path, data);
  }

  async query(query: string, options?: Record<string, any>): Promise<any[]> {
    // WebSocket doesn't support direct query operations
    // This would need to be implemented as a request-response pattern
    throw new Error('WebSocket does not support direct query operations');
  }

  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: WebSocketSubscription = {
      id: subscriptionId,
      topic,
      callback,
      active: true,
      createdAt: new Date(),
      messageCount: 0
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Send subscription message if connected
    if (this.isConnected()) {
      await this.sendMessage({
        id: this.generateMessageId(),
        type: 'subscribe',
        data: { topic },
        timestamp: new Date()
      });
    }
    
    globalEventBus.publish('websocket.subscription.created', { 
      subscriptionId, 
      topic,
      timestamp: new Date()
    });
    
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }
    
    subscription.active = false;
    this.subscriptions.delete(subscriptionId);
    
    // Send unsubscribe message if connected
    if (this.isConnected()) {
      await this.sendMessage({
        id: this.generateMessageId(),
        type: 'unsubscribe',
        data: { topic: subscription.topic },
        timestamp: new Date()
      });
    }
    
    globalEventBus.publish('websocket.subscription.removed', { 
      subscriptionId, 
      topic: subscription.topic,
      timestamp: new Date()
    });
  }

  async publish(topic: string, data: any): Promise<void> {
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type: 'publish',
      data,
      timestamp: new Date(),
      topic,
      metadata: {
        source: 'websocket_connector'
      }
    };
    
    if (this.isConnected()) {
      await this.sendMessage(message);
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  async getDataQuality(): Promise<any> {
    // WebSocket data quality metrics
    return {
      completeness: this.metrics.messagesReceived > 0 ? 100 : 0,
      accuracy: 100 - (this.metrics.errorCount / Math.max(this.metrics.messagesReceived, 1)) * 100,
      timeliness: this.metrics.latency,
      validity: 100,
      consistency: 100,
      lastUpdated: new Date()
    };
  }

  async getMetrics(): Promise<Record<string, any>> {
    return {
      ...this.metrics,
      subscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(s => s.active).length,
      queuedMessages: this.messageQueue.length
    };
  }

  async getHealth(): Promise<Record<string, any>> {
    const isHealthy = this.isConnected() && this.metrics.errorCount < 10;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      connected: this.isConnected(),
      lastError: this.status.lastError,
      errorCount: this.metrics.errorCount,
      reconnectCount: this.metrics.reconnectCount,
      latency: this.metrics.latency,
      timestamp: new Date()
    };
  }

  async initialize(): Promise<void> {
    // WebSocket connector is ready to use immediately
    return;
  }

  // WebSocket specific methods

  async sendMessage(message: WebSocketMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }
    
    try {
      const messageStr = JSON.stringify(message);
      const messageSize = new Blob([messageStr]).size;
      
      if (this.config.maxMessageSize && messageSize > this.config.maxMessageSize) {
        throw new Error(`Message size ${messageSize} exceeds maximum allowed size ${this.config.maxMessageSize}`);
      }
      
      this.socket!.send(messageStr);
      
      this.metrics.messagesSent++;
      this.metrics.bytesSent += messageSize;
      
      globalEventBus.publish('websocket.message.sent', { 
        messageId: message.id,
        topic: message.topic,
        size: messageSize,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.metrics.errorCount++;
      this.handleConnectionError(error);
      throw error;
    }
  }

  async sendBinary(data: ArrayBuffer | Blob): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }
    
    try {
      this.socket!.send(data);
      
      const dataSize = data instanceof ArrayBuffer ? data.byteLength : data.size;
      this.metrics.messagesSent++;
      this.metrics.bytesSent += dataSize;
      
    } catch (error) {
      this.metrics.errorCount++;
      this.handleConnectionError(error);
      throw error;
    }
  }

  // Private methods

  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    this.socket.onopen = () => {
      this.status.connected = true;
      this.status.lastConnected = new Date();
      this.status.errorCount = 0;
      
      globalEventBus.publish('websocket.connection.opened', { 
        endpoint: this.config.endpoint,
        timestamp: new Date()
      });
    };
    
    this.socket.onmessage = (event) => {
      this.handleMessage(event);
    };
    
    this.socket.onclose = (event) => {
      this.handleClose(event);
    };
    
    this.socket.onerror = (event) => {
      this.handleError(event);
    };
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket not initialized'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout
      
      this.socket!.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      this.socket!.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.config.authentication || this.config.authentication.type === 'none') {
      return;
    }
    
    const authMessage: WebSocketMessage = {
      id: this.generateMessageId(),
      type: 'authenticate',
      data: this.config.authentication,
      timestamp: new Date()
    };
    
    await this.sendMessage(authMessage);
    
    // Wait for authentication response
    // This is a simplified implementation - in production, you'd want proper response handling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private handleMessage(event: MessageEvent): void {
    try {
      let message: WebSocketMessage;
      
      if (typeof event.data === 'string') {
        message = JSON.parse(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        // Handle binary messages
        const decoder = new TextDecoder();
        const text = decoder.decode(event.data);
        message = JSON.parse(text);
      } else {
        throw new Error('Unsupported message format');
      }
      // ArrayBuffer has no `length`, so binary frames have always counted as 0 bytes here.
      const receivedSize = typeof event.data === 'string' ? event.data.length : 0;

      // Update metrics
      this.metrics.messagesReceived++;
      this.metrics.bytesReceived += receivedSize;
      this.metrics.lastMessageTime = new Date();
      
      // Calculate latency if message has an ID
      if (message.id) {
        // This is a simplified latency calculation
        this.metrics.latency = Date.now() - message.timestamp.getTime();
      }
      
      // Route message to appropriate subscriptions
      this.routeMessage(message);
      
      globalEventBus.publish('websocket.message.received', { 
        messageId: message.id,
        topic: message.topic,
        size: receivedSize,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.metrics.errorCount++;
      this.handleConnectionError(error);
    }
  }

  private routeMessage(message: WebSocketMessage): void {
    // Route to topic-based subscriptions
    if (message.topic) {
      for (const subscription of this.subscriptions.values()) {
        if (subscription.active && subscription.topic === message.topic) {
          try {
            subscription.callback(message.data);
            subscription.lastMessage = new Date();
            subscription.messageCount++;
          } catch (error) {
            console.error('Error in subscription callback:', error);
          }
        }
      }
    }
    
    // Route system messages
    if (message.type === 'system') {
      globalEventBus.publish(`websocket.system.${message.data?.action || 'message'}`, {
        data: message.data,
        timestamp: new Date()
      });
    }
  }

  private handleClose(event: CloseEvent): void {
    this.status.connected = false;
    this.status.lastConnected = undefined;
    
    globalEventBus.publish('websocket.connection.closed', { 
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      timestamp: new Date()
    });
    
    // Attempt reconnection if not a clean close
    if (!event.wasClean && this.config.reconnectAttempts !== 0) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    this.status.errorCount++;
    this.status.lastError = 'WebSocket error occurred';
    
    globalEventBus.publish('websocket.error', { 
      error: event,
      timestamp: new Date()
    });
  }

  private handleConnectionError(error: any): void {
    this.status.errorCount++;
    this.status.lastError = error?.message || 'Unknown connection error';
    
    globalEventBus.publish('websocket.connection.error', { 
      error: error?.message || error,
      timestamp: new Date()
    });
    
    // Schedule reconnection
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.reconnectAttempts >= (this.config.reconnectAttempts || 5)) {
      return;
    }
    
    const delay = (this.config.reconnectDelay || 1000) * Math.pow(2, this.reconnectAttempts);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      this.metrics.reconnectCount++;
      
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
      
      this.reconnectTimer = undefined;
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return;
    
    this.heartbeatTimer = setInterval(async () => {
      if (this.isConnected()) {
        try {
          await this.sendMessage({
            id: this.generateMessageId(),
            type: 'ping',
            data: { timestamp: Date.now() },
            timestamp: new Date()
          });
        } catch (error) {
          console.warn('Heartbeat failed:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message).catch(error => {
          console.error('Failed to send queued message:', error);
        });
      }
    }
  }

  private async resubscribeAll(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.active) {
        await this.sendMessage({
          id: this.generateMessageId(),
          type: 'subscribe',
          data: { topic: subscription.topic },
          timestamp: new Date()
        });
      }
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  // Cleanup
  async destroy(): Promise<void> {
    this.disconnect();
    this.subscriptions.clear();
    this.messageQueue = [];
    this.clearReconnectTimer();
    this.stopHeartbeat();
  }

  // Same lifecycle as BaseConnector.reset: tear down, re-initialise, reconnect if enabled.
  async reset(): Promise<void> {
    await this.destroy();
    await this.initialize();
    if (this.config.enabled) {
      await this.connect();
    }
  }
}

// WebSocket Manager for handling multiple connections
export class WebSocketManager {
  private connections: Map<string, WebSocketConnector> = new Map();
  private defaultConfig: Partial<WebSocketConfig> = {
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    maxMessageSize: 1024 * 1024, // 1MB
    compression: false
  };

  createConnection(id: string, config: WebSocketConfig): WebSocketConnector {
    const fullConfig = { ...this.defaultConfig, ...config };
    const connector = new WebSocketConnector(fullConfig);
    
    this.connections.set(id, connector);
    
    globalEventBus.publish('websocket.manager.connection.created', { 
      connectionId: id,
      config: fullConfig,
      timestamp: new Date()
    });
    
    return connector;
  }

  getConnection(id: string): WebSocketConnector | undefined {
    return this.connections.get(id);
  }

  removeConnection(id: string): boolean {
    const connection = this.connections.get(id);
    if (connection) {
      connection.destroy();
      this.connections.delete(id);
      
      globalEventBus.publish('websocket.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  getAllConnections(): Map<string, WebSocketConnector> {
    return new Map(this.connections);
  }

  getConnectionStatus(): Record<string, ConnectionStatus> {
    const status: Record<string, ConnectionStatus> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      status[id] = connection.getStatus();
    }
    
    return status;
  }

  destroy(): void {
    for (const connection of this.connections.values()) {
      connection.destroy();
    }
    this.connections.clear();
  }
}

// Global WebSocket manager instance
export const globalWebSocketManager = new WebSocketManager();
