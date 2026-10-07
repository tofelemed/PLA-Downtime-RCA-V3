// Comprehensive Integration Dashboard for monitoring and managing all data sources
// Provides real-time status, performance metrics, and system health overview

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Database, 
  Wifi, 
  Server, 
  Zap, 
  Settings, 
  BarChart3,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { globalProtocolManager, ProtocolType, ProtocolConnection } from '@/services/integrations/ProtocolManager';

export const IntegrationDashboard: React.FC = () => {
  const [connections, setConnections] = useState<Map<string, ProtocolConnection>>(new Map());
  const [overallStats, setOverallStats] = useState({
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    healthScore: 0
  });

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = () => {
    const allConnections = globalProtocolManager.getAllConnections();
    setConnections(allConnections);
    
    const totalConnections = allConnections.size;
    const activeConnections = Array.from(allConnections.values()).filter(conn => conn.status?.connected).length;
    const totalMessages = Array.from(allConnections.values()).reduce((sum, conn) => sum + (conn.metrics?.totalMessages || 0), 0);
    const healthScore = totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;
    
    setOverallStats({
      totalConnections,
      activeConnections,
      totalMessages,
      healthScore
    });
  };

  const handleConnect = async (connectionId: string) => {
    try {
      await globalProtocolManager.connect(connectionId);
      loadDashboardData();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await globalProtocolManager.disconnect(connectionId);
      loadDashboardData();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleReconnect = async (connectionId: string) => {
    try {
      await globalProtocolManager.reconnect(connectionId);
      loadDashboardData();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  };

  const getProtocolIcon = (type: ProtocolType) => {
    switch (type) {
      case 'websocket': return <Wifi className="w-5 h-5" />;
      case 'mqtt': return <Zap className="w-5 h-5" />;
      case 'opcua': return <Server className="w-5 h-5" />;
      case 'database': return <Database className="w-5 h-5" />;
      case 'scada': return <Activity className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: any) => {
    if (status?.connected) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
    } else if (status?.errorCount > 0) {
      return <Badge variant="destructive">Error</Badge>;
    } else {
      return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integration Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and manage all your industrial protocol connections
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalConnections}</div>
            <p className="text-xs text-muted-foreground">Across all protocols</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overallStats.activeConnections}</div>
            <p className="text-xs text-muted-foreground">Currently connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Processed today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(overallStats.healthScore)}`}>
              {overallStats.healthScore.toFixed(1)}%
            </div>
            <Progress value={overallStats.healthScore} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Protocol Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Protocol Overview</CardTitle>
          <CardDescription>Status of all supported industrial protocols</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {globalProtocolManager.getSupportedProtocols().map(protocol => {
              const protocolConnections = Array.from(connections.values()).filter(conn => conn.type === protocol);
              const connected = protocolConnections.filter(conn => conn.status?.connected).length;
              const total = protocolConnections.length;
              
              return (
                <div key={protocol} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    {getProtocolIcon(protocol)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{protocol.toUpperCase()}</div>
                    <div className="text-sm text-muted-foreground">
                      {connected}/{total} connected
                    </div>
                  </div>
                  <Badge variant={connected > 0 ? "default" : "secondary"}>
                    {connected > 0 ? "Active" : "Inactive"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Connection List */}
      <Card>
        <CardHeader>
          <CardTitle>All Connections</CardTitle>
          <CardDescription>Manage individual protocol connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from(connections.values()).map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    {getProtocolIcon(connection.type)}
                  </div>
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline">{connection.type.toUpperCase()}</Badge>
                      {getStatusBadge(connection.status)}
                      <span>{connection.config.endpoint}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connection.status?.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(connection.id)}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(connection.id)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReconnect(connection.id)}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                  </Button>
                </div>
              </div>
            ))}

            {connections.size === 0 && (
              <div className="text-center py-12">
                <Database className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No connections configured</h3>
                <p className="text-muted-foreground">
                  Get started by adding your first protocol connection
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
