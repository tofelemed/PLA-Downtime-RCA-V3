import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Activity, Zap, Gauge, Thermometer, Droplets, Settings } from 'lucide-react';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { TimeSeriesQuery, TimeSeriesResult, TimeSeriesPoint } from '@/services/historian/types';
import { piStore } from '@/services/pi/PIStore';

interface HistorianTag {
  id: string;
  name: string;
  path: string;
  units: string;
  category: 'temperature' | 'pressure' | 'flow' | 'level' | 'power' | 'quality' | 'other';
  currentValue?: number;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'warning' | 'alarm';
}

interface HistorianMicroTrendsProps {
  client: HistorianClient;
  tenantId: string;
}

const HistorianMicroTrends: React.FC<HistorianMicroTrendsProps> = ({ client, tenantId }) => {
  const { toast } = useToast();
  const [tags, setTags] = useState<HistorianTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

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

  // Fetch configured historian tags when component mounts
  useEffect(() => {
    const fetchConfiguredTags = async () => {
      if (!client || !client.hasProvider('pi')) {
        setTagsLoading(false);
        return;
      }

      try {
        setTagsLoading(true);
        
        // Load configured tags from piStore
        console.log('[HistorianMicroTrends] Loading tags for tenantId:', tenantId);
        const configuredTags = await piStore.getHistorianTags(tenantId);
        console.log('[HistorianMicroTrends] Loaded configured tags:', configuredTags);
        
        if (configuredTags.length > 0) {
          // Convert configured tags to display format
          const displayTags: HistorianTag[] = configuredTags.map(tag => ({
            id: tag.webId,
            name: tag.name,
            path: tag.path,
            units: tag.units,
            category: tag.category,
            currentValue: undefined, // Will be fetched when loading trend data
            trend: 'stable',
            status: 'normal'
          }));
          
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
  }, [client, toast]);
  const [trendData, setTrendData] = useState<{ [key: string]: TimeSeriesResult[] }>({});

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

  const loadTrendData = async (tag: HistorianTag) => {
    if (loading[tag.id] || trendData[tag.id]) return;

    setLoading(prev => ({ ...prev, [tag.id]: true }));

    try {
      // Check if PI provider is available
      if (!client.hasProvider('pi')) {
        // Demo mode: generate sample trend data
        const sampleData = generateSampleTrendData(tag);
        setTrendData(prev => ({ ...prev, [tag.id]: sampleData }));
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
      setTrendData(prev => ({ ...prev, [tag.id]: results }));
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
    
    // Generate 12 data points over the last hour
    for (let i = 11; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 5-minute intervals
      const baseValue = tag.currentValue || 0;
      const variation = (Math.random() - 0.5) * (baseValue * 0.1); // ±5% variation
      const value = baseValue + variation;
      
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
               onClick={() => loadTrendData(tag)}
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
        <CardTitle className="flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Real-Time Process Trends
        </CardTitle>
        <CardDescription>
          Live historian data for key production parameters. 
          {!client.hasProvider('pi') && ' (PI connection required)'}
        </CardDescription>
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
              To see live process trends, please configure historian tags in the PI Integration settings.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/integrations/pi'}
              className="mx-auto"
            >
              Go to PI Integration
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tags.map((tag) => {
              const Icon = getCategoryIcon(tag.category);
              return (
                <Card key={tag.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{tag.name}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{tag.currentValue}</div>
                      <Badge className={getStatusColor(tag.status)}>
                        {tag.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(tag.trend)}
                      <span className={`text-sm font-medium ${getTrendColor(tag.trend)}`}>
                        {tag.trend === 'up' ? 'Rising' : tag.trend === 'down' ? 'Falling' : 'Stable'}
                      </span>
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
