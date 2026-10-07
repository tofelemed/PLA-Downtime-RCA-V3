import { globalEventBus } from '../events/EventBus';
import { UniversalConnectorDB } from '../storage/UniversalConnectorDB';

export interface MonitoredNode {
  id: string;
  nodeId: string;
  displayName: string;
  dataType: string;
  value: any;
  timestamp: Date;
  quality: 'Good' | 'Uncertain' | 'Bad';
  status: 'Active' | 'Inactive' | 'Error';
  samplingInterval: number;
  subscriptionId?: string;
  metadata?: Record<string, any>;
  connectionId: string;
  lastError?: string;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NodeSubscription {
  id: string;
  nodeId: string;
  callback: (data: OPCUAMessage) => void;
  active: boolean;
  samplingInterval: number;
  lastUpdate: Date;
  errorCount: number;
}

export interface OPCUAMessage {
  nodeId: string;
  value: any;
  timestamp: Date;
  quality: 'Good' | 'Uncertain' | 'Bad';
  sourceTimestamp?: Date;
  serverTimestamp?: Date;
  metadata?: Record<string, any>;
}

export interface MonitoringConfig {
  autoReconnect: boolean;
  maxRetries: number;
  retryDelay: number;
  bufferSize: number;
  qualityThreshold: 'Good' | 'Uncertain' | 'Bad';
  enablePersistence: boolean;
  maxHistorySize: number;
}

export class OPCUAMonitoringService {
  private monitoredNodes: Map<string, MonitoredNode> = new Map();
  private activeSubscriptions: Map<string, NodeSubscription> = new Map();
  private db: UniversalConnectorDB;
  private config: MonitoringConfig;
  private isRunning: boolean = false;
  private simulationTimer?: NodeJS.Timeout;
  private updateTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      autoReconnect: true,
      maxRetries: 3,
      retryDelay: 5000,
      bufferSize: 1000,
      qualityThreshold: 'Good',
      enablePersistence: true,
      maxHistorySize: 10000,
      ...config
    };

    this.db = new UniversalConnectorDB();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.db.initialize();
      
      // Restore monitored nodes from storage
      if (this.config.enablePersistence) {
        await this.restoreMonitoredNodes();
      }

      // Start monitoring service
      this.startMonitoring();
      
      // console.log('🔍 OPC UA Monitoring Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OPC UA Monitoring Service:', error);
    }
  }

  // Start the monitoring service
  private startMonitoring(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Start simulation timer for demo purposes
    this.startSimulation();
    
    // Start health check timer
    this.startHealthCheck();
    
    // Start periodic updates (separate from simulation)
    this.startPeriodicUpdates();

    // console.log('🚀 OPC UA Monitoring Service started');
  }

  // Start simulation for demo purposes
  private startSimulation(): void {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
    }
    
    this.simulationTimer = setInterval(() => {
      this.simulateDataUpdates();
    }, 2000); // Update every 2 seconds
    
    // console.log('🎭 Started OPC UA data simulation');
  }

  // Start periodic updates
  private startPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    this.updateTimer = setInterval(() => {
      this.updateMonitoredNodes();
    }, 1000);
  }

  // Start health check timer
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  // Simulate realistic OPC UA data updates
  private simulateDataUpdates(): void {
    const now = new Date();
    let updatedCount = 0;
    
    for (const [nodeId, node] of this.monitoredNodes.entries()) {
      // Update all nodes regardless of status for demo purposes
      if (node.status === 'Active' || node.status === 'Error' || node.status === 'Inactive') {
        try {
          let newValue: any;
          let newQuality: 'Good' | 'Uncertain' | 'Bad' = 'Good';
          
          // Simulate realistic data changes based on node type
          if (node.displayName.includes('Temperature')) {
            // Temperature: fluctuate around 20-30°C with some noise
            const baseTemp = 25;
            const noise = (Math.random() - 0.5) * 2;
            newValue = Math.max(15, Math.min(35, baseTemp + noise));
            
            // Occasionally introduce quality issues
            if (Math.random() < 0.05) {
              newQuality = 'Uncertain';
            }
          } else if (node.displayName.includes('Pressure')) {
            // Pressure: fluctuate around 2.0-3.0 bar with more variation
            const basePressure = 2.5;
            const noise = (Math.random() - 0.5) * 0.4;
            newValue = Math.max(1.8, Math.min(3.2, basePressure + noise));
            
            // Occasionally introduce quality issues
            if (Math.random() < 0.03) {
              newQuality = 'Uncertain';
            }
          } else if (node.displayName.includes('Status')) {
            // Status: cycle through different states more frequently
            const states = ['Running', 'Idle', 'Maintenance', 'Error'];
            const currentIndex = states.indexOf(node.value as string);
            // 30% chance to change state each update
            if (Math.random() < 0.3) {
              const nextIndex = (currentIndex + 1) % states.length;
              newValue = states[nextIndex];
            } else {
              newValue = node.value; // Keep current state
            }
            
            // Status changes can be uncertain during transitions
            if (Math.random() < 0.15) {
              newQuality = 'Uncertain';
            }
          } else {
            // Generic numeric values
            newValue = node.value + (Math.random() - 0.5) * 0.1;
          }
          
          // Simulate the node update
          this.handleNodeUpdate(nodeId, {
            nodeId: node.nodeId,
            value: newValue,
            timestamp: now,
            quality: newQuality,
            sourceTimestamp: now,
            serverTimestamp: now
          });
          
          updatedCount++;
          
        } catch (error) {
          console.error(`❌ Error simulating update for node ${node.displayName}:`, error);
        }
      }
    }
    
    if (updatedCount > 0) {
      // console.log(`🎭 Simulated updates for ${updatedCount} nodes at ${now.toLocaleTimeString()}`);
    }
  }

  // Stop the monitoring service
  private stopMonitoring(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = undefined;
    }
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // console.log('⏹️ OPC UA Monitoring Service stopped');
  }

  // Add a new node to monitor
  async addMonitoredNode(node: Omit<MonitoredNode, 'id' | 'createdAt' | 'updatedAt' | 'errorCount'>): Promise<string> {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const monitoredNode: MonitoredNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
      errorCount: 0
    };

    this.monitoredNodes.set(id, monitoredNode);
    
    // Create subscription if node is active
    if (node.status === 'Active') {
      await this.createSubscription(monitoredNode);
    }

    // Persist to storage
    if (this.config.enablePersistence) {
      await this.persistMonitoredNode(monitoredNode);
    }

    // Publish event
    globalEventBus.publish('opcua:node:added', { node: monitoredNode });

    // console.log(`➕ Added monitored node: ${node.displayName} (${node.nodeId})`);
    return id;
  }

  // Remove a monitored node
  async removeMonitoredNode(nodeId: string): Promise<void> {
    const node = this.monitoredNodes.get(nodeId);
    if (!node) return;

    // Remove subscription
    if (node.subscriptionId) {
      await this.removeSubscription(node.subscriptionId);
    }

    // Remove from monitoring
    this.monitoredNodes.delete(nodeId);

    // Remove from storage
    if (this.config.enablePersistence) {
      await this.removeMonitoredNodeFromStorage(nodeId);
    }

    // Publish event
    globalEventBus.publish('opcua:node:removed', { nodeId, node });

    // console.log(`➖ Removed monitored node: ${node.displayName} (${node.nodeId})`);
  }

  // Update monitored node configuration
  async updateMonitoredNode(nodeId: string, updates: Partial<MonitoredNode>): Promise<void> {
    const node = this.monitoredNodes.get(nodeId);
    if (!node) return;

    const updatedNode = {
      ...node,
      ...updates,
      updatedAt: new Date()
    };

    this.monitoredNodes.set(nodeId, updatedNode);

    // Handle status changes
    if (updates.status !== undefined && updates.status !== node.status) {
      if (updates.status === 'Active') {
        await this.createSubscription(updatedNode);
      } else if (node.subscriptionId) {
        await this.removeSubscription(node.subscriptionId);
      }
    }

    // Persist changes
    if (this.config.enablePersistence) {
      await this.persistMonitoredNode(updatedNode);
    }

    // Publish event
    globalEventBus.publish('opcua:node:updated', { nodeId, node: updatedNode, previous: node });
  }

  // Get all monitored nodes
  getMonitoredNodes(): MonitoredNode[] {
    return Array.from(this.monitoredNodes.values());
  }

  // Get monitored node by ID
  getMonitoredNode(nodeId: string): MonitoredNode | undefined {
    return this.monitoredNodes.get(nodeId);
  }

  // Get monitored nodes by connection
  getMonitoredNodesByConnection(connectionId: string): MonitoredNode[] {
    return Array.from(this.monitoredNodes.values())
      .filter(node => node.connectionId === connectionId);
  }

  // Create subscription for a node
  private async createSubscription(node: MonitoredNode): Promise<void> {
    try {
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const subscription: NodeSubscription = {
        id: subscriptionId,
        nodeId: node.nodeId,
        callback: (data: OPCUAMessage) => this.handleNodeUpdate(node.id, data),
        active: true,
        samplingInterval: node.samplingInterval,
        lastUpdate: new Date(),
        errorCount: 0
      };

      this.activeSubscriptions.set(subscriptionId, subscription);

      // Update node with subscription ID
      await this.updateMonitoredNode(node.id, { subscriptionId });

      // console.log(`📡 Created subscription for node: ${node.displayName}`);
    } catch (error) {
      console.error(`❌ Failed to create subscription for node ${node.displayName}:`, error);
      await this.updateMonitoredNode(node.id, { 
        status: 'Error', 
        lastError: error instanceof Error ? error.message : 'Unknown error',
        errorCount: (node.errorCount || 0) + 1
      });
    }
  }

  // Remove subscription
  private async removeSubscription(subscriptionId: string): Promise<void> {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.active = false;
    this.activeSubscriptions.delete(subscriptionId);

    // Find and update the associated node
    for (const [nodeId, node] of this.monitoredNodes.entries()) {
      if (node.subscriptionId === subscriptionId) {
        await this.updateMonitoredNode(nodeId, { subscriptionId: undefined });
        break;
      }
    }

    // console.log(`🔌 Removed subscription: ${subscriptionId}`);
  }

  // Handle node updates from subscriptions
  private async handleNodeUpdate(nodeId: string, data: OPCUAMessage): Promise<void> {
    const node = this.monitoredNodes.get(nodeId);
    if (!node) return;

    const updatedNode: MonitoredNode = {
      ...node,
      value: data.value,
      timestamp: data.timestamp,
      quality: data.quality,
      updatedAt: new Date(),
      errorCount: 0, // Reset error count on successful update
      lastError: undefined
    };

    // Update status based on quality - be more lenient for demo
    if (data.quality === 'Bad') {
      updatedNode.status = 'Error';
    } else if (data.quality === 'Uncertain') {
      // For demo purposes, keep Uncertain nodes as Active
      updatedNode.status = 'Active';
    } else {
      updatedNode.status = 'Active';
    }

    this.monitoredNodes.set(nodeId, updatedNode);

    // Persist update
    if (this.config.enablePersistence) {
      await this.persistMonitoredNode(updatedNode);
    }

    // Publish event
    globalEventBus.publish('opcua:node:updated', { 
      nodeId, 
      node: updatedNode, 
      update: data 
    });
  }

  // Update monitored nodes (simulated for now)
  private updateMonitoredNodes(): void {
    if (!this.isRunning) return;

    this.monitoredNodes.forEach((node, nodeId) => {
      if (node.status === 'Active' && node.subscriptionId) {
        // Simulate real-time updates
        this.simulateNodeUpdate(nodeId);
      }
    });
  }

  // Simulate node updates (replace with actual OPC UA subscription handling)
  private simulateNodeUpdate(nodeId: string): void {
    const node = this.monitoredNodes.get(nodeId);
    if (!node) return;

    // Generate realistic simulated data
    let newValue = node.value;
    let newQuality: 'Good' | 'Uncertain' | 'Bad' = 'Good';

    try {
      switch (node.dataType) {
        case 'Double':
          if (node.displayName.includes('Temperature')) {
            // Temperature: 20-30°C with small variations
            newValue = Math.max(20, Math.min(30, node.value + (Math.random() - 0.5) * 2));
          } else if (node.displayName.includes('Pressure')) {
            // Pressure: 2.0-3.0 bar with small variations
            newValue = Math.max(2.0, Math.min(3.0, node.value + (Math.random() - 0.5) * 0.2));
          } else {
            // Generic numeric: random variation
            newValue = node.value + (Math.random() - 0.5) * 10;
          }
          break;
        case 'String':
          if (node.displayName.includes('Status')) {
            // Status: cycle through states
            const states = ['Running', 'Idle', 'Maintenance', 'Error'];
            if (Math.random() < 0.1) { // 10% chance to change state
              newValue = states[Math.floor(Math.random() * states.length)];
            }
          }
          break;
        case 'Boolean':
          // Boolean: flip occasionally
          if (Math.random() < 0.05) {
            newValue = !node.value;
          }
          break;
      }

      // Occasionally introduce quality issues
      if (Math.random() < 0.02) { // 2% chance
        newQuality = Math.random() < 0.7 ? 'Uncertain' : 'Bad';
      }

      const simulatedData: OPCUAMessage = {
        nodeId: node.nodeId,
        value: newValue,
        timestamp: new Date(),
        quality: newQuality,
        metadata: { simulated: true }
      };

      this.handleNodeUpdate(nodeId, simulatedData);
    } catch (error) {
      console.error(`❌ Error simulating update for node ${nodeId}:`, error);
    }
  }

  // Perform health check on all monitored nodes
  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    const healthIssues: string[] = [];

    for (const [nodeId, node] of this.monitoredNodes.entries()) {
      // Check for stale data - be more lenient for demo purposes
      const timeSinceUpdate = now.getTime() - node.timestamp.getTime();
      const maxStaleTime = node.samplingInterval * 10; // 10x sampling interval for demo

      if (timeSinceUpdate > maxStaleTime && node.status === 'Active') {
        await this.updateMonitoredNode(nodeId, { 
          status: 'Error', 
          lastError: 'Data stale',
          errorCount: node.errorCount + 1
        });
        healthIssues.push(`Node ${node.displayName} has stale data`);
      }

      // Check error count threshold - be more lenient for demo
      if (node.errorCount > this.config.maxRetries * 2) {
        await this.updateMonitoredNode(nodeId, { status: 'Inactive' });
        healthIssues.push(`Node ${node.displayName} exceeded error threshold`);
      }

      // Auto-recover nodes from Error status if they get updates
      if (node.status === 'Error' && node.errorCount < 3) {
        // Allow recovery for demo purposes
        // console.log(`🔄 Auto-recovering node ${node.displayName} from Error status`);
      }
    }

    if (healthIssues.length > 0) {
      console.warn('⚠️ Health check issues detected:', healthIssues);
      globalEventBus.publish('opcua:health:issues', { issues: healthIssues, timestamp: now });
    }
  }

  // Persistence methods
  private async persistMonitoredNode(node: MonitoredNode): Promise<void> {
    try {
      await this.db.saveConnectionConfig({
        id: `monitored_node_${node.id}`,
        name: node.displayName,
        type: 'opcua_monitored_node',
        endpoint: node.nodeId,
        config: {
          ...node,
          timestamp: node.timestamp.toISOString(),
          createdAt: node.createdAt.toISOString(),
          updatedAt: node.updatedAt.toISOString()
        }
      });
    } catch (error) {
      console.error(`❌ Failed to persist monitored node ${node.id}:`, error);
    }
  }

  private async removeMonitoredNodeFromStorage(nodeId: string): Promise<void> {
    try {
      await this.db.deleteConnectionConfig(`monitored_node_${nodeId}`);
    } catch (error) {
      console.error(`❌ Failed to remove monitored node ${nodeId} from storage:`, error);
    }
  }

  private async restoreMonitoredNodes(): Promise<void> {
    try {
      const configs = await this.db.getAllConnectionConfigs();
      const monitoredNodeConfigs = configs.filter(config => config.type === 'opcua_monitored_node');

      for (const config of monitoredNodeConfigs) {
        try {
          const nodeData = config.config as any;
          const node: MonitoredNode = {
            ...nodeData,
            timestamp: new Date(nodeData.timestamp),
            createdAt: new Date(nodeData.createdAt),
            updatedAt: new Date(nodeData.updatedAt)
          };

          this.monitoredNodes.set(node.id, node);
          
          // Restore subscription if node was active
          if (node.status === 'Active') {
            await this.createSubscription(node);
          }
        } catch (error) {
          console.error(`❌ Failed to restore monitored node from config:`, error);
        }
      }

      // console.log(`📥 Restored ${monitoredNodeConfigs.length} monitored nodes from storage`);
    } catch (error) {
      console.error('❌ Failed to restore monitored nodes:', error);
    }
  }

  // Get monitoring statistics
  getMonitoringStats(): {
    totalNodes: number;
    activeNodes: number;
    inactiveNodes: number;
    errorNodes: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    lastUpdate: Date;
  } {
    const nodes = Array.from(this.monitoredNodes.values());
    const subscriptions = Array.from(this.activeSubscriptions.values());

    return {
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => n.status === 'Active').length,
      inactiveNodes: nodes.filter(n => n.status === 'Inactive').length,
      errorNodes: nodes.filter(n => n.status === 'Error').length,
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.active).length,
      lastUpdate: new Date()
    };
  }

  // Export monitoring data
  exportMonitoringData(): string {
    const data = {
      timestamp: new Date().toISOString(),
      config: this.config,
      stats: this.getMonitoringStats(),
      nodes: Array.from(this.monitoredNodes.values()).map(node => ({
        ...node,
        timestamp: node.timestamp.toISOString(),
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString()
      }))
    };

    return JSON.stringify(data, null, 2);
  }

  // Reset all nodes to Active status for demo purposes
  async resetAllNodesToActive(): Promise<void> {
    // console.log('🔄 Resetting all nodes to Active status...');
    
    for (const [nodeId, node] of this.monitoredNodes.entries()) {
      if (node.status !== 'Active') {
        await this.updateMonitoredNode(nodeId, {
          status: 'Active',
          errorCount: 0,
          lastError: undefined,
          timestamp: new Date(),
          quality: 'Good'
        });
        // console.log(`✅ Reset node ${node.displayName} to Active status`);
      }
    }
    
    // console.log('✅ All nodes reset to Active status');
  }

  // Force refresh all nodes with new simulated data
  async forceRefreshAllNodes(): Promise<void> {
    // console.log('🔄 Force refreshing all nodes with new simulated data...');
    
    const now = new Date();
    
    for (const [nodeId, node] of this.monitoredNodes.entries()) {
      try {
        let newValue: any;
        let newQuality: 'Good' | 'Uncertain' | 'Bad' = 'Good';
        
        // Generate fresh simulated data
        if (node.displayName.includes('Temperature')) {
          newValue = Math.max(20, Math.min(30, 25 + (Math.random() - 0.5) * 4));
        } else if (node.displayName.includes('Pressure')) {
          newValue = Math.max(2.0, Math.min(3.0, 2.5 + (Math.random() - 0.5) * 0.6));
        } else if (node.displayName.includes('Status')) {
          const states = ['Running', 'Idle', 'Maintenance'];
          newValue = states[Math.floor(Math.random() * states.length)];
        } else {
          newValue = node.value;
        }
        
        // Update the node with fresh data
        await this.updateMonitoredNode(nodeId, {
          status: 'Active',
          value: newValue,
          timestamp: now,
          quality: newQuality,
          errorCount: 0,
          lastError: undefined
        });
        
        // console.log(`✅ Refreshed node ${node.displayName}: ${newValue}`);
      } catch (error) {
        console.error(`❌ Failed to refresh node ${node.displayName}:`, error);
      }
    }
    
    // console.log('✅ All nodes refreshed with new simulated data');
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    
    // Clear all subscriptions
    for (const subscription of this.activeSubscriptions.values()) {
      subscription.active = false;
    }
    this.activeSubscriptions.clear();

    // console.log('🧹 OPC UA Monitoring Service cleaned up');
  }
}

// Global instance
export const globalOPCUAMonitoringService = new OPCUAMonitoringService();
