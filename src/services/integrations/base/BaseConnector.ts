// Base connector class providing common functionality
// This class can be easily extended or replaced with backend services

import { 
  IConnector, 
  ConnectionConfig, 
  ConnectionStatus, 
  AuthenticationConfig,
  DataQualityMetrics 
} from './IConnector';

export abstract class BaseConnector implements IConnector {
  protected config: ConnectionConfig;
  protected status: ConnectionStatus;
  protected connected: boolean = false;
  protected eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  protected subscriptions: Map<string, string> = new Map(); // topic -> subscriptionId
  protected metrics: Record<string, any> = {};
  protected healthData: Record<string, any> = {};
  protected dataQuality: DataQualityMetrics;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.status = {
      connected: false,
      errorCount: 0,
      lastError: undefined,
      lastConnected: undefined,
      responseTime: undefined,
      metadata: {}
    };
    
    // Initialize default data quality metrics
    this.dataQuality = {
      completeness: 100,
      accuracy: 100,
      timeliness: 100,
      validity: 100,
      consistency: 100,
      lastUpdated: new Date()
    };
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract performConnect(): Promise<boolean>;
  protected abstract performDisconnect(): Promise<boolean>;
  protected abstract performRead(path: string, options?: Record<string, any>): Promise<any>;
  protected abstract performWrite(path: string, data: any, options?: Record<string, any>): Promise<void>;
  protected abstract performQuery(query: string, options?: Record<string, any>): Promise<any[]>;

  // Connection management with error handling and metrics
  async connect(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const success = await this.performConnect();
      const endTime = Date.now();
      
      if (success) {
        this.connected = true;
        this.status.connected = true;
        this.status.lastConnected = new Date();
        this.status.responseTime = endTime - startTime;
        this.status.errorCount = 0;
        this.status.lastError = undefined;
        
        // Emit connection event
        this.emitEvent('connected', { timestamp: new Date(), responseTime: this.status.responseTime });
        
        console.log(`✅ Connected to ${this.config.name} in ${this.status.responseTime}ms`);
      } else {
        this.handleConnectionError('Connection failed');
      }
      
      return success;
    } catch (error) {
      this.handleConnectionError(error instanceof Error ? error.message : 'Unknown connection error');
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      const success = await this.performDisconnect();
      
      if (success) {
        this.connected = false;
        this.status.connected = false;
        
        // Emit disconnection event
        this.emitEvent('disconnected', { timestamp: new Date() });
        
        console.log(`🔌 Disconnected from ${this.config.name}`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Error disconnecting from ${this.config.name}:`, error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.status.connected;
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  // Configuration management
  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<ConnectionConfig>): Promise<void> {
    // Validate configuration before updating
    const newConfig = { ...this.config, ...config };
    const isValid = await this.validateConfig(newConfig);
    
    if (!isValid) {
      throw new Error('Invalid configuration');
    }

    // If we're currently connected, we might need to reconnect
    const wasConnected = this.isConnected();
    if (wasConnected) {
      await this.disconnect();
    }

    this.config = newConfig;

    if (wasConnected) {
      await this.connect();
    }

    // Emit configuration change event
    this.emitEvent('configChanged', { timestamp: new Date(), config: this.config });
  }

  async validateConfig(config: ConnectionConfig): Promise<boolean> {
    // Basic validation
    if (!config.name || !config.endpoint) {
      return false;
    }

    // Validate authentication if present
    if (config.authentication) {
      const authValid = this.validateAuthentication(config.authentication);
      if (!authValid) {
        return false;
      }
    }

    // Subclasses can override this for additional validation
    return true;
  }

  protected validateAuthentication(auth: AuthenticationConfig): boolean {
    switch (auth.type) {
      case 'basic':
        return !!(auth.username && auth.password);
      case 'api-key':
        return !!auth.apiKey;
      case 'bearer':
        return !!auth.apiKey;
      case 'oauth':
        return !!(auth.clientId && auth.clientSecret && auth.tokenEndpoint);
      case 'certificate':
        return !!(auth.certificate && auth.privateKey);
      case 'none':
        return true;
      default:
        return false;
    }
  }

  // Data operations with error handling
  async read(path: string, options?: Record<string, any>): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    try {
      const startTime = Date.now();
      const result = await this.performRead(path, options);
      const endTime = Date.now();
      
      // Update metrics
      this.updateMetrics('read', { path, responseTime: endTime - startTime, success: true });
      
      return result;
    } catch (error) {
      this.updateMetrics('read', { path, responseTime: 0, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  async write(path: string, data: any, options?: Record<string, any>): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    try {
      const startTime = Date.now();
      await this.performWrite(path, data, options);
      const endTime = Date.now();
      
      // Update metrics
      this.updateMetrics('write', { path, responseTime: endTime - startTime, success: true });
      
      // Emit data change event
      this.emitEvent('dataChanged', { path, timestamp: new Date(), data });
    } catch (error) {
      this.updateMetrics('write', { path, responseTime: 0, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  async query(query: string, options?: Record<string, any>): Promise<any[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    try {
      const startTime = Date.now();
      const result = await this.performQuery(query, options);
      const endTime = Date.now();
      
      // Update metrics
      this.updateMetrics('query', { query, responseTime: endTime - startTime, success: true, resultCount: result.length });
      
      return result;
    } catch (error) {
      this.updateMetrics('query', { query, responseTime: 0, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Streaming operations with local event handling
  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.eventHandlers.has(topic)) {
      this.eventHandlers.set(topic, new Set());
    }
    
    this.eventHandlers.get(topic)!.add(callback);
    this.subscriptions.set(topic, subscriptionId);
    
    // Emit subscription event
    this.emitEvent('subscribed', { topic, subscriptionId, timestamp: new Date() });
    
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    // Find the topic for this subscription
    let topicToRemove: string | undefined;
    
    for (const [topic, subId] of this.subscriptions.entries()) {
      if (subId === subscriptionId) {
        topicToRemove = topic;
        break;
      }
    }
    
    if (topicToRemove) {
      this.subscriptions.delete(topicToRemove);
      
      // Remove all handlers for this topic
      if (this.eventHandlers.has(topicToRemove)) {
        this.eventHandlers.delete(topicToRemove);
      }
      
      // Emit unsubscription event
      this.emitEvent('unsubscribed', { topic: topicToRemove, subscriptionId, timestamp: new Date() });
    }
  }

  async publish(topic: string, data: any): Promise<void> {
    // Emit the event locally
    this.emitEvent(topic, data);
    
    // Subclasses can override this to implement actual publishing
    console.log(`📡 Published to ${topic}:`, data);
  }

  // Data quality and monitoring
  async getDataQuality(): Promise<DataQualityMetrics> {
    return { ...this.dataQuality };
  }

  async getMetrics(): Promise<Record<string, any>> {
    return { ...this.metrics };
  }

  async getHealth(): Promise<Record<string, any>> {
    return {
      connected: this.isConnected(),
      status: this.getStatus(),
      dataQuality: await this.getDataQuality(),
      metrics: await this.getMetrics(),
      timestamp: new Date(),
      ...this.healthData
    };
  }

  // Lifecycle management
  async initialize(): Promise<void> {
    // Subclasses can override this for initialization logic
    console.log(`🔧 Initializing ${this.config.name}`);
  }

  async destroy(): Promise<void> {
    // Clean up resources
    if (this.isConnected()) {
      await this.disconnect();
    }
    
    this.eventHandlers.clear();
    this.subscriptions.clear();
    
    console.log(`🗑️ Destroyed ${this.config.name}`);
  }

  async reset(): Promise<void> {
    await this.destroy();
    await this.initialize();
    
    if (this.config.enabled) {
      await this.connect();
    }
  }

  // Protected helper methods
  protected emitEvent(topic: string, data: any): void {
    if (this.eventHandlers.has(topic)) {
      this.eventHandlers.get(topic)!.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${topic}:`, error);
        }
      });
    }
  }

  protected updateMetrics(operation: string, data: Record<string, any>): void {
    if (!this.metrics[operation]) {
      this.metrics[operation] = [];
    }
    
    this.metrics[operation].push({
      ...data,
      timestamp: new Date()
    });
    
    // Keep only last 100 metrics per operation
    if (this.metrics[operation].length > 100) {
      this.metrics[operation] = this.metrics[operation].slice(-100);
    }
  }

  protected handleConnectionError(error: string): void {
    this.status.errorCount++;
    this.status.lastError = error;
    this.status.connected = false;
    this.connected = false;
    
    // Emit error event
    this.emitEvent('error', { 
      timestamp: new Date(), 
      error, 
      errorCount: this.status.errorCount 
    });
    
    console.error(`❌ Connection error for ${this.config.name}:`, error);
  }

  protected updateDataQuality(metrics: Partial<DataQualityMetrics>): void {
    this.dataQuality = {
      ...this.dataQuality,
      ...metrics,
      lastUpdated: new Date()
    };
  }

  protected updateHealthData(data: Record<string, any>): void {
    this.healthData = {
      ...this.healthData,
      ...data,
      lastUpdated: new Date()
    };
  }

  // Utility methods
  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }
    
    if (this.config.authentication) {
      const auth = this.config.authentication;
      
      switch (auth.type) {
        case 'basic':
          if (auth.username && auth.password) {
            headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
          }
          break;
        case 'api-key':
          if (auth.apiKey) {
            headers['X-API-Key'] = auth.apiKey;
          }
          break;
        case 'bearer':
          if (auth.apiKey) {
            headers['Authorization'] = `Bearer ${auth.apiKey}`;
          }
          break;
      }
    }
    
    return headers;
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError!;
  }
}
