import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Download, 
  Settings, 
  TrendingUp, 
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon
} from 'lucide-react';
import { globalRealTimeAnalytics, MetricResult, MetricDefinition } from '@/services/analytics/RealTimeAnalytics';
import { globalEventBus } from '@/services/events/EventBus';

interface ChartConfig {
  id: string;
  name: string;
  type: ChartType;
  metrics: string[];
  timeRange: TimeRange;
  refreshInterval: number;
  autoRefresh: boolean;
  colors: string[];
  options: ChartOptions;
}

type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'gauge';
type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

interface ChartOptions {
  showGrid: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  animate: boolean;
  smooth: boolean;
  stacked: boolean;
}

interface ChartData {
  timestamp: string;
  [key: string]: any;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];

export const RealTimeCharts: React.FC = () => {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Map<string, ChartData[]>>(new Map());
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [customStartTime, setCustomStartTime] = useState<string>('');
  const [customEndTime, setCustomEndTime] = useState<string>('');
  
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const dataSubscriptionRef = useRef<any>();

  // Initialize default charts
  useEffect(() => {
    const defaultCharts: ChartConfig[] = [
      {
        id: 'default-line',
        name: 'Real-Time Metrics',
        type: 'line',
        metrics: [],
        timeRange: '1h',
        refreshInterval: 5000,
        autoRefresh: true,
        colors: DEFAULT_COLORS,
        options: {
          showGrid: true,
          showLegend: true,
          showTooltip: true,
          animate: true,
          smooth: true,
          stacked: false
        }
      }
    ];
    
    setCharts(defaultCharts);
    if (defaultCharts.length > 0) {
      setSelectedChart(defaultCharts[0].id);
    }
  }, []);

  // Load metrics
  useEffect(() => {
    loadMetrics();
  }, []);

  // Set up real-time data subscription
  useEffect(() => {
    if (isLive) {
      setupDataSubscription();
    } else {
      cleanupDataSubscription();
    }

    return () => cleanupDataSubscription();
  }, [isLive, selectedChart]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh && selectedChart) {
      refreshTimerRef.current = setInterval(() => {
        refreshChartData();
      }, refreshInterval);
    } else if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, selectedChart, refreshInterval]);

  const loadMetrics = async () => {
    try {
      // This would come from the analytics service
      const availableMetrics = await globalRealTimeAnalytics.getMetrics();
      const uniqueMetrics = Array.from(new Set(availableMetrics.map(m => m.name)));
      
      // Create metric definitions for demo
      const metricDefs: MetricDefinition[] = uniqueMetrics.map((name, index) => ({
        id: `metric_${index}`,
        name,
        type: 'gauge',
        category: 'system',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      setMetrics(metricDefs);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const setupDataSubscription = () => {
    if (!selectedChart) return;

    const chart = charts.find(c => c.id === selectedChart);
    if (!chart) return;

    // Subscribe to metric updates
    dataSubscriptionRef.current = globalEventBus.subscribe('analytics:metric:updated', (event) => {
      const { metric } = event.data;
      if (chart.metrics.includes(metric.name)) {
        updateChartData(chart.id, metric);
      }
    });
  };

  const cleanupDataSubscription = () => {
    if (dataSubscriptionRef.current) {
      globalEventBus.unsubscribe(dataSubscriptionRef.current.id);
      dataSubscriptionRef.current = null;
    }
  };

  const updateChartData = (chartId: string, metric: MetricResult) => {
    setChartData(prev => {
      const currentData = prev.get(chartId) || [];
      const newDataPoint: ChartData = {
        timestamp: metric.timestamp.toISOString(),
        [metric.name]: metric.value
      };

      // Add to existing data or create new
      const existingIndex = currentData.findIndex(d => d.timestamp === newDataPoint.timestamp);
      let updatedData: ChartData[];

      if (existingIndex >= 0) {
        updatedData = [...currentData];
        updatedData[existingIndex] = { ...updatedData[existingIndex], ...newDataPoint };
      } else {
        updatedData = [...currentData, newDataPoint];
      }

      // Limit data points based on time range
      const maxPoints = getMaxDataPoints(timeRange);
      if (updatedData.length > maxPoints) {
        updatedData = updatedData.slice(-maxPoints);
      }

      const newMap = new Map(prev);
      newMap.set(chartId, updatedData);
      return newMap;
    });
  };

  const refreshChartData = async () => {
    if (!selectedChart) return;

    try {
      const chart = charts.find(c => c.id === selectedChart);
      if (!chart) return;

      const endTime = new Date();
      const startTime = getStartTime(timeRange, customStartTime, customEndTime);
      
      const data: ChartData[] = [];
      
      for (const metricName of chart.metrics) {
        const metricData = await globalRealTimeAnalytics.getMetric(metricName);
        if (metricData && metricData.timestamp >= startTime) {
          data.push({
            timestamp: metricData.timestamp.toISOString(),
            [metricName]: metricData.value
          });
        }
      }

      // Group by timestamp and merge metrics
      const groupedData = groupDataByTimestamp(data);
      
      setChartData(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedChart, groupedData);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to refresh chart data:', error);
    }
  };

  const groupDataByTimestamp = (data: ChartData[]): ChartData[] => {
    const grouped = new Map<string, ChartData>();
    
    data.forEach(point => {
      const timestamp = point.timestamp;
      if (!grouped.has(timestamp)) {
        grouped.set(timestamp, { timestamp });
      }
      
      Object.entries(point).forEach(([key, value]) => {
        if (key !== 'timestamp') {
          grouped.get(timestamp)![key] = value;
        }
      });
    });
    
    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  const getStartTime = (range: TimeRange, customStart?: string, customEnd?: string): Date => {
    const now = new Date();
    
    switch (range) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'custom':
        if (customStart) {
          return new Date(customStart);
        }
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 60 * 60 * 1000);
    }
  };

  const getMaxDataPoints = (range: TimeRange): number => {
    switch (range) {
      case '1h': return 60;
      case '6h': return 360;
      case '24h': return 1440;
      case '7d': return 1008;
      case '30d': return 4320;
      default: return 100;
    }
  };

  const addChart = () => {
    const newChart: ChartConfig = {
      id: `chart_${Date.now()}`,
      name: `Chart ${charts.length + 1}`,
      type: 'line',
      metrics: [],
      timeRange: '1h',
      refreshInterval: 5000,
      autoRefresh: true,
      colors: DEFAULT_COLORS,
      options: {
        showGrid: true,
        showLegend: true,
        showTooltip: true,
        animate: true,
        smooth: true,
        stacked: false
      }
    };
    
    setCharts(prev => [...prev, newChart]);
    setSelectedChart(newChart.id);
  };

  const removeChart = (chartId: string) => {
    setCharts(prev => prev.filter(c => c.id !== chartId));
    setChartData(prev => {
      const newMap = new Map(prev);
      newMap.delete(chartId);
      return newMap;
    });
    
    if (selectedChart === chartId) {
      const remainingCharts = charts.filter(c => c.id !== chartId);
      setSelectedChart(remainingCharts.length > 0 ? remainingCharts[0].id : null);
    }
  };

  const updateChart = (chartId: string, updates: Partial<ChartConfig>) => {
    setCharts(prev => prev.map(c => 
      c.id === chartId ? { ...c, ...updates } : c
    ));
  };

  const exportChartData = (chartId: string, format: 'json' | 'csv') => {
    const data = chartData.get(chartId) || [];
    if (data.length === 0) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = `chart_${chartId}_${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => row[header]).join(','))
      ].join('\n');
      
      content = csvContent;
      filename = `chart_${chartId}_${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChart = (chart: ChartConfig) => {
    const data = chartData.get(chart.id) || [];
    
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Activity className="w-12 h-12 mx-auto mb-2" />
            <p>No data available</p>
            <p className="text-sm">Add metrics to this chart to see data</p>
          </div>
        </div>
      );
    }

    const chartProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chart.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...chartProps}>
              {chart.options.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              {chart.options.showTooltip && <Tooltip />}
              {chart.options.showLegend && <Legend />}
              {chart.metrics.map((metric, index) => (
                <Line
                  key={metric}
                  type={chart.options.smooth ? "monotone" : "linear"}
                  dataKey={metric}
                  stroke={chart.colors[index % chart.colors.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={chart.options.animate}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...chartProps}>
              {chart.options.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              {chart.options.showTooltip && <Tooltip />}
              {chart.options.showLegend && <Legend />}
              {chart.metrics.map((metric, index) => (
                <Area
                  key={metric}
                  type={chart.options.smooth ? "monotone" : "linear"}
                  dataKey={metric}
                  fill={chart.colors[index % chart.colors.length]}
                  stroke={chart.colors[index % chart.colors.length]}
                  fillOpacity={0.3}
                  isAnimationActive={chart.options.animate}
                  stackId={chart.options.stacked ? 1 : undefined}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...chartProps}>
              {chart.options.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              {chart.options.showTooltip && <Tooltip />}
              {chart.options.showLegend && <Legend />}
              {chart.metrics.map((metric, index) => (
                <Bar
                  key={metric}
                  dataKey={metric}
                  fill={chart.colors[index % chart.colors.length]}
                  isAnimationActive={chart.options.animate}
                  stackId={chart.options.stacked ? 1 : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // For pie charts, we'll use the latest data point
        const latestData = data[data.length - 1];
        if (!latestData) return null;

        const pieData = chart.metrics
          .filter(metric => latestData[metric] !== undefined)
          .map((metric, index) => ({
            name: metric,
            value: latestData[metric],
            color: chart.colors[index % chart.colors.length]
          }));

        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={chart.options.animate}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              {chart.options.showTooltip && <Tooltip />}
              {chart.options.showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  const selectedChartConfig = charts.find(c => c.id === selectedChart);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Real-Time Charts</h2>
          <p className="text-muted-foreground">
            Monitor and visualize real-time metrics with interactive charts
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={addChart} size="sm">
            <TrendingUp className="w-4 h-4 mr-2" />
            Add Chart
          </Button>
          <Button 
            variant={isLive ? "default" : "outline"} 
            onClick={() => setIsLive(!isLive)}
            size="sm"
          >
            {isLive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isLive ? 'Live' : 'Paused'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Chart Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Chart Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Time Range</Label>
                <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="6h">Last 6 Hours</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Refresh Interval (ms)</Label>
                <Input
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  min="1000"
                  step="1000"
                />
              </div>

              <div className="space-y-2">
                <Label>Auto Refresh</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                  />
                  <span className="text-sm">{autoRefresh ? 'On' : 'Off'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Actions</Label>
                <div className="flex space-x-2">
                  <Button onClick={refreshChartData} size="sm" variant="outline">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  {selectedChart && (
                    <>
                      <Button 
                        onClick={() => exportChartData(selectedChart, 'json')} 
                        size="sm" 
                        variant="outline"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {timeRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Charts</CardTitle>
            <CardDescription>Select and configure charts</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedChart || ''} onValueChange={setSelectedChart}>
              <TabsList className="grid w-full grid-cols-4">
                {charts.map((chart) => (
                  <TabsTrigger key={chart.id} value={chart.id} className="flex items-center space-x-2">
                    <span>{chart.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChart(chart.id);
                      }}
                      className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600"
                    >
                      ×
                    </Button>
                  </TabsTrigger>
                ))}
              </TabsList>

              {charts.map((chart) => (
                <TabsContent key={chart.id} value={chart.id} className="space-y-4">
                  {/* Chart Configuration */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Chart Name</Label>
                      <Input
                        value={chart.name}
                        onChange={(e) => updateChart(chart.id, { name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Chart Type</Label>
                      <Select 
                        value={chart.type} 
                        onValueChange={(value: ChartType) => updateChart(chart.id, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="line">
                            <LineChartIcon className="w-4 h-4 mr-2" />
                            Line
                          </SelectItem>
                          <SelectItem value="area">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Area
                          </SelectItem>
                          <SelectItem value="bar">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Bar
                          </SelectItem>
                          <SelectItem value="pie">
                            <PieChartIcon className="w-4 h-4 mr-2" />
                            Pie
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Metrics</Label>
                      <Select 
                        onValueChange={(value) => {
                          const currentMetrics = chart.metrics;
                          if (!currentMetrics.includes(value)) {
                            updateChart(chart.id, { metrics: [...currentMetrics, value] });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add metric" />
                        </SelectTrigger>
                        <SelectContent>
                          {metrics.map((metric) => (
                            <SelectItem key={metric.id} value={metric.name}>
                              {metric.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Options</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={chart.options.showGrid}
                          onCheckedChange={(checked) => 
                            updateChart(chart.id, { 
                              options: { ...chart.options, showGrid: checked } 
                            })
                          }
                        />
                        <span className="text-sm">Grid</span>
                      </div>
                    </div>
                  </div>

                  {/* Selected Metrics */}
                  {chart.metrics.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selected Metrics</Label>
                      <div className="flex flex-wrap gap-2">
                        {chart.metrics.map((metric, index) => (
                          <Badge key={metric} variant="secondary" className="flex items-center space-x-2">
                            <span>{metric}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const updatedMetrics = chart.metrics.filter(m => m !== metric);
                                updateChart(chart.id, { metrics: updatedMetrics });
                              }}
                              className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600"
                            >
                              ×
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chart Display */}
                  <div className="border rounded-lg p-4 bg-white">
                    {renderChart(chart)}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
