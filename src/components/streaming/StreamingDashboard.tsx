// Streaming Dashboard - Real-time monitoring and control of streaming system
// This component integrates with the EventStreamProcessor and provides comprehensive monitoring

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Database, 
  Wifi, 
  Server, 
  Zap, 
  Settings, 
  BarChart3,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  Filter,
  Zap as Transform,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { globalProtocolManager, ProtocolType, ProtocolConnection } from '@/services/integrations/ProtocolManager';
import { TransformConfig, FilterConfig } from '@/services/integrations/base/IConnector';

interface StreamData {
  id: string;
  timestamp: Date;
  protocol: ProtocolType;
  connection: string;
  data: any;
  processed: boolean;
  transformCount: number;
  filterCount: number;
}

export const StreamingDashboard: React.FC = () => {
  const [connections, setConnections] = useState<Map<string, ProtocolConnection>>(new Map());
  const [streamData, setStreamData] = useState<StreamData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType | 'all'>('all');
  const [showProcessed, setShowProcessed] = useState(true);
  const [showRaw, setShowRaw] = useState(true);
  const [maxDataPoints, setMaxDataPoints] = useState(100);
  const [streamStats, setStreamStats] = useState({
    totalMessages: 0,
    processedMessages: 0,
    filteredMessages: 0,
    averageLatency: 0,
    messagesPerSecond: 0
  });

  const streamIntervalRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    loadConnections();
    const interval = setInterval(loadConnections, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isStreaming) {
      startStreaming();
    } else {
      stopStreaming();
    }

    return () => stopStreaming();
  }, [isStreaming]);

  const loadConnections = () => {
    const allConnections = globalProtocolManager.getAllConnections();
    setConnections(allConnections);
  };

  const startStreaming = () => {
    if (streamIntervalRef.current) return;

    streamIntervalRef.current = setInterval(() => {
      generateStreamData();
    }, 1000); // Generate data every second
  };

  const stopStreaming = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = undefined;
    }
  };

  const generateStreamData = () => {
    const now = Date.now();
    const timeDiff = now - lastUpdateRef.current;
    const messagesThisSecond = Math.floor(Math.random() * 5) + 1; // 1-5 messages per second

    const newData: StreamData[] = Array.from(connections.values())
      .filter(conn => selectedProtocol === 'all' || conn.type === selectedProtocol)
      .slice(0, messagesThisSecond)
      .map(conn => {
        const data = generateMockData(conn.type);
        const processed = Math.random() > 0.3; // 70% processed
        const transformCount = processed ? Math.floor(Math.random() * 3) : 0;
        const filterCount = processed ? Math.floor(Math.random() * 2) : 0;

        return {
          id: `stream_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          protocol: conn.type,
          connection: conn.name,
          data,
          processed,
          transformCount,
          filterCount
        };
      });

    setStreamData(prev => {
      const updated = [...prev, ...newData];
      return updated.slice(-maxDataPoints);
    });

    // Update stats
    setStreamStats(prev => ({
      totalMessages: prev.totalMessages + newData.length,
      processedMessages: prev.processedMessages + newData.filter(d => d.processed).length,
      filteredMessages: prev.filteredMessages + newData.filter(d => d.filterCount > 0).length,
      averageLatency: (prev.averageLatency + timeDiff) / 2,
      messagesPerSecond: messagesThisSecond
    }));

    lastUpdateRef.current = now;
  };

  const generateMockData = (protocol: ProtocolType): any => {
    const baseValue = Math.random() * 100;
    const timestamp = new Date().toISOString();

    switch (protocol) {
      case 'mqtt':
        return {
          topic: `sensor/${Math.floor(Math.random() * 10)}/data`,
          payload: {
            temperature: baseValue,
            humidity: Math.random() * 50,
            timestamp
          }
        };
      
      case 'opcua':
        return {
          nodeId: `ns=2;s=Device${Math.floor(Math.random() * 5)}.Tag${Math.floor(Math.random() * 10)}`,
          value: baseValue,
          quality: Math.random() > 0.1 ? 'Good' : 'Bad',
          timestamp
        };
      
      case 'modbus':
        return {
          register: Math.floor(Math.random() * 1000),
          value: Math.floor(baseValue),
          type: Math.random() > 0.5 ? 'Holding' : 'Input',
          timestamp
        };
      
      case 'database':
        return {
          table: `sensor_data_${Math.floor(Math.random() * 5)}`,
          record: {
            id: Math.floor(Math.random() * 10000),
            value: baseValue,
            timestamp
          }
        };
      
      default:
        return {
          type: 'generic',
          value: baseValue,
          metadata: { protocol, timestamp }
        };
    }
  };

  const getProtocolIcon = (type: ProtocolType) => {
    switch (type) {
      case 'websocket': return <Wifi className="w-4 h-4" />;
      case 'mqtt': return <Zap className="w-4 h-4" />;
      case 'opcua': return <Server className="w-4 h-4" />;
      case 'database': return <Database className="w-4 h-4" />;
      case 'scada': return <Activity className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getProtocolColor = (type: ProtocolType) => {
    switch (type) {
      case 'websocket': return 'bg-blue-500';
      case 'mqtt': return 'bg-green-500';
      case 'opcua': return 'bg-purple-500';
      case 'database': return 'bg-orange-500';
      case 'scada': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatData = (data: any): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const clearStreamData = () => {
    setStreamData([]);
    setStreamStats({
      totalMessages: 0,
      processedMessages: 0,
      filteredMessages: 0,
      averageLatency: 0,
      messagesPerSecond: 0
    });
  };

  const filteredData = streamData.filter(item => {
    if (!showProcessed && item.processed) return false;
    if (!showRaw && !item.processed) return false;
    if (selectedProtocol !== 'all' && item.protocol !== selectedProtocol) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Streaming Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of data streams across all protocol connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsStreaming(!isStreaming)}
            variant={isStreaming ? "destructive" : "default"}
          >
            {isStreaming ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
          </Button>
          <Button onClick={clearStreamData} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Streaming Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streamStats.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <Transform className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{streamStats.processedMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">With transforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered</CardTitle>
            <Filter className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{streamStats.filteredMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">With filters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streamStats.averageLatency.toFixed(1)}ms</div>
            <p className="text-xs text-muted-foreground">Processing time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streamStats.messagesPerSecond}/s</div>
            <p className="text-xs text-muted-foreground">Current rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Stream Controls</CardTitle>
          <CardDescription>Configure streaming parameters and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="protocol-filter">Protocol Filter</Label>
              <Select value={selectedProtocol} onValueChange={(value: ProtocolType | 'all') => setSelectedProtocol(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Protocols</SelectItem>
                  {globalProtocolManager.getSupportedProtocols().map(protocol => (
                    <SelectItem key={protocol} value={protocol}>
                      {protocol.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max-points">Max Data Points</Label>
              <Input
                id="max-points"
                type="number"
                value={maxDataPoints}
                onChange={(e) => setMaxDataPoints(parseInt(e.target.value) || 100)}
                min="10"
                max="1000"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="show-processed"
                checked={showProcessed}
                onChange={(e) => setShowProcessed(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="show-processed">Show Processed Data</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="show-raw"
                checked={showRaw}
                onChange={(e) => setShowRaw(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="show-raw">Show Raw Data</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Stream Data */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Stream Data</CardTitle>
          <CardDescription>
            Live data stream from {selectedProtocol === 'all' ? 'all protocols' : selectedProtocol.toUpperCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isStreaming ? 'Waiting for data...' : 'Streaming stopped. Click Start to begin.'}
              </div>
            ) : (
              filteredData.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full ${getProtocolColor(item.protocol)} flex items-center justify-center text-white`}>
                        {getProtocolIcon(item.protocol)}
                      </div>
                      <Badge variant="outline">{item.protocol.toUpperCase()}</Badge>
                      <span className="font-medium">{item.connection}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {item.processed && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <Transform className="w-3 h-3 mr-1" />
                          {item.transformCount}
                        </Badge>
                      )}
                      {item.filterCount > 0 && (
                        <Badge variant="secondary">
                          <Filter className="w-3 h-3 mr-1" />
                          {item.filterCount}
                        </Badge>
                      )}
                      <Badge variant={item.processed ? "default" : "secondary"}>
                        {item.processed ? "Processed" : "Raw"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="bg-gray-100 rounded p-2 font-mono text-sm overflow-x-auto">
                    <pre>{formatData(item.data)}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Protocol Status */}
      <Card>
        <CardHeader>
          <CardTitle>Protocol Status</CardTitle>
          <CardDescription>Current status of all protocol connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {globalProtocolManager.getSupportedProtocols().map(protocol => {
              const protocolConnections = Array.from(connections.values()).filter(conn => conn.type === protocol);
              const connected = protocolConnections.filter(conn => conn.status?.connected).length;
              const total = protocolConnections.length;
              
              return (
                <div key={protocol} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-8 h-8 rounded-lg ${getProtocolColor(protocol)} flex items-center justify-center text-white`}>
                    {getProtocolIcon(protocol)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{protocol.toUpperCase()}</div>
                    <div className="text-sm text-muted-foreground">
                      {connected}/{total} connected
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {connected > 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
