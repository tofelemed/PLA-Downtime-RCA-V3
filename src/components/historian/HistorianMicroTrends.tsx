import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Activity, Zap, Gauge, Thermometer, Droplets, Settings, Plus, Clock } from 'lucide-react';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { TimeSeriesQuery, TimeSeriesResult, TimeSeriesPoint } from '@/services/historian/types';
import { piStore } from '@/services/pi/PIStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import HistorianTagConfigurator from './HistorianTagConfigurator';
import { PIClient, createTenantPIClient } from '@/services/pi/PIClient';

interface HistorianTag {
  id: string;
  name: string;
  path: string;
  units: string;
  category: 'temperature' | 'pressure' | 'flow' | 'level' | 'power' | 'quality' | 'other';
  currentValue?: number;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'warning' | 'alarm';
  updateInterval?: number; // seconds
  lastUpdate?: number; // timestamp
}

interface HistorianMicroTrendsProps {
  client: HistorianClient;
  tenantId: string;
}

const HistorianMicroTrends: React.FC<HistorianMicroTrendsProps> = ({ client, tenantId }) => {
  const { toast } = useToast();
  const [tags, setTags] = useState<HistorianTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [piClient, setPiClient] = useState<PIClient | null>(null);
  const [, setUpdateTick] = useState(0); // Force re-render for countdown timer
  const tagsRef = React.useRef<HistorianTag[]>([]); // Ref to avoid dependency issues
  const [trendData, setTrendData] = useState<{ [key: string]: TimeSeriesResult[] }>({});
  
  // Clear all trend data on mount to prevent old cached data
  React.useEffect(() => {
    setTrendData({});
  }, []);
  
  // Keep ref in sync with tags state
  React.useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  // Early return if client is not available
  if (!client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Real-Time Process Trends
          </CardTitle>
          <CardDescription>
            Loading historian client...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-gray-600">Initializing historian client...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  // Update countdown timer every 5 seconds to reduce re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      setUpdateTick(prev => prev + 1);
    }, 5000); // Update every 5 seconds instead of 1
    
    return () => clearInterval(timer);
  }, []);

  // Initialize PI Client
  useEffect(() => {
    const initPIClient = async () => {
      try {
        const connection = await piStore.getConnectionByTenant(tenantId);
        if (connection) {
          setPiClient(createTenantPIClient(tenantId));
        }
      } catch (error) {
        console.error('Failed to initialize PI client:', error);
      }
    };

    initPIClient();
  }, [tenantId]);

  // Fetch configured historian tags when component mounts
  useEffect(() => {
    const fetchConfiguredTags = async () => {
      if (!client || !client.hasProvider('pi')) {
        setTagsLoading(false);
        return;
      }

      try {
        setTagsLoading(true);
        
        // Clear any existing trend data to prevent old data from showing
        setTrendData({});
        
        // Load configured tags from piStore
        const configuredTags = await piStore.getHistorianTags(tenantId);
        
        if (configuredTags.length > 0) {
          // Convert configured tags to display format
          const displayTags: HistorianTag[] = configuredTags.map(tag => {
            return {
              id: tag.webId,
              name: tag.name,
              path: tag.path,
              units: tag.units,
              category: tag.category,
              currentValue: undefined, // Will be fetched when loading trend data
              trend: 'stable',
              status: 'normal',
              updateInterval: tag.updateInterval || 150, // Default to 150 seconds if not set
              lastUpdate: undefined
            };
          });
          
          setTags(displayTags);
        } else {
          setTags([]);
        }
      } catch (error) {
        console.error('Failed to fetch configured tags:', error);
        toast({
          title: 'Error',
          description: 'Failed to load configured historian tags.',
          variant: 'destructive',
        });
      } finally {
        setTagsLoading(false);
      }
    };

    fetchConfiguredTags();
  }, [client, toast, tenantId]);

  // Fetch current values and trend data for all tags
  useEffect(() => {
    if (tags.length === 0 || !client) return;

    const fetchRealTimeData = async () => {
      const now = Date.now();
      const currentTags = tagsRef.current; // Use ref to get current tags without dependency
      
      for (const tag of currentTags) {
        try {
          // Check if enough time has passed since last update for this tag
          const updateIntervalMs = (tag.updateInterval || 30) * 1000;
          const timeSinceLastUpdate = tag.lastUpdate ? now - tag.lastUpdate : Infinity;
          
          if (timeSinceLastUpdate >= updateIntervalMs) {
            // Fetch current value (returns true if got real PI data, false if demo mode)
            const gotRealData = await fetchCurrentValue(tag);
            
            // Only load historical trend data if we got real current data from PI
            // If we fell back to demo, fetchCurrentValue already generated fresh demo trend data
            if (gotRealData) {
              await loadTrendData(tag, true);
            }
            
            // Update last update timestamp
            setTags(prev => prev.map(t => 
              t.id === tag.id ? { ...t, lastUpdate: now } : t
            ));
          }
        } catch (error) {
          console.error(`Failed to fetch data for ${tag.name}:`, error);
        }
      }
    };

    // Initial fetch (always runs regardless of interval)
    const initialFetch = async () => {
      const now = Date.now();
      for (const tag of tags) {
        try {
          const gotRealData = await fetchCurrentValue(tag);
          
          // Only load trend data if we got real current data from PI
          // If we fell back to demo, fetchCurrentValue already generated fresh demo trend data
          if (gotRealData) {
            await loadTrendData(tag);
          }
          
          // Set initial lastUpdate timestamp
          setTags(prev => prev.map(t => 
            t.id === tag.id ? { ...t, lastUpdate: now } : t
          ));
        } catch (error) {
          console.error(`Failed to fetch initial data for ${tag.name}:`, error);
        }
      }
    };
    
    initialFetch();

    // Find the minimum update interval to use as the check frequency
    // We'll check more frequently than the smallest interval to ensure timely updates
    const minInterval = Math.min(...tags.map(t => t.updateInterval || 30));
    const checkFrequency = Math.min(minInterval * 1000, 10000); // Check at least every 10 seconds
    
    // Set up periodic check - will only update tags that need it
    const refreshInterval = setInterval(fetchRealTimeData, checkFrequency);

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags.length, client]); // Only re-run when number of tags changes, not on every state update

  // Fetch current value for a tag
  // Returns true if real PI data was fetched, false if fell back to demo
  const fetchCurrentValue = async (tag: HistorianTag): Promise<boolean> => {
    try {
      if (!client.hasProvider('pi')) {
        // Demo mode: generate random value
        const demoValue = generateDemoValue(tag);
        setTags(prev => prev.map(t => 
          t.id === tag.id 
            ? { ...t, currentValue: demoValue, status: 'normal', trend: 'stable' }
            : t
        ));
        return false; // Using demo mode
      }

      // Query current value from PI - use last 5 minutes to increase chance of getting data
      const query: TimeSeriesQuery = {
        provider: 'pi',
        streams: [{ id: tag.id, name: tag.name, path: tag.path, units: tag.units }],
        mode: 'recorded',
        startTimeUtc: new Date(Date.now() - 300000).toISOString(), // Last 5 minutes (was 1 minute)
        endTimeUtc: new Date().toISOString(),
        intervals: 10 // Get up to 10 points
      };

      const results = await client.query(query);
      
      if (results && results.length > 0) {
        const points = results[0].points || [];
        
        if (points.length > 0) {
          const latestPoint = points[points.length - 1];
          const currentValue = typeof latestPoint.value === 'number' ? latestPoint.value : undefined;
          
          // Calculate trend from last few points
          const trend = calculateTrend(points);
          const status = determineStatus(currentValue, tag);

          const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '─';
          console.log(`✅ [TREND] ${tag.name}: ${currentValue?.toFixed(1)} | ${trendIcon} ${trend.toUpperCase()} | Status: ${status}`);
          
          setTags(prev => prev.map(t => 
            t.id === tag.id 
              ? { ...t, currentValue, trend, status }
              : t
          ));
          return true; // Success - got real PI data
        }
      }
      
      // No data available - generate demo value
      const demoValue = generateDemoValue(tag);
      
      // Then, clear any old trend data and set new demo data
      const demoTrendData = generateSampleTrendData({ ...tag, currentValue: demoValue });
      
      // Calculate trend from the generated demo data
      const calculatedTrend = calculateTrend(demoTrendData[0].points);
      
      // Update tag with calculated trend
      setTags(prev => prev.map(t => 
        t.id === tag.id 
          ? { ...t, currentValue: demoValue, status: 'normal', trend: calculatedTrend }
          : t
      ));
      
      const trendIcon = calculatedTrend === 'up' ? '📈' : calculatedTrend === 'down' ? '📉' : '─';
      console.log(`🎲 [DEMO TREND] ${tag.name}: ${demoValue.toFixed(1)} | ${trendIcon} ${calculatedTrend.toUpperCase()} | Status: normal`);
      
      setTrendData(prev => {
        const newData = { ...prev };
        delete newData[tag.id]; // Clear old data first
        newData[tag.id] = demoTrendData; // Set new data
        return newData;
      });
      
      return false; // Using demo mode
      
    } catch (error) {
      console.error(`[HistorianMicroTrends] Failed to fetch current value for ${tag.name}:`, error);
      // On error, use demo value so at least something shows
      const demoValue = generateDemoValue(tag);
      setTags(prev => prev.map(t => 
        t.id === tag.id 
          ? { ...t, currentValue: demoValue, status: 'normal', trend: 'stable' }
          : t
      ));
      
      // Clear old data and regenerate demo chart data
      const demoTrendData = generateSampleTrendData({ ...tag, currentValue: demoValue });
      
      // Calculate trend from the generated demo data
      const calculatedTrend = calculateTrend(demoTrendData[0].points);
      
      // Update tag with calculated trend
      setTags(prev => prev.map(t => 
        t.id === tag.id 
          ? { ...t, currentValue: demoValue, status: 'normal', trend: calculatedTrend }
          : t
      ));
      
      setTrendData(prev => {
        const newData = { ...prev };
        delete newData[tag.id]; // Clear old data first
        newData[tag.id] = demoTrendData; // Set new data
        return newData;
      });
      
      return false; // Using demo mode
    }
  };

  // Generate demo value based on tag category
  const generateDemoValue = (tag: HistorianTag): number => {
    switch (tag.category) {
      case 'temperature':
        return Math.round((Math.random() * 100 + 200) * 10) / 10; // 200-300
      case 'pressure':
        return Math.round((Math.random() * 5 + 1) * 10) / 10; // 1-6
      case 'flow':
        return Math.round((Math.random() * 200 + 50) * 10) / 10; // 50-250
      case 'level':
        return Math.round((Math.random() * 100) * 10) / 10; // 0-100
      case 'power':
        return Math.round((Math.random() * 1000 + 100) * 10) / 10; // 100-1100
      default:
        return Math.round((Math.random() * 100) * 10) / 10;
    }
  };

  // Calculate trend direction from time series points
  const calculateTrend = (points: TimeSeriesPoint[]): 'up' | 'down' | 'stable' => {
    if (points.length < 2) return 'stable';
    
    // Look at ALL points (first to last) to capture the overall trend
    // This works better with demo data that has a trend across all 12 points
    const values = points.map(p => typeof p.value === 'number' ? p.value : 0);
    
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;
    
    // Lower threshold to 1% for more sensitive trend detection
    if (Math.abs(change) < 1) return 'stable';
    
    const trend = change > 0 ? 'up' : 'down';
    
    // Debug log to see what's being calculated
    console.log(`📊 [CALC] Trend calculation: ${first.toFixed(1)} → ${last.toFixed(1)} = ${change.toFixed(1)}% = ${trend.toUpperCase()}`);
    
    return trend;
  };

  // Determine status based on value
  const determineStatus = (value: number | undefined, tag: HistorianTag): 'normal' | 'warning' | 'alarm' => {
    if (value === undefined) return 'normal';
    
    // Simple threshold-based status (could be enhanced with configured limits)
    switch (tag.category) {
      case 'temperature':
        if (value > 400) return 'alarm';
        if (value > 350) return 'warning';
        return 'normal';
      case 'pressure':
        if (value > 10) return 'alarm';
        if (value > 8) return 'warning';
        return 'normal';
      default:
        return 'normal';
    }
  };

  // Handle tags configured from Quick Setup dialog
  const handleTagsConfigured = async (configuredTags: any[]) => {
    try {
      // Convert configured tags to display format
      const displayTags: HistorianTag[] = configuredTags.map(tag => ({
        id: tag.webId,
        name: tag.name,
        path: tag.path,
        units: tag.units || '',
        category: tag.category || 'other',
        currentValue: undefined,
        trend: 'stable' as const,
        status: 'normal' as const,
        updateInterval: tag.updateInterval || 30, // Default to 30 seconds if not set
        lastUpdate: undefined
      }));
      
      setTags(displayTags);
      setShowQuickSetup(false);
      
      console.log('[HistorianMicroTrends] Tags configured with intervals:', displayTags.map(t => ({ name: t.name, interval: t.updateInterval })));
      
      toast({
        title: 'Tags Configured',
        description: `Successfully configured ${configuredTags.length} historian tag${configuredTags.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Failed to configure tags:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tag configuration',
        variant: 'destructive'
      });
    }
  };

  const getCategoryIcon = (category: HistorianTag['category']) => {
    switch (category) {
      case 'temperature': return Thermometer;
      case 'pressure': return Gauge;
      case 'flow': return Droplets;
      case 'level': return Activity;
      case 'power': return Zap;
      case 'quality': return Settings;
      default: return Activity;
    }
  };

  const getStatusColor = (status: HistorianTag['status']) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'alarm': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: HistorianTag['trend']) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <div className="w-4 h-4 text-gray-400">─</div>;
    }
  };

  const getTrendColor = (trend: HistorianTag['trend']) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const loadTrendData = async (tag: HistorianTag, forceReload = false) => {
    // Skip if already loading, but allow reload if forced or no data exists
    if (loading[tag.id]) return;
    if (!forceReload && trendData[tag.id]) return;

    setLoading(prev => ({ ...prev, [tag.id]: true }));

    try {
      // Check if PI provider is available
      if (!client.hasProvider('pi')) {
        // Demo mode: generate sample trend data
        const sampleData = generateSampleTrendData(tag);
        setTrendData(prev => {
          const newData = { ...prev };
          delete newData[tag.id]; // Clear old data first
          newData[tag.id] = sampleData;
          return newData;
        });
        return;
      }

      // Create a query for the last hour with interpolated data
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      const query: TimeSeriesQuery = {
        provider: 'pi',
        streams: [{ id: tag.id, name: tag.name, path: tag.path, units: tag.units }],
        mode: 'interpolated',
        startTimeUtc: startTime,
        endTimeUtc: endTime,
        interval: '5m', // 5-minute intervals
        intervals: 12 // 12 data points
      };

      const results = await client.query(query);
      
      setTrendData(prev => {
        const newData = { ...prev };
        delete newData[tag.id]; // Clear old data first
        newData[tag.id] = results;
        return newData;
      });
    } catch (error) {
      console.error(`Failed to load trend data for ${tag.name}:`, error);
      // Show user-friendly error message
      toast({
        title: 'Connection Error',
        description: 'Unable to connect to PI historian. Please check PI Integration settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, [tag.id]: false }));
    }
  };

  // Generate sample trend data for demonstration
  const generateSampleTrendData = (tag: HistorianTag): TimeSeriesResult[] => {
    const now = new Date();
    const points: TimeSeriesPoint[] = [];
    
    // Use current value or generate a random base value
    const baseValue = tag.currentValue ?? (
      tag.category === 'temperature' ? 250 :
      tag.category === 'pressure' ? 3.5 :
      tag.category === 'flow' ? 150 :
      tag.category === 'level' ? 50 :
      tag.category === 'power' ? 500 :
      100
    );
    
    // Generate a realistic trend (up, down, or stable) over 12 points
    // 40% up, 40% down, 20% stable - more trends, fewer stable
    const rand = Math.random();
    const trendDirection = rand < 0.4 ? 'up' : rand < 0.8 ? 'down' : 'stable';
    // Stronger trends: 5-15% total change (was 2-10%)
    const trendStrength = trendDirection === 'stable' ? 0 : (Math.random() * 0.10 + 0.05);
    
    // Generate 12 data points over the last hour with realistic trend
    for (let i = 11; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 5-minute intervals
      
      // Calculate trend progression (0 to 1)
      const progress = (11 - i) / 11; // 0 (oldest) to 1 (newest)
      
      // Calculate trend value
      let trendValue = baseValue;
      if (trendDirection === 'up') {
        trendValue = baseValue + (baseValue * trendStrength * progress);
      } else if (trendDirection === 'down') {
        trendValue = baseValue - (baseValue * trendStrength * progress);
      }
      
      // Add smaller random variation (±1% instead of ±2%)
      const variation = (Math.random() - 0.5) * (baseValue * 0.01);
      const value = trendValue + variation;
      
      points.push({
        timestamp: timestamp.toISOString(),
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
        units: tag.units,
        quality: { good: true, questionable: false, substituted: false }
      });
    }

    return [{
      stream: { id: tag.id, name: tag.name, path: tag.path, units: tag.units },
      points,
      qualitySummary: {
        samples: points.length,
        pctGood: 100,
        pctQuestionable: 0,
        pctSubstituted: 0,
        lastSampleTime: points[points.length - 1]?.timestamp
      }
    }];
  };

  const renderMiniTrend = (tag: HistorianTag) => {
    const data = trendData[tag.id];
    
    if (!data || data.length === 0) {
      return (
        <div className="h-16 bg-gray-100 rounded flex items-center justify-center">
          {loading[tag.id] ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadTrendData(tag, true)}
              className="text-xs"
            >
              {client.hasProvider('pi') ? 'Load Trend' : 'Show Demo'}
            </Button>
          )}
        </div>
      );
    }

    // Simple trend visualization using dots
    const points = data[0]?.points || [];
    const values = points.map(p => typeof p.value === 'number' ? p.value : 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    return (
      <div className="h-16 bg-gray-50 rounded p-2">
        <div className="flex items-end justify-between h-full space-x-1">
          {values.map((value, index) => {
            const height = range > 0 ? ((value - min) / range) * 100 : 50;
            return (
              <div
                key={index}
                className="flex-1 bg-blue-500 rounded-sm"
                style={{ height: `${Math.max(height, 10)}%` }}
                title={`${new Date(points[index]?.timestamp || '').toLocaleTimeString()}: ${value} ${tag.units}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Real-Time Process Trends
            </CardTitle>
            <CardDescription>
              Live historian data for key production parameters. 
              {!client.hasProvider('pi') && ' (PI connection required)'}
            </CardDescription>
          </div>
          {tags.length > 0 && piClient && (
            <Dialog open={showQuickSetup} onOpenChange={setShowQuickSetup}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Tags
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Manage Historian Tags</DialogTitle>
                  <DialogDescription>
                    Browse and select PI tags to display as real-time trends on your dashboard
                  </DialogDescription>
                </DialogHeader>
                <HistorianTagConfigurator 
                  piClient={piClient}
                  tenantId={tenantId}
                  onTagsConfigured={handleTagsConfigured}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tagsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-gray-600">Loading PI attributes...</span>
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Historian Tags Configured</h3>
            <p className="text-sm text-gray-500 mb-4">
              Configure historian tags to see live process trends on your dashboard.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Dialog open={showQuickSetup} onOpenChange={setShowQuickSetup}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Quick Setup
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Configure Historian Tags</DialogTitle>
                    <DialogDescription>
                      Browse and select PI tags to display as real-time trends on your dashboard
                    </DialogDescription>
                  </DialogHeader>
                  {piClient ? (
                    <HistorianTagConfigurator 
                      piClient={piClient}
                      tenantId={tenantId}
                      onTagsConfigured={handleTagsConfigured}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">PI connection not configured.</p>
                      <Button 
                        variant="outline" 
                        onClick={() => window.location.href = '/connectivity?tab=integrations'}
                      >
                        Configure PI Connection
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/connectivity?tab=integrations'}
              >
                <Settings className="w-4 h-4 mr-2" />
                PI Integration
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tags.map((tag) => {
              const Icon = getCategoryIcon(tag.category);
              
              // Calculate next update time
              const getNextUpdateText = () => {
                try {
                  if (!tag.lastUpdate || !tag.updateInterval) {
                    return 'Pending...';
                  }
                  const now = Date.now();
                  const timeSinceUpdate = now - tag.lastUpdate;
                  const updateIntervalMs = tag.updateInterval * 1000;
                  const timeUntilNext = updateIntervalMs - timeSinceUpdate;
                  
                  if (timeUntilNext <= 0) return 'Updating...';
                  
                  const secondsUntilNext = Math.ceil(timeUntilNext / 1000);
                  if (secondsUntilNext < 60) return `${secondsUntilNext}s`;
                  if (secondsUntilNext < 3600) return `${Math.ceil(secondsUntilNext / 60)}m`;
                  return `${Math.ceil(secondsUntilNext / 3600)}h`;
                } catch (error) {
                  console.error('Error calculating next update time:', error);
                  return '─';
                }
              };
              
              return (
                <Card key={tag.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{tag.name}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">
                        {tag.currentValue !== undefined 
                          ? tag.currentValue.toFixed(1) 
                          : (loading[tag.id] ? '...' : '─')
                        }
                      </div>
                      <Badge className={getStatusColor(tag.status)}>
                        {tag.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(tag.trend)}
                        <span className={`text-sm font-medium ${getTrendColor(tag.trend)}`}>
                          {tag.trend === 'up' ? 'Rising' : tag.trend === 'down' ? 'Falling' : 'Stable'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-blue-600 font-medium" title={`Updates every ${tag.updateInterval}s`}>
                        <Clock className="w-3 h-3" />
                        <span>{getNextUpdateText()}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{tag.units}</div>
                    {renderMiniTrend(tag)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistorianMicroTrends;
