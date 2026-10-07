// Base connector class providing common functionality
// This class can be easily extended or replaced with backend services

import { 
  IConnector, 
  ConnectionConfig, 
  ConnectionStatus, 
  AuthenticationConfig,
  DataQualityMetrics,
  TransformConfig,
  FilterConfig
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
  protected transforms: TransformConfig[] = [];
  protected filters: FilterConfig[] = [];

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
      this.updateMetrics('read', endTime - startTime, true);
      
      return result;
    } catch (error) {
      this.updateMetrics('read', 0, false);
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
      this.updateMetrics('write', endTime - startTime, true);
      
      // Emit data change event
      this.emitEvent('dataChanged', { path, timestamp: new Date(), data });
    } catch (error) {
      this.updateMetrics('write', 0, false);
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
      this.updateMetrics('query', endTime - startTime, true);
      
      return result;
    } catch (error) {
      this.updateMetrics('query', 0, false);
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
    
    for (const [topic, subId] of Array.from(this.subscriptions.entries())) {
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

  // Transform and Filter Pipeline Management
  async addTransform(transform: TransformConfig): Promise<void> {
    this.transforms.push(transform);
    this.transforms.sort((a, b) => a.order - b.order);
    this.log('info', `Transform added: ${transform.name} (${transform.type})`);
  }

  async removeTransform(transformId: string): Promise<void> {
    const index = this.transforms.findIndex(t => t.id === transformId);
    if (index !== -1) {
      const removed = this.transforms.splice(index, 1)[0];
      this.log('info', `Transform removed: ${removed.name}`);
    }
  }

  async addFilter(filter: FilterConfig): Promise<void> {
    this.filters.push(filter);
    this.filters.sort((a, b) => a.order - b.order);
    this.log('info', `Filter added: ${filter.name} (${filter.type})`);
  }

  async removeFilter(filterId: string): Promise<void> {
    const index = this.filters.findIndex(f => f.id === filterId);
    if (index !== -1) {
      const removed = this.filters.splice(index, 1)[0];
      this.log('info', `Filter removed: ${removed.name}`);
    }
  }

  protected processDataThroughPipeline(data: any): any {
    let processedData = data;

    // Apply filters first
    for (const filter of this.filters) {
      if (filter.enabled) {
        try {
          processedData = this.applyFilter(processedData, filter);
        } catch (error) {
          this.log('error', `Filter ${filter.name} failed: ${error}`);
        }
      }
    }

    // Apply transforms
    for (const transform of this.transforms) {
      if (transform.enabled) {
        try {
          processedData = this.applyTransform(processedData, transform);
        } catch (error) {
          this.log('error', `Transform ${transform.name} failed: ${error}`);
        }
      }
    }

    return processedData;
  }

  private applyFilter(data: any, filter: FilterConfig): any {
    switch (filter.type) {
      case 'regex':
        if (typeof data === 'string') {
          const regex = new RegExp(filter.config.pattern, filter.config.flags || '');
          return regex.test(data) ? data : null;
        }
        return data;
      
      case 'range':
        if (typeof data === 'number') {
          const min = filter.config.min ?? -Infinity;
          const max = filter.config.max ?? Infinity;
          return (data >= min && data <= max) ? data : null;
        }
        return data;
      
      case 'custom':
        if (filter.config.filterFunction) {
          try {
            const fn = new Function('data', filter.config.filterFunction);
            return fn(data) ? data : null;
          } catch (error) {
            this.log('error', `Custom filter function error: ${error}`);
            return data;
          }
        }
        return data;
      
      default:
        return data;
    }
  }

  private applyTransform(data: any, transform: TransformConfig): any {
    switch (transform.type) {
      case 'math':
        if (typeof data === 'number') {
          const operation = transform.config.operation;
          const value = transform.config.value || 0;
          
          switch (operation) {
            case 'add': return data + value;
            case 'subtract': return data - value;
            case 'multiply': return data * value;
            case 'divide': return value !== 0 ? data / value : data;
            case 'power': return Math.pow(data, value);
            case 'sqrt': return Math.sqrt(data);
            case 'abs': return Math.abs(data);
            default: return data;
          }
        }
        return data;
      
      case 'string':
        if (typeof data === 'string') {
          const operation = transform.config.operation;
          const value = transform.config.value || '';
          
          switch (operation) {
            case 'uppercase': return data.toUpperCase();
            case 'lowercase': return data.toLowerCase();
            case 'trim': return data.trim();
            case 'replace': return data.replace(new RegExp(transform.config.pattern || '', 'g'), value);
            case 'substring': return data.substring(transform.config.start || 0, transform.config.end);
            case 'pad': return data.padStart(transform.config.length || data.length, value);
            default: return data;
          }
        }
        return data;
      
      case 'timestamp':
        if (data) {
          const operation = transform.config.operation;
          const date = new Date(data);
          
          switch (operation) {
            case 'toISO': return date.toISOString();
            case 'toUnix': return Math.floor(date.getTime() / 1000);
            case 'format': return date.toLocaleString(transform.config.locale || 'en-US');
            case 'addHours': return new Date(date.getTime() + (transform.config.value || 0) * 60 * 60 * 1000);
            case 'addDays': return new Date(date.getTime() + (transform.config.value || 0) * 24 * 60 * 60 * 1000);
            default: return data;
          }
        }
        return data;
      
      case 'custom':
        if (transform.config.transformFunction) {
          try {
            const fn = new Function('data', transform.config.transformFunction);
            return fn(data);
          } catch (error) {
            this.log('error', `Custom transform function error: ${error}`);
            return data;
          }
        }
        return data;
      
      default:
        return data;
    }
  }

  // Enhanced Metrics Collection
  protected updateMetrics(operation: string, duration: number, success: boolean): void {
    if (!this.metrics) {
      this.metrics = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        lastOperation: new Date(),
        operationHistory: [],
        errorHistory: []
      };
    }

    this.metrics.totalOperations++;
    this.metrics.totalResponseTime += duration;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalOperations;
    this.metrics.lastOperation = new Date();

    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }

    // Keep operation history (last 100 operations)
    this.metrics.operationHistory.push({
      timestamp: new Date(),
      operation,
      duration,
      success
    });

    if (this.metrics.operationHistory.length > 100) {
      this.metrics.operationHistory.shift();
    }
  }

  // Enhanced Health Monitoring
  protected updateHealthStatus(connected: boolean, error?: string): void {
    if (!this.healthData) {
      this.healthData = {
        connected: false,
        lastConnected: undefined,
        lastError: undefined,
        errorCount: 0,
        responseTime: 0,
        metadata: {}
      };
    }

    this.healthData.connected = connected;
    
    if (connected) {
      this.healthData.lastConnected = new Date();
      this.healthData.errorCount = 0;
      this.healthData.lastError = undefined;
    } else if (error) {
      this.healthData.lastError = error;
      this.healthData.errorCount++;
    }

    // Calculate health score
    const totalOperations = this.metrics?.totalOperations || 0;
    const successRate = totalOperations > 0 ? (this.metrics?.successfulOperations || 0) / totalOperations : 1;
    const avgResponseTime = this.metrics?.averageResponseTime || 0;
    
    this.healthData.metadata = {
      successRate: successRate * 100,
      averageResponseTime: avgResponseTime,
      uptime: this.healthData.lastConnected ? 
        Date.now() - this.healthData.lastConnected.getTime() : 0
    };
  }

  // Add missing methods
  protected log(level: 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${this.config.name}: ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  protected handleConnectionError(error: string): void {
    if (!this.status) {
      this.status = {
        connected: false,
        lastConnected: undefined,
        lastError: undefined,
        errorCount: 0,
        responseTime: 0,
        metadata: {}
      };
    }

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
    
    this.log('error', `Connection error: ${error}`);
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
