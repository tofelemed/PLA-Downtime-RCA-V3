// Comprehensive Integration Dashboard for monitoring and managing all data sources
// Provides real-time status, performance metrics, and system health overview

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Server, 
  Database, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  Info,
  RefreshCw,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  dataSources: number;
  activeConnections: number;
  failedConnections: number;
  lastSync: string;
  performance: {
    avgResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface PerformanceMetrics {
  timestamp: string;
  responseTime: number;
  success: boolean;
  errorCount: number;
  dataVolume: number;
}

export const IntegrationDashboard: React.FC = () => {
  const { toast } = useToast();
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    dataSources: 0,
    activeConnections: 0,
    failedConnections: 0,
    lastSync: new Date().toISOString(),
    performance: {
      avgResponseTime: 0,
      successRate: 100,
      errorRate: 0
    }
  });

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [activeSyncJobs, setActiveSyncJobs] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsRefreshing(true);
      
      // Load system health
      const health = await getSystemHealth();
      setSystemHealth(health);
      
      // Load performance metrics
      const metrics = await getPerformanceMetrics();
      setPerformanceMetrics(metrics);
      
      // Load active sync jobs
      const jobs = await getActiveSyncJobs();
      setActiveSyncJobs(jobs);
      
      // Load recent events
      const events = await getRecentEvents();
      setRecentEvents(events);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: 'Dashboard Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSystemHealth = async (): Promise<SystemHealth> => {
    // Simulate system health calculation
    const dataSources = 3; // Mock data
    const activeConnections = 2;
    const failedConnections = 1;
    
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (failedConnections > 0) overall = 'warning';
    if (failedConnections > activeConnections * 0.5) overall = 'critical';
    
    return {
      overall,
      dataSources,
      activeConnections,
      failedConnections,
      lastSync: new Date().toISOString(),
      performance: {
        avgResponseTime: Math.random() * 100 + 50,
        successRate: Math.max(0, 100 - failedConnections * 10),
        errorRate: Math.min(100, failedConnections * 10)
      }
    };
  };

  const getPerformanceMetrics = async (): Promise<PerformanceMetrics[]> => {
    // Simulate performance metrics for the last 24 hours
    const metrics: PerformanceMetrics[] = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      metrics.push({
        timestamp: timestamp.toISOString(),
        responseTime: Math.random() * 200 + 50,
        success: Math.random() > 0.1,
        errorCount: Math.floor(Math.random() * 5),
        dataVolume: Math.floor(Math.random() * 1000) + 100
      });
    }
    
    return metrics;
  };

  const getActiveSyncJobs = async (): Promise<any[]> => {
    // Simulate active sync jobs
    return [
      {
        id: 'job-1',
        sourceName: 'Production Historian',
        recordCount: 1250,
        progress: 75,
        status: 'running'
      },
      {
        id: 'job-2',
        sourceName: 'SAP PM System',
        recordCount: 890,
        progress: 45,
        status: 'running'
      }
    ];
  };

  const getRecentEvents = async (): Promise<any[]> => {
    // Simulate recent events
    return [
      {
        id: 'event-1',
        title: 'PI data sync completed',
        description: 'Successfully synchronized 1250 records from PI system',
        severity: 'info',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },
      {
        id: 'event-2',
        title: 'CMMS work order created',
        description: 'Created work order WO-001 from RCA recommendation',
        severity: 'info',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      },
      {
        id: 'event-3',
        title: 'Historian connection restored',
        description: 'Connection to Wonderware Historian has been restored',
        severity: 'warning',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      }
    ];
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'critical': return <AlertCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const handleSyncAction = async (action: 'start' | 'pause' | 'stop', jobId?: string) => {
    try {
      toast({
        title: 'Sync Action',
        description: `Successfully ${action}ed sync operation`,
      });
      
      loadDashboardData();
    } catch (error) {
      toast({
        title: 'Sync Action Error',
        description: `Failed to ${action} sync operation`,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Integration Dashboard</h3>
          <p className="text-muted-foreground">
            Real-time monitoring of all data source integrations and system health
          </p>
        </div>
        <Button 
          onClick={loadDashboardData} 
          disabled={isRefreshing}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            {getHealthIcon(systemHealth.overall)}
          </CardHeader>
          <CardContent>
            <Badge className={getHealthColor(systemHealth.overall)}>
              {systemHealth.overall.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.dataSources}</div>
            <p className="text-xs text-muted-foreground">
              {systemHealth.activeConnections} active, {systemHealth.failedConnections} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.performance.successRate.toFixed(1)}%</div>
            <Progress value={systemHealth.performance.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.performance.avgResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              Last sync: {new Date(systemHealth.lastSync).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="sync">Sync Jobs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Data Source Status */}
            <Card>
              <CardHeader>
                <CardTitle>Data Source Status</CardTitle>
                <CardDescription>Current connection status of all data sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['PI System', 'CMMS', 'Historian', 'SCADA'].map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{source}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          Math.random() > 0.3 ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <Badge variant={Math.random() > 0.3 ? 'default' : 'destructive'}>
                          {Math.random() > 0.3 ? 'Connected' : 'Failed'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system activities and events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    'PI data sync completed',
                    'CMMS work order created',
                    'Historian connection restored',
                    'New asset binding created'
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <span>{activity}</span>
                      <span className="text-muted-foreground ml-auto">
                        {Math.floor(Math.random() * 60)}m ago
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Response time and success rate over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-1">
                {performanceMetrics.map((metric, index) => (
                  <div key={index} className="flex-1 bg-blue-100 rounded-t" style={{
                    height: `${(metric.responseTime / 300) * 100}%`,
                    backgroundColor: metric.success ? '#dbeafe' : '#fecaca'
                  }} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
                {['00:00', '06:00', '12:00', '18:00'].map((time, index) => (
                  <div key={index} className="text-muted-foreground">{time}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Sync Jobs</CardTitle>
                  <CardDescription>Currently running data synchronization jobs</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSyncAction('start')}>
                    <Play className="w-4 h-4 mr-2" />
                    Start All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSyncAction('pause')}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeSyncJobs.length > 0 ? (
                  activeSyncJobs.map((job, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <div>
                          <div className="font-medium">{job.sourceName}</div>
                          <div className="text-sm text-muted-foreground">
                            {job.recordCount} records • {job.progress}% complete
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleSyncAction('pause', job.id)}>
                          <Pause className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSyncAction('stop', job.id)}>
                          <Square className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No active sync jobs
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Latest system events and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEvents.length > 0 ? (
                  recentEvents.map((event, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        event.severity === 'error' ? 'bg-red-500' :
                        event.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm text-muted-foreground">{event.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent events
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
