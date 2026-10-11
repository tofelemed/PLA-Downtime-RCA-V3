import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Activity, Server, Database, Settings, CheckCircle, AlertCircle, Clock, PlugZap, ClipboardList } from 'lucide-react';
import { PIClient, createTenantPIClient } from '@/services/pi/PIClient';
import { piStore } from '@/services/pi/PIStore';
import { useToast } from '@/hooks/use-toast';
import EnhancedHistorianPage from '@/components/historian/EnhancedHistorianPage';

export const EnhancedHistorian: React.FC = () => {
  const { session } = useAuth();
  const { canUseIntegrationConsole } = useCapabilities();
  const { toast } = useToast();
  
  const [piConfig, setPiConfig] = useState({
    server: '',
    username: '',
    password: '',
    database: '',
    enabled: false,
    syncInterval: '300',
  });
  
  const [historianPiClient, setHistorianPiClient] = useState<PIClient | null>(null);

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

  const saveConfiguration = async (type: 'pi' | 'cmms') => {
    if (type === 'pi') {
      try {
        const tenantId = session?.tenant?.id ?? 'default-tenant';
        await piStore.upsertConnection({
          tenantId,
          baseUrl: piConfig.server,
          username: piConfig.username,
          password: piConfig.password,
          afDatabase: piConfig.database ? { name: piConfig.database, webId: '' } : undefined,
        });
        
        toast({
          title: 'Configuration Saved',
          description: 'PI configuration has been saved successfully',
        });
        
        // Refresh the historian PI client
        const client = await getPIClient();
        setHistorianPiClient(client);
        
        // Update PI status
        checkPIStatus();
      } catch (error) {
        toast({
          title: 'Configuration Error',
          description: `Failed to save PI configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Configuration Saved',
        description: 'CMMS configuration has been saved (simulation mode)',
      });
    }
  };

  const testConnection = async (type: 'pi' | 'cmms') => {
    if (type === 'pi') {
      try {
        const client = await getPIClient();
        if (client) {
          // Test the connection by trying to get asset servers
          await client.getAssetServers();
          toast({
            title: 'Connection Test',
            description: 'PI connection test completed successfully',
            variant: 'default',
          });
        } else {
          toast({
            title: 'Connection Test',
            description: 'No PI credentials configured',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Connection Test',
          description: `PI connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive',
        });
      }
    } else {
      // Simulate CMMS connection test
      setTimeout(() => {
        toast({
          title: 'Connection Test',
          description: 'CMMS connection test completed (simulated)',
          variant: Math.random() > 0.5 ? 'default' : 'destructive',
        });
      }, 2000);
    }
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
        return;
      }
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (!cfg) {
        setPiServerConnected(null); 
        setPiEfOnline(null); 
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
        return; // Don't test event frames if basic connectivity fails
      }
      
      // Event frames endpoint status - only test if we have a database and basic connectivity works
      try {
        if (cfg.afDatabase?.webId) {
          // Use a shorter time range and lower maxCount to reduce load
          const startTime = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
          const endTime = new Date().toISOString();
          
          await client.getEventFrames({ 
            databaseWebId: cfg.afDatabase.webId, 
            startTimeUtc: startTime, 
            endTimeUtc: endTime, 
            maxCount: 1 
          });
          setPiEfOnline(true);
        } else {
          setPiEfOnline(null);
        }
      } catch (error) {
        console.warn('PI event frames endpoint check failed:', error);
        // Don't set to false immediately - it might be a temporary issue
        // Only set to false if it's a persistent authentication/permission issue
        if (error.status === 401 || error.status === 403) {
          setPiEfOnline(false);
        } else {
          // For 500 errors or other issues, keep the previous status
          // This prevents the UI from flickering due to temporary server issues
          console.log('Event frames endpoint temporarily unavailable, keeping previous status');
        }
      }
      
      setPiLastChecked(new Date().toLocaleString());
    } catch (error) {
      console.error('PI status check failed:', error);
      setPiServerConnected(false); 
      setPiEfOnline(false);
    }
  }

  React.useEffect(() => {
    // Only check if we have saved creds to avoid Windows auth prompt
    (async () => {
      const tenantId = session?.tenant?.id ?? 'default-tenant';
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (cfg?.username && cfg?.password) {
        checkPIStatus();
        // Also initialize historian PI client
        const client = await getPIClient();
        setHistorianPiClient(client);
        
        // Load saved PI config into local state
        setPiConfig(prev => ({
          ...prev,
          server: cfg.baseUrl || '',
          username: cfg.username || '',
          password: cfg.password || '',
          database: cfg.afDatabase?.name || '',
          enabled: !!cfg.username && !!cfg.password,
        }));
      }
    })();
    const timer = setInterval(() => {
      checkPIStatus();
    }, 300000); // Check every 5 minutes instead of every minute
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

  if (!session || !canUseIntegrationConsole) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">You don't have permission to access enhanced historian.</p>
      </div>
    );
  }

  // Get PI client for historian using saved credentials
  const getPIClient = async () => {
      const tenantId = session?.tenant?.id;
      if (!tenantId) return null;
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (!cfg) return null;
      return createTenantPIClient(tenantId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Enhanced Historian</h2>
          <p className="text-muted-foreground">
            Multi-attribute time series data analysis and visualization
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
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${piConfig.enabled ? 'bg-green-400' : 'bg-gray-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${piConfig.enabled ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Type</span>
              <span className="font-medium">SAP</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Status</span>
              <span className="font-medium">{piConfig.enabled ? 'Enabled' : 'Not Configured'}</span>
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
              <span className="font-medium">Enhanced</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="historian" className="space-y-4">
        <TabsList>
          <TabsTrigger value="historian">Enhanced Historian</TabsTrigger>
          <TabsTrigger value="settings">Connection Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="historian">
          {historianPiClient ? (
            <EnhancedHistorianPage 
              piClient={historianPiClient} 
              tenantId={session?.tenant?.id || 'default-tenant'} 
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>PI Web API connection not available</p>
                  <p className="text-sm">Please configure your PI connection in the Connection tab</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>PI Connection Settings</CardTitle>
              <CardDescription>
                Configure PI connection for historian data access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pi-server">PI Server</Label>
                  <Input
                    id="pi-server"
                    placeholder="https://piv.hillal-intl.com:8070/piwebapi"
                    value={piConfig.server}
                    onChange={(e) => setPiConfig({ ...piConfig, server: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pi-database">AF Database</Label>
                  <Input
                    id="pi-database"
                    placeholder="Database name"
                    value={piConfig.database}
                    onChange={(e) => setPiConfig({ ...piConfig, database: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pi-username">Username</Label>
                  <Input
                    id="pi-username"
                    placeholder="integration_user"
                    value={piConfig.username}
                    onChange={(e) => setPiConfig({ ...piConfig, username: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pi-password">Password</Label>
                  <Input
                    id="pi-password"
                    type="password"
                    placeholder="••••••••"
                    value={piConfig.password}
                    onChange={(e) => setPiConfig({ ...piConfig, password: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="pi-enabled">Enable PI Integration</Label>
                <Switch
                  id="pi-enabled"
                  checked={piConfig.enabled}
                  onCheckedChange={(checked) => setPiConfig({ ...piConfig, enabled: checked })}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => testConnection('pi')}>
                  Test Connection
                </Button>
                <Button variant="outline" onClick={async () => {
                  try {
                    const tenantId = session?.tenant?.id ?? 'default-tenant';
                    // Clear PI connection by setting empty values
                    await piStore.upsertConnection({
                      tenantId,
                      baseUrl: '',
                      username: '',
                      password: '',
                    });
                    setHistorianPiClient(null);
                    setPiConfig(prev => ({ ...prev, enabled: false }));
                    checkPIStatus();
                    toast({
                      title: 'Configuration Cleared',
                      description: 'PI configuration has been cleared',
                    });
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to clear PI configuration',
                      variant: 'destructive',
                    });
                  }
                }}>
                  Clear
                </Button>
                <Button onClick={() => saveConfiguration('pi')}>
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
