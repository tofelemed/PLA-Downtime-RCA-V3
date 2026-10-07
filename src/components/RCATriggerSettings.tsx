// RCA Trigger Configuration Settings UI
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Plus, Trash2, Edit, Save, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { rcaTriggerConfigService } from '../services/RCATriggerConfigService';
import { RCATriggerConfig, RCATriggerRule, DEFAULT_RCA_TRIGGER_CONFIGS } from '../types/RCATriggerConfig';

interface RCATriggerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RCATriggerSettings: React.FC<RCATriggerSettingsProps> = ({ isOpen, onClose }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<RCATriggerConfig | null>(null);
  const [editingRule, setEditingRule] = useState<RCATriggerRule | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);

  useEffect(() => {
    if (isOpen && session?.tenant?.id) {
      loadConfig();
    }
  }, [isOpen, session?.tenant?.id]);

  const loadConfig = async () => {
    if (!session?.tenant?.id) return;

    try {
      let activeConfig = await rcaTriggerConfigService.getActiveConfig(session.tenant.id);
      
      // If no config exists, create default
      if (!activeConfig) {
        activeConfig = await rcaTriggerConfigService.initializeDefaultConfig(
          session.tenant.id,
          session.organization?.id || '',
          'OilAndGas' // Default to oil and gas
        );
      }
      
      setConfig(activeConfig);
    } catch (error) {
      console.error('Failed to load RCA trigger config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive',
      });
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    if (!config) return;

    try {
      const updated = await rcaTriggerConfigService.toggleRule(config.id, ruleId);
      setConfig(updated);
      toast({
        title: 'Success',
        description: 'Rule toggled successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle rule',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!config) return;
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const updated = await rcaTriggerConfigService.deleteRule(config.id, ruleId);
      setConfig(updated);
      toast({
        title: 'Success',
        description: 'Rule deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  const handleSaveGlobalSettings = async (settings: Partial<RCATriggerConfig['globalSettings']>) => {
    if (!config) return;

    try {
      const updated = await rcaTriggerConfigService.updateConfig(config.id, {
        globalSettings: { ...config.globalSettings, ...settings },
      });
      setConfig(updated);
      console.log('✅ RCA Global Settings Updated:', settings);
      console.log('📋 New Config:', updated.globalSettings);
      toast({
        title: 'Success',
        description: 'Global settings updated',
      });
    } catch (error) {
      console.error('❌ Failed to save global settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    }
  };

  const handleLoadDefaults = async (industryType: 'OilAndGas' | 'Cement') => {
    if (!session?.tenant?.id) return;
    if (!confirm(`Load default ${industryType === 'OilAndGas' ? 'Oil & Gas' : 'Cement'} configuration? This will replace current rules.`)) return;

    try {
      // Delete current config
      if (config) {
        await rcaTriggerConfigService.deleteConfig(config.id);
      }

      // Create new default
      const newConfig = await rcaTriggerConfigService.initializeDefaultConfig(
        session.tenant.id,
        session.organization?.id || '',
        industryType
      );
      
      setConfig(newConfig);
      toast({
        title: 'Success',
        description: `Loaded ${industryType === 'OilAndGas' ? 'Oil & Gas' : 'Cement'} default configuration`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load defaults',
        variant: 'destructive',
      });
    }
  };

  if (!config) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loading Configuration...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            RCA Trigger Configuration
          </DialogTitle>
          <DialogDescription>
            Configure when events should trigger Root Cause Analysis investigations
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="rules" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rules">Trigger Rules</TabsTrigger>
            <TabsTrigger value="global">Global Settings</TabsTrigger>
            <TabsTrigger value="presets">Load Presets</TabsTrigger>
          </TabsList>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Active Rules</h3>
                <p className="text-sm text-gray-600">
                  {config.rules.filter(r => r.enabled).length} of {config.rules.length} rules enabled
                </p>
              </div>
              <Button onClick={() => setIsAddingRule(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>

            <div className="space-y-3">
              {config.rules.sort((a, b) => b.priority - a.priority).map((rule) => (
                <Card key={rule.id} className={`${rule.enabled ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                        />
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {rule.name}
                            <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                              Priority: {rule.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {rule.eventType}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">{rule.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingRule(rule)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {rule.conditions.severities && rule.conditions.severities.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Severity:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.conditions.severities.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {rule.conditions.minCost && (
                        <div>
                          <span className="font-medium text-gray-700">Min Cost:</span>
                          <p className="text-gray-600">${rule.conditions.minCost.toLocaleString()}</p>
                        </div>
                      )}
                      {rule.conditions.minDuration && (
                        <div>
                          <span className="font-medium text-gray-700">Min Duration:</span>
                          <p className="text-gray-600">{rule.conditions.minDuration} min</p>
                        </div>
                      )}
                      {rule.conditions.statuses && rule.conditions.statuses.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Statuses:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.conditions.statuses.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {config.rules.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Rules Configured</h3>
                <p className="text-gray-500 mb-4">Add rules to control when RCA investigations are suggested</p>
                <Button onClick={() => setIsAddingRule(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Rule
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Global Settings Tab */}
          <TabsContent value="global" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>
                  These settings apply to all RCA trigger rules
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-create-rca">Auto-Create RCA on Matching Events</Label>
                    <p className="text-sm text-gray-600">
                      When enabled, the backend automatically creates Draft RCAs when new production
                      events match your trigger rules (PI sync, manual entry, API).
                    </p>
                  </div>
                  <Switch
                    id="auto-create-rca"
                    checked={!!config.autoCreateRca}
                    onCheckedChange={async (checked) => {
                      try {
                        const updated = await rcaTriggerConfigService.updateConfig(config.id, {
                          autoCreateRca: checked,
                        });
                        setConfig(updated);
                        toast({
                          title: checked ? 'Auto-Create Enabled' : 'Auto-Create Disabled',
                          description: checked
                            ? 'Matching events will automatically get Draft RCAs'
                            : 'RCAs will only be created manually',
                        });
                      } catch {
                        toast({
                          title: 'Error',
                          description: 'Failed to update auto-create setting',
                          variant: 'destructive',
                        });
                      }
                    }}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="manual-creation">Allow Manual Creation</Label>
                    <p className="text-sm text-gray-500">
                      Users can create RCA for any event, even if it doesn't meet criteria
                    </p>
                  </div>
                  <Switch
                    id="manual-creation"
                    checked={config.globalSettings.alwaysAllowManualCreation}
                    onCheckedChange={(checked) => {
                      console.log(`🔄 "Allow Manual Creation" toggle clicked: ${config.globalSettings.alwaysAllowManualCreation} → ${checked}`);
                      handleSaveGlobalSettings({ alwaysAllowManualCreation: checked });
                    }}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-warning">Show Warning for Low Impact</Label>
                    <p className="text-sm text-gray-500">
                      Display warning when creating RCA for low-impact events
                    </p>
                  </div>
                  <Switch
                    id="show-warning"
                    checked={config.globalSettings.showWarningForLowImpact}
                    onCheckedChange={(checked) =>
                      handleSaveGlobalSettings({ showWarningForLowImpact: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="global-cost">Global Minimum Cost Threshold ($)</Label>
                  <Input
                    id="global-cost"
                    type="number"
                    value={config.globalSettings.minCostThresholdGlobal || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      handleSaveGlobalSettings({ minCostThresholdGlobal: value });
                    }}
                    placeholder="e.g., 10000"
                  />
                  <p className="text-xs text-gray-500">
                    Events below this cost will not trigger RCA (leave empty for no global limit)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="global-duration">Global Minimum Duration Threshold (minutes)</Label>
                  <Input
                    id="global-duration"
                    type="number"
                    value={config.globalSettings.minDurationThresholdGlobal || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      handleSaveGlobalSettings({ minDurationThresholdGlobal: value });
                    }}
                    placeholder="e.g., 60"
                  />
                  <p className="text-xs text-gray-500">
                    Events below this duration will not trigger RCA (leave empty for no global limit)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Current Configuration Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Total Rules:</strong> {config.rules.length}
                  </div>
                  <div>
                    <strong>Enabled Rules:</strong> {config.rules.filter(r => r.enabled).length}
                  </div>
                  <div>
                    <strong>Manual Creation:</strong> {config.globalSettings.alwaysAllowManualCreation ? '✅ Allowed' : '❌ Disabled'}
                  </div>
                  <div>
                    <strong>Low Impact Warning:</strong> {config.globalSettings.showWarningForLowImpact ? '✅ Enabled' : '❌ Disabled'}
                  </div>
                  <div>
                    <strong>Min Cost:</strong> {config.globalSettings.minCostThresholdGlobal ? `$${config.globalSettings.minCostThresholdGlobal.toLocaleString()}` : 'None'}
                  </div>
                  <div>
                    <strong>Min Duration:</strong> {config.globalSettings.minDurationThresholdGlobal ? `${config.globalSettings.minDurationThresholdGlobal} min` : 'None'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Presets Tab */}
          <TabsContent value="presets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Industry Presets</CardTitle>
                <CardDescription>
                  Load pre-configured RCA trigger rules for your industry
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-base">🛢️ Oil & Gas Industry Standard</CardTitle>
                    <CardDescription>
                      Comprehensive RCA triggers for oil and gas operations including safety, high-cost events, and critical equipment failures
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>• Safety incidents (all severities)</div>
                      <div>• Cost &gt; $100,000</div>
                      <div>• Critical severity events</div>
                      <div>• Downtime &gt; 4 hours</div>
                      <div>• Equipment failures &gt; $50k</div>
                      <div>• Failed quality inspections</div>
                      <div>• Critical predictive alerts</div>
                    </div>
                    <Button onClick={() => handleLoadDefaults('OilAndGas')} className="w-full">
                      Load Oil & Gas Preset
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-base">🏭 Cement Industry Standard</CardTitle>
                    <CardDescription>
                      RCA triggers tailored for cement manufacturing operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>• Kiln critical issues</div>
                      <div>• Cost &gt; $50,000</div>
                      <div>• Production losses &gt; 2 hours</div>
                      <div>• Quality deviations</div>
                    </div>
                    <Button onClick={() => handleLoadDefaults('Cement')} variant="outline" className="w-full">
                      Load Cement Preset
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Loading a preset will replace all current rules. Make sure to export your current configuration if you want to keep it.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RCATriggerSettings;

