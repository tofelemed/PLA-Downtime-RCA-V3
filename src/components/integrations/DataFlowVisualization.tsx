import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Filter, 
  Play, 
  Pause, 
  RotateCcw,
  Eye,
  EyeOff,
  ArrowRight,
  Circle,
  Database,
  Wifi,
  Server,
  Settings
} from 'lucide-react';
import { ProtocolConnection } from '@/services/integrations/ProtocolManager';
import { TransformConfig, FilterConfig } from '@/services/integrations/base/IConnector';

interface DataFlowVisualizationProps {
  connections: Map<string, ProtocolConnection>;
  selectedConnection?: string;
}

interface DataFlowNode {
  id: string;
  type: 'source' | 'filter' | 'transform' | 'destination';
  name: string;
  icon: React.ReactNode;
  data: any;
  position: { x: number; y: number };
  connections: string[];
  status: 'active' | 'inactive' | 'error';
  metrics: {
    throughput: number;
    latency: number;
    errorRate: number;
    lastUpdate: Date;
  };
}

interface DataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  dataType: string;
  volume: number;
  status: 'flowing' | 'blocked' | 'error';
}

export const DataFlowVisualization: React.FC<DataFlowVisualizationProps> = ({
  connections,
  selectedConnection
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'performance'>('overview');
  const [dataFlowNodes, setDataFlowNodes] = useState<DataFlowNode[]>([]);
  const [dataFlows, setDataFlows] = useState<DataFlow[]>([]);
  const [animationSpeed, setAnimationSpeed] = useState(1000);
  const [showMetrics, setShowMetrics] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    initializeDataFlow();
  }, [connections, selectedConnection]);

  useEffect(() => {
    if (isAnimating) {
      startAnimation();
    } else {
      stopAnimation();
    }

    return () => stopAnimation();
  }, [isAnimating]);

  const initializeDataFlow = () => {
    const nodes: DataFlowNode[] = [];
    const flows: DataFlow[] = [];

    // Create source nodes for each connection
    Array.from(connections.values()).forEach((conn, index) => {
      if (selectedConnection && conn.id !== selectedConnection) return;

      const sourceNode: DataFlowNode = {
        id: `source_${conn.id}`,
        type: 'source',
        name: `${conn.name} (${conn.type})`,
        icon: getProtocolIcon(conn.type),
        data: conn,
        position: { x: 50, y: 100 + index * 150 },
        connections: [],
        status: conn.status?.connected ? 'active' : 'inactive',
        metrics: {
          throughput: Math.random() * 1000 + 100,
          latency: Math.random() * 50 + 10,
          errorRate: Math.random() * 5,
          lastUpdate: new Date()
        }
      };

      nodes.push(sourceNode);

      // Add filter nodes if they exist
      const filters = conn.config.options?.filters || [];
      filters.forEach((filter: FilterConfig, filterIndex: number) => {
        const filterNode: DataFlowNode = {
          id: `filter_${conn.id}_${filter.id}`,
          type: 'filter',
          name: filter.name,
          icon: <Filter className="w-6 h-6" />,
          data: filter,
          position: { x: 250, y: 100 + index * 150 + filterIndex * 80 },
          connections: [sourceNode.id],
          status: filter.enabled ? 'active' : 'inactive',
          metrics: {
            throughput: Math.random() * 800 + 50,
            latency: Math.random() * 30 + 5,
            errorRate: Math.random() * 3,
            lastUpdate: new Date()
          }
        };

        nodes.push(filterNode);
        flows.push({
          id: `flow_${sourceNode.id}_${filterNode.id}`,
          sourceId: sourceNode.id,
          targetId: filterNode.id,
          dataType: 'filtered_data',
          volume: Math.random() * 100 + 50,
          status: 'flowing'
        });

        // Add transform nodes if they exist
        const transforms = conn.config.options?.transforms || [];
        transforms.forEach((transform: TransformConfig, transformIndex: number) => {
          const transformNode: DataFlowNode = {
            id: `transform_${conn.id}_${transform.id}`,
            type: 'transform',
            name: transform.name,
            icon: <Zap className="w-6 h-6" />,
            data: transform,
            position: { x: 450, y: 100 + index * 150 + transformIndex * 80 },
            connections: [filterNode.id],
            status: transform.enabled ? 'active' : 'inactive',
            metrics: {
              throughput: Math.random() * 600 + 30,
              latency: Math.random() * 40 + 10,
              errorRate: Math.random() * 4,
              lastUpdate: new Date()
            }
          };

          nodes.push(transformNode);
          flows.push({
            id: `flow_${filterNode.id}_${transformNode.id}`,
            sourceId: filterNode.id,
            targetId: transformNode.id,
            dataType: 'transformed_data',
            volume: Math.random() * 80 + 40,
            status: 'flowing'
          });

          // Add destination node
          const destinationNode: DataFlowNode = {
            id: `destination_${conn.id}_${transform.id}`,
            type: 'destination',
            name: 'Data Output',
            icon: <Database className="w-6 h-6" />,
            data: { type: 'output' },
            position: { x: 650, y: 100 + index * 150 + transformIndex * 80 },
            connections: [transformNode.id],
            status: 'active',
            metrics: {
              throughput: Math.random() * 500 + 20,
              latency: Math.random() * 20 + 5,
              errorRate: Math.random() * 2,
              lastUpdate: new Date()
            }
          };

          nodes.push(destinationNode);
          flows.push({
            id: `flow_${transformNode.id}_${destinationNode.id}`,
            sourceId: transformNode.id,
            targetId: destinationNode.id,
            dataType: 'final_data',
            volume: Math.random() * 60 + 30,
            status: 'flowing'
          });
        });
      });
    });

    setDataFlowNodes(nodes);
    setDataFlows(flows);
  };

  const getProtocolIcon = (type: string) => {
    switch (type) {
      case 'websocket': return <Wifi className="w-6 h-6" />;
      case 'mqtt': return <Zap className="w-6 h-6" />;
      case 'opcua': return <Server className="w-6 h-6" />;
      case 'database': return <Database className="w-6 h-6" />;
      case 'scada': return <Activity className="w-6 h-6" />;
      default: return <Settings className="w-6 h-6" />;
    }
  };

  const startAnimation = () => {
    if (animationRef.current) return;

    animationRef.current = setInterval(() => {
      setDataFlowNodes(prev => prev.map(node => ({
        ...node,
        metrics: {
          ...node.metrics,
          throughput: node.metrics.throughput + (Math.random() - 0.5) * 50,
          latency: Math.max(5, node.metrics.latency + (Math.random() - 0.5) * 10),
          errorRate: Math.max(0, node.metrics.errorRate + (Math.random() - 0.5) * 1),
          lastUpdate: new Date()
        }
      })));
    }, animationSpeed);
  };

  const stopAnimation = () => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = undefined;
    }
  };

  const getNodeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 border-green-300';
      case 'inactive': return 'bg-gray-100 border-gray-300';
      case 'error': return 'bg-red-100 border-red-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getNodeIconColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'inactive': return 'text-gray-400';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getFlowColor = (status: string) => {
    switch (status) {
      case 'flowing': return 'bg-blue-500';
      case 'blocked': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Data Flow Visualization</h3>
          <p className="text-sm text-muted-foreground">
            Interactive visualization of data flow through transformation and filtering pipelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={() => setIsAnimating(!isAnimating)}
            variant={isAnimating ? "destructive" : "default"}
          >
            {isAnimating ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isAnimating ? 'Stop' : 'Animate'}
          </Button>
          
          <Button onClick={initializeDataFlow} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Visualization Controls</CardTitle>
          <CardDescription>Configure visualization parameters and display options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Animation Speed</label>
              <Select value={animationSpeed.toString()} onValueChange={(value) => setAnimationSpeed(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">Fast (500ms)</SelectItem>
                  <SelectItem value="1000">Normal (1s)</SelectItem>
                  <SelectItem value="2000">Slow (2s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">View Mode</label>
              <div className="text-sm text-muted-foreground">
                {viewMode === 'overview' && 'High-level pipeline overview'}
                {viewMode === 'detailed' && 'Detailed node information'}
                {viewMode === 'performance' && 'Performance metrics focus'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-metrics"
                  checked={showMetrics}
                  onChange={(e) => setShowMetrics(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="show-metrics">Show Metrics</label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Flow Canvas */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Flow Diagram</CardTitle>
          <CardDescription>
            {selectedConnection ? `Data flow for ${selectedConnection}` : 'Data flow across all connections'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            ref={canvasRef}
            className="relative w-full h-96 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
            style={{ minHeight: '400px' }}
          >
            {/* Render data flow nodes */}
            {dataFlowNodes.map((node) => (
              <div
                key={node.id}
                className={`absolute p-3 border-2 rounded-lg cursor-pointer transition-all duration-300 hover:shadow-lg ${
                  selectedNode === node.id ? 'ring-2 ring-blue-500' : ''
                } ${getNodeColor(node.status)}`}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  minWidth: '120px'
                }}
                onClick={() => setSelectedNode(node.id)}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className={`${getNodeIconColor(node.status)}`}>
                    {node.icon}
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm">{node.name}</div>
                    <Badge variant="outline" className="text-xs">
                      {node.type}
                    </Badge>
                  </div>
                  
                  {showMetrics && (
                    <div className="text-xs space-y-1">
                      <div>Throughput: {Math.round(node.metrics.throughput)}/s</div>
                      <div>Latency: {Math.round(node.metrics.latency)}ms</div>
                      <div>Errors: {node.metrics.errorRate.toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Render data flows */}
            {dataFlows.map((flow) => {
              const sourceNode = dataFlowNodes.find(n => n.id === flow.sourceId);
              const targetNode = dataFlowNodes.find(n => n.id === flow.targetId);
              
              if (!sourceNode || !targetNode) return null;

              const startX = sourceNode.position.x + 60;
              const startY = sourceNode.position.y + 30;
              const endX = targetNode.position.x;
              const endY = targetNode.position.y + 30;

              return (
                <svg
                  key={flow.id}
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 1 }}
                >
                  <defs>
                    <marker
                      id={`arrowhead-${flow.id}`}
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill={getFlowColor(flow.status).replace('bg-', '')}
                      />
                    </marker>
                  </defs>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={getFlowColor(flow.status).replace('bg-', '')}
                    strokeWidth="3"
                    markerEnd={`url(#arrowhead-${flow.id})`}
                    className="transition-all duration-300"
                  />
                  {/* Flow label */}
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 10}
                    textAnchor="middle"
                    className="text-xs font-medium fill-gray-700"
                  >
                    {flow.dataType.replace('_', ' ')}
                  </text>
                </svg>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle>Node Details</CardTitle>
            <CardDescription>Detailed information about the selected node</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const node = dataFlowNodes.find(n => n.id === selectedNode);
              if (!node) return null;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Basic Information</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">ID:</span> {node.id}</div>
                        <div><span className="font-medium">Type:</span> {node.type}</div>
                        <div><span className="font-medium">Name:</span> {node.name}</div>
                        <div><span className="font-medium">Status:</span> 
                          <Badge className={`ml-2 ${getNodeColor(node.status)}`}>
                            {node.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Performance Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Throughput:</span> {Math.round(node.metrics.throughput)}/s</div>
                        <div><span className="font-medium">Latency:</span> {Math.round(node.metrics.latency)}ms</div>
                        <div><span className="font-medium">Error Rate:</span> {node.metrics.errorRate.toFixed(2)}%</div>
                        <div><span className="font-medium">Last Update:</span> {node.metrics.lastUpdate.toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                  
                  {node.type === 'filter' && (
                    <div>
                      <h4 className="font-medium">Filter Configuration</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">Type:</span> {node.data.type}</div>
                        <div><span className="font-medium">Enabled:</span> {node.data.enabled ? 'Yes' : 'No'}</div>
                        <div><span className="font-medium">Order:</span> {node.data.order}</div>
                      </div>
                    </div>
                  )}
                  
                  {node.type === 'transform' && (
                    <div>
                      <h4 className="font-medium">Transform Configuration</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">Type:</span> {node.data.type}</div>
                        <div><span className="font-medium">Enabled:</span> {node.data.enabled ? 'Yes' : 'No'}</div>
                        <div><span className="font-medium">Order:</span> {node.data.order}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      {viewMode === 'performance' && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>Overall pipeline performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {dataFlowNodes.filter(n => n.status === 'active').length}
                </div>
                <div className="text-sm text-muted-foreground">Active Nodes</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {dataFlows.filter(f => f.status === 'flowing').length}
                </div>
                <div className="text-sm text-muted-foreground">Active Flows</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.round(dataFlowNodes.reduce((sum, n) => sum + n.metrics.throughput, 0))}
                </div>
                <div className="text-sm text-muted-foreground">Total Throughput</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(dataFlowNodes.reduce((sum, n) => sum + n.metrics.latency, 0) / dataFlowNodes.length)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Latency (ms)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
