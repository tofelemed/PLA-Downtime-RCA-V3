import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LossParetoChart } from '../components/LossParetoChart';
import { PlanWaterfallChart } from '../components/PlanWaterfallChart';
import { LossTrendChart } from '../components/LossTrendChart';
import { LossEventTable } from '../components/LossEventTable';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { 
  calculateAnalyticsSummary,
  getUnitName,
  formatAnalyticsData
} from '../utils/analyticsHelpers';
import { formatDurationSimple, formatDurationTooltip } from '../utils/durationFormatter';
import { unifiedAnalyticsService, UnifiedAnalyticsService } from '../services/analytics/UnifiedAnalyticsService';
import { 
  BarChart3, TrendingDown, List, Info, ArrowDownRight, UserCircle2, Search,
  AlertTriangle, TrendingUp, Clock, DollarSign, Target, Activity, Filter,
  Download, RefreshCw, Calendar, Settings, Bell, Eye, Zap, Gauge,
  ChevronDown, ChevronUp, Play, Pause, Square, Maximize2, Minimize2,
  FileText, BarChart, PieChart, LineChart, AlertCircle, CheckCircle,
  XCircle, Minus, Plus, RotateCcw, Save, Share2, Printer, Mail,
  MessageSquare, Flag, Star, Heart, ThumbsUp, ThumbsDown, Award,
  Shield, Lock, Unlock, Database, Server, Cloud, Wifi, WifiOff,
  Battery, BatteryLow, BatteryFull, Signal, SignalHigh, SignalLow,
  Volume2, VolumeX, Mic, MicOff, Camera, CameraOff, Video, VideoOff,
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Mail as MailIcon, Send, Inbox, Archive, Trash2, Edit, Copy,
  Scissors, Paperclip, Link, Unlink, ExternalLink
} from 'lucide-react';
import { masterDataService, ProductionEvent, Unit, Asset, ImpactCode, ProductionPlan } from '../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { ProductionPlanSelector } from '../components/ProductionPlanSelector';

const severityOptions = [
  { value: '', label: 'All Severities' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const PLADashboard: React.FC = () => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();

  // Date range presets
  const dateRanges = UnifiedAnalyticsService.getDateRanges();
  const [selectedDateRangePreset, setSelectedDateRangePreset] = useState<string>('last30Days');
  
  // Example: last 30 days
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [isCustomDateRange, setIsCustomDateRange] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>('');
  const [selectedImpactCodeId, setSelectedImpactCodeId] = useState<string | undefined>('');
  const [selectedShift, setSelectedShift] = useState<string | undefined>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string | undefined>('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>('');
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ProductionEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'executive'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  // Handle date range preset changes
  const handleDateRangePresetChange = (preset: string) => {
    setSelectedDateRangePreset(preset);
    
    if (preset === 'custom') {
      setIsCustomDateRange(true);
    } else {
      setIsCustomDateRange(false);
      const range = dateRanges[preset];
      if (range) {
        // Use local date formatting to avoid timezone shift
        const formatLocalDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        setStartDate(formatLocalDate(range.startDate));
        setEndDate(formatLocalDate(range.endDate));
      }
    }
  };

  // Handle custom date changes
  const handleCustomDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setIsCustomDateRange(true);
    setSelectedDateRangePreset('custom');
  };

  // Load master data
  useEffect(() => {
    const loadMasterData = async () => {
      // Use plant selection tenant if available, otherwise fall back to session tenant
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
      
      if (tenantId) {
        try {
          const [unitsData, assetsData, impactCodesData, plansData] = await Promise.all([
            masterDataService.getUnits(),
            masterDataService.getAssets(),
            masterDataService.getImpactCodes(),
            masterDataService.getProductionPlans({ tenantId })
          ]);
          setUnits(unitsData);
          setAssets(assetsData);
          setImpactCodes(impactCodesData);
          setPlans(plansData);
        } catch (error) {
          console.error('Error loading master data:', error);
        }
      }
    };
    loadMasterData();
  }, [plantSelection?.tenant?.id, session?.tenant?.id]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        // Trigger data refresh
        setEvents(prev => [...prev]); // Force re-render
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Fetch all events for KPIs and summary (filtered by date/unit/category/shift)
  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        // Use plant selection tenant if available, otherwise fall back to session tenant
        const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
        
        // If plant is selected but no unit, show ALL data for that plant
        const unitId = plantSelection?.unit?.id || selectedUnitId || undefined;
        
        const ev = await masterDataService.getProductionEvents({ 
          tenantId, 
          unitId 
        });
        
        const filtered = ev.filter(e => {
          if (!e.startTime) return false;
          const t = new Date(e.startTime).getTime();
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).getTime();
          if (t < start || t > end) return false;
          if (selectedCategory && e.lossCategory !== selectedCategory) return false;
          if (selectedImpactCodeId && e.impactCodeId !== selectedImpactCodeId) return false;
          if (selectedShift && e.shift !== selectedShift) return false;
          if (selectedSeverity && e.severity !== selectedSeverity) return false;
          if (selectedStatus && e.status !== selectedStatus) return false;
          if (selectedAssetId && e.assetId !== selectedAssetId) return false;
          return true;
        });
        setEvents(filtered);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [session?.tenant?.id, selectedUnitId, startDate, endDate, selectedCategory, selectedImpactCodeId, selectedShift, selectedSeverity, selectedStatus, selectedAssetId]);

  // Enhanced analytics calculations
  const analyticsSummary = useMemo(() => {
    if (!units || units.length === 0) {
      return {
        totalLoss: 0,
        eventCount: 0,
        topCategory: '-',
        topUnitId: '-',
        topUnitName: 'Loading...',
        topEvents: [],
        totalCost: 0,
        avgDuration: 0,
        criticalEvents: 0,
        oeeImpact: 0,
        trendDirection: 'neutral',
        oeeMetrics: null
      };
    }
    
    const summary = calculateAnalyticsSummary(events, {
      units,
      assets,
      impactCodes,
      oeeCodes: []
    });

    // Use unified analytics service for consistent calculations
    const unifiedSummary = unifiedAnalyticsService.calculateSummary(events);
    const totalCost = unifiedSummary.totalCost;
    const avgDuration = unifiedSummary.avgDurationMinutes;
    const criticalEvents = unifiedSummary.criticalEvents;
    const totalLossMinutes = unifiedSummary.totalLossMinutes;
    
    // Calculate OEE impact based on date range
    const availableTimeMinutes = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60);
    const oeeImpact = Math.min((totalLossMinutes / availableTimeMinutes) * 100, 100);
    
    // Calculate proper OEE metrics using UnifiedAnalyticsService
    const currentRange = dateRanges[selectedDateRangePreset] || {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      label: 'Custom Range'
    };
    const oeeMetrics = unifiedAnalyticsService.calculateOEEMetrics(events, currentRange);
    
    // Determine trend direction (simplified)
    const recentEvents = events.filter(e => {
      const eventDate = new Date(e.startTime || '');
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return eventDate > weekAgo;
    });
    const trendDirection = recentEvents.length > events.length * 0.3 ? 'increasing' : 'decreasing';

    return {
      ...summary,
      totalLoss: totalLossMinutes, // Override with our calculated value
      totalCost,
      avgDuration,
      criticalEvents,
      oeeImpact,
      trendDirection,
      oeeMetrics
    };
  }, [events, units, assets, impactCodes, startDate, endDate, selectedDateRangePreset]);

  const { totalLoss, eventCount, topCategory, topUnitName, totalCost, avgDuration, criticalEvents, oeeImpact, trendDirection, oeeMetrics } = analyticsSummary;
  const topEvents = analyticsSummary.topEvents;

  // Helper functions
  const getAssetName = (assetId: string) => {
    if (!assetId) return null;
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.name : null;
  };

  const getImpactCodeName = (impactCodeId: string) => {
    if (!impactCodeId) return null;
    const impactCode = impactCodes.find(ic => ic.id === impactCodeId);
    return impactCode ? impactCode.name : null;
  };

  const exportData = () => {
    const csvContent = [
      ['Event ID', 'Description', 'Start Time', 'End Time', 'Duration (min)', 'Unit', 'Asset', 'Category', 'Severity', 'Status', 'Cost', 'Shift'].join(','),
      ...events.map(event => [
        event.eventId || '',
        event.description || '',
        event.startTime || '',
        event.endTime || '',
        event.duration || '',
        getUnitName(event.unitId, units) || '',
        getAssetName(event.assetId) || '',
        event.lossCategory || '',
        event.severity || '',
        event.status || '',
        event.cost || '',
        event.shift || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-loss-analysis-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleConfigurePlan = () => {
    // Navigate to production plans page or open plan creation modal
    window.open('/production-plans', '_blank');
  };

  const handlePlanSelect = (plan: ProductionPlan | null) => {
    setSelectedPlan(plan);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Professional Header */}
        <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Production Loss Analytics</h1>
                  <p className="text-gray-600">Comprehensive analysis of production losses and performance metrics</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className={autoRefresh ? 'bg-green-50 border-green-200 text-green-700' : ''}
                    >
                      {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {autoRefresh ? 'Auto' : 'Manual'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{autoRefresh ? 'Disable' : 'Enable'} auto-refresh</p>
                  </TooltipContent>
                </Tooltip>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={exportData}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
            
            {/* Executive Summary Cards - Dashboard Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Production Loss</CardTitle>
                  <Clock className="h-4 w-4 text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">{loadingEvents ? '...' : formatDurationSimple(totalLoss)}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center">
                      <Target className="w-3 h-3 text-gray-600 mr-1" />
                      <span className="text-xs text-gray-600">Avg: {formatDurationSimple(avgDuration)}</span>
                    </div>
                    <div className="flex items-center">
                      {trendDirection === 'increasing' ? (
                        <TrendingUp className="w-3 h-3 text-red-600 mr-1" />
                      ) : trendDirection === 'decreasing' ? (
                        <TrendingDown className="w-3 h-3 text-green-600 mr-1" />
                      ) : (
                        <Minus className="w-3 h-3 text-gray-600 mr-1" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    Financial Impact
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 ml-1 text-purple-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Estimated Financial Impact</p>
                          <p className="text-xs">Cost calculated based on duration and severity:</p>
                          <ul className="text-xs mt-1 space-y-0.5 list-disc pl-4">
                            <li>Critical: $5,000/hour</li>
                            <li>High: $3,000/hour</li>
                            <li>Medium: $1,500/hour</li>
                            <li>Low: $500/hour</li>
                          </ul>
                          <p className="text-xs mt-1 italic">Duration capped at 24h per event</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">
                    {loadingEvents ? '...' : UnifiedAnalyticsService.formatCost(totalCost)}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    ≈ ${loadingEvents ? '...' : (totalCost / (totalLoss / 60)).toFixed(0)}/hour
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Events Recorded</CardTitle>
                  <Activity className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">{loadingEvents ? '...' : eventCount}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center">
                      <AlertTriangle className="w-3 h-3 text-red-600 mr-1" />
                      <span className="text-xs text-gray-600">{criticalEvents} critical</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-50 text-orange-700 border-orange-200">
                      {((criticalEvents / eventCount) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    Top Loss Category
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 ml-1 text-green-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Most Frequent Loss Category</p>
                          <p className="text-xs">Category with the highest number of production loss events in the selected period</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <Gauge className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-700 truncate">{loadingEvents ? '...' : topCategory}</div>
                  <p className="text-xs text-gray-600 mt-2 truncate">
                    {topUnitName}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
          {/* Advanced Filters Section */}
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Filter className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-xl">Advanced Filters & Controls</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {events.length} events found
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Basic Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Date Range Preset
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {isCustomDateRange ? 'Custom' : dateRanges[selectedDateRangePreset]?.label}
                    </Badge>
                  </Label>
                  <Select value={selectedDateRangePreset} onValueChange={handleDateRangePresetChange}>
                    <SelectTrigger>
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
                      <SelectItem value="allTime">All Time</SelectItem>
                      <SelectItem value="custom">Custom Range...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {isCustomDateRange && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Start Date</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={e => handleCustomDateChange(e.target.value, endDate)}
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">End Date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={e => handleCustomDateChange(startDate, e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Unit</Label>
                  <Select value={selectedUnitId || "all"} onValueChange={(value) => setSelectedUnitId(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Units</SelectItem>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Severity</Label>
                  <Select value={selectedSeverity || "all"} onValueChange={(value) => setSelectedSeverity(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      {severityOptions.filter(opt => opt.value !== '').map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={selectedStatus || "all"} onValueChange={(value) => setSelectedStatus(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statusOptions.filter(opt => opt.value !== '').map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Advanced Filters */}
              <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                <CollapsibleContent className="space-y-4">
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Asset</Label>
                      <Select value={selectedAssetId || "all"} onValueChange={(value) => setSelectedAssetId(value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Assets" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Assets</SelectItem>
                          {assets.map(asset => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Impact Code</Label>
                      <Select value={selectedImpactCodeId || "all"} onValueChange={(value) => setSelectedImpactCodeId(value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Impact Codes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Impact Codes</SelectItem>
                          {impactCodes.map(ic => (
                            <SelectItem key={ic.id} value={ic.id}>
                              {ic.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Loss Category</Label>
                      <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="Mechanical">Mechanical</SelectItem>
                          <SelectItem value="Electrical">Electrical</SelectItem>
                          <SelectItem value="Quality">Quality</SelectItem>
                          <SelectItem value="Process">Process</SelectItem>
                          <SelectItem value="Environmental">Environmental</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Shift</Label>
                      <Select value={selectedShift || "all"} onValueChange={(value) => setSelectedShift(value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Shifts" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Shifts</SelectItem>
                          <SelectItem value="A">Shift A (6AM-2PM)</SelectItem>
                          <SelectItem value="B">Shift B (2PM-10PM)</SelectItem>
                          <SelectItem value="C">Shift C (10PM-6AM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Active Filters Display */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Search className="w-4 h-4" />
                    <span>Active Filters:</span>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {isCustomDateRange ? `${startDate} to ${endDate}` : dateRanges[selectedDateRangePreset]?.label}
                      </Badge>
                      {!isCustomDateRange && (
                        <Badge variant="outline" className="text-[10px]">
                          {startDate} to {endDate}
                        </Badge>
                      )}
                      {selectedUnitId && (
                        <Badge variant="secondary" className="text-xs">
                          Unit: {getUnitName(selectedUnitId, units)}
                        </Badge>
                      )}
                      {selectedSeverity && (
                        <Badge variant="secondary" className="text-xs">
                          Severity: {selectedSeverity}
                        </Badge>
                      )}
                      {selectedStatus && (
                        <Badge variant="secondary" className="text-xs">
                          Status: {selectedStatus}
                        </Badge>
                      )}
                      {selectedAssetId && (
                        <Badge variant="secondary" className="text-xs">
                          Asset: {getAssetName(selectedAssetId)}
                        </Badge>
                      )}
                      {selectedImpactCodeId && (
                        <Badge variant="secondary" className="text-xs">
                          Impact: {getImpactCodeName(selectedImpactCodeId)}
                        </Badge>
                      )}
                      {selectedCategory && (
                        <Badge variant="secondary" className="text-xs">
                          Category: {selectedCategory}
                        </Badge>
                      )}
                      {selectedShift && (
                        <Badge variant="secondary" className="text-xs">
                          Shift: {selectedShift}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Last updated: {new Date().toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Loss Events - Enhanced */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Critical Loss Events</CardTitle>
                    <CardDescription>Most impactful production loss events in the selected period</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-sm">
                  Top {Math.min(topEvents.length, 5)} Events
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {topEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Loss Events Found</h3>
                  <p className="text-gray-500">Great! No production loss events were recorded in the selected period.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topEvents.slice(0, 6).map((ev, index) => {
                    const severityColor = ev.severity === 'Critical' ? 'red' : ev.severity === 'High' ? 'orange' : 'yellow';
                    const statusColor = ev.status === 'Closed' ? 'green' : ev.status === 'Open' ? 'red' : 'blue';
                    
                    return (
                      <Card key={ev.id} className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-yellow-500'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {getAssetName(ev.assetId) || ev.unitName || 'Unknown Asset'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {ev.startTime ? new Date(ev.startTime).toLocaleDateString() : 'Unknown Date'}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              <Badge variant="outline" className={`text-xs border-${severityColor}-200 text-${severityColor}-700`}>
                                {ev.severity || 'Medium'}
                              </Badge>
                              <Badge variant="outline" className={`text-xs border-${statusColor}-200 text-${statusColor}-700`}>
                                {ev.status || 'Open'}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Duration:</span>
                              <span className="text-lg font-bold text-red-600">
                                {formatDurationSimple(Number(ev.duration) || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Cost Impact:</span>
                              <span className="text-sm font-semibold text-green-600">
                                ${Number(ev.cost) ? (Number(ev.cost) / 1000).toFixed(1) + 'K' : 'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-3">
                            <Badge variant="secondary" className="text-xs">
                              {ev.lossCategory || 'Other'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {getUnitName(ev.unitId, units) || 'Unknown Unit'}
                            </Badge>
                            {ev.shift && (
                              <Badge variant="secondary" className="text-xs">
                                Shift {ev.shift}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {ev.description || 'No description available'}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <UserCircle2 className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {ev.operatorName || 'Unknown Operator'}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(ev);
                                setShowEventModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Charts Section */}
          <Tabs defaultValue="pareto" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="pareto" className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Pareto</span>
                </TabsTrigger>
                <TabsTrigger value="trends" className="flex items-center space-x-2">
                  <LineChart className="w-4 h-4" />
                  <span>Trends</span>
                </TabsTrigger>
                <TabsTrigger value="waterfall" className="flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4" />
                  <span>Waterfall</span>
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Maximize2 className="w-4 h-4 mr-2" />
                      Fullscreen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open chart in fullscreen mode</p>
                  </TooltipContent>
                </Tooltip>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>

            <TabsContent value="pareto" className="space-y-4">
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Pareto Analysis - Loss Categories</CardTitle>
                        <CardDescription>80/20 analysis of production loss categories</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {events.length} events
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[28rem] overflow-visible">
                    <LossParetoChart
                      tenantId={plantSelection?.tenant?.id || session?.tenant?.id}
                      unitId={selectedUnitId}
                      startDate={startDate}
                      endDate={endDate}
                      onCategoryClick={(impactCodeId) => {
                        setSelectedImpactCodeId(impactCodeId);
                        setSelectedCategory(''); // Clear category filter when filtering by impact code
                      }}
                    />
                  </div>
                  <div className="mt-16 p-4 bg-blue-50 rounded-lg border-t-2 border-blue-100">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div className="text-sm text-blue-800 flex-1 min-w-0">
                        <p className="font-medium mb-2">Pareto Analysis Insights:</p>
                        <ul className="list-disc list-inside space-y-2 text-blue-700 leading-relaxed">
                          <li className="break-words">Click on any bar to filter the drilldown table below</li>
                          <li className="break-words">The 80/20 rule shows that 20% of causes account for 80% of losses</li>
                          <li className="break-words">Focus improvement efforts on the top categories for maximum impact</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg">
                        <LineChart className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Loss Trend Analysis</CardTitle>
                        <CardDescription>Track loss trends over time by day, week, or shift</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select defaultValue="day">
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Daily</SelectItem>
                          <SelectItem value="week">Weekly</SelectItem>
                          <SelectItem value="shift">By Shift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[28rem] overflow-visible">
                    <LossTrendChart
                      tenantId={plantSelection?.tenant?.id || session?.tenant?.id}
                      unitId={selectedUnitId}
                      startDate={startDate}
                      endDate={endDate}
                      groupBy="day"
                      lossCategory={selectedCategory}
                      impactCodeId={selectedImpactCodeId}
                    />
                  </div>
                  <div className="mt-16 p-4 bg-green-50 rounded-lg border-t-2 border-green-100">
                    <div className="flex items-start space-x-3">
                      <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                      <div className="text-sm text-green-800 flex-1 min-w-0">
                        <p className="font-medium mb-2">Trend Analysis Insights:</p>
                        <ul className="list-disc list-inside space-y-2 text-green-700 leading-relaxed">
                          <li className="break-words">Identify patterns and seasonal variations in production losses</li>
                          <li className="break-words">Compare performance across different time periods</li>
                          <li className="break-words">Monitor the effectiveness of improvement initiatives</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="waterfall" className="space-y-4">
              {/* Production Plan Selector */}
              <ProductionPlanSelector
                tenantId={plantSelection?.tenant?.id || session?.tenant?.id || ''}
                selectedPlan={selectedPlan}
                onPlanSelect={handlePlanSelect}
                onConfigurePlan={handleConfigurePlan}
                unitId={selectedUnitId}
                showConfigureButton={true}
              />

              {/* Waterfall Chart */}
              {selectedPlan ? (
                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                          <TrendingDown className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">Planned vs. Actual Waterfall</CardTitle>
                          <CardDescription>Visualize how planned output is reduced by losses</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        Plan: {selectedPlan.name}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[28rem] overflow-visible">
                      <PlanWaterfallChart plan={selectedPlan} tenantId={plantSelection?.tenant?.id || session?.tenant?.id || ''} />
                    </div>
                    <div className="mt-16 p-4 bg-purple-50 rounded-lg border-t-2 border-purple-100">
                      <div className="flex items-start space-x-3">
                        <Target className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                        <div className="text-sm text-purple-800 flex-1 min-w-0">
                          <p className="font-medium mb-2">Waterfall Analysis Insights:</p>
                          <ul className="list-disc list-inside space-y-2 text-purple-700 leading-relaxed">
                            <li className="break-words">Shows the journey from planned production to actual output</li>
                            <li className="break-words">Identifies the largest contributors to production losses</li>
                            <li className="break-words">Helps prioritize improvement opportunities</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-lg border-0">
                  <CardContent className="p-8 text-center">
                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <TrendingDown className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Plan Selected</h3>
                    <p className="text-gray-500 mb-4">Select a production plan above to view the waterfall analysis</p>
                    <div className="flex items-center justify-center space-x-4">
                      <Badge variant="outline" className="text-sm">
                        {plans.length} plans available
                      </Badge>
                      <Button variant="outline" onClick={handleConfigurePlan}>
                        <Settings className="w-4 h-4 mr-2" />
                        Create New Plan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Performance Metrics Section */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                    <Gauge className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Performance Impact Analysis</CardTitle>
                    <CardDescription>OEE breakdown and performance indicators</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-sm">
                  Real-time
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {oeeMetrics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-3 cursor-help">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Availability</span>
                            <span className="text-sm text-gray-500">{oeeMetrics.availability}%</span>
                          </div>
                          <Progress value={oeeMetrics.availability} className="h-2" />
                          <p className="text-xs text-gray-600">
                            Downtime: {oeeMetrics.totalDowntimeHours}h
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Availability</p>
                        <p className="text-xs">Operating Time / Planned Production Time</p>
                        <p className="text-xs mt-1">Measures equipment uptime vs downtime</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-3 cursor-help">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Performance</span>
                            <span className="text-sm text-gray-500">{oeeMetrics.performance}%</span>
                          </div>
                          <Progress value={oeeMetrics.performance} className="h-2" />
                          <p className="text-xs text-gray-600">
                            Impact: {eventCount} events
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Performance</p>
                        <p className="text-xs">Actual Output / Maximum Possible Output</p>
                        <p className="text-xs mt-1">Measures speed losses and minor stoppages</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-3 cursor-help">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Quality</span>
                            <span className="text-sm text-gray-500">{oeeMetrics.quality}%</span>
                          </div>
                          <Progress value={oeeMetrics.quality} className="h-2" />
                          <p className="text-xs text-gray-600">
                            Quality events tracked
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Quality</p>
                        <p className="text-xs">Good Units / Total Units Produced</p>
                        <p className="text-xs mt-1">Measures defects and rework</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-3 cursor-help">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Overall OEE</span>
                            <span className="text-sm text-gray-500">{oeeMetrics.overallOEE}%</span>
                          </div>
                          <Progress value={oeeMetrics.overallOEE} className="h-2" />
                          <p className="text-xs text-gray-600">
                            A × P × Q = {oeeMetrics.overallOEE}%
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Overall Equipment Effectiveness</p>
                        <p className="text-xs">Availability × Performance × Quality</p>
                        <p className="text-xs mt-1">Formula: {oeeMetrics.availability}% × {oeeMetrics.performance}% × {oeeMetrics.quality}% = {oeeMetrics.overallOEE}%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gauge className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Loading OEE metrics...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Drilldown Table Section */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-gray-500 to-slate-500 rounded-lg">
                    <List className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Loss Event Drilldown</CardTitle>
                    <CardDescription>Detailed analysis of individual production loss events</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-sm">
                    {events.length} events
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => exportData()}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export filtered data to CSV</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <LossEventTable
                  tenantId={plantSelection?.tenant?.id || session?.tenant?.id}
                  unitId={selectedUnitId}
                  startDate={startDate}
                  endDate={endDate}
                  lossCategory={selectedCategory}
                  impactCodeId={selectedImpactCodeId}
                  shift={selectedShift}
                  onEventClick={(event) => {
                    setSelectedEvent(event);
                    setShowEventModal(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Event Details Modal */}
          <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-xl">Event Details</span>
                    <p className="text-sm text-gray-500 font-normal">Comprehensive analysis of production loss event</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              {selectedEvent && (
                <div className="space-y-6">
                  {/* Event Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-red-700">Severity</span>
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <Badge className={`${
                          selectedEvent.severity === 'Critical' ? 'bg-red-500' :
                          selectedEvent.severity === 'High' ? 'bg-orange-500' :
                          selectedEvent.severity === 'Medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        } text-white`}>
                          {selectedEvent.severity || 'Medium'}
                        </Badge>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">Duration</span>
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-xl font-bold text-blue-800">
                          {formatDurationSimple(Number(selectedEvent.duration) || 0)}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-700">Cost Impact</span>
                          <DollarSign className="w-4 h-4 text-green-600" />
                        </div>
                        <p className="text-xl font-bold text-green-800">
                          ${selectedEvent.cost ? (selectedEvent.cost / 1000).toFixed(1) + 'K' : '0'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Event Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <FileText className="w-5 h-5" />
                          <span>Event Information</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Event ID</Label>
                          <p className="text-gray-800 font-mono text-sm">{selectedEvent.eventId}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Description</Label>
                          <p className="text-gray-800">{selectedEvent.description || 'No description available'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Start Time</Label>
                            <p className="text-gray-800">{selectedEvent.startTime ? new Date(selectedEvent.startTime).toLocaleString() : 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-600">End Time</Label>
                            <p className="text-gray-800">{selectedEvent.endTime ? new Date(selectedEvent.endTime).toLocaleString() : 'N/A'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Settings className="w-5 h-5" />
                          <span>Operational Details</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Unit</Label>
                            <p className="text-gray-800">{getUnitName(selectedEvent.unitId, units) || 'Unknown Unit'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Asset</Label>
                            <p className="text-gray-800">{getAssetName(selectedEvent.assetId) || 'Unknown Asset'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Loss Category</Label>
                            <Badge variant="outline">{selectedEvent.lossCategory || 'Other'}</Badge>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Status</Label>
                            <Badge className={`${
                              selectedEvent.status === 'Closed' ? 'bg-green-500' :
                              selectedEvent.status === 'Open' ? 'bg-red-500' :
                              'bg-yellow-500'
                            } text-white`}>
                              {selectedEvent.status || 'Open'}
                            </Badge>
                          </div>
                        </div>
                        {selectedEvent.shift && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Shift</Label>
                            <p className="text-gray-800">Shift {selectedEvent.shift}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Additional Information */}
                  {(selectedEvent.operatorName || selectedEvent.quantity || selectedEvent.rcaId) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Info className="w-5 h-5" />
                          <span>Additional Information</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {selectedEvent.operatorName && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Operator</Label>
                            <p className="text-gray-800">{selectedEvent.operatorName}</p>
                          </div>
                        )}
                        {selectedEvent.quantity && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Quantity Lost</Label>
                            <p className="text-gray-800">{selectedEvent.quantity} MT</p>
                          </div>
                        )}
                        {selectedEvent.rcaId && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">RCA Investigation</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/rca?rca=${selectedEvent.rcaId}`, '_blank')}
                              className="mt-1"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              View RCA
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowEventModal(false)}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Close
                    </Button>
                    <Button variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Event
                    </Button>
                    <Button variant="outline">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    {selectedEvent.rcaId && (
                      <Button onClick={() => window.open(`/rca?rca=${selectedEvent.rcaId}`, '_blank')}>
                        <FileText className="w-4 h-4 mr-2" />
                        View RCA
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PLADashboard; 