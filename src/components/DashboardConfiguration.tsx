import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useToast } from '../hooks/use-toast';
import { MasterDataService } from '../services/MasterDataService';
import type { DashboardConfiguration as DashboardConfigType } from '../services/MasterDataService';
import { useAuth } from '../contexts/AuthContext';

const masterDataService = new MasterDataService();

export default function DashboardConfiguration() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<DashboardConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    if (!session?.tenant?.id) return;
    
    try {
      setLoading(true);
      let dashboardConfig = await masterDataService.getDashboardConfiguration(session.tenant.id);
      
      if (!dashboardConfig) {
        // Initialize with default configuration
        dashboardConfig = await masterDataService.initializeDashboardConfiguration(session.tenant.id);
      }
      
      setConfig(dashboardConfig);
    } catch (error) {
      console.error('Failed to load dashboard configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config || !session?.tenant?.id) return;
    
    try {
      setSaving(true);
      await masterDataService.updateDashboardConfiguration(session.tenant.id, config);
      setHasChanges(false);
      toast({
        title: 'Success',
        description: 'Dashboard configuration saved successfully',
      });
    } catch (error) {
      console.error('Failed to save dashboard configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save dashboard configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!session?.tenant?.id) return;
    
    try {
      setLoading(true);
      const defaultConfig = await masterDataService.initializeDashboardConfiguration(session.tenant.id);
      setConfig(defaultConfig);
      setHasChanges(false);
      toast({
        title: 'Reset Complete',
        description: 'Dashboard configuration reset to defaults',
      });
    } catch (error) {
      console.error('Failed to reset dashboard configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset dashboard configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (path: string, value: any) => {
    if (!config) return;
    
    const keys = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setConfig(newConfig);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Failed to load configuration</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Configuration</h1>
          <p className="text-muted-foreground">
            Configure all calculations, formulas, thresholds, and display options for the Production Plan Dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="oee" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="oee">OEE</TabsTrigger>
          <TabsTrigger value="losses">Losses</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="bottleneck">Bottleneck</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        {/* OEE Configuration */}
        <TabsContent value="oee" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OEE Configuration</CardTitle>
              <CardDescription>
                Configure Overall Equipment Effectiveness calculations and targets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target OEE (%)</Label>
                  <Input
                    type="number"
                    value={config.oee.targetOEE}
                    onChange={(e) => updateConfig('oee.targetOEE', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Availability (%)</Label>
                  <Input
                    type="number"
                    value={config.oee.targetAvailability}
                    onChange={(e) => updateConfig('oee.targetAvailability', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Performance (%)</Label>
                  <Input
                    type="number"
                    value={config.oee.targetPerformance}
                    onChange={(e) => updateConfig('oee.targetPerformance', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Quality (%)</Label>
                  <Input
                    type="number"
                    value={config.oee.targetQuality}
                    onChange={(e) => updateConfig('oee.targetQuality', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium">Component Weights</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust the relative importance of each OEE component (currently all set to 1.0)
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Availability Weight</Label>
                    <Input
                      type="number"
                      value={config.oee.availabilityWeight}
                      onChange={(e) => updateConfig('oee.availabilityWeight', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Performance Weight</Label>
                    <Input
                      type="number"
                      value={config.oee.performanceWeight}
                      onChange={(e) => updateConfig('oee.performanceWeight', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quality Weight</Label>
                    <Input
                      type="number"
                      value={config.oee.qualityWeight}
                      onChange={(e) => updateConfig('oee.qualityWeight', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Losses Configuration */}
        <TabsContent value="losses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loss Configuration</CardTitle>
              <CardDescription>
                Configure production loss calculations and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loss Value per Unit ($)</Label>
                  <Input
                    type="number"
                    value={config.losses.lossValuePerUnit}
                    onChange={(e) => updateConfig('losses.lossValuePerUnit', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>High Loss Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.losses.highLossThreshold}
                    onChange={(e) => updateConfig('losses.highLossThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critical Loss Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.losses.criticalLossThreshold}
                    onChange={(e) => updateConfig('losses.criticalLossThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Unaccounted Loss (%)</Label>
                  <Input
                    type="number"
                    value={config.losses.defaultUnaccountedLossPercentage}
                    onChange={(e) => updateConfig('losses.defaultUnaccountedLossPercentage', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Default Loss Categories</Label>
                <p className="text-sm text-muted-foreground">
                  Categories available for loss reconciliation
                </p>
                <div className="flex flex-wrap gap-2">
                  {config.losses.defaultLossCategories.map((category, index) => (
                    <Badge key={index} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Configuration */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Configuration</CardTitle>
              <CardDescription>
                Configure cost calculation methods and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Cost Calculation Method</Label>
                <Select
                  value={config.costs.costCalculationMethod}
                  onValueChange={(value) => updateConfig('costs.costCalculationMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perUnit">Per Unit</SelectItem>
                    <SelectItem value="perHour">Per Hour</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Cost per Unit ($)</Label>
                  <Input
                    type="number"
                    value={config.costs.defaultCostPerUnit}
                    onChange={(e) => updateConfig('costs.defaultCostPerUnit', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Cost per Hour ($)</Label>
                  <Input
                    type="number"
                    value={config.costs.defaultCostPerHour}
                    onChange={(e) => updateConfig('costs.defaultCostPerHour', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>High Cost Threshold ($)</Label>
                  <Input
                    type="number"
                    value={config.costs.highCostThreshold}
                    onChange={(e) => updateConfig('costs.highCostThreshold', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critical Cost Threshold ($)</Label>
                  <Input
                    type="number"
                    value={config.costs.criticalCostThreshold}
                    onChange={(e) => updateConfig('costs.criticalCostThreshold', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bottleneck Risk Configuration */}
        <TabsContent value="bottleneck" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bottleneck Risk Configuration</CardTitle>
              <CardDescription>
                Configure risk assessment factors and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Risk Factor Weights</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust the relative importance of each factor in bottleneck risk calculation
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Loss Weight</Label>
                    <Input
                      type="number"
                      value={config.bottleneckRisk.lossWeight}
                      onChange={(e) => updateConfig('bottleneckRisk.lossWeight', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Weight</Label>
                    <Input
                      type="number"
                      value={config.bottleneckRisk.costWeight}
                      onChange={(e) => updateConfig('bottleneckRisk.costWeight', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>OEE Weight</Label>
                    <Input
                      type="number"
                      value={config.bottleneckRisk.oeeWeight}
                      onChange={(e) => updateConfig('bottleneckRisk.oeeWeight', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium">Risk Thresholds</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Define thresholds for low, medium, and high risk levels
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Low Risk Threshold</Label>
                    <Input
                      type="number"
                      value={config.bottleneckRisk.lowRiskThreshold}
                      onChange={(e) => updateConfig('bottleneckRisk.lowRiskThreshold', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Medium Risk Threshold</Label>
                    <Input
                      type="number"
                      value={config.bottleneckRisk.mediumRiskThreshold}
                      onChange={(e) => updateConfig('bottleneckRisk.mediumRiskThreshold', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>High Risk Threshold</Label>
                    <Input
                      type="number"
                      value={config.bottleneckRisk.highRiskThreshold}
                      onChange={(e) => updateConfig('bottleneckRisk.highRiskThreshold', parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Configuration */}
        <TabsContent value="display" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Display Configuration</CardTitle>
              <CardDescription>
                Configure dashboard visibility and formatting options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Metric Visibility</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which dashboard sections to display
                </p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.display.showOEE}
                      onCheckedChange={(checked) => updateConfig('display.showOEE', checked)}
                    />
                    <Label>Show OEE Section</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.display.showLosses}
                      onCheckedChange={(checked) => updateConfig('display.showLosses', checked)}
                    />
                    <Label>Show Losses Section</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.display.showCosts}
                      onCheckedChange={(checked) => updateConfig('display.showCosts', checked)}
                    />
                    <Label>Show Costs Section</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.display.showCapacity}
                      onCheckedChange={(checked) => updateConfig('display.showCapacity', checked)}
                    />
                    <Label>Show Capacity Section</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.display.showActions}
                      onCheckedChange={(checked) => updateConfig('display.showActions', checked)}
                    />
                    <Label>Show Actions Section</Label>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Decimal Places</Label>
                  <Input
                    type="number"
                    value={config.display.decimalPlaces}
                    onChange={(e) => updateConfig('display.decimalPlaces', parseInt(e.target.value))}
                    min="0"
                    max="4"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency Symbol</Label>
                  <Input
                    value={config.display.currencySymbol}
                    onChange={(e) => updateConfig('display.currencySymbol', e.target.value)}
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number Format</Label>
                  <Select
                    value={config.display.numberFormat}
                    onValueChange={(value) => updateConfig('display.numberFormat', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">US English</SelectItem>
                      <SelectItem value="en-GB">UK English</SelectItem>
                      <SelectItem value="de-DE">German</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={config.display.theme}
                    onValueChange={(value) => updateConfig('display.theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="high-contrast">High Contrast</SelectItem>
                      <SelectItem value="colorblind-friendly">Colorblind Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Configuration */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Configuration</CardTitle>
              <CardDescription>
                Configure performance calculation methods and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Performance Calculation Method</Label>
                <Select
                  value={config.performance.performanceCalculationMethod}
                  onValueChange={(value) => updateConfig('performance.performanceCalculationMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cycleTime">Cycle Time Based</SelectItem>
                    <SelectItem value="outputRate">Output Rate Based</SelectItem>
                    <SelectItem value="efficiency">Efficiency Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Default Ideal Cycle Time (seconds)</Label>
                  <Input
                    type="number"
                    value={config.performance.defaultIdealCycleTime}
                    onChange={(e) => updateConfig('performance.defaultIdealCycleTime', parseFloat(e.target.value))}
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Low Performance Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.performance.lowPerformanceThreshold}
                    onChange={(e) => updateConfig('performance.lowPerformanceThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>High Performance Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.performance.highPerformanceThreshold}
                    onChange={(e) => updateConfig('performance.highPerformanceThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Configuration */}
        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Configuration</CardTitle>
              <CardDescription>
                Configure quality calculation methods and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Quality Calculation Method</Label>
                <Select
                  value={config.quality.qualityCalculationMethod}
                  onValueChange={(value) => updateConfig('quality.qualityCalculationMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defects">Defects Based</SelectItem>
                    <SelectItem value="rework">Rework Based</SelectItem>
                    <SelectItem value="scrap">Scrap Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Low Quality Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.quality.lowQualityThreshold}
                    onChange={(e) => updateConfig('quality.lowQualityThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>High Quality Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.quality.highQualityThreshold}
                    onChange={(e) => updateConfig('quality.highQualityThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Configuration */}
        <TabsContent value="availability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Availability Configuration</CardTitle>
              <CardDescription>
                Configure availability calculation methods and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Availability Calculation Method</Label>
                <Select
                  value={config.availability.availabilityCalculationMethod}
                  onValueChange={(value) => updateConfig('availability.availabilityCalculationMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uptime">Uptime Based</SelectItem>
                    <SelectItem value="downtime">Downtime Based</SelectItem>
                    <SelectItem value="scheduled">Scheduled Time Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Low Availability Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.availability.lowAvailabilityThreshold}
                    onChange={(e) => updateConfig('availability.lowAvailabilityThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>High Availability Threshold (%)</Label>
                  <Input
                    type="number"
                    value={config.availability.highAvailabilityThreshold}
                    onChange={(e) => updateConfig('availability.highAvailabilityThreshold', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 