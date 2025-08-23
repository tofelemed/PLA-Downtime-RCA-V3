
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
import { Activity, Server, Database, Settings, CheckCircle, AlertCircle, Clock, PlugZap, ClipboardList } from 'lucide-react';
import { PIClient, basicAuthHeader } from '@/services/pi/PIClient';
import { piStore } from '@/services/pi/PIStore';
import { useToast } from '@/hooks/use-toast';
import PIIntegration from './integrations/PIIntegration';
import { DataSourceManager } from '@/components/integrations/DataSourceManager';
import { BindingManager } from '@/components/integrations/BindingManager';
import { IntegrationDashboard } from '@/components/integrations/IntegrationDashboard';
import { StreamingDashboard } from '@/components/streaming/StreamingDashboard';
import { RealTimeCharts } from '@/components/streaming/RealTimeCharts';

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
      const tenantId = session?.tenant?.id ?? 'default-tenant';
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (!cfg || !cfg.username || !cfg.password) {
        setPiServerConnected(null); setPiEfOnline(null); return;
      }
      const client = new PIClient({ basePath: '/piwebapi', authProvider: async () => basicAuthHeader(cfg.username!, cfg.password!) });
      // Server status
      try {
        await client.getAssetServers();
        setPiServerConnected(true);
      } catch { setPiServerConnected(false); }
      // EF endpoint status (try database if saved; else unknown)
      try {
        if (cfg.afDatabase?.webId) {
          await client.getEventFrames({ databaseWebId: cfg.afDatabase.webId, startTimeUtc: new Date(Date.now()-60000).toISOString(), endTimeUtc: new Date().toISOString(), maxCount: 1 });
          setPiEfOnline(true);
        } else {
          setPiEfOnline(null);
        }
      } catch { setPiEfOnline(false); }
      setPiLastChecked(new Date().toLocaleString());
    } catch {
      setPiServerConnected(false); setPiEfOnline(false);
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

      <div className="grid gap-3 md:grid-cols-3">
        {/* Compact PI card with heartbeat */}
        <Card className="border rounded-lg">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center">
                  <PlugZap className="w-4 h-4 text-blue-600" />
                </div>
                <div className="truncate">
                  <CardTitle className="text-sm leading-tight">PI Event Frames</CardTitle>
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
          </CardContent>
        </Card>

        {/* Work Order System */}
        <Card className="border rounded-lg">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="truncate">
                  <CardTitle className="text-sm leading-tight">Work Order System</CardTitle>
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
          </CardContent>
        </Card>

        {/* Historian Database */}
        <Card className="border rounded-lg">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center">
                  <Database className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="truncate">
                  <CardTitle className="text-sm leading-tight">Historian Database</CardTitle>
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
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="universal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="universal">Universal Integration</TabsTrigger>
          <TabsTrigger value="binding">Hierarchy Binding</TabsTrigger>
          <TabsTrigger value="dashboard">Integration Dashboard</TabsTrigger>
          <TabsTrigger value="streaming">Streaming Dashboard</TabsTrigger>
          <TabsTrigger value="charts">Real-Time Charts</TabsTrigger>
          <TabsTrigger value="pi">Aveva PI Configuration</TabsTrigger>
          <TabsTrigger value="cmms">CMMS Integration</TabsTrigger>
          <TabsTrigger value="settings">General Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="universal" className="space-y-4">
          <DataSourceManager />
        </TabsContent>

        <TabsContent value="binding" className="space-y-4">
          <BindingManager />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <IntegrationDashboard />
        </TabsContent>

        <TabsContent value="streaming" className="space-y-4">
          <StreamingDashboard />
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <RealTimeCharts />
        </TabsContent>

        <TabsContent value="pi">
          <PIIntegration />
        </TabsContent>

        <TabsContent value="cmms">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    CMMS Integration
                  </CardTitle>
                  <CardDescription>
                    Configure connection to maintenance management system for work order creation
                  </CardDescription>
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
            </CardHeader>
            <CardContent className="space-y-4">
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cmms-endpoint">API Endpoint</Label>
                  <Input
                    id="cmms-endpoint"
                    placeholder="https://api.cmms.company.com"
                    value={cmmsConfig.endpoint}
                    onChange={(e) => setCmmsConfig({ ...cmmsConfig, endpoint: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cmms-api-key">API Key</Label>
                  <Input
                    id="cmms-api-key"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={cmmsConfig.apiKey}
                    onChange={(e) => setCmmsConfig({ ...cmmsConfig, apiKey: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cmms-username">Username</Label>
                  <Input
                    id="cmms-username"
                    placeholder="integration_user"
                    value={cmmsConfig.username}
                    onChange={(e) => setCmmsConfig({ ...cmmsConfig, username: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cmms-password">Password</Label>
                  <Input
                    id="cmms-password"
                    type="password"
                    placeholder="••••••••"
                    value={cmmsConfig.password}
                    onChange={(e) => setCmmsConfig({ ...cmmsConfig, password: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Work Order Mapping</h4>
                <p className="text-sm text-green-700 mb-3">
                  RCA recommendations will create work orders with the following mapping:
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <strong>Title:</strong> Recommendation title
                  </div>
                  <div>
                    <strong>Description:</strong> Full recommendation details
                  </div>
                  <div>
                    <strong>Priority:</strong> Mapped to CMMS priority levels
                  </div>
                  <div>
                    <strong>Asset:</strong> Related equipment/asset
                  </div>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>
                General settings for data synchronization and system behavior
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
      </Tabs>
    </div>
  );
};
