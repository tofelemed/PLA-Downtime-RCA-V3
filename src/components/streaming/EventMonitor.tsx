import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter, 
  Search, 
  Play, 
  Pause, 
  RefreshCw,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { globalEventCorrelation } from '@/services/correlation/EventCorrelation';
import { globalDataQualityMonitor } from '@/services/quality/DataQualityMonitor';
import { globalAlertManager } from '@/services/alerts/AlertManager';
import { globalPerformanceMonitor } from '@/services/monitoring/PerformanceMonitor';
import { globalEventBus } from '@/services/events/EventBus';

interface EventData {
  id: string;
  timestamp: Date;
  source: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data?: any;
  metadata?: Record<string, any>;
}

export const EventMonitor: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [filters, setFilters] = useState({
    source: '',
    type: '',
    severity: '',
    search: '',
    timeRange: '1h'
  });
  const [showDetails, setShowDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState({
    totalEvents: 0,
    eventsPerSecond: 0,
    criticalEvents: 0,
    warnings: 0,
    lastEvent: null as Date | null
  });

  useEffect(() => {
    // Subscribe to various event types
    const subscriptions = [
      globalEventBus.subscribe('correlation:result:created', handleEvent),
      globalEventBus.subscribe('quality:result:created', handleEvent),
      globalEventBus.subscribe('alert:created', handleEvent),
      globalEventBus.subscribe('performance:metric:recorded', handleEvent),
      globalEventBus.subscribe('ethernetip:tag:read', handleEvent),
      globalEventBus.subscribe('profinet:block:read', handleEvent),
      globalEventBus.subscribe('modbus:register:read', handleEvent)
    ];

    // Start monitoring
    startMonitoring();

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
      stopMonitoring();
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [events, filters]);

  const handleEvent = (eventData: any) => {
    const event: EventData = {
      id: eventData.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      source: eventData.source || 'unknown',
      type: eventData.type || 'unknown',
      severity: determineSeverity(eventData),
      message: eventData.message || 'Event occurred',
      data: eventData,
      metadata: eventData.metadata || {}
    };

    setEvents(prev => [event, ...prev.slice(0, 999)]); // Keep last 1000 events
    updateStats();
  };

  const determineSeverity = (eventData: any): 'low' | 'medium' | 'high' | 'critical' => {
    if (eventData.severity) return eventData.severity;
    if (eventData.quality === 'bad') return 'critical';
    if (eventData.quality === 'uncertain') return 'warning';
    if (eventData.value > 90) return 'high';
    if (eventData.value > 70) return 'medium';
    return 'low';
  };

  const updateStats = () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentEvents = events.filter(e => e.timestamp > oneHourAgo);
    
    setStats({
      totalEvents: events.length,
      eventsPerSecond: recentEvents.length / 3600,
      criticalEvents: events.filter(e => e.severity === 'critical').length,
      warnings: events.filter(e => e.severity === 'high').length,
      lastEvent: events.length > 0 ? events[0].timestamp : null
    });
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    // Simulate some events for demonstration
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const mockEvent = {
          id: `mock_${Date.now()}`,
          source: ['System', 'Database', 'Network', 'Application'][Math.floor(Math.random() * 4)],
          type: ['Info', 'Warning', 'Error', 'Debug'][Math.floor(Math.random() * 4)],
          message: `Mock event from ${Math.random().toString(36).substr(2, 5)}`,
          value: Math.random() * 100
        };
        handleEvent(mockEvent);
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  const applyFilters = () => {
    let filtered = events;

    if (filters.source) {
      filtered = filtered.filter(e => e.source.toLowerCase().includes(filters.source.toLowerCase()));
    }

    if (filters.type) {
      filtered = filtered.filter(e => e.type.toLowerCase().includes(filters.type.toLowerCase()));
    }

    if (filters.severity) {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }

    if (filters.search) {
      filtered = filtered.filter(e => 
        e.message.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.source.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.timeRange) {
      const now = new Date();
      let cutoff: Date;
      
      switch (filters.timeRange) {
        case '1h':
          cutoff = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }
      
      filtered = filtered.filter(e => e.timestamp > cutoff);
    }

    setFilteredEvents(filtered);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const exportEvents = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearEvents = () => {
    setEvents([]);
    setFilteredEvents([]);
    setStats({
      totalEvents: 0,
      eventsPerSecond: 0,
      criticalEvents: 0,
      warnings: 0,
      lastEvent: null
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Event Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and management of system events
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={isMonitoring ? "destructive" : "default"}
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className="flex items-center space-x-2"
          >
            {isMonitoring ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isMonitoring ? 'Stop' : 'Start'} Monitoring</span>
          </Button>
          <Button variant="outline" onClick={exportEvents}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={clearEvents}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.eventsPerSecond.toFixed(2)} events/sec
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.criticalEvents}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
            <p className="text-xs text-muted-foreground">
              Monitor closely
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Event</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lastEvent ? stats.lastEvent.toLocaleTimeString() : 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.lastEvent ? stats.lastEvent.toLocaleDateString() : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Event Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="source-filter">Source</Label>
              <Input
                id="source-filter"
                placeholder="Filter by source..."
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-filter">Type</Label>
              <Input
                id="type-filter"
                placeholder="Filter by type..."
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity-filter">Severity</Label>
              <Select value={filters.severity} onValueChange={(value) => setFilters({ ...filters, severity: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-filter">Time Range</Label>
              <Select value={filters.timeRange} onValueChange={(value) => setFilters({ ...filters, timeRange: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-filter">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-filter"
                  placeholder="Search events..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Showing {filteredEvents.length} of {events.length} events
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="show-details">Show Details</Label>
              <Switch
                id="show-details"
                checked={showDetails}
                onCheckedChange={setShowDetails}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No events found matching the current filters.
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="mt-1">
                          {getSeverityIcon(event.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {event.source}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {event.type}
                            </Badge>
                            <Badge className={`text-xs ${getSeverityColor(event.severity)}`}>
                              {event.severity}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{event.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.timestamp.toLocaleString()}
                          </p>
                          {showDetails && event.data && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(event.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Event Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEvent(null)}
              >
                <EyeOff className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Message</Label>
                <p className="text-sm">{selectedEvent.message}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Source</Label>
                  <p className="text-sm">{selectedEvent.source}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <p className="text-sm">{selectedEvent.type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Severity</Label>
                  <Badge className={getSeverityColor(selectedEvent.severity)}>
                    {selectedEvent.severity}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Timestamp</Label>
                  <p className="text-sm">{selectedEvent.timestamp.toLocaleString()}</p>
                </div>
              </div>
              
              {selectedEvent.data && (
                <div>
                  <Label className="text-sm font-medium">Data</Label>
                  <div className="p-2 bg-muted rounded text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Metadata</Label>
                  <div className="p-2 bg-muted rounded text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
