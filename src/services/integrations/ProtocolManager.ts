// Protocol Manager - Centralized management of all protocol connectors
// This can be easily replaced with backend services later

import { ConnectionConfig, ConnectionStatus } from './base/IConnector';
import { globalEventBus } from '../events/EventBus';

// Import all protocol connectors
import { globalWebSocketManager } from '../websocket/WebSocketConnector';
import { globalMQTTManager } from '../mqtt/MQTTConnector';
import { globalOPCUAUniversalManager } from '../opcua/OPCUAConnector';
import { globalDatabaseUniversalManager } from '../database/DatabaseConnector';
import { globalSCADAUniversalManager } from '../scada/SCADAConnector';
import { globalBACnetUniversalManager } from '../bacnet/BACnetConnector';
import { globalDNP3UniversalManager } from '../dnp3/DNP3Connector';
import { globalModbusUniversalManager } from '../modbus/ModbusConnector';
import { globalEtherNetIPUniversalManager } from '../ethernetip/EtherNetIPConnector';
import { globalProfinetUniversalManager } from '../profinet/ProfinetConnector';

export type ProtocolType = 
  | 'websocket' 
  | 'mqtt' 
  | 'opcua' 
  | 'database' 
  | 'scada' 
  | 'bacnet' 
  | 'dnp3' 
  | 'modbus' 
  | 'ethernetip' 
  | 'profinet'
  | 'restapi';

export interface ProtocolConnection {
  id: string;
  name: string;
  type: ProtocolType;
  config: ConnectionConfig;
  status: ConnectionStatus;
  connector: any;
  createdAt: Date;
  lastActivity?: Date;
  metrics?: Record<string, any>;
}

export interface ProtocolManagerConfig {
  autoReconnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  metricsCollection?: boolean;
}

export class ProtocolManager {
  private connections: Map<string, ProtocolConnection> = new Map();
  private config: ProtocolManagerConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;

  constructor(config: ProtocolManagerConfig = {}) {
    this.config = {
      autoReconnect: true,
      maxRetries: 3,
      retryDelay: 5000,
      healthCheckInterval: 30000,
      metricsCollection: true,
      ...config
    };

    this.initializeEventListeners();
    this.startHealthChecks();
    this.startMetricsCollection();
    
    // Restore connections from storage after a delay
    setTimeout(() => {
      this.restoreConnectionsFromStorage();
    }, 2000);
  }

  // Connection Management

  async createConnection(
    id: string, 
    type: ProtocolType, 
    config: ConnectionConfig, 
    options?: any,
    skipAutoConnect: boolean = false
  ): Promise<ProtocolConnection> {
    try {
      let connector: any;
      let manager: any;

      // Route to appropriate manager based on protocol type
      switch (type) {
        case 'websocket':
          manager = globalWebSocketManager;
          connector = await manager.createConnection(id, config);
          break;
        case 'mqtt':
          manager = globalMQTTManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'opcua':
          manager = globalOPCUAUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'database':
          manager = globalDatabaseUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'scada':
          manager = globalSCADAUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'bacnet':
          manager = globalBACnetUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'dnp3':
          manager = globalDNP3UniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'modbus':
          manager = globalModbusUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'ethernetip':
          manager = globalEtherNetIPUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'profinet':
          manager = globalProfinetUniversalManager;
          connector = await manager.createConnection(id, config, options);
          break;
        case 'restapi':
          // For now, create a simple REST API connector
          connector = this.createRESTAPIConnector(id, config, options);
          break;
        default:
          throw new Error(`Unsupported protocol type: ${type}`);
      }

      const connection: ProtocolConnection = {
        id,
        name: config.name,
        type,
        config,
        status: { connected: false, errorCount: 0, lastError: undefined, responseTime: undefined, metadata: {} },
        connector,
        createdAt: new Date()
      };

      this.connections.set(id, connection);

      // Connect the connector only if not skipping auto-connect
      if (!skipAutoConnect) {
        await connector.connect();
        
        // Update status
        connection.status = connector.getStatus();
        connection.lastActivity = new Date();
      }

      globalEventBus.publish('protocol.connection.created', {
        connectionId: id,
        type,
        config,
        timestamp: new Date()
      });

      console.log(`✅ Created ${type} connection: ${id}${skipAutoConnect ? ' (restoration mode)' : ''}`);
      return connection;

    } catch (error) {
      console.error(`❌ Failed to create ${type} connection: ${id}`, error);
      throw error;
    }
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (!connection) {
      return false;
    }

    try {
      // Disconnect the connector
      await connection.connector.disconnect();

      // Remove from manager
      const manager = this.getManagerForType(connection.type);
      if (manager) {
        manager.removeConnection(id);
      }

      // Remove from local map
      this.connections.delete(id);

      globalEventBus.publish('protocol.connection.removed', {
        connectionId: id,
        type: connection.type,
        timestamp: new Date()
      });

      console.log(`🔌 Removed ${connection.type} connection: ${id}`);
      return true;

    } catch (error) {
      console.error(`❌ Error removing connection: ${id}`, error);
      return false;
    }
  }

  getConnection(id: string): ProtocolConnection | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): Map<string, ProtocolConnection> {
    return new Map(this.connections);
  }

  getConnectionsByType(type: ProtocolType): ProtocolConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.type === type);
  }

  // Connection Operations

  async connect(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      const success = await connection.connector.connect();
      if (success) {
        connection.status = connection.connector.getStatus();
        connection.lastActivity = new Date();
        
        globalEventBus.publish('protocol.connection.connected', {
          connectionId: id,
          type: connection.type,
          timestamp: new Date()
        });
      }
      return success;
    } catch (error) {
      console.error(`❌ Failed to connect: ${id}`, error);
      return false;
    }
  }

  async disconnect(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      const success = await connection.connector.disconnect();
      if (success) {
        connection.status = connection.connector.getStatus();
        connection.lastActivity = new Date();
        
        globalEventBus.publish('protocol.connection.disconnected', {
          connectionId: id,
          type: connection.type,
          timestamp: new Date()
        });
      }
      return success;
    } catch (error) {
      console.error(`❌ Failed to disconnect: ${id}`, error);
      return false;
    }
  }

  async reconnect(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      console.log(`🔄 Reconnecting ${connection.type} connection: ${id}`);
      
      await connection.connector.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before reconnecting
      const success = await connection.connector.connect();
      
      if (success) {
        connection.status = connection.connector.getStatus();
        connection.lastActivity = new Date();
        
        globalEventBus.publish('protocol.connection.reconnected', {
          connectionId: id,
          type: connection.type,
          timestamp: new Date()
        });
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Failed to reconnect: ${id}`, error);
      return false;
    }
  }

  // Health and Status

  async getConnectionHealth(id: string): Promise<any> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      const health = await connection.connector.getHealth();
      const metrics = await connection.connector.getMetrics();
      
      return {
        id,
        type: connection.type,
        status: connection.status,
        health,
        metrics,
        lastActivity: connection.lastActivity,
        uptime: connection.lastActivity ? Date.now() - connection.lastActivity.getTime() : 0
      };
    } catch (error) {
      console.error(`❌ Failed to get health for connection: ${id}`, error);
      return {
        id,
        type: connection.type,
        status: connection.status,
        error: error.message,
        lastActivity: connection.lastActivity
      };
    }
  }

  async getAllConnectionsHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      try {
        health[id] = await this.getConnectionHealth(id);
      } catch (error) {
        health[id] = {
          id,
          type: connection.type,
          status: connection.status,
          error: error.message
        };
      }
    }
    
    return health;
  }

  // Metrics and Analytics

  async getConnectionMetrics(id: string): Promise<any> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      const metrics = await connection.connector.getMetrics();
      connection.metrics = metrics;
      return metrics;
    } catch (error) {
      console.error(`❌ Failed to get metrics for connection: ${id}`, error);
      return null;
    }
  }

  async getAllConnectionsMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      try {
        metrics[id] = await this.getConnectionMetrics(id);
      } catch (error) {
        metrics[id] = null;
      }
    }
    
    return metrics;
  }

  // Protocol-specific Operations

  async readData(id: string, path: string, options?: any): Promise<any> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      const result = await connection.connector.read(path, options);
      connection.lastActivity = new Date();
      return result;
    } catch (error) {
      console.error(`❌ Failed to read data from connection: ${id}`, error);
      throw error;
    }
  }

  async writeData(id: string, path: string, data: any, options?: any): Promise<void> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      await connection.connector.write(path, data, options);
      connection.lastActivity = new Date();
    } catch (error) {
      console.error(`❌ Failed to write data to connection: ${id}`, error);
      throw error;
    }
  }

  async queryData(id: string, query: string, options?: any): Promise<any[]> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      const result = await connection.connector.query(query, options);
      connection.lastActivity = new Date();
      return result;
    } catch (error) {
      console.error(`❌ Failed to query data from connection: ${id}`, error);
      throw error;
    }
  }

  // Streaming Operations

  async startStreaming(id: string, config: any): Promise<void> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      await connection.connector.startStreaming(config);
      connection.lastActivity = new Date();
      
      globalEventBus.publish('protocol.streaming.started', {
        connectionId: id,
        type: connection.type,
        config,
        timestamp: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to start streaming for connection: ${id}`, error);
      throw error;
    }
  }

  async stopStreaming(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    try {
      await connection.connector.stopStreaming();
      connection.lastActivity = new Date();
      
      globalEventBus.publish('protocol.streaming.stopped', {
        connectionId: id,
        type: connection.type,
        timestamp: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to stop streaming for connection: ${id}`, error);
      throw error;
    }
  }

  // Utility Methods

  getSupportedProtocols(): ProtocolType[] {
    return ['websocket', 'mqtt', 'opcua', 'database', 'scada', 'bacnet', 'dnp3', 'modbus', 'ethernetip', 'profinet', 'restapi'];
  }

  getProtocolInfo(type: ProtocolType): any {
    const protocolInfo: Record<ProtocolType, any> = {
      websocket: {
        name: 'WebSocket',
        description: 'Real-time bidirectional communication',
        defaultPort: 80,
        securePort: 443,
        features: ['Real-time', 'Bidirectional', 'Event-driven']
      },
      mqtt: {
        name: 'MQTT',
        description: 'Lightweight messaging protocol for IoT',
        defaultPort: 1883,
        securePort: 8883,
        features: ['Pub/Sub', 'QoS levels', 'Lightweight']
      },
      opcua: {
        name: 'OPC UA',
        description: 'Industrial automation data exchange',
        defaultPort: 4840,
        securePort: 4840,
        features: ['Industrial', 'Secure', 'Scalable']
      },
      database: {
        name: 'Database',
        description: 'Structured data storage and querying',
        defaultPort: 1433,
        securePort: 1433,
        features: ['ACID', 'SQL', 'Transactions']
      },
      scada: {
        name: 'SCADA',
        description: 'Supervisory control and data acquisition',
        defaultPort: 502,
        securePort: 502,
        features: ['Real-time', 'Control', 'Monitoring']
      },
      bacnet: {
        name: 'BACnet',
        description: 'Building automation and control networks',
        defaultPort: 47808,
        securePort: 47808,
        features: ['Building automation', 'Object-oriented', 'Standardized']
      },
      dnp3: {
        name: 'DNP3',
        description: 'Distributed Network Protocol 3',
        defaultPort: 20000,
        securePort: 20000,
        features: ['Utility systems', 'Reliable', 'Secure']
      },
      modbus: {
        name: 'Modbus',
        description: 'Industrial communication protocol',
        defaultPort: 502,
        securePort: 502,
        features: ['Industrial', 'Simple', 'Widely supported']
      },
      ethernetip: {
        name: 'EtherNet/IP',
        description: 'Industrial Ethernet protocol',
        defaultPort: 44818,
        securePort: 44818,
        features: ['Ethernet', 'Industrial', 'Real-time']
      },
      profinet: {
        name: 'Profinet',
        description: 'Process Field Network',
        defaultPort: 34964,
        securePort: 34964,
        features: ['Real-time', 'Industrial', 'Ethernet-based']
      },
      restapi: {
        name: 'REST API',
        description: 'Representational State Transfer API',
        defaultPort: 80,
        securePort: 443,
        features: ['HTTP-based', 'Stateless', 'RESTful', 'JSON/XML']
      }
    };

    return protocolInfo[type] || null;
  }

  // Private Methods

  private getManagerForType(type: ProtocolType): any {
    switch (type) {
      case 'websocket': return globalWebSocketManager;
      case 'mqtt': return globalMQTTManager;
      case 'opcua': return globalOPCUAUniversalManager;
              case 'database': return globalDatabaseUniversalManager;
        case 'scada': return globalSCADAUniversalManager;
        case 'bacnet': return globalBACnetUniversalManager;
      case 'dnp3': return globalDNP3UniversalManager;
      case 'modbus': return globalModbusUniversalManager;
      case 'ethernetip': return globalEtherNetIPUniversalManager;
      case 'profinet': return globalProfinetUniversalManager;
      case 'restapi': return null; // TODO: Implement REST API manager
      default: return null;
    }
  }

  private initializeEventListeners(): void {
    // Listen for connection events from all managers
    globalEventBus.subscribe('websocket.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('mqtt.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('opcua.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('database.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('scada.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('bacnet.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('dnp3.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('modbus.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('ethernetip.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('profinet.connection.*', this.handleConnectionEvent.bind(this));
    globalEventBus.subscribe('restapi.connection.*', this.handleConnectionEvent.bind(this));
  }

  private handleConnectionEvent(event: any): void {
    // Update connection status based on events
    const connectionId = event.connectionId;
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      connection.status = connection.connector.getStatus();
      connection.lastActivity = new Date();
    }
  }

  private startHealthChecks(): void {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(async () => {
        for (const [id, connection] of this.connections.entries()) {
          try {
            const health = await this.getConnectionHealth(id);
            if (!health.status.connected && this.config.autoReconnect) {
              console.log(`🔄 Auto-reconnecting connection: ${id}`);
              await this.reconnect(id);
            }
          } catch (error) {
            console.error(`❌ Health check failed for connection: ${id}`, error);
          }
        }
      }, this.config.healthCheckInterval);
    }
  }

  private startMetricsCollection(): void {
    if (this.config.metricsCollection) {
      this.metricsTimer = setInterval(async () => {
        for (const [id, connection] of this.connections.entries()) {
          try {
            await this.getConnectionMetrics(id);
          } catch (error) {
            // Silently fail metrics collection
          }
        }
      }, 60000); // Collect metrics every minute
    }
  }

  // Restore connections from storage
  private async restoreConnectionsFromStorage(): Promise<void> {
    try {
      console.log('🔄 ProtocolManager: Restoring connections from storage...');
      
      // Wait a bit more to ensure all managers are initialized
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get all stored connection configs from IndexedDB
      const storedConfigs = await this.getAllStoredConnectionConfigs();
      
      console.log(`📦 Found ${storedConfigs.length} stored connections to restore`);
      
      for (const storedConfig of storedConfigs) {
        try {
          // Check if connection already exists
          if (this.connections.has(storedConfig.id)) {
            console.log(`⏭️ Connection ${storedConfig.id} already exists, skipping`);
            continue;
          }
          
          // Create connection using the appropriate manager with correct parameters
          const connection = await this.createConnection(
            storedConfig.id,
            storedConfig.type as ProtocolType, // Add the protocol type
            storedConfig.config,
            storedConfig.config.options || {},
            true // Skip auto-connect during restoration
          );
          
          // Check if the connection was successfully created and is connected
          if (connection && connection.connector && connection.connector.isConnected && connection.connector.isConnected()) {
            console.log(`✅ Restored and connected: ${storedConfig.name} (${storedConfig.id})`);
          } else {
            console.log(`✅ Restored connection (not connected): ${storedConfig.name} (${storedConfig.id})`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to restore connection ${storedConfig.id}:`, error);
        }
      }
      
      console.log(`✅ ProtocolManager: Restored ${storedConfigs.length} connections from storage`);
      
      // Debug: Show what connections we have
      console.log('🔍 Current connections in ProtocolManager:');
      for (const [id, conn] of this.connections.entries()) {
        console.log(`  - ${id}: ${conn.name} (${conn.type}) - Connected: ${conn.connector?.isConnected?.() || 'unknown'}`);
      }
      
    } catch (error) {
      console.error('❌ ProtocolManager: Error restoring connections from storage:', error);
    }
  }

  // Get all stored connection configs from IndexedDB
  private async getAllStoredConnectionConfigs(): Promise<any[]> {
    try {
      // Try to get configs from OPCUA manager first
      const opcuaDb = globalOPCUAUniversalManager.getDatabase();
      const opcuaConfigs = await opcuaDb.getAllConnectionConfigs();
      
      // Add other protocol configs here as needed
      return opcuaConfigs;
      
    } catch (error) {
      console.error('❌ Error getting stored connection configs:', error);
      return [];
    }
  }

  // Get restoration status and information
  async getRestorationStatus(): Promise<{
    totalStored: number;
    totalRestored: number;
    connections: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      restored: boolean;
    }>;
  }> {
    try {
      const storedConfigs = await this.getAllStoredConnectionConfigs();
      const connections = Array.from(this.connections.values());
      
      const connectionInfo = connections.map(conn => ({
        id: conn.id,
        name: conn.name,
        type: conn.type,
        status: conn.connector?.isConnected?.() ? 'connected' : 'disconnected',
        restored: true
      }));

      return {
        totalStored: storedConfigs.length,
        totalRestored: connections.length,
        connections: connectionInfo
      };
      
    } catch (error) {
      console.error('❌ Error getting restoration status:', error);
      return {
        totalStored: 0,
        totalRestored: 0,
        connections: []
      };
    }
  }

  // Force restoration of connections from storage
  async forceRestoreConnections(): Promise<void> {
    console.log('🔄 Force restoring connections from storage...');
    await this.restoreConnectionsFromStorage();
  }

  // REST API Connector Creation
  private createRESTAPIConnector(id: string, config: ConnectionConfig, options?: any): any {
    // Create a simple REST API connector that implements the IConnector interface
    return {
      id,
      config,
      options,
      
      async connect(): Promise<boolean> {
        try {
          // Test the endpoint with a simple GET request
          const response = await fetch(config.endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          if (response.ok) {
            console.log(`✅ REST API connection successful: ${config.endpoint}`);
            return true;
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`❌ REST API connection failed: ${config.endpoint}`, error);
          return false;
        }
      },

      async disconnect(): Promise<boolean> {
        // REST API connections are stateless, so just return true
        return true;
      },

      async destroy(): Promise<void> {
        // No cleanup needed for REST API
      },

      getStatus(): ConnectionStatus {
        return { connected: false, errorCount: 0 };
      },

      isConnected(): boolean {
        return false; // REST API is stateless
      },

      getConfig(): ConnectionConfig {
        return config;
      },

      async updateConfig(newConfig: Partial<ConnectionConfig>): Promise<void> {
        Object.assign(config, newConfig);
      },

      async validateConfig(config: ConnectionConfig): Promise<boolean> {
        try {
          const url = new URL(config.endpoint);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },

      async read(path: string): Promise<any> {
        try {
          const response = await fetch(`${config.endpoint}${path}`, {
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return await response.json();
        } catch (error) {
          console.error(`❌ REST API read failed: ${path}`, error);
          throw error;
        }
      },

      async write(path: string, value: any): Promise<void> {
        try {
          const response = await fetch(`${config.endpoint}${path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            },
            body: JSON.stringify(value)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`❌ REST API write failed: ${path}`, error);
          throw error;
        }
      },

      async delete(path: string): Promise<void> {
        try {
          const response = await fetch(`${config.endpoint}${path}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`❌ REST API delete failed: ${path}`, error);
          throw error;
        }
      },

      async list(path?: string): Promise<string[]> {
        try {
          const response = await fetch(`${config.endpoint}${path || ''}`, {
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          // Try to extract list from response
          if (Array.isArray(data)) {
            return data.map(item => item.id || item.name || String(item));
          } else if (data.items && Array.isArray(data.items)) {
            return data.items.map(item => item.id || item.name || String(item));
          } else {
            return Object.keys(data);
          }
        } catch (error) {
          console.error(`❌ REST API list failed: ${path}`, error);
          throw error;
        }
      },

      async exists(path: string): Promise<boolean> {
        try {
          const response = await fetch(`${config.endpoint}${path}`, {
            method: 'HEAD',
            headers: {
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          return response.ok;
        } catch (error) {
          return false;
        }
      },

      async getMetadata(path: string): Promise<any> {
        try {
          const response = await fetch(`${config.endpoint}${path}`, {
            method: 'OPTIONS',
            headers: {
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          if (response.ok) {
            return {
              methods: response.headers.get('Allow')?.split(',').map(m => m.trim()) || [],
              contentType: response.headers.get('Content-Type') || 'application/json'
            };
          }
          
          return null;
        } catch (error) {
          return null;
        }
      },

      async setMetadata(path: string, metadata: any): Promise<void> {
        // REST API doesn't support setting metadata
        console.warn('REST API does not support setting metadata');
      },

      async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
        // REST API doesn't support subscriptions
        console.warn('REST API does not support subscriptions');
        return `restapi_${Date.now()}`;
      },

      async unsubscribe(subscriptionId: string): Promise<void> {
        // REST API doesn't support subscriptions
      },

      async query(filter: any): Promise<any[]> {
        try {
          const queryParams = new URLSearchParams();
          Object.entries(filter).forEach(([key, value]) => {
            queryParams.append(key, String(value));
          });
          
          const response = await fetch(`${config.endpoint}?${queryParams.toString()}`, {
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          return Array.isArray(data) ? data : [data];
        } catch (error) {
          console.error(`❌ REST API query failed`, error);
          throw error;
        }
      },

      async publish(topic: string, data: any): Promise<void> {
        // REST API doesn't support publishing
        console.warn('REST API does not support publishing');
      },

      async getDataQuality(): Promise<any> {
        return {
          overallQuality: 'good',
          lastUpdate: new Date(),
          source: 'REST API'
        };
      },

      async getHealth(): Promise<{ status: string; details: any }> {
        try {
          const response = await fetch(config.endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(config.authentication?.username && {
                'Authorization': `Basic ${btoa(`${config.authentication.username}:${config.authentication.password || ''}`)}`
              })
            }
          });
          
          return {
            status: response.ok ? 'healthy' : 'unhealthy',
            details: {
              statusCode: response.status,
              statusText: response.statusText,
              responseTime: Date.now(),
              endpoint: config.endpoint
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            details: {
              error: error.message,
              endpoint: config.endpoint
            }
          };
        }
      },

      async getCapabilities(): Promise<string[]> {
        return ['read', 'write', 'delete', 'list', 'exists', 'query', 'metadata'];
      },

      async getSchema(): Promise<any> {
        return {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            authentication: { type: 'object' },
            methods: { type: 'array', items: { type: 'string' } }
          }
        };
      },

      async initialize(): Promise<void> {
        // No initialization needed for REST API
      },

      async reset(): Promise<void> {
        // No reset needed for REST API
      }
    };
  }

  // Cleanup

  destroy(): void {
    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Disconnect all connections
    for (const [id, connection] of this.connections.entries()) {
      try {
        connection.connector.disconnect();
      } catch (error) {
        console.error(`❌ Error disconnecting connection: ${id}`, error);
      }
    }

    // Clear connections
    this.connections.clear();

    // Destroy all managers
    globalWebSocketManager.destroy();
    globalMQTTManager.destroy();
    globalOPCUAUniversalManager.destroy();
    globalDatabaseUniversalManager.destroy();
    globalSCADAUniversalManager.destroy();
    globalBACnetUniversalManager.destroy();
    globalDNP3UniversalManager.destroy();
    globalModbusUniversalManager.destroy();
    globalEtherNetIPUniversalManager.destroy();
    globalProfinetUniversalManager.destroy();

    console.log('🔌 Protocol Manager destroyed');
  }
}

// Global Protocol Manager instance
export const globalProtocolManager = new ProtocolManager();
