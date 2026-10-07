import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  BarChart3,
  Calendar,
  Target,
  Activity,
  Zap,
  Shield,
  Users,
  Settings,
  Bell,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Filter,
  RefreshCw,
  Gauge,
  Factory,
  AlertCircle,
  TrendingDown as TrendingDownIcon
} from 'lucide-react';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import HistorianMicroTrends from '@/components/historian/HistorianMicroTrends';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { PIHistorianProvider } from '@/services/historian/providers/pi/PIHistorianProvider';
import { PIClient, createTenantPIClient } from '@/services/pi/PIClient';
import { piStore } from '@/services/pi/PIStore';
import { masterDataService } from '../services/MasterDataService';
import { useToast } from '@/hooks/use-toast';
import { unifiedAnalyticsService, UnifiedAnalyticsService } from '@/services/analytics/UnifiedAnalyticsService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Dashboard: React.FC = () => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [piConnection, setPiConnection] = useState<any>(null);
  const [historianClient, setHistorianClient] = useState<HistorianClient | null>(null);
  
  // Date range state
  const [selectedDateRange, setSelectedDateRange] = useState('last30Days');
  const dateRanges = UnifiedAnalyticsService.getDateRanges();
  
  // Real data state
  const [loading, setLoading] = useState(true);
  const [allEvents, setAllEvents] = useState<any[]>([]); // Store all events
  const [dashboardData, setDashboardData] = useState({
    productionPlans: [],
    events: [],
    rcas: [],
    recommendations: [],
    oeeMetrics: null,
    productionLosses: [],
    units: [],
    assets: []
  });

  // Load real dashboard data
  const loadDashboardData = async () => {
    // Use plant selection tenant if available, otherwise fall back to session tenant
    const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
    
    if (!tenantId) return;
    
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [productionPlans, events, rcas, productionLosses, units, assets] = await Promise.all([
        masterDataService.getProductionPlans({ tenantId }),
        masterDataService.getProductionEvents({ tenantId }),
        masterDataService.getRCAs({ tenantId }),
        masterDataService.getProductionLosses({ tenantId }),
        masterDataService.getUnits(),
        masterDataService.getAssets()
      ]);
      
      // Store all events for filtering
      setAllEvents(events);
      
      // Extract recommendations from RCAs
      const allRecommendations = rcas.flatMap(rca => rca.recommendations || []);
      
      // Filter events by selected date range
      const currentRange = dateRanges[selectedDateRange];
      const filteredEvents = unifiedAnalyticsService.filterEventsByDateRange(
        events,
        currentRange.startDate,
        currentRange.endDate
      );
      
      // Calculate OEE metrics using unified service
      const oeeMetrics = unifiedAnalyticsService.calculateOEEMetrics(filteredEvents, currentRange);
      
      setDashboardData({
        productionPlans,
        events: filteredEvents,
        rcas,
        recommendations: allRecommendations,
        oeeMetrics,
        productionLosses,
        units,
        assets
      });
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Reload data when date range changes
  useEffect(() => {
    if (allEvents.length > 0) {
      const currentRange = dateRanges[selectedDateRange];
      const filteredEvents = unifiedAnalyticsService.filterEventsByDateRange(
        allEvents,
        currentRange.startDate,
        currentRange.endDate
      );
      
      const oeeMetrics = unifiedAnalyticsService.calculateOEEMetrics(filteredEvents, currentRange);
      
      setDashboardData(prev => ({
        ...prev,
        events: filteredEvents,
        oeeMetrics
      }));
    }
  }, [selectedDateRange, allEvents]);

  // Initialize PI connection and HistorianClient
  useEffect(() => {
    const initializePI = async () => {
      if (!session?.tenant?.id) {
        console.log('[Dashboard] No tenant ID, skipping PI initialization');
        return;
      }
      
      try {
        console.log('[Dashboard] Initializing PI connection for tenant:', session.tenant.id);
        const connection = await piStore.getConnectionByTenant(session.tenant.id);
        console.log('[Dashboard] PI connection config:', connection ? 'Found' : 'Not found');
        
        if (connection) {
          setPiConnection(connection);
          
          // Create HistorianClient with real PI credentials
          const client = new HistorianClient();
          const piClient = createTenantPIClient(session.tenant.id);
          
          const piProvider = new PIHistorianProvider(piClient);
          client.register(piProvider);
          console.log('[Dashboard] HistorianClient created and PI provider registered');
          console.log('[Dashboard] Has PI provider:', client.hasProvider('pi'));
          setHistorianClient(client);
        } else {
          console.log('[Dashboard] No PI connection found, creating demo client');
          // Even without connection, create a client for demo purposes
          const client = new HistorianClient();
          console.log('[Dashboard] Demo client created, has PI provider:', client.hasProvider('pi'));
          setHistorianClient(client);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to initialize PI connection:', error);
        // Create client anyway for demo
        const client = new HistorianClient();
        console.log('[Dashboard] Error client created, has PI provider:', client.hasProvider('pi'));
        setHistorianClient(client);
      }
    };

    initializePI();
  }, [session?.tenant?.id]);

  // Helper function to get time ago
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Helper function to determine alert type from event
  const getEventAlertType = (event: any) => {
    if (event.severity === 'Critical' || event.severity === 'High') return 'error';
    if (event.severity === 'Medium') return 'warning';
    if (event.eventType?.includes('Maintenance')) return 'info';
    return 'success';
  };

  // Helper function to get relative date
  const getRelativeDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffInDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Tomorrow';
    if (diffInDays === -1) return 'Yesterday';
    if (diffInDays > 0) return `In ${diffInDays}d`;
    return `${Math.abs(diffInDays)}d ago`;
  };

  // Load dashboard data when session or plant selection changes
  useEffect(() => {
    loadDashboardData();
  }, [session?.tenant?.id, plantSelection]);

  // Calculate additional metrics
  const criticalEvents = dashboardData.events.filter(e => e.severity === 'Critical' || e.severity === 'High').length;
  const activeUnits = dashboardData.units.length;
  const totalAssets = dashboardData.assets.length;
  const overdueRCAs = dashboardData.rcas.filter(r => {
    if (!r.dueDate || r.status === 'Closed') return false;
    return new Date(r.dueDate) < new Date();
  }).length;
  
  // Calculate equipment health score (simplified)
  const equipmentHealthScore = Math.round(100 - (criticalEvents / Math.max(dashboardData.events.length, 1)) * 100);
  
  // Top impacted assets (include all events, mark those without asset)
  const assetImpacts = dashboardData.events.reduce((acc: any, event: any) => {
    const assetId = event.assetId || 'NO_ASSET_LINKED';
    if (!acc[assetId]) {
      acc[assetId] = { count: 0, totalDuration: 0, assetId };
    }
    acc[assetId].count++;
    
    // Calculate duration: use event.duration, or calculate from startTime/endTime
    let durationMinutes = event.duration || 0;
    if (!durationMinutes && event.startTime && event.endTime) {
      const start = new Date(event.startTime).getTime();
      const end = new Date(event.endTime).getTime();
      durationMinutes = (end - start) / (1000 * 60); // Convert ms to minutes
    }
    
    acc[assetId].totalDuration += durationMinutes;
    return acc;
  }, {});
  
  const topImpactedAssets = Object.values(assetImpacts)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access the dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header with Beautiful Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-8 shadow-2xl border border-slate-700">
        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
                Welcome back, {session.user.name}!
              </h1>
              <p className="text-slate-300 text-lg font-medium">
                {plantSelection?.tenant?.name || session?.tenant?.name || 'Your Plant'} • Production Intelligence Dashboard
              </p>
              <div className="flex items-center space-x-3 mt-4">
                <Badge variant="secondary" className="bg-blue-500/30 text-blue-100 border-blue-400/50 backdrop-blur-sm font-medium">
                  <Activity className="w-3 h-3 mr-1" />
                  {activeUnits} Active Units
                </Badge>
                <Badge variant="secondary" className="bg-purple-500/30 text-purple-100 border-purple-400/50 backdrop-blur-sm font-medium">
                  <Factory className="w-3 h-3 mr-1" />
                  {totalAssets} Assets
                </Badge>
                <Badge variant="secondary" className="bg-slate-600/40 text-slate-100 border-slate-400/50 backdrop-blur-sm font-medium">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date().toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Date Range Selector */}
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger className="w-[180px] bg-white/10 border-slate-600 text-white backdrop-blur-sm hover:bg-white/15 transition-colors">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7Days">Last 7 Days</SelectItem>
                  <SelectItem value="last30Days">Last 30 Days</SelectItem>
                  <SelectItem value="last90Days">Last 90 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="secondary"
                size="sm"
                onClick={() => loadDashboardData()}
                disabled={loading}
                className="bg-white/10 border-slate-600 text-white hover:bg-white/20 backdrop-blur-sm transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Overall OEE */}
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall OEE</CardTitle>
            <Gauge className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-green-600" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-700">
                  {dashboardData.oeeMetrics?.overallOEE || 0}%
                </div>
                <p className="text-xs text-gray-600 mt-1">Equipment effectiveness</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* RCA Investigations */}
        <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RCA Investigations</CardTitle>
            <Target className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-700">
                  {dashboardData.rcas.length}
                </div>
                <p className="text-xs text-gray-600 mt-1">Active & closed</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Units */}
        <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Units</CardTitle>
            <Factory className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            ) : (
              <>
                <div className="text-2xl font-bold text-cyan-700">
                  {activeUnits}
                </div>
                <p className="text-xs text-gray-600 mt-1">Production units</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="bg-gradient-to-br from-pink-50 to-white border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            <CheckCircle className="h-4 w-4 text-pink-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-pink-600" />
            ) : (
              <>
                <div className="text-2xl font-bold text-pink-700">
                  {dashboardData.recommendations.filter(r => r.status === 'Pending').length}
                </div>
                <p className="text-xs text-gray-600 mt-1">Pending actions</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-white">
            <Bell className="w-4 h-4 mr-2" />
            Alerts ({dashboardData.events.filter(e => e.status === 'Open').length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-white">
            <CheckCircle className="w-4 h-4 mr-2" />
            Tasks ({dashboardData.recommendations.filter(r => r.status === 'Pending').length})
          </TabsTrigger>
          <TabsTrigger value="equipment" className="data-[state=active]:bg-white">
            <Settings className="w-4 h-4 mr-2" />
            Equipment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Critical Alerts */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                      Critical Alerts
                    </CardTitle>
                    <CardDescription>
                      High-priority events requiring immediate attention
                    </CardDescription>
                  </div>
                  <Badge variant="destructive" className="text-sm">
                    {criticalEvents} Critical
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                  </div>
                ) : criticalEvents > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.events
                      .filter(e => e.severity === 'Critical' || e.severity === 'High')
                      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                      .slice(0, 5)
                      .map((event) => {
                        // Look up unit name from units array
                        const unit = dashboardData.units.find(u => u.id === event.unitId);
                        const unitName = unit?.name || 'Unknown Unit';
                        
                        // Look up asset name from assets array if assetId exists
                        const asset = event.assetId ? dashboardData.assets.find(a => a.id === event.assetId) : null;
                        const assetName = asset?.name;
                        
                        // Calculate duration: use event.duration, or calculate from startTime/endTime
                        let durationMinutes = event.duration || 0;
                        if (!durationMinutes && event.startTime && event.endTime) {
                          const start = new Date(event.startTime).getTime();
                          const end = new Date(event.endTime).getTime();
                          durationMinutes = (end - start) / (1000 * 60);
                        }
                        
                        return (
                        <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-red-50 transition-colors">
                          <div className="p-2 rounded-full bg-red-100">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm text-gray-900">{event.eventType || 'Production Event'}</h4>
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{event.description || 'No description'}</p>
                              </div>
                              <Badge className={getPriorityColor(event.severity)}>
                                {event.severity}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {getTimeAgo(new Date(event.startTime))}
                              </div>
                              <div className="flex items-center">
                                <Factory className="w-3 h-3 mr-1" />
                                {unitName}
                                {assetName && ` / ${assetName}`}
                              </div>
                              {durationMinutes > 0 && (
                                <div className="flex items-center">
                                  <TrendingDownIcon className="w-3 h-3 mr-1" />
                                  {Math.round(durationMinutes / 60)}h downtime
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )})}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">All Clear!</h3>
                    <p className="text-sm text-gray-500">No critical events at this time</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats Summary - RCA Style Cards */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
              <div className="grid gap-3">
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Production Plans</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">
                      {dashboardData.productionPlans.length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Active plans</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Open Events</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700">
                      {dashboardData.events.filter(e => e.status === 'Open').length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Need attention</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active RCAs</CardTitle>
                    <Target className="h-4 w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700">
                      {dashboardData.rcas.filter(r => r.status !== 'Closed').length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">In progress</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                      {dashboardData.recommendations.length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Total actions</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
                    <Clock className="h-4 w-4 text-red-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-700">
                      {overdueRCAs}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Past due date</p>
                  </CardContent>
                </Card>

                <div className="pt-2">
                  <Badge variant="outline" className="text-xs w-full justify-center py-1">
                    {dateRanges[selectedDateRange].label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* OEE Performance Breakdown - RCA Style */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">OEE Performance Breakdown</h3>
              <Badge variant="outline" className="text-xs">
                {dateRanges[selectedDateRange].label}
              </Badge>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <TooltipProvider>
                  {/* Overall OEE */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 cursor-help">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Overall OEE</CardTitle>
                          <Gauge className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-blue-700">
                            {dashboardData.oeeMetrics?.overallOEE || 0}%
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Composite score</p>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">Overall Equipment Effectiveness</p>
                      <p className="text-xs">Availability × Performance × Quality</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Availability */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 cursor-help">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Availability</CardTitle>
                          <Activity className="h-4 w-4 text-green-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-700">
                            {dashboardData.oeeMetrics?.availability || 0}%
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Uptime ratio</p>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Percentage of planned production time equipment was available</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Performance */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200 cursor-help">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Performance</CardTitle>
                          <Zap className="h-4 w-4 text-orange-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-orange-700">
                            {dashboardData.oeeMetrics?.performance || 0}%
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Speed efficiency</p>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Actual production rate vs ideal production rate</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Quality */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 cursor-help">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Quality</CardTitle>
                          <CheckCircle className="h-4 w-4 text-purple-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-purple-700">
                            {dashboardData.oeeMetrics?.quality || 0}%
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Good units rate</p>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Percentage of units produced without defects</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Top Impacted Assets */}
          {topImpactedAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Factory className="w-5 h-5 mr-2 text-gray-600" />
                  Top Impacted Assets
                </CardTitle>
                <CardDescription>Assets with most frequent events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topImpactedAssets.map((asset: any, index: number) => {
                    // Look up asset name from assets data
                    let assetName: string;
                    let isNoAsset = false;
                    
                    if (asset.assetId === 'NO_ASSET_LINKED') {
                      assetName = 'Others';
                      isNoAsset = true;
                    } else {
                      const assetData = dashboardData.assets.find((a: any) => a.id === asset.assetId);
                      assetName = assetData?.name || assetData?.code || asset.assetId || 'Unknown Asset';
                    }
                    
                    return (
                      <TooltipProvider key={asset.assetId}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex items-center space-x-3 p-3 rounded-lg cursor-help ${isNoAsset ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${isNoAsset ? 'bg-amber-200 text-amber-700' : 'bg-gray-200 text-gray-700'}`}>
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium text-sm">{assetName}</div>
                                  {isNoAsset && (
                                    <Info className="w-4 h-4 text-amber-600" />
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {asset.count} events • {Math.round(asset.totalDuration / 60)}h total downtime
                                </div>
                              </div>
                              <Badge variant="outline">{asset.count} events</Badge>
                            </div>
                          </TooltipTrigger>
                          {isNoAsset && (
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Others - Events Without Specific Asset</h4>
                                <p className="text-xs text-gray-600">
                                  This category includes events that are not linked to a specific asset or equipment. These may be:
                                </p>
                                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                                  <li>Unit-level operational events</li>
                                  <li>Production output recording events</li>
                                  <li>General process events affecting the entire unit</li>
                                  <li>Events pending asset assignment</li>
                                </ul>
                                <p className="text-xs text-amber-700 font-medium mt-2">
                                  💡 Tip: Assign assets to events for more detailed tracking and analysis.
                                </p>
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <DashboardAnalytics />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center text-lg">
                    <Bell className="w-5 h-5 mr-2" />
                    All Production Events
                  </CardTitle>
                  <CardDescription>
                    Complete list of events for {dateRanges[selectedDateRange].label.toLowerCase()}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {dashboardData.events.length} Total
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : dashboardData.events.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {dashboardData.events
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .map((event) => {
                      const alertType = getEventAlertType(event);
                      // Look up unit name from units array
                      const unit = dashboardData.units.find(u => u.id === event.unitId);
                      const unitName = unit?.name || 'Unknown Unit';
                      
                      // Look up asset name from assets array if assetId exists
                      const asset = event.assetId ? dashboardData.assets.find(a => a.id === event.assetId) : null;
                      const assetName = asset?.name;
                      
                      // Calculate duration: use event.duration, or calculate from startTime/endTime
                      let durationMinutes = event.duration || 0;
                      if (!durationMinutes && event.startTime && event.endTime) {
                        const start = new Date(event.startTime).getTime();
                        const end = new Date(event.endTime).getTime();
                        durationMinutes = (end - start) / (1000 * 60);
                      }
                      
                      return (
                        <div key={event.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                          {getAlertIcon(alertType)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm truncate">{event.eventType || 'Event'}</h4>
                              <div className="flex items-center space-x-2">
                                <Badge className={getPriorityColor(event.severity)} variant="outline">
                                  {event.severity}
                                </Badge>
                                <Badge variant={event.status === 'Open' ? 'default' : 'secondary'}>
                                  {event.status}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{event.description}</p>
                            <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                              <span>{getTimeAgo(new Date(event.startTime))}</span>
                              <span>•</span>
                              <span>{unitName}{assetName && ` / ${assetName}`}</span>
                              {durationMinutes > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{Math.round(durationMinutes / 60)}h duration</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Found</h3>
                  <p className="text-sm text-gray-500">No production events for the selected time period.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center text-lg">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    RCA Recommendations & Action Items
                  </CardTitle>
                  <CardDescription>
                    Track and manage improvement recommendations
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-yellow-50">
                    {dashboardData.recommendations.filter(r => r.status === 'Pending').length} Pending
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    {dashboardData.recommendations.filter(r => r.status === 'In Progress').length} In Progress
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : dashboardData.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.recommendations
                    .sort((a, b) => {
                      // Sort by status (Pending first) then by due date
                      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                      if (!a.dueDate && !b.dueDate) return 0;
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                    })
                    .map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-sm">{rec.title || 'RCA Recommendation'}</h4>
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority || 'Medium'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{rec.description || 'No description'}</p>
                          <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                            <div className="flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              {rec.assigneeId || 'Unassigned'}
                            </div>
                            {rec.dueDate && (
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {getRelativeDate(new Date(rec.dueDate))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <Badge 
                            variant={rec.status === 'Completed' ? 'default' : rec.status === 'In Progress' ? 'secondary' : 'outline'}
                            className={
                              rec.status === 'Completed' ? 'bg-green-100 text-green-800' :
                              rec.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {rec.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Recommendations</h3>
                  <p className="text-sm text-gray-500">No RCA recommendations have been created yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Units Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Factory className="w-5 h-5 mr-2" />
                  Production Units
                </CardTitle>
                <CardDescription>{dashboardData.units.length} units configured</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.units.length > 0 ? (
                  <div className="space-y-2">
                    {dashboardData.units.slice(0, 10).map((unit: any) => (
                      <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{unit.name}</div>
                          <div className="text-xs text-gray-500">{unit.code || 'No code'}</div>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Factory className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No units configured</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assets Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Settings className="w-5 h-5 mr-2" />
                  Equipment Assets
                </CardTitle>
                <CardDescription>{dashboardData.assets.length} assets tracked</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.assets.length > 0 ? (
                  <div className="space-y-2">
                    {dashboardData.assets.slice(0, 10).map((asset: any) => (
                      <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{asset.name}</div>
                          <div className="text-xs text-gray-500">{asset.code || 'No code'}</div>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {asset.type || 'Asset'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No assets configured</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* PI Real-Time Monitoring Section - Always Visible */}
      {historianClient && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-1 border border-indigo-200">
          <HistorianMicroTrends 
            client={historianClient} 
            tenantId={session?.tenant?.id || 'default-tenant'} 
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
