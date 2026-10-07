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
  Circle
} from 'lucide-react';
import { ProtocolConnection } from '@/services/integrations/ProtocolManager';

interface RealTimePipelineMonitoringProps {
  connections: Map<string, ProtocolConnection>;
}

interface PipelineEvent {
  id: string;
  timestamp: Date;
  connectionId: string;
  connectionName: string;
  protocol: string;
  eventType: 'data_in' | 'filtered' | 'transformed' | 'data_out' | 'error';
  dataSize: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export const RealTimePipelineMonitoring: React.FC<RealTimePipelineMonitoringProps> = ({
  connections
}) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [showErrors, setShowErrors] = useState(true);
  const [maxEvents, setMaxEvents] = useState(100);
  const [pipelineStats, setPipelineStats] = useState({
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    averageProcessingTime: 0,
    totalDataProcessed: 0,
    eventsPerSecond: 0
  });

  const monitoringIntervalRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => stopMonitoring();
  }, [isMonitoring]);

  const startMonitoring = () => {
    if (monitoringIntervalRef.current) return;

    monitoringIntervalRef.current = setInterval(() => {
      generatePipelineEvents();
    }, 1000); // Generate events every second
  };

  const stopMonitoring = () => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = undefined;
    }
  };

  const generatePipelineEvents = () => {
    const now = Date.now();
    const timeDiff = now - lastUpdateRef.current;
    const eventsThisSecond = Math.floor(Math.random() * 8) + 2; // 2-10 events per second

    const newEvents: PipelineEvent[] = Array.from(connections.values())
      .filter(conn => selectedConnection === 'all' || conn.id === selectedConnection)
      .slice(0, eventsThisSecond)
      .map(conn => {
        const eventTypes: PipelineEvent['eventType'][] = ['data_in', 'filtered', 'transformed', 'data_out'];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const success = Math.random() > 0.1; // 90% success rate
        const processingTime = Math.random() * 100 + 10; // 10-110ms
        const dataSize = Math.floor(Math.random() * 1000) + 100; // 100-1100 bytes

        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          connectionId: conn.id,
          connectionName: conn.name,
          protocol: conn.type,
          eventType,
          dataSize,
          processingTime,
          success,
          error: success ? undefined : 'Simulated processing error'
        };
      });

    setPipelineEvents(prev => {
      const updated = [...prev, ...newEvents];
      return updated.slice(-maxEvents);
    });

    // Update stats
    setPipelineStats(prev => ({
      totalEvents: prev.totalEvents + newEvents.length,
      successfulEvents: prev.successfulEvents + newEvents.filter(e => e.success).length,
      failedEvents: prev.failedEvents + newEvents.filter(e => !e.success).length,
      averageProcessingTime: (prev.averageProcessingTime + newEvents.reduce((sum, e) => sum + e.processingTime, 0) / newEvents.length) / 2,
      totalDataProcessed: prev.totalDataProcessed + newEvents.reduce((sum, e) => sum + e.dataSize, 0),
      eventsPerSecond: eventsThisSecond
    }));

    lastUpdateRef.current = now;
  };

  const clearEvents = () => {
    setPipelineEvents([]);
    setPipelineStats({
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      totalDataProcessed: 0,
      eventsPerSecond: 0
    });
  };

  const getEventIcon = (eventType: PipelineEvent['eventType']) => {
    switch (eventType) {
      case 'data_in': return <ArrowRight className="w-4 h-4 text-blue-600" />;
      case 'filtered': return <Filter className="w-4 h-4 text-green-600" />;
      case 'transformed': return <Zap className="w-4 h-4 text-yellow-600" />;
      case 'data_out': return <ArrowRight className="w-4 h-4 text-purple-600" />;
      case 'error': return <Circle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getEventColor = (eventType: PipelineEvent['eventType']) => {
    switch (eventType) {
      case 'data_in': return 'bg-blue-50 text-blue-800';
      case 'filtered': return 'bg-green-50 text-green-800';
      case 'transformed': return 'bg-yellow-50 text-yellow-800';
      case 'data_out': return 'bg-purple-50 text-purple-800';
      case 'error': return 'bg-red-50 text-red-800';
      default: return 'bg-gray-50 text-gray-800';
    }
  };

  const filteredEvents = pipelineEvents.filter(event => {
    if (!showErrors && !event.success) return false;
    if (selectedConnection !== 'all' && event.connectionId !== selectedConnection) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Real-time Pipeline Monitoring</h3>
          <p className="text-sm text-muted-foreground">
            Monitor data flow through transformation and filtering pipelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsMonitoring(!isMonitoring)}
            variant={isMonitoring ? "destructive" : "default"}
          >
            {isMonitoring ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
          <Button onClick={clearEvents} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Pipeline Statistics */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineStats.totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pipelineStats.totalEvents > 0 
                ? Math.round((pipelineStats.successfulEvents / pipelineStats.totalEvents) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Events</CardTitle>
            <Circle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pipelineStats.failedEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineStats.averageProcessingTime.toFixed(1)}ms</div>
            <p className="text-xs text-muted-foreground">Per event</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Processed</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(pipelineStats.totalDataProcessed / 1024).toFixed(1)}KB</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineStats.eventsPerSecond}/s</div>
            <p className="text-xs text-muted-foreground">Current</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Controls</CardTitle>
          <CardDescription>Configure monitoring parameters and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Connection Filter</label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connections</SelectItem>
                  {Array.from(connections.values()).map(conn => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name} ({conn.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Events</label>
              <Select value={maxEvents.toString()} onValueChange={(value) => setMaxEvents(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 Events</SelectItem>
                  <SelectItem value="100">100 Events</SelectItem>
                  <SelectItem value="200">200 Events</SelectItem>
                  <SelectItem value="500">500 Events</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="show-errors"
              checked={showErrors}
              onChange={(e) => setShowErrors(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="show-errors">Show Error Events</label>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Flow</CardTitle>
          <CardDescription>
            Visual representation of data flow through the pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Pipeline Diagram */}
            <div className="flex items-center justify-center space-x-8 py-8">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                  <ArrowRight className="w-8 h-8 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Data In</span>
              </div>
              
              <ArrowRight className="w-6 h-6 text-gray-400" />
              
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                  <Filter className="w-8 h-8 text-green-600" />
                </div>
                <span className="text-sm font-medium">Filtering</span>
              </div>
              
              <ArrowRight className="w-6 h-6 text-gray-400" />
              
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-yellow-600" />
                </div>
                <span className="text-sm font-medium">Transformation</span>
              </div>
              
              <ArrowRight className="w-6 h-6 text-gray-400" />
              
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ArrowRight className="w-8 h-8 text-purple-600" />
                </div>
                <span className="text-sm font-medium">Data Out</span>
              </div>
            </div>

            {/* Event Counts by Type */}
            <div className="grid grid-cols-4 gap-4">
              {(['data_in', 'filtered', 'transformed', 'data_out'] as const).map(eventType => {
                const count = pipelineEvents.filter(e => e.eventType === eventType).length;
                return (
                  <div key={eventType} className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {eventType.replace('_', ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Event Stream */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Event Stream</CardTitle>
          <CardDescription>
            Live stream of pipeline events from {selectedConnection === 'all' ? 'all connections' : 'selected connection'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isMonitoring ? 'Waiting for pipeline events...' : 'Monitoring stopped. Click Start to begin.'}
              </div>
            ) : (
              filteredEvents.map((event) => (
                <div key={event.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getEventIcon(event.eventType)}
                      <div>
                        <div className="font-medium">{event.connectionName}</div>
                        <div className="text-sm text-muted-foreground">
                          <Badge variant="outline" className="mr-2">{event.protocol.toUpperCase()}</Badge>
                          <Badge className={getEventColor(event.eventType)}>
                            {event.eventType.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge variant={event.success ? "default" : "destructive"}>
                        {event.success ? "Success" : "Error"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Data Size:</span> {event.dataSize} bytes
                    </div>
                    <div>
                      <span className="font-medium">Processing Time:</span> {event.processingTime.toFixed(1)}ms
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {event.success ? 'Completed' : 'Failed'}
                    </div>
                  </div>
                  
                  {event.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      <strong>Error:</strong> {event.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
