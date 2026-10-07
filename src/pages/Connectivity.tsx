import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Activity, Server, Database, Settings, CheckCircle, AlertCircle, Clock, PlugZap, ClipboardList, Zap, BarChart3, RefreshCw, Search, Download, Plus, FileText, FileSpreadsheet, FileJson, TrendingUp, AlertTriangle, Calendar, CalendarDays } from 'lucide-react';
import { PIClient, createTenantPIClient } from '@/services/pi/PIClient';
import { piStore } from '@/services/pi/PIStore';
import { useToast } from '@/hooks/use-toast';
import PIIntegration from './integrations/PIIntegration';
import PIEventSyncManager from '../components/pi/PIEventSyncManager';
import { DataSourceManager } from '@/components/integrations/DataSourceManager';
import { BindingManager } from '@/components/integrations/BindingManager';
import { IntegrationDashboard } from '@/components/integrations/IntegrationDashboard';
import { StreamingDashboard } from '@/components/streaming/StreamingDashboard';
import { RealTimeCharts } from '@/components/streaming/RealTimeCharts';
import { OPCUABrowser } from '@/components/integrations/OPCUABrowser';
import { OPCUAMonitor } from '@/components/integrations/OPCUAMonitor';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import HierarchyMappingManager from '@/components/hierarchy-mapping/HierarchyMappingManager';

export const Connectivity: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [piConfig, setPiConfig] = useState({
    server: '',
    username: '',
    password: '',
    database: '',
    enabled: false,
    syncInterval: '300',
  });
  
  const [cmmsConfig, setCmmsConfig] = useState({
    endpoint: '',
    apiKey: '',
    username: '',
    password: '',
    system: 'SAP',
    enabled: false,
  });

  const [connections] = useState([
    {
      id: '1',
      name: 'PI Event Frames',
      type: 'Aveva PI',
      status: 'Disconnected',
      lastSync: null,
      description: 'Production loss event ingestion',
    },
    {
      id: '2',
      name: 'Work Order System',
      type: 'CMMS',
      status: 'Not Configured',
      lastSync: null,
      description: 'Push recommendations to maintenance system',
    },
    {
      id: '3',
      name: 'Historian Database',
      type: 'Time Series',
      status: 'Simulated',
      lastSync: new Date().toISOString(),
      description: 'Process data for RCA evidence',
    },
  ]);

  const [activeTab, setActiveTab] = useState('overview');
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [isRefreshingPI, setIsRefreshingPI] = useState(false);

  const saveConfiguration = (type: 'pi' | 'cmms') => {
    toast({
      title: 'Configuration Saved',
      description: `${type === 'pi' ? 'PI' : 'CMMS'} configuration has been saved (simulation mode)`,
    });
  };

  const testConnection = (type: 'pi' | 'cmms') => {
    // Simulate connection test
    setTimeout(() => {
      toast({
        title: 'Connection Test',
        description: `${type === 'pi' ? 'PI' : 'CMMS'} connection test completed (simulated)`,
        variant: Math.random() > 0.5 ? 'default' : 'destructive',
      });
    }, 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Disconnected':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'Simulated':
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // --- Dynamic PI status ---
  const [piServerConnected, setPiServerConnected] = useState<boolean | null>(null);
  const [piEfOnline, setPiEfOnline] = useState<boolean | null>(null);
  const [piLastChecked, setPiLastChecked] = useState<string | null>(null);

  async function checkPIStatus() {
    try {
      const tenantId = session?.tenant?.id;
      if (!tenantId) {
        setPiServerConnected(null);
        setPiEfOnline(null);
        setPiLastChecked(new Date().toLocaleString());
        return;
      }
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (!cfg) {
        setPiServerConnected(null); 
        setPiEfOnline(null); 
        setPiLastChecked(new Date().toLocaleString());
        return;
      }
      
      const client = createTenantPIClient(tenantId);
      
      // Server status - test basic connectivity
      try {
        await client.getAssetServers();
        setPiServerConnected(true);
      } catch (error) {
        console.warn('PI server connectivity check failed:', error);
        setPiServerConnected(false);
        setPiEfOnline(false);
        setPiLastChecked(new Date().toLocaleString());
        return; // Don't test event frames if basic connectivity fails
      }
      
      // Event frames endpoint status - only test if we have a database and basic connectivity works
      try {
        if (cfg.afDatabase?.webId) {
          await client.getEventFrames({ 
            databaseWebId: cfg.afDatabase.webId, 
            startTimeUtc: new Date(Date.now()-60000).toISOString(), 
            endTimeUtc: new Date().toISOString(), 
            maxCount: 1 
          });
          setPiEfOnline(true);
        } else {
          // Try to find any available database to test EF connectivity
          try {
            const assetServers = await client.getAssetServers();
            if (assetServers?.Items?.length > 0) {
              const firstServer = assetServers.Items[0];
              const databases = await client.getAFDatabases(firstServer.WebId);
              if (databases?.Items?.length > 0) {
                const firstDb = databases.Items[0];
                await client.getEventFrames({ 
                  databaseWebId: firstDb.WebId, 
                  startTimeUtc: new Date(Date.now()-60000).toISOString(), 
                  endTimeUtc: new Date().toISOString(), 
                  maxCount: 1 
                });
                setPiEfOnline(true);
              } else {
                setPiEfOnline(null);
              }
            } else {
              setPiEfOnline(null);
            }
          } catch {
            setPiEfOnline(null);
          }
        }
      } catch (error) {
        console.warn('PI Event Frames connectivity check failed:', error);
        setPiEfOnline(false);
      }
      
      setPiLastChecked(new Date().toLocaleString());
    } catch (error) {
      console.error('PI status check failed:', error);
      setPiServerConnected(false); 
      setPiEfOnline(false);
      setPiLastChecked(new Date().toLocaleString());
    }
  }

  React.useEffect(() => {
    // Only check if we have saved creds to avoid Windows auth prompt
    (async () => {
      const tenantId = session?.tenant?.id ?? 'default-tenant';
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (cfg?.username && cfg?.password) {
        checkPIStatus();
      }
    })();
    const timer = setInterval(() => {
      checkPIStatus();
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Connected': return 'bg-green-100 text-green-800';
      case 'Disconnected': return 'bg-red-100 text-red-800';
      case 'Simulated': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!session || !['SuperAdmin', 'OrgAdmin', 'TenantAdmin'].includes(session.user.role)) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">You don't have permission to access connectivity settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Connectivity</h2>
          <p className="text-muted-foreground">
            Configure external system integrations and data connections
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="protocols">Protocols</TabsTrigger>
          <TabsTrigger value="opcua">OPC UA</TabsTrigger>
          <TabsTrigger value="modbus">Modbus</TabsTrigger>
          <TabsTrigger value="ethernetip">EtherNet/IP</TabsTrigger>
          <TabsTrigger value="mqtt">MQTT</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="mappings">Hierarchy Mappings</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab - System Health & Status */}
        <TabsContent value="overview" className="space-y-6">
          {/* System Health Summary */}
          <Card className="border-l-4 border-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-green-600" />
                System Health Overview
              </CardTitle>
              <CardDescription>
                Overall connectivity and integration status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {piServerConnected ? '✅' : (piServerConnected === false ? '❌' : '❓')}
                  </div>
                  <div className="text-sm font-medium text-green-800">PI Server</div>
                  <div className="text-xs text-green-600">
                    {piServerConnected ? 'Connected' : (piServerConnected === false ? 'Disconnected' : 'Unknown')}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">
                    {cmmsConfig.enabled ? '✅' : '⚠️'}
                  </div>
                  <div className="text-sm font-medium text-emerald-800">CMMS</div>
                  <div className="text-xs text-emerald-600">
                    {cmmsConfig.enabled ? 'Configured' : 'Not Configured'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">📊</div>
                  <div className="text-sm font-medium text-blue-800">Historian</div>
                  <div className="text-xs text-blue-600">Simulated</div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">🔗</div>
                  <div className="text-sm font-medium text-purple-800">Protocols</div>
                  <div className="text-xs text-purple-600">Ready</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            {/* Compact PI card with heartbeat */}
            <Card className="border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer group" onClick={() => setActiveTab('integrations')}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <PlugZap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="truncate">
                      <CardTitle className="text-sm leading-tight group-hover:text-blue-700 transition-colors">PI Event Frames</CardTitle>
                      <CardDescription className="truncate">Production loss events</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center" aria-label="online-status">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${piEfOnline ? 'bg-green-400' : (piEfOnline===false ? 'bg-red-400' : 'bg-gray-400')} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${piEfOnline ? 'bg-green-500' : (piEfOnline===false ? 'bg-red-500' : 'bg-gray-500')}`}></span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Server</span>
                  <span className="font-medium">{piServerConnected ? 'Connected' : (piServerConnected===false ? 'Disconnected' : 'Unknown')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Event Frames</span>
                  <span className="font-medium">{piEfOnline ? 'Online' : (piEfOnline===false ? 'Unavailable' : 'Unknown')}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Checked</span>
                  <span>{piLastChecked || '—'}</span>
                </div>
                {piServerConnected === null && (
                  <div className="mt-2 text-[10px] text-amber-600">
                    Configure PI connection first
                  </div>
                )}
                <div className="mt-2 text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to configure PI integration →
                </div>
              </CardContent>
            </Card>

            {/* Work Order System */}
            <Card className="border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer group" onClick={() => setActiveTab('integrations')}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <ClipboardList className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="truncate">
                      <CardTitle className="text-sm leading-tight group-hover:text-emerald-700 transition-colors">Work Order System</CardTitle>
                      <CardDescription className="truncate">CMMS integration</CardDescription>
                    </div>
                  </div>
                  <div className="relative flex items-center" aria-label="online-status">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cmmsConfig.enabled ? 'bg-green-400' : 'bg-gray-400'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cmmsConfig.enabled ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Type</span>
                  <span className="font-medium">{cmmsConfig.system}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Status</span>
                  <span className="font-medium">{cmmsConfig.enabled ? 'Enabled' : 'Not Configured'}</span>
                </div>
                <div className="mt-2 text-[10px] text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to configure CMMS integration →
                </div>
              </CardContent>
            </Card>

            {/* Historian Database */}
            <Card className="border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer group" onClick={() => setActiveTab('protocols')}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      <Database className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="truncate">
                      <CardTitle className="text-sm leading-tight group-hover:text-indigo-700 transition-colors">Historian Database</CardTitle>
                      <CardDescription className="truncate">Process historian</CardDescription>
                    </div>
                  </div>
                  <div className="relative flex items-center" aria-label="online-status">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Type</span>
                  <span className="font-medium">Time Series</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Status</span>
                  <span className="font-medium">Simulated</span>
                </div>
                <div className="mt-2 text-[10px] text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to manage protocols →
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common connectivity tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col hover:bg-blue-50 hover:border-blue-300 transition-colors" 
                  onClick={() => {
                    setActiveTab('protocols');
                  }}
                >
                  <Database className="w-6 h-6 mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Manage Protocols</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex-col hover:bg-green-50 hover:border-green-300 transition-colors" 
                  onClick={() => {
                    setActiveTab('integrations');
                  }}
                >
                  <Settings className="w-6 h-6 mb-2 text-green-600" />
                  <span className="text-sm font-medium">System Integrations</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex-col hover:bg-purple-50 hover:border-purple-300 transition-colors" 
                  onClick={() => {
                    setActiveTab('settings');
                  }}
                >
                  <Activity className="w-6 h-6 mb-2 text-purple-600" />
                  <span className="text-sm font-medium">Performance</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex-col hover:bg-orange-50 hover:border-orange-300 transition-colors"
                  onClick={async () => {
                    setIsHealthChecking(true);
                    // Health Check functionality
                    toast({
                      title: '🔄 Health Check Started',
                      description: 'Checking all system connections and integrations...',
                    });
                    
                    // Simulate health check
                    setTimeout(() => {
                      const piStatus = piServerConnected ? '✅ Connected' : '❌ Disconnected';
                      const cmmsStatus = cmmsConfig.enabled ? '✅ Enabled' : '❌ Disabled';
                      
                      toast({
                        title: '🏥 Health Check Complete',
                        description: `PI: ${piStatus} | CMMS: ${cmmsStatus} | All systems operational`,
                        variant: 'default',
                      });
                      setIsHealthChecking(false);
                    }, 2000);
                  }}
                  disabled={isHealthChecking}
                >
                  <RefreshCw className={`w-6 h-6 mb-2 text-orange-600 ${isHealthChecking ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-medium">
                    {isHealthChecking ? 'Checking...' : 'Health Check'}
                  </span>
                </Button>
              </div>
              
              {/* Additional Quick Actions */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3 text-sm text-gray-700">Additional Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="justify-start text-left h-auto py-2 px-3"
                    onClick={() => {
                      setActiveTab('opcua');
                    }}
                  >
                    <Database className="w-4 h-4 mr-2 text-blue-600" />
                    <span className="text-xs">OPC UA Config</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="justify-start text-left h-auto py-2 px-3"
                    onClick={() => {
                      setActiveTab('browser');
                    }}
                  >
                    <Search className="w-4 h-4 mr-2 text-green-600" />
                    <span className="text-xs">OPC UA Browser</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="justify-start text-left h-auto py-2 px-3"
                    onClick={async () => {
                      setIsRefreshingPI(true);
                      try {
                        await checkPIStatus();
                        toast({
                          title: 'PI Status Refreshed',
                          description: `Server: ${piServerConnected ? 'Connected' : (piServerConnected === false ? 'Disconnected' : 'Unknown')} | Event Frames: ${piEfOnline ? 'Online' : (piEfOnline === false ? 'Unavailable' : 'Unknown')}`,
                        });
                      } catch (error) {
                        toast({
                          title: 'PI Status Refresh Failed',
                          description: 'Failed to refresh PI connection status',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsRefreshingPI(false);
                      }
                    }}
                    disabled={isRefreshingPI}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 text-purple-600 ${isRefreshingPI ? 'animate-spin' : ''}`} />
                    <span className="text-xs">
                      {isRefreshingPI ? 'Refreshing...' : 'Refresh PI Status'}
                    </span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Protocols Tab - All Protocol Management */}
        <TabsContent value="protocols" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Protocol Management</h3>
              <p className="text-muted-foreground">
                Configure and manage all industrial communication protocols with full functionality
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('overview')}
            >
              ← Back to Overview
            </Button>
          </div>

          {/* Protocol Categories */}
          <div className="grid gap-6">
            {/* Industrial Protocols */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  Industrial Protocols
                </CardTitle>
                <CardDescription>
                  OPC UA, Modbus, EtherNet/IP, Profinet, BACnet, DNP3, and other industrial communication protocols
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* OPC UA */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">OPC UA</h4>
                      <Badge variant="outline" className="text-xs">Industrial</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Open Platform Communications Unified Architecture</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('opcua')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('browser')}>
                        Browser
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                    </div>
                  </div>
                  
                  {/* Modbus */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Modbus</h4>
                      <Badge variant="outline" className="text-xs">Industrial</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Serial communication protocol for industrial automation</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('modbus')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Data Browser
                      </Button>
                    </div>
                  </div>

                  {/* EtherNet/IP */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">EtherNet/IP</h4>
                      <Badge variant="outline" className="text-xs">Industrial</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Ethernet-based industrial protocol</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('ethernetip')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Tags Browser
                      </Button>
                    </div>
                  </div>

                  {/* Profinet */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Profinet</h4>
                      <Badge variant="outline" className="text-xs">Industrial</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Process Field Network for automation</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('profinet')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        I/O Browser
                      </Button>
                    </div>
                  </div>

                  {/* BACnet */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">BACnet</h4>
                      <Badge variant="outline" className="text-xs">Building</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Building Automation and Control Networks</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('bacnet')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Objects Browser
                      </Button>
                    </div>
                  </div>

                  {/* DNP3 */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">DNP3</h4>
                      <Badge variant="outline" className="text-xs">Utility</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Distributed Network Protocol for utilities</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('dnp3')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Points Browser
                      </Button>
                    </div>
                  </div>

                  {/* SCADA */}
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">SCADA</h4>
                      <Badge variant="outline" className="text-xs">Control</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Supervisory Control and Data Acquisition</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('scada')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        HMI Browser
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Messaging Protocols */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  Messaging & IoT Protocols
                </CardTitle>
                <CardDescription>
                  MQTT, WebSocket, HTTP/REST, and other messaging protocols for real-time data exchange
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">MQTT</h4>
                      <Badge variant="outline" className="text-xs">IoT</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Lightweight messaging protocol for IoT devices</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('mqtt')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Topics Browser
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">WebSocket</h4>
                      <Badge variant="outline" className="text-xs">Real-time</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Bidirectional communication for real-time applications</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('websocket')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Events Browser
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">HTTP/REST</h4>
                      <Badge variant="outline" className="text-xs">Web</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">RESTful API communication</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('http')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Endpoints
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">AMQP</h4>
                      <Badge variant="outline" className="text-xs">Enterprise</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Advanced Message Queuing Protocol</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('amqp')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Queues
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database & Storage Protocols */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Database & Storage Protocols
                </CardTitle>
                <CardDescription>
                  Time-series databases, historians, and data storage systems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">InfluxDB</h4>
                      <Badge variant="outline" className="text-xs">Time Series</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">High-performance time series database</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('influxdb')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Data Browser
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">TimescaleDB</h4>
                      <Badge variant="outline" className="text-xs">Time Series</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">PostgreSQL extension for time-series data</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('timescaledb')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        SQL Browser
                      </Button>
                      </div>
                  </div>

                  <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Redis</h4>
                      <Badge variant="outline" className="text-xs">Cache</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">In-memory data structure store</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('redis')}>
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm">
                        Keys Browser
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Universal Data Source Manager */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Universal Data Source Manager
                </CardTitle>
                <CardDescription>
                  Manage all protocol connections, transformations, and data pipelines in one place
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataSourceManager />
              </CardContent>
            </Card>

            {/* Protocol Status Dashboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-600" />
                  Protocol Status Dashboard
                </CardTitle>
                <CardDescription>
                  Real-time status and performance metrics for all configured protocols
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">🔗</div>
                    <div className="text-sm font-medium text-blue-800">Active Protocols</div>
                    <div className="text-lg font-bold text-blue-600">3</div>
                    <div className="text-xs text-blue-600">OPC UA, MQTT, Modbus</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">📊</div>
                    <div className="text-sm font-medium text-green-800">Data Points</div>
                    <div className="text-lg font-bold text-green-600">1,247</div>
                    <div className="text-xs text-green-600">Real-time values</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">⚡</div>
                    <div className="text-sm font-medium text-purple-800">Polling Rate</div>
                    <div className="text-lg font-bold text-purple-600">100ms</div>
                    <div className="text-xs text-purple-600">Average latency</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">💾</div>
                    <div className="text-sm font-medium text-orange-800">Storage</div>
                    <div className="text-lg font-bold text-orange-600">2.4GB</div>
                    <div className="text-xs text-orange-600">IndexedDB usage</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* OPC UA Configuration Tab */}
        <TabsContent value="opcua" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">OPC UA Configuration</h3>
              <p className="text-muted-foreground">
                Configure OPC UA connections, security settings, and data polling parameters
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActiveTab('browser')}>
                <Search className="w-4 h-4 mr-2" />
                OPC UA Browser
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('overview')}>
                ← Back to Overview
              </Button>
            </div>
          </div>

          {/* OPC UA Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                OPC UA Connection Configuration
              </CardTitle>
              <CardDescription>
                Configure new OPC UA server connection with advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Connection Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Basic Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-name">Connection Name</Label>
                    <Input
                      id="opcua-name"
                      placeholder="My OPC UA Server"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-endpoint">Server Endpoint</Label>
                    <Input
                      id="opcua-endpoint"
                      placeholder="opc.tcp://server:4840"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-application">Application Name</Label>
                    <Input
                      id="opcua-application"
                      placeholder="ProAct Client"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-timeout">Connection Timeout (ms)</Label>
                    <Input
                      id="opcua-timeout"
                      type="number"
                      defaultValue="30000"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Security Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Security Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-security-mode">Security Mode</Label>
                    <Select defaultValue="SignAndEncrypt">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Sign">Sign</SelectItem>
                        <SelectItem value="SignAndEncrypt">Sign and Encrypt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-security-policy">Security Policy</Label>
                    <Select defaultValue="Basic256Sha256">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Basic128Rsa15">Basic128Rsa15</SelectItem>
                        <SelectItem value="Basic256">Basic256</SelectItem>
                        <SelectItem value="Basic256Sha256">Basic256Sha256</SelectItem>
                        <SelectItem value="Aes128Sha256RsaOaep">Aes128Sha256RsaOaep</SelectItem>
                        <SelectItem value="Aes256Sha256RsaPss">Aes256Sha256RsaPss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-username">Username (Optional)</Label>
                    <Input
                      id="opcua-username"
                      placeholder="username"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-password">Password (Optional)</Label>
                    <Input
                      id="opcua-password"
                      type="password"
                      placeholder="••••••••"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Advanced Settings</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="opcua-session-timeout">Session Timeout (ms)</Label>
                    <Input
                      id="opcua-session-timeout"
                      type="number"
                      defaultValue="60000"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-keep-alive">Keep Alive Interval (ms)</Label>
                    <Input
                      id="opcua-keep-alive"
                      type="number"
                      defaultValue="10000"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-max-message-size">Max Message Size</Label>
                    <Input
                      id="opcua-max-message-size"
                      type="number"
                      defaultValue="65536"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Data Polling Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Data Polling Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="opcua-polling-interval">Default Polling Interval (ms)</Label>
                    <Input
                      id="opcua-polling-interval"
                      type="number"
                      defaultValue="1000"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="opcua-subscription-size">Subscription Size</Label>
                    <Input
                      id="opcua-subscription-size"
                      type="number"
                      defaultValue="1000"
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="opcua-nodes">Default Nodes to Poll</Label>
                  <Input
                    id="opcua-nodes"
                    placeholder="ns=2;s=Device1.Temperature,ns=2;s=Device1.Pressure"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Comma-separated list of Node IDs to poll by default
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setActiveTab('browser')}>
                  <Search className="w-4 h-4 mr-2" />
                  Browse Server
                </Button>
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
                <Button>
                  <Database className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing OPC UA Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Existing OPC UA Connections
              </CardTitle>
              <CardDescription>
                Manage and monitor active OPC UA connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataSourceManager />
            </CardContent>
          </Card>

          {/* OPC UA Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                OPC UA Performance Metrics
              </CardTitle>
              <CardDescription>
                Real-time performance and health metrics for OPC UA connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">📡</div>
                  <div className="text-sm font-medium text-blue-800">Active Sessions</div>
                  <div className="text-lg font-bold text-blue-600">2</div>
                  <div className="text-xs text-blue-600">Connected servers</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">⚡</div>
                  <div className="text-sm font-medium text-green-800">Response Time</div>
                  <div className="text-lg font-bold text-green-600">45ms</div>
                  <div className="text-xs text-green-600">Average</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">📊</div>
                  <div className="text-sm font-medium text-purple-800">Data Points</div>
                  <div className="text-lg font-bold text-purple-600">847</div>
                  <div className="text-xs text-purple-600">Monitored</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">🔄</div>
                  <div className="text-sm font-medium text-orange-800">Poll Rate</div>
                  <div className="text-lg font-bold text-orange-600">1s</div>
                  <div className="text-xs text-orange-600">Default</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modbus Configuration Tab */}
        <TabsContent value="modbus" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Modbus Configuration</h3>
              <p className="text-muted-foreground">
                Configure Modbus RTU/TCP connections and data polling parameters
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('overview')}
            >
              ← Back to Overview
            </Button>
          </div>

          {/* Modbus Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Modbus Connection Configuration
              </CardTitle>
              <CardDescription>
                Configure new Modbus connection with advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Connection Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Basic Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-name">Connection Name</Label>
                    <Input
                      id="modbus-name"
                      placeholder="My Modbus Device"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-type">Modbus Type</Label>
                    <Select defaultValue="tcp">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tcp">Modbus TCP</SelectItem>
                        <SelectItem value="rtu">Modbus RTU</SelectItem>
                        <SelectItem value="ascii">Modbus ASCII</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-ip">IP Address / Serial Port</Label>
                    <Input
                      id="modbus-ip"
                      placeholder="192.168.1.100 or COM1"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-port">Port / Baud Rate</Label>
                    <Input
                      id="modbus-port"
                      placeholder="502 or 9600"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Advanced Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-timeout">Response Timeout (ms)</Label>
                    <Input
                      id="modbus-timeout"
                      type="number"
                      defaultValue="5000"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-retries">Retry Count</Label>
                    <Input
                      id="modbus-retries"
                      type="number"
                      defaultValue="3"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-unit-id">Unit ID</Label>
                    <Input
                      id="modbus-unit-id"
                      type="number"
                      defaultValue="1"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-polling">Polling Interval (ms)</Label>
                    <Input
                      id="modbus-polling"
                      type="number"
                      defaultValue="1000"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Register Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Register Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="modbus-start-address">Start Address</Label>
                    <Input
                      id="modbus-start-address"
                      type="number"
                      defaultValue="0"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-register-count">Register Count</Label>
                    <Input
                      id="modbus-register-count"
                      type="number"
                      defaultValue="10"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modbus-data-type">Data Type</Label>
                    <Select defaultValue="uint16">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uint16">16-bit Unsigned</SelectItem>
                        <SelectItem value="int16">16-bit Signed</SelectItem>
                        <SelectItem value="uint32">32-bit Unsigned</SelectItem>
                        <SelectItem value="int32">32-bit Signed</SelectItem>
                        <SelectItem value="float32">32-bit Float</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
                <Button>
                  <Database className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EtherNet/IP Configuration Tab */}
        <TabsContent value="ethernetip" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">EtherNet/IP Configuration</h3>
              <p className="text-muted-foreground">
                Configure EtherNet/IP connections and CIP tag management
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('overview')}
            >
              ← Back to Overview
            </Button>
          </div>

          {/* EtherNet/IP Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                EtherNet/IP Connection Configuration
              </CardTitle>
              <CardDescription>
                Configure new EtherNet/IP connection with advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Connection Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Basic Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-name">Connection Name</Label>
                    <Input
                      id="ethernetip-name"
                      placeholder="My EtherNet/IP Device"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-ip">IP Address</Label>
                    <Input
                      id="ethernetip-ip"
                      placeholder="192.168.1.100"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-port">Port</Label>
                    <Input
                      id="ethernetip-port"
                      type="number"
                      defaultValue="44818"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-timeout">Connection Timeout (ms)</Label>
                    <Input
                      id="ethernetip-timeout"
                      type="number"
                      defaultValue="10000"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Advanced Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-slot">Backplane Slot</Label>
                    <Input
                      id="ethernetip-slot"
                      type="number"
                      defaultValue="0"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-vendor">Vendor ID</Label>
                    <Input
                      id="ethernetip-vendor"
                      type="number"
                      defaultValue="1"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-product">Product Code</Label>
                    <Input
                      id="ethernetip-product"
                      type="number"
                      defaultValue="0"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-polling">Polling Interval (ms)</Label>
                    <Input
                      id="ethernetip-polling"
                      type="number"
                      defaultValue="100"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* CIP Tag Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">CIP Tag Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-tag-path">Tag Path</Label>
                    <Input
                      id="ethernetip-tag-path"
                      placeholder="Program:MainProgram.Temperature"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-data-type">Data Type</Label>
                    <Select defaultValue="real">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bool">Boolean</SelectItem>
                        <SelectItem value="sint">8-bit Signed</SelectItem>
                        <SelectItem value="int">16-bit Signed</SelectItem>
                        <SelectItem value="dint">32-bit Signed</SelectItem>
                        <SelectItem value="real">32-bit Float</SelectItem>
                        <SelectItem value="string">String</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ethernetip-array-size">Array Size</Label>
                    <Input
                      id="ethernetip-array-size"
                      type="number"
                      defaultValue="1"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
                <Button>
                  <Database className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MQTT Configuration Tab */}
        <TabsContent value="mqtt" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">MQTT Configuration</h3>
              <p className="text-muted-foreground">
                Configure MQTT broker connections and topic subscriptions
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('overview')}
            >
              ← Back to Overview
            </Button>
          </div>

          {/* MQTT Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                MQTT Connection Configuration
              </CardTitle>
              <CardDescription>
                Configure new MQTT broker connection with advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Connection Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Basic Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-name">Connection Name</Label>
                    <Input
                      id="mqtt-name"
                      placeholder="My MQTT Broker"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-broker">Broker URL</Label>
                    <Input
                      id="mqtt-broker"
                      placeholder="mqtt://broker.example.com"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-port">Port</Label>
                    <Input
                      id="mqtt-port"
                      type="number"
                      defaultValue="1883"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-client-id">Client ID</Label>
                    <Input
                      id="mqtt-client-id"
                      placeholder="ProAct_Client_001"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Authentication Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Authentication</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-username">Username</Label>
                    <Input
                      id="mqtt-username"
                      placeholder="username"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-password">Password</Label>
                    <Input
                      id="mqtt-password"
                      type="password"
                      placeholder="••••••••"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-keepalive">Keep Alive (seconds)</Label>
                    <Input
                      id="mqtt-keepalive"
                      type="number"
                      defaultValue="60"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-clean-session">Clean Session</Label>
                    <Select defaultValue="true">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Topic Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Topic Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-subscribe-topics">Subscribe Topics</Label>
                    <Input
                      id="mqtt-subscribe-topics"
                      placeholder="sensors/+/temperature, devices/+/status"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Comma-separated list of topics to subscribe to
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-publish-topic">Default Publish Topic</Label>
                    <Input
                      id="mqtt-publish-topic"
                      placeholder="commands/device/control"
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mqtt-qos">Quality of Service</Label>
                  <Select defaultValue="1">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">QoS 0 - At most once</SelectItem>
                      <SelectItem value="1">QoS 1 - At least once</SelectItem>
                      <SelectItem value="2">QoS 2 - Exactly once</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
                <Button>
                  <Database className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab - System Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">System Integrations</h3>
              <p className="text-muted-foreground">
                Configure external system connections and data flows
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                setActiveTab('overview');
              }}
            >
              ← Back to Overview
            </Button>
          </div>

          <div className="grid gap-6">
            {/* Aveva PI Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlugZap className="w-5 h-5 text-blue-600" />
                  Aveva PI Configuration
                </CardTitle>
                <CardDescription>
                  Configure PI Event Frames and data historian connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PIIntegration />
              </CardContent>
            </Card>

            {/* PI Event Auto-Sync */}
            <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
                  PI Event Frame Auto-Sync
                </CardTitle>
                <CardDescription>
                  Automatically pull production events from PI Event Frames at scheduled intervals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PIEventSyncManager tenantId={session?.tenant?.id || ''} />
              </CardContent>
            </Card>

            {/* CMMS Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-600" />
                  CMMS Integration
                </CardTitle>
                <CardDescription>
                  Configure maintenance management system connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">CMMS System</h4>
                      <p className="text-sm text-gray-600">Select your maintenance management system</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="cmms-enabled">Enabled</Label>
                      <Switch
                        id="cmms-enabled"
                        checked={cmmsConfig.enabled}
                        onCheckedChange={(checked) => setCmmsConfig({ ...cmmsConfig, enabled: checked })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cmms-system">CMMS System</Label>
                      <Select value={cmmsConfig.system} onValueChange={(value) => setCmmsConfig({ ...cmmsConfig, system: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAP">SAP PM</SelectItem>
                          <SelectItem value="Maximo">IBM Maximo</SelectItem>
                          <SelectItem value="Infor">Infor EAM</SelectItem>
                          <SelectItem value="eMaint">eMaint</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cmms-endpoint">API Endpoint</Label>
                      <Input
                        id="cmms-endpoint"
                        placeholder="https://api.cmms.company.com"
                        value={cmmsConfig.endpoint}
                        onChange={(e) => setCmmsConfig({ ...cmmsConfig, endpoint: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => testConnection('cmms')}>
                      Test Connection
                    </Button>
                    <Button onClick={() => saveConfiguration('cmms')}>
                      Save Configuration
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Flow & Binding */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Data Flow & Binding
                </CardTitle>
                <CardDescription>
                  Configure data transformations, hierarchies, and real-time monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="binding" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="binding">Hierarchy Binding</TabsTrigger>
                    <TabsTrigger value="dashboard">Integration Dashboard</TabsTrigger>
                    <TabsTrigger value="streaming">Real-time Monitoring</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="binding" className="space-y-4">
                    <BindingManager />
                  </TabsContent>
                  
                  <TabsContent value="dashboard" className="space-y-4">
                    <IntegrationDashboard />
                  </TabsContent>
                  
                  <TabsContent value="streaming" className="space-y-4">
                    <StreamingDashboard />
                    <RealTimeCharts />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hierarchy Mappings Tab */}
        <TabsContent value="mappings" className="space-y-6">
          <ErrorBoundary>
            <HierarchyMappingManager />
          </ErrorBoundary>
        </TabsContent>

        {/* Settings Tab - General Configuration */}
        <TabsContent value="settings" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Integration Settings</h3>
              <p className="text-muted-foreground">
                General settings for data synchronization and system behavior
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                setActiveTab('overview');
              }}
            >
              ← Back to Overview
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure system-wide integration behavior and performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Data Retention</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Event Data Retention (days)</Label>
                    <Input defaultValue="365" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label>RCA Data Retention (days)</Label>
                    <Input defaultValue="1095" type="number" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Notification Settings</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-events">Notify on new production events</Label>
                    <Switch id="notify-events" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-rca">Notify on RCA updates</Label>
                    <Switch id="notify-rca" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-cmms">Notify on CMMS sync status</Label>
                    <Switch id="notify-cmms" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Performance Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max concurrent syncs</Label>
                    <Input defaultValue="5" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout (seconds)</Label>
                    <Input defaultValue="30" type="number" />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPC UA Browser Tab */}
        <TabsContent value="browser" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">OPC UA Browser</h3>
              <p className="text-muted-foreground">
                Browse and explore OPC UA server address space with real-time data monitoring
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('overview')}
            >
              ← Back to Overview
            </Button>
          </div>

          {/* Connection Selection & Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Connection Status & Selection
              </CardTitle>
              <CardDescription>
                Select OPC UA connection and view real-time status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opcua-connection">Select Connection</Label>
                  <Select defaultValue="default">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose OPC UA connection" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">OPC UA Test Server</SelectItem>
                      <SelectItem value="production">Production Server</SelectItem>
                      <SelectItem value="development">Development Server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Connection Status</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-green-700">Connected</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Last Activity</Label>
                  <div className="text-sm text-gray-600">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Browsing Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-green-600" />
                Advanced Browsing Controls
              </CardTitle>
              <CardDescription>
                Configure browsing parameters and search options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="browse-starting-node">Starting Node ID</Label>
                  <Input
                    id="browse-starting-node"
                    defaultValue="i=84"
                    placeholder="i=84"
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="browse-max-nodes">Max Nodes</Label>
                  <Input
                    id="browse-max-nodes"
                    type="number"
                    defaultValue="100"
                    min="10"
                    max="1000"
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="browse-depth">Browse Depth</Label>
                  <Select defaultValue="2">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="browse-filter">Node Filter</Label>
                  <Input
                    id="browse-filter"
                    placeholder="Filter nodes..."
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id="include-values" defaultChecked />
                  <Label htmlFor="include-values">Include Node Values</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch id="include-attributes" defaultChecked />
                  <Label htmlFor="include-attributes">Include Attributes</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch id="recursive-browse" />
                  <Label htmlFor="recursive-browse">Recursive Browse</Label>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Search className="w-4 h-4 mr-2" />
                  Browse Address Space
                </Button>
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Browse Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Data Monitoring */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Real-time Data Monitoring
              </CardTitle>
              <CardDescription>
                Monitor selected OPC UA nodes with live data updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorBoundary>
                <OPCUAMonitor />
              </ErrorBoundary>
            </CardContent>
          </Card>

          {/* Address Space Browser */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                Address Space Browser
              </CardTitle>
              <CardDescription>
                Browse and explore the OPC UA server address space
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OPCUABrowser />
            </CardContent>
          </Card>

          {/* Data Export & Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-orange-600" />
                Data Export & Analysis
              </CardTitle>
              <CardDescription>
                Export data for analysis and generate reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Export Options</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="w-4 h-4 mr-2" />
                      CSV Export
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Excel Export
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileJson className="w-4 h-4 mr-2" />
                      JSON Export
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Time Range</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Clock className="w-4 h-4 mr-2" />
                      Last Hour
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="w-4 h-4 mr-2" />
                      Last 24 Hours
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Custom Range
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Analysis</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Trend Analysis
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Statistical Report
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Anomaly Detection
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
