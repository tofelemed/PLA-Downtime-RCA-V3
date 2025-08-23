// Streaming Dashboard - Real-time monitoring and control of streaming system
// This component integrates with the EventStreamProcessor and provides comprehensive monitoring

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database,
  Zap,
  TrendingUp,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';
import { globalStreamProcessor } from '@/services/streaming/EventStreamProcessor';
import { globalEventBus } from '@/services/events/EventBus';
import { TransformFactory } from '@/services/streaming/transforms/DataTransform';
import { globalWebSocketManager } from '@/services/websocket/WebSocketConnector';
import { globalUniversalConnectorService } from '@/services/storage/UniversalConnectorService';
import { globalDemoDataSeeder } from '@/services/storage/DemoDataSeeder';

interface StreamMetrics {
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageLatency: number;
  throughput: number;
  activeSources: number;
  activeSinks: number;
  activeProcessors: number;
  lastEventTime?: Date;
  errorRate: number;
  dataQuality: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    validity: number;
    consistency: number;
    lastUpdated: Date;
  };
}

interface StreamAlert {
  id: string;
  type: 'warning' | 'error' | 'critical' | 'info';
  message: string;
  timestamp: Date;
  source: string;
  severity: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

interface DataSource {
  id: string;
  name: string;
  enabled: boolean;
  lastData?: any;
  lastUpdate?: Date;
  errorCount: number;
  status: 'active' | 'inactive' | 'error' | 'connecting';
}

interface DataSink {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  lastWrite?: Date;
  writeCount: number;
  errorCount: number;
}

interface StreamProcessor {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  order: number;
}

export const StreamingDashboard: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [alerts, setAlerts] = useState<StreamAlert[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [sinks, setSinks] = useState<DataSink[]>([]);
  const [processors, setProcessors] = useState<StreamProcessor[]>([]);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [subscriptionIds, setSubscriptionIds] = useState<string[]>([]);

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      const streamMetrics = globalStreamProcessor.getMetrics();
      const streamAlerts = globalStreamProcessor.getAlerts();
      
      setMetrics(streamMetrics);
      setAlerts(streamAlerts);
      
      // Get source and sink status from the IndexedDB service
      const allSources = await globalUniversalConnectorService.getAllDataSources();
      const allSinks = await globalUniversalConnectorService.getAllDataSinks();
      
      // Convert stored data to component format
      const sourcesData = allSources.map(storedSource => ({
        id: storedSource.id,
        name: storedSource.name,
        enabled: storedSource.enabled,
        status: storedSource.status,
        errorCount: storedSource.errorCount,
        lastUpdate: storedSource.lastUpdate
      }));
      
      const sinksData = allSinks.map(storedSink => ({
        id: storedSink.id,
        name: storedSink.name,
        type: storedSink.type,
        enabled: storedSink.enabled,
        writeCount: storedSink.writeCount,
        errorCount: storedSink.errorCount,
        lastWrite: storedSink.lastWrite
      }));
      
      setSources(sourcesData);
      setSinks(sinksData);
      
    } catch (error) {
      console.error('Failed to refresh streaming data:', error);
    }
  }, []);

  // Start/stop streaming
  const toggleStreaming = async () => {
    try {
      if (isRunning) {
        await globalStreamProcessor.stop();
        setIsRunning(false);
      } else {
        await globalStreamProcessor.start();
        setIsRunning(true);
      }
    } catch (error) {
      console.error('Failed to toggle streaming:', error);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = (alertId: string) => {
    globalStreamProcessor.acknowledgeAlert(alertId);
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  // Enable/disable source
  const toggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      await globalStreamProcessor.setSourceEnabled(sourceId, enabled);
      setSources(prev => prev.map(source => 
        source.id === sourceId ? { ...source, enabled } : source
      ));
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  };

  // Enable/disable sink
  const toggleSink = async (sinkId: string, enabled: boolean) => {
    try {
      await globalStreamProcessor.setSinkEnabled(sinkId, enabled);
      setSinks(prev => prev.map(sink => 
        sink.id === sinkId ? { ...sink, enabled } : sink
      ));
    } catch (error) {
      console.error('Failed to toggle sink:', error);
    }
  };

  // Setup event listeners
  useEffect(() => {
    const handleStreamStarted = () => setIsRunning(true);
    const handleStreamStopped = () => setIsRunning(false);
    const handleAlertCreated = (event: any) => {
      setAlerts(prev => [event.data.alert, ...prev]);
    };
    const handleAlertAcknowledged = (event: any) => {
      setAlerts(prev => prev.map(alert => 
        alert.id === event.data.alertId ? { ...alert, acknowledged: true } : alert
      ));
    };

    const sub1 = globalEventBus.subscribe('stream.started', handleStreamStarted);
    const sub2 = globalEventBus.subscribe('stream.stopped', handleStreamStopped);
    const sub3 = globalEventBus.subscribe('stream.alert.created', handleAlertCreated);
    const sub4 = globalEventBus.subscribe('stream.alert.acknowledged', handleAlertAcknowledged);

    setSubscriptionIds([sub1.id, sub2.id, sub3.id, sub4.id]);

    return () => {
      globalEventBus.unsubscribe(sub1.id);
      globalEventBus.unsubscribe(sub2.id);
      globalEventBus.unsubscribe(sub3.id);
      globalEventBus.unsubscribe(sub4.id);
    };
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refreshData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshData]);

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Initialize the storage service
        await globalUniversalConnectorService.initialize();
        
        // Seed demo data if needed
        await globalDemoDataSeeder.seedIfNeeded();
        
        // Refresh the dashboard
        await refreshData();
      } catch (error) {
        console.error('Failed to initialize streaming dashboard:', error);
      }
    };

    initializeData();
  }, [refreshData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Streaming Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and control of data streaming system
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="auto-refresh">Auto-refresh</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="refresh-interval">Interval (ms)</Label>
            <Input
              id="refresh-interval"
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-20"
              min="1000"
              max="60000"
              step="1000"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={!isRunning}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            onClick={toggleStreaming}
            variant={isRunning ? "destructive" : "default"}
            size="lg"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Stop Streaming
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Streaming
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {isRunning ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Pause className="h-4 w-4 text-gray-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isRunning ? 'Running' : 'Stopped'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isRunning ? 'Processing data streams' : 'System idle'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.throughput ? `${metrics.throughput.toFixed(1)}` : '0'} /s
            </div>
            <p className="text-xs text-muted-foreground">
              Events per second
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latency</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageLatency ? `${metrics.averageLatency.toFixed(0)}` : '0'}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average processing time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.dataQuality?.completeness ? `${metrics.dataQuality.completeness.toFixed(0)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall completeness
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="sinks">Data Sinks</TabsTrigger>
          <TabsTrigger value="processors">Processors</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Metrics Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Real-time Metrics
                </CardTitle>
                <CardDescription>
                  Live streaming performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Events:</span>
                        <span className="ml-2 font-medium">{metrics.totalEvents.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Processed:</span>
                        <span className="ml-2 font-medium">{metrics.processedEvents.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dropped:</span>
                        <span className="ml-2 font-medium">{metrics.droppedEvents.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Error Rate:</span>
                        <span className="ml-2 font-medium">{metrics.errorRate.toFixed(2)}%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Completeness</span>
                        <span>{metrics.dataQuality.completeness.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${metrics.dataQuality.completeness}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Accuracy</span>
                        <span>{metrics.dataQuality.accuracy.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${metrics.dataQuality.accuracy}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Current system status and health indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Sources</span>
                    <Badge variant={metrics?.activeSources && metrics.activeSources > 0 ? "default" : "secondary"}>
                      {metrics?.activeSources || 0} Active
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Sinks</span>
                    <Badge variant={metrics?.activeSinks && metrics.activeSinks > 0 ? "default" : "secondary"}>
                      {metrics?.activeSinks || 0} Active
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Processors</span>
                    <Badge variant={metrics?.activeProcessors && metrics.activeProcessors > 0 ? "default" : "secondary"}>
                      {metrics?.activeProcessors || 0} Active
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Event</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.lastEventTime ? 
                        new Date(metrics.lastEventTime).toLocaleTimeString() : 
                        'Never'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Data Sources
              </CardTitle>
              <CardDescription>
                Configure and monitor data sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={source.enabled}
                          onCheckedChange={(enabled) => toggleSource(source.id, enabled)}
                        />
                        <span className="font-medium">{source.name}</span>
                      </div>
                      
                      <Badge className={getStatusColor(source.status)}>
                        {source.status}
                      </Badge>
                      
                      {source.errorCount > 0 && (
                        <Badge variant="destructive">
                          {source.errorCount} Errors
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Last update: {source.lastUpdate?.toLocaleTimeString() || 'Never'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Sinks Tab */}
        <TabsContent value="sinks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Data Sinks
              </CardTitle>
              <CardDescription>
                Configure and monitor data sinks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sinks.map((sink) => (
                  <div key={sink.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={sink.enabled}
                          onCheckedChange={(enabled) => toggleSink(sink.id, enabled)}
                        />
                        <span className="font-medium">{sink.name}</span>
                      </div>
                      
                      <Badge variant="outline">
                        {sink.type}
                      </Badge>
                      
                      <span className="text-sm text-muted-foreground">
                        {sink.writeCount} writes
                      </span>
                      
                      {sink.errorCount > 0 && (
                        <Badge variant="destructive">
                          {sink.errorCount} Errors
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Last write: {sink.lastWrite?.toLocaleTimeString() || 'Never'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processors Tab */}
        <TabsContent value="processors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Data Processors
              </CardTitle>
              <CardDescription>
                Configure and monitor data transformation processors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TransformFactory.getAvailableTransforms().map((transformType) => (
                    <div key={transformType} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">
                          {transformType.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="outline">Available</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Data transformation processor for {transformType}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                System Alerts
              </CardTitle>
              <CardDescription>
                Monitor and manage system alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active alerts
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-4 border rounded-lg ${getAlertColor(alert.type)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getAlertIcon(alert.type)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium">{alert.message}</span>
                              <Badge variant="outline" className="text-xs">
                                {alert.source}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {alert.timestamp.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {!alert.acknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          
                          {alert.acknowledged && (
                            <Badge variant="secondary" className="text-xs">
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
