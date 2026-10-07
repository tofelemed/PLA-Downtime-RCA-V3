// PI Event Sync Manager UI Component
// Manage and monitor automatic syncing of PI Event Frames

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Play, Pause, RefreshCw, CheckCircle, XCircle, Clock,
  Activity, Database, TrendingUp, AlertCircle, Settings,
  Zap, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { autoPIEventSyncService, SyncJobConfig } from '@/services/pi/AutoPIEventSyncService';

interface PIEventSyncManagerProps {
  tenantId: string;
}

export const PIEventSyncManager: React.FC<PIEventSyncManagerProps> = ({ tenantId }) => {
  const { toast } = useToast();
  
  const [config, setConfig] = useState<SyncJobConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadConfig();
    loadStatus();

    // Refresh status every 10 seconds
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const loadConfig = async () => {
    try {
      let cfg = await autoPIEventSyncService.getSyncJobConfig(tenantId);
      if (!cfg) {
        // Create default config
        cfg = await autoPIEventSyncService.createSyncJobConfig(tenantId, {
          enabled: false, // Disabled by default, user must enable
          intervalMinutes: 15,
          lookbackMinutes: 60,
          autoStart: false
        });
      }
      setConfig(cfg);
    } catch (error) {
      console.error('Failed to load sync config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const status = await autoPIEventSyncService.getSyncStatus(tenantId);
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    try {
      await autoPIEventSyncService.updateSyncJobConfig(tenantId, { enabled });

      if (enabled) {
        toast({
          title: 'Sync Enabled',
          description: 'Backend will auto-sync PI events on schedule (runs even when browser is closed)',
        });
      } else {
        toast({
          title: 'Sync Disabled',
          description: 'Backend scheduled PI sync has been paused',
        });
      }

      await loadConfig();
      await loadStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle sync',
        variant: 'destructive'
      });
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await autoPIEventSyncService.triggerManualSync(tenantId);
      
      if (result.success) {
        toast({
          title: 'Sync Complete',
          description: `Fetched ${result.eventsFetched} events, created ${result.eventsCreated}, unmapped ${result.unmappedEvents}`,
          duration: 5000
        });
      } else {
        toast({
          title: 'Sync Failed',
          description: result.errors.join(', '),
          variant: 'destructive'
        });
      }
      
      await loadConfig();
      await loadStatus();
    } catch (error: any) {
      toast({
        title: 'Sync Error',
        description: error.message || 'Failed to sync events',
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateInterval = async (intervalMinutes: number) => {
    try {
      await autoPIEventSyncService.updateSyncJobConfig(tenantId, { intervalMinutes });
      await loadConfig();
      toast({
        title: 'Interval Updated',
        description: `Backend will sync every ${intervalMinutes} minutes`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update interval',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateLookback = async (lookbackMinutes: number) => {
    try {
      await autoPIEventSyncService.updateSyncJobConfig(tenantId, { lookbackMinutes });
      await loadConfig();
      toast({
        title: 'Lookback Updated',
        description: `Initial sync will look back ${lookbackMinutes} minutes`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lookback',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading sync configuration...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (syncStatus?.isRunning) return 'text-blue-600';
    if (syncStatus?.lastError) return 'text-red-600';
    if (syncStatus?.isEnabled) return 'text-green-600';
    return 'text-gray-600';
  };

  const getStatusIcon = () => {
    if (syncStatus?.isRunning) return <Activity className="w-5 h-5 text-blue-600 animate-pulse" />;
    if (syncStatus?.lastError) return <XCircle className="w-5 h-5 text-red-600" />;
    if (syncStatus?.isEnabled) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <Pause className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-xl">PI Event Frame Auto-Sync</CardTitle>
                <CardDescription>
                  {syncStatus?.isEnabled ? (
                    syncStatus?.isRunning ? (
                      <span className="text-blue-600 font-medium">Syncing now...</span>
                    ) : (
                      <span className="text-green-600 font-medium">Active - Next run {syncStatus?.nextRun ? new Date(syncStatus.nextRun).toLocaleTimeString() : 'soon'}</span>
                    )
                  ) : (
                    <span className="text-gray-600">Disabled - Events will not be synced automatically</span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Auto-Sync</Label>
                <Switch
                  checked={config?.enabled ?? false}
                  onCheckedChange={handleToggleSync}
                />
              </div>
              <Button
                onClick={handleManualSync}
                disabled={isSyncing || syncStatus?.isRunning}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                {isSyncing || syncStatus?.isRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border-2 border-gray-200">
              <Database className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-700">{syncStatus?.totalSynced || 0}</div>
              <div className="text-xs text-gray-600">Total Synced</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border-2 border-gray-200">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-700">{config?.intervalMinutes || 0}m</div>
              <div className="text-xs text-gray-600">Sync Interval</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border-2 border-gray-200">
              <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-700">
                {syncStatus?.lastSuccess ? new Date(syncStatus.lastSuccess).toLocaleTimeString() : 'Never'}
              </div>
              <div className="text-xs text-gray-600">Last Success</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border-2 border-gray-200">
              <AlertCircle className={`w-6 h-6 mx-auto mb-2 ${syncStatus?.errorCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              <div className={`text-2xl font-bold ${syncStatus?.errorCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                {syncStatus?.errorCount || 0}
              </div>
              <div className="text-xs text-gray-600">Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Sync Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sync Interval */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Sync Interval (How Often)</Label>
            <Select 
              value={String(config?.intervalMinutes || 15)} 
              onValueChange={(val) => handleUpdateInterval(Number(val))}
            >
              <SelectTrigger className="border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Every 5 minutes</SelectItem>
                <SelectItem value="15">Every 15 minutes (Recommended)</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
                <SelectItem value="120">Every 2 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              How frequently to check for new PI Event Frames
            </p>
          </div>

          <Separator />

          {/* Lookback Window */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Initial Lookback Window</Label>
            <Select 
              value={String(config?.lookbackMinutes || 60)} 
              onValueChange={(val) => handleUpdateLookback(Number(val))}
            >
              <SelectTrigger className="border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour (Recommended)</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="1440">24 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              When starting first sync, how far back to look for historical events
            </p>
          </div>

          <Separator />

          {/* Status Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3">Sync Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <Badge className={
                  syncStatus?.isRunning ? 'bg-blue-600' :
                  syncStatus?.isEnabled ? 'bg-green-600' :
                  'bg-gray-600'
                }>
                  {syncStatus?.isRunning ? 'Running' : syncStatus?.isEnabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Run:</span>
                <span className="font-medium">
                  {syncStatus?.lastRun ? new Date(syncStatus.lastRun).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Next Run:</span>
                <span className="font-medium">
                  {syncStatus?.nextRun && syncStatus?.isEnabled 
                    ? new Date(syncStatus.nextRun).toLocaleString() 
                    : 'N/A'}
                </span>
              </div>
              {syncStatus?.lastError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-red-800">Last Error:</div>
                      <div className="text-xs text-red-700 mt-1">{syncStatus.lastError}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            How Auto-Sync Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Enable auto-sync using the toggle above</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>The system checks PI Event Frames at your chosen interval</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>New Event Frames are automatically mapped to Production Events</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>Events appear in Event Hub with source = "PI"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">5.</span>
              <span>Delta sync ensures only new/updated events are fetched</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default PIEventSyncManager;

