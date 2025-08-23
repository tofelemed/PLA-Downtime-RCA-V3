import React, { useMemo, useState } from 'react';
import { TimeSeriesResult } from '@/services/historian/types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, AreaChart, ComposedChart, Bar, BarChart } from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart as LineChartIcon, 
  BarChart3, 
  AreaChart as AreaChartIcon,
  Eye,
  EyeOff,
  Download,
  Settings
} from 'lucide-react';

interface TimeSeriesChartProps {
  results: TimeSeriesResult[];
  height?: number;
}

type ChartType = 'line' | 'area' | 'bar' | 'composed';

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ 
  results, 
  height = 400 
}) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [visibleStreams, setVisibleStreams] = useState<Set<string>>(new Set());
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [yAxisDomain, setYAxisDomain] = useState<'auto' | 'dataMin' | 'dataMax'>('auto');

  if (!results || results.length === 0) return null;

  // Get unique stream names and initialize visibility
  const streamNames = useMemo(() => {
    const names = new Set<string>();
    results.forEach(r => {
      const name = r.stream?.name || r.stream?.path || r.stream?.id;
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [results]);

  // Initialize visible streams if empty
  React.useEffect(() => {
    if (visibleStreams.size === 0 && streamNames.length > 0) {
      setVisibleStreams(new Set(streamNames));
    }
  }, [streamNames, visibleStreams.size]);

  const data = useMemo(() => {
    // Merge streams by timestamp; simple outer-join by ISO string
    const map = new Map<string, any>();
    
    for (const r of results) {
      const key = r.stream?.name || r.stream?.path || r.stream?.id;
      if (!key || !visibleStreams.has(key)) continue;
      
      for (const p of r.points) {
        const row = map.get(p.timestamp) || { timestamp: p.timestamp };
        row[key] = typeof p.value === 'number' ? p.value : (Number(p.value) || null);
        map.set(p.timestamp, row);
      }
    }
    
    return Array.from(map.values())
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp).toLocaleString()
      }));
  }, [results, visibleStreams]);

  const visibleResults = useMemo(() => {
    return results.filter(r => {
      const key = r.stream?.name || r.stream?.path || r.stream?.id;
      return key && visibleStreams.has(key);
    });
  }, [results, visibleStreams]);

  const toggleStreamVisibility = (streamName: string) => {
    const newVisible = new Set(visibleStreams);
    if (newVisible.has(streamName)) {
      newVisible.delete(streamName);
    } else {
      newVisible.add(streamName);
    }
    setVisibleStreams(newVisible);
  };

  const toggleAllStreams = (visible: boolean) => {
    if (visible) {
      setVisibleStreams(new Set(streamNames));
    } else {
      setVisibleStreams(new Set());
    }
  };

  const exportChartData = () => {
    const csvData = ['Timestamp,' + streamNames.join(',')];
    
    data.forEach(row => {
      const values = [row.timestamp];
      streamNames.forEach(stream => {
        values.push(row[stream] ?? '');
      });
      csvData.push(values.join(','));
    });
    
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { left: 20, right: 20, top: 20, bottom: 20 }
    };

    const streamElements = visibleResults.map((r, i) => {
      const key = r.stream?.name || r.stream?.path || r.stream?.id;
      const color = COLORS[i % COLORS.length];
      
      switch (chartType) {
        case 'line':
          return (
            <Line 
              key={key} 
              type="monotone" 
              dataKey={key} 
              stroke={color} 
              dot={false} 
              strokeWidth={2}
              name={key}
            />
          );
        case 'area':
          return (
            <Area 
              key={key} 
              type="monotone" 
              dataKey={key} 
              fill={color} 
              stroke={color} 
              strokeWidth={1}
              fillOpacity={0.3}
              name={key}
            />
          );
        case 'bar':
          return (
            <Bar 
              key={key} 
              dataKey={key} 
              fill={color} 
              name={key}
            />
          );
        case 'composed':
          return (
            <Line 
              key={key} 
              type="monotone" 
              dataKey={key} 
              stroke={color} 
              dot={false} 
              strokeWidth={2}
              name={key}
            />
          );
        default:
          return null;
      }
    });

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis domain={yAxisDomain === 'auto' ? undefined : [yAxisDomain, yAxisDomain]} />
            <Tooltip />
            {showLegend && <Legend />}
            {streamElements}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis domain={yAxisDomain === 'auto' ? undefined : [yAxisDomain, yAxisDomain]} />
            <Tooltip />
            {showLegend && <Legend />}
            {streamElements}
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis domain={yAxisDomain === 'auto' ? undefined : [yAxisDomain, yAxisDomain]} />
            <Tooltip />
            {showLegend && <Legend />}
            {streamElements}
          </BarChart>
        );
      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis domain={yAxisDomain === 'auto' ? undefined : [yAxisDomain, yAxisDomain]} />
            <Tooltip />
            {showLegend && <Legend />}
            {streamElements}
          </ComposedChart>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="w-5 h-5" />
            Time Series Chart
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportChartData}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Chart Type:</Label>
            <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">
                  <div className="flex items-center gap-2">
                    <LineChartIcon className="w-4 h-4" />
                    Line
                  </div>
                </SelectItem>
                <SelectItem value="area">
                  <div className="flex items-center gap-2">
                    <AreaChartIcon className="w-4 h-4" />
                    Area
                  </div>
                </SelectItem>
                <SelectItem value="bar">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Bar
                  </div>
                </SelectItem>
                <SelectItem value="composed">
                  <div className="flex items-center gap-2">
                    <LineChartIcon className="w-4 h-4" />
                    Composed
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm">Y-Axis:</Label>
            <Select value={yAxisDomain} onValueChange={(value: 'auto' | 'dataMin' | 'dataMax') => setYAxisDomain(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="dataMin">From 0</SelectItem>
                <SelectItem value="dataMax">To Max</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <Checkbox 
                checked={showGrid} 
                onCheckedChange={(checked) => setShowGrid(!!checked)}
              />
              <span className="text-sm">Grid</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox 
                checked={showLegend} 
                onCheckedChange={(checked) => setShowLegend(!!checked)}
              />
              <span className="text-sm">Legend</span>
            </label>
          </div>
        </div>

        {/* Stream Visibility Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <Label className="text-sm font-medium">Streams:</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllStreams(true)}
            disabled={visibleStreams.size === streamNames.length}
          >
            <Eye className="w-4 h-4 mr-2" />
            Show All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllStreams(false)}
            disabled={visibleStreams.size === 0}
          >
            <EyeOff className="w-4 h-4 mr-2" />
            Hide All
          </Button>
          
          {streamNames.map(stream => (
            <Button
              key={stream}
              variant={visibleStreams.has(stream) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleStreamVisibility(stream)}
              className="text-xs"
            >
              {visibleStreams.has(stream) ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
              {stream}
            </Button>
          ))}
        </div>

        {/* Chart */}
        <div className="w-full" style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Chart Summary */}
        <div className="text-sm text-muted-foreground">
          Displaying {visibleResults.length} of {results.length} streams with {data.length} data points
        </div>
      </CardContent>
    </Card>
  );
};

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', 
  '#0891b2', '#84cc16', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'
];

