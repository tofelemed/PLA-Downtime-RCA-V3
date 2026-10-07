import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  BarChart3
} from 'lucide-react';
import { globalProtocolManager } from '@/services/integrations/ProtocolManager';
import { globalOPCUAMonitoringService, MonitoredNode } from '@/services/opcua/OPCUAMonitoringService';
import { globalEventBus } from '@/services/events/EventBus';



interface NodeConfig {
  nodeId: string;
  displayName: string;
  dataType: string;
  samplingInterval: number;
  includeMetadata: boolean;
}

export const OPCUAMonitor: React.FC = () => {
  console.log('🚀 OPCUAMonitor component rendering...');
  
  const [monitoredNodes, setMonitoredNodes] = useState<MonitoredNode[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('default');
  const [availableConnections, setAvailableConnections] = useState<Array<{id: string, name: string, type: string}>>([]);
  const [nodeConfig, setNodeConfig] = useState<NodeConfig>({
    nodeId: '',
    displayName: '',
    dataType: 'Double',
    samplingInterval: 1000,
    includeMetadata: false
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [monitoringStats, setMonitoringStats] = useState({
    totalNodes: 0,
    activeNodes: 0,
    errorNodes: 0,
    lastUpdate: new Date(),
    updateRate: 0
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available OPC UA connections
  useEffect(() => {
    console.log('🔌 Loading OPC UA connections...');
    
    try {
      if (!globalProtocolManager) {
        throw new Error('Protocol Manager not available');
      }
      
      const connections = globalProtocolManager.getAllConnections();
      console.log(`📊 Found ${connections.size} total connections`);
      
      const opcuaConnections = Array.from(connections.values())
        .filter(conn => conn.type === 'opcua')
        .map(conn => ({ id: conn.id, name: conn.name, type: conn.type }));
      
      console.log(`🔌 Found ${opcuaConnections.length} OPC UA connections:`, opcuaConnections);
      
      setAvailableConnections(opcuaConnections);
      if (opcuaConnections.length > 0) {
        setSelectedConnection(opcuaConnections[0].id);
        console.log(`✅ Selected connection: ${opcuaConnections[0].name}`);
      } else {
        console.log('⚠️ No OPC UA connections found');
      }
    } catch (error) {
      console.error('❌ Error loading connections:', error);
      setError(`Failed to load OPC UA connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Initialize with default monitored nodes from service
  useEffect(() => {
    const initializeDefaultNodes = async () => {
      try {
        console.log('🔄 Initializing OPC UA Monitor...');
        
        // Wait a bit for the monitoring service to be ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if monitoring service is available
        if (!globalOPCUAMonitoringService) {
          throw new Error('OPC UA Monitoring Service not available');
        }
        
        console.log('✅ Monitoring service available, checking for existing nodes...');
        
        // Check if we already have monitored nodes
        const existingNodes = globalOPCUAMonitoringService.getMonitoredNodes();
        console.log(`📊 Found ${existingNodes.length} existing monitored nodes`);
        
        if (existingNodes.length === 0) {
          console.log('➕ Adding default monitored nodes...');
          // Add default nodes if none exist
          const defaultNodes = [
            {
              nodeId: 'ns=2;s=Device1.Temperature',
              displayName: 'Device1.Temperature',
              dataType: 'Double',
              value: 24.5,
              timestamp: new Date(),
              quality: 'Good' as const,
              status: 'Active' as const,
              samplingInterval: 1000,
              connectionId: selectedConnection
            },
            {
              nodeId: 'ns=2;s=Device1.Pressure',
              displayName: 'Device1.Pressure',
              dataType: 'Double',
              value: 2.4,
              timestamp: new Date(),
              quality: 'Good' as const,
              status: 'Active' as const,
              samplingInterval: 1000,
              connectionId: selectedConnection
            },
            {
              nodeId: 'ns=2;s=Device1.Status',
              displayName: 'Device1.Status',
              dataType: 'String',
              value: 'Running',
              timestamp: new Date(),
              quality: 'Good' as const,
              status: 'Active' as const,
              samplingInterval: 1000,
              connectionId: selectedConnection
            }
          ];

          for (const nodeConfig of defaultNodes) {
            try {
              await globalOPCUAMonitoringService.addMonitoredNode(nodeConfig);
              console.log(`✅ Added node: ${nodeConfig.displayName}`);
            } catch (nodeError) {
              console.error(`❌ Failed to add node ${nodeConfig.displayName}:`, nodeError);
            }
          }
        }

        // Load current nodes
        const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
        console.log(`📊 Loaded ${nodes.length} monitored nodes`);
        setMonitoredNodes(nodes);
        updateMonitoringStats(nodes);
        setIsInitialized(true);
        console.log('✅ OPC UA Monitor initialization complete');
      } catch (error) {
        console.error('❌ Failed to initialize default nodes:', error);
        setError(`Failed to initialize monitoring service: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Set some default nodes for display even if service fails
        const fallbackNodes = [
          {
            id: '1',
            nodeId: 'ns=2;s=Device1.Temperature',
            displayName: 'Device1.Temperature',
            dataType: 'Double',
            value: 24.5,
            timestamp: new Date(),
            quality: 'Good' as const,
            status: 'Active' as const,
            samplingInterval: 1000,
            connectionId: selectedConnection,
            errorCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '2',
            nodeId: 'ns=2;s=Device1.Pressure',
            displayName: 'Device1.Pressure',
            dataType: 'Double',
            value: 2.4,
            timestamp: new Date(),
            quality: 'Good' as const,
            status: 'Active' as const,
            samplingInterval: 1000,
            connectionId: selectedConnection,
            errorCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '3',
            nodeId: 'ns=2;s=Device1.Status',
            displayName: 'Device1.Status',
            dataType: 'String',
            value: 'Running',
            timestamp: new Date(),
            quality: 'Good' as const,
            status: 'Active' as const,
            samplingInterval: 1000,
            connectionId: selectedConnection,
            errorCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        setMonitoredNodes(fallbackNodes);
        updateMonitoringStats(fallbackNodes);
        setIsInitialized(true);
        console.log('✅ Fallback nodes set, monitor ready');
      }
    };

    initializeDefaultNodes();
  }, [selectedConnection]);

  // Real-time monitoring from service
  useEffect(() => {
    if (!isMonitoring) return;

    console.log('🔄 Starting real-time monitoring...');
    
    const interval = setInterval(() => {
      try {
        // Get latest data from service
        const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
        const activeCount = nodes.filter(n => n.status === 'Active').length;
        const errorCount = nodes.filter(n => n.status === 'Error').length;
        
        if (activeCount !== monitoringStats.activeNodes || errorCount !== monitoringStats.errorNodes) {
          console.log(`📊 Status change detected: Active: ${activeCount}, Error: ${errorCount}`);
        }
        
        setMonitoredNodes(nodes);
        updateMonitoringStats(nodes);
      } catch (error) {
        console.error('❌ Error updating monitored nodes:', error);
        // Continue monitoring even if there's an error
      }
    }, refreshInterval);

    console.log(`✅ Real-time monitoring started with ${refreshInterval}ms interval`);

    return () => {
      console.log('⏹️ Stopping real-time monitoring...');
      clearInterval(interval);
    };
  }, [isMonitoring, refreshInterval, monitoringStats.activeNodes, monitoringStats.errorNodes]);

  // Listen for real-time updates from the monitoring service
  useEffect(() => {
    console.log('📡 Setting up EventBus subscriptions...');
    
    try {
      const subscriptionAdded = globalEventBus.subscribe('opcua:node:added', (event) => {
        try {
          console.log('📡 Received node added event:', event);
          const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
          console.log(`📊 Node added - Total nodes: ${nodes.length}`);
          setMonitoredNodes(nodes);
          updateMonitoringStats(nodes);
        } catch (error) {
          console.error('❌ Error handling node added event:', error);
        }
      });

      const subscriptionUpdated = globalEventBus.subscribe('opcua:node:updated', (event) => {
        try {
          console.log('📡 Received node updated event:', event);
          const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
          const activeCount = nodes.filter(n => n.status === 'Active').length;
          const errorCount = nodes.filter(n => n.status === 'Error').length;
          console.log(`📊 Node updated - Active: ${activeCount}, Error: ${errorCount}`);
          setMonitoredNodes(nodes);
          updateMonitoringStats(nodes);
        } catch (error) {
          console.error('❌ Error handling node updated event:', error);
        }
      });

      const subscriptionRemoved = globalEventBus.subscribe('opcua:node:removed', (event) => {
        try {
          console.log('📡 Received node removed event:', event);
          const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
          console.log(`📊 Node removed - Total nodes: ${nodes.length}`);
          setMonitoredNodes(nodes);
          updateMonitoringStats(nodes);
        } catch (error) {
          console.error('❌ Error handling node removed event:', error);
        }
      });

      console.log('✅ EventBus subscriptions set up successfully');

      return () => {
        console.log('🔌 Cleaning up EventBus subscriptions...');
        try {
          if (subscriptionAdded && subscriptionAdded.id) {
            globalEventBus.unsubscribe(subscriptionAdded.id);
            console.log('✅ Unsubscribed from node:added');
          }
          if (subscriptionUpdated && subscriptionUpdated.id) {
            globalEventBus.unsubscribe(subscriptionUpdated.id);
            console.log('✅ Unsubscribed from node:updated');
          }
          if (subscriptionRemoved && subscriptionRemoved.id) {
            globalEventBus.unsubscribe(subscriptionRemoved.id);
            console.log('✅ Unsubscribed from node:removed');
          }
        } catch (error) {
          console.error('❌ Error unsubscribing from events:', error);
        }
      };
    } catch (error) {
      console.error('❌ Failed to set up EventBus subscriptions:', error);
      setError(`Failed to set up event subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const updateMonitoringStats = useCallback((nodes: MonitoredNode[]) => {
    const now = new Date();
    setMonitoringStats({
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => n.status === 'Active').length,
      errorNodes: nodes.filter(n => n.status === 'Error').length,
      lastUpdate: now,
      updateRate: 1000 / refreshInterval
    });
  }, [refreshInterval]);

  const addMonitoredNode = useCallback(async () => {
    if (!nodeConfig.nodeId || !nodeConfig.displayName) return;

    try {
      const newNodeConfig = {
        nodeId: nodeConfig.nodeId,
        displayName: nodeConfig.displayName,
        dataType: nodeConfig.dataType,
        value: getDefaultValue(nodeConfig.dataType),
        timestamp: new Date(),
        quality: 'Good' as const,
        status: 'Active' as const,
        samplingInterval: nodeConfig.samplingInterval,
        metadata: nodeConfig.includeMetadata ? { source: 'manual', added: new Date() } : undefined,
        connectionId: selectedConnection
      };

      await globalOPCUAMonitoringService.addMonitoredNode(newNodeConfig);
      
      // Reset form
      setNodeConfig({
        nodeId: '',
        displayName: '',
        dataType: 'Double',
        samplingInterval: 1000,
        includeMetadata: false
      });
      setShowAddNodeDialog(false);
    } catch (error) {
      console.error('Failed to add monitored node:', error);
    }
  }, [nodeConfig, selectedConnection]);

  const removeMonitoredNode = useCallback(async (nodeId: string) => {
    try {
      await globalOPCUAMonitoringService.removeMonitoredNode(nodeId);
    } catch (error) {
      console.error('Failed to remove monitored node:', error);
    }
  }, []);

  const toggleNodeStatus = useCallback(async (nodeId: string) => {
    try {
      const node = globalOPCUAMonitoringService.getMonitoredNode(nodeId);
      if (node) {
        const newStatus = node.status === 'Active' ? 'Inactive' : 'Active';
        await globalOPCUAMonitoringService.updateMonitoredNode(nodeId, { status: newStatus });
      }
    } catch (error) {
      console.error('Failed to toggle node status:', error);
    }
  }, []);

  const getDefaultValue = (dataType: string): any => {
    switch (dataType) {
      case 'Double': return 0.0;
      case 'Integer': return 0;
      case 'Boolean': return false;
      case 'String': return 'Unknown';
      default: return null;
    }
  };

  const getQualityColor = (quality: string): string => {
    switch (quality) {
      case 'Good': return 'text-green-600';
      case 'Uncertain': return 'text-yellow-600';
      case 'Bad': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportMonitoringData = () => {
    try {
      const data = globalOPCUAMonitoringService.exportMonitoringData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opcua-monitoring-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export monitoring data:', error);
    }
  };



  try {
    // Show loading state while initializing
    if (!isInitialized && !error) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Initializing OPC UA Monitor
              </CardTitle>
              <CardDescription>
                Setting up monitoring service and loading configuration...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show error if initialization failed
    if (error && !isInitialized) {
      return (
        <div className="space-y-6">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="w-5 h-5" />
                Initialization Error
              </CardTitle>
              <CardDescription className="text-red-600">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Monitoring Controls */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Monitoring Controls
          </CardTitle>
          <CardDescription>
            Control real-time monitoring and connection settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>OPC UA Connection</Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select connection" />
                </SelectTrigger>
                <SelectContent>
                  {availableConnections.map(conn => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Refresh Interval (ms)</Label>
              <Input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                min="100"
                max="10000"
                step="100"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Auto Refresh</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <span className="text-sm">{autoRefresh ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
          
                     <div className="flex items-center gap-4">
             <div className="flex items-center space-x-2">
               <Switch
                 checked={isMonitoring}
                 onCheckedChange={setIsMonitoring}
               />
               <Label>Enable Monitoring</Label>
             </div>
             
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
               <span className="text-sm text-green-600">Simulation Active</span>
             </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportMonitoringData}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await globalOPCUAMonitoringService.resetAllNodesToActive();
                  // Refresh the display
                  const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
                  setMonitoredNodes(nodes);
                  updateMonitoringStats(nodes);
                } catch (error) {
                  console.error('Failed to reset nodes:', error);
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset All Nodes
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await globalOPCUAMonitoringService.forceRefreshAllNodes();
                  // Refresh the display
                  const nodes = globalOPCUAMonitoringService.getMonitoredNodes();
                  setMonitoredNodes(nodes);
                  updateMonitoringStats(nodes);
                } catch (error) {
                  console.error('Failed to refresh nodes:', error);
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Force Refresh
            </Button>
          </div>
          
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Buffer Size</Label>
                <Input type="number" defaultValue="1000" min="100" max="10000" />
              </div>
              <div className="space-y-2">
                <Label>Quality Threshold</Label>
                <Select defaultValue="Good">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Good">Good Only</SelectItem>
                    <SelectItem value="Uncertain">Good + Uncertain</SelectItem>
                    <SelectItem value="Bad">All Qualities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monitoring Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Monitoring Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{monitoringStats.totalNodes}</div>
              <div className="text-sm font-medium text-blue-800">Total Nodes</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{monitoringStats.activeNodes}</div>
              <div className="text-sm font-medium text-green-800">Active Nodes</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{monitoringStats.errorNodes}</div>
              <div className="text-sm font-medium text-red-800">Error Nodes</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{monitoringStats.updateRate.toFixed(1)}</div>
              <div className="text-sm font-medium text-purple-800">Updates/sec</div>
            </div>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-600">
            Last update: {monitoringStats.lastUpdate.toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>

      {/* Monitored Nodes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-600" />
                Monitored Nodes
              </CardTitle>
              <CardDescription>
                Real-time monitoring of OPC UA nodes with live data updates
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddNodeDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Node
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitoredNodes.map((node) => (
              <div key={node.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{node.displayName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(node.status)}>
                      {node.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleNodeStatus(node.id)}
                    >
                      {node.status === 'Active' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMonitoredNode(node.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-2xl font-bold mb-2">
                  {typeof node.value === 'number' 
                    ? node.dataType === 'Double' 
                      ? `${node.value.toFixed(1)}${node.displayName.includes('Temperature') ? '°C' : ''}${node.displayName.includes('Pressure') ? ' bar' : ''}`
                      : node.value
                    : node.value}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span>Type: {node.dataType}</span>
                  <span className={`font-medium ${getQualityColor(node.quality)}`}>
                    {node.quality}
                  </span>
                </div>
                
                <div className="text-xs text-gray-500">
                  Last update: {node.timestamp.toLocaleTimeString()}
                </div>
                
                {node.metadata && (
                  <div className="mt-2 text-xs text-blue-600">
                    Source: {node.metadata.source}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {monitoredNodes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Eye className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No nodes are currently being monitored</p>
              <p className="text-sm">Click "Add Node" to start monitoring OPC UA nodes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Node Dialog */}
      {showAddNodeDialog && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Add Monitored Node
            </CardTitle>
            <CardDescription>
              Configure a new OPC UA node for real-time monitoring
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="node-id">Node ID</Label>
                <Input
                  id="node-id"
                  placeholder="ns=2;s=Device1.Temperature"
                  value={nodeConfig.nodeId}
                  onChange={(e) => setNodeConfig({ ...nodeConfig, nodeId: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="Temperature Sensor"
                  value={nodeConfig.displayName}
                  onChange={(e) => setNodeConfig({ ...nodeConfig, displayName: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="data-type">Data Type</Label>
                <Select value={nodeConfig.dataType} onValueChange={(value) => setNodeConfig({ ...nodeConfig, dataType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Double">Double</SelectItem>
                    <SelectItem value="Integer">Integer</SelectItem>
                    <SelectItem value="Boolean">Boolean</SelectItem>
                    <SelectItem value="String">String</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sampling-interval">Sampling Interval (ms)</Label>
                <Input
                  id="sampling-interval"
                  type="number"
                  value={nodeConfig.samplingInterval}
                  onChange={(e) => setNodeConfig({ ...nodeConfig, samplingInterval: Number(e.target.value) })}
                  min="100"
                  max="10000"
                  step="100"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="include-metadata"
                checked={nodeConfig.includeMetadata}
                onCheckedChange={(checked) => setNodeConfig({ ...nodeConfig, includeMetadata: checked })}
              />
              <Label htmlFor="include-metadata">Include metadata</Label>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAddNodeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addMonitoredNode} disabled={!nodeConfig.nodeId || !nodeConfig.displayName}>
                Add Node
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
  } catch (error) {
    console.error('❌ Unexpected error in OPCUAMonitor component:', error);
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Unexpected Error
            </CardTitle>
            <CardDescription className="text-red-600">
              An unexpected error occurred while rendering the OPC UA Monitor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-700">
              <p className="font-medium">Error details:</p>
              <p className="font-mono text-xs mt-1 break-all">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  console.log('✅ OPCUAMonitor component rendered successfully');
};
