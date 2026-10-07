// OPC UA Connector - Industrial automation protocol support
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

// Browser-compatible OPC UA simulation (Node.js libraries not available in browser)
// In production, these would be replaced with backend API calls or WebSocket-based OPC UA clients

export interface OPCUAOptions {
  securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy?: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256';
  authentication?: 'Anonymous' | 'Username' | 'Certificate';
  username?: string;
  password?: string;
  certificatePath?: string;
  privateKeyPath?: string;
  requestTimeout?: number;
  keepAliveInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface OPCUANode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: 'Variable' | 'Object' | 'Method' | 'ObjectType' | 'VariableType' | 'ReferenceType' | 'DataType';
  dataType?: string;
  value?: any;
  timestamp?: Date;
  quality?: 'Good' | 'Uncertain' | 'Bad';
  accessLevel?: 'CurrentRead' | 'CurrentWrite' | 'HistoryRead' | 'HistoryWrite';
  writeMask?: number;
  userWriteMask?: number;
  eventNotifier?: number;
  executable?: boolean;
  userExecutable?: boolean;
  children?: OPCUANode[];
}

export interface OPCUAMessage {
  nodeId: string;
  value: any;
  timestamp: Date;
  quality: 'Good' | 'Uncertain' | 'Bad';
  sourceTimestamp?: Date;
  serverTimestamp?: Date;
  statusCode?: number;
  metadata?: Record<string, any>;
}

export interface OPCUASubscription {
  id: string;
  nodeId: string;
  callback: (message: OPCUAMessage) => void;
  active: boolean;
  samplingInterval: number;
  queueSize: number;
  discardOldest: boolean;
  filter?: any;
}

export interface OPCUAMetrics {
  nodesRead: number;
  nodesWritten: number;
  subscriptions: number;
  activeSubscriptions: number;
  errors: number;
  lastRead?: Date;
  lastWrite?: Date;
  averageResponseTime: number;
  connectionUptime: number;
}

export class OPCUAConnector extends BaseConnector implements IConnector {
  private opcuaClient: any = null; // Will be replaced with actual OPC UA client
  private opcuaOptions: OPCUAOptions;
  private activeSubscriptions: Map<string, OPCUASubscription> = new Map();
  private messageBuffer: OPCUAMessage[] = [];
  private bufferSize: number = 1000;
  private streamingActive: boolean = false;
  private opcuaMetrics: OPCUAMetrics;
  private connectionStartTime: number = 0;
  private db: UniversalConnectorDB; // Added db property

  constructor(config: ConnectionConfig, opcuaOptions: OPCUAOptions = {}) {
    super(config);
    
    this.opcuaOptions = {
      securityMode: 'None',
      securityPolicy: 'None',
      authentication: 'Anonymous',
      requestTimeout: 30000,
      keepAliveInterval: 10000,
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      ...opcuaOptions
    };

    // Initialize metrics
    this.opcuaMetrics = {
      nodesRead: 0,
      nodesWritten: 0,
      subscriptions: 0,
      activeSubscriptions: 0,
      errors: 0,
      averageResponseTime: 0,
      connectionUptime: 0
    };

    this.db = new UniversalConnectorDB(); // Initialize db
    // Initialize the database
    this.db.initialize().catch(error => {
      console.error('Failed to initialize OPC UA database:', error);
    });
  }

  // Override connect method to update status in IndexedDB
  async connect(): Promise<boolean> {
    const result = await super.connect();
    if (result) {
      // Update connection status in IndexedDB
      await this.updateConnectionStatusInStorage('connected');
    }
    return result;
  }

  // Override disconnect method to update status in IndexedDB
  async disconnect(): Promise<boolean> {
    const result = await super.disconnect();
    if (result) {
      // Update connection status in IndexedDB
      await this.updateConnectionStatusInStorage('disconnected');
    }
    return result;
  }

  // Update connection status in IndexedDB storage
  private async updateConnectionStatusInStorage(status: 'connected' | 'disconnected'): Promise<void> {
    try {
      // Find the connection config for this connector
      const allConfigs = await this.db.getAllConnectionConfigs();
      const config = allConfigs.find(c => 
        c.config.endpoint === this.config.endpoint && 
        c.config.name === this.config.name
      );
      
      if (config) {
        // Update the connection status
        await this.db.saveConnectionConfig({
          ...config,
          connectionStatus: status,
          lastConnection: status === 'connected' ? new Date() : config.lastConnection,
          updatedAt: new Date()
        });
        
        // console.log(`📝 Updated connection status in IndexedDB: ${this.config.name} -> ${status}`);
      }
    } catch (error) {
      console.error('❌ Failed to update connection status in IndexedDB:', error);
    }
  }

  // Implement abstract methods from BaseConnector
  protected async performConnect(): Promise<boolean> {
    try {
      // console.log(`🔌 Connecting to OPC UA server: ${this.config.endpoint}`);
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful connection
      this.opcuaClient = {
        connected: true,
        browse: this.simulateBrowse.bind(this),
        read: this.simulateRead.bind(this),
        write: this.simulateWrite.bind(this),
        subscribe: this.simulateSubscribe.bind(this),
        unsubscribe: this.simulateUnsubscribe.bind(this)
      };
      
      this.connectionStartTime = Date.now();
      // console.log(`✅ Connected to OPC UA server: ${this.config.endpoint}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to OPC UA server: ${this.config.endpoint}`, error);
      return false;
    }
  }

  protected async performDisconnect(): Promise<boolean> {
    try {
      if (this.opcuaClient) {
        // Close all subscriptions
        for (const [id, subscription] of Array.from(this.activeSubscriptions.entries())) {
          subscription.active = false;
        }
        this.activeSubscriptions.clear();
        
        // Close session if exists
        const session = (this as any).session;
        if (session) {
          try {
            await session.close();
            // console.log('🔌 OPC UA session closed');
          } catch (sessionError) {
            console.warn('⚠️ Error closing OPC UA session:', sessionError);
          }
          (this as any).session = null;
        }
        
        // Close client connection (check if disconnect method exists)
        if (this.opcuaClient.disconnect && typeof this.opcuaClient.disconnect === 'function') {
          await this.opcuaClient.disconnect();
        }
        this.opcuaClient = null;
        this.streamingActive = false;
        
        // console.log(`🔌 Disconnected from OPC UA server: ${this.config.endpoint}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error disconnecting from OPC UA server: ${this.config.endpoint}`, error);
      return false;
    }
  }

  protected async performRead(path: string, options?: Record<string, any>): Promise<any> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }

      // Simulate reading OPC UA node
      this.opcuaMetrics.nodesRead++;
      
      // Simulate node value
      const value = Math.random() * 100;
      const quality: 'Good' | 'Uncertain' | 'Bad' = 'Good';
      
      return {
        nodeId: path,
        value: value,
        timestamp: new Date(),
        quality: quality,
        metadata: {
          ...options,
          statusCode: 0, // Good
          sourceTimestamp: new Date(),
          serverTimestamp: new Date()
        }
      };
    } catch (error) {
      this.opcuaMetrics.errors++;
      console.error(`❌ Error reading OPC UA node ${path}:`, error);
      throw error;
    }
  }

  protected async performWrite(path: string, data: any, options?: Record<string, any>): Promise<void> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }
      
      // Simulate writing to OPC UA node
      this.opcuaMetrics.nodesWritten++;
      
      // console.log(`✍️ Wrote to OPC UA node ${path}:`, data);
    } catch (error) {
      this.opcuaMetrics.errors++;
      throw error;
    }
  }

  protected async performQuery(query: string, options?: Record<string, any>): Promise<any[]> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }
      
      // Simulate OPC UA query (e.g., browsing nodes)
      const results = [
        { nodeId: 'ns=2;s=Device1.Temperature', browseName: 'Temperature', nodeClass: 'Variable' },
        { nodeId: 'ns=2;s=Device1.Pressure', browseName: 'Pressure', nodeClass: 'Variable' },
        { nodeId: 'ns=2;s=Device1.Status', browseName: 'Status', nodeClass: 'Variable' }
      ];
      
      return results;
    } catch (error) {
      this.opcuaMetrics.errors++;
      throw error;
    }
  }

  // Override getMetrics to include OPC UA specific metrics
  async getMetrics(): Promise<Record<string, any>> {
    const baseMetrics = await super.getMetrics();
    if (this.connectionStartTime > 0) {
      this.opcuaMetrics.connectionUptime = Date.now() - this.connectionStartTime;
    }
    
    return {
      ...baseMetrics,
      opcua: { ...this.opcuaMetrics },
      nodesRead: this.opcuaMetrics.nodesRead,
      nodesWritten: this.opcuaMetrics.nodesWritten,
      subscriptions: this.opcuaMetrics.subscriptions,
      activeSubscriptions: this.opcuaMetrics.activeSubscriptions,
      errors: this.opcuaMetrics.errors,
      connectionUptime: this.opcuaMetrics.connectionUptime
    };
  }

  // Override getHealth to include OPC UA specific health data
  async getHealth(): Promise<Record<string, any>> {
    const baseHealth = await super.getHealth();
    
    return {
      ...baseHealth,
      opcua: {
        clientConnected: !!this.opcuaClient?.connected,
        activeSubscriptions: this.opcuaMetrics.activeSubscriptions,
        messageBufferSize: this.messageBuffer.length,
        lastActivity: this.connectionStartTime > 0 ? new Date(this.connectionStartTime) : undefined
      }
    };
  }

  // Implement missing IConnector methods
  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    // For OPC UA, treat topic as nodeId
    return await this.subscribeToNode(topic, callback);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.unsubscribeFromNode(subscriptionId);
  }

  async publish(topic: string, data: any): Promise<void> {
    // For OPC UA, treat topic as nodeId and write data
    await this.writeNode(topic, data);
  }

  // OPC UA specific methods
  async browseNodes(nodeId: string = 'i=84'): Promise<OPCUANode[]> {
    try {
      // console.log(`🔍 browseNodes called with nodeId: ${nodeId}`);
      // console.log(`🔍 opcuaClient status:`, this.opcuaClient);
      // console.log(`🔍 opcuaClient.connected:`, this.opcuaClient?.connected);
      
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }

      // Simulate browsing OPC UA nodes
      // console.log(`🔍 Simulating browse for node: ${nodeId}`);
      
      // Return simulated nodes
      const nodes: OPCUANode[] = [
        {
          nodeId: 'ns=2;s=Device1.Temperature',
          browseName: 'Temperature',
          displayName: 'Temperature',
          nodeClass: 'Variable',
          dataType: 'Double',
          value: 25.5 + Math.random() * 10,
          timestamp: new Date(),
          quality: 'Good'
        },
        {
          nodeId: 'ns=2;s=Device1.Pressure',
          browseName: 'Pressure',
          displayName: 'Pressure',
          nodeClass: 'Variable',
          dataType: 'Double',
          value: 101.3 + Math.random() * 5,
          timestamp: new Date(),
          quality: 'Good'
        },
        {
          nodeId: 'ns=2;s=Device1.Status',
          browseName: 'Status',
          displayName: 'Device Status',
          nodeClass: 'Variable',
          dataType: 'String',
          value: 'Running',
          timestamp: new Date(),
          quality: 'Good'
        }
      ];
      
      // console.log(`✅ browseNodes returning ${nodes.length} nodes:`, nodes);
      return nodes;
    } catch (error) {
      this.opcuaMetrics.errors++;
      console.error(`❌ Error browsing OPC UA nodes:`, error);
      throw error;
    }
  }

  // Helper method to map OPC UA node classes
  private mapNodeClass(nodeClass: number): OPCUANode['nodeClass'] {
    switch (nodeClass) {
      case 1: return 'Object';
      case 2: return 'Variable';
      case 4: return 'Method';
      case 8: return 'ObjectType';
      case 16: return 'VariableType';
      case 32: return 'ReferenceType';
      case 64: return 'DataType';
      default: return 'Object';
    }
  }

  // Get root nodes for initial browsing
  async getRootNodes(): Promise<OPCUANode[]> {
    try {
      // console.log(`🔍 getRootNodes called`);
      // console.log(`🔍 opcuaClient status:`, this.opcuaClient);
      // console.log(`🔍 opcuaClient.connected:`, this.opcuaClient?.connected);
      
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }

      // Return root level nodes
      const rootNodes: OPCUANode[] = [
        {
          nodeId: 'i=84',
          browseName: 'Root',
          displayName: 'Root',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'i=85',
          browseName: 'Objects',
          displayName: 'Objects',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'i=86',
          browseName: 'Variables',
          displayName: 'Variables',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'ns=2;s=Device1',
          browseName: 'Device1',
          displayName: 'Device 1',
          nodeClass: 'Object',
          children: []
        }
      ];
      
      // console.log(`✅ getRootNodes returning ${rootNodes.length} nodes:`, rootNodes);
      return rootNodes;
    } catch (error) {
      this.opcuaMetrics.errors++;
      console.error(`❌ Error getting root nodes:`, error);
      throw error;
    }
  }

  // Enhanced browsing with different options
  async browseAddressSpace(options: {
    startingNode?: string;
    maxNodes?: number;
    includeValues?: boolean;
    recursive?: boolean;
    filter?: string;
  } = {}): Promise<OPCUANode[]> {
    const {
      startingNode = 'i=84',
      maxNodes = 100,
      includeValues = false,
      recursive = false,
      filter = ''
    } = options;

    try {
      // console.log(`🔍 browseAddressSpace called with options:`, options);
      // console.log(`🔍 opcuaClient status:`, this.opcuaClient);
      // console.log(`🔍 opcuaClient.connected:`, this.opcuaClient?.connected);
      
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }

      // console.log(`🔍 Browsing OPC UA address space from ${startingNode}`);
      
      // Simulate comprehensive browsing with different node types
      const allNodes: OPCUANode[] = [
        // Root level
        {
          nodeId: 'i=84',
          browseName: 'Root',
          displayName: 'Root',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'i=85',
          browseName: 'Objects',
          displayName: 'Objects',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'i=86',
          browseName: 'Variables',
          displayName: 'Variables',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'i=87',
          browseName: 'Methods',
          displayName: 'Methods',
          nodeClass: 'Object',
          children: []
        },
        {
          nodeId: 'i=88',
          browseName: 'Views',
          displayName: 'Views',
          nodeClass: 'Object',
          children: []
        },
        // Your custom namespace
        {
          nodeId: 'ns=2;s=Device1',
          browseName: 'Device1',
          displayName: 'Device 1',
          nodeClass: 'Object',
          children: [
            {
              nodeId: 'ns=2;s=Device1.Temperature',
              browseName: 'Temperature',
              displayName: 'Temperature',
              nodeClass: 'Variable',
              dataType: 'Double',
              value: includeValues ? 25.5 + Math.random() * 10 : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            },
            {
              nodeId: 'ns=2;s=Device1.Pressure',
              browseName: 'Pressure',
              displayName: 'Pressure',
              nodeClass: 'Variable',
              dataType: 'Double',
              value: includeValues ? 101.3 + Math.random() * 5 : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            },
            {
              nodeId: 'ns=2;s=Device1.Status',
              browseName: 'Status',
              displayName: 'Device Status',
              nodeClass: 'Variable',
              dataType: 'String',
              value: includeValues ? 'Running' : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            },
            {
              nodeId: 'ns=2;s=Device1.Setpoint',
              browseName: 'Setpoint',
              displayName: 'Temperature Setpoint',
              nodeClass: 'Variable',
              dataType: 'Double',
              value: includeValues ? 75.0 : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            }
          ]
        },
        {
          nodeId: 'ns=2;s=Device2',
          browseName: 'Device2',
          displayName: 'Device 2',
          nodeClass: 'Object',
          children: [
            {
              nodeId: 'ns=2;s=Device2.FlowRate',
              browseName: 'FlowRate',
              displayName: 'Flow Rate',
              nodeClass: 'Variable',
              dataType: 'Double',
              value: includeValues ? 150.0 + Math.random() * 20 : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            },
            {
              nodeId: 'ns=2;s=Device2.Level',
              browseName: 'Level',
              displayName: 'Tank Level',
              nodeClass: 'Variable',
              dataType: 'Double',
              value: includeValues ? 80.0 + Math.random() * 10 : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            }
          ]
        },
        // System information
        {
          nodeId: 'ns=2;s=System',
          browseName: 'System',
          displayName: 'System Information',
          nodeClass: 'Object',
          children: [
            {
              nodeId: 'ns=2;s=System.Uptime',
              browseName: 'Uptime',
              displayName: 'System Uptime',
              nodeClass: 'Variable',
              dataType: 'UInt32',
              value: includeValues ? Math.floor(Date.now() / 1000) : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            },
            {
              nodeId: 'ns=2;s=System.Version',
              browseName: 'Version',
              displayName: 'Software Version',
              nodeClass: 'Variable',
              dataType: 'String',
              value: includeValues ? '1.2.3' : undefined,
              timestamp: includeValues ? new Date() : undefined,
              quality: includeValues ? 'Good' : undefined
            }
          ]
        }
      ];

      // Apply filter if specified
      let filteredNodes = allNodes;
      if (filter) {
        filteredNodes = allNodes.filter(node => 
          node.browseName.toLowerCase().includes(filter.toLowerCase()) ||
          node.displayName.toLowerCase().includes(filter.toLowerCase()) ||
          node.nodeId.toLowerCase().includes(filter.toLowerCase())
        );
      }

      // Limit results
      const limitedNodes = filteredNodes.slice(0, maxNodes);

      // console.log(`✅ Found ${limitedNodes.length} nodes in address space`);
      return limitedNodes;

    } catch (error) {
      this.opcuaMetrics.errors++;
      console.error('❌ Error browsing address space:', error);
      throw error;
    }
  }

  // Browse specific node with detailed information
  async getNodeDetails(nodeId: string): Promise<OPCUANode | null> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }

      // console.log(`🔍 Getting details for node: ${nodeId}`);
      
      // Simulate getting detailed node information
      const nodeDetails: OPCUANode = {
        nodeId,
        browseName: nodeId.split('.').pop() || nodeId,
        displayName: nodeId.split('.').pop() || nodeId,
        nodeClass: 'Variable',
        dataType: 'Double',
        value: Math.random() * 100,
        timestamp: new Date(),
        quality: 'Good',
        accessLevel: 'CurrentRead',
        writeMask: 0,
        userWriteMask: 0,
        eventNotifier: 0,
        executable: false,
        userExecutable: false
      };

      // console.log(`✅ Node details retrieved for: ${nodeId}`);
      return nodeDetails;

    } catch (error) {
      this.opcuaMetrics.errors++;
      console.error(`❌ Error getting node details for ${nodeId}:`, error);
      return null;
    }
  }

  async readNode(nodeId: string): Promise<OPCUAMessage> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }
      
      // Simulate reading OPC UA node
      const value = Math.random() * 100;
      this.opcuaMetrics.nodesRead++;
      
      const message: OPCUAMessage = {
        nodeId,
        value,
        timestamp: new Date(),
        quality: 'Good',
        sourceTimestamp: new Date(),
        serverTimestamp: new Date()
      };
      
      // Add to buffer
      this.messageBuffer.push(message);
      if (this.messageBuffer.length > this.bufferSize) {
        this.messageBuffer.shift();
      }
      
      return message;
    } catch (error) {
      this.opcuaMetrics.errors++;
      throw error;
    }
  }

  async writeNode(nodeId: string, value: any): Promise<void> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }
      
      // Simulate writing to OPC UA node
      this.opcuaMetrics.nodesWritten++;
      
      // console.log(`✍️ Wrote to OPC UA node ${nodeId}:`, value);
    } catch (error) {
      this.opcuaMetrics.errors++;
      throw error;
    }
  }

  async subscribeToNode(nodeId: string, callback: (message: OPCUAMessage) => void, samplingInterval: number = 1000): Promise<string> {
    try {
      if (!this.opcuaClient?.connected) {
        throw new Error('Not connected to OPC UA server');
      }
      
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const subscription: OPCUASubscription = {
        id: subscriptionId,
        nodeId,
        callback,
        active: true,
        samplingInterval,
        queueSize: 10,
        discardOldest: true
      };
      
      this.activeSubscriptions.set(subscriptionId, subscription);
      this.opcuaMetrics.subscriptions++;
      this.opcuaMetrics.activeSubscriptions++;
      
      // Start simulated subscription updates
      this.startSubscriptionUpdates(subscription);
      
      return subscriptionId;
    } catch (error) {
      this.opcuaMetrics.errors++;
      throw error;
    }
  }

  async unsubscribeFromNode(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (subscription) {
        subscription.active = false;
        this.activeSubscriptions.delete(subscriptionId);
        this.opcuaMetrics.activeSubscriptions--;
        
        // console.log(`🔌 Unsubscribed from OPC UA node: ${subscription.nodeId}`);
      }
    } catch (error) {
      this.opcuaMetrics.errors++;
      throw error;
    }
  }

  // Utility methods
  getOPCUAOptions(): OPCUAOptions {
    return this.opcuaOptions;
  }

  getOPCUAMetrics(): OPCUAMetrics {
    if (this.connectionStartTime > 0) {
      this.opcuaMetrics.connectionUptime = Date.now() - this.connectionStartTime;
    }
    return { ...this.opcuaMetrics };
  }

  getMessageBuffer(): OPCUAMessage[] {
    return [...this.messageBuffer];
  }

  clearMessageBuffer(): void {
    this.messageBuffer = [];
  }

  // Private helper methods
  private startSubscriptionUpdates(subscription: OPCUASubscription): void {
    const updateInterval = setInterval(() => {
      if (!subscription.active) {
        clearInterval(updateInterval);
        return;
      }
      
      // Simulate periodic updates
      const message: OPCUAMessage = {
        nodeId: subscription.nodeId,
        value: Math.random() * 100,
        timestamp: new Date(),
        quality: 'Good',
        sourceTimestamp: new Date(),
        serverTimestamp: new Date()
      };
      
      subscription.callback(message);
      
      // Add to buffer
      this.messageBuffer.push(message);
      if (this.messageBuffer.length > this.bufferSize) {
        this.messageBuffer.shift();
      }
    }, subscription.samplingInterval);
  }

  // Simulation methods for testing
  private simulateBrowse(nodeId: string): any {
    return this.browseNodes(nodeId);
  }

  private simulateRead(nodeId: string): any {
    return this.readNode(nodeId);
  }

  private simulateWrite(nodeId: string, value: any): void {
    this.writeNode(nodeId, value);
  }

  private async simulateSubscribe(nodeId: string, callback: (data: any) => void): Promise<string> {
    return await this.subscribeToNode(nodeId, callback);
  }

  private simulateUnsubscribe(subscriptionId: string): void {
    this.unsubscribeFromNode(subscriptionId);
  }

  // Check if there are stored connections that need restoration
  async hasStoredConnections(): Promise<boolean> {
    try {
      const storedConfigs = await this.db.getAllConnectionConfigs();
      const opcuaConfigs = storedConfigs.filter(config => config.type === 'opcua');
      return opcuaConfigs.length > 0;
    } catch (error) {
      console.error('Error checking for stored connections:', error);
      return false;
    }
  }
}

// OPC UA Universal Manager with bulk operations
export class OPCUAUniversalManager {
  private connections: Map<string, OPCUAConnector> = new Map();
  private db: UniversalConnectorDB;

  constructor() {
    this.db = new UniversalConnectorDB();
    // Initialize the database
    this.db.initialize().catch(error => {
      console.error('Failed to initialize OPC UA database:', error);
    });
    
    // Test database functionality after a short delay
    setTimeout(() => {
      this.testDatabase();
    }, 500);
    
    // Restore connections from IndexedDB after ensuring DB is ready
    this.waitForDatabaseAndRestore();
  }

  // Wait for database to be ready before restoring connections
  private async waitForDatabaseAndRestore(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 20; // Increase max attempts
    
    // console.log('⏳ OPCUAUniversalManager: Waiting for database to be ready...');
    
    while (attempts < maxAttempts) {
      try {
        // Try to access the database to see if it's ready
        const configs = await this.db.getAllConnectionConfigs();
        // console.log(`✅ OPC UA database is ready, found ${configs.length} stored configs`);
        // console.log('📋 Stored configs:', configs);
        
        await this.restoreConnectionsFromStorage();
        break;
      } catch (error) {
        attempts++;
        // console.log(`⏳ Waiting for OPC UA database to be ready... (attempt ${attempts}/${maxAttempts})`);
        // console.log('❌ Database error:', error);
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error('❌ Failed to restore OPC UA connections after multiple attempts');
        }
      }
    }
  }

  // Restore connections from IndexedDB storage
  private async restoreConnectionsFromStorage(): Promise<void> {
    try {
      // console.log('🔄 Restoring OPC UA connections from IndexedDB...');
      const storedConfigs = await this.db.getAllConnectionConfigs();
      const opcuaConfigs = storedConfigs.filter(config => config.type === 'opcua');
      
      // console.log(`📦 Found ${opcuaConfigs.length} stored OPC UA connections:`, opcuaConfigs);
      
      for (const storedConfig of opcuaConfigs) {
        try {
          // console.log(`🔄 Attempting to restore OPC UA connection: ${storedConfig.name} (${storedConfig.id})`);
          // console.log('📋 Stored config:', storedConfig);
          
          // Recreate the connector from stored config
          const connector = new OPCUAConnector(storedConfig.config, storedConfig.config.opcuaOptions || {});
          this.connections.set(storedConfig.id, connector);
          
          // console.log(`✅ Successfully created connector for: ${storedConfig.name}`);
          
          // Check if the connection was previously connected and restore its state
          if (storedConfig.connectionStatus === 'connected' && storedConfig.enabled) {
            try {
              // console.log(`🔄 Attempting to reconnect: ${storedConfig.name} (${storedConfig.id})`);
              await connector.connect();
              // console.log(`✅ Successfully reconnected: ${storedConfig.name} (${storedConfig.id})`);
            } catch (error) {
              console.warn(`⚠️ Failed to reconnect ${storedConfig.name} (${storedConfig.id}):`, error);
            }
          }
          
          // console.log(`✅ Restored OPC UA connection: ${storedConfig.name} (${storedConfig.id})`);
          
          // Publish event for restored connection
          globalEventBus.publish('opcua.manager.connection.restored', {
            connectionId: storedConfig.id,
            config: storedConfig.config,
            timestamp: new Date()
          });
          
        } catch (error) {
          console.error(`❌ Failed to restore OPC UA connection ${storedConfig.id}:`, error);
        }
      }
      
      // console.log(`✅ Restored ${this.connections.size} OPC UA connections from storage`);
      
    } catch (error) {
      console.error('❌ Error restoring OPC UA connections from storage:', error);
    }
  }

  // Get database instance for external access
  getDatabase(): UniversalConnectorDB {
    return this.db;
  }

  // Create and manage connections
  async createConnection(id: string, config: ConnectionConfig, options: OPCUAOptions = {}): Promise<OPCUAConnector> {
    // console.log(`🔄 OPCUAUniversalManager: Creating connection ${id} with config:`, config);
    // console.log(`🔧 OPCUA options:`, options);
    
    const connector = new OPCUAConnector(config, options);
    this.connections.set(id, connector);
    
    // console.log(`✅ Connector created and added to connections map. Total connections: ${this.connections.size}`);
    
    // Store in IndexedDB
    try {
      const connectionConfig = {
        id,
        name: config.name,
        type: 'opcua',
        config: { ...config, opcuaOptions: options },
        enabled: config.enabled,
        lastConnection: undefined,
        connectionStatus: 'disconnected' as const,
        errorCount: 0,
        metadata: {
          securityMode: options.securityMode,
          securityPolicy: options.securityPolicy,
          authentication: options.authentication,
          protocol: 'OPC UA'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // console.log(`💾 Saving connection config to IndexedDB:`, connectionConfig);
      await this.db.saveConnectionConfig(connectionConfig);
      // console.log(`✅ Successfully saved connection config to IndexedDB`);
      
    } catch (error) {
      console.error(`❌ Failed to save connection config to IndexedDB:`, error);
    }
    
    globalEventBus.publish('opcua.manager.connection.created', { 
      connectionId: id,
      config,
      options,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<OPCUAConnector | undefined> {
    return this.connections.get(id);
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(id);
      
      // Remove from IndexedDB
      await this.db.deleteConnectionConfig(id);
      
      globalEventBus.publish('opcua.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, OPCUAConnector>> {
    return new Map(this.connections);
  }

  // Get all connections with their current status
  async getAllConnectionsWithStatus(): Promise<Array<{
    id: string;
    name: string;
    connector: OPCUAConnector;
    status: 'connected' | 'disconnected';
    lastConnection?: Date;
    errorCount: number;
  }>> {
    const connectionsWithStatus: Array<{
      id: string;
      name: string;
      connector: OPCUAConnector;
      status: 'connected' | 'disconnected';
      lastConnection?: Date;
      errorCount: number;
    }> = [];

    for (const [id, connector] of Array.from(this.connections.entries())) {
      try {
        const status = connector.isConnected() ? 'connected' : 'disconnected';
        const config = connector.getConfig();
        
        // Get additional info from IndexedDB if available
        let lastConnection: Date | undefined;
        let errorCount = 0;
        
        try {
          const storedConfig = await this.db.getConnectionConfig(id);
          if (storedConfig) {
            lastConnection = storedConfig.lastConnection;
            errorCount = storedConfig.errorCount;
          }
        } catch (error) {
          // Ignore errors when getting stored config
        }

        connectionsWithStatus.push({
          id,
          name: config.name,
          connector,
          status,
          lastConnection,
          errorCount
        });
      } catch (error) {
        console.error(`Error getting status for connection ${id}:`, error);
      }
    }

    return connectionsWithStatus;
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
    
    for (const [id, connection] of Array.from(this.connections.entries())) {
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
    
    for (const [id, connection] of Array.from(this.connections.entries())) {
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
    
    for (const [id, connection] of Array.from(this.connections.entries())) {
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
      if (data.config && data.config.type === 'opcua') {
        const connector = new OPCUAConnector(data.config, data.config.opcuaOptions || {});
        this.connections.set(id, connector);
        
        // Store in IndexedDB
        await this.db.saveConnectionConfig({
          id,
          name: data.config.name,
          type: 'opcua',
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
    for (const connection of Array.from(this.connections.values())) {
      await connection.destroy();
    }
    this.connections.clear();
  }

  // Test database functionality
  async testDatabase(): Promise<void> {
    try {
      // console.log('🧪 Testing OPC UA database functionality...');
      
      // Test getting all configs
      const allConfigs = await this.db.getAllConnectionConfigs();
      // console.log(`📊 Total stored configs: ${allConfigs.length}`);
      
      // Test getting OPC UA configs specifically
      const opcuaConfigs = allConfigs.filter(config => config.type === 'opcua');
      // console.log(`🔌 OPC UA configs: ${opcuaConfigs.length}`);
      
      // Log each config
      opcuaConfigs.forEach((config, index) => {
        // console.log(`📋 Config ${index + 1}:`, {
        //   id: config.id,
        //   name: config.name,
        //   type: config.type,
        //   enabled: config.enabled,
        //   connectionStatus: config.connectionStatus
        // });
      });
      
      // console.log('✅ Database test completed successfully');
      
    } catch (error) {
      console.error('❌ Database test failed:', error);
    }
  }

  // Check if there are stored connections that need restoration
  async hasStoredConnections(): Promise<boolean> {
    try {
      const storedConfigs = await this.db.getAllConnectionConfigs();
      const opcuaConfigs = storedConfigs.filter(config => config.type === 'opcua');
      return opcuaConfigs.length > 0;
    } catch (error) {
      console.error('Error checking for stored connections:', error);
      return false;
    }
  }

  // Get count of stored connections
  async getStoredConnectionCount(): Promise<number> {
    try {
      const storedConfigs = await this.db.getAllConnectionConfigs();
      const opcuaConfigs = storedConfigs.filter(config => config.type === 'opcua');
      return opcuaConfigs.length;
    } catch (error) {
      console.error('Error getting stored connection count:', error);
      return 0;
    }
  }
}

// Global OPC UA universal manager instance
export const globalOPCUAUniversalManager = new OPCUAUniversalManager();
