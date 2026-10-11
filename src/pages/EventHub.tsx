import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { masterDataService, ProductionEvent, ImpactCode, OEECode, Unit, Asset, ReasonCode } from '../services/MasterDataService';
import { auditService } from '../services/AuditService';
import { rcaTriggerConfigService } from '../services/RCATriggerConfigService';
import { RCATriggerConfig, shouldTriggerRCA } from '../types/RCATriggerConfig';
import RCATriggerSettings from '../components/RCATriggerSettings';
import { eventPullService } from '../services/EventPullService';
import { testPIEventPull } from '../utils/test-pi-events';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Plus, Calendar, Clock, DollarSign, Activity, Filter, Upload, X, Factory, Wrench, TrendingDown, Shield, ClipboardList, PackageCheck, Download, FileText, TrendingUp, AlertCircle, Settings, Eye, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { piStore } from '@/services/pi/PIStore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ReasonCodeTreePicker from '../components/reason-codes/ReasonCodeTreePicker';
import EventFormFields from '../components/EventFormFields';
import { AuditTrailViewer } from '../components/AuditTrailViewer';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { PIClient, createTenantPIClient } from '@/services/pi/PIClient';
import { PIHistorianProvider } from '@/services/historian/providers/pi/PIHistorianProvider';
import { TimeSeriesChart } from '@/components/historian/TimeSeriesChart';
import { tabVisibilityService, defaultTabVisibility } from '@/services/TabVisibilityService';
import { TabVisibilitySettings as TabVisibilitySettingsDialog } from '@/components/TabVisibilitySettings';
import { useEventHubLiveRefresh } from '@/features/event-hub/use-event-hub-live-refresh';

// --- Status Automation Config ---
const defaultStatusAutomationRules = [
  {
    id: 'apm-completed',
    eventType: 'APM',
    condition: (event: any) => !!event.recommendedAction,
    status: 'Completed',
    description: 'If recommended action is set, mark APM event as Completed.'
  },
  {
    id: 'failurewo-completed',
    eventType: 'FailureWO',
    condition: (event: any) => !!event.failureMode && !!event.endTime,
    status: 'Completed',
    description: 'If failure mode and end time are set, mark Failure WO as Completed.'
  },
  {
    id: 'endtime-coded',
    eventType: '*',
    condition: (event: any) => !!event.endTime && !["RCA Required", "In Progress", "Completed", "Closed", "Cancelled"].includes(event.status),
    status: 'Coded',
    description: 'If end time is set, mark as Coded (unless already further progressed).'
  },
  {
    id: 'rca-required',
    eventType: '*',
    condition: (event: any) => !!event.rcaId && !["Completed", "Closed", "Cancelled"].includes(event.status),
    status: 'RCA Required',
    description: 'If RCA is linked, mark as RCA Required.'
  }
];

/**
 * v1 status derivation uses only the built-in rules above (plan 3.8: user rules are no longer read from
 * localStorage or compiled in the browser — declarative rules live on the server, v2 Event Hub shows
 * server-derived states).
 */
function useStatusAutomationConfig() {
  return { rules: defaultStatusAutomationRules };
}

export const EventHub: React.FC = () => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [oeeCodes, setOeeCodes] = useState<OEECode[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ProductionEvent | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput'>('ProductionLoss');
  
  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterAsset, setFilterAsset] = useState<string>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [eventForm, setEventForm] = useState<{
    unitId: string;
    assetId: string;
    impactCodeId: string;
    oeeCodeId: string;
    description: string;
    startTime: string;
    endTime: string;
    quantity: string;
    cost: string;
    eventType: 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput';
    parameter?: string;
    solType?: 'Safety' | 'Operational';
    apmType?: 'Health' | 'Prediction' | 'Alert';
    failureMode?: 'Bearing Failure' | 'Seal Leak' | 'Overheating' | 'Electrical Fault';
    limit?: string;
    limitType?: 'High' | 'Low';
    recommendedAction?: string;
    defectiveQuantity?: string;
    planId?: string;
    lossCategory?: string;
    operatorName?: string;
    shift?: string;
    crew?: string;
    reasonCodeId?: string;
    duration?: string;
  }>({
    unitId: '',
    assetId: '',
    impactCodeId: '',
    oeeCodeId: '',
    description: '',
    startTime: '',
    endTime: '',
    quantity: '',
    cost: '',
    eventType: 'ProductionLoss',
    operatorName: session?.user?.name || '',
    shift: '',
    crew: '',
    duration: '',
  });

  // Smart prompts state
  const [operatorPrompt, setOperatorPrompt] = useState<string>('');
  const [shiftPrompt, setShiftPrompt] = useState<string>('');
  const [crewPrompt, setCrewPrompt] = useState<string>('');
  const [showOperatorPrompt, setShowOperatorPrompt] = useState(false);
  const [showShiftPrompt, setShowShiftPrompt] = useState(false);
  const [showCrewPrompt, setShowCrewPrompt] = useState(false);

  // Add state for edit mode and edit form
  const [editMode, setEditMode] = useState(false);
  const [editEventForm, setEditEventForm] = useState<any>(null);
  // Sparkline state for historian context
  const [tsResults, setTsResults] = useState<any[] | null>(null);
  const [tsLoading, setTsLoading] = useState(false);

  // Edit button handler
  function handleEditClick() {
    // Format date fields for datetime-local input
    function formatDateForInput(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      // Pad month, day, hour, minute
      const pad = n => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    setEditEventForm({
      ...selectedEvent,
      startTime: formatDateForInput(selectedEvent.startTime),
      endTime: formatDateForInput(selectedEvent.endTime),
    });
    setEditMode(true);
    // Trigger smart prompts as in create mode
    setTimeout(() => {
      generateOperatorPrompt();
      generateShiftPrompt();
      generateCrewPrompt();
      setShowOperatorPrompt(true);
      setShowShiftPrompt(true);
      setShowCrewPrompt(true);
    }, 100); // Small delay to let form render
  }

  const { rules } = useStatusAutomationConfig();

  // Helper: Determine status based on event type and fields, using config
  function getAutomatedStatus(event: any): string {
    if (["Closed", "Completed", "Cancelled"].includes(event.status)) return event.status;
    for (const rule of rules) {
      if ((rule.eventType === '*' || rule.eventType === event.eventType) && rule.condition(event)) {
        return rule.status;
      }
    }
    return event.status || "Open";
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      // Compute changed fields for audit trail
      const changedFields = Object.keys(editEventForm).filter(key => {
        // Only compare fields that exist on both objects
        return selectedEvent[key] !== undefined && editEventForm[key] !== selectedEvent[key];
      }).map(field => ({
        field,
        oldValue: selectedEvent[field],
        newValue: editEventForm[field],
      }));
      // --- Status Automation ---
      const autoStatus = getAutomatedStatus({ ...selectedEvent, ...editEventForm });
      if (autoStatus !== editEventForm.status) {
        changedFields.push({ field: "status", oldValue: editEventForm.status, newValue: autoStatus });
      }
      // Prepare audit entry
      const auditEntry = {
        timestamp: new Date().toISOString(),
        userId: session.user.id,
        userName: session.user.name,
        changes: changedFields,
      };
      // Append audit entry to auditTrail
      const updatedAuditTrail = [ ...(selectedEvent.auditTrail || []), auditEntry ];
      await masterDataService.updateProductionEvent(selectedEvent.id, {
        ...editEventForm,
        status: autoStatus,
        quantity: editEventForm.quantity ? parseFloat(editEventForm.quantity) : undefined,
        cost: editEventForm.cost ? parseFloat(editEventForm.cost) : undefined,
        tenantId: selectedEvent.tenantId,
        createdAt: selectedEvent.createdAt,
        auditTrail: updatedAuditTrail,
        operatorName: editEventForm.operatorName || session?.user?.name || '',
      });
      await auditService.logAction({
        action: 'UPDATE',
        entityType: 'ProductionEvent',
        entityId: selectedEvent.id,
        details: `Edited event ${selectedEvent.eventId}`,
        userId: session.user.id,
        userName: session.user.name,
        organizationId: session.organization?.id || session.tenant?.organizationId || '',
        tenantId: session.tenant?.id || selectedEvent.tenantId || '',
      });
      setEditMode(false);
      setSelectedEvent(null);
      loadData();
      toast({ title: 'Success', description: 'Event updated.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update event.' });
    }
  }

  // Delete button handler
  async function handleDeleteClick() {
    if (!selectedEvent) return;
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await masterDataService.deleteProductionEvent(selectedEvent.id);
      await auditService.logDelete(
        'ProductionEvent',
        selectedEvent.id,
        selectedEvent.eventId || selectedEvent.description || selectedEvent.id,
        session.user.id,
        session.user.name,
        session.organization?.id || session.tenant?.organizationId || '',
        session.tenant?.id || selectedEvent.tenantId || '',
      );
      setSelectedEvent(null);
      loadData();
      toast({ title: 'Deleted', description: 'Event deleted.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete event.' });
    }
  }

  useEffect(() => {
    loadData();
  }, [session, plantSelection?.tenant?.id]);

  // Real-time refresh: scoped v2 channel behind the v2.eventHub flag, else the v1 broadcast (plan 3.1)
  useEventHubLiveRefresh(Boolean(session), () => loadData(), `${session?.user?.id}|${plantSelection?.tenant?.id}`);

  // Load RCA trigger configuration
  useEffect(() => {
    const loadRCATriggerConfig = async () => {
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
      if (!tenantId) return;

      try {
        console.log('🔄 Loading RCA Trigger Configuration for tenant:', tenantId);
        let config = await rcaTriggerConfigService.getActiveConfig(tenantId);
        
        // Initialize default if none exists
        if (!config) {
          console.log('⚠️ No RCA config found, initializing default...');
          config = await rcaTriggerConfigService.initializeDefaultConfig(
            tenantId,
            session?.organization?.id || '',
            'OilAndGas'
          );
        }
        
        console.log('✅ RCA Trigger Configuration Loaded:', {
          configId: config.id,
          totalRules: config.rules.length,
          enabledRules: config.rules.filter(r => r.enabled).length,
          globalSettings: {
            manualCreationAllowed: config.globalSettings.alwaysAllowManualCreation,
            showWarning: config.globalSettings.showWarningForLowImpact,
            minCost: config.globalSettings.minCostThresholdGlobal,
            minDuration: config.globalSettings.minDurationThresholdGlobal
          }
        });
        
        setRcaTriggerConfig(config);
      } catch (error) {
        console.error('❌ Failed to load RCA trigger config:', error);
      }
    };

    loadRCATriggerConfig();
  }, [session, plantSelection?.tenant?.id]);

  // Auto-fill logic for IOW/SOL
  useEffect(() => {
    if ((eventForm.eventType === 'IOW' || eventForm.eventType === 'SOL') && eventForm.parameter) {
      // Simple demo logic: Pressure/Temperature = High, Flow/Level = Low
      let limit = '';
      let limitType: 'High' | 'Low' = 'High';
      switch (eventForm.parameter) {
        case 'Pressure': limit = '125'; limitType = 'High'; break;
        case 'Temperature': limit = '85'; limitType = 'High'; break;
        case 'Flow': limit = '20'; limitType = 'Low'; break;
        case 'Level': limit = '10'; limitType = 'Low'; break;
        default: limit = ''; limitType = 'High';
      }
      setEventForm(prev => ({ ...prev, limit, limitType }));
    }
  }, [eventForm.eventType, eventForm.parameter]);
  // Auto-fill logic for APM
  useEffect(() => {
    if (eventForm.eventType === 'APM' && eventForm.apmType) {
      let recommendedAction = '';
      switch (eventForm.apmType) {
        case 'Health': recommendedAction = 'Schedule maintenance'; break;
        case 'Prediction': recommendedAction = 'Monitor closely'; break;
        case 'Alert': recommendedAction = 'Immediate inspection'; break;
        default: recommendedAction = '';
      }
      setEventForm(prev => ({ ...prev, recommendedAction }));
    }
  }, [eventForm.eventType, eventForm.apmType]);

  // Add plan selection for ProductionOutput events
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    async function fetchPlans() {
      // Use plant selection tenant if available, otherwise fall back to session tenant
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
      if (!tenantId) return;
      const plansData = await masterDataService.getProductionPlans({ tenantId });
      setPlans(plansData);
    }
    fetchPlans();
  }, [plantSelection?.tenant?.id, session]);

  // 1. Load all products in EventHub state
  const [products, setProducts] = useState([]);
  useEffect(() => {
    async function fetchProducts() {
      if (!session?.organization?.id) return;
      const productsData = await masterDataService.getProducts({ organizationId: session.organization.id });
      setProducts(productsData);
    }
    fetchProducts();
  }, [session]);

  // 2. Add costOverridden to eventForm and editEventForm
  const [costOverridden, setCostOverridden] = useState(false);
  const [editCostOverridden, setEditCostOverridden] = useState(false);

  // 3. Auto-calculate cost for create form
  useEffect(() => {
    if (costOverridden) return;
    let calculatedCost = '';
    let basis = '';
    if ((eventForm.eventType === 'ProductionLoss' || eventForm.eventType === 'ProductionOutput') && eventForm.planId && eventForm.quantity) {
      const plan = plans.find(p => p.id === eventForm.planId);
      const product = plan ? products.find(prod => prod.id === plan.productId) : null;
      if (product) {
        calculatedCost = (parseFloat(eventForm.quantity) * product.standardCost).toFixed(2);
        basis = `Product: ${product.name} ($${product.standardCost}/unit)`;
      }
    }
    if (!calculatedCost && eventForm.impactCodeId) {
      const impact = impactCodes.find(i => i.id === eventForm.impactCodeId);
      if (impact) {
        if (impact.costBasis === 'perUnit' && impact.costPerUnit && eventForm.quantity) {
          calculatedCost = (parseFloat(eventForm.quantity) * impact.costPerUnit).toFixed(2);
          basis = `Impact Code: ${impact.name} ($${impact.costPerUnit}/unit)`;
        } else if (impact.costBasis === 'perHour' && impact.costPerHour) {
          // Use duration if available, else fallback to quantity
          const duration = eventForm.duration ? parseFloat(eventForm.duration) : parseFloat(eventForm.quantity) || 1;
          calculatedCost = (duration * impact.costPerHour).toFixed(2);
          basis = `Impact Code: ${impact.name} ($${impact.costPerHour}/hour)`;
        }
      }
    }
    if (calculatedCost) {
      setEventForm(prev => ({ ...prev, cost: calculatedCost, costBasis: basis }));
    }
  }, [eventForm.planId, eventForm.quantity, eventForm.eventType, eventForm.impactCodeId, eventForm.duration, plans, products, impactCodes, costOverridden]);

  // 4. Auto-calculate cost for edit form
  useEffect(() => {
    if (editCostOverridden) return;
    let calculatedCost = '';
    let basis = '';
    if ((editEventForm?.eventType === 'ProductionLoss' || editEventForm?.eventType === 'ProductionOutput') && editEventForm?.planId && editEventForm?.quantity) {
      const plan = plans.find(p => p.id === editEventForm.planId);
      const product = plan ? products.find(prod => prod.id === plan.productId) : null;
      if (product) {
        calculatedCost = (parseFloat(editEventForm.quantity) * product.standardCost).toFixed(2);
        basis = `Product: ${product.name} ($${product.standardCost}/unit)`;
      }
    }
    if (!calculatedCost && editEventForm?.impactCodeId) {
      const impact = impactCodes.find(i => i.id === editEventForm.impactCodeId);
      if (impact) {
        if (impact.costBasis === 'perUnit' && impact.costPerUnit && editEventForm.quantity) {
          calculatedCost = (parseFloat(editEventForm.quantity) * impact.costPerUnit).toFixed(2);
          basis = `Impact Code: ${impact.name} ($${impact.costPerUnit}/unit)`;
        } else if (impact.costBasis === 'perHour' && impact.costPerHour) {
          const duration = editEventForm.duration ? parseFloat(editEventForm.duration) : parseFloat(editEventForm.quantity) || 1;
          calculatedCost = (duration * impact.costPerHour).toFixed(2);
          basis = `Impact Code: ${impact.name} ($${impact.costPerHour}/hour)`;
        }
      }
    }
    if (calculatedCost) {
      setEditEventForm(prev => ({ ...prev, cost: calculatedCost, costBasis: basis }));
    }
  }, [editEventForm?.planId, editEventForm?.quantity, editEventForm?.eventType, editEventForm?.impactCodeId, editEventForm?.duration, plans, products, impactCodes, editCostOverridden]);

  // 5. In the cost input fields (create and edit), onChange should set costOverridden/editCostOverridden to true if user types, and to false if cleared
  // In the cost input's onChange handler:
  // onChange={e => { setEventForm({ ...eventForm, cost: e.target.value }); setCostOverridden(e.target.value !== ''); }}
  // onChange={e => { setEditEventForm({ ...editEventForm, cost: e.target.value }); setEditCostOverridden(e.target.value !== ''); }}

  // Smart prompt functions
  const generateOperatorPrompt = () => {
    const currentHour = new Date().getHours();
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (currentHour >= 6 && currentHour < 14) {
      setOperatorPrompt(`💡 It's currently ${currentTime}. Based on typical day shift patterns, you might be working with the Day Shift team.`);
      setShowOperatorPrompt(true);
    } else if (currentHour >= 14 && currentHour < 22) {
      setOperatorPrompt(`💡 It's currently ${currentTime}. Based on typical swing shift patterns, you might be working with the Swing Shift team.`);
      setShowOperatorPrompt(true);
    } else {
      setOperatorPrompt(`💡 It's currently ${currentTime}. Based on typical night shift patterns, you might be working with the Night Shift team.`);
      setShowOperatorPrompt(true);
    }
  };

  const generateShiftPrompt = () => {
    const currentHour = new Date().getHours();
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (currentHour >= 6 && currentHour < 14) {
      setShiftPrompt(`🌅 It's currently ${currentTime}. This appears to be Day Shift hours (6 AM - 2 PM).`);
      setShowShiftPrompt(true);
    } else if (currentHour >= 14 && currentHour < 22) {
      setShiftPrompt(`🌆 It's currently ${currentTime}. This appears to be Swing Shift hours (2 PM - 10 PM).`);
      setShowShiftPrompt(true);
    } else {
      setShiftPrompt(`🌙 It's currently ${currentTime}. This appears to be Night Shift hours (10 PM - 6 AM).`);
      setShowShiftPrompt(true);
    }
  };

  const generateCrewPrompt = () => {
    const crews = ['Alpha Crew', 'Bravo Crew', 'Charlie Crew', 'Delta Crew'];
    const randomCrew = crews[Math.floor(Math.random() * crews.length)];
    setCrewPrompt(`👥 Recent events show ${randomCrew} is active on this unit. Consider if this applies to your event.`);
    setShowCrewPrompt(true);
  };

  // Auto-generate prompts when form opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      setTimeout(() => {
        generateOperatorPrompt();
        generateShiftPrompt();
        generateCrewPrompt();
      }, 500); // Small delay to let form render
    } else {
      setShowOperatorPrompt(false);
      setShowShiftPrompt(false);
      setShowCrewPrompt(false);
    }
  }, [isCreateDialogOpen]);

  const loadData = async () => {
    if (!session) return;
    
    // Use plant selection tenant if available, otherwise fall back to session tenant
    const tenantId = plantSelection?.tenant?.id || session.tenant?.id;

    try {
      const [eventsData, impactsData, oeeData, unitsData, assetsData] = await Promise.all([
        masterDataService.getProductionEvents({ tenantId }),
        masterDataService.getImpactCodes({ tenantId }),
        masterDataService.getOEECodes({ tenantId }),
        masterDataService.getUnits(),
        masterDataService.getAssets({ tenantId })
      ]);

      setEvents(eventsData);
      setImpactCodes(impactsData);
      setOeeCodes(oeeData);
      setUnits(unitsData);
      setAssets(assetsData);
    } catch (error) {
      console.error('Failed to load event data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load production events',
        variant: 'destructive',
      });
    }
  };

  const simulateEvents = async () => {
    if (!session?.tenant?.id) return;

    try {
      await masterDataService.simulateProductionEvents(
        units.length > 0 ? units[0].id : '', // Simulate for the first unit by default
        10,
        session.tenant.id // Always use the current tenant's ID
      );
      toast({
        title: 'Success',
        description: '10 simulated production events created',
      });
      loadData();
    } catch (error) {
      console.error('Failed to simulate events:', error);
      toast({
        title: 'Error',
        description: 'Failed to simulate production events',
        variant: 'destructive',
      });
    }
  };

  const pullEventsFromPI = async () => {
    if (!session?.tenant?.id) {
      toast({
        title: 'Error',
        description: 'No tenant selected',
        variant: 'destructive',
      });
      return;
    }

    const tenantId = plantSelection?.tenant?.id || session.tenant.id;

    try {
      toast({
        title: 'Pulling Events',
        description: 'Pulling events from PI system...',
      });

      const result = await testPIEventPull(tenantId);

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload events to show the newly pulled ones
        loadData();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Failed to pull events from PI:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to pull events from PI',
        variant: 'destructive',
      });
    }
  };

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [showReasonCodeModal, setShowReasonCodeModal] = useState(false);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [selectedReasonCode, setSelectedReasonCode] = useState<ReasonCode | null>(null);

  useEffect(() => {
    if (isCreateDialogOpen && session?.tenant?.id) {
      masterDataService.getReasonCodes({ tenantId: session.tenant.id }).then(setReasonCodes);
    }
  }, [isCreateDialogOpen, session]);

  // Add this useEffect to always load reason codes when the reason code modal is opened
  useEffect(() => {
    if (showReasonCodeModal && session?.tenant?.id) {
      masterDataService.getReasonCodes({ tenantId: session.tenant.id }).then(setReasonCodes);
    }
  }, [showReasonCodeModal, session]);

  function validateEventForm() {
    const errors: string[] = [];
    if (!eventForm.unitId) errors.push('Unit is required.');
    if (!eventForm.description) errors.push('Description is required.');
    if (!eventForm.startTime) errors.push('Start time is required.');
    if (eventForm.eventType === 'ProductionLoss') {
      if (!eventForm.impactCodeId) errors.push('Impact code is required.');
      if (!eventForm.oeeCodeId) errors.push('OEE code is required.');
      if (!eventForm.quantity) errors.push('Quantity lost is required.');
      if (!eventForm.lossCategory) errors.push('Loss type/category is required.');
      if (!eventForm.reasonCodeId) errors.push('Reason code is required.');
    }
    if (eventForm.eventType === 'IOW' || eventForm.eventType === 'SOL') {
      if (!eventForm.parameter) errors.push('Parameter is required.');
      if (!eventForm.limit) errors.push('Limit is required.');
      if (!eventForm.limitType) errors.push('Limit type is required.');
    }
    if (eventForm.eventType === 'SOL') {
      if (!eventForm.solType) errors.push('SOL type is required.');
    }
    if (eventForm.eventType === 'APM') {
      if (!eventForm.apmType) errors.push('APM type is required.');
      if (!eventForm.recommendedAction) errors.push('Recommended action is required.');
    }
    if (eventForm.eventType === 'FailureWO') {
      if (!eventForm.failureMode) errors.push('Failure mode is required.');
    }
    if (eventForm.eventType === 'ProductionOutput') {
      // Plan is now optional for unmapped event support
      // if (!eventForm.planId) errors.push('Production plan is required.');
      if (!eventForm.unitId) errors.push('Production unit is required.');
      if (!eventForm.description) errors.push('Description is required.');
      if (!eventForm.startTime) errors.push('Start time is required.');
      if (!eventForm.quantity) errors.push('Quantity produced is required.');
      if (!eventForm.operatorName) errors.push('Operator/Recorder is required.');
      if (!eventForm.shift) errors.push('Shift is required.');
      if (!eventForm.crew) errors.push('Crew is required.');
      // defectiveQuantity is optional
    }
    return errors;
  }

  const createEvent = async () => {
    if (!session) return;
    const errors = validateEventForm();
    setFormErrors(errors);
    if (errors.length > 0) return;

    try {
      await masterDataService.createProductionEvent({
        eventId: `MAN-${Date.now()}`,
        unitId: eventForm.unitId,
        assetId: eventForm.assetId || undefined,
        impactCodeId: eventForm.impactCodeId,
        oeeCodeId: eventForm.oeeCodeId,
        description: eventForm.description,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime || undefined,
        source: 'Manual',
        quantity: eventForm.quantity ? parseFloat(eventForm.quantity) : undefined,
        cost: eventForm.cost ? parseFloat(eventForm.cost) : undefined,
        status: 'Open',
        tenantId: session.tenant?.id || '',
        eventType: eventForm.eventType,
        planId: eventForm.eventType === 'ProductionOutput' ? eventForm.planId : undefined,
        parameter: eventForm.parameter,
        solType: eventForm.solType,
        apmType: eventForm.apmType,
        failureMode: eventForm.failureMode,
        limit: eventForm.limit ? parseFloat(eventForm.limit) : undefined,
        limitType: eventForm.limitType,
        recommendedAction: eventForm.recommendedAction,
        defectiveQuantity: eventForm.defectiveQuantity ? parseFloat(eventForm.defectiveQuantity) : undefined,
        lossCategory: eventForm.lossCategory,
        operatorName: eventForm.operatorName || session?.user?.name || '',
        shift: eventForm.shift || '',
        crew: eventForm.crew || '',
        reasonCodeId: eventForm.reasonCodeId,
      });

      toast({
        title: 'Success',
        description: 'Production event created successfully',
      });

      setIsCreateDialogOpen(false);
      setEventForm({
        unitId: '',
        assetId: '',
        impactCodeId: '',
        oeeCodeId: '',
        description: '',
        startTime: '',
        endTime: '',
        quantity: '',
        cost: '',
        eventType: 'ProductionLoss',
        operatorName: session?.user?.name || '',
        shift: '',
        crew: '',
        reasonCodeId: '',
        duration: '',
      });
      loadData();
    } catch (error) {
      console.error('Failed to create event:', error);
      toast({
        title: 'Error',
        description: 'Failed to create production event',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-red-100 text-red-800';
      case 'Coded': return 'bg-yellow-100 text-yellow-800';
      case 'RCA Required': return 'bg-orange-100 text-orange-800';
      case 'Closed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactCodeName = (id: string) => {
    const impact = impactCodes.find(i => i.id === id);
    return impact ? `${impact.code} - ${impact.name}` : 'Unknown';
  };

  const getOEECodeName = (id: string) => {
    const oee = oeeCodes.find(o => o.id === id);
    return oee ? `${oee.code} - ${oee.name}` : 'Unknown';
  };

  const getUnitName = (id: string) => {
    const unit = units.find(u => u.id === id);
    return unit ? unit.name : 'Unknown Unit';
  };

  const [sourceFilter, setSourceFilter] = useState<'all'|'Manual'|'Simulated PI'|'PI'|'CMMS'>('all');
  const [piTemplates, setPiTemplates] = useState<string[]>([]);
  const [selectedPiTemplate, setSelectedPiTemplate] = useState<string>('all');
  const [efIdToTemplate, setEfIdToTemplate] = useState<Record<string, string>>({});
  const [piBaseUrl, setPiBaseUrl] = useState<string>('');
  
  // RCA Trigger Configuration
  const [rcaTriggerConfig, setRcaTriggerConfig] = useState<RCATriggerConfig | null>(null);
  const [showRCATriggerSettings, setShowRCATriggerSettings] = useState(false);
  
  // Tab Visibility Settings
  const [visibleTabs, setVisibleTabs] = useState(defaultTabVisibility);
  const [showTabVisibilitySettings, setShowTabVisibilitySettings] = useState(false);
  // Apply all filters in sequence
  const filteredByStatus = filterStatus === 'all' 
    ? events 
    : events.filter(event => event.status === filterStatus);
  
  const filteredBySource = sourceFilter === 'all'
    ? filteredByStatus
    : filteredByStatus.filter(event => event.source === sourceFilter);
  
  const filteredByTemplate = selectedPiTemplate === 'all'
    ? filteredBySource
    : filteredBySource.filter(event => {
        if (event.source !== 'PI') return false;
        const tpl = efIdToTemplate[event.eventId];
        return tpl === selectedPiTemplate;
      });
  
  // Apply advanced filters
  const filteredBySearch = !searchQuery
    ? filteredByTemplate
    : filteredByTemplate.filter(event => 
        event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.eventId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.assetId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  
  const filteredBySeverity = filterSeverity === 'all'
    ? filteredBySearch
    : filteredBySearch.filter(event => event.severity === filterSeverity);
  
  const filteredByUnit = filterUnit === 'all'
    ? filteredBySeverity
    : filteredBySeverity.filter(event => event.unitId === filterUnit);
  
  const filteredByAsset = filterAsset === 'all'
    ? filteredByUnit
    : filteredByUnit.filter(event => event.assetId === filterAsset);
  
  const filteredByShift = filterShift === 'all'
    ? filteredByAsset
    : filteredByAsset.filter(event => event.shift === filterShift);
  
  const filteredByDate = filteredByShift.filter(event => {
    if (!filterDateFrom && !filterDateTo) return true;
    if (!event.startTime) return false;
    const eventDate = new Date(event.startTime);
    if (filterDateFrom && eventDate < new Date(filterDateFrom)) return false;
    if (filterDateTo && eventDate > new Date(filterDateTo)) return false;
    return true;
  });
  
  // Filter events by visible tabs
  const visibleTabsArray = Object.entries(visibleTabs)
    .filter(([_, isVisible]) => isVisible)
    .map(([tabName, _]) => tabName);
  
  const filteredByVisibleTabs = filteredByDate.filter(event => 
    visibleTabsArray.includes(event.eventType)
  );
  
  // Filter events by eventType for the active tab
  const tabEvents = filteredByDate.filter(event => event.eventType === activeTab);
  
  // Calculate event counts by type for badges (using all filtered events, not just visible tabs)
  const eventCounts = {
    ProductionLoss: filteredByDate.filter(e => e.eventType === 'ProductionLoss').length,
    IOW: filteredByDate.filter(e => e.eventType === 'IOW').length,
    SOL: filteredByDate.filter(e => e.eventType === 'SOL').length,
    APM: filteredByDate.filter(e => e.eventType === 'APM').length,
    FailureWO: filteredByDate.filter(e => e.eventType === 'FailureWO').length,
    ProductionOutput: filteredByDate.filter(e => e.eventType === 'ProductionOutput').length,
  };
  
  // Calculate quick stats (using only visible tabs)
  const quickStats = {
    totalEvents: filteredByVisibleTabs.length,
    openEvents: filteredByVisibleTabs.filter(e => e.status === 'Open').length,
    totalCost: filteredByVisibleTabs.reduce((sum, e) => sum + (e.cost || 0), 0),
    totalDowntime: filteredByVisibleTabs.reduce((sum, e) => sum + (e.duration || 0), 0),
    criticalEvents: filteredByVisibleTabs.filter(e => e.severity === 'Critical').length,
  };
  
  // Count active filters
  const activeFilterCount = [
    searchQuery,
    filterSeverity !== 'all',
    filterUnit !== 'all',
    filterAsset !== 'all',
    filterShift !== 'all',
    filterDateFrom,
    filterDateTo
  ].filter(Boolean).length;
  
  // Export to CSV function
  const exportToCSV = () => {
    const headers = ['Event Type', 'Description', 'Unit', 'Asset', 'Status', 'Severity', 'Start Time', 'End Time', 'Duration (min)', 'Cost ($)', 'Impact Code', 'OEE Code'];
    const rows = tabEvents.map(event => [
      event.eventType,
      event.description || '',
      units.find(u => u.id === event.unitId)?.name || '',
      assets.find(a => a.id === event.assetId)?.name || '',
      event.status || '',
      event.severity || '',
      event.startTime || '',
      event.endTime || '',
      event.duration || '',
      event.cost || '',
      impactCodes.find(c => c.id === event.impactCodeId)?.name || '',
      oeeCodes.find(c => c.id === event.oeeCodeId)?.name || '',
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Success', description: `Exported ${tabEvents.length} events to CSV` });
  };
  
  // Check if RCA button should be shown for an event
  const shouldShowRCAButton = (event: ProductionEvent): { shouldShow: boolean; reason: string; warning?: string } => {
    if (!rcaTriggerConfig) {
      // Fallback to basic logic if no config
      console.warn('⚠️ No RCA config loaded, using fallback logic for event:', event.id?.substring(0, 8));
      return {
        shouldShow: event.status === 'Open' || event.severity === 'Critical' || event.severity === 'High',
        reason: 'No configuration loaded - using basic criteria'
      };
    }
    
    // Use the configuration service to evaluate
    const result = shouldTriggerRCA(event, rcaTriggerConfig);
    
    // Log ALL evaluations for debugging (you can comment this out later)
    console.log(`🔍 RCA Check [${event.id?.substring(0, 8)}]:`, {
      type: event.eventType,
      severity: event.severity,
      status: event.status,
      cost: event.cost,
      duration: event.duration,
      manualAllowed: rcaTriggerConfig.globalSettings.alwaysAllowManualCreation,
      shouldShow: result.shouldShow,
      reason: result.reason,
      warning: result.warning || 'none'
    });
    
    return result;
  };

  if (!session) return null;

  // Debug: Print all loaded impact codes to the console
  useEffect(() => {
    if (impactCodes.length > 0) {
      console.log('Loaded Impact Codes:', impactCodes);
    }
  }, [impactCodes]);

  // Load PI templates and base URL for current tenant
  useEffect(() => {
    (async () => {
      try {
        if (!session?.tenant?.id) return;
        const tenantId = session.tenant.id;
        const tplInfo = await piStore.getTemplatesForTenant(tenantId);
        setPiTemplates(['all', ...tplInfo.templates]);
        setEfIdToTemplate(tplInfo.efIdToTemplate);
        const conn = await piStore.getConnectionByTenant(tenantId);
        setPiBaseUrl(conn?.baseUrl || '');
      } catch (e) {
        // ignore
      }
    })();
  }, [session]);

  // Add state for showing the audit trail modal
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Load tab visibility settings
  useEffect(() => {
    const loadTabVisibilitySettings = async () => {
      if (!session?.user?.id || !session?.tenant?.id) return;
      
      try {
        const settings = await tabVisibilityService.getVisibilitySettings(
          session.user.id,
          session.tenant.id
        );
        setVisibleTabs(settings.visibleTabs);
        
        // If current active tab is hidden, switch to first visible tab
        if (!settings.visibleTabs[activeTab]) {
          const firstVisibleTab = Object.entries(settings.visibleTabs).find(
            ([_, visible]) => visible
          )?.[0] as typeof activeTab | undefined;
          
          if (firstVisibleTab) {
            setActiveTab(firstVisibleTab);
          }
        }
      } catch (error) {
        console.error('Failed to load tab visibility settings:', error);
      }
    };

    loadTabVisibilitySettings();
  }, [session?.user?.id, session?.tenant?.id]);

  // Handle tab visibility toggle
  const handleToggleTab = async (
    tabName: keyof typeof defaultTabVisibility,
    visible: boolean
  ) => {
    if (!session?.user?.id || !session?.tenant?.id) return;

    try {
      await tabVisibilityService.toggleTab(
        session.user.id,
        session.tenant.id,
        tabName,
        visible
      );
      
      const updatedSettings = await tabVisibilityService.getVisibilitySettings(
        session.user.id,
        session.tenant.id
      );
      setVisibleTabs(updatedSettings.visibleTabs);

      // If we just hid the active tab, switch to first visible tab
      if (!visible && activeTab === tabName) {
        const firstVisibleTab = Object.entries(updatedSettings.visibleTabs).find(
          ([key, isVisible]) => isVisible && key !== tabName
        )?.[0] as typeof activeTab | undefined;
        
        if (firstVisibleTab) {
          setActiveTab(firstVisibleTab);
        }
      }
    } catch (error) {
      console.error('Failed to toggle tab visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tab visibility settings',
        variant: 'destructive',
      });
    }
  };

  // Handle reset tab visibility to defaults
  const handleResetTabVisibility = async () => {
    if (!session?.user?.id || !session?.tenant?.id) return;

    try {
      await tabVisibilityService.resetToDefaults(
        session.user.id,
        session.tenant.id
      );
      setVisibleTabs(defaultTabVisibility);
      toast({
        title: 'Success',
        description: 'Tab visibility reset to defaults',
      });
    } catch (error) {
      console.error('Failed to reset tab visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset tab visibility settings',
        variant: 'destructive',
      });
    }
  };

  return (
    <div >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Event Hub</h2>
          <p className="text-muted-foreground">
            Production loss events and monitoring
          </p>
        </div>
        <div className="flex space-x-2 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600">Source</Label>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="PI">PI</SelectItem>
                <SelectItem value="Simulated PI">Simulated PI</SelectItem>
                <SelectItem value="CMMS">CMMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sourceFilter === 'PI' && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-600">PI Template</Label>
              <Select value={selectedPiTemplate} onValueChange={(v) => setSelectedPiTemplate(v)}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="All templates" /></SelectTrigger>
                <SelectContent>
                  {piTemplates.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={() => setShowRCATriggerSettings(true)} variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            RCA Settings
          </Button>
          
          <Button onClick={() => setShowTabVisibilitySettings(true)} variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            Tab Settings
          </Button>
          
          <Button onClick={pullEventsFromPI} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Pull from PI
          </Button>
          
          <Button onClick={simulateEvents} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Simulate Events
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ErrorBoundary>
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eventType">Event Type</Label>
                  <Select value={eventForm.eventType} onValueChange={(value) => setEventForm({ ...eventForm, eventType: value as 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ProductionLoss">Production Loss</SelectItem>
                      <SelectItem value="IOW">IOW</SelectItem>
                      <SelectItem value="SOL">SOL</SelectItem>
                      <SelectItem value="APM">APM Events</SelectItem>
                      <SelectItem value="FailureWO">Failure WOs</SelectItem>
                      <SelectItem value="ProductionOutput">Production Output</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Show/hide fields based on eventForm.eventType */}
                {eventForm.eventType === 'ProductionLoss' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Production Unit</Label>
                      <Select value={eventForm.unitId} onValueChange={(value) => setEventForm({ ...eventForm, unitId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="asset">Asset (Optional)</Label>
                      <Select value={eventForm.assetId} onValueChange={(value) => setEventForm({ ...eventForm, assetId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="impactCodeId">Impact Code <span title="Required for OEE calculation. Choose the code that best describes the event's impact (Availability, Performance, or Quality)." className="text-blue-600 cursor-help">🛈</span></Label>
                      <Select value={eventForm.impactCodeId} onValueChange={value => setEventForm({ ...eventForm, impactCodeId: value })} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select impact code" />
                        </SelectTrigger>
                        <SelectContent>
                          {impactCodes.map(code => (
                            <SelectItem key={code.id} value={code.id}>{code.code} - {code.name} ({code.category})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="oeeCodeId">OEE Code <span title="Required for OEE calculation. Choose the code that best describes the OEE impact (Availability, Performance, or Quality)." className="text-blue-600 cursor-help">🛈</span></Label>
                      <Select value={eventForm.oeeCodeId} onValueChange={value => setEventForm({ ...eventForm, oeeCodeId: value })} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select OEE code" />
                        </SelectTrigger>
                        <SelectContent>
                          {oeeCodes.map(code => (
                            <SelectItem key={code.id} value={code.id}>{code.code} - {code.name} ({code.impactType})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={eventForm.startTime}
                        onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time (Optional)</Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={eventForm.endTime}
                        onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity Lost</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="0"
                        value={eventForm.quantity}
                        onChange={(e) => setEventForm({ ...eventForm, quantity: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cost">Estimated Cost ($)</Label>
                      <Input
                        id="cost"
                        type="number"
                        placeholder="0"
                        value={eventForm.cost}
                        onChange={(e) => { setEventForm({ ...eventForm, cost: e.target.value }); setCostOverridden(e.target.value !== ''); }}
                      />
                    </div>
                    
                    {/* Loss Type/Category Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="lossCategory">Loss Type/Category</Label>
                      <Select value={eventForm.lossCategory || ''} onValueChange={value => setEventForm({ ...eventForm, lossCategory: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select loss type/category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Downtime">Downtime</SelectItem>
                          <SelectItem value="Breakdown">Breakdown</SelectItem>
                          <SelectItem value="Setup">Setup</SelectItem>
                          <SelectItem value="Changeover">Changeover</SelectItem>
                          <SelectItem value="Minor Stoppage">Minor Stoppage</SelectItem>
                          <SelectItem value="Reduced Speed">Reduced Speed</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reasonCode">Reason Code (ISA-95)</Label>
                      <div className="flex gap-2 items-center">
                        <Button type="button" variant="outline" onClick={() => setShowReasonCodeModal(true)}>
                          {selectedReasonCode ? `${selectedReasonCode.code} - ${selectedReasonCode.name}` : 'Select Reason Code'}
                        </Button>
                        {selectedReasonCode && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => { setSelectedReasonCode(null); setEventForm({ ...eventForm, reasonCodeId: '' }); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <ReasonCodeTreePicker
                        open={showReasonCodeModal}
                        onOpenChange={setShowReasonCodeModal}
                        reasonCodes={reasonCodes}
                        value={eventForm.reasonCodeId || ''}
                        onSelect={rc => {
                          setSelectedReasonCode(rc);
                          setEventForm({ ...eventForm, reasonCodeId: rc?.id || '' });
                          setShowReasonCodeModal(false);
                        }}
                      />
                    </div>
                    
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe the production loss event..."
                        value={eventForm.description}
                        onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {['IOW', 'SOL'].includes(eventForm.eventType) && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="parameter">Parameter</Label>
                      <Select value={eventForm.parameter || ''} onValueChange={(value) => setEventForm({ ...eventForm, parameter: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parameter" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Pressure', 'Temperature', 'Flow', 'Level'].map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">What process parameter was breached?</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limit">Limit</Label>
                      <Input
                        id="limit"
                        type="text"
                        value={eventForm.limit || ''}
                        onChange={e => setEventForm({ ...eventForm, limit: e.target.value })}
                      />
                      <p className="text-xs text-gray-500">Auto-filled based on parameter, can be overridden.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limitType">Limit Type</Label>
                      <Select value={eventForm.limitType || ''} onValueChange={value => setEventForm({ ...eventForm, limitType: value as 'High' | 'Low' })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select limit type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">Auto-filled based on parameter, can be overridden.</p>
                    </div>
                  </>
                )}
                {['IOW', 'SOL', 'APM', 'FailureWO'].includes(eventForm.eventType) && (
                  <div className="space-y-2">
                    <Label htmlFor="parameter">Parameter</Label>
                    <Select value={eventForm.parameter || ''} onValueChange={(value) => setEventForm({ ...eventForm, parameter: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Pressure', 'Temperature', 'Flow', 'Level'].map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">What process parameter was breached?</p>
                  </div>
                )}
                {eventForm.eventType === 'SOL' && (
                  <div className="space-y-2">
                    <Label htmlFor="solType">SOL Type</Label>
                    <Select value={eventForm.solType || ''} onValueChange={(value) => setEventForm({ ...eventForm, solType: value as 'Safety' | 'Operational' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select SOL type" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Safety', 'Operational'].map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Is this a Safety or Operational limit?</p>
                  </div>
                )}
                {eventForm.eventType === 'APM' && (
                  <div className="space-y-2">
                    <Label htmlFor="apmType">APM Type</Label>
                    <Select value={eventForm.apmType || ''} onValueChange={(value) => setEventForm({ ...eventForm, apmType: value as 'Health' | 'Prediction' | 'Alert' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select APM type" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Health', 'Prediction', 'Alert'].map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">What type of APM event is this?</p>
                  </div>
                )}
                {eventForm.eventType === 'FailureWO' && (
                  <div className="space-y-2">
                    <Label htmlFor="failureMode">Failure Mode</Label>
                    <Select value={eventForm.failureMode || ''} onValueChange={(value) => setEventForm({ ...eventForm, failureMode: value as 'Bearing Failure' | 'Seal Leak' | 'Overheating' | 'Electrical Fault' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select failure mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Bearing Failure', 'Seal Leak', 'Overheating', 'Electrical Fault'].map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">What was the failure mode?</p>
                  </div>
                )}
                {eventForm.eventType === 'APM' && (
                  <div className="space-y-2">
                    <Label htmlFor="recommendedAction">Recommended Action</Label>
                    <Input
                      id="recommendedAction"
                      type="text"
                      value={eventForm.recommendedAction || ''}
                      onChange={e => setEventForm({ ...eventForm, recommendedAction: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Auto-filled based on APM type, can be overridden.</p>
                  </div>
                )}
                {/* For quality events, show defectiveQuantity input */}
                {(() => {
                  const impact = impactCodes.find(c => c.id === eventForm.impactCodeId);
                  const oee = oeeCodes.find(c => c.id === eventForm.oeeCodeId);
                  const isQuality = impact?.category === 'Quality' || oee?.impactType === 'Quality';
                  if (isQuality) {
                    return (
                      <div className="space-y-2">
                        <Label htmlFor="defectiveQuantity">Defective Quantity <span title="Number of defective units for this event. Used for OEE Quality calculation." className="text-blue-600 cursor-help">🛈</span></Label>
                        <Input
                          id="defectiveQuantity"
                          type="number"
                          placeholder="0"
                          value={eventForm.defectiveQuantity || ''}
                          onChange={e => setEventForm({ ...eventForm, defectiveQuantity: e.target.value })}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
                {eventForm.eventType === 'ProductionOutput' && (
                  <>
                    {/* Production Unit */}
                    <div className="space-y-2">
                      <Label htmlFor="unitId">Production Unit</Label>
                      <Select value={eventForm.unitId || ''} onValueChange={value => setEventForm({ ...eventForm, unitId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        type="text"
                        value={eventForm.description || ''}
                        onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                        placeholder="Describe this production event"
                      />
                    </div>
                    {/* Start Time */}
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={eventForm.startTime || ''}
                        onChange={e => setEventForm({ ...eventForm, startTime: e.target.value })}
                      />
                    </div>
                    {/* End Time (optional) */}
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time <span className="text-xs text-gray-400">(optional)</span></Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={eventForm.endTime || ''}
                        onChange={e => setEventForm({ ...eventForm, endTime: e.target.value })}
                      />
                    </div>
                    {/* Quantity Produced */}
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity Produced</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="0"
                        value={eventForm.quantity || ''}
                        onChange={e => setEventForm({ ...eventForm, quantity: e.target.value })}
                      />
                    </div>
                    {/* Production Plan */}
                    <div className="space-y-2">
                      <Label htmlFor="planId">Production Plan</Label>
                      <Select value={eventForm.planId || ''} onValueChange={(value) => setEventForm({ ...eventForm, planId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-gray-500" aria-disabled="true">No plans available</div>
                          )}
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {plans.length === 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          No active production plan found for this unit. This event will be created as <b>unmapped</b> and can be assigned to a plan later from the dashboard.
                        </div>
                      )}
                    </div>
                    {/* Defective Quantity for ProductionOutput */}
                    <div className="space-y-2">
                      <Label htmlFor="defectiveQuantity">Defective Quantity <span title="Number of defective units for this event. Used for OEE Quality calculation." className="text-blue-600 cursor-help">🛈</span></Label>
                      <Input
                        id="defectiveQuantity"
                        type="number"
                        placeholder="0"
                        value={eventForm.defectiveQuantity || ''}
                        onChange={e => setEventForm({ ...eventForm, defectiveQuantity: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {/* Operator/Recorder field with Smart Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="operator">Operator/Recorder</Label>
                  <Input
                    id="operator"
                    type="text"
                    value={eventForm.operatorName || ''}
                    onChange={e => setEventForm({ ...eventForm, operatorName: e.target.value })}
                    placeholder="Operator name"
                    className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {showOperatorPrompt && (
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg shadow-sm">
                      <div className="flex items-start space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center text-blue-700 text-xs font-bold">
                          💡
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-blue-800 font-medium mb-1">Smart Operator Suggestion</p>
                          <p className="text-xs text-blue-700">{operatorPrompt}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                const currentHour = new Date().getHours();
                                if (currentHour >= 6 && currentHour < 14) {
                                  setEventForm(prev => ({ ...prev, operatorName: 'Day Shift Operator' }));
                                } else if (currentHour >= 14 && currentHour < 22) {
                                  setEventForm(prev => ({ ...prev, operatorName: 'Swing Shift Operator' }));
                                } else {
                                  setEventForm(prev => ({ ...prev, operatorName: 'Night Shift Operator' }));
                                }
                                setShowOperatorPrompt(false);
                              }}
                            >
                              Apply Suggestion
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-blue-600 hover:text-blue-800"
                              onClick={() => setShowOperatorPrompt(false)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shift field with Smart Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="shift">Shift</Label>
                  <Select value={eventForm.shift || ''} onValueChange={value => setEventForm({ ...eventForm, shift: value })}>
                    <SelectTrigger className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Night">Night</SelectItem>
                      <SelectItem value="Swing">Swing</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {showShiftPrompt && (
                    <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg shadow-sm">
                      <div className="flex items-start space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-200 to-orange-200 flex items-center justify-center text-yellow-700 text-xs font-bold">
                          🌅
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-yellow-800 font-medium mb-1">Shift Time Detection</p>
                          <p className="text-xs text-yellow-700">{shiftPrompt}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                              onClick={() => {
                                const currentHour = new Date().getHours();
                                if (currentHour >= 6 && currentHour < 14) {
                                  setEventForm(prev => ({ ...prev, shift: 'Day' }));
                                } else if (currentHour >= 14 && currentHour < 22) {
                                  setEventForm(prev => ({ ...prev, shift: 'Swing' }));
                                } else {
                                  setEventForm(prev => ({ ...prev, shift: 'Night' }));
                                }
                                setShowShiftPrompt(false);
                              }}
                            >
                              Apply Shift
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-yellow-600 hover:text-yellow-800"
                              onClick={() => setShowShiftPrompt(false)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Crew field with Smart Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="crew">Crew</Label>
                  <Input
                    id="crew"
                    type="text"
                    value={eventForm.crew || ''}
                    onChange={e => setEventForm({ ...eventForm, crew: e.target.value })}
                    placeholder="Crew name or code"
                    className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {showCrewPrompt && (
                    <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg shadow-sm">
                      <div className="flex items-start space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center text-green-700 text-xs font-bold">
                          👥
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-green-800 font-medium mb-1">Crew Activity Suggestion</p>
                          <p className="text-xs text-green-700">{crewPrompt}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs bg-white border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => {
                                const crews = ['Alpha Crew', 'Bravo Crew', 'Charlie Crew', 'Delta Crew'];
                                const randomCrew = crews[Math.floor(Math.random() * crews.length)];
                                setEventForm(prev => ({ ...prev, crew: randomCrew }));
                                setShowCrewPrompt(false);
                              }}
                            >
                              Apply Crew
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-green-600 hover:text-green-800"
                              onClick={() => setShowCrewPrompt(false)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {formErrors.length > 0 && (
                <div className="mb-2 p-2 bg-red-100 text-red-700 rounded">
                  {formErrors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createEvent}>
                  Create Event
                </Button>
              </div>
              </ErrorBoundary>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 1. Add analytics summary widget above the tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { status: 'Open', icon: <Clock className="w-4 h-4 mr-1 text-red-500" /> },
          { status: 'RCA Required', icon: <Activity className="w-4 h-4 mr-1 text-orange-500" /> },
          { status: 'Closed', icon: <PackageCheck className="w-4 h-4 mr-1 text-green-500" /> },
          { status: 'Investigating', icon: <Shield className="w-4 h-4 mr-1 text-blue-500" /> },
          { status: 'In Progress', icon: <ClipboardList className="w-4 h-4 mr-1 text-yellow-500" /> },
          { status: 'Completed', icon: <PackageCheck className="w-4 h-4 mr-1 text-green-700" /> },
          { status: 'Cancelled', icon: <X className="w-4 h-4 mr-1 text-gray-500" /> },
        ].map(({ status, icon }) => (
          <div key={status} className="flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-white to-blue-50 shadow-sm border border-blue-100 text-gray-700 text-xs font-semibold gap-1">
            {icon}
            {status}: {filteredByVisibleTabs.filter(e => e.status === status).length}
          </div>
        ))}
        {[
          { type: 'ProductionLoss', icon: <TrendingDown className="w-4 h-4 mr-1 text-blue-500" />, visible: visibleTabs.ProductionLoss },
          { type: 'IOW', icon: <Wrench className="w-4 h-4 mr-1 text-purple-500" />, visible: visibleTabs.IOW },
          { type: 'SOL', icon: <Shield className="w-4 h-4 mr-1 text-pink-500" />, visible: visibleTabs.SOL },
          { type: 'APM', icon: <Factory className="w-4 h-4 mr-1 text-green-500" />, visible: visibleTabs.APM },
          { type: 'FailureWO', icon: <ClipboardList className="w-4 h-4 mr-1 text-yellow-500" />, visible: visibleTabs.FailureWO },
          { type: 'ProductionOutput', icon: <PackageCheck className="w-4 h-4 mr-1 text-indigo-500" />, visible: visibleTabs.ProductionOutput },
        ].filter(({ visible }) => visible).map(({ type, icon }) => (
          <div key={type} className="flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-white shadow-sm border border-blue-100 text-blue-700 text-xs font-semibold gap-1">
            {icon}
            {type}: {events.filter(e => e.eventType === type).length}
          </div>
        ))}
      </div>

      {/* Quick Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Events</p>
                <p className="text-2xl font-bold text-blue-700">{quickStats.totalEvents}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Open Events</p>
                <p className="text-2xl font-bold text-green-700">{quickStats.openEvents}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Cost</p>
                <p className="text-2xl font-bold text-red-700">${(quickStats.totalCost / 1000000).toFixed(1)}M</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Downtime</p>
                <p className="text-2xl font-bold text-yellow-700">{Math.floor(quickStats.totalDowntime / 60)}h</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Critical Events</p>
                <p className="text-2xl font-bold text-purple-700">{quickStats.criticalEvents}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Glassy Tabs Bar */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput')}>
        <TabsList className="backdrop-blur bg-gradient-to-r from-white/80 to-blue-50/80 shadow-md rounded-xl p-1 flex gap-1 border border-blue-100 mb-2">
          {visibleTabs.ProductionLoss && (
            <TabsTrigger value="ProductionLoss" className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-100/60">
              <TrendingDown className="w-4 h-4" /> Loss
              <Badge variant="secondary" className="ml-1 text-xs">{eventCounts.ProductionLoss}</Badge>
            </TabsTrigger>
          )}
          {visibleTabs.IOW && (
            <TabsTrigger value="IOW" className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-purple-700 hover:bg-purple-100/60">
              <Wrench className="w-4 h-4" /> IOW
              <Badge variant="secondary" className="ml-1 text-xs">{eventCounts.IOW}</Badge>
            </TabsTrigger>
          )}
          {visibleTabs.SOL && (
            <TabsTrigger value="SOL" className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-pink-700 hover:bg-pink-100/60">
              <Shield className="w-4 h-4" /> SOL
              <Badge variant="secondary" className="ml-1 text-xs">{eventCounts.SOL}</Badge>
            </TabsTrigger>
          )}
          {visibleTabs.APM && (
            <TabsTrigger value="APM" className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-green-700 hover:bg-green-100/60">
              <Factory className="w-4 h-4" /> APM
              <Badge variant="secondary" className="ml-1 text-xs">{eventCounts.APM}</Badge>
            </TabsTrigger>
          )}
          {visibleTabs.FailureWO && (
            <TabsTrigger value="FailureWO" className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-yellow-700 hover:bg-yellow-100/60">
              <ClipboardList className="w-4 h-4" /> WO
              <Badge variant="secondary" className="ml-1 text-xs">{eventCounts.FailureWO}</Badge>
            </TabsTrigger>
          )}
          {visibleTabs.ProductionOutput && (
            <TabsTrigger value="ProductionOutput" className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-100/60">
              <PackageCheck className="w-4 h-4" /> Output
              <Badge variant="secondary" className="ml-1 text-xs">{eventCounts.ProductionOutput}</Badge>
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value={activeTab}>
          <Card className="bg-gradient-to-br from-white to-blue-50/60 shadow-lg rounded-2xl border border-blue-100">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-blue-500" /> {activeTab.replace(/([A-Z])/g, ' $1').trim()} Events
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    {tabEvents.length} events {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant={showAdvancedFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportToCSV}
                    disabled={tabEvents.length === 0}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Advanced Filters Panel */}
              {showAdvancedFilters && (
                <Card className="mt-4 border-2 border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-600" />
                        Advanced Filters
                      </CardTitle>
                      {activeFilterCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setFilterSeverity('all');
                            setFilterUnit('all');
                            setFilterAsset('all');
                            setFilterShift('all');
                            setFilterDateFrom('');
                            setFilterDateTo('');
                          }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear All
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Search */}
                      <div className="lg:col-span-2">
                        <Label className="text-xs font-medium text-gray-700 mb-1">Search</Label>
                        <Input
                          placeholder="Search description, event ID, asset..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="border-2 focus:border-blue-500"
                        />
                      </div>

                      {/* Severity */}
                      <div>
                        <Label className="text-xs font-medium text-gray-700 mb-1">Severity</Label>
                        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                          <SelectTrigger className="border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Severities</SelectItem>
                            <SelectItem value="Critical">🔴 Critical</SelectItem>
                            <SelectItem value="High">🟠 High</SelectItem>
                            <SelectItem value="Medium">🟡 Medium</SelectItem>
                            <SelectItem value="Low">🟢 Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Unit */}
                      <div>
                        <Label className="text-xs font-medium text-gray-700 mb-1">Unit</Label>
                        <Select value={filterUnit} onValueChange={setFilterUnit}>
                          <SelectTrigger className="border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Units</SelectItem>
                            {units.map(unit => (
                              <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Asset */}
                      <div>
                        <Label className="text-xs font-medium text-gray-700 mb-1">Asset</Label>
                        <Select value={filterAsset} onValueChange={setFilterAsset}>
                          <SelectTrigger className="border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Assets</SelectItem>
                            {assets
                              .filter(asset => filterUnit === 'all' || asset.unitId === filterUnit)
                              .map(asset => (
                                <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Shift */}
                      <div>
                        <Label className="text-xs font-medium text-gray-700 mb-1">Shift</Label>
                        <Select value={filterShift} onValueChange={setFilterShift}>
                          <SelectTrigger className="border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Shifts</SelectItem>
                            <SelectItem value="Day">Day Shift</SelectItem>
                            <SelectItem value="Night">Night Shift</SelectItem>
                            <SelectItem value="Afternoon">Afternoon Shift</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date From */}
                      <div>
                        <Label className="text-xs font-medium text-gray-700 mb-1">Date From</Label>
                        <Input
                          type="date"
                          value={filterDateFrom}
                          onChange={e => setFilterDateFrom(e.target.value)}
                          className="border-2 focus:border-blue-500"
                        />
                      </div>

                      {/* Date To */}
                      <div>
                        <Label className="text-xs font-medium text-gray-700 mb-1">Date To</Label>
                        <Input
                          type="date"
                          value={filterDateTo}
                          onChange={e => setFilterDateTo(e.target.value)}
                          className="border-2 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Active Filters Summary */}
                    {activeFilterCount > 0 && (
                      <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-blue-800">Active Filters:</span>
                        {searchQuery && (
                          <Badge variant="secondary" className="text-xs">
                            Search: {searchQuery}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setSearchQuery('')} />
                          </Badge>
                        )}
                        {filterSeverity !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Severity: {filterSeverity}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilterSeverity('all')} />
                          </Badge>
                        )}
                        {filterUnit !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Unit: {units.find(u => u.id === filterUnit)?.name}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilterUnit('all')} />
                          </Badge>
                        )}
                        {filterAsset !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Asset: {assets.find(a => a.id === filterAsset)?.name}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilterAsset('all')} />
                          </Badge>
                        )}
                        {filterShift !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Shift: {filterShift}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilterShift('all')} />
                          </Badge>
                        )}
                        {filterDateFrom && (
                          <Badge variant="secondary" className="text-xs">
                            From: {filterDateFrom}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilterDateFrom('')} />
                          </Badge>
                        )}
                        {filterDateTo && (
                          <Badge variant="secondary" className="text-xs">
                            To: {filterDateTo}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilterDateTo('')} />
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tabEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border border-blue-100 rounded-xl bg-gradient-to-r from-white/90 to-blue-50/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer gap-2 min-h-[60px]"
                    onClick={() => { setSelectedEvent(event); setEditMode(false); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1 mb-1 flex-wrap">
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs font-semibold bg-white/80 border-blue-200 text-blue-700">
                          <ClipboardList className="w-3 h-3 mr-1 inline-block" />{event.eventId}
                        </Badge>
                        <Badge className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeColor(event.status)}`}> 
                          <Activity className="w-3 h-3 mr-1 inline-block" />{event.status}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 border-gray-200 text-gray-700">
                          <Upload className="w-3 h-3 mr-1 inline-block" />{event.source}
                        </Badge>
                        {event.cost && (
                          <Badge className="rounded-full px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-200">
                            <DollarSign className="w-3 h-3 mr-1 inline-block" />${event.cost.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate mb-0.5">{event.description}</p>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span><Factory className="w-3 h-3 mr-0.5 inline-block" />{getUnitName(event.unitId)}</span>
                        <span><TrendingDown className="w-3 h-3 mr-0.5 inline-block" />{getImpactCodeName(event.impactCodeId)}</span>
                        <span><ClipboardList className="w-3 h-3 mr-0.5 inline-block" />{getOEECodeName(event.oeeCodeId)}</span>
                        <span><Calendar className="w-3 h-3 mr-0.5 inline-block" />{new Date(event.startTime).toLocaleString()}</span>
                        {event.endTime && (
                          <span><Clock className="w-3 h-3 mr-0.5 inline-block" />{new Date(event.endTime).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end min-w-[150px]">
                      <Button variant="ghost" size="sm" className="px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100/60">
                        View Details
                      </Button>
                      {event.source === 'PI' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-2 py-1 text-xs"
                          onClick={(e) => { e.stopPropagation(); if (!piBaseUrl) return; window.open(`${piBaseUrl.replace(/\/$/, '')}/eventframes/${encodeURIComponent(event.eventId)}`, '_blank'); }}
                        >
                          Open in PI
                        </Button>
                      )}
                      {(() => {
                        const rcaCheck = shouldShowRCAButton(event);
                        if (!rcaCheck.shouldShow) return null;
                        
                        return (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="px-2 py-1 text-xs font-semibold text-orange-700 border-orange-200 hover:bg-orange-50 gap-1"
                            onClick={(e) => { 
                              e.stopPropagation();
                              
                              // Show warning if needed
                              if (rcaCheck.warning) {
                                if (!confirm(`${rcaCheck.warning}\n\nReason: ${rcaCheck.reason}\n\nProceed with RCA creation?`)) {
                                  return;
                                }
                              }
                              
                              navigate(`/rca?eventId=${event.id}&eventTitle=${encodeURIComponent(event.description)}`); 
                            }}
                            title={rcaCheck.reason}
                          >
                            <FileText className="w-3 h-3" />
                            {event.status === 'Open' ? 'Start RCA' : 'Create RCA'}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50/80 to-white/90 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl min-h-[600px] max-h-[95vh] flex flex-col overflow-y-auto p-0">
            <div className="absolute top-4 right-4 z-10">
              <button className="text-gray-400 hover:text-blue-600 text-2xl font-bold" onClick={() => setSelectedEvent(null)} aria-label="Close">&times;</button>
            </div>
            <div className="flex flex-col md:flex-row">
              {/* Vertical accent bar */}
              <div className="hidden md:block w-2 rounded-l-2xl bg-gradient-to-b from-blue-400 to-purple-300 shadow-lg" />
              {/* Main card */}
              <div className="flex-1 bg-white/90 rounded-2xl shadow-2xl p-8 border-l-0 border-t border-b border-r border-blue-200">
                {editMode ? (
                  <form className="space-y-4" onSubmit={handleEditSubmit}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 p-3 shadow"><TrendingDown className="w-7 h-7 text-blue-500" /></span>
                      <h2 className="text-2xl font-bold text-blue-700">Edit Event</h2>
                    </div>
                    <EventFormFields
                      formState={editEventForm}
                      setFormState={setEditEventForm}
                      mode="edit"
                      errors={formErrors}
                      units={units}
                      assets={assets}
                      impactCodes={impactCodes}
                      oeeCodes={oeeCodes}
                      plans={plans}
                      reasonCodes={reasonCodes}
                      selectedReasonCode={selectedReasonCode}
                      setSelectedReasonCode={setSelectedReasonCode}
                      showReasonCodeModal={showReasonCodeModal}
                      setShowReasonCodeModal={setShowReasonCodeModal}
                      operatorPrompt={operatorPrompt}
                      shiftPrompt={shiftPrompt}
                      crewPrompt={crewPrompt}
                      showOperatorPrompt={showOperatorPrompt}
                      setShowOperatorPrompt={setShowOperatorPrompt}
                      showShiftPrompt={showShiftPrompt}
                      setShowShiftPrompt={setShowShiftPrompt}
                      showCrewPrompt={showCrewPrompt}
                      setShowCrewPrompt={setShowCrewPrompt}
                    />
                    {/* Status Automation UI Hint and Status Select (keep below fields) */}
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      {(() => {
                        const autoStatus = getAutomatedStatus(editEventForm);
                        const activeRule = rules.find(rule => (rule.eventType === '*' || rule.eventType === editEventForm.eventType) && rule.condition(editEventForm));
                        if (activeRule) {
                          return (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Status is set automatically: <b>{autoStatus}</b></span>
                              <span className="text-xs text-gray-500" title={activeRule.description}>({activeRule.description})</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <Select
                        value={editEventForm?.status || ''}
                        onValueChange={(value) => setEditEventForm({ ...editEventForm, status: value })}
                        disabled={!!rules.find(rule => (rule.eventType === '*' || rule.eventType === editEventForm.eventType) && rule.condition(editEventForm))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                          {rules.find(rule => (rule.eventType === '*' || rule.eventType === editEventForm.eventType) && rule.condition(editEventForm)) && (
                            <span className="ml-2 text-xs text-gray-400" title="Status is set automatically by an active rule. Edit rules in Admin Panel.">🛈</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Coded">Coded</SelectItem>
                          <SelectItem value="RCA Required">RCA Required</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                          <SelectItem value="Investigating">Investigating</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Header with icon and badges */}
                    <div className="mb-4 flex flex-wrap gap-3 items-center">
                      <span className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 p-3 shadow"><TrendingDown className="w-7 h-7 text-blue-500" /></span>
                      <span className="text-xl font-bold text-blue-700 flex items-center gap-2">Event Details</span>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-sm font-semibold bg-blue-50 border-blue-200 text-blue-700">
                        <ClipboardList className="w-4 h-4 mr-1 inline-block" />{selectedEvent.eventId}
                      </Badge>
                      <Badge className={`rounded-full px-3 py-1 text-sm font-semibold bg-blue-100 border-blue-200 text-blue-700 ${getStatusBadgeColor(selectedEvent.status)}`}> 
                        <Activity className="w-4 h-4 mr-1 inline-block" />{selectedEvent.status}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm font-semibold bg-purple-50 border-purple-200 text-purple-700">
                        <Upload className="w-4 h-4 mr-1 inline-block" />{selectedEvent.source}
                      </Badge>
                      {selectedEvent.cost && <Badge className="rounded-full px-3 py-1 text-sm font-semibold bg-gradient-to-r from-pink-100 to-red-100 text-red-800 border-red-200"><DollarSign className="w-4 h-4 mr-1 inline-block" />${selectedEvent.cost.toLocaleString()}</Badge>}
                    </div>
                    {/* Section: Main Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-3 text-base">
                        <div className="flex items-center gap-2"><Factory className="w-5 h-5 text-blue-400" /><span className="font-semibold">Production Unit:</span> {units.find(u => u.id === selectedEvent.unitId)?.name || 'N/A'}</div>
                        <div className="flex items-center gap-2"><Wrench className="w-5 h-5 text-purple-400" /><span className="font-semibold">Asset:</span> {assets.find(a => a.id === selectedEvent.assetId)?.name || 'N/A'}</div>
                        {selectedEvent.impactCodeId && <div className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-400" /><span className="font-semibold">Impact Code:</span> {impactCodes.find(i => i.id === selectedEvent.impactCodeId) ? `${impactCodes.find(i => i.id === selectedEvent.impactCodeId).code} - ${impactCodes.find(i => i.id === selectedEvent.impactCodeId).name}` : 'N/A'}</div>}
                        {selectedEvent.oeeCodeId && <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-400" /><span className="font-semibold">OEE Code:</span> {oeeCodes.find(o => o.id === selectedEvent.oeeCodeId) ? `${oeeCodes.find(o => o.id === selectedEvent.oeeCodeId).code} - ${oeeCodes.find(o => o.id === selectedEvent.oeeCodeId).name}` : 'N/A'}</div>}
                        {selectedEvent.lossCategory && <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-400" /><span className="font-semibold">Loss Type/Category:</span> {selectedEvent.lossCategory}</div>}
                        {selectedEvent.reasonCodeId && <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-pink-400" /><span className="font-semibold">Reason Code:</span> {reasonCodes.find(rc => rc.id === selectedEvent.reasonCodeId) ? `${reasonCodes.find(rc => rc.id === selectedEvent.reasonCodeId).code} - ${reasonCodes.find(rc => rc.id === selectedEvent.reasonCodeId).name}` : 'N/A'}</div>}
                        {selectedEvent.parameter && <div className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-400" /><span className="font-semibold">Parameter:</span> {selectedEvent.parameter}</div>}
                        {selectedEvent.limit && <div className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-400" /><span className="font-semibold">Limit:</span> {selectedEvent.limit}</div>}
                        {selectedEvent.limitType && <div className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-400" /><span className="font-semibold">Limit Type:</span> {selectedEvent.limitType}</div>}
                        {selectedEvent.solType && <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-pink-400" /><span className="font-semibold">SOL Type:</span> {selectedEvent.solType}</div>}
                        {selectedEvent.apmType && <div className="flex items-center gap-2"><Factory className="w-5 h-5 text-green-400" /><span className="font-semibold">APM Type:</span> {selectedEvent.apmType}</div>}
                        {selectedEvent.recommendedAction && <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-400" /><span className="font-semibold">Recommended Action:</span> {selectedEvent.recommendedAction}</div>}
                        {selectedEvent.failureMode && <div className="flex items-center gap-2"><Wrench className="w-5 h-5 text-purple-400" /><span className="font-semibold">Failure Mode:</span> {selectedEvent.failureMode}</div>}
                        {selectedEvent.planId && <div className="flex items-center gap-2"><PackageCheck className="w-5 h-5 text-indigo-400" /><span className="font-semibold">Plan:</span> {plans.find(p => p.id === selectedEvent.planId)?.name || 'N/A'}</div>}
                      </div>
                      <div className="space-y-3 text-base">
                        <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-gray-400" /><span className="font-semibold">Start Time:</span> {selectedEvent.startTime ? new Date(selectedEvent.startTime).toLocaleString() : 'N/A'}</div>
                        <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /><span className="font-semibold">End Time:</span> {selectedEvent.endTime ? new Date(selectedEvent.endTime).toLocaleString() : 'N/A'}</div>
                        {selectedEvent.quantity !== undefined && <div className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-400" /><span className="font-semibold">Quantity:</span> {selectedEvent.quantity}</div>}
                        {selectedEvent.defectiveQuantity !== undefined && <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-400" /><span className="font-semibold">Defective Quantity:</span> {selectedEvent.defectiveQuantity}</div>}
                        {selectedEvent.duration != null && <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-400" /><span className="font-semibold">Duration (minutes):</span> {selectedEvent.duration}</div>}
                        {(() => {
                          const plan = plans.find(p => p.id === selectedEvent.planId);
                          const product = plan ? products.find(prod => prod.id === plan.productId) : null;
                          return product ? <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-red-400" /><span className="font-semibold">Unit Cost:</span> ${product.standardCost.toFixed(2)}</div> : null;
                        })()}
                        {selectedEvent.cost && <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-red-400" /><span className="font-semibold">Estimated Cost ($):</span> ${selectedEvent.cost.toLocaleString()}</div>}
                      </div>
                    </div>
                    {/* Divider */}
      <div className="my-4 border-t border-blue-100" />
      {/* Historian sparkline for context (if parameter present or PI-sourced) */}
      {(() => {
        const hasParam = !!selectedEvent.parameter;
        const isPI = selectedEvent.source === 'PI';
        if (!hasParam && !isPI) return null;
        return (
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold mb-1 flex items-center gap-2 text-base"><Activity className="w-5 h-5 text-blue-500" />Signal trend around event</div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={async () => {
                  try {
                    setTsLoading(true);
                    
                    // Try to use PI system first
                    try {
                      const tenantId = session?.tenant?.id;
                      const cfg = tenantId ? await piStore.getConnectionByTenant(tenantId) : null;
                      if (tenantId && cfg) {
                        const piClient = createTenantPIClient(tenantId);
                        const provider = new PIHistorianProvider(piClient);
                        // Heuristic: fetch attributes for the bound element if available, else skip
                        // We try to resolve one relevant stream; for MVP, use the first attribute of the tenant root binding
                        const rootBind = await piStore.getTenantRootBinding(tenantId);
                        if (rootBind?.webId) {
                          const attrsRes = await piClient.getElementAttributes(rootBind.webId, 'Items.Name;Items.WebId;Items.Value;Items.Path;Items.DefaultUnitsName;Items.Links.Value;Items.Links.Point');
                          const attributes: any[] = attrsRes?.Items || [];
                          if (attributes.length > 0) {
                            // If parameter exists, prefer attribute whose name includes it
                            let attr = attributes[0];
                            if (hasParam) {
                              const m = attributes.find(a => (a?.Name || '').toLowerCase().includes(String(selectedEvent.parameter).toLowerCase()));
                              if (m) attr = m;
                            }
                            const streams = await provider.resolveStreamsByAttributes([attr]);
                            if (streams.length > 0) {
                              // 10 minutes before and after
                              const st = new Date(new Date(selectedEvent.startTime).getTime() - 10 * 60 * 1000).toISOString();
                              const et = new Date(new Date(selectedEvent.endTime || selectedEvent.startTime).getTime() + 10 * 60 * 1000).toISOString();
                              const hc = new HistorianClient();
                              hc.register(provider);
                              const res = await hc.query({ provider: 'pi', streams, mode: 'interpolated', startTimeUtc: st, endTimeUtc: et, interval: '1m' } as any);
                              setTsResults(res as any);
                              return;
                            }
                          }
                        }
                      }
                    } catch (piError) {
                      console.log('PI system not available, using demo data:', piError);
                    }
                    
                    // Fallback: Generate demo trend data
                    const startTime = new Date(selectedEvent.startTime);
                    const endTime = new Date(selectedEvent.endTime || selectedEvent.startTime);
                    const duration = endTime.getTime() - startTime.getTime();
                    const beforeAfter = Math.min(duration, 10 * 60 * 1000); // 10 minutes or event duration
                    
                    const demoStart = new Date(startTime.getTime() - beforeAfter);
                    const demoEnd = new Date(endTime.getTime() + beforeAfter);
                    const totalDuration = demoEnd.getTime() - demoStart.getTime();
                    const interval = Math.max(60000, totalDuration / 20); // 1 minute or 20 points
                    
                    const points = [];
                    const baseValue = hasParam && selectedEvent.parameter === 'Separator Efficiency' ? 85 : 100;
                    const limitValue = selectedEvent.limit ? parseFloat(String(selectedEvent.limit)) : baseValue - 10;
                    
                    for (let t = demoStart.getTime(); t <= demoEnd.getTime(); t += interval) {
                      const time = new Date(t);
                      const eventStart = startTime.getTime();
                      const eventEnd = endTime.getTime();
                      
                      let value = baseValue;
                      
                      // Simulate trend around event
                      if (t < eventStart) {
                        // Before event: normal operation
                        value = baseValue + (Math.random() - 0.5) * 5;
                      } else if (t >= eventStart && t <= eventEnd) {
                        // During event: parameter drops below limit
                        const progress = (t - eventStart) / (eventEnd - eventStart);
                        value = baseValue - (baseValue - limitValue + 5) * progress + (Math.random() - 0.5) * 3;
                      } else {
                        // After event: recovery
                        const recoveryProgress = Math.min((t - eventEnd) / (beforeAfter), 1);
                        value = limitValue + (baseValue - limitValue) * recoveryProgress + (Math.random() - 0.5) * 4;
                      }
                      
                      points.push({
                        timestamp: time.toISOString(),
                        value: Math.round(value * 100) / 100
                      });
                    }
                    
                    const demoResults = [{
                      stream: {
                        id: 'demo-stream',
                        name: selectedEvent.parameter || 'Process Parameter',
                        units: selectedEvent.parameter === 'Separator Efficiency' ? '%' : 'units'
                      },
                      points: points
                    }];
                    
                    setTsResults(demoResults);
                    
                  } catch (e) {
                    console.error('Error loading trend data:', e);
                    setTsResults(null);
                    toast({
                      title: 'Error',
                      description: 'Failed to load trend data. Please check your PI connection or try again.',
                      variant: 'destructive',
                    });
                  } finally { 
                    setTsLoading(false); 
                  }
                }}
              >{tsLoading ? 'Loading…' : 'Load trend'}</Button>
            </div>
            {tsResults && tsResults.length > 0 && (
              <div className="mt-2">
                <TimeSeriesChart results={tsResults as any} />
              </div>
            )}
          </div>
        );
      })()}
                    {/* Description and Operator/Shift/Crew for all event types */}
                    <div className="mb-3">
                      <div className="font-semibold mb-1 flex items-center gap-2 text-base"><ClipboardList className="w-5 h-5 text-indigo-400" />Description:</div>
                      <div className="bg-white/80 rounded p-3 border text-gray-800 text-base shadow-sm">{selectedEvent.description || 'N/A'}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-base">
                      <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-400" /><span className="font-semibold">Operator/Recorder:</span> {selectedEvent.operatorName || 'N/A'}</div>
                      <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /><span className="font-semibold">Shift:</span> {selectedEvent.shift || 'N/A'}</div>
                      <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-pink-400" /><span className="font-semibold">Crew:</span> {selectedEvent.crew || 'N/A'}</div>
                    </div>
                    {/* --- Audit Trail Section --- */}
                    {selectedEvent.auditTrail && selectedEvent.auditTrail.length > 0 && (
                      <div className="mt-6">
                        <Button
                          variant="outline"
                          className="mb-2"
                          onClick={() => setShowAuditTrail(true)}
                        >
                          <Activity className="w-4 h-4 mr-1 text-blue-500" /> Audit Trail
                        </Button>
                        <AuditTrailViewer
                          auditTrail={selectedEvent.auditTrail}
                          entityType="Production Event"
                          entityName={selectedEvent.eventId}
                          onClose={() => setShowAuditTrail(false)}
                          isOpen={showAuditTrail}
                        />
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 mt-6">
                      <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
                      <Button variant="default" onClick={() => handleEditClick()}>Edit</Button>
                      <Button variant="destructive" onClick={() => handleDeleteClick()}>Delete</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* RCA Trigger Settings Dialog */}
      <RCATriggerSettings 
        isOpen={showRCATriggerSettings} 
        onClose={() => {
          console.log('🚪 RCA Settings dialog closing...');
          setShowRCATriggerSettings(false);
          
          // Always reload from IndexedDB with a delay to ensure write completes
          const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
          if (tenantId) {
            setTimeout(() => {
              console.log('🔄 Reloading RCA config from IndexedDB after dialog close...');
              rcaTriggerConfigService.getActiveConfig(tenantId).then(config => {
                console.log('✅ Configuration reloaded:', {
                  manualCreationAllowed: config?.globalSettings.alwaysAllowManualCreation,
                  enabledRules: config?.rules.filter(r => r.enabled).length
                });
                setRcaTriggerConfig(config);
              });
            }, 200); // 200ms delay to ensure IndexedDB write completes
          }
        }} 
      />

      {/* Tab Visibility Settings Dialog */}
      <TabVisibilitySettingsDialog
        isOpen={showTabVisibilitySettings}
        onClose={() => setShowTabVisibilitySettings(false)}
        visibleTabs={visibleTabs}
        onToggle={handleToggleTab}
        onReset={handleResetTabVisibility}
        eventCounts={eventCounts}
      />
    </div>
  );
};
