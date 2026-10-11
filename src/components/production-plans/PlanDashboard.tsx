import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  Clock, 
  Target,
  Activity,
  BarChart3,
  RefreshCw,
  FileText,
  Calculator,
  Plus,
  Info,
  Edit,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Search,
  ExternalLink,
  ChevronDown,
  ArrowLeft,
  Calendar,
  TrendingUp,
  Settings,
  Gauge,
  Wrench,
  DollarSign,
  HelpCircle,
  ClipboardList
} from 'lucide-react';
import { masterDataService, ProductionPlan, ProductionLoss, OEESummary, ReconcileForm, LossCategory, ImpactCode, OEECode, Unit, ProductionEvent, Product } from '../../services/MasterDataService';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantSelection } from '../../contexts/PlantSelectionContext';
import { useToast } from '@/hooks/use-toast';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { getOEEComponentForEvent } from '../../services/MasterDataService';
import { auditService } from '../../services/AuditService';
import { formatDateRange } from '../../utils/dateFormatters';

// Utility function to format time display
const formatTimeDisplay = (timeString: string): string => {
  if (!timeString) return '';
  
  // Handle potential data corruption or invalid formats
  const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    // Try to fix common issues
    const cleaned = timeString.replace(/[^0-9:]/g, '');
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0]) % 24;
      const minutes = parseInt(parts[1]) % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return '00:00'; // fallback
  }
  
  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  
  // Ensure valid time range
  const validHours = Math.max(0, Math.min(23, hours));
  const validMinutes = Math.max(0, Math.min(59, minutes));
  
  return `${validHours.toString().padStart(2, '0')}:${validMinutes.toString().padStart(2, '0')}`;
};

interface PlanDashboardProps {
  plan: ProductionPlan;
  onClose: () => void;
  onPlanUpdate?: (updatedPlan: ProductionPlan) => void;
}

interface DonutChartProps {
  value: number;
  label: string;
  color: string;
  size?: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ value, label, color, size = 120 }) => {
  const safeValue = isNaN(value) ? 0 : value;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{safeValue.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

function calculateOEE({ plan, events, unit, impactCodes, oeeCodes, dashboardConfig, productionEvents }) {
  // Calculate total plan period in days
  const planStartDate = new Date(plan.startDate);
  const planEndDate = new Date(plan.endDate);
  const planDays = Math.max(1, Math.ceil((planEndDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const planWeeks = planDays / 7;
  
  // Planned Production Time (hours) - Weekly schedule
  const weeklyPlannedTime = plan.usefulProductionTime
    ? Object.values(plan.usefulProductionTime).reduce<number>((sum, t: unknown) => {
        const time = t as { start: string; end: string };
        if (time && time.start && time.end) {
          const [sh, sm] = time.start.split(':').map(Number);
          const [eh, em] = time.end.split(':').map(Number);
          let hours = Number(eh) + Number(em) / 60 - (Number(sh) + Number(sm) / 60);
          if (hours < 0) hours += 24;
          return sum + hours;
        }
        return sum;
      }, 0)
    : 0;
  
  // Total Planned Time for entire plan period
  const plannedTime = weeklyPlannedTime * planWeeks;
  // Downtime (hours)
  const downtime = events.filter(e => getOEEComponentForEvent(e, impactCodes, oeeCodes) === 'Availability')
    .reduce((sum: number, e: any) => {
      if (e.startTime && e.endTime) {
        const start = new Date(e.startTime).getTime();
        const end = new Date(e.endTime).getTime();
        return sum + Math.max(0, (end - start) / 3600000);
      }
      return sum;
    }, 0);
  const operatingTime = Number(plannedTime) - Number(downtime);
  
  // Actual Output - Use auto-calculated from production events if available
  const autoActualQuantity = productionEvents
    .filter(e => e.eventType === 'ProductionOutput')
    .reduce((sum, e) => sum + (e.quantity || 0), 0);
  const actualOutput = autoActualQuantity || Number(plan.actualQuantity) || 0;
  
  // For PLAN-LEVEL metrics, use plan-based performance instead of ideal cycle time
  // Theoretical Max = Planned Quantity (what we planned to produce)
  const theoreticalMaxOutput = Number(plan.plannedQuantity) || 1;
  
  console.log('Actual Output Debug:', {
    planActualQuantity: plan.actualQuantity,
    autoActualQuantity: autoActualQuantity,
    finalActualOutput: actualOutput,
    planData: {
      id: plan.id,
      name: plan.name,
      plannedQuantity: plan.plannedQuantity,
      actualQuantity: plan.actualQuantity,
      status: plan.status
    }
  });
  // Defective Output
  const defective = events.filter(e => getOEEComponentForEvent(e, impactCodes, oeeCodes) === 'Quality')
    .reduce((sum: number, e: any) => sum + (Number(e.defectiveQuantity) || 0), 0);
  const goodOutput = Number(actualOutput) - Number(defective);
  
  console.log('Defective Output Debug:', {
    totalEvents: events.length,
    qualityEvents: events.filter(e => getOEEComponentForEvent(e, impactCodes, oeeCodes) === 'Quality').length,
    defectiveQuantity: defective,
    actualOutput: actualOutput,
    goodOutput: goodOutput,
    eventDetails: events.map(e => ({
      id: e.id,
      type: e.eventType,
      oeeComponent: getOEEComponentForEvent(e, impactCodes, oeeCodes),
      defectiveQuantity: e.defectiveQuantity || 0
    }))
  });
  // OEE Components (cap each at 1.0 = 100%)
  const availability = Math.min(1.0, Number(plannedTime) > 0 ? Number(operatingTime) / Number(plannedTime) : 0);
  const performance = Math.min(1.0, Number(theoreticalMaxOutput) > 0 ? Number(actualOutput) / Number(theoreticalMaxOutput) : 0);
  const quality = Math.min(1.0, Number(actualOutput) > 0 ? Number(goodOutput) / Number(actualOutput) : 0);
  
  // Debug logging for OEE calculations
  console.log('OEE Calculation Debug:', {
    plannedTime,
    operatingTime,
    downtime,
    theoreticalMaxOutput,
    actualOutput,
    defective,
    goodOutput,
    availability: availability * 100,
    performance: performance * 100,
    quality: quality * 100,
    performanceCalculation: `${actualOutput} / ${theoreticalMaxOutput} = ${performance}`,
    qualityCalculation: `${goodOutput} / ${actualOutput} = ${quality}`
  });
  
  // Apply component weights from configuration
  const availabilityWeight = dashboardConfig?.oee?.availabilityWeight || 1.0;
  const performanceWeight = dashboardConfig?.oee?.performanceWeight || 1.0;
  const qualityWeight = dashboardConfig?.oee?.qualityWeight || 1.0;
  
  const weightedAvailability = Math.pow(availability, availabilityWeight);
  const weightedPerformance = Math.pow(performance, performanceWeight);
  const weightedQuality = Math.pow(quality, qualityWeight);
  
  const oee = weightedAvailability * weightedPerformance * weightedQuality;
  
  return {
    availability: isNaN(availability) ? 0 : Number(availability) * 100,
    performance: isNaN(performance) ? 0 : Number(performance) * 100,
    quality: isNaN(quality) ? 0 : Number(quality) * 100,
    overallOEE: isNaN(oee) ? 0 : Number(oee) * 100,
    plannedTime: Number(plannedTime) || 0,
    operatingTime: Number(operatingTime) || 0,
    downtime: Number(downtime) || 0,
    theoreticalMaxOutput: Number(theoreticalMaxOutput) || 0,
    actualOutput: Number(actualOutput) || 0,
    defective: Number(defective) || 0,
    goodOutput: Number(goodOutput) || 0
  };
}

export const PlanDashboard: React.FC<PlanDashboardProps> = ({ plan, onClose, onPlanUpdate }) => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
  const { toast } = useToast();
  const { config: dashboardConfig, loading: configLoading } = useDashboardConfig();
  const [losses, setLosses] = useState<ProductionLoss[]>([]);
  const [oeeSummary, setOeeSummary] = useState<OEESummary | null>(null);
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [oeeCodes, setOeeCodes] = useState<OEECode[]>([]);
  const [productionEvents, setProductionEvents] = useState<ProductionEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLoss, setSelectedLoss] = useState<ProductionLoss | null>(null);
  const [lossToDelete, setLossToDelete] = useState<ProductionLoss | null>(null);
  const [reconcileForm, setReconcileForm] = useState({
    totalLossAmount: 0,
    categorizedLossAmount: 0,
    unaccountedLossAmount: 0,
    productionEventId: '',
    productionEvent: '',
    comment: '',
    categories: [] as Array<{
      categoryName: string;
      lossAmount: number;
      impactCodeId: string;
      oeeCodeId: string;
      description: string;
      productionEventId?: string;
      productionEvent?: string;
    }>
  });
  const [editForm, setEditForm] = useState({
    period: '',
    actual: 0,
    shortRangePlan: 0,
    losses: 0,
    unaccountedLoss: 0,
    action: 'Reconcile' as 'Reconcile' | 'RCA Required' | 'Closed'
  });
  const [loading, setLoading] = useState(true);
  const [showLossBreakdown, setShowLossBreakdown] = useState(false);
  const [selectedLossBreakdown, setSelectedLossBreakdown] = useState<ProductionLoss | null>(null);
  const [lossCategories, setLossCategories] = useState<LossCategory[]>([]);
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [isNavBlurred, setIsNavBlurred] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [showUnmappedModal, setShowUnmappedModal] = useState(false);
  const [unmappedEvents, setUnmappedEvents] = useState<any[]>([]);
  const [assigningEventId, setAssigningEventId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [availablePlans, setAvailablePlans] = useState<ProductionPlan[]>([]);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [availableEvents, setAvailableEvents] = useState<ProductionEvent[]>([]);

  // Section refs
  const overviewRef = useRef<HTMLDivElement>(null);
  const performanceRef = useRef<HTMLDivElement>(null);
  const lossesRef = useRef<HTMLDivElement>(null);
  const capacityRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Unit is now stored in state, no need to compute it here

  useEffect(() => {
    loadDashboardData();
  }, [plan.id, tenantId]);

  useEffect(() => {
    const handleScroll = () => {
      setIsNavBlurred(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver for active section
  useEffect(() => {
    const sectionRefs = [
      { id: 'overview', ref: overviewRef },
      { id: 'performance', ref: performanceRef },
      { id: 'losses', ref: lossesRef },
      { id: 'capacity', ref: capacityRef },
      { id: 'actions', ref: actionsRef },
    ];
    const observerOptions = {
      root: null,
      rootMargin: '-64px 0px 0px 0px', // offset for nav bar (64px)
      threshold: 0.05,
    };
    const observer = new window.IntersectionObserver((entries) => {
      const visibleSections = entries.filter(e => e.isIntersecting);
      if (visibleSections.length > 0) {
        // Pick the section closest to the top
        const topSection = visibleSections.reduce((prev, curr) =>
          prev.boundingClientRect.top < curr.boundingClientRect.top ? prev : curr
        );
        setActiveSection(topSection.target.id);
      }
    }, observerOptions);
    sectionRefs.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, []);

  // --- OEE recalculation effect ---
  useEffect(() => {
    // Only recalculate if all required data is present
    if (!tenantId || !plan || !unit || impactCodes.length === 0 || oeeCodes.length === 0) return;

    const oeeCalc = calculateOEE({ plan, events: productionEvents, unit, impactCodes, oeeCodes, dashboardConfig, productionEvents });
    // Update backend OEE summary if available
    const updateOeeSummary = async () => {
      try {
        // Find or create OEE summary for this plan/period
        let summary = oeeSummary;
        if (!summary) {
          // Try to fetch again or create default
          const summaries = await masterDataService.getOEESummaries({ planId: plan.id, tenantId });
          summary = summaries[0];
          if (!summary) {
            const defaultOEE = {
              planId: plan.id,
              availability: 0,
              performance: 0,
              quality: 0,
              overallOEE: 0,
              period: new Date().toISOString().split('T')[0],
              tenantId,
            };
            summary = await masterDataService.createOEESummary(defaultOEE);
          }
        }
        // Update summary with new OEE values
        await masterDataService.updateOEESummary(summary.id, {
          availability: oeeCalc.availability,
          performance: oeeCalc.performance,
          quality: oeeCalc.quality,
          overallOEE: oeeCalc.overallOEE,
        });
        setOeeSummary({ ...summary, ...oeeCalc });
      } catch (error) {
        console.error('Failed to update OEE summary:', error);
      }
    };
    updateOeeSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, productionEvents, unit, impactCodes, oeeCodes, tenantId]);

  // Enhanced loss calculation function that considers template configuration
  const calculateLosses = (actual: number, planned: number) => {
    const totalLosses = Math.max(0, planned - actual);
    
    // Adjust unaccounted loss based on template configuration
    let unaccountedLossPercentage = 0.3; // Default 30%
    
    if (plan.planBasis === 'Time-based') {
      // Time-based plans may have more predictable losses
      unaccountedLossPercentage = 0.25;
    } else if (plan.planBasis === 'Quantity-based') {
      // Quantity-based plans may have more variable losses
      unaccountedLossPercentage = 0.35;
    } else if (plan.planBasis === 'Demand-based') {
      // Demand-based plans may have more external factors
      unaccountedLossPercentage = 0.4;
    }
    
    // Adjust based on data entry frequency
    if (plan.dataEntryFrequency === 'Hourly') {
      // More frequent data collection = better loss tracking
      unaccountedLossPercentage *= 0.8;
    } else if (plan.dataEntryFrequency === 'Monthly') {
      // Less frequent data collection = more unaccounted losses
      unaccountedLossPercentage *= 1.2;
    }
    
    const unaccountedLoss = totalLosses * unaccountedLossPercentage;
    return { totalLosses, unaccountedLoss };
  };

  // Calculate total production hours from schedule
  const calculateTotalProductionHours = (usefulProductionTime: any) => {
    if (!usefulProductionTime) return 0;
    
    let totalHours = 0;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    days.forEach(day => {
      const daySchedule = usefulProductionTime[day];
      if (daySchedule?.start && daySchedule?.end) {
        const startHour = parseInt(daySchedule.start.split(':')[0]);
        const endHour = parseInt(daySchedule.end.split(':')[0]);
        const startMinute = parseInt(daySchedule.start.split(':')[1]);
        const endMinute = parseInt(daySchedule.end.split(':')[1]);
        
        let hours = endHour - startHour;
        let minutes = endMinute - startMinute;
        
        if (minutes < 0) {
          hours -= 1;
          minutes += 60;
        }
        
        totalHours += hours + (minutes / 60);
      }
    });
    
    return Math.round(totalHours * 10) / 10; // Round to 1 decimal place
  };

  // Helper function to get unit of measure for a plan
  const getPlanUnitOfMeasure = (plan: ProductionPlan): string => {
    const product = products.find(p => p.id === plan.productId);
    return product?.unitOfMeasure || 'units';
  };

  // Validation function
  const validateLossCalculation = (actual: number = 0, planned: number = 0, losses: number = 0, unaccounted: number = 0) => {
    const { totalLosses, unaccountedLoss } = calculateLosses(actual, planned);
    
    if (Math.abs(losses - totalLosses) > 0.01) {
      return {
        isValid: false,
        message: `Losses should be ${totalLosses.toLocaleString()} (Planned ${planned.toLocaleString()} - Actual ${actual.toLocaleString()})`
      };
    }
    
    if (unaccounted > losses) {
      return {
        isValid: false,
        message: `Unaccounted loss (${unaccounted.toLocaleString()}) cannot exceed total losses (${losses.toLocaleString()})`
      };
    }
    
    return { isValid: true, message: 'Calculation is correct' };
  };

  const loadDashboardData = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('PlanDashboard: Starting data load with session:', {
        tenantId,
        planId: plan.id,
        planUnitId: plan.unitId
      });

      await masterDataService.initializeSampleData(tenantId);

      console.log('🔍 Loading production losses with:', { planId: plan.id });
      
      const [lossesData, oeeData, impactCodesData, oeeCodesData, eventsData, unitsData, productsData] = await Promise.all([
        masterDataService.getProductionLosses({ planId: plan.id }),
        masterDataService.getOEESummaries({ planId: plan.id }),
        masterDataService.getImpactCodes({ tenantId }),
        masterDataService.getOEECodes({ tenantId }),
        masterDataService.getProductionEvents({ unitId: plan.unitId, tenantId }),
        masterDataService.getUnits(),
        masterDataService.getProducts(),
      ]);

      console.log('PlanDashboard: Raw data loaded:', {
        lossesDataLength: lossesData.length,
        oeeDataLength: oeeData.length,
        impactCodesDataLength: impactCodesData.length,
        oeeCodesDataLength: oeeCodesData.length,
        eventsDataLength: eventsData.length,
        unitsDataLength: unitsData.length,
        productsDataLength: productsData.length
      });
      
      console.log('📊 Production Losses Detail:', {
        count: lossesData.length,
        planId: plan.id,
        sampleLoss: lossesData[0] || 'No losses found',
        allLosses: lossesData
      });

      // Debug: Check if there are any units in the system at all
      let finalUnitsData = unitsData;
      if (unitsData.length === 0) {
        console.log('PlanDashboard: No units found for tenant, checking all units in system...');
        const allUnits = await masterDataService.getUnits();
        console.log('PlanDashboard: All units in system:', {
          allUnitsLength: allUnits.length,
          allUnits: allUnits.map(u => ({ id: u.id, name: u.name, tenantId: u.tenantId }))
        });
        
        // Temporary fix: Use all units if none found for tenant
        finalUnitsData = allUnits;
        console.log('PlanDashboard: Using all units as fallback');
      }

      // Filter out empty/invalid loss records
      const validLosses = lossesData.filter(loss => 
        loss.period && (loss.actual > 0 || loss.shortRangePlan > 0 || loss.losses > 0)
      );
      setLosses(validLosses);
      setOeeSummary(oeeData[0] || null);
      setImpactCodes(impactCodesData);
      setOeeCodes(oeeCodesData);
      setProductionEvents(eventsData);
      setUnits(finalUnitsData);
      setProducts(productsData);

      // Find and set the unit for this plan
      let planUnit = finalUnitsData.find(u => u.id === plan.unitId) || null;
      if (!planUnit && plan.unitId) {
        try {
          planUnit = await masterDataService.getUnit(plan.unitId);
        } catch (unitError) {
          console.warn('PlanDashboard: Could not load unit by id', plan.unitId, unitError);
        }
      }
      console.log('PlanDashboard Debug:', {
        planId: plan.id,
        planUnitId: plan.unitId,
        finalUnitsDataLength: finalUnitsData.length,
        finalUnitsData: finalUnitsData.map(u => ({ id: u.id, name: u.name })),
        foundPlanUnit: planUnit ? { id: planUnit.id, name: planUnit.name } : null
      });
      setUnit(planUnit);

      if (oeeData.length === 0) {
        await createDefaultOEESummary();
      }
      const oeeCalc = calculateOEE({ plan, events: eventsData, unit: planUnit, impactCodes: impactCodesData, oeeCodes: oeeCodesData, dashboardConfig, productionEvents: eventsData });
      if (oeeData[0]?.id) {
        try {
          await masterDataService.updateOEESummary(oeeData[0].id, {
            availability: oeeCalc.availability,
            performance: oeeCalc.performance,
            quality: oeeCalc.quality,
            overallOEE: oeeCalc.overallOEE,
            period: oeeData[0].period || new Date().toISOString().split('T')[0],
            planId: plan.id,
            tenantId,
          });
        } catch (oeeUpdateError) {
          console.warn('PlanDashboard: OEE summary update skipped', oeeUpdateError);
        }
        setOeeSummary({ ...oeeData[0], ...oeeCalc });
      } else {
        const newOEE = await masterDataService.createOEESummary({
          planId: plan.id,
          availability: oeeCalc.availability,
          performance: oeeCalc.performance,
          quality: oeeCalc.quality,
          overallOEE: oeeCalc.overallOEE,
          period: new Date().toISOString().split('T')[0],
          tenantId
        });
        setOeeSummary(newOEE);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewLossBreakdown = async (loss: ProductionLoss) => {
    setSelectedLossBreakdown(loss);
    
    try {
      // Get reconcile forms for this loss
      const reconcileForms = await masterDataService.getReconcileForms({ lossId: loss.id });
      
      if (reconcileForms.length > 0) {
        // Get loss categories for the first reconcile form
        const categories = await masterDataService.getLossCategories({ 
          reconcileFormId: reconcileForms[0].id 
        });
        setLossCategories(categories);
      } else {
        setLossCategories([]);
      }
      
      setShowLossBreakdown(true);
    } catch (error) {
      console.error('Failed to load loss breakdown:', error);
      toast({
        title: 'Error',
        description: 'Failed to load loss breakdown',
        variant: 'destructive',
      });
    }
  };

  const createDefaultOEESummary = async () => {
    if (!tenantId) return;

    try {
      const defaultOEE: Omit<OEESummary, 'id' | 'createdAt' | 'updatedAt'> = {
        planId: plan.id,
        availability: 0,
        performance: 0,
        quality: 0,
        overallOEE: 0,
        period: new Date().toISOString().split('T')[0],
        tenantId,
      };

      const newOEE = await masterDataService.createOEESummary(defaultOEE);
      setOeeSummary(newOEE);
    } catch (error) {
      console.error('Failed to create default OEE summary:', error);
    }
  };

  // Updated handleReconcile to load previous categories
  const handleReconcile = async (loss: ProductionLoss) => {
    setSelectedLoss(loss);
    let categories: Array<{
      categoryName: string;
      lossAmount: number;
      impactCodeId: string;
      oeeCodeId: string;
      description: string;
    }> = [];
    let comment = '';
    let productionEvent = '';
    // Try to load previous reconcile form and categories
    if (masterDataService.getReconcileForms && masterDataService.getLossCategories) {
      try {
        const reconcileForms = await masterDataService.getReconcileForms({ lossId: loss.id });
        if (reconcileForms.length > 0) {
          const form = reconcileForms[0];
          comment = form.comment || '';
          productionEvent = form.productionEvent || '';
          categories = await masterDataService.getLossCategories({ reconcileFormId: form.id });
        }
      } catch (e) {
        // fallback to empty
      }
    }
    setReconcileForm({
      totalLossAmount: loss.losses,
      categorizedLossAmount: loss.losses - loss.unaccountedLoss,
      unaccountedLossAmount: loss.unaccountedLoss,
      productionEventId: '',
      productionEvent,
      comment,
      categories: categories.length > 0 ? categories : []
    });
    setShowReconcileModal(true);
  };

  const handleSaveReconcile = async () => {
    if (!selectedLoss || !session?.tenant?.id) return;

    // Validation: sum of category loss amounts cannot exceed total loss
    const totalCategorized = reconcileForm.categories.reduce((sum, cat) => sum + cat.lossAmount, 0);
    if (totalCategorized > reconcileForm.totalLossAmount) {
      toast({
        title: 'Error',
        description: `Total categorized losses (${totalCategorized}) exceed total losses (${reconcileForm.totalLossAmount}). Please adjust category amounts.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Calculate categorized and unaccounted amounts
      const unaccounted = reconcileForm.totalLossAmount - totalCategorized;

      // Find existing reconcile form (if any)
      let reconcileFormId: string | undefined = undefined;
      const reconcileForms = await masterDataService.getReconcileForms({ lossId: selectedLoss.id });
      if (reconcileForms.length > 0) {
        reconcileFormId = reconcileForms[0].id;
        // Delete all existing categories for this form
        const existingCategories: LossCategory[] = await masterDataService.getLossCategories({ reconcileFormId });
        for (const cat of existingCategories) {
          await masterDataService.deleteLossCategory(cat.id);
        }
      }

      const reconcileData: Omit<ReconcileForm, 'id' | 'createdAt' | 'updatedAt'> = {
        lossId: selectedLoss.id,
        totalLossAmount: reconcileForm.totalLossAmount,
        categorizedLossAmount: totalCategorized,
        unaccountedLossAmount: unaccounted,
        productionEvent: reconcileForm.productionEvent,
        comment: reconcileForm.comment,
        status: 'Draft',
        categories: [],
        tenantId: session.tenant.id
      };

      let savedReconcileForm;
      if (reconcileFormId) {
        savedReconcileForm = await masterDataService.updateReconcileForm(reconcileFormId, reconcileData);
      } else {
        savedReconcileForm = await masterDataService.createReconcileForm(reconcileData);
      }

      // Save individual loss categories
      for (const category of reconcileForm.categories) {
        await masterDataService.createLossCategory({
          reconcileFormId: savedReconcileForm.id,
          categoryName: category.categoryName,
          lossAmount: category.lossAmount,
          impactCodeId: category.impactCodeId,
          oeeCodeId: category.oeeCodeId,
          description: category.description,
          tenantId: session.tenant.id
        });
      }

      // Update the production loss with new unaccounted amount
      await masterDataService.updateProductionLoss(selectedLoss.id, {
        unaccountedLoss: unaccounted,
        action: unaccounted > 0 ? 'Reconcile' : 'Closed'
      });

      setShowReconcileModal(false);
      await loadDashboardData();
      
      toast({
        title: 'Success',
        description: 'Reconcile form saved successfully',
      });
    } catch (error) {
      console.error('Failed to save reconcile form:', error);
      toast({
        title: 'Error',
        description: 'Failed to save reconcile form',
        variant: 'destructive',
      });
    }
  };

  const handleCreateRCA = async () => {
    if (!selectedLoss || !session?.tenant?.id) return;

    try {
      const rcaData: any = {
        eventId: `loss_${selectedLoss.id}`,
        title: `RCA for Production Loss - ${selectedLoss.period}`,
        description: reconcileForm.comment || `Root cause analysis for production loss of ${selectedLoss.losses} units on ${selectedLoss.period}`,
        status: 'Draft',
        teamLeadId: session.user.id,
        teamMemberIds: [],
        priority: 'Medium',
        tenantId: session.tenant.id
      };

      await masterDataService.createRCA(rcaData);
      setShowReconcileModal(false);
      
      toast({
        title: 'Success',
        description: 'RCA created successfully',
      });
    } catch (error) {
      console.error('Failed to create RCA:', error);
      toast({
        title: 'Error',
        description: 'Failed to create RCA',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (loss: ProductionLoss) => {
    setSelectedLoss(loss);
    setEditForm({
      period: loss.period,
      actual: loss.actual,
      shortRangePlan: loss.shortRangePlan,
      losses: loss.losses,
      unaccountedLoss: loss.unaccountedLoss,
      action: loss.action
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedLoss) return;

    try {
      // Recalculate losses based on actual and planned values
      const { totalLosses, unaccountedLoss } = calculateLosses(editForm.actual, editForm.shortRangePlan);
      
      // Determine action based on whether there are losses
      const action = totalLosses > 0 ? 'Reconcile' : 'Closed';

      await masterDataService.updateProductionLoss(selectedLoss.id, {
        period: editForm.period,
        actual: editForm.actual,
        shortRangePlan: editForm.shortRangePlan,
        losses: totalLosses,
        unaccountedLoss: unaccountedLoss,
        action: action
      });

      setShowEditModal(false);
      await loadDashboardData();
      
      toast({
        title: 'Success',
        description: 'Production loss updated successfully',
      });
    } catch (error) {
      console.error('Failed to update production loss:', error);
      toast({
        title: 'Error',
        description: 'Failed to update production loss',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (loss: ProductionLoss) => {
    setLossToDelete(loss);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!lossToDelete) return;

    try {
      await masterDataService.deleteProductionLoss(lossToDelete.id);
      setShowDeleteDialog(false);
      setLossToDelete(null);
      await loadDashboardData();
      
      toast({
        title: 'Success',
        description: 'Production loss deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete production loss:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete production loss',
        variant: 'destructive',
      });
    }
  };

  const addSampleLoss = async () => {
    if (!session?.tenant?.id) return;

    try {
      const actualQuantity = plan.actualQuantity || 0;
      const plannedQuantity = plan.plannedQuantity;
      const { totalLosses, unaccountedLoss } = calculateLosses(actualQuantity, plannedQuantity);

      // Generate period based on template recurrence
      let period = '';
      if (plan.recurrence === 'Daily') {
        period = new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      } else if (plan.recurrence === 'Weekly') {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        period = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (plan.recurrence === 'Monthly') {
        period = new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
      } else {
        period = new Date().toISOString().split('T')[0];
      }

      const sampleLoss: Omit<ProductionLoss, 'id' | 'createdAt' | 'updatedAt'> = {
        planId: plan.id,
        period: period,
        actual: actualQuantity,
        shortRangePlan: plannedQuantity,
        losses: totalLosses,
        unaccountedLoss: unaccountedLoss,
        action: totalLosses > 0 ? 'Reconcile' : 'Closed',
        tenantId: session.tenant.id
      };

      await masterDataService.createProductionLoss(sampleLoss);
      await loadDashboardData();
      
      // Enhanced success message with template context
      let description = `Production loss calculated: ${totalLosses.toLocaleString()} ${getPlanUnitOfMeasure(plan)}`;
      if (plan.planBasis) {
        description += ` (${plan.planBasis} approach)`;
      }
      if (plan.dataEntryFrequency) {
        description += ` - ${plan.dataEntryFrequency} data collection`;
      }
      
      toast({
        title: 'Success',
        description: description,
      });
    } catch (error) {
      console.error('Failed to add sample loss:', error);
      toast({
        title: 'Error',
        description: 'Failed to calculate production loss',
        variant: 'destructive',
      });
    }
  };

  const calculateLossesFromProductionData = async () => {
    if (!session?.tenant?.id) return;

    try {
      const productionEvents = [
        {
          type: 'Production Output',
          duration: 8,
          impact: 'Output',
          quantity: 4200,
          description: 'Normal production output',
          cost: 0,
          status: 'Completed',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 8 * 3600000).toISOString(),
        },
        {
          type: 'Equipment Failure',
          duration: 2,
          impact: 'Availability',
          quantity: 1000,
          description: 'Unexpected equipment failure',
          cost: 2000,
          status: 'Completed',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 3600000).toISOString(),
        },
        {
          type: 'Quality Issue',
          duration: 1,
          impact: 'Quality',
          quantity: 500,
          description: 'Defective products',
          cost: 500,
          status: 'Completed',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 1 * 3600000).toISOString(),
        },
        {
          type: 'Setup Time',
          duration: 3,
          impact: 'Performance',
          quantity: 1500,
          description: 'Setup and adjustment',
          cost: 1000,
          status: 'Completed',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3 * 3600000).toISOString(),
        }
      ];

      // Calculate actual output from Production Output events
      const actualOutput = productionEvents
        .filter(event => event.type === 'Production Output')
        .reduce((sum, event) => sum + (event.quantity || 0), 0);
      const actualQuantity = actualOutput || plan.actualQuantity || 0;
      const plannedQuantity = plan.plannedQuantity;
      const { totalLosses, unaccountedLoss } = calculateLosses(actualQuantity, plannedQuantity);

      const calculatedLoss: Omit<ProductionLoss, 'id' | 'createdAt' | 'updatedAt'> = {
        planId: plan.id,
        period: new Date().toISOString().split('T')[0],
        actual: actualQuantity,
        shortRangePlan: plannedQuantity,
        losses: totalLosses,
        unaccountedLoss: unaccountedLoss,
        action: totalLosses > 0 ? 'Reconcile' : 'Closed',
        tenantId: session.tenant.id
      };

      await masterDataService.createProductionLoss(calculatedLoss);
      await loadDashboardData();
      
      toast({
        title: 'Success',
        description: `Losses calculated from production events: ${totalLosses.toLocaleString()} ${getPlanUnitOfMeasure(plan)}`,
      });
    } catch (error) {
      console.error('Failed to calculate losses from production data:', error);
      toast({
        title: 'Error',
        description: 'Failed to calculate losses from production data',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    async function fetchEvents() {
      if (!plan.id || !tenantId) return;
      const events = await masterDataService.getProductionEvents({ tenantId });
      setProductionEvents(events.filter(e => e.planId === plan.id));
    }
    fetchEvents();
  }, [plan.id, tenantId]);

  // Auto-calculate actualQuantity from ProductionOutput events
  const autoActualQuantity = productionEvents
    .filter(e => e.eventType === 'ProductionOutput')
    .reduce((sum, e) => sum + (e.quantity || 0), 0);

  // Add this function inside the component:
  const handleSyncActualQuantity = async () => {
    if (!plan.id) return;
    
    console.log('Syncing actual quantity:', {
      planId: plan.id,
      currentActualQuantity: plan.actualQuantity,
      autoActualQuantity: autoActualQuantity,
      willUpdateTo: autoActualQuantity
    });
    
    try {
      await masterDataService.updateProductionPlan(plan.id, { actualQuantity: autoActualQuantity });
      
      // Update the plan object locally to reflect the change immediately
      const updatedPlan = { ...plan, actualQuantity: autoActualQuantity };
      
      // Notify parent component of the update
      if (onPlanUpdate) {
        onPlanUpdate(updatedPlan);
      }
      
      toast({ 
        title: 'Synced Successfully', 
        description: `Manual value updated from ${plan.actualQuantity || 0} to ${autoActualQuantity.toLocaleString()}` 
      });
      
      // Reload dashboard data to get fresh data
      await loadDashboardData();
      
      console.log('Sync completed:', {
        planId: plan.id,
        updatedActualQuantity: autoActualQuantity,
        parentNotified: !!onPlanUpdate
      });
      
    } catch (error) {
      console.error('Failed to sync actual quantity:', error);
      toast({ 
        title: 'Sync Failed', 
        description: 'Failed to update manual actual quantity. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleOpenUnmappedModal = async () => {
    setShowUnmappedModal(true);
  };

  // Load available events when event selector opens
  useEffect(() => {
    if (showEventSelector && tenantId) {
      const loadAvailableEvents = async () => {
        try {
          const events = await masterDataService.getProductionEvents({ 
            tenantId,
            unitId: plan.unitId 
          });
          setAvailableEvents(events);
        } catch (error) {
          console.error('Failed to load available events:', error);
          setAvailableEvents([]);
        }
      };
      loadAvailableEvents();
    }
  }, [showEventSelector, tenantId, plan.unitId]);

  useEffect(() => {
    if (showUnmappedModal) {
      (async () => {
        if (session?.tenant?.id) {
          const events = await masterDataService.getUnmappedEvents({ tenantId: session.tenant.id });
          setUnmappedEvents(events);
        } else {
          setUnmappedEvents([]);
        }
      })();
    }
  }, [showUnmappedModal, session?.tenant?.id]);

  // Manual assignment handler
  const handleAssignToPlan = async (unmapped: any) => {
    setAssigningEventId(unmapped.event.id || unmapped.event.eventId);
    setSelectedPlanId(null);
    // Fetch plans for the event's unit
    if (unmapped.event.unitId && tenantId) {
      const plans = await masterDataService.getProductionPlans({ unitId: unmapped.event.unitId, tenantId });
      setAvailablePlans(plans);
    } else {
      setAvailablePlans([]);
    }
  };

  const handleConfirmAssignment = async (unmapped: any) => {
    if (!selectedPlanId || !unmapped.event.id) return;
    try {
      // Update the production event's planId
      await masterDataService.updateProductionEvent(unmapped.event.id, { planId: selectedPlanId });
      // Remove unmapped event
      await masterDataService.deleteUnmappedEvent(unmapped.id);
      // Log audit
      if (session?.user && session?.tenant && session?.organization) {
        await auditService.logUpdate(
          'ProductionEvent',
          unmapped.event.id,
          unmapped.event.eventId || 'Unknown',
          session.user.id,
          session.user.name,
          session.organization.id,
          session.tenant.id,
          `Manually assigned to plan ${selectedPlanId}`
        );
      }
      toast({
        title: 'Event Assigned',
        description: 'Production event was manually assigned to a plan.',
      });
      setAssigningEventId(null);
      setSelectedPlanId(null);
      // Refresh unmapped events
      if (session?.tenant?.id) {
        const events = await masterDataService.getUnmappedEvents({ tenantId: session.tenant.id });
        setUnmappedEvents(events);
      }
    } catch (error) {
      toast({
        title: 'Assignment Failed',
        description: 'Could not assign event to plan.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelAssignment = () => {
    setAssigningEventId(null);
    setSelectedPlanId(null);
  };

  if (configLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">
            {configLoading ? 'Loading dashboard configuration...' : 'Loading dashboard data...'}
          </p>
        </div>
      </div>
    );
  }

  if (!plan || !unit) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-lg text-gray-700">
          {!tenantId
            ? 'Select a plant to view this dashboard.'
            : 'Could not load unit data for this plan.'}
        </div>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Plans
        </Button>
      </div>
    );
  }

  // Debug logging for template data
  console.log('PlanDashboard Debug - Template Data:', {
    planBasis: plan.planBasis,
    recurrence: plan.recurrence,
    dataEntryFrequency: plan.dataEntryFrequency,
    usefulProductionTime: plan.usefulProductionTime,
    hasTemplateData: !!(plan.planBasis || plan.recurrence || plan.dataEntryFrequency || plan.usefulProductionTime)
  });

  // Function to populate missing template data for demonstration
  const populateTemplateData = () => {
    if (!plan.planBasis && !plan.recurrence && !plan.dataEntryFrequency && !plan.usefulProductionTime) {
      // Add default template data for demonstration
      const enhancedPlan = {
        ...plan,
        planBasis: 'Time-based',
        recurrence: 'Daily',
        dataEntryFrequency: 'Daily',
        usefulProductionTime: {
          'Monday': { start: '08:00', end: '16:00' },
          'Tuesday': { start: '08:00', end: '16:00' },
          'Wednesday': { start: '08:00', end: '16:00' },
          'Thursday': { start: '08:00', end: '16:00' },
          'Friday': { start: '08:00', end: '16:00' },
        }
      };
      
      // Update the plan in storage
      masterDataService.updateProductionPlan(plan.id, enhancedPlan);
      
      // Force re-render by updating the plan object
      Object.assign(plan, enhancedPlan);
      
      toast({
        title: 'Template Data Added',
        description: 'Default template configuration has been added to this plan for demonstration purposes.',
      });
    }
  };

  // UI warnings for missing OEE data
  const isMissingOeeCodes = impactCodes.length === 0 || oeeCodes.length === 0;

  // Helper for smooth scroll with offset
  const scrollToSection = (ref: React.RefObject<HTMLDivElement>, sectionId: string) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        window.scrollBy({ top: -64, left: 0, behavior: 'smooth' });
      }, 100); // Wait for scrollIntoView to finish
      setActiveSection(sectionId);
    }
  };

  return (
    <div className="space-y-6 relative pt-0 scroll-smooth bg-gradient-to-br from-white via-blue-50 to-purple-50 min-h-screen rounded-2xl shadow-2xl border border-blue-200">
      {/* Blurred background above nav bar */}
      <div className="fixed top-0 left-0 w-full h-20 z-20 pointer-events-none backdrop-blur-3xl bg-white/40" />
      {/* Fixed gradient background behind nav for visible blur */}
      <div className="fixed top-0 left-0 w-full h-[80px] z-10 pointer-events-none bg-gradient-to-r from-blue-200/60 via-purple-200/60 to-emerald-200/60" />
      {/* Sticky/Floating Navigation Bar - now flush with top */}
      <nav
        className={`sticky top-0 z-30 py-3 px-6 flex items-center gap-4 rounded-b-2xl mb-0 transition-all duration-300 border-b shadow-2xl
          ${isNavBlurred ? 'backdrop-blur-3xl bg-white/60 border-blue-300' : 'bg-gradient-to-r from-white via-blue-50 to-purple-50 border-blue-200'}`}
      >
        <a href="#overview" onClick={e => { e.preventDefault(); scrollToSection(overviewRef, 'overview'); }} className={`text-blue-700 font-semibold flex items-center gap-1 transition-colors hover:underline ${activeSection === 'overview' ? 'underline underline-offset-4 bg-blue-200 border border-blue-400 shadow font-bold rounded px-2 py-1' : ''}`}><BarChart3 className="w-4 h-4" /> Overview</a>
        <a href="#performance" onClick={e => { e.preventDefault(); scrollToSection(performanceRef, 'performance'); }} className={`text-blue-700 font-semibold flex items-center gap-1 transition-colors hover:underline ${activeSection === 'performance' ? 'underline underline-offset-4 bg-blue-200 border border-blue-400 shadow font-bold rounded px-2 py-1' : ''}`}><Gauge className="w-4 h-4" /> Performance & OEE</a>
        <a href="#losses" onClick={e => { e.preventDefault(); scrollToSection(lossesRef, 'losses'); }} className={`text-red-700 font-semibold flex items-center gap-1 transition-colors hover:underline ${activeSection === 'losses' ? 'underline underline-offset-4 bg-red-200 border border-red-400 shadow font-bold rounded px-2 py-1' : ''}`}><AlertTriangle className="w-4 h-4" /> Losses & Financial</a>
        <a href="#capacity" onClick={e => { e.preventDefault(); scrollToSection(capacityRef, 'capacity'); }} className={`text-purple-700 font-semibold flex items-center gap-1 transition-colors hover:underline ${activeSection === 'capacity' ? 'underline underline-offset-4 bg-purple-200 border border-purple-400 shadow font-bold rounded px-2 py-1' : ''}`}><Settings className="w-4 h-4" /> Resource & Capacity</a>
        <a href="#actions" onClick={e => { e.preventDefault(); scrollToSection(actionsRef, 'actions'); }} className={`text-emerald-700 font-semibold flex items-center gap-1 transition-colors hover:underline ${activeSection === 'actions' ? 'underline underline-offset-4 bg-emerald-200 border border-emerald-400 shadow font-bold rounded px-2 py-1' : ''}`}><ClipboardList className="w-4 h-4" /> Actions & Alerts</a>
        <div className="flex-1" />
        <Button variant="outline" className="flex items-center gap-2 ml-auto" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
          Back to Plans
        </Button>
        <Button variant="outline" onClick={handleOpenUnmappedModal} className="ml-4">Unmapped Events</Button>
      </nav>

      {/* Overview Card */}
      <div id="overview" className="scroll-mt-20" ref={overviewRef}>
        <Card className="bg-gradient-to-r from-blue-100 via-purple-100 to-emerald-100 border-0 shadow-lg rounded-2xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              <CardTitle className="text-2xl font-bold tracking-tight">Overview</CardTitle>
            </div>
            <div className="flex space-x-2">
              {plan.status && (
                <Badge variant="outline" className="text-xs capitalize bg-white/80 border-emerald-400 text-emerald-700">
                  {plan.status}
                </Badge>
              )}
              {plan.planBasis && (
                <Badge variant="outline" className="text-xs bg-white/80 border-indigo-400 text-indigo-700">
                  {plan.planBasis}
                </Badge>
              )}
              {plan.recurrence && (
                <Badge variant="outline" className="text-xs bg-white/80 border-blue-400 text-blue-700">
                  {plan.recurrence}
                </Badge>
              )}
              {plan.dataEntryFrequency && (
                <Badge variant="outline" className="text-xs bg-white/80 border-purple-400 text-purple-700">
                  {plan.dataEntryFrequency} Data Entry
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Overall OEE */}
              <div className="flex flex-col items-center justify-center space-y-1">
                <div className="flex items-center space-x-2">
                  <Gauge className="w-6 h-6 text-blue-600" />
                  <span className="text-lg font-semibold text-blue-900">OEE</span>
                </div>
                <div className="text-3xl font-bold text-blue-800">
                  {(oeeSummary?.overallOEE != null && !isNaN(oeeSummary.overallOEE)) ? oeeSummary.overallOEE.toFixed(1) : '0.0'}%
                </div>
                <span className="text-xs text-gray-500">Overall Equipment Effectiveness</span>
              </div>
              {/* Plan Achievement */}
              <div className="flex flex-col items-center justify-center space-y-1">
                <div className="flex items-center space-x-2">
                  <Target className="w-6 h-6 text-emerald-600" />
                  <span className="text-lg font-semibold text-emerald-900">Achievement</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-muted-foreground">Actual (Manual):</span>
                    <span>{plan.actualQuantity?.toLocaleString() || 0}</span>
                    {plan.actualQuantity !== autoActualQuantity && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-400">Manual override</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-muted-foreground">Actual (Auto):</span>
                    <span>{autoActualQuantity.toLocaleString()}</span>
                    <Button size="sm" variant="outline" onClick={handleSyncActualQuantity}>
                      Sync
                    </Button>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{plan.plannedQuantity?.toLocaleString() || 0} {getPlanUnitOfMeasure(plan)}</span>
              </div>
              {/* Total Losses */}
              <div className="flex flex-col items-center justify-center space-y-1">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <span className="text-lg font-semibold text-red-900">Losses</span>
                </div>
                <div className="text-3xl font-bold text-red-700">
                  {losses.reduce((sum, loss) => sum + (loss.losses || 0), 0).toLocaleString()}
                </div>
                <span className="text-xs text-gray-500">Total Losses (units)</span>
              </div>
              {/* Capacity Utilization */}
              <div className="flex flex-col items-center justify-center space-y-1">
                <div className="flex items-center space-x-2">
                  <Gauge className="w-6 h-6 text-purple-600" />
                  <span className="text-lg font-semibold text-purple-900">Capacity</span>
                </div>
                <div className="text-3xl font-bold text-purple-800">
                  {plan.usefulProductionTime ? Math.round((Object.keys(plan.usefulProductionTime).filter(day => plan.usefulProductionTime?.[day]?.start).length / 7) * 100) : 0}%
                </div>
                <span className="text-xs text-gray-500">Utilization (days active)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Performance & OEE Section --- */}
      <div id="performance" className="scroll-mt-20" ref={performanceRef}>
        <div className="pt-2 pb-1 flex items-center space-x-3">
          <BarChart3 className="w-5 h-5 text-blue-700" />
          <h3 className="text-xl font-bold text-blue-900 tracking-tight">Performance & OEE</h3>
          <div className="flex-1 border-b border-blue-200 ml-2" />
        </div>
        {/* OEE Summary */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span>OEE Summary</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="p-1 h-6 w-6 text-blue-600" aria-label="OEE Info">
                    <Info className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-sm">
                  <div className="font-semibold mb-1">What is OEE?</div>
                  <div className="mb-2">OEE (Overall Equipment Effectiveness) is a measure of how well a manufacturing operation is utilized compared to its full potential. It is calculated as:</div>
                  <div className="mb-2"><b>OEE = Availability × Performance × Quality</b></div>
                  <ul className="list-disc pl-5 mb-2">
                    <li><b>Availability</b>: % of scheduled time the equipment is available to operate.</li>
                    <li><b>Performance</b>: % of maximum speed the equipment is running.</li>
                    <li><b>Quality</b>: % of good units produced vs. total units started.</li>
                  </ul>
                  <div className="text-xs text-gray-500">Hover over each metric for more details and tips.</div>
                </PopoverContent>
              </Popover>
            </CardTitle>
            <CardDescription>
              Overall Equipment Effectiveness metrics for {oeeSummary?.period || 'Current Period'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Availability Donut with Tooltip */}
              <Popover>
                <PopoverTrigger asChild>
                  <div>
                    <DonutChart
                      value={oeeSummary?.availability || 0}
                      label="Availability"
                      color="#3b82f6"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">
                  <div className="font-semibold mb-1">Availability</div>
                  <div className="mb-2">Measures the percentage of scheduled time that the equipment is available to operate.</div>
                  <div className="mb-2">Common reasons for low Availability:</div>
                  <ul className="list-disc pl-5">
                    <li>Unplanned downtime (breakdowns, failures)</li>
                    <li>Long changeovers or setups</li>
                    <li>Equipment not started on time</li>
                  </ul>
                </PopoverContent>
              </Popover>
              {/* Performance Donut with Tooltip */}
              <Popover>
                <PopoverTrigger asChild>
                  <div>
                    <DonutChart
                      value={oeeSummary?.performance || 0}
                      label="Performance"
                      color="#10b981"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">
                  <div className="font-semibold mb-1">Performance</div>
                  <div className="mb-2">Measures how fast the equipment runs as a percentage of its designed speed.</div>
                  <div className="mb-2">Common reasons for low Performance:</div>
                  <ul className="list-disc pl-5">
                    <li>Slow cycles</li>
                    <li>Small stops or micro-stoppages</li>
                    <li>Reduced speed due to suboptimal settings</li>
                  </ul>
                </PopoverContent>
              </Popover>
              {/* Quality Donut with Tooltip */}
              <Popover>
                <PopoverTrigger asChild>
                  <div>
                    <DonutChart
                      value={oeeSummary?.quality || 0}
                      label="Quality"
                      color="#f59e0b"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">
                  <div className="font-semibold mb-1">Quality</div>
                  <div className="mb-2">Measures the percentage of good units produced out of total units started.</div>
                  <div className="mb-2">Common reasons for low Quality:</div>
                  <ul className="list-disc pl-5">
                    <li>Defects and rework</li>
                    <li>Start-up rejects</li>
                    <li>Incorrect settings or materials</li>
                  </ul>
                </PopoverContent>
              </Popover>
              {/* Overall OEE with Why Low Tooltip */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="text-4xl font-bold text-gray-900">
                    {oeeSummary?.overallOEE.toFixed(1) || '0.0'}%
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="p-1 h-6 w-6 text-blue-600" aria-label="Why is my OEE low?">
                        <HelpCircle className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm">
                      <div className="font-semibold mb-1">Why is my OEE low?</div>
                      <div className="mb-2">OEE is the product of Availability, Performance, and Quality. If your OEE is low, check which component is lowest and address its root causes.</div>
                      <div className="mb-2">Tips to improve OEE:</div>
                      <ul className="list-disc pl-5">
                        <li>Reduce unplanned downtime (improve maintenance)</li>
                        <li>Optimize changeover and setup times</li>
                        <li>Increase equipment speed and reduce micro-stops</li>
                        <li>Improve quality by reducing defects and rework</li>
                        <li>Train operators and standardize best practices</li>
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="text-sm text-gray-600">Overall OEE</div>
                <div className="text-xs text-gray-500">
                  {oeeSummary?.availability.toFixed(1) || '0.0'}% × {oeeSummary?.performance.toFixed(1) || '0.0'}% × {oeeSummary?.quality.toFixed(1) || '0.0'}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Losses & Financial Section --- */}
      <div id="losses" className="scroll-mt-20" ref={lossesRef}>
        <div className="pt-6 pb-1 flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-700" />
          <h3 className="text-xl font-bold text-red-900 tracking-tight">Losses & Financial</h3>
          <div className="flex-1 border-b border-red-200 ml-2" />
        </div>
        {/* Production Losses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <span>Production Losses</span>
                </CardTitle>
                <CardDescription>
                  Track and reconcile production losses against planned targets
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={addSampleLoss}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Calculate from Plan
                </Button>
                <Button 
                  variant="outline" 
                  onClick={calculateLossesFromProductionData}
                  className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-purple-100"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Calculate from Events
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {/* Data Sources Information */}
          <div className="px-6 pb-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Production Loss Data Sources & Template Insights
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-blue-800 mb-1">Automated Sources:</h5>
                  <ul className="space-y-1 text-blue-700">
                    <li>• MES (Manufacturing Execution System)</li>
                    <li>• Equipment Monitoring Systems</li>
                    <li>• Quality Management Systems</li>
                    <li>• Maintenance Management Systems</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-800 mb-1">Manual Sources:</h5>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Operator Input & Observations</li>
                    <li>• Production Reports</li>
                    <li>• Quality Inspections</li>
                    <li>• Maintenance Records</li>
                  </ul>
                </div>
              </div>
              
              {/* Template-based Insights */}
              {(plan.planBasis || plan.dataEntryFrequency) && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h5 className="font-medium text-blue-800 mb-2">Template-Based Insights:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-700">Plan Basis:</span>
                      <p className="text-blue-600">
                        {plan.planBasis === 'Time-based' && 'Losses calculated based on available production time'}
                        {plan.planBasis === 'Quantity-based' && 'Losses calculated based on target production quantities'}
                        {plan.planBasis === 'Demand-based' && 'Losses calculated based on customer demand requirements'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-700">Data Collection:</span>
                      <p className="text-blue-600">
                        {plan.dataEntryFrequency === 'Hourly' && 'Real-time monitoring with hourly data collection'}
                        {plan.dataEntryFrequency === 'Daily' && 'Daily production summaries and loss tracking'}
                        {plan.dataEntryFrequency === 'Weekly' && 'Weekly aggregated production and loss analysis'}
                        {plan.dataEntryFrequency === 'Monthly' && 'Monthly production performance and loss review'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <CardContent>
            {losses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Short Range Plan</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Unaccounted Loss</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {losses.map((loss) => {
                    const validation = validateLossCalculation(loss.actual, loss.shortRangePlan, loss.losses, loss.unaccountedLoss);
                    
                    return (
                      <TableRow key={loss.id} className={!validation.isValid ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">{loss.period}</TableCell>
                        <TableCell className="text-right">{(loss.actual || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(loss.shortRangePlan || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">
                          <div className="flex items-center justify-end space-x-2">
                            <span>{(loss.losses || 0).toLocaleString()}</span>
                            {!validation.isValid && (
                              <div className="relative group">
                                <XCircle className="w-4 h-4 text-red-500 cursor-help" />
                                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  {validation.message}
                                </div>
                              </div>
                            )}
                            {validation.isValid && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {(loss.unaccountedLoss || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {loss.action === 'Reconcile' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReconcile(loss)}
                                className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-purple-100"
                              >
                                <Calculator className="w-4 h-4 mr-1" />
                                Reconcile
                              </Button>
                            ) : (
                              <Badge variant={loss.action === 'Closed' ? 'secondary' : 'destructive'}>
                                {loss.action}
                              </Badge>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg">
                                <DropdownMenuItem onClick={() => handleViewLossBreakdown(loss)} className="cursor-pointer">
                                  <BarChart3 className="w-4 h-4 mr-2" />
                                  View Breakdown
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(loss)} className="cursor-pointer">
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(loss)} 
                                  className="cursor-pointer text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Losses Found</h3>
                <p className="text-sm text-gray-500 mb-4">
                  No production losses have been recorded for this plan yet.
                </p>
                <div className="flex justify-center space-x-2">
                  <Button onClick={addSampleLoss} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Calculate from Plan
                  </Button>
                  <Button onClick={calculateLossesFromProductionData} variant="outline">
                    <Activity className="w-4 h-4 mr-2" />
                    Calculate from Events
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Impact Dashboard */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              <span>Financial Impact Dashboard</span>
            </CardTitle>
            <CardDescription>
              Cost analysis, revenue impact, and financial performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Loss Value */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Total Loss Value</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-red-200">
                  <div className="text-lg font-semibold text-red-800">
                    {(dashboardConfig?.display?.currencySymbol || '$') + 
                     (losses.reduce((sum, loss) => sum + (loss.losses || 0), 0) * 
                      (dashboardConfig?.losses?.lossValuePerUnit || 100)).toLocaleString()}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Estimated at {(dashboardConfig?.display?.currencySymbol || '$') + 
                    (dashboardConfig?.losses?.lossValuePerUnit || 100)}/unit
                  </div>
                </div>
              </div>

              {/* Unaccounted Loss Value */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Unaccounted Loss</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-orange-200">
                  <div className="text-lg font-semibold text-orange-800">
                    {(dashboardConfig?.display?.currencySymbol || '$') + 
                     (losses.reduce((sum, loss) => sum + (loss.unaccountedLoss || 0), 0) * 
                      (dashboardConfig?.losses?.lossValuePerUnit || 100)).toLocaleString()}
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    Requires investigation
                  </div>
                </div>
              </div>

              {/* Production Event Costs */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Event Costs</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <div className="text-lg font-semibold text-blue-800">
                    {(dashboardConfig?.display?.currencySymbol || '$') + 
                     productionEvents.reduce((sum, event) => sum + (event.cost || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {productionEvents.length} events tracked
                  </div>
                </div>
              </div>

              {/* Cost per Unit */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Cost per Unit</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-green-200">
                  <div className="text-lg font-semibold text-green-800">
                    {(dashboardConfig?.display?.currencySymbol || '$') + 
                     (plan.actualQuantity && plan.actualQuantity > 0 ? 
                      Math.round((losses.reduce((sum, loss) => sum + (loss.losses || 0), 0) * 
                       (dashboardConfig?.losses?.lossValuePerUnit || 100)) / plan.actualQuantity) : 0)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Loss cost per produced unit
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Analysis */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                Financial Analysis & Impact Assessment
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Loss Breakdown:</h5>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Total Losses: {losses.reduce((sum, loss) => sum + (loss.losses || 0), 0).toLocaleString()} {getPlanUnitOfMeasure(plan)}</li>
                    <li>• Accounted: {(losses.reduce((sum, loss) => sum + (loss.losses || 0), 0) - losses.reduce((sum, loss) => sum + (loss.unaccountedLoss || 0), 0)).toLocaleString()} {getPlanUnitOfMeasure(plan)}</li>
                    <li>• Unaccounted: {losses.reduce((sum, loss) => sum + (loss.unaccountedLoss || 0), 0).toLocaleString()} {getPlanUnitOfMeasure(plan)}</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Cost Impact:</h5>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Loss Value: {(dashboardConfig?.display?.currencySymbol || '$') + 
                       (losses.reduce((sum, loss) => sum + (loss.losses || 0), 0) * 
                        (dashboardConfig?.losses?.lossValuePerUnit || 100)).toLocaleString()}</li>
                    <li>• Event Costs: {(dashboardConfig?.display?.currencySymbol || '$') + 
                       productionEvents.reduce((sum, event) => sum + (event.cost || 0), 0).toLocaleString()}</li>
                    <li>• Total Impact: {(dashboardConfig?.display?.currencySymbol || '$') + 
                       ((losses.reduce((sum, loss) => sum + (loss.losses || 0), 0) * 
                         (dashboardConfig?.losses?.lossValuePerUnit || 100)) + 
                        productionEvents.reduce((sum, event) => sum + (event.cost || 0), 0)).toLocaleString()}</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Recommendations:</h5>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Investigate unaccounted losses</li>
                    <li>• Reduce event-related costs</li>
                    <li>• Optimize production efficiency</li>
                    <li>• Implement cost controls</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Resource & Capacity Section --- */}
      <div id="capacity" className="scroll-mt-20" ref={capacityRef}>
        <div className="pt-6 pb-1 flex items-center space-x-3">
          <Gauge className="w-5 h-5 text-purple-700" />
          <h3 className="text-xl font-bold text-purple-900 tracking-tight">Resource & Capacity</h3>
          <div className="flex-1 border-b border-purple-200 ml-2" />
        </div>
        {/* Production Schedule */}
        {plan.usefulProductionTime && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-6 h-6 text-green-600" />
                <span>Production Schedule</span>
              </CardTitle>
              <CardDescription>
                Working hours and production time allocation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const schedule = plan.usefulProductionTime?.[day];
                  const isWorkingDay = schedule?.start && schedule?.end;
                  return (
                    <div key={day} className="flex items-center justify-between p-2 rounded-lg bg-white/50">
                      <span className="text-sm font-medium text-gray-700 w-20">{day.slice(0, 3)}</span>
                      {isWorkingDay ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-green-700 font-mono">
                            {formatTimeDisplay(schedule.start)} - {formatTimeDisplay(schedule.end)}
                          </span>
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                            Active
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">No production</span>
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-500">
                            Off
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Total Production Hours */}
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-800">
                    {calculateTotalProductionHours(plan.usefulProductionTime)}h
                  </div>
                  <div className="text-sm text-green-700">Total Weekly Production Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resource & Capacity Management */}
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-6 h-6 text-orange-600" />
              <span>Resource & Capacity Management</span>
            </CardTitle>
            <CardDescription>
              Equipment status, capacity utilization, and bottleneck analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Capacity Utilization */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Gauge className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Capacity Utilization</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-orange-200">
                  <div className="text-lg font-semibold text-orange-800">
                    {plan.usefulProductionTime ? 
                      Math.round((Object.keys(plan.usefulProductionTime).filter(day => plan.usefulProductionTime?.[day]?.start).length / 7) * 100) : 0}%
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    {plan.usefulProductionTime ? 
                      `${Object.keys(plan.usefulProductionTime).filter(day => plan.usefulProductionTime?.[day]?.start).length}/7 days active` : 
                      'No schedule defined'
                    }
                  </div>
                </div>
              </div>

              {/* Production Hours */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Scheduled Hours</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-orange-200">
                  <div className="text-lg font-semibold text-orange-800">
                    {plan.usefulProductionTime ? calculateTotalProductionHours(plan.usefulProductionTime) : 0}h
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    Weekly production time
                  </div>
                </div>
              </div>

              {/* Equipment Status */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Equipment Status</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-orange-200">
                  <div className="text-lg font-semibold text-orange-800">
                    Active
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    {plan.status === 'Active' ? 'Currently operational' : 'Standby mode'}
                  </div>
                </div>
              </div>

              {/* Bottleneck Indicator */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Bottleneck Risk</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-red-200">
                  {(() => {
                    // Calculate bottleneck risk using configuration
                    const totalLosses = losses.reduce((sum, loss) => sum + loss.losses, 0);
                    const totalCosts = productionEvents.reduce((sum, event) => sum + (event.cost || 0), 0);
                    const currentOEE = oeeSummary?.overallOEE || 0;
                    
                    // Normalize values
                    const lossRisk = totalLosses / (plan.plannedQuantity || 1);
                    const costRisk = totalCosts / (dashboardConfig?.costs?.criticalCostThreshold || 50000);
                    const oeeRisk = 1 - (currentOEE / 100);
                    
                    // Apply weights from configuration
                    const lossWeight = dashboardConfig?.bottleneckRisk?.lossWeight || 0.4;
                    const costWeight = dashboardConfig?.bottleneckRisk?.costWeight || 0.3;
                    const oeeWeight = dashboardConfig?.bottleneckRisk?.oeeWeight || 0.3;
                    
                    const riskScore = (lossRisk * lossWeight) + (costRisk * costWeight) + (oeeRisk * oeeWeight);
                    
                    // Determine risk level using configuration thresholds
                    const lowThreshold = dashboardConfig?.bottleneckRisk?.lowRiskThreshold || 0.3;
                    const mediumThreshold = dashboardConfig?.bottleneckRisk?.mediumRiskThreshold || 0.6;
                    const highThreshold = dashboardConfig?.bottleneckRisk?.highRiskThreshold || 0.8;
                    
                    let riskLevel = 'Low';
                    let riskColor = 'text-green-800';
                    let borderColor = 'border-green-200';
                    let bgColor = 'bg-green-100';
                    let description = 'Normal operation';
                    
                    if (riskScore >= highThreshold) {
                      riskLevel = 'High';
                      riskColor = 'text-red-800';
                      borderColor = 'border-red-200';
                      bgColor = 'bg-red-100';
                      description = 'Significant losses detected';
                    } else if (riskScore >= mediumThreshold) {
                      riskLevel = 'Medium';
                      riskColor = 'text-orange-800';
                      borderColor = 'border-orange-200';
                      bgColor = 'bg-orange-100';
                      description = 'Moderate concerns';
                    } else if (riskScore >= lowThreshold) {
                      riskLevel = 'Low';
                      riskColor = 'text-yellow-800';
                      borderColor = 'border-yellow-200';
                      bgColor = 'bg-yellow-100';
                      description = 'Minor issues';
                    }
                    
                    return (
                      <div className={`p-3 rounded-lg border ${borderColor} ${bgColor}`}>
                        <div className={`text-lg font-semibold ${riskColor}`}>
                          {riskLevel}
                        </div>
                        <div className={`text-xs ${riskColor} mt-1`}>
                          {description}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Capacity Analysis */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Capacity Analysis & Recommendations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Current Capacity:</h5>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Planned Output: {plan.plannedQuantity.toLocaleString()} {getPlanUnitOfMeasure(plan)}</li>
                    <li>• Production Days: {plan.usefulProductionTime ? Object.keys(plan.usefulProductionTime).filter(day => plan.usefulProductionTime?.[day]?.start).length : 0} days/week</li>
                    <li>• Weekly Hours: {plan.usefulProductionTime ? calculateTotalProductionHours(plan.usefulProductionTime) : 0} hours</li>
                    <li>• Rate Required: {plan.usefulProductionTime ? Math.round(plan.plannedQuantity / (calculateTotalProductionHours(plan.usefulProductionTime) * 4)) : 0} {getPlanUnitOfMeasure(plan)}/hour</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Bottleneck Analysis:</h5>
                  <ul className="space-y-1 text-blue-700">
                    {(() => {
                      const highLossThreshold = dashboardConfig?.losses?.highLossThreshold || 10;
                      const hasHighLosses = losses.length > 0 && 
                        losses.some(loss => loss.losses > plan.plannedQuantity * (highLossThreshold / 100));
                      
                      return hasHighLosses ? (
                        <>
                          <li>• High loss rate detected</li>
                          <li>• Consider capacity expansion</li>
                          <li>• Review equipment maintenance</li>
                          <li>• Optimize production schedule</li>
                        </>
                      ) : (
                        <>
                          <li>• Normal operation levels</li>
                          <li>• Capacity utilization optimal</li>
                          <li>• Continue monitoring</li>
                          <li>• Focus on efficiency gains</li>
                        </>
                      );
                    })()}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Actions & Alerts Section --- */}
      <div id="actions" className="scroll-mt-20" ref={actionsRef}>
        <div className="pt-6 pb-1 flex items-center space-x-3">
          <ClipboardList className="w-5 h-5 text-emerald-700" />
          <h3 className="text-xl font-bold text-emerald-900 tracking-tight">Actions & Alerts</h3>
          <div className="flex-1 border-b border-emerald-200 ml-2" />
        </div>
        {/* Action Items & Alerts */}
        <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <span>Action Items & Alerts</span>
            </CardTitle>
            <CardDescription>
              Priority actions, escalation alerts, and improvement opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Critical Actions */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Critical Actions</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-red-200">
                  <div className="text-lg font-semibold text-red-800">
                    {losses.filter(loss => loss.action === 'RCA Required').length}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Require immediate attention
                  </div>
                </div>
              </div>

              {/* Pending Reconciliation */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Pending Reconciliation</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-orange-200">
                  <div className="text-lg font-semibold text-orange-800">
                    {losses.filter(loss => loss.action === 'Reconcile').length}
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    Losses to be reconciled
                  </div>
                </div>
              </div>

              {/* Open Events */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Open Events</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <div className="text-lg font-semibold text-blue-800">
                    {productionEvents.filter(event => event.status === 'Open').length}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Events requiring action
                  </div>
                </div>
              </div>

              {/* Improvement Opportunities */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Improvement Opportunities</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-green-200">
                  <div className="text-lg font-semibold text-green-800">
                    {losses.length > 0 ? Math.min(5, Math.ceil(losses.reduce((sum, loss) => sum + (loss.losses || 0), 0) / 1000)) : 0}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Areas identified
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Action List */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                <ClipboardList className="w-4 h-4 mr-2" />
                Priority Action List
              </h4>
              <div className="space-y-3">
                {losses.filter(loss => loss.action === 'RCA Required').map((loss, index) => (
                  <div key={loss.id} className="flex items-center justify-between p-3 bg-red-100 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <div>
                        <div className="font-medium text-red-800">RCA Required - {loss.period}</div>
                        <div className="text-sm text-red-600">
                          {(loss.losses || 0).toLocaleString()} {getPlanUnitOfMeasure(plan)} lost, requires root cause analysis
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-300">
                      Create RCA
                    </Button>
                  </div>
                ))}
                
                {losses.filter(loss => loss.action === 'Reconcile').slice(0, 3).map((loss, index) => (
                  <div key={loss.id} className="flex items-center justify-between p-3 bg-orange-100 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-3">
                      <Calculator className="w-5 h-5 text-orange-600" />
                      <div>
                        <div className="font-medium text-orange-800">Reconcile Losses - {loss.period}</div>
                        <div className="text-sm text-orange-600">
                          {(loss.losses || 0).toLocaleString()} {getPlanUnitOfMeasure(plan)} to reconcile
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-orange-700 border-orange-300">
                      Reconcile
                    </Button>
                  </div>
                ))}
                
                {losses.filter(loss => loss.action === 'Reconcile').length === 0 && losses.filter(loss => loss.action === 'RCA Required').length === 0 && (
                  <div className="flex items-center justify-center p-4 bg-green-100 rounded-lg border border-green-200">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-green-800 font-medium">All actions completed - Excellent performance!</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconcile Modal */}
      <Dialog open={showReconcileModal} onOpenChange={setShowReconcileModal}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-blue-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900">
              <Calculator className="w-6 h-6 text-blue-600" />
              <span>Reconcile Production Loss</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Document the root cause and impact of production losses for {selectedLoss?.period}
              {plan.planBasis && (
                <span className="block mt-1 text-sm text-blue-600">
                  💡 Using {plan.planBasis} approach for loss calculation
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Loss Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">Loss Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Losses:</span>
                  <span className="ml-2 font-semibold text-red-600">
                    {reconcileForm.totalLossAmount.toLocaleString()} {getPlanUnitOfMeasure(plan)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Categorized:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {reconcileForm.categories.reduce((sum, cat) => sum + cat.lossAmount, 0).toLocaleString()} {getPlanUnitOfMeasure(plan)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Unaccounted:</span>
                  <span className="ml-2 font-semibold text-orange-600">
                    {(reconcileForm.totalLossAmount - reconcileForm.categories.reduce((sum, cat) => sum + cat.lossAmount, 0)).toLocaleString()} {getPlanUnitOfMeasure(plan)}
                  </span>
                </div>
              </div>
              
              {/* Enhanced Template-based Insights */}
              {(plan.planBasis || plan.dataEntryFrequency || plan.recurrence) && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <h5 className="text-xs font-medium text-blue-800 mb-2 flex items-center">
                    <Info className="w-3 h-3 mr-1" />
                    Template-Based Reconciliation Guidance:
                  </h5>
                  <div className="grid grid-cols-1 gap-3 text-xs">
                    {plan.planBasis && (
                      <div className="bg-white/50 rounded p-2">
                        <span className="text-blue-700 font-medium">Plan Basis ({plan.planBasis}):</span>
                        <p className="text-blue-600 mt-1">
                          {plan.planBasis === 'Time-based' && 'Focus on equipment availability, downtime analysis, and scheduled vs actual production hours. Consider maintenance schedules and equipment performance.'}
                          {plan.planBasis === 'Quantity-based' && 'Focus on production rate efficiency, cycle times, and output targets. Consider process optimization and performance bottlenecks.'}
                          {plan.planBasis === 'Demand-based' && 'Focus on customer delivery performance, quality issues, and demand fulfillment. Consider supply chain and quality control factors.'}
                        </p>
                      </div>
                    )}
                    {plan.dataEntryFrequency && (
                      <div className="bg-white/50 rounded p-2">
                        <span className="text-blue-700 font-medium">Data Collection ({plan.dataEntryFrequency}):</span>
                        <p className="text-blue-600 mt-1">
                          {plan.dataEntryFrequency === 'Hourly' && 'Real-time data available for immediate analysis. Focus on specific time periods and immediate corrective actions.'}
                          {plan.dataEntryFrequency === 'Daily' && 'Daily summaries provide trend analysis. Focus on shift patterns and daily performance reviews.'}
                          {plan.dataEntryFrequency === 'Weekly' && 'Weekly aggregation enables pattern recognition. Focus on weekly trends and recurring issues.'}
                          {plan.dataEntryFrequency === 'Monthly' && 'Monthly analysis for strategic insights. Focus on long-term trends and improvement opportunities.'}
                        </p>
                      </div>
                    )}
                    {plan.recurrence && (
                      <div className="bg-white/50 rounded p-2">
                        <span className="text-blue-700 font-medium">Recurrence Pattern ({plan.recurrence}):</span>
                        <p className="text-blue-600 mt-1">
                          {plan.recurrence === 'Daily' && 'Daily production cycles. Consider daily maintenance, shift changes, and daily operational factors.'}
                          {plan.recurrence === 'Weekly' && 'Weekly production cycles. Consider weekly maintenance schedules, weekend shutdowns, and weekly planning cycles.'}
                          {plan.recurrence === 'Monthly' && 'Monthly production cycles. Consider monthly maintenance, seasonal factors, and monthly planning cycles.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Loss Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">Loss Categories</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReconcileForm(prev => ({
                    ...prev,
                    categories: [...prev.categories, {
                      categoryName: '',
                      lossAmount: 0,
                      impactCodeId: '',
                      oeeCodeId: '',
                      description: ''
                    }]
                  }))}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Category
                </Button>
              </div>

              {reconcileForm.categories.map((category, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-900">Category {index + 1}</h5>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCategoryIndex(index);
                          setShowEventSelector(true);
                        }}
                        className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      >
                        <Activity className="w-4 h-4 mr-1" />
                        {category.productionEventId ? 'Change Event' : 'Add Event'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReconcileForm(prev => ({
                          ...prev,
                          categories: prev.categories.filter((_, i) => i !== index)
                        }))}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">Category Name</Label>
                      <Input
                        value={category.categoryName}
                        onChange={(e) => setReconcileForm(prev => ({
                          ...prev,
                          categories: prev.categories.map((cat, i) => 
                            i === index ? { ...cat, categoryName: e.target.value } : cat
                          )
                        }))}
                        placeholder="e.g., Equipment Failure"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Loss Amount</Label>
                      <Input
                        type="number"
                        value={category.lossAmount}
                        onChange={(e) => setReconcileForm(prev => ({
                          ...prev,
                          categories: prev.categories.map((cat, i) => 
                            i === index ? { ...cat, lossAmount: Number(e.target.value) } : cat
                          )
                        }))}
                        placeholder="Units"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">Impact Code</Label>
                      <Select 
                        value={category.impactCodeId} 
                        onValueChange={(value) => setReconcileForm(prev => ({
                          ...prev,
                          categories: prev.categories.map((cat, i) => 
                            i === index ? { ...cat, impactCodeId: value } : cat
                          )
                        }))}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select impact code" />
                        </SelectTrigger>
                        <SelectContent>
                          {impactCodes.map((code) => (
                            <SelectItem key={code.id} value={code.id}>
                              {code.code} - {code.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">OEE Code</Label>
                      <Select 
                        value={category.oeeCodeId} 
                        onValueChange={(value) => setReconcileForm(prev => ({
                          ...prev,
                          categories: prev.categories.map((cat, i) => 
                            i === index ? { ...cat, oeeCodeId: value } : cat
                          )
                        }))}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select OEE code" />
                        </SelectTrigger>
                        <SelectContent>
                          {oeeCodes.map((code) => (
                            <SelectItem key={code.id} value={code.id}>
                              {code.code} - {code.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600">Description</Label>
                    <Input
                      value={category.description}
                      onChange={(e) => setReconcileForm(prev => ({
                        ...prev,
                        categories: prev.categories.map((cat, i) => 
                          i === index ? { ...cat, description: e.target.value } : cat
                        )
                      }))}
                      placeholder="Describe this loss category"
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Production Event */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="productionEvent" className="text-sm font-medium text-gray-700">
                  Production Event
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // This would typically navigate to Event Hub to create a new event
                    toast({
                      title: 'Info',
                      description: 'Navigate to Event Hub to create new production events',
                    });
                  }}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Event
                </Button>
              </div>
              
              <Popover open={showEventSearch} onOpenChange={setShowEventSearch}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={showEventSearch}
                    className="w-full justify-between border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <div className="flex items-center space-x-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      {reconcileForm.productionEventId ? (
                        <span className="truncate">
                          {productionEvents.find(event => event.id === reconcileForm.productionEventId)?.eventId || 'Selected Event'}
                        </span>
                      ) : (
                        <span className="text-gray-500">Search and select a production event</span>
                      )}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search production events..." 
                      className="h-9"
                    />
                    <CommandList className="max-h-60">
                      <CommandEmpty>
                        <div className="px-2 py-4 text-center">
                          <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 mb-2">No production events found</p>
                          <p className="text-xs text-gray-400">
                            Try a different search term or create events in the Event Hub first.
                          </p>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        <div className="px-2 py-1 text-xs font-medium text-gray-500 border-b border-gray-200">
                          Recent Production Events ({productionEvents.length})
                        </div>
                        {productionEvents
                          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                          .map((event) => (
                            <CommandItem
                              key={event.id}
                              value={`${event.eventId} ${event.description} ${event.status}`}
                              onSelect={() => {
                                setReconcileForm(prev => ({ 
                                  ...prev, 
                                  productionEventId: event.id,
                                  productionEvent: event.description
                                }));
                                setShowEventSearch(false);
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex flex-col space-y-1 w-full">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{event.eventId}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {event.status}
                                  </Badge>
                                </div>
                                <span className="text-xs text-gray-600 truncate">
                                  {event.description}
                                </span>
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>{new Date(event.startTime).toLocaleDateString()}</span>
                                  {event.quantity && (
                                    <>
                                      <span>•</span>
                                      <span>{event.quantity} units affected</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {reconcileForm.productionEvent && (
                <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-blue-900">Selected Event:</span>
                        <Badge variant="outline" className="text-xs">
                          {productionEvents.find(e => e.id === reconcileForm.productionEventId)?.status || 'Unknown'}
                        </Badge>
                      </div>
                      <p className="text-blue-700 text-sm">{reconcileForm.productionEvent}</p>
                      {productionEvents.find(e => e.id === reconcileForm.productionEventId)?.quantity && (
                        <p className="text-blue-600 text-xs mt-1">
                          <span className="font-medium">Impact:</span> {productionEvents.find(e => e.id === reconcileForm.productionEventId)?.quantity} units
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReconcileForm(prev => ({ ...prev, productionEventId: '', productionEvent: '' }))}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-sm font-medium text-gray-700">
                Comment
              </Label>
              <Textarea
                id="comment"
                value={reconcileForm.comment}
                onChange={(e) => setReconcileForm(prev => ({ ...prev, comment: e.target.value }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[100px]"
                placeholder="Additional comments or observations"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => setShowReconcileModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleCreateRCA}
              className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 text-orange-700 hover:from-orange-100 hover:to-red-100"
            >
              <FileText className="w-4 h-4 mr-2" />
              Create RCA
            </Button>
            <Button 
              onClick={handleSaveReconcile}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Selector Modal */}
      <Dialog open={showEventSelector} onOpenChange={setShowEventSelector}>
        <DialogContent className="max-w-3xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-blue-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900">
              <Activity className="w-6 h-6 text-blue-600" />
              <span>Select Production Event</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Choose a production event to link to this loss category, or create a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Event Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">Available Events</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open Event Hub to create new event
                    window.open('/events', '_blank');
                  }}
                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create New Event
                </Button>
              </div>

              {/* Event List */}
              <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                {availableEvents.length > 0 ? (
                  availableEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        reconcileForm.categories[selectedCategoryIndex || 0]?.productionEventId === event.id
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (selectedCategoryIndex !== null) {
                          setReconcileForm(prev => ({
                            ...prev,
                            categories: prev.categories.map((cat, i) => 
                              i === selectedCategoryIndex ? { 
                                ...cat, 
                                productionEventId: event.id,
                                productionEvent: `${event.eventType} - ${event.description || 'No description'}`
                              } : cat
                            )
                          }));
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{event.eventType}</div>
                          <div className="text-sm text-gray-600">{event.description || 'No description'}</div>
                          <div className="text-xs text-gray-500">
                            {event.startTime ? new Date(event.startTime).toLocaleString() : 'No start time'}
                            {event.endTime && ` - ${new Date(event.endTime).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="text-right">
                          {event.quantity && (
                            <div className="text-sm font-medium text-gray-900">{event.quantity.toLocaleString()} {getPlanUnitOfMeasure(plan)}</div>
                          )}
                          {event.cost && (
                            <div className="text-xs text-gray-500">${event.cost.toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Available</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Create production events first to link them to loss categories.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.open('/events', '_blank');
                      }}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Event
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Current Selection */}
            {selectedCategoryIndex !== null && reconcileForm.categories[selectedCategoryIndex]?.productionEventId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">Selected Event</h5>
                <div className="text-sm text-blue-800">
                  {reconcileForm.categories[selectedCategoryIndex].productionEvent}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEventSelector(false);
                  setSelectedCategoryIndex(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowEventSelector(false);
                  setSelectedCategoryIndex(null);
                  toast({
                    title: 'Event Linked',
                    description: 'Production event has been linked to the loss category.',
                  });
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirm Selection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-blue-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900">
              <Edit className="w-6 h-6 text-blue-600" />
              <span>Edit Production Loss</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Update production loss details for {selectedLoss?.period}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Period */}
            <div className="space-y-2">
              <Label htmlFor="period" className="text-sm font-medium text-gray-700">
                Period
              </Label>
              <Input
                id="period"
                type="date"
                value={editForm.period}
                onChange={(e) => setEditForm(prev => ({ ...prev, period: e.target.value }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Actual */}
            <div className="space-y-2">
              <Label htmlFor="actual" className="text-sm font-medium text-gray-700">
                Actual Production
              </Label>
              <Input
                id="actual"
                type="number"
                value={editForm.actual}
                onChange={(e) => setEditForm(prev => ({ ...prev, actual: Number(e.target.value) }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter actual production quantity"
              />
            </div>

            {/* Short Range Plan */}
            <div className="space-y-2">
              <Label htmlFor="shortRangePlan" className="text-sm font-medium text-gray-700">
                Short Range Plan
              </Label>
              <Input
                id="shortRangePlan"
                type="number"
                value={editForm.shortRangePlan}
                onChange={(e) => setEditForm(prev => ({ ...prev, shortRangePlan: Number(e.target.value) }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter planned quantity"
              />
            </div>

            {/* Calculated Losses Preview */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Calculated Values (Auto-updated)</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Losses:</span>
                  <span className="ml-2 font-semibold text-red-600">
                    {calculateLosses(editForm.actual, editForm.shortRangePlan).totalLosses.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Unaccounted Loss:</span>
                  <span className="ml-2 font-semibold text-orange-600">
                    {calculateLosses(editForm.actual, editForm.shortRangePlan).unaccountedLoss.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="space-y-2">
              <Label htmlFor="action" className="text-sm font-medium text-gray-700">
                Action Status
              </Label>
              <Select value={editForm.action} onValueChange={(value) => setEditForm(prev => ({ ...prev, action: value as 'Reconcile' | 'RCA Required' | 'Closed' }))}>
                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select action status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reconcile">Reconcile</SelectItem>
                  <SelectItem value="RCA Required">RCA Required</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white border border-red-200 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2 text-red-900">
              <Trash2 className="w-6 h-6 text-red-600" />
              <span>Delete Production Loss</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete the production loss for {lossToDelete?.period}? 
              This action cannot be undone and will permanently remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loss Breakdown Modal */}
      <Dialog open={showLossBreakdown} onOpenChange={setShowLossBreakdown}>
        <DialogContent className="max-w-4xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-blue-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span>Loss Breakdown Analysis</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Detailed breakdown of production losses for {selectedLossBreakdown?.period}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Loss Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">Loss Summary</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Losses:</span>
                  <span className="ml-2 font-semibold text-red-600">
                    {selectedLossBreakdown?.losses.toLocaleString()} {getPlanUnitOfMeasure(plan)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Categorized:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {lossCategories.reduce((sum, cat) => sum + cat.lossAmount, 0).toLocaleString()} {getPlanUnitOfMeasure(plan)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Unaccounted:</span>
                  <span className="ml-2 font-semibold text-orange-600">
                    {(selectedLossBreakdown?.losses || 0) - lossCategories.reduce((sum, cat) => sum + cat.lossAmount, 0)} units
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Accountability:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {selectedLossBreakdown?.losses ? 
                      Math.round(((selectedLossBreakdown.losses - lossCategories.reduce((sum, cat) => sum + cat.lossAmount, 0)) / selectedLossBreakdown.losses) * 100) : 0}% unaccounted
                  </span>
                </div>
              </div>
            </div>

            {/* Loss Categories Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Loss Categories</h4>
              
              {lossCategories.length > 0 ? (
                <div className="space-y-3">
                  {lossCategories.map((category, index) => {
                    const impactCode = impactCodes.find(code => code.id === category.impactCodeId);
                    const oeeCode = oeeCodes.find(code => code.id === category.oeeCodeId);
                    const percentage = selectedLossBreakdown?.losses ? 
                      Math.round((category.lossAmount / selectedLossBreakdown.losses) * 100) : 0;
                    
                    return (
                      <div key={category.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <h5 className="font-medium text-gray-900">{category.categoryName}</h5>
                            <Badge variant="outline" className="text-xs">
                              {percentage}% of total
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-red-600">
                              {category.lossAmount.toLocaleString()} {getPlanUnitOfMeasure(plan)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Impact Code:</span>
                            <span className="ml-2 font-medium">
                              {impactCode ? `${impactCode.code} - ${impactCode.name}` : 'Not assigned'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">OEE Code:</span>
                            <span className="ml-2 font-medium">
                              {oeeCode ? `${oeeCode.code} - ${oeeCode.name}` : 'Not assigned'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Category:</span>
                            <span className="ml-2 font-medium">
                              {impactCode?.category || 'Not categorized'}
                            </span>
                          </div>
                        </div>
                        
                        {category.description && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <span className="text-gray-600 text-sm font-medium">Description:</span>
                            <p className="text-sm text-gray-800 mt-1">{category.description}</p>
                          </div>
                        )}

                        {/* Linked Production Event */}
                        {category.productionEventId && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center space-x-2 mb-2">
                              <Activity className="w-4 h-4 text-blue-500" />
                              <span className="text-gray-600 text-sm font-medium">Linked Production Event:</span>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-sm text-blue-800 font-medium">{category.productionEvent}</p>
                              <p className="text-xs text-blue-600 mt-1">Event ID: {category.productionEventId}</p>
                            </div>
                          </div>
                        )}

                        {/* Financial Impact */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-2 mb-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="text-gray-600 text-sm font-medium">Financial Impact:</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                              <div className="text-red-700 font-medium">Loss Value</div>
                              <div className="text-red-800 font-semibold">
                                ${(category.lossAmount * (dashboardConfig?.losses?.lossValuePerUnit || 100)).toLocaleString()}
                              </div>
                              <div className="text-xs text-red-600">@ ${dashboardConfig?.losses?.lossValuePerUnit || 100}/unit</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                              <div className="text-orange-700 font-medium">Cost per Unit</div>
                              <div className="text-orange-800 font-semibold">
                                ${Math.round((category.lossAmount * (dashboardConfig?.losses?.lossValuePerUnit || 100)) / Math.max(category.lossAmount, 1))}
                              </div>
                              <div className="text-xs text-orange-600">Average cost</div>
                            </div>
                          </div>
                        </div>

                        {/* Action Recommendations */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-2 mb-2">
                            <Target className="w-4 h-4 text-purple-500" />
                            <span className="text-gray-600 text-sm font-medium">Recommended Actions:</span>
                          </div>
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <ul className="text-sm text-purple-800 space-y-1">
                              {category.categoryName.toLowerCase().includes('equipment') && (
                                <>
                                  <li>• Schedule preventive maintenance</li>
                                  <li>• Implement predictive maintenance program</li>
                                  <li>• Review equipment operating procedures</li>
                                </>
                              )}
                              {category.categoryName.toLowerCase().includes('quality') && (
                                <>
                                  <li>• Enhance quality control processes</li>
                                  <li>• Review raw material specifications</li>
                                  <li>• Implement statistical process control</li>
                                </>
                              )}
                              {category.categoryName.toLowerCase().includes('setup') && (
                                <>
                                  <li>• Optimize changeover procedures</li>
                                  <li>• Implement SMED (Single Minute Exchange of Die)</li>
                                  <li>• Train operators on quick setup techniques</li>
                                </>
                              )}
                              {category.categoryName.toLowerCase().includes('material') && (
                                <>
                                  <li>• Improve supplier quality agreements</li>
                                  <li>• Implement material testing protocols</li>
                                  <li>• Optimize inventory management</li>
                                </>
                              )}
                              {!category.categoryName.toLowerCase().includes('equipment') && 
                               !category.categoryName.toLowerCase().includes('quality') && 
                               !category.categoryName.toLowerCase().includes('setup') && 
                               !category.categoryName.toLowerCase().includes('material') && (
                                <>
                                  <li>• Conduct root cause analysis</li>
                                  <li>• Implement corrective actions</li>
                                  <li>• Monitor performance improvements</li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Loss Categories Found</h3>
                  <p className="text-sm text-gray-500">
                    This loss hasn't been categorized yet. Use the "Reconcile" button to break down the losses.
                  </p>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {selectedLossBreakdown && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Loss Accountability Progress</span>
                  <span className="font-medium">
                    {Math.round(((selectedLossBreakdown.losses - lossCategories.reduce((sum, cat) => sum + cat.lossAmount, 0)) / selectedLossBreakdown.losses) * 100)}% unaccounted
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.round((lossCategories.reduce((sum, cat) => sum + cat.lossAmount, 0) / selectedLossBreakdown.losses) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0% (No losses categorized)</span>
                  <span>100% (All losses categorized)</span>
                </div>
              </div>
            )}

            {/* Overall Analysis & Insights */}
            {lossCategories.length > 0 && (
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Analysis & Insights</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top Loss Categories */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h5 className="font-medium text-gray-800 mb-2">Top Loss Categories</h5>
                    <div className="space-y-2">
                      {lossCategories
                        .sort((a, b) => b.lossAmount - a.lossAmount)
                        .slice(0, 3)
                        .map((category, index) => {
                          const percentage = selectedLossBreakdown?.losses ? 
                            Math.round((category.lossAmount / selectedLossBreakdown.losses) * 100) : 0;
                          return (
                            <div key={category.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-yellow-500'
                                }`}></div>
                                <span className="text-gray-700">{category.categoryName}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-gray-900">{category.lossAmount.toLocaleString()} {getPlanUnitOfMeasure(plan)}</div>
                                <div className="text-xs text-gray-500">{percentage}%</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h5 className="font-medium text-gray-800 mb-2">Financial Impact Summary</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Loss Value:</span>
                        <span className="font-semibold text-red-600">
                          ${lossCategories.reduce((sum, cat) => sum + (cat.lossAmount * (dashboardConfig?.losses?.lossValuePerUnit || 100)), 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Average Cost/Unit:</span>
                        <span className="font-semibold text-orange-600">
                          ${dashboardConfig?.losses?.lossValuePerUnit || 100}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Categories Analyzed:</span>
                        <span className="font-semibold text-blue-600">
                          {lossCategories.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Recommendations */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <h5 className="font-medium text-gray-800 mb-2">Key Recommendations</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <Target className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-800">Priority Actions</span>
                      </div>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Focus on top loss category (highest impact)</li>
                        <li>• Implement preventive measures</li>
                        <li>• Set up monitoring systems</li>
                      </ul>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800">Improvement Potential</span>
                      </div>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Reduce losses by 20-30%</li>
                        <li>• Improve accountability to 90%+</li>
                        <li>• Implement continuous monitoring</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => setShowLossBreakdown(false)}>
              Close
            </Button>
            {selectedLossBreakdown && (
              <Button 
                onClick={() => {
                  setShowLossBreakdown(false);
                  handleReconcile(selectedLossBreakdown);
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Reconcile Losses
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unmapped Events Modal */}
      <Dialog open={showUnmappedModal} onOpenChange={setShowUnmappedModal}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-blue-200 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <span>Unmapped Production Events</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              These events could not be mapped to a plan. Assign them manually below.
            </DialogDescription>
          </DialogHeader>
          {unmappedEvents.length === 0 ? (
            <div className="text-center text-gray-500">No unmapped events found.</div>
          ) : (
            <div className="space-y-4">
              {unmappedEvents.map((item, idx) => (
                <div key={item.id || idx} className="border rounded-2xl p-4 bg-gradient-to-r from-red-50 via-blue-50 to-purple-50 shadow flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-gray-700">Event:</span>
                    <span className="text-xs text-gray-700 break-all">{item.event.eventId || item.event.id}</span>
                  </div>
                  <div className="mb-1 text-sm text-red-700">
                    <span className="font-semibold">Reason:</span> {item.reason}
                  </div>
                  <div className="mb-1 text-sm text-blue-700">
                    <span className="font-semibold">What to do next:</span>
                    <ul className="list-disc ml-5">
                      {item.suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  {assigningEventId === (item.event.id || item.event.eventId) ? (
                    <div className="flex flex-col gap-2 mt-2">
                      <Select value={selectedPlanId || ''} onValueChange={setSelectedPlanId}>
                        <SelectTrigger className="w-full border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select a plan to assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePlans.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-gray-500" aria-disabled="true">No plans available</div>
                          ) : (
                            availablePlans.map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>{plan.name} ({formatDateRange(plan.startDate, plan.endDate)})</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handleCancelAssignment}>Cancel</Button>
                        <Button
                          onClick={() => handleConfirmAssignment(item)}
                          disabled={!selectedPlanId}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAssignToPlan(item)}
                        className="border-blue-400 text-blue-700 font-semibold"
                      >
                        Assign to Plan
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}; 