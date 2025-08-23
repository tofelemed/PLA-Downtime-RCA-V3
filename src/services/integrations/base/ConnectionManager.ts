// Connection Manager for orchestrating all Universal Integration connectors
// This can be easily replaced with backend services later

import { 
  IConnector, 
  ConnectionConfig, 
  ConnectionStatus,
  isStreamingConnector,
  isBatchConnector,
  isHistoricalConnector,
  isAlarmConnector
} from './IConnector';
import { globalEventBus } from '../events/EventBus';
import { globalConfigManager, IntegrationConfig } from '../../config/IntegrationConfigManager';
import { globalStreamProcessor } from '../../streaming/StreamProcessor';

export interface ConnectionManagerConfig {
  maxConnections: number;
  autoReconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  healthCheckInterval: number;
  enableMetrics: boolean;
  enableLogging: boolean;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  totalDataTransferred: number;
  averageResponseTime: number;
  lastActivity: Date;
  connectionsByType: Record<string, number>;
}

export interface ConnectionHealth {
  connectionId: string;
  status: ConnectionStatus;
  lastHealthCheck: Date;
  uptime: number;
  dataQuality: number;
  performance: number;
  alerts: string[];
}

export class ConnectionManager {
  private connections: Map<string, IConnector> = new Map();
  private connectionConfigs: Map<string, IntegrationConfig> = new Map();
  private connectionStatuses: Map<string, ConnectionStatus> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private config: ConnectionManagerConfig;
  private metrics: ConnectionMetrics;
  private isInitialized: boolean = false;

  constructor(config: ConnectionManagerConfig = {}) {
    this.config = {
      maxConnections: 100,
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 3,
      healthCheckInterval: 30000,
      enableMetrics: true,
      enableLogging: true,
      ...config
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      totalDataTransferred: 0,
      averageResponseTime: 0,
      lastActivity: new Date(),
      connectionsByType: {}
    };

    this.setupEventHandlers();
  }

  // Initialization and lifecycle
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing Connection Manager...');

      // Load existing configurations
      const configs = globalConfigManager.getAllConfigurations();
      for (const config of configs) {
        if (config.enabled) {
          await this.createConnection(config);
        }
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      console.log('✅ Connection Manager initialized');

      // Emit initialization event
      globalEventBus.publish('connection.manager.initialized', {
        timestamp: new Date(),
        config: this.config
      });

    } catch (error) {
      console.error('❌ Failed to initialize Connection Manager:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('🛑 Destroying Connection Manager...');

      // Stop health monitoring
      this.stopHealthMonitoring();

      // Disconnect all connections
      const disconnectPromises = Array.from(this.connections.keys()).map(id => 
        this.disconnectConnection(id)
      );
      await Promise.allSettled(disconnectPromises);

      // Clear all maps
      this.connections.clear();
      this.connectionConfigs.clear();
      this.connectionStatuses.clear();
      this.healthCheckIntervals.clear();
      this.reconnectAttempts.clear();

      this.isInitialized = false;
      console.log('✅ Connection Manager destroyed');

      // Emit destruction event
      globalEventBus.publish('connection.manager.destroyed', {
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Error destroying Connection Manager:', error);
    }
  }

  // Connection management
  async createConnection(config: IntegrationConfig): Promise<IConnector> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(`Maximum number of connections (${this.config.maxConnections}) reached`);
    }

    try {
      console.log(`🔌 Creating connection: ${config.name} (${config.type.name})`);

      // Create connector instance based on type
      const connector = await this.createConnectorInstance(config);
      
      // Store connection
      this.connections.set(config.id, connector);
      this.connectionConfigs.set(config.id, config);
      this.connectionStatuses.set(config.id, {
        connected: false,
        errorCount: 0,
        lastError: undefined,
        lastConnected: undefined,
        responseTime: undefined,
        metadata: {}
      });

      // Initialize connection
      await connector.initialize();

      // Connect if enabled
      if (config.enabled) {
        await this.connectConnection(config.id);
      }

      // Start health monitoring for this connection
      this.startConnectionHealthCheck(config.id);

      // Update metrics
      this.updateMetrics('connection.created', { type: config.type.name });

      // Emit connection created event
      globalEventBus.publish('connection.created', {
        config,
        connector,
        timestamp: new Date()
      });

      console.log(`✅ Created connection: ${config.name}`);
      return connector;

    } catch (error) {
      console.error(`❌ Failed to create connection ${config.name}:`, error);
      
      // Update metrics
      this.updateMetrics('connection.failed', { type: config.type.name });
      
      throw error;
    }
  }

  async connectConnection(connectionId: string): Promise<boolean> {
    const connector = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);

    if (!connector || !config) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    try {
      console.log(`🔌 Connecting: ${config.name}`);

      const success = await connector.connect();
      
      if (success) {
        // Update status
        this.connectionStatuses.set(connectionId, {
          connected: true,
          errorCount: 0,
          lastError: undefined,
          lastConnected: new Date(),
          responseTime: undefined,
          metadata: {}
        });

        // Reset reconnect attempts
        this.reconnectAttempts.set(connectionId, 0);

        // Update metrics
        this.updateMetrics('connection.connected', { type: config.type.name });

        // Emit connection event
        globalEventBus.publish('connection.connected', {
          connectionId,
          config,
          timestamp: new Date()
        });

        console.log(`✅ Connected: ${config.name}`);
        return true;
      } else {
        throw new Error('Connection failed');
      }

    } catch (error) {
      console.error(`❌ Failed to connect ${config.name}:`, error);
      
      // Update status
      this.connectionStatuses.set(connectionId, {
        connected: false,
        errorCount: (this.connectionStatuses.get(connectionId)?.errorCount || 0) + 1,
        lastError: error instanceof Error ? error.message : String(error),
        lastConnected: undefined,
        responseTime: undefined,
        metadata: {}
      });

      // Update metrics
      this.updateMetrics('connection.failed', { type: config.type.name });

      // Emit connection error event
      globalEventBus.publish('connection.error', {
        connectionId,
        config,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });

      // Attempt auto-reconnect if enabled
      if (this.config.autoReconnect) {
        this.scheduleReconnect(connectionId);
      }

      return false;
    }
  }

  async disconnectConnection(connectionId: string): Promise<boolean> {
    const connector = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);

    if (!connector || !config) {
      return false;
    }

    try {
      console.log(`🔌 Disconnecting: ${config.name}`);

      // Stop health monitoring
      this.stopConnectionHealthCheck(connectionId);

      // Disconnect connector
      const success = await connector.disconnect();
      
      if (success) {
        // Update status
        this.connectionStatuses.set(connectionId, {
          connected: false,
          errorCount: 0,
          lastError: undefined,
          lastConnected: undefined,
          responseTime: undefined,
          metadata: {}
        });

        // Update metrics
        this.updateMetrics('connection.disconnected', { type: config.type.name });

        // Emit disconnection event
        globalEventBus.publish('connection.disconnected', {
          connectionId,
          config,
          timestamp: new Date()
        });

        console.log(`✅ Disconnected: ${config.name}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error(`❌ Error disconnecting ${config.name}:`, error);
      return false;
    }
  }

  async removeConnection(connectionId: string): Promise<boolean> {
    try {
      // Disconnect first
      await this.disconnectConnection(connectionId);

      // Remove from maps
      const connector = this.connections.get(connectionId);
      const config = this.connectionConfigs.get(connectionId);

      this.connections.delete(connectionId);
      this.connectionConfigs.delete(connectionId);
      this.connectionStatuses.delete(connectionId);

      // Destroy connector
      if (connector) {
        await connector.destroy();
      }

      // Update metrics
      if (config) {
        this.updateMetrics('connection.removed', { type: config.type.name });
      }

      // Emit removal event
      globalEventBus.publish('connection.removed', {
        connectionId,
        config,
        timestamp: new Date()
      });

      console.log(`🗑️ Removed connection: ${connectionId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error removing connection ${connectionId}:`, error);
      return false;
    }
  }

  // Connection queries
  getConnection(connectionId: string): IConnector | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): IConnector[] {
    return Array.from(this.connections.values());
  }

  getConnectionsByType(type: string): IConnector[] {
    return Array.from(this.connections.entries())
      .filter(([id, connector]) => {
        const config = this.connectionConfigs.get(id);
        return config?.type.name === type;
      })
      .map(([id, connector]) => connector);
  }

  getActiveConnections(): IConnector[] {
    return Array.from(this.connections.entries())
      .filter(([id, connector]) => {
        const status = this.connectionStatuses.get(id);
        return status?.connected;
      })
      .map(([id, connector]) => connector);
  }

  getConnectionStatus(connectionId: string): ConnectionStatus | undefined {
    return this.connectionStatuses.get(connectionId);
  }

  getAllConnectionStatuses(): Map<string, ConnectionStatus> {
    return new Map(this.connectionStatuses);
  }

  // Health monitoring
  async checkConnectionHealth(connectionId: string): Promise<ConnectionHealth> {
    const connector = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);
    const status = this.connectionStatuses.get(connectionId);

    if (!connector || !config || !status) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    try {
      const health = await connector.getHealth();
      const now = new Date();
      const uptime = status.lastConnected ? 
        now.getTime() - status.lastConnected.getTime() : 0;

      const connectionHealth: ConnectionHealth = {
        connectionId,
        status,
        lastHealthCheck: now,
        uptime,
        dataQuality: health.dataQuality ? 
          (health.dataQuality.completeness + health.dataQuality.accuracy + health.dataQuality.timeliness) / 3 : 0,
        performance: health.metrics ? 
          (health.metrics.responseTime || 0) : 0,
        alerts: []
      };

      // Check for health issues
      if (connectionHealth.dataQuality < 80) {
        connectionHealth.alerts.push('Low data quality');
      }

      if (connectionHealth.performance > 1000) {
        connectionHealth.alerts.push('High response time');
      }

      // Emit health check event
      globalEventBus.publish('connection.health.checked', {
        connectionId,
        health: connectionHealth,
        timestamp: now
      });

      return connectionHealth;

    } catch (error) {
      console.error(`❌ Health check failed for ${connectionId}:`, error);
      
      const failedHealth: ConnectionHealth = {
        connectionId,
        status,
        lastHealthCheck: new Date(),
        uptime: 0,
        dataQuality: 0,
        performance: 0,
        alerts: ['Health check failed']
      };

      return failedHealth;
    }
  }

  // Metrics and monitoring
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  getConnectionHealth(): ConnectionHealth[] {
    const healthPromises = Array.from(this.connections.keys()).map(id => 
      this.checkConnectionHealth(id)
    );

    return Promise.all(healthPromises);
  }

  // Private methods
  private async createConnectorInstance(config: IntegrationConfig): Promise<IConnector> {
    // This is a simplified factory - in a real implementation, you'd have specific connector classes
    // For now, we'll create a mock connector that implements the interface
    
    const mockConnector: IConnector = {
      connect: async () => {
        // Simulate connection
        await new Promise(resolve => setTimeout(resolve, 1000));
        return Math.random() > 0.1; // 90% success rate
      },
      disconnect: async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      },
      isConnected: () => {
        const status = this.connectionStatuses.get(config.id);
        return status?.connected || false;
      },
      getStatus: () => {
        return this.connectionStatuses.get(config.id) || {
          connected: false,
          errorCount: 0,
          lastError: undefined,
          lastConnected: undefined,
          responseTime: undefined,
          metadata: {}
        };
      },
      getConfig: () => config.connection,
      updateConfig: async () => {},
      validateConfig: async () => true,
      read: async () => ({}),
      write: async () => {},
      query: async () => ([]),
      subscribe: async () => 'mock-subscription',
      unsubscribe: async () => {},
      publish: async () => {},
      getDataQuality: async () => ({
        completeness: 95,
        accuracy: 98,
        timeliness: 90,
        validity: 97,
        consistency: 96,
        lastUpdated: new Date()
      }),
      getMetrics: async () => ({}),
      getHealth: async () => ({
        connected: true,
        status: this.connectionStatuses.get(config.id),
        dataQuality: await this.getDataQuality(),
        metrics: {},
        timestamp: new Date()
      }),
      initialize: async () => {},
      destroy: async () => {},
      reset: async () => {}
    };

    return mockConnector;
  }

  private setupEventHandlers(): void {
    // Listen for configuration changes
    globalEventBus.subscribe('config.created', async (event) => {
      if (event.data.config.enabled) {
        await this.createConnection(event.data.config);
      }
    });

    globalEventBus.subscribe('config.updated', async (event) => {
      const { oldConfig, newConfig } = event.data;
      
      if (newConfig.enabled && !oldConfig.enabled) {
        // Enable connection
        await this.createConnection(newConfig);
      } else if (!newConfig.enabled && oldConfig.enabled) {
        // Disable connection
        await this.disconnectConnection(newConfig.id);
      } else if (newConfig.enabled && oldConfig.enabled) {
        // Update connection
        await this.updateConnection(newConfig);
      }
    });

    globalEventBus.subscribe('config.deleted', async (event) => {
      await this.removeConnection(event.data.config.id);
    });
  }

  private async updateConnection(config: IntegrationConfig): Promise<void> {
    // For now, we'll just reconnect the connection
    // In a real implementation, you'd update the connector configuration
    await this.disconnectConnection(config.id);
    await this.connectConnection(config.id);
  }

  private scheduleReconnect(connectionId: string): void {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      console.log(`🔄 Max reconnect attempts reached for ${connectionId}`);
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
    
    setTimeout(async () => {
      try {
        console.log(`🔄 Attempting reconnect for ${connectionId} (attempt ${attempts + 1})`);
        await this.connectConnection(connectionId);
      } catch (error) {
        console.error(`❌ Reconnect attempt failed for ${connectionId}:`, error);
        this.reconnectAttempts.set(connectionId, attempts + 1);
        this.scheduleReconnect(connectionId);
      }
    }, delay);
  }

  private startHealthMonitoring(): void {
    // Global health monitoring interval
    setInterval(() => {
      this.performGlobalHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private stopHealthMonitoring(): void {
    // Clear all health check intervals
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();
  }

  private startConnectionHealthCheck(connectionId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.checkConnectionHealth(connectionId);
      } catch (error) {
        console.error(`Health check error for ${connectionId}:`, error);
      }
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(connectionId, interval);
  }

  private stopConnectionHealthCheck(connectionId: string): void {
    const interval = this.healthCheckIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(connectionId);
    }
  }

  private async performGlobalHealthCheck(): Promise<void> {
    try {
      const healthChecks = await this.getConnectionHealth();
      
      // Emit global health status
      globalEventBus.publish('connection.manager.health', {
        healthChecks,
        timestamp: new Date()
      });

      // Update metrics
      this.updateMetrics('health.check', { 
        totalConnections: this.connections.size,
        healthyConnections: healthChecks.filter(h => h.alerts.length === 0).length
      });

    } catch (error) {
      console.error('Global health check failed:', error);
    }
  }

  private updateMetrics(event: string, data: Record<string, any>): void {
    if (!this.config.enableMetrics) return;

    switch (event) {
      case 'connection.created':
        this.metrics.totalConnections++;
        this.metrics.connectionsByType[data.type] = (this.metrics.connectionsByType[data.type] || 0) + 1;
        break;
      case 'connection.connected':
        this.metrics.activeConnections++;
        break;
      case 'connection.disconnected':
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        break;
      case 'connection.failed':
        this.metrics.failedConnections++;
        break;
      case 'connection.removed':
        this.metrics.totalConnections = Math.max(0, this.metrics.totalConnections - 1);
        if (data.type) {
          this.metrics.connectionsByType[data.type] = Math.max(0, (this.metrics.connectionsByType[data.type] || 1) - 1);
        }
        break;
    }

    this.metrics.lastActivity = new Date();
  }

  private async getDataQuality(): Promise<any> {
    // Mock data quality for now
    return {
      completeness: 95,
      accuracy: 98,
      timeliness: 90,
      validity: 97,
      consistency: 96,
      lastUpdated: new Date()
    };
  }
}

// Export default instance
export const globalConnectionManager = new ConnectionManager();
export default globalConnectionManager;
