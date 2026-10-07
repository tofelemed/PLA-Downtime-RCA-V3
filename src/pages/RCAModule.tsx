

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { masterDataService, RCA, ProductionEvent, RCARecommendation, RCAEvidence } from '../services/MasterDataService';
import type { LogicTreeNode as UILogicTreeNode } from '../components/rca-settings/LogicTreeBuilder';
import { rcaKnowledgeBaseService } from '../services/RCAKnowledgeBaseService';
import { rcaAnalysisConfigService } from '../services/RCAAnalysisConfigService';
import { RCASimilarityMatch, RCAAnalysisConfig, FiveWhyAnalysis as FiveWhyData, FishboneDiagram, FMEAAnalysis, FaultTreeAnalysis, BarrierAnalysis, ChangeAnalysis, DEFAULT_ANALYSIS_CONFIGS } from '../types/RCAKnowledgeBase';
import SimilarRCAs from '../components/rca-analysis/SimilarRCAs';
import FiveWhyAnalysisTool from '../components/rca-analysis/FiveWhyAnalysis';
import FishboneDiagramTool from '../components/rca-analysis/FishboneDiagramTool';
import FMEAAnalysisTool from '../components/rca-analysis/FMEAAnalysisTool';
import FaultTreeAnalysisTool from '../components/rca-analysis/FaultTreeAnalysisTool';
import BarrierAnalysisTool from '../components/rca-analysis/BarrierAnalysisTool';
import ChangeAnalysisTool from '../components/rca-analysis/ChangeAnalysisTool';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText, Users, Camera, BarChart3, Target, CheckCircle, AlertTriangle, AlertCircle, Clock, Pencil, Trash2, Eye, Paperclip, Tag, MapPin, Hash, Video, Maximize2, X, Link, TrendingUp, DollarSign, Calendar, CheckSquare, Play, Info, Search, Download, Settings, Activity, FolderTree, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { treeToFlatList, flatListToTree } from '../lib/utils';
import type { RCA as BackendRCA } from '../services/MasterDataService';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { userApi, UserRecord } from '../services/api/userApi';
import { RCACreateTaskButton, RCATasksLink } from '../components/rca/RCACreateTaskButton';
import { loadLinkedTaskIds } from '../services/rca/rcaTaskBridge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { EventDiagram } from '@/components/EventDiagram';
import { EventTimeline, TimelineEvent } from '@/components/EventTimeline';
import { RCATimeline, RCATimelineEvent } from '@/components/RCATimeline';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { HistorianClient } from '../services/historian/HistorianClient';
import { TimeSeriesChart } from '../components/historian/TimeSeriesChart';
import { TimeSeriesTable } from '../components/historian/TimeSeriesTable';

// UI RCA type: same as backend RCA, but logicTree is UILogicTreeNode[]
type UIRCA = Omit<BackendRCA, 'logicTree'> & { logicTree: UILogicTreeNode[]; teamCharter?: string; eventDiagram?: { nodes: any[]; edges: any[] } };

// Fetch RCA templates from masterDataService
function useRCATemplates(tenantId?: string) {
  const [templates, setTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!tenantId) { 
      console.log('useRCATemplates: No tenantId provided');
      setTemplates([]); 
      return; 
    }
    console.log('useRCATemplates: Loading templates for tenantId:', tenantId);
    masterDataService.getRCATemplates({ tenantId })
      .then(tpls => {
        console.log('useRCATemplates: Loaded templates:', tpls);
        setTemplates(tpls);
      })
      .catch(err => {
        console.error('useRCATemplates: Error loading templates:', err);
        setTemplates([]);
      });
  }, [tenantId]);
  return templates;
}

function isUILogicTreeNodeArray(arr: any): arr is UILogicTreeNode[] {
  return Array.isArray(arr) && arr.every(n => typeof n === 'object' && 'name' in n && 'code' in n && 'category' in n);
}

function generateNodeId(prefix = 'node_') {
  return prefix + Math.random().toString(36).substr(2, 9);
}

// Recursively deep-copy a template node, assigning new unique IDs and preserving all fields and children
function deepCopyTemplateNode(node, parentId = null) {
  const newId = generateNodeId();
  return {
    id: newId,
    name: node.name || '',
    code: node.code || '',
    category: node.category || '',
    description: node.description || '',
    note: node.note || '',
    finding: node.finding || false,
    children: node.children ? node.children.map(child => deepCopyTemplateNode(child, newId)) : [],
    _parentId: parentId, // for flattening
  };
}

// Helper to flatten the deep-copied tree, preserving parentId and all fields
function flattenUILogicTree(tree, rcaId, tenantId) {
  let result = [];
  const now = new Date().toISOString();
  const isTopLevel = true;
  function recur(nodes, parentId) {
    for (const node of nodes) {
      result.push({
        id: node.id,
        rcaId,
        parentId: parentId || null,
        question: node.name,
        answer: node.description,
        type: node.category,
        code: node.code,
        note: node.note,
        finding: node.finding,
        createdAt: now,
        updatedAt: now,
        tenantId,
      });
      if (node.children && node.children.length > 0) {
        recur(node.children, node.id);
      }
    }
  }
  recur(tree, null);
  // Debug: log the flat list after flattening (only at top level)
  if (isTopLevel) {
    console.log('flattenUILogicTree result:', JSON.stringify(result, null, 2));
  }
  return result;
}

// Helper to get current datetime-local string
function getNowLocal() {
  const now = new Date();
  now.setSeconds(0, 0); // Remove seconds/millis for input compatibility
  return now.toISOString().slice(0, 16);
}

// Helper to convert File to attachment object with dataUrl
async function fileToAttachmentObj(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: e.target.result,
      });
    };
    reader.readAsDataURL(file);
  });
}

// Define a type for attachments
type RCAAttachment = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

// Helper to check if an object is an RCAAttachment
function isRCAAttachment(obj: any): obj is RCAAttachment {
  return obj && typeof obj === 'object' && 'name' in obj && 'type' in obj && 'dataUrl' in obj;
}

export const RCAModule: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const { selection: plantSelection, loading: plantLoading } = usePlantSelection();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [rcas, setRcas] = useState<UIRCA[]>([]);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [selectedRCA, setSelectedRCA] = useState<UIRCA | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('definition');
  
  // Knowledge Base & Analysis Tools
  const [similarRCAs, setSimilarRCAs] = useState<RCASimilarityMatch[]>([]);
  const [analysisConfig, setAnalysisConfig] = useState<RCAAnalysisConfig | null>(null);
  const [currentFiveWhy, setCurrentFiveWhy] = useState<FiveWhyData | null>(null);
  const [currentFishbone, setCurrentFishbone] = useState<FishboneDiagram | null>(null);
  const [currentFmea, setCurrentFmea] = useState<FMEAAnalysis | null>(null);
  const [currentFaultTree, setCurrentFaultTree] = useState<FaultTreeAnalysis | null>(null);
  const [currentBarrier, setCurrentBarrier] = useState<BarrierAnalysis | null>(null);
  const [currentChange, setCurrentChange] = useState<ChangeAnalysis | null>(null);
  const [showSimilarRCAs, setShowSimilarRCAs] = useState(false);
  const [isAnalysisFullscreen, setIsAnalysisFullscreen] = useState(false);
  
  const [rcaForm, setRcaForm] = useState({
    eventId: '',
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    targetCloseDate: '',
    templateId: '',
  });
  
  // Track if we're coming from Start RCA button
  const [isFromStartRCA, setIsFromStartRCA] = useState(false);
  
  // Event search filter for create dialog
  const [eventSearchFilter, setEventSearchFilter] = useState('');

  const [evidenceForm, setEvidenceForm] = useState({
    title: '',
    description: '',
    type: 'Note' as 'Photo' | 'Document' | 'Time Series' | 'Note' | 'Video',
    filePreview: '',
    fileBlob: undefined as Blob | undefined,
    category: '',
    location: '',
    timestamp: getNowLocal(),
    relatedAssetId: '',
    severity: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    tags: '', // comma-separated string for input
    verified: false,
    fiveP: 'Parts' as 'Parts' | 'Paper' | 'People' | 'Place' | 'Process',
    task: '',
    dueDate: '',
    status: 'pending' as 'pending' | 'completed',
    attachments: [] as RCAAttachment[],
    // Time Series fields
    tsProvider: 'pi' as 'pi',
    tsStreams: [] as { id: string; name?: string; path?: string; units?: string }[],
    tsMode: 'interpolated' as 'recorded' | 'interpolated' | 'summary' | 'plot',
    tsStart: '',
    tsEnd: '',
    tsInterval: '',
    tsIntervals: 100,
    tsSummaryTypes: '',
    tsStreamsNote: '',
  });

  const [recommendationForm, setRecommendationForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    assigneeId: '',
    dueDate: '',
    estimatedCost: '',
    status: 'Open' as 'Open' | 'In Progress' | 'Completed' | 'Cancelled',
  });

  const [showEditRCAModal, setShowEditRCAModal] = useState(false);
  const [showDeleteRCAConfirm, setShowDeleteRCAConfirm] = useState(false);
  const [editRCAForm, setEditRCAForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    targetCloseDate: '',
    teamCharter: '',
    teamLeadId: '',
    teamMemberIds: [] as string[],
  });
  
  // Edit linked event state
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  
  // Reset editing state when RCA changes
  useEffect(() => {
    setIsEditingEvent(false);
    setSelectedEventId('');
  }, [selectedRCA?.id]);

  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [linkedRecommendationTaskIds, setLinkedRecommendationTaskIds] = useState<Set<string>>(new Set());
  const [rcaLinkedTaskCount, setRcaLinkedTaskCount] = useState(0);

  const refreshLinkedTasks = React.useCallback(async () => {
    if (!selectedRCA?.id) {
      setLinkedRecommendationTaskIds(new Set());
      setRcaLinkedTaskCount(0);
      return;
    }
    try {
      const recIds = (selectedRCA.recommendations || []).map((r) => r.id);
      const { rcaTaskCount, recommendationTaskIds } = await loadLinkedTaskIds(selectedRCA.id, recIds);
      setLinkedRecommendationTaskIds(recommendationTaskIds);
      setRcaLinkedTaskCount(rcaTaskCount);
    } catch {
      // non-blocking
    }
  }, [selectedRCA?.id, selectedRCA?.recommendations]);

  useEffect(() => {
    refreshLinkedTasks();
  }, [refreshLinkedTasks]);
  useEffect(() => {
    let cancelled = false;
    const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;

    const loadUsers = async () => {
      if (!tenantId) {
        console.log('No tenantId available, skipping user loading');
        setAllUsers([]);
        return;
      }

      console.log('Loading users via API for tenantId:', tenantId);
      try {
        const tenantUsers = await userApi.getUsers({ tenantId });
        if (cancelled) return;

        if (tenantUsers.length === 0) {
          console.log('No tenant-specific users returned, requesting full user list as fallback');
          const allUsersList = await userApi.getUsers();
          if (!cancelled) {
            setAllUsers(allUsersList);
          }
        } else {
          setAllUsers(tenantUsers);
        }
      } catch (apiError) {
        console.error('Failed to load users from API:', apiError);
        if (!cancelled) {
          setAllUsers([]);
        }
      }
    };

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [plantSelection?.tenant?.id, session?.tenant?.id]);

  // Load RCA Analysis Configuration
  useEffect(() => {
    const loadAnalysisConfig = async () => {
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
      if (!tenantId) return;

      try {
        let config = await rcaAnalysisConfigService.getActiveConfig(tenantId);
        
        if (!config) {
          console.log('No RCA analysis config found, initializing default...');
          config = await rcaAnalysisConfigService.initializeDefaultConfig(
            tenantId,
            session?.organization?.id || '',
            'OilAndGas'
          );
        }
        
        console.log('✅ RCA Analysis Config loaded:', config.name);
        setAnalysisConfig(config);
      } catch (error) {
        console.error('Failed to load RCA analysis config:', error);
      }
    };

    loadAnalysisConfig();
  }, [plantSelection, session]);

  // Detect similar RCAs when creating new RCA
  useEffect(() => {
    const detectSimilarRCAs = async () => {
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
      if (!tenantId || !analysisConfig || !isCreateDialogOpen) {
        setSimilarRCAs([]);
        return;
      }

      // Only search if we have enough context
      if (!rcaForm.title && !rcaForm.description && !rcaForm.eventId) {
        return;
      }

      try {
        // Get event details if eventId is set
        let event: ProductionEvent | undefined;
        if (rcaForm.eventId) {
          try {
            const allEvents = await masterDataService.getProductionEvents({});
            event = allEvents.find(e => e.id === rcaForm.eventId);
          } catch (error) {
            console.log('Could not load event for similarity detection');
          }
        }

        const searchContext = {
          title: rcaForm.title,
          description: rcaForm.description,
          unitId: event?.unitId,
          assetId: event?.assetId,
          eventType: event?.eventType,
          impactCodeId: event?.impactCodeId,
          oeeCodeId: event?.oeeCodeId,
        };

        console.log('🔍 Searching for similar RCAs...', searchContext);
        const matches = await rcaKnowledgeBaseService.findSimilarRCAs(searchContext, tenantId, analysisConfig);
        
        if (matches.length > 0) {
          console.log(`✅ Found ${matches.length} similar RCAs`);
          setSimilarRCAs(matches);
          setShowSimilarRCAs(true);
        } else {
          console.log('No similar RCAs found');
          setSimilarRCAs([]);
        }
      } catch (error) {
        console.error('Failed to find similar RCAs:', error);
      }
    };

    // Debounce the search
    const timeoutId = setTimeout(detectSimilarRCAs, 500);
    return () => clearTimeout(timeoutId);
  }, [rcaForm.title, rcaForm.description, rcaForm.eventId, isCreateDialogOpen, analysisConfig, plantSelection, session]);

  // Load existing analysis tools data when RCA is selected
  useEffect(() => {
    const loadAnalysisToolsData = async () => {
      if (!selectedRCA) {
        setCurrentFiveWhy(null);
        setCurrentFishbone(null);
        setCurrentFmea(null);
        setCurrentFaultTree(null);
        setCurrentBarrier(null);
        setCurrentChange(null);
        return;
      }

      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;

      try {
        const [fiveWhy, fishbone, fmea, faultTree, barrier, change] = await Promise.all([
          rcaAnalysisConfigService.getFiveWhyByRCAId(selectedRCA.id, tenantId),
          rcaAnalysisConfigService.getFishboneByRCAId(selectedRCA.id, tenantId),
          rcaAnalysisConfigService.getFMEAByRCAId(selectedRCA.id, tenantId),
          rcaAnalysisConfigService.getFaultTreeByRCAId(selectedRCA.id, tenantId),
          rcaAnalysisConfigService.getBarrierByRCAId(selectedRCA.id, tenantId),
          rcaAnalysisConfigService.getChangeByRCAId(selectedRCA.id, tenantId),
        ]);

        setCurrentFiveWhy(fiveWhy);
        setCurrentFishbone(fishbone);
        setCurrentFmea(fmea);
        setCurrentFaultTree(faultTree);
        setCurrentBarrier(barrier);
        setCurrentChange(change);
      } catch (error) {
        console.error('Failed to load analysis tools data:', error);
      }
    };

    loadAnalysisToolsData();
  }, [selectedRCA?.id, plantSelection?.tenant?.id, session?.tenant?.id]);

  // Keyboard shortcut for exiting fullscreen (ESC key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAnalysisFullscreen) {
        setIsAnalysisFullscreen(false);
      }
    };

    if (isAnalysisFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when in fullscreen
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isAnalysisFullscreen]);

  const [assets, setAssets] = useState([]);
  const [units, setUnits] = useState([]);
  const [impactCodes, setImpactCodes] = useState([]);
  const [oeeCodes, setOeeCodes] = useState([]);
  
  // Evidence-related state
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [evidenceViewMode, setEvidenceViewMode] = useState<'table' | 'list'>('table');
  const [evidenceCategories, setEvidenceCategories] = useState([]);
  const [evidenceLocations, setEvidenceLocations] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  
  // Evidence modal state
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceModalMode, setEvidenceModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [currentEvidence, setCurrentEvidence] = useState<RCAEvidence | null>(null);
  const [editEvidenceForm, setEditEvidenceForm] = useState<any>(null);
  const [showAddEvidenceModal, setShowAddEvidenceModal] = useState(false);
  
  // Manual event modal state
  const [showManualEventModal, setShowManualEventModal] = useState(false);
  const [manualEventForm, setManualEventForm] = useState({
    id: '',
    label: '',
    type: 'Failure',
    timestamp: '',
    description: '',
    asset: '',
    severity: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
  });
  const [manualEventMode, setManualEventMode] = useState<'add' | 'edit'>('add');
  const [manualEventError, setManualEventError] = useState<string | null>(null);
  
  // Link evidence modal state
  const [showLinkEvidenceModal, setShowLinkEvidenceModal] = useState(false);
  const [linkEvidenceEvent, setLinkEvidenceEvent] = useState<any>(null);
  const [linkEvidenceSelection, setLinkEvidenceSelection] = useState<string[]>([]);
  
  // Diagram state
  const [diagramNodes, setDiagramNodes] = useState(selectedRCA?.eventDiagram?.nodes || []);
  const [diagramEdges, setDiagramEdges] = useState(selectedRCA?.eventDiagram?.edges || []);
  
  // RCA filters and search
  const [rcaSearch, setRcaSearch] = useState('');
  const [rcaPriorityFilter, setRcaPriorityFilter] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All');
  const [rcaOverdueFilter, setRcaOverdueFilter] = useState<'All' | 'Overdue' | 'NotOverdue'>('All');
  const [rcaStatusFilter, setRcaStatusFilter] = useState<'All' | 'Draft' | 'In Progress' | 'Analysis' | 'Published' | 'Closed'>('All');
  
  // Fullscreen modals
  const [showLogicTreeFullscreen, setShowLogicTreeFullscreen] = useState(false);
  const [showEventDiagramFullscreen, setShowEventDiagramFullscreen] = useState(false);
  
  // Logic tree reset modal
  const [showResetLogicTreeModal, setShowResetLogicTreeModal] = useState(false);
  const [resettingLogicTree, setResettingLogicTree] = useState(false);
  
  // Time series results
  const [timeSeriesResults, setTimeSeriesResults] = useState<any>(null);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);
  const [showTimeSeriesResults, setShowTimeSeriesResults] = useState(false);
  
  // Recommendation filters
  const [recommendationFilter, setRecommendationFilter] = useState('');
  const [recommendationStatusFilter, setRecommendationStatusFilter] = useState('All');
  const [recommendationPriorityFilter, setRecommendationPriorityFilter] = useState('All');
  const [recommendationAssigneeFilter, setRecommendationAssigneeFilter] = useState('All');
  
  // Comments - Enhanced for industrial RCA standards
  const [comments, setComments] = useState<{ [rcaId: string]: Array<{ 
    id: string; 
    user: string; 
    userId: string;
    text: string; 
    timestamp: string;
    type: 'general' | 'investigation' | 'analysis' | 'recommendation' | 'implementation' | 'followup';
    phase: string;
    attachments?: Array<{ name: string; url: string; type: string }>;
    mentions?: string[]; // User mentions
    isPrivate?: boolean;
  }> }>({});
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'general' | 'investigation' | 'analysis' | 'recommendation' | 'implementation' | 'followup'>('general');
  const [isPrivateComment, setIsPrivateComment] = useState(false);
  
  // Share/Export - Enhanced for industrial RCA standards
  const [shareCopied, setShareCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'word' | 'csv'>('pdf');
  const [exportOptions, setExportOptions] = useState({
    includeEvidence: true,
    includeLogicTree: true,
    includeRecommendations: true,
    includeComments: true,
    includeTimeline: true,
    includeAttachments: false,
  });
  
  // Edit recommendation modal
  const [showEditRecommendationModal, setShowEditRecommendationModal] = useState(false);
  const [editRecommendationForm, setEditRecommendationForm] = useState<any>(null);
  const [editingRecommendationId, setEditingRecommendationId] = useState<string | null>(null);
  
  // Add recommendation modal
  const [showAddRecommendationModal, setShowAddRecommendationModal] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState('definition');
  
  // Approval comment
  const [approvalComment, setApprovalComment] = useState('');
  
  // Closure notes
  const [closureNotes, setClosureNotes] = useState('');
  
  // Review banner
  const [showReviewBanner, setShowReviewBanner] = useState(false);
  
  // Next phase
  const [nextPhase, setNextPhase] = useState<RCA['status'] | null>(null);
  
  // Use plantSelection.tenant if available, otherwise fall back to session.tenant
  const activeTenantId = plantSelection?.tenant?.id || session?.tenant?.id;
  const rcaTemplates = useRCATemplates(activeTenantId);
  
  useEffect(() => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    
    console.log('Loading assets and units for tenantId:', tenantId);
    
    // Load assets and units for the specific tenant
    masterDataService.getAssets({ tenantId }).then(assets => {
      console.log('Loaded assets for tenant:', assets);
      setAssets(assets);
    });
    masterDataService.getUnits({ tenantId }).then(units => {
      console.log('Loaded units for tenant:', units);
      setUnits(units);
    });
    
    // Also load all assets and units to ensure we have complete data for timeline
    masterDataService.getAssets({}).then(allAssets => {
      console.log('Loaded all assets:', allAssets);
      if (allAssets.length > 0) {
        setAssets(allAssets); // Use all assets to ensure we can resolve any asset ID
      }
    });
    masterDataService.getUnits({}).then(allUnits => {
      console.log('Loaded all units:', allUnits);
      if (allUnits.length > 0) {
        setUnits(allUnits); // Use all units to ensure we can resolve any unit ID
      }
    });
    
    // Load impact codes and OEE codes
    masterDataService.getImpactCodes({}).then(codes => {
      console.log('Loaded impact codes:', codes);
      setImpactCodes(codes);
    });
    masterDataService.getOEECodes({}).then(codes => {
      console.log('Loaded OEE codes:', codes);
      setOeeCodes(codes);
    });
  }, [activeTenantId]);

  useEffect(() => {
    loadData();
  }, [session, plantSelection]);

  // Handle URL parameters for pre-filling RCA form
  useEffect(() => {
    const eventId = searchParams.get('eventId');
    const eventTitle = searchParams.get('eventTitle');
    
    console.log('URL params check:', { eventId, eventTitle, isCreateDialogOpen });
    
    if (eventId && eventTitle && !isCreateDialogOpen) {
      // Pre-fill the RCA form with event data immediately
      setRcaForm(prev => ({
        ...prev,
        eventId: eventId,
        title: `RCA for ${decodeURIComponent(eventTitle)}`,
        description: `Root cause analysis for: ${decodeURIComponent(eventTitle)}`
      }));
      
      // Mark that we're coming from Start RCA button
      setIsFromStartRCA(true);
      
      // Open the create dialog automatically
      setIsCreateDialogOpen(true);
      
      // Don't clear URL parameters here - let the close handler do it
    }
  }, [searchParams, setSearchParams, isCreateDialogOpen]);

  // Update edit form when selectedRCA changes
  useEffect(() => {
    if (selectedRCA) {
      setEditRCAForm({
        title: selectedRCA.title || '',
        description: selectedRCA.description || '',
        priority: selectedRCA.priority || 'Medium',
        targetCloseDate: selectedRCA.targetCloseDate || '',
        teamCharter: selectedRCA.teamCharter || '',
        teamLeadId: selectedRCA.teamLeadId || '',
        teamMemberIds: selectedRCA.teamMemberIds || [],
      });
    }
  }, [selectedRCA]);

  // Load categories/locations for tenant
  useEffect(() => {
    const tenantId = plantSelection?.tenant?.id;
    if (!tenantId) return;

    masterDataService
      .getEvidenceCategories({ tenantId })
      .then(setEvidenceCategories)
      .catch(error => {
        console.error('Failed to load evidence categories:', error);
        toast({ title: 'Error', description: 'Failed to load evidence categories.', variant: 'destructive' });
      });

    masterDataService
      .getEvidenceLocations({ tenantId })
      .then(setEvidenceLocations)
      .catch(error => {
        console.error('Failed to load evidence locations:', error);
        toast({ title: 'Error', description: 'Failed to load evidence locations.', variant: 'destructive' });
      });
  }, [plantSelection, toast]);

  // Sync local state with selectedRCA when it changes
  useEffect(() => {
    setDiagramNodes(selectedRCA?.eventDiagram?.nodes || []);
    setDiagramEdges(selectedRCA?.eventDiagram?.edges || []);
  }, [selectedRCA?.id]);

  // Add ESC key handler for fullscreen modals
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showLogicTreeFullscreen) {
          setShowLogicTreeFullscreen(false);
        }
        if (showEventDiagramFullscreen) {
          setShowEventDiagramFullscreen(false);
        }
      }
    }
    if (showLogicTreeFullscreen || showEventDiagramFullscreen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [showLogicTreeFullscreen, showEventDiagramFullscreen]);

  // Active tab management
  useEffect(() => {
    if (selectedRCA) {
      setActiveTab(PHASE_TO_TAB[normalizeStatus(selectedRCA.status)] || 'definition');
    }
  }, [selectedRCA?.status]);

  // Phase advancement logic
  useEffect(() => {
    if (!selectedRCA) return;
    const phase = normalizeStatus(selectedRCA.status);
    if (phase === 'Definition' && isDefinitionComplete(selectedRCA)) {
      setShowReviewBanner(true); setNextPhase('Data Collection');
    } else if (phase === 'Data Collection' && isDataCollectionComplete(selectedRCA)) {
      setShowReviewBanner(true); setNextPhase('Analysis');
    } else if (phase === 'Analysis' && isAnalysisComplete(selectedRCA)) {
      setShowReviewBanner(true); setNextPhase('Recommendations');
    } else if (phase === 'Recommendations' && isRecommendationsComplete(selectedRCA)) {
      setShowReviewBanner(true); setNextPhase('Approval');
    } else if (phase === 'Approval' && isApprovalComplete(selectedRCA)) {
      setShowReviewBanner(true); setNextPhase('Closure');
    } else {
      setShowReviewBanner(false); setNextPhase(null);
    }
  }, [selectedRCA]);

  const loadData = async () => {
    // Use plantSelection.tenant if available, otherwise fall back to session.tenant
    const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
    const unitId = plantSelection?.unit?.id;
    
    if (!session) {
      console.log('loadData: Missing session', { session: !!session });
      return;
    }

    console.log('Loading data with tenantId:', tenantId, 'unitId:', unitId);

    try {
      console.log('About to fetch RCAs and events...');
      
      // Get ALL RCAs regardless of tenant when plant is selected
      const allRcaData = await masterDataService.getRCAs({});
      console.log('All RCAs in system:', { rcaCount: allRcaData?.length, rcas: allRcaData });
      
      // Get ALL events regardless of tenant when plant is selected
      let eventData;
      if (unitId) {
        eventData = await masterDataService.getProductionEvents({ unitId });
        console.log('Events filtered by unit:', { unitId, eventCount: eventData?.length, events: eventData });
      } else {
        eventData = await masterDataService.getProductionEvents({});
        console.log('All events in system:', { eventCount: eventData?.length, events: eventData });
      }
      
      // Debug: Check the relationship between RCAs and events
      console.log('Debugging RCA-Event relationship:');
      allRcaData.forEach(rca => {
        console.log(`RCA ${rca.id} has eventId: ${rca.eventId}`);
      });
      eventData.forEach(event => {
        console.log(`Event ${event.id} belongs to unit: ${event.unitId}`);
      });
      
      // Filter RCAs based on selection level
      let filteredRcaData;
      
      if (unitId) {
        // If a specific unit is selected, filter RCAs by events from that unit
        const eventIds = new Set(eventData.map(event => event.id));
        filteredRcaData = allRcaData.filter(rca => eventIds.has(rca.eventId));
        
        console.log('Unit-specific filtering:', { 
          unitId,
          totalRCAs: allRcaData.length, 
          filteredRCAs: filteredRcaData.length,
          eventIds: Array.from(eventIds),
          rcaEventIds: allRcaData.map(rca => rca.eventId)
        });
        
        // If no RCAs match after filtering by unit, fall back to showing all RCAs for the tenant
        if (filteredRcaData.length === 0 && allRcaData.length > 0) {
          console.log('No RCAs found for selected unit, falling back to all RCAs for tenant');
          filteredRcaData = allRcaData;
        }
      } else {
        // If only plant is selected (no unit), show ALL RCAs regardless of tenant
        filteredRcaData = allRcaData;
        
        console.log('Plant-only filtering (showing ALL RCAs):', { 
          totalRCAs: allRcaData.length, 
          filteredRCAs: filteredRcaData.length
        });
      }

      // Convert filtered RCAs to UIRCA
      const uiRcas: UIRCA[] = filteredRcaData.map((rca: any) => {
        if (Array.isArray(rca.logicTree) && rca.logicTree.length > 0) {
          console.log('LOAD DATA: raw flat logicTree from storage:', JSON.stringify(rca.logicTree, null, 2));
        }
        const logicTree = Array.isArray(rca.logicTree) && rca.logicTree.length > 0
          ? flatListToTree(rca.logicTree as any[])
          : [];
        if (logicTree.length > 0) {
          console.log('logicTreeUI after flatListToTree (loadData):', logicTree);
        }
        return {
          ...rca,
          logicTree,
        };
      });
      setRcas(uiRcas);
      setEvents(eventData);
      console.log('Events set in state:', eventData.length);
    } catch (error) {
      console.error('Failed to load RCA data:', error);
      console.error('Error details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RCA data',
        variant: 'destructive',
      });
    }
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setIsFromStartRCA(false);
    setEventSearchFilter(''); // Reset event search filter
    setSimilarRCAs([]); // Clear similar RCAs
    setShowSimilarRCAs(false);
    setRcaForm({
      eventId: '',
      title: '',
      description: '',
      priority: 'Medium',
      targetCloseDate: '',
      templateId: '',
    });
    
    // Clear URL parameters when closing modal
    if (searchParams.get('eventId') || searchParams.get('eventTitle')) {
      setSearchParams({});
    }
  };

  const createRCA = async () => {
    if (!session) return;

    // Find the selected template and deep copy its tree
    const selectedTemplate = rcaTemplates.find(t => t.id === rcaForm.templateId);
    let logicTree = undefined;
    const templateTree = selectedTemplate?.logicTreeStructure?.nodes || selectedTemplate?.tree;
    if (templateTree) {
      // Deep copy with unique IDs and parentId tracking
      logicTree = templateTree.map(node => deepCopyTemplateNode(node));
    }

    try {
      // Flatten tree for persistence
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id || '';
      const flatLogicTree = logicTree ? flattenUILogicTree(logicTree, 'TEMP_RCA_ID', tenantId) : undefined;
      if (flatLogicTree) {
        console.log('CREATE RCA: flatLogicTree to store:', JSON.stringify(flatLogicTree, null, 2));
      }
      const newRCA = await masterDataService.createRCA({
        eventId: rcaForm.eventId,
        title: rcaForm.title,
        description: rcaForm.description,
        status: 'Draft',
        teamLeadId: session.user.id,
        teamMemberIds: [...new Set([session.user.id])], // Ensure no duplicates
        priority: rcaForm.priority,
        targetCloseDate: rcaForm.targetCloseDate || undefined,
        recommendations: [],
        evidence: [],
        tenantId: tenantId,
        templateId: rcaForm.templateId,
        logicTree: flatLogicTree,
      });

      // Update logic tree with real RCA ID
      if (logicTree) {
        const flatLogicTreeWithRealId = flattenUILogicTree(logicTree, newRCA.id, tenantId);
        console.log('UPDATE RCA: flatLogicTreeWithRealId to store:', JSON.stringify(flatLogicTreeWithRealId, null, 2));
        await masterDataService.updateRCA(newRCA.id, { logicTree: flatLogicTreeWithRealId });
      }

      toast({
        title: 'Success',
        description: 'RCA investigation created successfully',
      });

      handleCloseCreateDialog();
      // Convert backend logicTree to UI logicTree
      let logicTreeUI = [];
      if (Array.isArray(newRCA.logicTree) && newRCA.logicTree.length > 0) {
        console.log('LOAD RCA: raw flat logicTree from storage:', JSON.stringify(newRCA.logicTree, null, 2));
        logicTreeUI = flatListToTree(newRCA.logicTree);
      }
      setSelectedRCA({ ...newRCA, logicTree: logicTreeUI });
      loadData();
    } catch (error) {
      console.error('Failed to create RCA:', error);
      toast({
        title: 'Error',
        description: 'Failed to create RCA investigation',
        variant: 'destructive',
      });
    }
  };

  const addEvidence = async () => {
    if (!selectedRCA) return;
    try {
      const newEvidence: RCAEvidence = {
        id: crypto.randomUUID(),
        rcaId: selectedRCA.id,
        title: evidenceForm.title,
        description: evidenceForm.description,
        type: evidenceForm.type,
        collectedBy: session!.user.id,
        collectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: plantSelection.tenant.id || '',
        fileBlob: evidenceForm.fileBlob,
        category: evidenceForm.category,
        location: evidenceForm.location,
        timestamp: evidenceForm.timestamp,
        relatedAssetId: evidenceForm.relatedAssetId,
        severity: evidenceForm.severity,
        tags: evidenceForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        verified: evidenceForm.verified,
        fiveP: evidenceForm.fiveP,
        task: evidenceForm.task,
        dueDate: evidenceForm.dueDate,
        status: evidenceForm.status,
        attachments: evidenceForm.attachments,
      } as any;
      const updatedRCA = await masterDataService.updateRCA(selectedRCA.id, {
        evidence: [...selectedRCA.evidence, newEvidence]
      });
      setSelectedRCA({
        ...updatedRCA,
        logicTree: Array.isArray(updatedRCA.logicTree) && updatedRCA.logicTree.length > 0
          ? flatListToTree(updatedRCA.logicTree as any[])
          : [],
      });
      setEvidenceForm({ title: '', description: '', type: 'Note', filePreview: '', fileBlob: undefined, category: '', location: '', timestamp: getNowLocal(), relatedAssetId: '', severity: 'Medium', tags: '', verified: false, fiveP: 'Parts', task: '', dueDate: '', status: 'pending', attachments: [], tsProvider: 'pi', tsStreams: [], tsMode: 'interpolated', tsStart: '', tsEnd: '', tsInterval: '', tsIntervals: 100, tsSummaryTypes: '', tsStreamsNote: '' });
      toast({
        title: 'Success',
        description: 'Evidence added successfully',
      });
    } catch (error) {
      console.error('Failed to add evidence:', error);
      toast({
        title: 'Error',
        description: 'Failed to add evidence',
        variant: 'destructive',
      });
    }
  };

  const addRecommendation = async () => {
    if (!selectedRCA) return;

    try {
      const newRecommendation: RCARecommendation = {
        id: crypto.randomUUID(),
        rcaId: selectedRCA.id,
        title: recommendationForm.title,
        description: recommendationForm.description,
        priority: recommendationForm.priority,
        assigneeId: recommendationForm.assigneeId || session!.user.id,
        dueDate: recommendationForm.dueDate || undefined,
        status: recommendationForm.status,
        estimatedCost: recommendationForm.estimatedCost ? parseFloat(recommendationForm.estimatedCost) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: plantSelection.tenant.id || '',
      };

      const updatedRCA = await masterDataService.updateRCA(selectedRCA.id, {
        recommendations: [...selectedRCA.recommendations, newRecommendation]
      });

      setSelectedRCA({
        ...updatedRCA,
        logicTree: Array.isArray(updatedRCA.logicTree) && updatedRCA.logicTree.length > 0
          ? flatListToTree(updatedRCA.logicTree as any[])
          : [],
      });
      setRecommendationForm({
        title: '',
        description: '',
        priority: 'Medium',
        assigneeId: '',
        dueDate: '',
        estimatedCost: '',
        status: 'Open',
      });
      
      toast({
        title: 'Success',
        description: 'Recommendation added successfully',
      });
    } catch (error) {
      console.error('Failed to add recommendation:', error);
      toast({
        title: 'Error',
        description: 'Failed to add recommendation',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Analysis': return 'bg-purple-100 text-purple-800';
      case 'Published': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTitle = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    return event ? event.description : 'Unknown Event';
  };

  // --- Enhanced Professional Logic Tree Node with Industry-Standard Styling ---
  function LogicTreeNodeInteractive({ node, depth, onChange, onDelete, onAddChild, onEdit, evidence, onAttachEvidence }: {
    node: UILogicTreeNode;
    depth: number;
    onChange: (n: UILogicTreeNode) => void;
    onDelete: () => void;
    onAddChild: () => void;
    onEdit: (updated: UILogicTreeNode) => void;
    evidence: RCAEvidence[];
    onAttachEvidence: (nodeId: string, evidenceId: string, checked: boolean) => void;
  }) {
    console.log('Rendering node:', node);
    const [expanded, setExpanded] = React.useState(true);
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [showAddChildModal, setShowAddChildModal] = React.useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [editForm, setEditForm] = React.useState({
      name: node.name,
      code: node.code,
      category: node.category,
      description: node.description || '',
      note: node.note || '',
      finding: !!node.finding,
    });
    
    // Application Theme Color Schemes - Matching Dashboard Style
    const categoryColors: Record<string, { badge: string; node: string; border: string; icon: string; iconBg: string }> = {
      Equipment: { 
        badge: 'bg-blue-100 text-blue-800', 
        node: 'bg-gradient-to-br from-blue-50 to-white', 
        border: 'border-blue-200',
        icon: '⚙️',
        iconBg: 'bg-blue-100 text-blue-600'
      },
      Process: { 
        badge: 'bg-green-100 text-green-800', 
        node: 'bg-gradient-to-br from-green-50 to-white', 
        border: 'border-green-200',
        icon: '🔄',
        iconBg: 'bg-green-100 text-green-600'
      },
      Material: { 
        badge: 'bg-yellow-100 text-yellow-800', 
        node: 'bg-gradient-to-br from-yellow-50 to-white', 
        border: 'border-yellow-200',
        icon: '📦',
        iconBg: 'bg-yellow-100 text-yellow-600'
      },
      Personnel: { 
        badge: 'bg-purple-100 text-purple-800', 
        node: 'bg-gradient-to-br from-purple-50 to-white', 
        border: 'border-purple-200',
        icon: '👤',
        iconBg: 'bg-purple-100 text-purple-600'
      },
      Environment: { 
        badge: 'bg-cyan-100 text-cyan-800', 
        node: 'bg-gradient-to-br from-cyan-50 to-white', 
        border: 'border-cyan-200',
        icon: '🌡️',
        iconBg: 'bg-cyan-100 text-cyan-600'
      },
      Method: { 
        badge: 'bg-pink-100 text-pink-800', 
        node: 'bg-gradient-to-br from-pink-50 to-white', 
        border: 'border-pink-200',
        icon: '📋',
        iconBg: 'bg-pink-100 text-pink-600'
      },
      Root: { 
        badge: 'bg-indigo-100 text-indigo-800', 
        node: 'bg-gradient-to-br from-indigo-50 to-white', 
        border: 'border-indigo-200',
        icon: '🎯',
        iconBg: 'bg-indigo-100 text-indigo-600'
      },
      Why: { 
        badge: 'bg-sky-100 text-sky-800', 
        node: 'bg-gradient-to-br from-sky-50 to-white', 
        border: 'border-sky-200',
        icon: '❓',
        iconBg: 'bg-sky-100 text-sky-600'
      },
      How: { 
        badge: 'bg-teal-100 text-teal-800', 
        node: 'bg-gradient-to-br from-teal-50 to-white', 
        border: 'border-teal-200',
        icon: '🔍',
        iconBg: 'bg-teal-100 text-teal-600'
      },
      Cause: { 
        badge: 'bg-red-100 text-red-800', 
        node: 'bg-gradient-to-br from-red-50 to-white', 
        border: 'border-red-200',
        icon: '⚠️',
        iconBg: 'bg-red-100 text-red-600'
      },
    };
    // --- Edit Node Modal ---
    function handleEditSave() {
      onEdit({
        ...node,
        ...editForm,
      });
      setShowEditModal(false);
    }
    // --- Add Child Modal ---
    const [childForm, setChildForm] = React.useState({
      name: '',
      code: '',
      category: 'Equipment',
      description: '',
      note: '',
      finding: false,
    });
    function handleAddChildSave() {
      const newChild: UILogicTreeNode = {
        id: generateNodeId(),
        name: childForm.name,
        code: childForm.code,
        category: childForm.category,
        description: childForm.description,
        note: childForm.note,
        finding: childForm.finding,
        children: [],
      };
      onChange({
        ...node,
        children: [...(node.children || []), newChild],
      });
      setShowAddChildModal(false);
      setChildForm({ name: '', code: '', category: 'Equipment', description: '', note: '', finding: false });
    }
    // --- Delete Confirm ---
    function handleDeleteConfirm() {
      onDelete();
      setShowDeleteConfirm(false);
    }
    // --- Attach Evidence ---
    // function handleAttach(ev: React.ChangeEvent<HTMLSelectElement>) {
    //   if (ev.target.value) {
    //     onAttachEvidence(node.id, ev.target.value, ev.target.checked);
    //   }
    // }
    // --- Edit Node Handler ---
    function handleEditNode(updated: UILogicTreeNode) {
      onChange(updated);
    }
    // --- Add Note Local State ---
    const [noteDraft, setNoteDraft] = React.useState(node.note || '');
    React.useEffect(() => { setNoteDraft(node.note || ''); }, [node.note, node.id]);
    function handleNoteBlur() {
      if (noteDraft !== (node.note || '')) {
        onChange({ ...node, note: noteDraft });
      }
    }
    // --- Render ---
    // Get evidence count for this node
    const attachedEvidence = evidence.filter(e => Array.isArray(e.nodeIds) && e.nodeIds.includes(node.id));
    const isRootCause = node.category === 'Cause' || node.category === 'root_cause';
    const isVerified = node.finding || false; // Using finding flag as verification
    const hasChildren = node.children && node.children.length > 0;
    
    // Get current category styling
    const currentCategoryStyle = categoryColors[node.category] || categoryColors['Equipment'];

    return (
      <li className="relative" style={{ marginLeft: depth > 0 ? 32 : 0 }}>
        {/* Tree connector lines - Industry standard visual hierarchy */}
        {depth > 0 && (
          <>
            {/* Horizontal connector line */}
            <div 
              className="absolute top-6 border-t-2 border-gray-300"
              style={{ 
                left: -20, 
                width: 20,
              }}
            />
            {/* Vertical connector line */}
            <div 
              className="absolute top-0 border-l-2 border-gray-300"
              style={{ 
                left: -20, 
                height: hasChildren && expanded ? '100%' : 24,
              }}
            />
          </>
        )}
        
        {/* Node Card - Matching App Theme */}
        <div className={`relative mb-3 ${currentCategoryStyle.node} border ${currentCategoryStyle.border} rounded-lg shadow hover:shadow-md transition-all duration-200`}>
          <div className="p-4">
            {/* Header with expand/collapse and node info */}
            <div className="flex items-start gap-3 mb-3">
              {/* Expand/Collapse Button */}
              {hasChildren && (
                <button 
                  type="button" 
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  onClick={() => setExpanded(e => !e)}
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              
              {/* Category Icon Badge */}
              <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${currentCategoryStyle.iconBg}`}>
                <span className="text-lg">{currentCategoryStyle.icon}</span>
              </div>
              
              {/* Node Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {/* Node Name */}
                    <h4 className="font-semibold text-sm text-gray-900 leading-tight mb-1">
                      {node.name}
                    </h4>
                    
                    {/* Badges Row */}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <Badge className={`text-xs ${currentCategoryStyle.badge}`}>
                        {node.category}
                      </Badge>
                      
                      {node.code && (
                        <Badge variant="outline" className="text-xs">
                          {node.code}
                        </Badge>
                      )}
                      
                      {isRootCause && (
                        <Badge variant="destructive" className="text-xs">
                          Root Cause
                        </Badge>
                      )}
                      
                      {isVerified && (
                        <Badge className="text-xs bg-green-600 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      
                      {attachedEvidence.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Paperclip className="w-3 h-3 mr-1" />
                          {attachedEvidence.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddChildModal(true)}
                      className="h-7 w-7 p-0"
                      title="Add Child Node"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEditModal(true)}
                      className="h-7 w-7 p-0"
                      title="Edit Node"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="h-7 w-7 p-0"
                      title="Delete Node"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Description/Answer Section */}
            {node.description && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">Analysis / Finding</p>
                <p className="text-sm text-gray-800">{node.description}</p>
              </div>
            )}

            {/* Node Note */}
            {node.note && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Note</p>
                <p className="text-sm text-gray-700">{node.note}</p>
              </div>
            )}

            {/* Attached Evidence */}
            {attachedEvidence.length > 0 && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
                <p className="text-xs font-semibold text-green-800 mb-2">
                  Supporting Evidence ({attachedEvidence.length})
                </p>
                <div className="space-y-1.5">
                  {attachedEvidence.map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">{ev.type}</Badge>
                      <span className="flex-1 truncate text-gray-700">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Controls */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={!!node.finding}
                  onChange={e => onChange({ ...node, finding: e.target.checked })}
                  className="accent-green-600 w-4 h-4 rounded cursor-pointer"
                  id={`verify-${node.id}`}
                />
                <label htmlFor={`verify-${node.id}`} className="text-sm text-gray-700 cursor-pointer">
                  {isRootCause ? 'Confirmed Root Cause' : 'Mark as Verified'}
                </label>
                
                {/* Attach Evidence Button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                    >
                      <Paperclip className="w-4 h-4 mr-1" />
                      Link Evidence
                      {attachedEvidence.length > 0 && (
                        <Badge className="ml-2 bg-green-600 text-white">
                          {attachedEvidence.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Attach Evidence</h4>
                      {evidence.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          No evidence available. Add evidence from Data Collection tab.
                        </p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {evidence.map(e => {
                            const checked = Array.isArray(e.nodeIds) && e.nodeIds.includes(node.id);
                            return (
                              <div 
                                key={e.id} 
                                className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                                  checked 
                                    ? 'bg-green-50 border-green-300' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => onAttachEvidence(node.id, e.id, !checked)}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={ev => {
                                    ev.stopPropagation();
                                    onAttachEvidence(node.id, e.id, ev.target.checked);
                                  }}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{e.type}</Badge>
                                    <span className="text-sm font-medium truncate">{e.title}</span>
                                  </div>
                                  {e.description && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{e.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Note Input Field */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Add notes or context..."
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  onBlur={handleNoteBlur}
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Edit Node Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-blue-100 flex flex-col">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-xl font-bold" onClick={() => setShowEditModal(false)} aria-label="Close">&times;</button>
              <h2 className="text-xl font-bold text-blue-700 mb-4">Edit Node</h2>
              <form onSubmit={e => { e.preventDefault(); handleEditSave(); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Name</label>
                  <input className="w-full border rounded px-2 py-1" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Code</label>
                  <input className="w-full border rounded px-2 py-1" value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select className="w-full border rounded px-2 py-1" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="Equipment">Equipment</option>
                    <option value="Process">Process</option>
                    <option value="Material">Material</option>
                    <option value="Personnel">Personnel</option>
                    <option value="Environment">Environment</option>
                    <option value="Method">Method</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Description</label>
                  <textarea className="w-full border rounded px-2 py-1" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Note</label>
                  <textarea className="w-full border rounded px-2 py-1" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={editForm.finding} onChange={e => setEditForm(f => ({ ...f, finding: e.target.checked }))} />
                  <span className="text-xs">Finding/Root Cause</span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="px-3 py-1 rounded border" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Add Child Modal */}
        {showAddChildModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-green-100 flex flex-col">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-green-600 text-xl font-bold" onClick={() => setShowAddChildModal(false)} aria-label="Close">&times;</button>
              <h2 className="text-xl font-bold text-green-700 mb-4">Add Child Node</h2>
              <form onSubmit={e => { e.preventDefault(); handleAddChildSave(); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Name</label>
                  <input className="w-full border rounded px-2 py-1" value={childForm.name} onChange={e => setChildForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Code</label>
                  <input className="w-full border rounded px-2 py-1" value={childForm.code} onChange={e => setChildForm(f => ({ ...f, code: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select className="w-full border rounded px-2 py-1" value={childForm.category} onChange={e => setChildForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="Equipment">Equipment</option>
                    <option value="Process">Process</option>
                    <option value="Material">Material</option>
                    <option value="Personnel">Personnel</option>
                    <option value="Environment">Environment</option>
                    <option value="Method">Method</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Description</label>
                  <textarea className="w-full border rounded px-2 py-1" value={childForm.description} onChange={e => setChildForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Note</label>
                  <textarea className="w-full border rounded px-2 py-1" value={childForm.note} onChange={e => setChildForm(f => ({ ...f, note: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={childForm.finding} onChange={e => setChildForm(f => ({ ...f, finding: e.target.checked }))} />
                  <span className="text-xs">Finding/Root Cause</span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="px-3 py-1 rounded border" onClick={() => setShowAddChildModal(false)}>Cancel</button>
                  <button type="submit" className="px-3 py-1 rounded bg-green-600 text-white">Add</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs relative border border-red-100 flex flex-col items-center">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-xl font-bold" onClick={() => setShowDeleteConfirm(false)} aria-label="Close">&times;</button>
              <h2 className="text-xl font-bold text-red-700 mb-4">Delete Node?</h2>
              <p className="mb-4 text-center">Are you sure you want to delete this node and all its children?</p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-3 py-1 rounded border" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button type="button" className="px-3 py-1 rounded bg-red-600 text-white" onClick={handleDeleteConfirm}>Delete</button>
              </div>
            </div>
          </div>
        )}
        {/* Children Nodes - Hierarchical Tree Structure */}
        {expanded && hasChildren && (
          <ul className="mt-2 space-y-0 relative">
            {node.children.map((child: UILogicTreeNode, idx: number) => (
              <LogicTreeNodeInteractive
                key={child.id || idx}
                node={child}
                depth={depth + 1}
                onChange={updatedChild => {
                  const newChildren = node.children.map((c, i) => c.id === updatedChild.id ? updatedChild : c);
                  onChange({ ...node, children: newChildren });
                }}
                onDelete={() => {
                  const children = (node.children || []).filter((_, i) => i !== idx);
                  onChange({ ...node, children });
                }}
                onAddChild={() => {
                  setShowAddChildModal(true);
                }}
                onEdit={handleEditNode}
                evidence={evidence}
                onAttachEvidence={onAttachEvidence}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Persist logic tree changes to the RCA record
  function updateRCALogicTree(newTree: UILogicTreeNode[]) {
    if (!selectedRCA) return;
    const flatTree = treeToFlatList(newTree, selectedRCA.id, selectedRCA.tenantId || '');
    masterDataService.updateRCA(selectedRCA.id, { logicTree: flatTree }).then(updated => {
      let logicTreeUI: UILogicTreeNode[] = [];
      if (Array.isArray(updated.logicTree) && updated.logicTree.length > 0) {
        logicTreeUI = flatListToTree(updated.logicTree as any[]);
      }
      setSelectedRCA({
        ...updated,
        logicTree: logicTreeUI,
      });
    });
  }

  // Add a recursive function to update a node by id in the tree
  function updateNodeInTree(tree: UILogicTreeNode[], nodeId: string, updatedNode: UILogicTreeNode): UILogicTreeNode[] {
    return tree.map(node => {
      if (node.id === nodeId) {
        return { ...updatedNode };
      } else if (node.children && node.children.length > 0) {
        return { ...node, children: updateNodeInTree(node.children, nodeId, updatedNode) };
      } else {
        return node;
      }
    });
  }

  // Update handleLogicTreeNodeChange to use the recursive updater
  function handleLogicTreeNodeChange(nodeId: string, updatedNode: UILogicTreeNode) {
    if (!selectedRCA) return;
    const logicTree = selectedRCA.logicTree;
    const newTree = updateNodeInTree(logicTree, nodeId, updatedNode);
    updateRCALogicTree(newTree);
  }

  // Download logic tree as JSON
  function downloadLogicTree(tree: UILogicTreeNode[]) {
    // Only download the UI tree structure
    const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tree, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'logic-tree.json';
    a.click();
  }

  // Status transition logic
  const statusOrder = ['Draft', 'In Progress', 'Analysis', 'Published', 'Closed'];
  function getNextStatuses(current: string) {
    const idx = statusOrder.indexOf(current);
    if (idx === -1) return [];
    // Only allow forward transitions
    return statusOrder.slice(idx + 1);
  }

  // type RCAStatus = 'Draft' | 'In Progress' | 'Analysis' | 'Published' | 'Closed';
  // function StatusDropdown({ status, onChange, disabled }: { status: RCAStatus; onChange: (s: RCAStatus) => void; disabled?: boolean }) {
  //   const nextStatuses = getNextStatuses(status);
  //   return (
  //     <div className="flex items-center gap-2">
  //       <span className="text-xs text-gray-500">Change Status:</span>
  //       <select
  //         className="border rounded px-2 py-1 text-xs"
  //         value={status}
  //         onChange={e => onChange(e.target.value as RCAStatus)}
  //         disabled={disabled || nextStatuses.length === 0}
  //       >
  //         <option value={status}>{status}</option>
  //         {nextStatuses.map(s => (
  //           <option key={s} value={s}>{s}</option>
  //         ))}
  //       </select>
  //     </div>
  //   );
  // }

  // async function handleStatusChange(newStatus: RCAStatus) {
  //   if (!selectedRCA) return;
  //   if (!window.confirm(`Change status to "${newStatus}"?`)) return;
  //   const updated = await masterDataService.updateRCA(selectedRCA.id, { status: newStatus });
  //   setSelectedRCA({
  //     ...updated,
  //     logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
  //       ? flatListToTree(updated.logicTree as any[])
  //       : [],
  //   });
  //   loadData();
  // }

  function getUserName(userIdOrName: string | undefined) {
    if (!userIdOrName) return '-';
    
    // Check if it's already a name (not a UUID)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userIdOrName)) {
      return userIdOrName; // Already a name
    }
    
    // Look up user by ID
    const user = allUsers.find(u => u.id === userIdOrName);
    return user ? user.name : userIdOrName;
  }

  async function handleTeamChange(newTeam: string[]) {
    if (!selectedRCA) return;
    
    // Remove duplicates from team member IDs
    const uniqueTeam = [...new Set(newTeam)];
    
    const updated = await masterDataService.updateRCA(selectedRCA.id, { teamMemberIds: uniqueTeam });
    setSelectedRCA({
      ...selectedRCA,
      teamMemberIds: uniqueTeam,
      logicTree: Array.isArray(selectedRCA.logicTree) && selectedRCA.logicTree.length > 0
        ? flatListToTree(selectedRCA.logicTree as any[])
        : [],
    });
    loadData();
  }

  async function handleLeadChange(newLead: string) {
    if (!selectedRCA) return;
    const updated = await masterDataService.updateRCA(selectedRCA.id, { teamLeadId: newLead });
    setSelectedRCA({
      ...selectedRCA,
      logicTree: Array.isArray(selectedRCA.logicTree) && selectedRCA.logicTree.length > 0
        ? flatListToTree(selectedRCA.logicTree as any[])
        : [],
    });
    loadData();
  }

  // Team members editor component
  function TeamMembersEditor({ teamMemberIds, onChange, allUsers, teamLeadId, onLeadChange, renderUser }: {
    teamMemberIds: string[];
    onChange: (ids: string[]) => void;
    allUsers: UserRecord[];
    teamLeadId: string;
    onLeadChange: (id: string) => void;
    renderUser: (user: UserRecord) => React.ReactNode;
  }) {
    console.log('TeamMembersEditor received users:', allUsers.length);
    // Add/remove team members
    function handleToggle(userId: string) {
      if (teamMemberIds.includes(userId)) {
        onChange(teamMemberIds.filter(id => id !== userId));
      } else {
        // Ensure no duplicates when adding
        const uniqueIds = [...new Set([...teamMemberIds, userId])];
        onChange(uniqueIds);
      }
    }
    if (allUsers.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          <p>No users available for team selection.</p>
          <p className="text-xs mt-1">Users will appear here once they are loaded.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {allUsers.map(user => (
          <span key={user.id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${teamMemberIds.includes(user.id) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <input
              type="checkbox"
              checked={teamMemberIds.includes(user.id)}
              onChange={() => handleToggle(user.id)}
              className="mr-1 accent-blue-600"
            />
            {renderUser(user)}
            {user.id === teamLeadId && <span className="ml-1 text-yellow-600 font-bold">(Lead)</span>}
            {teamMemberIds.includes(user.id) && user.id !== teamLeadId && (
              <button
                type="button"
                className="ml-1 text-xs text-yellow-600 underline"
                onClick={() => onLeadChange(user.id)}
                title="Make Team Lead"
              >
                Make Lead
              </button>
            )}
          </span>
        ))}
      </div>
    );
  }

  function getNodeNameById(nodeId: string): string {
    if (!selectedRCA?.logicTree) return '';
    const logicTree = isUILogicTreeNodeArray(selectedRCA.logicTree) ? selectedRCA.logicTree : [];
    function findNode(nodes: UILogicTreeNode[]): UILogicTreeNode | null {
      for (const n of nodes) {
        if (n.id === nodeId) return n;
        if (n.children) {
          const res = findNode(n.children);
          if (res) return res;
        }
      }
      return null;
    }
    const node = findNode(logicTree);
    return node ? node.name : '';
  }

  // Helper to get asset or unit name by ID
  function getAssetOrUnitName(id: string): string {
    if (!id) return 'Unknown Asset';
    
    // Debug logging
    console.log('getAssetOrUnitName called with:', { id, assetsLength: assets.length, unitsLength: units.length });
    
    const asset = assets.find(a => a.id === id);
    if (asset) {
      console.log('Found asset:', asset.name);
      return asset.name;
    }
    
    const unit = units.find(u => u.id === id);
    if (unit) {
      console.log('Found unit:', unit.name);
      return unit.name;
    }
    
    // If we can't find the asset/unit, try to provide a more helpful fallback
    console.log('Asset/Unit not found for ID:', id);
    return `Asset ID: ${id.substring(0, 8)}...`;
  }

  function handleAddRootNode() {
    const logicTree = selectedRCA ? selectedRCA.logicTree : [];
    const newNode: UILogicTreeNode = {
      id: generateNodeId(),
      name: 'New Root Node',
      code: '',
      category: '',
      children: [],
    };
    const newTree: UILogicTreeNode[] = [...logicTree, newNode];
    updateRCALogicTree(newTree);
  }

  function handleDeleteNode(idx: number) {
    if (!selectedRCA) return;
    if (!window.confirm('Delete this node and all its children?')) return;
    const logicTree = selectedRCA.logicTree;
    const newTree: UILogicTreeNode[] = logicTree.filter((_, i) => i !== idx);
    updateRCALogicTree(newTree);
  }

  function handleAddChildNode(parentIdx: number) {
    const logicTree = selectedRCA ? selectedRCA.logicTree : [];
    function addChild(nodes: UILogicTreeNode[], idx: number): UILogicTreeNode[] {
      return nodes.map((n, i) => {
        if (i === idx) {
          return {
            ...n,
            children: [...(n.children || []), { id: generateNodeId(), name: 'New Node', code: '', category: '', children: [] }],
          };
        }
        return { ...n, children: n.children ? addChild(n.children, idx) : n.children };
      });
    }
    const newTree = addChild(logicTree, parentIdx);
    updateRCALogicTree(newTree);
  }

  function handleEditNode(idx: number) {
    // For now, just alert. In production, show an edit modal.
    alert('Edit node (implement modal for full editing)');
  }



  async function handleDeleteRecommendation(rec: RCARecommendation) {
    if (!selectedRCA) return;
    if (!window.confirm(`Delete recommendation "${rec.title}"?`)) return;
    const updated = await masterDataService.updateRCA(selectedRCA.id, {
      recommendations: (selectedRCA.recommendations || []).filter((r: RCARecommendation) => r.id !== rec.id)
    });
    setSelectedRCA({
      ...updated,
      logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
        ? flatListToTree(updated.logicTree as any[])
        : [],
    });
    loadData();
  }

  async function handlePushToCMMS(rec: RCARecommendation) {
    if (!selectedRCA) return;
    // Simulate push: set status to 'In Progress' and show badge
    const updatedRecs = (selectedRCA.recommendations || []).map(r =>
      r.id === rec.id ? { ...r, status: 'In Progress' as 'In Progress' } : r
    );
    const updated = await masterDataService.updateRCA(selectedRCA.id, { recommendations: updatedRecs });
    setSelectedRCA({
      ...updated,
      logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 ? flatListToTree(updated.logicTree as any[]) : [],
    });
    toast({ title: 'Pushed', description: 'Recommendation pushed to CMMS (simulated).' });
  }

  // 1. Load categories/locations for tenant:

  // 3. Add handlers to add, edit, delete category/location:
  const handleAddCategory = async () => {
    if (!categoryInput.trim()) return;
    const tenantId = plantSelection?.tenant?.id;
    if (!tenantId) {
      toast({ title: 'Tenant required', description: 'Select a tenant before managing evidence categories.', variant: 'destructive' });
      return;
    }
    try {
      if (editingCategory) {
        await masterDataService.updateEvidenceCategory(editingCategory.id, { name: categoryInput });
        toast({ title: 'Success', description: 'Category updated.' });
      } else {
        await masterDataService.createEvidenceCategory({
          name: categoryInput,
          tenantId,
        });
        toast({ title: 'Success', description: 'Category added.' });
      }
      setCategoryInput('');
      setEditingCategory(null);
      setShowCategoryModal(false);
      const categories = await masterDataService.getEvidenceCategories({ tenantId });
      setEvidenceCategories(categories);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add/update category.' });
      console.error('Failed to add/update category:', err);
    }
  };
  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryInput(cat.name);
    setShowCategoryModal(true);
  };
  const handleDeleteCategory = async (cat) => {
    const tenantId = plantSelection?.tenant?.id;
    if (!tenantId) return;
    try {
      await masterDataService.deleteEvidenceCategory(cat.id);
      const categories = await masterDataService.getEvidenceCategories({ tenantId });
      setEvidenceCategories(categories);
      toast({ title: 'Deleted', description: 'Category deleted.' });
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast({ title: 'Error', description: 'Failed to delete category.', variant: 'destructive' });
    }
  };
  const handleAddLocation = async () => {
    if (!locationInput.trim()) return;
    const tenantId = plantSelection?.tenant?.id;
    if (!tenantId) {
      toast({ title: 'Tenant required', description: 'Select a tenant before managing evidence locations.', variant: 'destructive' });
      return;
    }
    try {
      if (editingLocation) {
        await masterDataService.updateEvidenceLocation(editingLocation.id, { name: locationInput });
        toast({ title: 'Success', description: 'Location updated.' });
      } else {
        await masterDataService.createEvidenceLocation({
          name: locationInput,
          tenantId,
        });
        toast({ title: 'Success', description: 'Location added.' });
      }
      setLocationInput('');
      setEditingLocation(null);
      setShowLocationModal(false);
      const locations = await masterDataService.getEvidenceLocations({ tenantId });
      setEvidenceLocations(locations);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add/update location.' });
      console.error('Failed to add/update location:', err);
    }
  };
  const handleEditLocation = (loc) => {
    setEditingLocation(loc);
    setLocationInput(loc.name);
    setShowLocationModal(true);
  };
  const handleDeleteLocation = async (loc) => {
    const tenantId = plantSelection?.tenant?.id;
    if (!tenantId) return;
    try {
      await masterDataService.deleteEvidenceLocation(loc.id);
      const locations = await masterDataService.getEvidenceLocations({ tenantId });
      setEvidenceLocations(locations);
      toast({ title: 'Deleted', description: 'Location deleted.' });
    } catch (error) {
      console.error('Failed to delete location:', error);
      toast({ title: 'Error', description: 'Failed to delete location.', variant: 'destructive' });
    }
  };

  // Evidence modal handlers

  function handleViewEvidence(evidence: RCAEvidence) {
    setCurrentEvidence(evidence);
    setEvidenceModalMode('view');
    setShowEvidenceModal(true);
  }

  function handleEditEvidence(evidence: RCAEvidence) {
    // Always use a deep copy to avoid mutating the original evidence
    setCurrentEvidence({ ...evidence });
    setEditEvidenceForm({
      ...JSON.parse(JSON.stringify(evidence)),
      tags: (evidence.tags || []).join(', '),
      fiveP: evidence.fiveP || 'Parts',
      task: evidence.task || '',
      dueDate: evidence.dueDate || '',
      status: evidence.status || 'pending',
      attachments: evidence.attachments ? [...evidence.attachments] : [],
    });
    setEvidenceModalMode('edit');
    setShowEvidenceModal(true);
  }

  function handleAddEvidence() {
    setEditEvidenceForm({ ...evidenceForm });
    setEvidenceModalMode('add');
    setShowEvidenceModal(true);
  }

  async function handleSaveEvidenceEdit() {
    if (!selectedRCA || !currentEvidence) return;
    // Only update the evidence with the matching id
    const updatedEvidence = (selectedRCA.evidence || []).map(e =>
      e.id === currentEvidence.id
        ? {
            ...e,
            ...editEvidenceForm,
            tags: (editEvidenceForm.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
            id: e.id, // ensure id is preserved
          }
        : e
    );
    try {
      const updated = await masterDataService.updateRCA(selectedRCA.id, { evidence: updatedEvidence });
      setSelectedRCA({
        ...updated,
        logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
          ? flatListToTree(updated.logicTree as any[])
          : [],
      });
      setShowEvidenceModal(false);
      toast({ title: 'Success', description: 'Evidence updated.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update evidence.' });
    }
  }

  async function handleDeleteEvidence(evidence: RCAEvidence) {
    if (!selectedRCA) return;
    if (!window.confirm(`Delete evidence "${evidence.title}"?`)) return;
    try {
      const updated = await masterDataService.updateRCA(selectedRCA.id, {
        evidence: (selectedRCA.evidence || []).filter((e: RCAEvidence) => e.id !== evidence.id)
      });
      setSelectedRCA({
        ...updated,
        logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
          ? flatListToTree(updated.logicTree as any[])
          : [],
      });
      loadData();
      toast({ title: 'Success', description: 'Evidence deleted.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete evidence.' });
    }
  }

  async function handleAttachEvidence(nodeId: string, evidenceId: string, checked: boolean) {
    if (!selectedRCA) return;
    const newEvidence = (selectedRCA.evidence || []).map(e => {
      if (e.id !== evidenceId) return e;
      let nodeIds = Array.isArray(e.nodeIds) ? [...e.nodeIds] : [];
      if (checked) {
        if (!nodeIds.includes(nodeId)) nodeIds.push(nodeId);
      } else {
        nodeIds = nodeIds.filter(id => id !== nodeId);
      }
      return { ...e, nodeIds };
    });
    try {
      const updated = await masterDataService.updateRCA(selectedRCA.id, { evidence: newEvidence });
      setSelectedRCA({
        ...updated,
        logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
          ? flatListToTree(updated.logicTree as any[])
          : [],
      });
      toast({ title: 'Success', description: 'Evidence updated.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update evidence.' });
    }
  }

  // Add this function inside the RCAModule component
  async function handleAddEvidenceSubmit() {
    if (!selectedRCA) return;
    const newEvidence = {
      ...editEvidenceForm,
      id: Math.random().toString(36).substr(2, 9),
      tags: editEvidenceForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    try {
      const updated = await masterDataService.updateRCA(selectedRCA.id, { evidence: [...selectedRCA.evidence, newEvidence] });
      setSelectedRCA({
        ...updated,
        logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
          ? flatListToTree(updated.logicTree as any[])
          : [],
      });
      setShowEvidenceModal(false);
      toast({ title: 'Success', description: 'Evidence added.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add evidence.' });
    }
  }

  // Manual event and diagram handlers

  // Sync local state with selectedRCA when it changes
  useEffect(() => {
    setDiagramNodes(selectedRCA?.eventDiagram?.nodes || []);
    setDiagramEdges(selectedRCA?.eventDiagram?.edges || []);
  }, [selectedRCA?.id]);

  // RCA list search and filters

  // Fullscreen modals

  // Add ESC key handler for fullscreen modals
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowLogicTreeFullscreen(false);
        setShowEventDiagramFullscreen(false);
      }
    }
    if (showLogicTreeFullscreen || showEventDiagramFullscreen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [showLogicTreeFullscreen, showEventDiagramFullscreen]);

  // Reset logic tree and time series

  // --- Handler to execute time series query ---
  async function handleExecuteTimeSeriesQuery(evidence: RCAEvidence) {
    if (!evidence.tsProvider || !evidence.tsStart || !evidence.tsEnd) {
      toast({
        title: 'Error',
        description: 'Missing required time series parameters (provider, start time, or end time)',
        variant: 'destructive',
      });
      return;
    }

    if (!evidence.tsStreams || evidence.tsStreams.length === 0) {
      toast({
        title: 'Error',
        description: 'No streams specified for time series query',
        variant: 'destructive',
      });
      return;
    }

    setTimeSeriesLoading(true);
    try {
      const historianClient = new HistorianClient();
      
      // Create query parameters from evidence
      const query = {
        provider: evidence.tsProvider || 'pi',
        streams: evidence.tsStreams || [],
        mode: evidence.tsMode || 'interpolated',
        startTimeUtc: evidence.tsStart,
        endTimeUtc: evidence.tsEnd,
        interval: evidence.tsInterval,
        intervals: evidence.tsIntervals || 100,
        summaryTypes: evidence.tsSummaryTypes,
        includeBad: true,
        boundaryType: 'Inside' as const,
        filter: '',
      };

      const results = await historianClient.query(query);
      setTimeSeriesResults(results);
      setShowTimeSeriesResults(true);
      
      toast({
        title: 'Success',
        description: 'Time series query executed successfully',
      });
    } catch (error) {
      console.error('Failed to execute time series query:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute time series query',
        variant: 'destructive',
      });
    } finally {
      setTimeSeriesLoading(false);
    }
  }

  // --- Handler to export time series data as CSV ---
  function handleExportTimeSeriesCSV(data: any) {
    try {
      if (!data || !data.streams || data.streams.length === 0) {
        toast({
          title: 'Error',
          description: 'No data to export',
          variant: 'destructive',
        });
        return;
      }

      // Create CSV content
      let csvContent = 'Timestamp,Stream,Value,Units,Quality\n';
      
      data.streams.forEach((stream: any) => {
        if (stream.points && stream.points.length > 0) {
          stream.points.forEach((point: any) => {
            csvContent += `${point.timestamp},${stream.name || stream.id},${point.value},${point.units || ''},${point.quality ? 'Good' : 'Questionable'}\n`;
          });
        }
      });

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time_series_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'CSV file exported successfully',
      });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to export CSV file',
        variant: 'destructive',
      });
    }
  }

  // --- Handler to export time series data as JSON ---
  function handleExportTimeSeriesJSON(data: any) {
    try {
      if (!data) {
        toast({
          title: 'Error',
          description: 'No data to export',
          variant: 'destructive',
        });
        return;
      }

      // Create and download file
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time_series_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'JSON file exported successfully',
      });
    } catch (error) {
      console.error('Failed to export JSON:', error);
      toast({
        title: 'Error',
        description: 'Failed to export JSON file',
        variant: 'destructive',
      });
    }
  }

  // --- Handler to reset logic tree to template ---
  async function handleResetLogicTreeToTemplate() {
    if (!selectedRCA || !selectedRCA.templateId) return;
    setResettingLogicTree(true);
    try {
      const template = rcaTemplates.find(t => t.id === selectedRCA.templateId);
      const templateTree = template?.logicTreeStructure?.nodes || template?.tree;
      if (!templateTree) throw new Error('Template logic tree not found.');
      // Deep copy with new IDs
      const logicTree = templateTree.map(node => deepCopyTemplateNode(node));
      // Flatten for persistence
      const flatLogicTree = flattenUILogicTree(logicTree, selectedRCA.id, selectedRCA.tenantId || '');
      // Persist
      const updated = await masterDataService.updateRCA(selectedRCA.id, { logicTree: flatLogicTree });
      // Update UI
      setSelectedRCA({ ...updated, logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 ? flatListToTree(updated.logicTree as any[]) : [] });
      setShowResetLogicTreeModal(false);
      toast({ title: 'Success', description: 'Logic tree reset to template.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to reset logic tree.', variant: 'destructive' });
    } finally {
      setResettingLogicTree(false);
    }
  }

  // Recommendation filters and comments

  // Helper to get comments for selected RCA
  const rcaComments = selectedRCA ? (comments[selectedRCA.id] || []) : [];
  const publicComments = rcaComments.filter(c => !c.isPrivate || c.userId === session?.user?.id);
  const privateComments = rcaComments.filter(c => c.isPrivate && c.userId === session?.user?.id);

  // Handler to add a comment with industrial RCA standards
  function handleAddComment() {
    if (!selectedRCA || !newComment.trim()) return;
    
    const comment = {
      id: Math.random().toString(36).substr(2, 9),
      user: session?.user?.name || 'User',
      userId: session?.user?.id || '',
      text: newComment,
      timestamp: new Date().toISOString(),
      type: commentType,
      phase: normalizeStatus(selectedRCA.status),
      isPrivate: isPrivateComment,
      mentions: extractMentions(newComment),
    };
    
    setComments(prev => ({
      ...prev,
      [selectedRCA.id]: [...(prev[selectedRCA.id] || []), comment],
    }));
    
    setNewComment('');
    setCommentType('general');
    setIsPrivateComment(false);
    
    // Show success message
    toast({
      title: 'Comment Added',
      description: `Comment added to ${commentType} phase`,
    });
  }

  // Helper to extract user mentions from comment text
  function extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  // Handler to delete a comment
  function handleDeleteComment(commentId: string) {
    if (!selectedRCA) return;
    setComments(prev => ({
      ...prev,
      [selectedRCA.id]: (prev[selectedRCA.id] || []).filter(c => c.id !== commentId),
    }));
    
    toast({
      title: 'Comment Deleted',
      description: 'Comment has been removed',
    });
  }

  // Handler to edit a comment
  function handleEditComment(commentId: string, newText: string) {
    if (!selectedRCA) return;
    setComments(prev => ({
      ...prev,
      [selectedRCA.id]: (prev[selectedRCA.id] || []).map(c => 
        c.id === commentId ? { ...c, text: newText, timestamp: new Date().toISOString() } : c
      ),
    }));
    
    toast({
      title: 'Comment Updated',
      description: 'Comment has been updated',
    });
  }
  
  // Debug: Plant selection check
  // console.log('Plant selection check:', { plantSelection, hasTenant: !!plantSelection?.tenant, hasUnit: !!plantSelection?.unit, sessionTenant: !!session?.tenant });
  
  // Check if we have URL parameters (coming from Start RCA button)
  const hasUrlParams = searchParams.get('eventId') && searchParams.get('eventTitle');
  
  // If we have URL parameters, we can work with just the session tenant
  // Otherwise, we need at least a plant (tenant) selection
  if (!hasUrlParams && (!plantSelection || !plantSelection.tenant)) {
    return <div className="p-8 text-center text-gray-500">Please select a Plant to access RCA investigations.</div>;
  }
  
  // If we have URL parameters but no plant selection, we need at least a tenant from session
  if (hasUrlParams && (!plantSelection?.tenant && !session?.tenant)) {
    return <div className="p-8 text-center text-gray-500">Please select a Plant to access RCA investigations.</div>;
  }

  // --- Patch eventDiagram nodes to always have position ---
  function ensureNodePositions(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(n => ({
      ...n,
      position: n.position || { x: 100, y: 100 },
    }));
  }

  // Share/Export Handlers
  const shareLink = selectedRCA ? `${window.location.origin}${window.location.pathname}?rca=${selectedRCA.id}` : '';
  function handleExportCSV() {
    if (!selectedRCA) return;
    const headers = ['Title', 'Description', 'Priority', 'Assignee', 'Due Date', 'Status', 'Estimated Cost'];
    const rows = (selectedRCA.recommendations || []).map(r => [
      r.title,
      r.description,
      r.priority,
      getUserName(r.assigneeId),
      r.dueDate || '',
      r.status,
      r.estimatedCost || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommendations-${selectedRCA.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  // Enhanced Export Functions for Industrial RCA Standards
  function handleExportPDF() {
    if (!selectedRCA) return;
    
    const rcaData = {
      title: selectedRCA.title,
      description: selectedRCA.description,
      status: selectedRCA.status,
      priority: selectedRCA.priority,
      teamLead: getUserName(selectedRCA.teamLeadId),
      teamMembers: selectedRCA.teamMemberIds.map(id => getUserName(id)).filter(Boolean),
      targetCloseDate: selectedRCA.targetCloseDate,
      actualCloseDate: selectedRCA.actualCloseDate,
      rootCause: selectedRCA.rootCause,
      evidence: exportOptions.includeEvidence ? selectedRCA.evidence : [],
      recommendations: exportOptions.includeRecommendations ? selectedRCA.recommendations : [],
      comments: exportOptions.includeComments ? rcaComments : [],
      logicTree: exportOptions.includeLogicTree ? selectedRCA.logicTree : [],
      createdAt: selectedRCA.createdAt,
      updatedAt: selectedRCA.updatedAt,
    };
    
    const pdfContent = generatePDFContent(rcaData);
    downloadFile(pdfContent, `RCA_${selectedRCA.title.replace(/[^a-z0-9]/gi, '_')}.pdf`, 'application/pdf');
    
    toast({
      title: 'Export Complete',
      description: 'RCA exported to PDF successfully',
    });
  }

  function handleExportExcel() {
    if (!selectedRCA) return;
    
    const excelData = {
      'RCA Summary': [
        ['Title', selectedRCA.title],
        ['Description', selectedRCA.description],
        ['Status', selectedRCA.status],
        ['Priority', selectedRCA.priority],
        ['Team Lead', getUserName(selectedRCA.teamLeadId)],
        ['Target Close Date', selectedRCA.targetCloseDate || 'Not set'],
        ['Root Cause', selectedRCA.rootCause || 'Not identified'],
      ],
      'Recommendations': (selectedRCA.recommendations || []).map(r => [
        r.title,
        r.description,
        r.priority,
        getUserName(r.assigneeId),
        r.dueDate || 'Not set',
        r.status,
        r.estimatedCost || 'Not set'
      ]),
      'Evidence': (selectedRCA.evidence || []).map(e => [
        e.title,
        e.description,
        e.type,
        e.collectedBy,
        e.collectedAt,
        e.category || 'Not categorized',
        e.verified ? 'Yes' : 'No'
      ]),
      'Comments': rcaComments.map(c => [
        c.user,
        c.text,
        c.type,
        c.phase,
        c.timestamp,
        c.isPrivate ? 'Private' : 'Public'
      ])
    };
    
    const csvContent = Object.entries(excelData).map(([sheetName, data]) => {
      return `=== ${sheetName} ===\n${data.map(row => row.join(',')).join('\n')}\n\n`;
    }).join('');
    
    downloadFile(csvContent, `RCA_${selectedRCA.title.replace(/[^a-z0-9]/gi, '_')}.csv`, 'text/csv');
    
    toast({
      title: 'Export Complete',
      description: 'RCA exported to Excel format successfully',
    });
  }

  function generatePDFContent(rcaData: any): string {
    return `
RCA REPORT
==========

Title: ${rcaData.title}
Description: ${rcaData.description}
Status: ${rcaData.status}
Priority: ${rcaData.priority}
Team Lead: ${rcaData.teamLead}
Target Close Date: ${rcaData.targetCloseDate}

ROOT CAUSE ANALYSIS
==================
${rcaData.rootCause || 'Not identified'}

EVIDENCE
========
${(rcaData.evidence || []).map((e: any) => `- ${e.title}: ${e.description}`).join('\n')}

RECOMMENDATIONS
===============
${(rcaData.recommendations || []).map((r: any) => `- ${r.title}: ${r.description} (Priority: ${r.priority})`).join('\n')}

COMMENTS
========
${rcaData.comments.map((c: any) => `[${c.user}] ${c.text}`).join('\n')}

Generated on: ${new Date().toISOString()}
    `.trim();
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    if (!selectedRCA) return;
    const json = JSON.stringify(selectedRCA.recommendations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommendations-${selectedRCA.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleCopyShareLink() {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  // Recommendation Edit Modal

  function handleEditRecommendation(rec: RCARecommendation) {
    setEditingRecommendationId(rec.id);
    setEditRecommendationForm({ ...rec });
    setShowEditRecommendationModal(true);
  }

  async function handleSaveEditRecommendation() {
    if (!selectedRCA || !editingRecommendationId) return;
    const updatedRecs = (selectedRCA.recommendations || []).map(r =>
      r.id === editingRecommendationId ? { ...r, ...editRecommendationForm } : r
    );
    const updated = await masterDataService.updateRCA(selectedRCA.id, { recommendations: updatedRecs });
    setSelectedRCA({
      ...updated,
      logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 ? flatListToTree(updated.logicTree as any[]) : [],
    });
    setShowEditRecommendationModal(false);
    setEditingRecommendationId(null);
    setEditRecommendationForm(null);
    toast({ title: 'Success', description: 'Recommendation updated.' });
  }

  function handleCancelEditRecommendation() {
    setShowEditRecommendationModal(false);
    setEditingRecommendationId(null);
    setEditRecommendationForm(null);
  }

  // Add recommendation modal

  // Update status phases to match stepper
  const STATUS_PHASES = [
    'Definition',
    'Data Collection',
    'Analysis',
    'Recommendations',
    'Approval',
    'Closure',
  ];

  // Map old statuses to new phases for backward compatibility
  const LEGACY_STATUS_MAP: Record<string, string> = {
    'Draft': 'Definition',
    'In Progress': 'Data Collection',
    'Analysis': 'Analysis',
    'Published': 'Recommendations',
    'Closed': 'Closure',
  };

  function normalizeStatus(status: string): string {
    return STATUS_PHASES.includes(status) ? status : (LEGACY_STATUS_MAP[status] || 'Definition');
  }

  function StatusDropdown({ status, onChange, disabled }: { status: string; onChange: (s: string) => void; disabled?: boolean }) {
    const currentIdx = STATUS_PHASES.indexOf(normalizeStatus(status));
    let nextPhases = STATUS_PHASES.slice(currentIdx + 1);
    if (selectedRCA?.closureStatus === 'Closed') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Change Phase:</span>
          <select className="border rounded px-2 py-1 text-xs" value={normalizeStatus(status)} disabled>
            <option value={normalizeStatus(status)}>{normalizeStatus(status)}</option>
          </select>
        </div>
      );
    }
    if (nextPhase) {
      nextPhases = [nextPhase];
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Change Phase:</span>
        <select
          className="border rounded px-2 py-1 text-xs"
          value={normalizeStatus(status)}
          onChange={e => onChange(e.target.value)}
          disabled={disabled || nextPhases.length === 0}
        >
          <option value={normalizeStatus(status)}>{normalizeStatus(status)}</option>
          {nextPhases.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    );
  }

  type RCAStatus = "Draft" | "In Progress" | "Analysis" | "Published" | "Closed" | "Definition" | "Data Collection" | "Recommendations" | "Approval" | "Closure";
  async function handleStatusChange(newStatus: RCAStatus) {
    if (!selectedRCA) return;
    const updated = await masterDataService.updateRCA(selectedRCA.id, { status: newStatus });
    setSelectedRCA({
      ...updated,
      logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0
        ? flatListToTree(updated.logicTree as any[])
        : [],
    });
    loadData();
  }

  // Add mapping from workflow phase to tab value
  const PHASE_TO_TAB = {
    'Definition': 'definition',
    'Data Collection': 'data-collection',
    'Analysis': 'analysis',
    'Recommendations': 'recommendations',
    'Approval': 'approval',
    'Closure': 'closure',
  };

  const TAB_TO_PHASE = Object.fromEntries(Object.entries(PHASE_TO_TAB).map(([k, v]) => [v, k]));

  // Approval logic helpers
  const canApprove = session?.user?.role === 'SuperAdmin' || session?.user?.role === 'OrgAdmin' || session?.user?.role === 'Manager';
  const isApproved = selectedRCA?.approvalStatus === 'Approved';
  const isRejected = selectedRCA?.approvalStatus === 'Rejected';
  const isPendingApproval = selectedRCA?.approvalStatus === 'Pending' || !selectedRCA?.approvalStatus;
  // Approval comment management

  async function handleApproveRCA() {
    if (!selectedRCA || !canApprove) return;
    const now = new Date().toISOString();
    const updated = await masterDataService.updateRCA(selectedRCA.id, {
      approvalStatus: 'Approved',
      approvedBy: session.user.name,
      approvedAt: now,
      approvalComments: approvalComment,
      status: 'Approval', // move workflow to Approval phase
    });
    setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
    toast({ title: 'RCA Approved', description: 'This RCA has been approved.' });
  }
  async function handleRejectRCA() {
    if (!selectedRCA || !canApprove) return;
    const now = new Date().toISOString();
    const updated = await masterDataService.updateRCA(selectedRCA.id, {
      approvalStatus: 'Rejected',
      approvedBy: session.user.name,
      approvedAt: now,
      approvalComments: approvalComment,
    });
    setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
    toast({ title: 'RCA Rejected', description: 'This RCA has been rejected.' });
  }

  const isClosureAllowed = selectedRCA?.approvalStatus === 'Approved';
  const isClosed = selectedRCA?.closureStatus === 'Closed';
  // Closure notes management

  async function handleCloseRCA() {
    if (!selectedRCA || !isClosureAllowed) return;
    const now = new Date().toISOString();
    const updated = await masterDataService.updateRCA(selectedRCA.id, {
      closureStatus: 'Closed',
      closedBy: session.user.name,
      closedAt: now,
      closureNotes,
      status: 'Closure', // move workflow to Closure phase
    });
    setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
    toast({ title: 'RCA Closed', description: 'This RCA has been closed.' });
  }

  // Phase completion checks
  function isDefinitionComplete(rca: UIRCA) {
    return !!rca.title && !!rca.description && !!rca.teamCharter && rca.teamMemberIds && new Set(rca.teamMemberIds).size > 0;
  }
  function isDataCollectionComplete(rca: UIRCA) {
    return rca.evidence && rca.evidence.length > 0;
  }
  function isAnalysisComplete(rca: UIRCA) {
    return rca.logicTree && rca.logicTree.length > 0;
  }
  function isRecommendationsComplete(rca: UIRCA) {
    return rca.recommendations && rca.recommendations.length > 0;
  }
  function isApprovalComplete(rca: UIRCA) {
    return rca.approvalStatus === 'Approved';
  }
  function isClosureComplete(rca: UIRCA) {
    return rca.closureStatus === 'Closed';
  }

  // Review & Advance state
  // Review banner and next phase management

  async function handleAdvancePhase() {
    if (!selectedRCA || !nextPhase) return;
    const updated = await masterDataService.updateRCA(selectedRCA.id, { status: nextPhase });
    setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
    setShowReviewBanner(false); setNextPhase(null);
    toast({ title: 'Phase Advanced', description: `RCA moved to ${nextPhase}` });
  }

  // Helper to get tab index from phase
  const phaseToTabIdx = (phase: string) => STATUS_PHASES.indexOf(normalizeStatus(phase));
  const currentTabIdx = phaseToTabIdx(selectedRCA?.status || 'Definition');

  // Update dashboard card logic
  const activeStatuses = ['Definition', 'Data Collection', 'Analysis', 'Recommendations', 'Approval'];
  const activeRcas = rcas.filter(r => activeStatuses.includes(normalizeStatus(r.status)));
  const highPriorityRcas = rcas.filter(r => ['High', 'Critical'].includes(r.priority));
  const overdueRcas = rcas.filter(r => r.targetCloseDate && new Date(r.targetCloseDate) < new Date() && r.status !== 'Closed' && normalizeStatus(r.status) !== 'Closure');
  const publishedRcas = rcas.filter(r => normalizeStatus(r.status) === 'Recommendations');

  // Helper to check if RCA is closed
  const isRcaClosed = selectedRCA?.closureStatus === 'Closed';

  // Early return for loading state - must be after all hooks are declared
  if (plantLoading) return <div>Loading plant context...</div>;

  // Debug information for tenant ID issues
  const currentTenantId = plantSelection?.tenant?.id || session?.tenant?.id;
  const debugInfo = {
    plantSelectionTenant: plantSelection?.tenant?.id,
    plantSelectionTenantName: plantSelection?.tenant?.name,
    sessionTenant: session?.tenant?.id,
    sessionTenantName: session?.tenant?.name,
    finalTenantId: currentTenantId,
    hasSession: !!session,
    hasPlantSelection: !!plantSelection,
    rcaCount: rcas.length,
    eventCount: events.length
  };

  return (
    <>
      {/* Always show dashboard and RCA list unless an RCA is selected */}
      {!selectedRCA && (
        <div className="space-y-6">
          {/* Dashboard cards with Status Counts */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total RCAs</CardTitle>
                <FileText className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {rcas.length}
                </div>
                <p className="text-xs text-gray-600 mt-1">All investigations</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Draft</CardTitle>
                <Activity className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {rcas.filter(r => r.status === 'Draft' || r.status === 'Definition').length}
                </div>
                <p className="text-xs text-gray-600 mt-1">Just started</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Activity className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-700">
                  {rcas.filter(r => ['In Progress', 'Data Collection', 'Analysis', 'Recommendations', 'Approval'].includes(r.status)).length}
                </div>
                <p className="text-xs text-gray-600 mt-1">Active work</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Closed</CardTitle>
                <CheckCircle className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700">
                  {rcas.filter(r => r.status === 'Closed' || r.status === 'Closure' || r.status === 'Published').length}
                </div>
                <p className="text-xs text-gray-600 mt-1">Finished</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                  {overdueRcas.length}
                </div>
                <p className="text-xs text-gray-600 mt-1">Need attention</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical</CardTitle>
                <AlertTriangle className="h-4 w-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-700">
                  {rcas.filter(r => r.priority === 'Critical').length}
                </div>
                <p className="text-xs text-gray-600 mt-1">High priority</p>
              </CardContent>
            </Card>
          </div>
          {/* --- RCA List Filters/Search Bar --- */}
          <div className="flex flex-wrap gap-2 mb-4 items-center bg-gradient-to-r from-blue-50 via-white to-pink-50 rounded-2xl shadow-lg px-6 py-4 border border-blue-100">
            <Input
              className="w-64 bg-white border-blue-200 shadow-sm rounded-full px-4 py-2 text-base focus:ring-2 focus:ring-blue-200"
              placeholder="Search by title or description..."
              value={rcaSearch}
              onChange={e => setRcaSearch(e.target.value)}
            />
            <select
              className="border rounded-full px-4 py-2 text-base bg-white border-pink-200 shadow-sm focus:ring-2 focus:ring-pink-200"
              value={rcaPriorityFilter}
              onChange={e => setRcaPriorityFilter(e.target.value as any)}
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              className="border rounded-full px-4 py-2 text-base bg-white border-yellow-200 shadow-sm focus:ring-2 focus:ring-yellow-200"
              value={rcaOverdueFilter}
              onChange={e => setRcaOverdueFilter(e.target.value as any)}
            >
              <option value="All">All</option>
              <option value="Overdue">Overdue</option>
              <option value="NotOverdue">Not Overdue</option>
            </select>
            <select
              className="border rounded-full px-4 py-2 text-base bg-white border-green-200 shadow-sm focus:ring-2 focus:ring-green-200"
              value={rcaStatusFilter}
              onChange={e => setRcaStatusFilter(e.target.value as any)}
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="In Progress">In Progress</option>
              <option value="Analysis">Analysis</option>
              <option value="Published">Published</option>
              <option value="Closed">Closed</option>
            </select>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="ml-auto bg-gradient-to-r from-blue-600 to-pink-500 text-white rounded-full shadow-lg px-6 py-2 text-base font-bold flex gap-2 items-center hover:from-blue-700 hover:to-pink-600">
              <Plus className="w-5 h-5" /> Start RCA
            </Button>
          </div>
          {/* RCA List */}
          <div className="space-y-6">
            {/* --- Filtered RCA List --- */}
            {(() => {
              const filteredRcas = rcas.filter(rca => {
                // Search filter
                const matchesSearch =
                  !rcaSearch ||
                  rca.title.toLowerCase().includes(rcaSearch.toLowerCase()) ||
                  rca.description.toLowerCase().includes(rcaSearch.toLowerCase());
                // Priority filter
                const matchesPriority =
                  rcaPriorityFilter === 'All' || rca.priority === rcaPriorityFilter;
                // Overdue filter (exclude Closed RCAs)
                const isOverdue = rca.targetCloseDate && new Date(rca.targetCloseDate) < new Date() && rca.status !== 'Closed';
                const matchesOverdue =
                  rcaOverdueFilter === 'All' ||
                  (rcaOverdueFilter === 'Overdue' && isOverdue) ||
                  (rcaOverdueFilter === 'NotOverdue' && !isOverdue);
                // Status filter
                const matchesStatus =
                  rcaStatusFilter === 'All' || rca.status === rcaStatusFilter;
                return matchesSearch && matchesPriority && matchesOverdue && matchesStatus;
              });
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredRcas.map((rca) => {
                    const tpl = rcaTemplates.find(t => t.id === rca.templateId);
                    const isOverdue = rca.targetCloseDate && new Date(rca.targetCloseDate) < new Date() && rca.status !== 'Closed';
                    return (
                      <div
                        key={rca.id}
                        className="relative bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-2xl shadow-lg border border-blue-100 hover:shadow-pink-200 transition-all duration-300 p-0 overflow-hidden group cursor-pointer min-h-[170px] flex flex-col"
                        style={{ minHeight: '170px', maxWidth: '420px' }}
                        onClick={() => setSelectedRCA(rca)}
                      >
                        {/* Section Header - compact */}
                        <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-pink-50 rounded-t-2xl min-h-[48px]">
                          <FileText className="w-5 h-5 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-blue-800 tracking-tight truncate mb-0.5">{rca.title}</h3>
                            <div className="flex flex-wrap gap-1 items-center">
                              <Badge className={getStatusBadgeColor(rca.status) + ' text-xs px-2 py-0.5'}>{rca.status}</Badge>
                              <Badge className={getPriorityBadgeColor(rca.priority) + ' text-xs px-2 py-0.5'}>{rca.priority}</Badge>
                              {isOverdue && <Badge variant="destructive" className="text-xs px-2 py-0.5">Overdue</Badge>}
                              {tpl ? (
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">{tpl.name}</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-semibold">No template</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Info Grid - compact */}
                        <div className="px-4 py-3 space-y-2 flex-1">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[10px] text-gray-500 font-semibold mb-0.5 flex items-center gap-1"><BarChart3 className="w-3 h-3 text-blue-400" /> Desc</div>
                              <div className="text-xs text-gray-700 truncate">{rca.description || <span className="text-gray-400 italic">-</span>}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 font-semibold mb-0.5 flex items-center gap-1"><Target className="w-3 h-3 text-pink-400" /> Event</div>
                              <div className="text-xs text-gray-700 truncate">{getEventTitle(rca.eventId)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 font-semibold mb-0.5 flex items-center gap-1"><Users className="w-3 h-3 text-green-400" /> Team</div>
                              <div className="text-xs text-gray-700">{new Set(rca.teamMemberIds).size}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 font-semibold mb-0.5 flex items-center gap-1"><Paperclip className="w-3 h-3 text-purple-400" /> Evidence</div>
                              <div className="text-xs text-gray-700">{rca.evidence?.length || 0}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 font-semibold mb-0.5 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-blue-400" /> Recs</div>
                              <div className="text-xs text-gray-700">{rca.recommendations?.length || 0}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 font-semibold mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-400" /> Due</div>
                              <div className={`text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'}`}>{rca.targetCloseDate ? new Date(rca.targetCloseDate).toLocaleDateString() : <span className="text-gray-400 italic">-</span>}</div>
                            </div>
                          </div>
                          {/* Quick stats row - compact */}
                          <div className="flex flex-wrap gap-2 items-center mt-1">
                            <div className="flex items-center gap-1 bg-blue-50 rounded px-2 py-0.5 border border-blue-100 text-xs"><FileText className="w-3 h-3 text-blue-500" />{rca.status}</div>
                            <div className="flex items-center gap-1 bg-pink-50 rounded px-2 py-0.5 border border-pink-100 text-xs"><AlertTriangle className="w-3 h-3 text-pink-500" />{rca.priority}</div>
                            <div className="flex items-center gap-1 bg-green-50 rounded px-2 py-0.5 border border-green-100 text-xs"><Users className="w-3 h-3 text-green-500" />{new Set(rca.teamMemberIds).size}</div>
                            <div className="flex items-center gap-1 bg-purple-50 rounded px-2 py-0.5 border border-purple-100 text-xs"><Paperclip className="w-3 h-3 text-purple-500" />{rca.evidence?.length || 0}</div>
                            <div className="flex items-center gap-1 bg-yellow-50 rounded px-2 py-0.5 border border-yellow-100 text-xs"><Clock className="w-3 h-3 text-yellow-500" />{rca.targetCloseDate ? new Date(rca.targetCloseDate).toLocaleDateString() : '-'}</div>
                          </div>
                          
                          {/* Progress Bar */}
                          {(() => {
                            const totalRecs = rca.recommendations?.length || 0;
                            const completedRecs = rca.recommendations?.filter(r => r.status === 'Completed').length || 0;
                            const evidenceCount = rca.evidence?.length || 0;
                            const hasRootCause = !!rca.rootCause && rca.rootCause !== '';
                            
                            let progressPercent = 0;
                            if (totalRecs > 0) {
                              progressPercent = Math.round((completedRecs / totalRecs) * 60 + (evidenceCount > 0 ? 20 : 0) + (hasRootCause ? 20 : 0));
                            } else {
                              progressPercent = (evidenceCount > 0 ? 30 : 0) + (hasRootCause ? 70 : 0);
                            }
                            
                            return (
                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-gray-600 font-semibold">Completion</span>
                                  <span className="text-[10px] text-gray-600 font-bold">{progressPercent}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      progressPercent >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                                      progressPercent >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-600' :
                                      progressPercent >= 25 ? 'bg-gradient-to-r from-yellow-500 to-orange-600' :
                                      'bg-gradient-to-r from-red-500 to-pink-600'
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-gray-500 mt-0.5">
                                  {completedRecs}/{totalRecs} actions • {evidenceCount} evidence • {hasRootCause ? '✓' : '○'} root cause
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Premium Button - compact */}
                        <div className="flex justify-end px-4 pb-3">
                          <Button
                            variant="default"
                            className="rounded-full px-4 py-1 text-xs bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white shadow font-bold transition-all duration-200"
                            onClick={e => { e.stopPropagation(); setSelectedRCA(rca); }}
                          >
                            Open
                          </Button>
                        </div>
                        {/* Decorative gradient border bottom */}
                        <div className="h-1 w-full bg-gradient-to-r from-blue-200 via-pink-200 to-blue-200 rounded-b-2xl" />
                      </div>
                    );
                  })}
                  {filteredRcas.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No RCA Investigations</h3>
                      <p className="text-gray-500 mb-4">
                        No investigations found for your current filters.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* Show analysis view and modals only when selectedRCA is set */}
      {selectedRCA && (
        <>
          <div className="mb-4 flex items-center gap-4">
            <div className="w-full flex flex-wrap items-center gap-4 rounded-2xl shadow-xl bg-gradient-to-r from-blue-50 via-white to-pink-50 border border-blue-100 px-6 py-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedRCA(null)}
                className="rounded-full border-blue-300 shadow bg-white hover:bg-blue-50 text-blue-700 font-bold px-4 py-2 transition"
              >
                ← Back to Dashboard
              </Button>
              <h2 className="flex-1 text-3xl font-extrabold bg-gradient-to-r from-blue-700 via-pink-600 to-blue-700 bg-clip-text text-transparent tracking-tight drop-shadow-sm ml-2">
                {selectedRCA.title}
              </h2>
              <Badge className={getStatusBadgeColor(selectedRCA.status) + ' text-xs px-3 py-1 rounded-full shadow font-bold transition-transform hover:scale-105 hover:shadow-blue-300/60'}>{selectedRCA.status}</Badge>
              <Badge className={getPriorityBadgeColor(selectedRCA.priority) + ' text-xs px-3 py-1 rounded-full shadow font-bold transition-transform hover:scale-105 hover:shadow-pink-300/60'}>{selectedRCA.priority}</Badge>
              <StatusDropdown status={selectedRCA.status} onChange={handleStatusChange} />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditRCAModal(true)}
                className="rounded-full border-blue-300 shadow bg-white hover:bg-blue-100 text-blue-700 font-bold px-3 py-1 text-xs transition-transform hover:scale-105 hover:shadow-blue-300/60"
              >
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteRCAConfirm(true)}
                className="rounded-full shadow bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold px-3 py-1 text-xs border-0 transition-transform hover:scale-105 hover:shadow-pink-300/60"
              >
                Delete
              </Button>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={tab => {
            // Prevent skipping steps: only allow current or previous tabs
            const tabIdx = phaseToTabIdx(TAB_TO_PHASE[tab] || 'Definition');
            if (tabIdx <= currentTabIdx) setActiveTab(tab);
          }} className="w-full">
            <TabsList className="w-full flex justify-between mb-4 rounded-2xl shadow bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-100">
              {STATUS_PHASES.map((phase, idx) => (
                <TabsTrigger
                  key={PHASE_TO_TAB[phase]}
                  value={PHASE_TO_TAB[phase]}
                  className="flex-1"
                  disabled={idx > currentTabIdx}
                >
                  {phase}
                </TabsTrigger>
              ))}
              {/* Secondary/supporting tabs */}
              <TabsTrigger value="comments" className="flex-1 text-blue-400">Comments</TabsTrigger>
              <TabsTrigger value="track" className="flex-1 text-blue-400">Track</TabsTrigger>
              <TabsTrigger value="export" className="flex-1 text-blue-400">Export</TabsTrigger>
            </TabsList>
            <TabsContent value="definition">
              {showReviewBanner && nextPhase === 'Data Collection' && activeTab === 'definition' && (
                <div className="w-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl shadow p-4 flex items-center justify-between mb-4">
                  <div className="text-green-800 font-semibold">Phase complete! Ready to advance to <b>{nextPhase}</b>.</div>
                  <Button className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white font-bold px-6 py-2" onClick={handleAdvancePhase}>
                    Review & Advance
                  </Button>
                </div>
              )}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                {/* Event & Charter Card - Beautiful Style */}
                <Card className="col-span-1 rounded-3xl shadow-2xl border-0 bg-gradient-to-br from-blue-50 via-white to-pink-50">
                  <CardHeader className="rounded-t-3xl bg-gradient-to-r from-blue-100/80 to-pink-100/80 border-b border-blue-100 flex flex-row items-center gap-3 py-6 px-6">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-500" />
                      <CardTitle className="text-xl font-extrabold text-blue-800 tracking-tight">Event & Charter</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-8 py-6 space-y-8">
                    {/* Event details if linked */}
                    {selectedRCA.eventId && (
                      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-100 shadow flex flex-col gap-2">
                        <div className="font-semibold text-blue-700 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-pink-500" /> Linked Event
                          </span>
                          {!isEditingEvent && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs px-3 py-1 rounded-full hover:bg-blue-100"
                              onClick={() => {
                                setIsEditingEvent(true);
                                setSelectedEventId(selectedRCA.eventId);
                              }}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit Event
                            </Button>
                          )}
                        </div>
                        
                        {isEditingEvent ? (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-blue-700 font-semibold mb-1">Select New Event</Label>
                              <select
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 bg-white"
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                              >
                                {events.map(ev => {
                                  const asset = assets.find((a: any) => a.id === ev.assetId);
                                  return (
                                    <option key={ev.id} value={ev.id}>
                                      {ev.eventType ? `[${ev.eventType}] ` : ''}{asset?.name || 'Unknown Asset'} - {ev.description?.substring(0, 80) || 'No description'}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs px-4 py-1 rounded-full"
                                onClick={() => {
                                  setIsEditingEvent(false);
                                  setSelectedEventId(selectedRCA.eventId);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="text-xs px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white"
                                onClick={async () => {
                                  try {
                                    const updated = await masterDataService.updateRCA(selectedRCA.id, {
                                      eventId: selectedEventId
                                    });
                                    setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
                                    setIsEditingEvent(false);
                                    toast({
                                      title: 'Success',
                                      description: 'Linked event updated successfully',
                                    });
                                  } catch (error) {
                                    console.error('Failed to update linked event:', error);
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to update linked event',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const event = events.find(e => e.id === selectedRCA.eventId);
                              if (!event) return <div className="text-xs text-gray-600">ID: {selectedRCA.eventId}</div>;
                              
                              // Get names from IDs
                              const asset = assets.find((a: any) => a.id === event.assetId);
                              const impactCode = impactCodes.find((ic: any) => ic.id === event.impactCodeId);
                              const oeeCode = oeeCodes.find((oc: any) => oc.id === event.oeeCodeId);
                              
                              return (
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div>ID: {event.id}</div>
                                  <div>Date: {new Date(event.startTime).toLocaleString()}</div>
                                  <div>Asset: {asset?.name || event.assetId || 'N/A'}</div>
                                  <div>Impact Code: {impactCode?.name || event.impactCodeId || 'N/A'}</div>
                                  <div>OEE Code: {oeeCode?.name || event.oeeCodeId || 'N/A'}</div>
                                  <div>Description: {event.description}</div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}
                    {/* RCA status and timeline */}
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                      <Badge className={getStatusBadgeColor(selectedRCA.status) + ' text-xs px-3 py-1 rounded-full shadow'}>{selectedRCA.status}</Badge>
                      <Badge className={getPriorityBadgeColor(selectedRCA.priority) + ' text-xs px-3 py-1 rounded-full shadow'}>{selectedRCA.priority}</Badge>
                      {/* <span className="text-xs text-gray-500">Created: {new Date(selectedRCA.createdAt).toLocaleDateString()}</span> */}
                     
                      {selectedRCA.targetCloseDate && <span className="text-xs text-gray-500">Target Close: {new Date(selectedRCA.targetCloseDate).toLocaleDateString()}</span>}
                    </div>
                    {/* Team charter guidance */}
                    <div className="mb-2 text-xs text-gray-500 bg-gradient-to-r from-blue-50 to-pink-50 rounded-xl p-3 border border-blue-100 shadow-sm">
                      <span className="font-semibold text-blue-700 flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-400" /> Team Charter Guidance</span>
                      <div className="mt-1">A good team charter defines the mission, scope, and goals for this RCA. Example: <span className="italic text-gray-600">"Investigate the root cause of repeated pump failures in Unit 3 and recommend sustainable corrective actions."</span></div>
                    </div>
                    <form className="space-y-6" onSubmit={async e => {
                      e.preventDefault();
                      try {
                        const updated = await masterDataService.updateRCA(selectedRCA.id, {
                          title: editRCAForm.title,
                          description: editRCAForm.description,
                          teamCharter: editRCAForm.teamCharter, // <-- persist teamCharter
                          teamLeadId: editRCAForm.teamLeadId,
                          teamMemberIds: editRCAForm.teamMemberIds,
                        });
                        setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
                        toast({ title: 'Success', description: 'RCA definition updated.' });
                      } catch (err) {
                        toast({ title: 'Error', description: 'Failed to update RCA definition.', variant: 'destructive' });
                      }
                    }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-xs text-blue-700 font-semibold">Event Title</Label>
                          <Input value={editRCAForm.title} onChange={e => setEditRCAForm(f => ({ ...f, title: e.target.value }))}
                            required
                            className="rounded-xl border-blue-200 shadow-sm mt-1"
                            onBlur={async e => {
                              if (editRCAForm.title !== selectedRCA.title) {
                                const updated = await masterDataService.updateRCA(selectedRCA.id, { title: editRCAForm.title });
                                setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-blue-700 font-semibold">Description</Label>
                          <Textarea value={editRCAForm.description} onChange={e => setEditRCAForm(f => ({ ...f, description: e.target.value }))}
                            className="rounded-xl border-blue-200 shadow-sm mt-1 min-h-[48px]"
                            onBlur={async e => {
                              if (editRCAForm.description !== selectedRCA.description) {
                                const updated = await masterDataService.updateRCA(selectedRCA.id, { description: editRCAForm.description });
                                setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
                              }
                            }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs text-blue-700 font-semibold">Team Charter</Label>
                          <Textarea value={editRCAForm.teamCharter || ''} onChange={e => setEditRCAForm(f => ({ ...f, teamCharter: e.target.value }))}
                            placeholder="Describe the team's mission, scope, and goals for this RCA..."
                            className="rounded-xl border-blue-200 shadow-sm mt-1 min-h-[64px]"
                            onBlur={async e => {
                              if (editRCAForm.teamCharter !== selectedRCA.teamCharter) {
                                const updated = await masterDataService.updateRCA(selectedRCA.id, { teamCharter: editRCAForm.teamCharter });
                                setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2 pt-2">
                        <Button type="submit" size="sm" className="rounded-full px-6 py-2 text-base bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white shadow-lg font-bold">Save Definition</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
                {/* RCA Team Card - Beautiful Style */}
                <Card className="col-span-1 rounded-3xl shadow-2xl border-0 bg-gradient-to-br from-pink-50 via-white to-blue-50">
                  <CardHeader className="rounded-t-3xl bg-gradient-to-r from-pink-100/80 to-blue-100/80 border-b border-pink-100 flex flex-row items-center gap-3 py-6 px-6">
                    <div className="flex items-center gap-3">
                      <Users className="w-8 h-8 text-green-500" />
                      <CardTitle className="text-xl font-extrabold text-pink-800 tracking-tight">RCA Team</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-8 py-6">
                    <TeamMembersEditor
                      teamMemberIds={editRCAForm.teamMemberIds || []}
                      onChange={ids => setEditRCAForm(f => ({ ...f, teamMemberIds: ids }))}
                      allUsers={allUsers}
                      teamLeadId={editRCAForm.teamLeadId || ''}
                      onLeadChange={id => setEditRCAForm(f => ({ ...f, teamLeadId: id }))}
                      renderUser={user => (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center font-bold text-blue-700 shadow">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-blue-900">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.role}</div>
                          </div>
                        </div>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="data-collection">
              {showReviewBanner && nextPhase === 'Analysis' && activeTab === 'data-collection' && (
                <div className="w-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl shadow p-4 flex items-center justify-between mb-4">
                  <div className="text-green-800 font-semibold">Phase complete! Ready to advance to <b>{nextPhase}</b>.</div>
                  <Button className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white font-bold px-6 py-2" onClick={handleAdvancePhase}>
                    Review & Advance
                  </Button>
                </div>
              )}
              {/* Evidence stats and actions - Beautiful Style */}
              <div className="mb-6 w-full rounded-2xl shadow-xl bg-gradient-to-r from-blue-50 via-white to-pink-50 border border-blue-100 px-6 py-4 flex flex-wrap gap-4 items-center">
                <Input
                  className="w-64 bg-white border-blue-200 shadow-sm rounded-full px-4 py-2 text-base focus:ring-2 focus:ring-blue-200"
                  placeholder="Search evidence by title, type, or user..."
                  value={evidenceFilter}
                  onChange={e => setEvidenceFilter(e.target.value)}
                />
                <div className="flex gap-2 items-center ml-auto">
                  <Button size="sm" variant={evidenceViewMode === 'table' ? 'default' : 'outline'}
                    className={evidenceViewMode === 'table' ? 'rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold' : 'rounded-full border-blue-300 shadow bg-white hover:bg-blue-50 text-blue-700 font-bold'}
                    onClick={() => setEvidenceViewMode('table')}>Table View</Button>
                  <Button size="sm" variant={evidenceViewMode === 'list' ? 'default' : 'outline'}
                    className={evidenceViewMode === 'list' ? 'rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold' : 'rounded-full border-blue-300 shadow bg-white hover:bg-pink-50 text-pink-700 font-bold'}
                    onClick={() => setEvidenceViewMode('list')}>Card View</Button>
                  <Button size="sm" className="ml-4 flex gap-2 items-center rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow-lg font-bold px-6 py-2 hover:from-blue-700 hover:to-pink-600" onClick={handleAddEvidence}><Plus className="w-4 h-4" /> Add Evidence</Button>
                </div>
              </div>
              {/* Evidence type summary badges and last timestamp row - Beautiful Style */}
              <div className="mb-6 w-full rounded-2xl shadow bg-gradient-to-r from-pink-50 via-white to-blue-50 border border-pink-100 px-6 py-4 flex flex-wrap gap-4 items-center">
                {['Photo', 'Document', 'Video', 'Note', 'Time Series'].map(type => (
                  <div key={type} className="flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-pink-100 border border-blue-200 shadow text-base font-bold">
                    <span>{type === 'Photo' ? '📷' : type === 'Document' ? '📄' : type === 'Video' ? '🎥' : type === 'Note' ? '📝' : '📊'}</span>
                    <span>{selectedRCA.evidence?.filter(ev => ev.type === type).length || 0}</span>
                    <span className="text-xs text-gray-500 font-semibold">{type}</span>
                  </div>
                ))}
                {selectedRCA.evidence && selectedRCA.evidence.length > 0 && (() => {
                  const lastEvidence = selectedRCA.evidence[selectedRCA.evidence.length - 1];
                  const timestamp = lastEvidence.collectedAt || lastEvidence.createdAt;
                  if (!timestamp) return null;
                  
                  const date = new Date(timestamp);
                  if (isNaN(date.getTime())) return null; // Invalid date check
                  
                  return (
                    <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r from-green-100 to-blue-100 border border-green-200 shadow text-base font-bold">
                      <span>🕒</span>
                      <span className="text-xs text-gray-500">Last: {date.toLocaleString()}</span>
                    </div>
                  );
                })()}
              </div>
              {/* Evidence Table/List View */}
              {evidenceViewMode === 'table' ? (
                <div className="overflow-x-auto rounded-2xl border-0 shadow-2xl bg-gradient-to-br from-blue-50 via-white to-pink-50">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Category</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Task</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Type</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Due Date</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Verified</th> {/* New column */}
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Attachments</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedRCA.evidence || []).filter(ev =>
                        (!evidenceFilter ||
                          ev.title.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                          (allUsers.find(u => u.id === ev.collectedBy)?.name || '').toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                          ev.type.toLowerCase().includes(evidenceFilter.toLowerCase())
                        )
                      ).map(ev => {
                        // Color for 5P
                        const fivePColors = {
                          Parts: 'bg-blue-100 text-blue-700',
                          Paper: 'bg-yellow-100 text-yellow-700',
                          People: 'bg-green-100 text-green-700',
                          Place: 'bg-purple-100 text-purple-700',
                          Process: 'bg-pink-100 text-pink-700',
                        };
                        const isOverdue = ev.dueDate && ev.status !== 'completed' && new Date(ev.dueDate) < new Date();
                        return (
                          <tr key={ev.id} className={"transition " + (isOverdue ? 'bg-red-100/40' : 'hover:bg-blue-100/40') + " text-center align-middle"}>
                            <td className="px-4 py-2 text-xs font-semibold align-middle">
                              <span className={`inline-block px-2 py-0.5 rounded-full shadow ${fivePColors[ev.fiveP] || 'bg-gray-100 text-gray-700'}`}>{ev.fiveP || '-'}</span>
                            </td>
                            <td className="px-4 py-2 text-xs align-middle max-w-xs">
                              {ev.task ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="truncate cursor-pointer text-left w-full font-semibold text-blue-900" title="">
                                        {ev.task}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs break-words text-base font-medium bg-gradient-to-br from-blue-50 to-pink-50 border-blue-200 shadow-xl rounded-xl">
                                      {ev.task}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs align-middle">{ev.type}</td>
                            <td className={`px-4 py-2 text-xs align-middle ${isOverdue ? 'text-red-600 font-bold' : ''}`}>{ev.dueDate ? new Date(ev.dueDate).toLocaleDateString() : <span className="text-gray-400 italic">-</span>}</td>
                            <td className="px-4 py-2 text-xs align-middle">
                              {ev.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 shadow font-bold"><CheckCircle className="w-4 h-4 inline" /> Completed</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 shadow font-bold"><Clock className="w-4 h-4 inline" /> Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs align-middle">
                              {ev.verified ? (
                                <span className="inline-flex items-center gap-1 text-green-600 font-bold" title="Verified">
                                  <CheckCircle className="w-4 h-4" /> Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-yellow-600 font-bold" title="Not Verified">
                                  <AlertTriangle className="w-4 h-4" /> No
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs align-middle">
                              {ev.attachments && ev.attachments.length > 0 ? (
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {(Array.isArray(ev.attachments) && ev.attachments.length > 0 && !(ev.attachments[0] instanceof File) ? ev.attachments.filter(isRCAAttachment).map((att, idx) => {
                                    if (!isRCAAttachment(att)) return null;
                                    const name = att.name;
                                    const dataUrl = att.dataUrl;
                                    const type = att.type;
                                    return (
                                      <a
                                        key={idx}
                                        href={dataUrl}
                                        download={name}
                                        className="inline-flex flex-col items-center gap-1 px-1 py-1 rounded-xl bg-gradient-to-br from-blue-50 to-pink-50 border border-blue-200 shadow hover:shadow-xl transition text-xs w-14 h-14 justify-center overflow-hidden group relative"
                                        title={name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {type === 'image/png' || type === 'image/jpeg' ? (
                                          <img
                                            src={dataUrl}
                                            alt={name}
                                            className="object-cover w-10 h-10 rounded-md border border-white group-hover:scale-110 transition-transform"
                                          />
                                        ) : type === 'video/mp4' ? (
                                          <Video className="w-8 h-8 text-blue-600" />
                                        ) : type === 'application/pdf' ? (
                                          <FileText className="w-8 h-8 text-red-600" />
                                        ) : (
                                          <Paperclip className="w-8 h-8 text-gray-400" />
                                        )}
                                        <span className="text-[10px] text-gray-500 truncate w-12 text-center mt-1">{name}</span>
                                      </a>
                                    );
                                  }) : null)}
                                </div>
                              ) : <span className="text-gray-400 italic">None</span>}
                            </td>
                            <td className="px-4 py-2 text-xs align-middle">
                              <div className="flex gap-2 justify-center">
                                <button className="p-1 rounded-full bg-white shadow hover:bg-blue-100 text-blue-700 font-bold transition" title="View" onClick={() => handleViewEvidence(ev)}><Eye className="w-4 h-4" /></button>
                                <button className="p-1 rounded-full bg-white shadow hover:bg-green-100 text-green-700 font-bold transition" title="Edit" onClick={() => handleEditEvidence(ev)}><Pencil className="w-4 h-4" /></button>
                                <button className="p-1 rounded-full bg-white shadow hover:bg-red-100 text-red-700 font-bold transition" title="Delete" onClick={() => handleDeleteEvidence(ev)}><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(selectedRCA.evidence || []).filter(ev =>
                        (!evidenceFilter ||
                          ev.title.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                          (allUsers.find(u => u.id === ev.collectedBy)?.name || '').toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                          ev.type.toLowerCase().includes(evidenceFilter.toLowerCase())
                        )
                      ).length === 0 && (
                        <tr><td colSpan={8} className="text-center text-gray-400 italic py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Paperclip className="w-12 h-12 text-blue-200 mb-2" />
                            <span className="text-lg font-semibold text-blue-400">No evidence found.</span>
                          </div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                // ... keep card/list view as before, but polish if needed ...
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(selectedRCA.evidence || []).filter(ev =>
                    (!evidenceFilter ||
                      ev.title.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                      (allUsers.find(u => u.id === ev.collectedBy)?.name || '').toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                      ev.type.toLowerCase().includes(evidenceFilter.toLowerCase())
                    )
                  ).map(ev => {
                    const fivePColors = {
                      Parts: 'bg-blue-100 text-blue-700',
                      Paper: 'bg-yellow-100 text-yellow-700',
                      People: 'bg-green-100 text-green-700',
                      Place: 'bg-purple-100 text-purple-700',
                      Process: 'bg-pink-100 text-pink-700',
                    };
                    const isOverdue = ev.dueDate && ev.status !== 'completed' && new Date(ev.dueDate) < new Date();
                    return (
                      <div key={ev.id} className={`rounded-2xl p-6 bg-gradient-to-br from-blue-50 via-white to-pink-50 shadow-xl flex flex-col gap-2 hover:shadow-2xl border-0 transition ${isOverdue ? 'ring-2 ring-red-300' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-block px-3 py-1 rounded-full shadow text-xs font-bold ${fivePColors[ev.fiveP] || 'bg-gray-100 text-gray-700'}`}>{ev.fiveP || '-'}</span>
                          <span className="text-xs text-blue-700 font-bold">{ev.type}</span>
                          {ev.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs shadow font-bold"><CheckCircle className="w-4 h-4 inline" /> Completed</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs shadow font-bold"><Clock className="w-4 h-4 inline" /> Pending</span>
                          )}
                        </div>
                        <div className="font-extrabold text-lg text-blue-900">{ev.title}</div>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Task: {ev.task || <span className="text-gray-400 italic">-</span>}</div>
                        <div className={`text-xs mb-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>Due: {ev.dueDate ? new Date(ev.dueDate).toLocaleDateString() : <span className="text-gray-400 italic">-</span>}</div>
                        <div className="text-xs text-gray-400 mb-1">{ev.description}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(Array.isArray(ev.attachments) && ev.attachments.length > 0 && !(ev.attachments[0] instanceof File) ? ev.attachments.filter(isRCAAttachment).map((att, idx) => {
                            if (!isRCAAttachment(att)) return null;
                            const name = att.name;
                            const dataUrl = att.dataUrl;
                            const type = att.type;
                            return (
                              <a key={idx} href={dataUrl} download={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-gradient-to-br from-blue-50 to-pink-50 border border-blue-200 shadow hover:bg-blue-100 hover:text-blue-700 transition text-xs" title={name} target="_blank" rel="noopener noreferrer">
                                <Paperclip className="w-4 h-4" />
                                <span className="truncate max-w-[80px]">{name}</span>
                              </a>
                            );
                          }) : null)}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button className="p-1 rounded-full bg-white shadow hover:bg-blue-100 text-blue-700 font-bold transition" title="View" onClick={() => handleViewEvidence(ev)}><Eye className="w-4 h-4" /></button>
                          <button className="p-1 rounded-full bg-white shadow hover:bg-green-100 text-green-700 font-bold transition" title="Edit" onClick={() => handleEditEvidence(ev)}><Pencil className="w-4 h-4" /></button>
                          <button className="p-1 rounded-full bg-white shadow hover:bg-red-100 text-red-700 font-bold transition" title="Delete" onClick={() => handleDeleteEvidence(ev)}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {(selectedRCA.evidence || []).filter(ev =>
                    (!evidenceFilter ||
                      ev.title.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                      (allUsers.find(u => u.id === ev.collectedBy)?.name || '').toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                      ev.type.toLowerCase().includes(evidenceFilter.toLowerCase())
                    )
                  ).length === 0 && (
                    <div className="text-center text-gray-400 italic col-span-full py-12 flex flex-col items-center gap-2">
                      <Paperclip className="w-12 h-12 text-blue-200 mb-2" />
                      <span className="text-lg font-semibold text-blue-400">No evidence found.</span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="analysis">
              {/* Fullscreen Toggle Button */}
              <div className="flex items-center justify-between mb-4">
                {showReviewBanner && nextPhase === 'Recommendations' && activeTab === 'analysis' && (
                  <div className="flex-1 bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl shadow p-4 flex items-center justify-between mr-4">
                    <div className="text-green-800 font-semibold">Phase complete! Ready to advance to <b>{nextPhase}</b>.</div>
                    <Button className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white font-bold px-6 py-2" onClick={handleAdvancePhase}>
                      Review & Advance
                    </Button>
                  </div>
                )}
                <Button
                  onClick={() => setIsAnalysisFullscreen(!isAnalysisFullscreen)}
                  variant="outline"
                  size="sm"
                  className="ml-auto border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-500"
                  title={isAnalysisFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isAnalysisFullscreen ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 mr-2" />
                      Fullscreen View
                    </>
                  )}
                </Button>
              </div>

              {/* --- ANALYZE TAB: Full width content (statistics cards are now in each sub-tab) --- */}
              <div className={`${isAnalysisFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto p-6' : ''}`}>
                <div className="w-full">
                  {/* Fullscreen header with close button */}
                  {isAnalysisFullscreen && (
                    <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-800">Analysis Tools - Fullscreen Mode</h2>
                          <p className="text-sm text-gray-600">{selectedRCA.title}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => setIsAnalysisFullscreen(false)}
                        variant="outline"
                        size="sm"
                        className="border-2 border-red-300 hover:bg-red-50 hover:border-red-500"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Exit Fullscreen
                      </Button>
                    </div>
                  )}
                  <Tabs defaultValue="logic-tree" className="w-full">
                    {(() => {
                      const enabledTools = analysisConfig?.enabledTools ?? DEFAULT_ANALYSIS_CONFIGS.OilAndGas.enabledTools;
                      return (
                        <>
                    <TabsList className="w-full flex flex-wrap justify-start mb-4 rounded-2xl shadow bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-100 gap-1 h-auto p-1">
                      <TabsTrigger value="logic-tree" className="flex-shrink-0">Logic Tree</TabsTrigger>
                      <TabsTrigger value="event-diagram" className="flex-shrink-0">Event Diagram</TabsTrigger>
                      <TabsTrigger value="event-timeline" className="flex-shrink-0">Event Timeline</TabsTrigger>
                      {enabledTools.fiveWhy !== false && (
                        <TabsTrigger value="5why" className="flex-shrink-0 text-green-600">5-Why</TabsTrigger>
                      )}
                      {enabledTools.fishbone !== false && (
                        <TabsTrigger value="fishbone" className="flex-shrink-0 text-purple-600">Fishbone</TabsTrigger>
                      )}
                      {enabledTools.fmea !== false && (
                        <TabsTrigger value="fmea" className="flex-shrink-0 text-amber-600">FMEA</TabsTrigger>
                      )}
                      {enabledTools.faultTree !== false && (
                        <TabsTrigger value="fault-tree" className="flex-shrink-0 text-indigo-600">Fault Tree</TabsTrigger>
                      )}
                      {enabledTools.barrierAnalysis !== false && (
                        <TabsTrigger value="barrier" className="flex-shrink-0 text-teal-600">Barrier</TabsTrigger>
                      )}
                      {enabledTools.changeAnalysis !== false && (
                        <TabsTrigger value="change" className="flex-shrink-0 text-rose-600">Change</TabsTrigger>
                      )}
                    </TabsList>
                    <TabsContent value="logic-tree">
                      <div className={`space-y-4 ${isAnalysisFullscreen ? 'max-w-full' : 'max-w-5xl'} mx-auto`}>
                        {/* Header Section - Matches Dashboard Theme */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FolderTree className="w-6 h-6 text-blue-600" />
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">Logic Tree Analysis</h3>
                              <p className="text-sm text-gray-600">
                                Systematic cause-and-effect investigation
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setShowLogicTreeFullscreen(true)}
                              title="Fullscreen View"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => downloadLogicTree(selectedRCA.logicTree)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Export
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={handleAddRootNode}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Node
                            </Button>
                            {selectedRCA.templateId && rcaTemplates.find(t => t.id === selectedRCA.templateId) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowResetLogicTreeModal(true)}
                                disabled={resettingLogicTree}
                              >
                                Reset Template
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Statistics Cards - Matching Dashboard Style */}
                        {selectedRCA.logicTree && selectedRCA.logicTree.length > 0 && (
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
                                <FolderTree className="h-4 w-4 text-blue-400" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-blue-700">
                                  {(() => {
                                    const countNodes = (nodes: UILogicTreeNode[]): number => {
                                      return nodes.reduce((sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0), 0);
                                    };
                                    return countNodes(selectedRCA.logicTree);
                                  })()}
                                </div>
                                <p className="text-xs text-gray-600 mt-1">In logic tree</p>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Verified</CardTitle>
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-green-700">
                                  {(() => {
                                    const countVerified = (nodes: UILogicTreeNode[]): number => {
                                      return nodes.reduce((sum, n) => sum + (n.finding ? 1 : 0) + (n.children ? countVerified(n.children) : 0), 0);
                                    };
                                    return countVerified(selectedRCA.logicTree);
                                  })()}
                                </div>
                                <p className="text-xs text-gray-600 mt-1">Verified findings</p>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Root Causes</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-red-700">
                                  {(() => {
                                    const countRootCauses = (nodes: UILogicTreeNode[]): number => {
                                      return nodes.reduce((sum, n) => sum + ((n.category === 'Cause' || n.category === 'root_cause') ? 1 : 0) + (n.children ? countRootCauses(n.children) : 0), 0);
                                    };
                                    return countRootCauses(selectedRCA.logicTree);
                                  })()}
                                </div>
                                <p className="text-xs text-gray-600 mt-1">Identified</p>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Evidence Links</CardTitle>
                                <Paperclip className="h-4 w-4 text-yellow-400" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-yellow-700">
                                  {(selectedRCA.evidence || []).filter(e => e.nodeIds && e.nodeIds.length > 0).length}
                                </div>
                                <p className="text-xs text-gray-600 mt-1">Supporting evidence</p>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* Logic Tree Container */}
                        <Card>
                          <CardContent className="p-6">
                            {selectedRCA.logicTree && selectedRCA.logicTree.length > 0 ? (
                              <ul className="space-y-0">
                                {selectedRCA.logicTree.map((node, idx) => (
                                  <LogicTreeNodeInteractive
                                    key={node.id || idx}
                                    node={node}
                                    depth={0}
                                    onChange={updatedNode => handleLogicTreeNodeChange(node.id, updatedNode)}
                                    onDelete={() => handleDeleteNode(idx)}
                                    onAddChild={() => handleAddChildNode(idx)}
                                    onEdit={updatedNode => handleLogicTreeNodeChange(node.id, updatedNode)}
                                    evidence={selectedRCA.evidence}
                                    onAttachEvidence={handleAttachEvidence}
                                  />
                                ))}
                              </ul>
                            ) : (
                              <div className="text-center py-12">
                                <FolderTree className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h4 className="text-lg font-semibold text-gray-700 mb-2">No Logic Tree Nodes</h4>
                                <p className="text-gray-500 mb-6">
                                  Start building your root cause analysis by adding a node.
                                </p>
                                <Button onClick={handleAddRootNode}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add First Node
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                      {/* Reset Logic Tree Confirmation Modal */}
                      {showResetLogicTreeModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-red-100 flex flex-col items-center">
                            <button className="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-xl font-bold" onClick={() => setShowResetLogicTreeModal(false)} aria-label="Close">&times;</button>
                            <h2 className="text-xl font-bold text-red-700 mb-4">Reset Logic Tree?</h2>
                            <p className="mb-4 text-center">Are you sure you want to reset the logic tree to the original template? <br/>This will overwrite all current nodes and cannot be undone.</p>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button type="button" variant="outline" onClick={() => setShowResetLogicTreeModal(false)} size="sm">Cancel</Button>
                              <Button type="button" variant="destructive" onClick={handleResetLogicTreeToTemplate} size="sm" disabled={resettingLogicTree}>{resettingLogicTree ? 'Resetting...' : 'Reset'}</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="event-diagram">
                      <div className="mb-6 w-full rounded-2xl shadow-xl bg-gradient-to-br from-pink-50 via-white to-blue-50 border border-pink-100 px-6 py-4">
                        <div className="flex items-center gap-3 mb-2">
                          <BarChart3 className="w-6 h-6 text-pink-500" />
                          <h3 className="text-lg font-bold text-pink-800 flex items-center gap-2">
                            Event Diagram
                            <button type="button" title="Fullscreen" className="ml-2 p-1 rounded-full hover:bg-pink-100 transition" onClick={() => setShowEventDiagramFullscreen(true)}>
                              <Maximize2 className="w-5 h-5 text-pink-500" />
                            </button>
                          </h3>
                        </div>
                        <div className="text-xs text-gray-500 mb-4">Visualize and edit the sequence and relationships of events leading up to this RCA. Add, edit, or connect events to build a clear timeline or flow of contributing factors.</div>
                        <EventDiagram
                          nodes={diagramNodes}
                          edges={diagramEdges}
                          assets={assets}
                          units={units}
                          onNodesChange={async nodes => {
                            setDiagramNodes(nodes);
                            await masterDataService.updateRCA(selectedRCA.id, {
                              eventDiagram: {
                                nodes,
                                edges: diagramEdges,
                              }
                            });
                            const updated = await masterDataService.getRCAs({ tenantId: selectedRCA.tenantId });
                            const newRCA = updated.find(r => r.id === selectedRCA.id);
                            if (newRCA) setSelectedRCA({ ...newRCA, logicTree: Array.isArray(newRCA.logicTree) && newRCA.logicTree.length > 0 ? flatListToTree(newRCA.logicTree as any[]) : [] });
                          }}
                          onEdgesChange={async edges => {
                            setDiagramEdges(edges);
                            await masterDataService.updateRCA(selectedRCA.id, {
                              eventDiagram: {
                                nodes: diagramNodes,
                                edges,
                              }
                            });
                            const updated = await masterDataService.getRCAs({ tenantId: selectedRCA.tenantId });
                            const newRCA = updated.find(r => r.id === selectedRCA.id);
                            if (newRCA) setSelectedRCA({ ...newRCA, logicTree: Array.isArray(newRCA.logicTree) && newRCA.logicTree.length > 0 ? flatListToTree(newRCA.logicTree as any[]) : [] });
                          }}
                          onAddEvent={() => {}}
                          onEditEvent={() => {}}
                          onDeleteEvent={() => {}}
                          onConnect={conn => {}}
                          filterNodeIds={diagramNodes.map(n => n.id)}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="event-timeline">
                      <div className="mb-6 w-full rounded-2xl shadow-xl bg-gradient-to-br from-blue-50 via-white to-pink-50 border border-blue-100 px-6 py-4">
                        <div className="flex items-center gap-3 mb-2">
                          <BarChart3 className="w-6 h-6 text-blue-500" />
                          <h3 className="text-lg font-bold text-blue-800">Event Timeline</h3>
                        </div>
                        <div className="text-xs text-gray-500 mb-4">Chronological timeline of all RCA-linked events. Add, edit, or link evidence to events.</div>
                        <Button size="sm" className="mb-4 rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold" onClick={() => {
                          setManualEventMode('add');
                          setManualEventForm({ id: '', label: '', type: 'Failure', timestamp: '', description: '', asset: '', severity: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical' });
                          setShowManualEventModal(true);
                        }}>+ Add Manual Event</Button>
                        {/* --- INDUSTRY-GRADE EVENT FILTERING LOGIC --- */}
                        {(() => {
                          const primaryEvent = events.find(ev => ev.id === selectedRCA?.eventId);
                          let relatedEvents: ProductionEvent[] = [];
                          if (primaryEvent && primaryEvent.assetId && primaryEvent.startTime) {
                            const mainTime = new Date(primaryEvent.startTime).getTime();
                            const weekMs = 7 * 24 * 60 * 60 * 1000;
                            relatedEvents = events.filter(ev =>
                              ev.assetId === primaryEvent.assetId &&
                              ev.id !== primaryEvent.id &&
                              ev.startTime &&
                              Math.abs(new Date(ev.startTime).getTime() - mainTime) <= weekMs
                            );
                          }
                          const evidenceLinkedEventIds = new Set(
                            (selectedRCA?.evidence || []).flatMap(ev => [ev.relatedAssetId, ...(ev.nodeIds || [])]).filter(Boolean)
                          );
                          const evidenceLinkedEvents = events.filter(ev => evidenceLinkedEventIds.has(ev.id));
                          
                          // Convert event diagram nodes to timeline events with proper timestamps
                          const eventDiagramEvents = (selectedRCA?.eventDiagram?.nodes || []).map((n: any, index: number) => {
                            const nodeData = n.data || {};
                            const nodeType = n.type || 'event';
                            
                            // Map node types to severity
                            let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
                            if (nodeType === 'failure') severity = 'Critical';
                            else if (nodeType === 'alarm') severity = 'High';
                            else if (nodeType === 'warning') severity = 'Medium';
                            else if (nodeType === 'normal' || nodeType === 'resolution') severity = 'Low';
                            
                            // Create proper ISO timestamp for sorting
                            const baseTime = primaryEvent?.startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                            const baseDate = new Date(baseTime);
                            const eventTimestamp = new Date(baseDate.getTime() + index * 3600000).toISOString(); // Space by 1 hour
                            
                            return {
                              id: n.id || `diagram-node-${index}`,
                              type: 'Event Diagram' as any,
                              title: nodeData.label || `Event ${index + 1}`,
                              timestamp: eventTimestamp,
                              description: `${nodeData.time ? `🕐 ${nodeData.time}\n` : ''}${nodeData.description || ''}`,
                              asset: 'Event Diagram',
                              severity: severity,
                              evidenceCount: (selectedRCA?.evidence || []).filter(e => Array.isArray(e.nodeIds) && e.nodeIds.includes(n.id)).length,
                              status: 'Closed' as any,
                            };
                          });
                          
                          const allEventsMap = new Map();
                          if (primaryEvent) allEventsMap.set(primaryEvent.id, primaryEvent);
                          for (const ev of relatedEvents) allEventsMap.set(ev.id, ev);
                          for (const ev of evidenceLinkedEvents) allEventsMap.set(ev.id, ev);
                          let timelineEvents = Array.from(allEventsMap.values()).map(ev => {
                            const assetName = getAssetOrUnitName(ev.assetId);
                            return {
                              id: ev.id,
                              type: 'Production',
                              title: ev.description,
                              timestamp: ev.startTime,
                              description: ev.description,
                              asset: assetName,
                              severity: ev.severity,
                              evidenceCount: (selectedRCA?.evidence || []).filter(e => e.relatedAssetId === ev.assetId || (Array.isArray(e.nodeIds) && e.nodeIds.includes(ev.id))).length,
                            };
                          });
                          
                          // Add event diagram events to timeline
                          timelineEvents = timelineEvents.concat(eventDiagramEvents);
                          
                          timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                          return (
                            <RCATimeline
                              productionEvents={timelineEvents}
                              manualEvents={[]}
                              evidence={selectedRCA?.evidence || []}
                              onEdit={ev => {
                                if (ev.type === 'Production') return;
                                setManualEventMode('edit');
                                setManualEventForm({
                                  id: ev.id,
                                  label: ev.title,
                                  type: ev.type,
                                  timestamp: ev.timestamp,
                                  description: ev.description || '',
                                  asset: ev.asset || '',
                                  severity: (ev.severity || 'Medium') as 'Low' | 'Medium' | 'High' | 'Critical',
                                });
                                setShowManualEventModal(true);
                              }}
                              onDelete={ev => {
                                if (ev.type === 'Production') return;
                                if (!window.confirm('Delete this manual event?')) return;
                                const nodes = (selectedRCA?.eventDiagram?.nodes || []).filter((n: any) => n.id !== ev.id);
                                masterDataService.updateRCA(selectedRCA.id, { eventDiagram: { ...selectedRCA?.eventDiagram, nodes } }).then(updated => {
                                  setSelectedRCA({ ...updated, logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 ? flatListToTree(updated.logicTree as any[]) : [] });
                                });
                              }}
                              onLinkEvidence={ev => {
                                setLinkEvidenceEvent(ev);
                                let linkedIds: string[] = [];
                                if (ev.type === 'Production') {
                                  linkedIds = (selectedRCA?.evidence || []).filter(e => e.relatedAssetId === ev.asset || (Array.isArray(e.nodeIds) && e.nodeIds.includes(ev.id))).map(e => e.id);
                                } else {
                                  linkedIds = (selectedRCA?.evidence || []).filter(e => Array.isArray(e.nodeIds) && e.nodeIds.includes(ev.id)).map(e => e.id);
                                }
                                setLinkEvidenceSelection(linkedIds);
                                setShowLinkEvidenceModal(true);
                              }}
                            />
                          );
                        })()}
                      </div>
                    </TabsContent>
                    
                    {/* 5-Why Analysis Tab */}
                    {enabledTools.fiveWhy !== false && (
                    <TabsContent value="5why">
                      <FiveWhyAnalysisTool
                        rcaId={selectedRCA.id}
                        initialProblem={selectedRCA.description || selectedRCA.title}
                        onSave={async (analysis) => {
                          try {
                            const saved = await rcaAnalysisConfigService.saveFiveWhyAnalysis(analysis, currentFiveWhy);
                            setCurrentFiveWhy(saved);
                            const updated = await masterDataService.updateRCA(selectedRCA.id, {
                              rootCause: analysis.rootCause
                            });
                            setSelectedRCA({ 
                              ...updated, 
                              logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 
                                ? flatListToTree(updated.logicTree as any[]) 
                                : [] 
                            });
                            toast({ title: 'Success', description: '5-Why Analysis saved and root cause updated in RCA' });
                          } catch (error) {
                            console.error('Failed to save 5-Why analysis:', error);
                            toast({ title: 'Error', description: 'Failed to save 5-Why analysis', variant: 'destructive' });
                          }
                        }}
                        existingAnalysis={currentFiveWhy}
                        config={analysisConfig}
                      />
                    </TabsContent>
                    )}
                    
                    {enabledTools.fishbone !== false && (
                    <TabsContent value="fishbone">
                      <FishboneDiagramTool
                        rcaId={selectedRCA.id}
                        initialEffect={selectedRCA.title}
                        onSave={async (diagram) => {
                          try {
                            const saved = await rcaAnalysisConfigService.saveFishboneDiagram(diagram, currentFishbone);
                            setCurrentFishbone(saved);
                            toast({ title: 'Success', description: 'Fishbone diagram saved' });
                          } catch (error) {
                            console.error('Failed to save fishbone diagram:', error);
                            toast({ title: 'Error', description: 'Failed to save fishbone diagram', variant: 'destructive' });
                          }
                        }}
                        existingDiagram={currentFishbone}
                        config={analysisConfig}
                      />
                    </TabsContent>
                    )}

                    {enabledTools.fmea !== false && (
                    <TabsContent value="fmea">
                      <FMEAAnalysisTool
                        rcaId={selectedRCA.id}
                        initialFailureMode={selectedRCA.title}
                        onSave={async (analysis) => {
                          try {
                            const saved = await rcaAnalysisConfigService.saveFMEAAnalysis(analysis, currentFmea);
                            setCurrentFmea(saved);
                            toast({ title: 'Success', description: 'FMEA analysis saved' });
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to save FMEA', variant: 'destructive' });
                          }
                        }}
                        existingAnalysis={currentFmea}
                        config={analysisConfig}
                      />
                    </TabsContent>
                    )}

                    {enabledTools.faultTree !== false && (
                    <TabsContent value="fault-tree">
                      <FaultTreeAnalysisTool
                        rcaId={selectedRCA.id}
                        initialTopEvent={selectedRCA.title}
                        onSave={async (analysis) => {
                          try {
                            const saved = await rcaAnalysisConfigService.saveFaultTreeAnalysis(analysis, currentFaultTree);
                            setCurrentFaultTree(saved);
                            toast({ title: 'Success', description: 'Fault tree saved' });
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to save fault tree', variant: 'destructive' });
                          }
                        }}
                        existingAnalysis={currentFaultTree}
                        config={analysisConfig}
                      />
                    </TabsContent>
                    )}

                    {enabledTools.barrierAnalysis !== false && (
                    <TabsContent value="barrier">
                      <BarrierAnalysisTool
                        rcaId={selectedRCA.id}
                        initialHazard={selectedRCA.description || selectedRCA.title}
                        onSave={async (analysis) => {
                          try {
                            const saved = await rcaAnalysisConfigService.saveBarrierAnalysis(analysis, currentBarrier);
                            setCurrentBarrier(saved);
                            toast({ title: 'Success', description: 'Barrier analysis saved' });
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to save barrier analysis', variant: 'destructive' });
                          }
                        }}
                        existingAnalysis={currentBarrier}
                        config={analysisConfig}
                      />
                    </TabsContent>
                    )}

                    {enabledTools.changeAnalysis !== false && (
                    <TabsContent value="change">
                      <ChangeAnalysisTool
                        rcaId={selectedRCA.id}
                        onSave={async (analysis) => {
                          try {
                            const saved = await rcaAnalysisConfigService.saveChangeAnalysis(analysis, currentChange);
                            setCurrentChange(saved);
                            toast({ title: 'Success', description: 'Change analysis saved' });
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to save change analysis', variant: 'destructive' });
                          }
                        }}
                        existingAnalysis={currentChange}
                        config={analysisConfig}
                      />
                    </TabsContent>
                    )}
                        </>
                      );
                    })()}
                  </Tabs>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="recommendations">
              {showReviewBanner && nextPhase === 'Approval' && activeTab === 'recommendations' && (
                <div className="w-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl shadow p-4 flex items-center justify-between mb-4">
                  <div className="text-green-800 font-semibold">Phase complete! Ready to advance to <b>{nextPhase}</b>.</div>
                  <Button className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white font-bold px-6 py-2" onClick={handleAdvancePhase}>
                    Review & Advance
                  </Button>
                </div>
              )}
              {/* --- COMMUNICATE TAB: Two-column layout with summary cards and tabbed content --- */}
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Summary Cards (25%) */}
                <div className="w-full md:w-1/6 flex flex-col gap-6">
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-blue-50 via-white to-pink-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500" /><CardTitle className="text-xs font-semibold">Total Recs</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold text-blue-700">{selectedRCA.recommendations?.length || 0}</CardContent>
                  </Card>
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-green-50 via-white to-blue-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><CardTitle className="text-xs font-semibold">Open</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold text-green-700">{selectedRCA.recommendations?.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled').length || 0}</CardContent>
                  </Card>
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-pink-50 via-white to-blue-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2"><CheckCircle className="w-5 h-5 text-pink-500" /><CardTitle className="text-xs font-semibold">Closed</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold text-pink-700">{selectedRCA.recommendations?.filter(r => r.status === 'Completed').length || 0}</CardContent>
                  </Card>
                  {/* <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-purple-50 via-white to-blue-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2"><Paperclip className="w-5 h-5 text-purple-500" /><CardTitle className="text-xs font-semibold">Pushed to CMMS</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold text-purple-700">{selectedRCA.recommendations.filter(r => r.pushedToCMMS).length}</CardContent>
                  </Card> */}
                </div>
                {/* Right: Tabbed Content (75%) */}
                <div className="w-full md:w-3/4 md:pl-6">
                  <Tabs defaultValue="recommendations" className="w-full">
                    <TabsList className="w-full flex justify-between mb-4 rounded-2xl shadow bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-100">
                      <TabsTrigger value="recommendations" className="flex-1">Recommendations</TabsTrigger>
                      <TabsTrigger value="comments" className="flex-1">Comments</TabsTrigger>
                      <TabsTrigger value="share" className="flex-1">Share/Export</TabsTrigger>
                    </TabsList>
                    <TabsContent value="recommendations">
                      <div className="space-y-6 mt-4 max-w-2xl">
                        {/* Progress Bar and Filters */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                          {/* Progress Bar */}
                          {selectedRCA.recommendations && selectedRCA.recommendations.length > 0 && (
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500">Progress:</span>
                                <span className="text-xs font-bold text-blue-600">{Math.round((selectedRCA.recommendations.filter(r => r.status === 'Completed').length / selectedRCA.recommendations.length) * 100)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${(selectedRCA.recommendations.filter(r => r.status === 'Completed').length / selectedRCA.recommendations.length) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                          {/* Search and Filters */}
                          <div className="flex flex-col sm:flex-row gap-2 items-center">
                            <Input 
                              placeholder="Search recommendations..." 
                              value={recommendationFilter} 
                              onChange={e => setRecommendationFilter(e.target.value)}
                              className="w-full sm:w-48"
                            />
                            <Select value={recommendationStatusFilter} onValueChange={setRecommendationStatusFilter}>
                              <SelectTrigger className="w-full sm:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="All">All Statuses</SelectItem>
                                <SelectItem value="Open">Open</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={recommendationPriorityFilter} onValueChange={setRecommendationPriorityFilter}>
                              <SelectTrigger className="w-full sm:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="All">All Priorities</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={recommendationAssigneeFilter} onValueChange={setRecommendationAssigneeFilter}>
                              <SelectTrigger className="w-full sm:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="All">All Assignees</SelectItem>
                                {allUsers.map(user => (
                                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold px-4 py-2 hover:from-blue-700 hover:to-pink-600"
                              onClick={() => setShowAddRecommendationModal(true)}
                            >
                              <Plus className="w-4 h-4" /> Add
                            </Button>
                            {session && selectedRCA && (
                              <RCACreateTaskButton
                                rca={selectedRCA}
                                session={session}
                                tenantId={plantSelection?.tenant?.id || session.tenant?.id || ''}
                                organizationId={
                                  plantSelection?.organization?.id ||
                                  session.organization?.id ||
                                  session.tenant?.organizationId ||
                                  ''
                                }
                                onCreated={refreshLinkedTasks}
                              />
                            )}
                            <RCATasksLink count={rcaLinkedTaskCount + linkedRecommendationTaskIds.size} />
                          </div>
                        </div>
                        {/* Grouped Recommendations by Status */}
                        {(() => {
                          // Get all unique statuses from recommendations
                          const allStatuses: string[] = Array.from(new Set((selectedRCA.recommendations || []).map(r => r.status as string)));
                          // Define standard order, but include any custom statuses
                          const statusOrder: string[] = ['Open', 'Planned', 'In Progress', 'Completed', 'Cancelled'];
                          const orderedStatuses = [...statusOrder.filter(s => allStatuses.includes(s)), ...allStatuses.filter(s => !statusOrder.includes(s))];
                          
                          return orderedStatuses.map(statusGroup => {
                            const group = (selectedRCA.recommendations || []).filter(rec => {
                              // Filtering logic
                              const matchesStatus = recommendationStatusFilter === 'All' ? true : rec.status === recommendationStatusFilter;
                              const matchesPriority = recommendationPriorityFilter === 'All' ? true : rec.priority === recommendationPriorityFilter;
                              const matchesAssignee = recommendationAssigneeFilter === 'All' ? true : rec.assigneeId === recommendationAssigneeFilter;
                              const matchesSearch = !recommendationFilter || rec.title.toLowerCase().includes(recommendationFilter.toLowerCase()) || (rec.description || '').toLowerCase().includes(recommendationFilter.toLowerCase());
                              return rec.status === statusGroup && matchesStatus && matchesPriority && matchesAssignee && matchesSearch;
                            });
                            if (group.length === 0) return null;
                            const statusColors = {
                              'Open': 'bg-yellow-100 text-yellow-700',
                              'Planned': 'bg-purple-100 text-purple-700',
                              'In Progress': 'bg-blue-100 text-blue-700',
                              'Completed': 'bg-green-100 text-green-700',
                              'Cancelled': 'bg-gray-200 text-gray-500',
                            };
                            const defaultColor = 'bg-orange-100 text-orange-700';
                          return (
                            <div key={statusGroup} className="mb-6">
                              <div className={`flex items-center gap-2 mb-2 text-base font-bold px-2 py-1 rounded-xl ${statusColors[statusGroup] || defaultColor}`}> 
                                {statusGroup === 'Open' && <AlertTriangle className="w-5 h-5" />}
                                {statusGroup === 'Planned' && <Calendar className="w-5 h-5" />}
                                {statusGroup === 'In Progress' && <Clock className="w-5 h-5" />} 
                                {statusGroup === 'Completed' && <CheckCircle className="w-5 h-5" />} 
                                {statusGroup === 'Cancelled' && <X className="w-5 h-5" />}
                                {!['Open', 'Planned', 'In Progress', 'Completed', 'Cancelled'].includes(statusGroup) && <Activity className="w-5 h-5" />}
                                {statusGroup}
                              </div>
                              <ul className="space-y-2">
                                {group.map(rec => (
                                  <li key={rec.id} className="border rounded-2xl p-4 flex items-center justify-between bg-gradient-to-br from-blue-50 via-white to-pink-50 shadow hover:shadow-xl transition">
                                    <div>
                                      <div className="font-semibold text-lg text-blue-900 flex items-center gap-2">{rec.title} <Badge className={`${statusColors[statusGroup] || defaultColor} ml-2`}>{statusGroup}</Badge></div>
                                      <div className="text-xs text-gray-500 font-semibold">Priority: <span className={getPriorityBadgeColor(rec.priority)}>{rec.priority}</span></div>
                                      <div className="text-xs text-gray-400">{rec.description}</div>
                                      <div className="text-xs text-blue-600">Assignee: {getUserName(rec.assigneeId)}</div>
                                      {rec.dueDate && <div className="text-xs text-gray-500">Due: {new Date(rec.dueDate).toLocaleDateString()}</div>}
                                      {rec.estimatedCost && <div className="text-xs text-green-600">Est. Cost: ${rec.estimatedCost}</div>}
                                    </div>
                                    <div className="flex gap-2 flex-wrap justify-end">
                                      {session && selectedRCA && (
                                        <RCACreateTaskButton
                                          rca={selectedRCA}
                                          recommendation={rec}
                                          session={session}
                                          tenantId={plantSelection?.tenant?.id || session.tenant?.id || ''}
                                          organizationId={
                                            plantSelection?.organization?.id ||
                                            session.organization?.id ||
                                            session.tenant?.organizationId ||
                                            ''
                                          }
                                          alreadyLinked={linkedRecommendationTaskIds.has(rec.id)}
                                          onCreated={refreshLinkedTasks}
                                        />
                                      )}
                                      <Button size="sm" variant="outline" onClick={() => handleEditRecommendation(rec)}><Pencil className="w-4 h-4" /> Edit</Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleDeleteRecommendation(rec)}><Trash2 className="w-4 h-4" /> Delete</Button>
                                      <Button size="sm" variant="outline" onClick={() => handlePushToCMMS(rec)}><Paperclip className="w-4 h-4" /> Push</Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        });
                        })()}
                        {/* If no recommendations match filters */}
                        {(() => {
                          const anyMatch = (selectedRCA.recommendations || []).some(rec => {
                            const matchesStatus = recommendationStatusFilter === 'All' ? true : rec.status === recommendationStatusFilter;
                            const matchesPriority = recommendationPriorityFilter === 'All' ? true : rec.priority === recommendationPriorityFilter;
                            const matchesAssignee = recommendationAssigneeFilter === 'All' ? true : rec.assigneeId === recommendationAssigneeFilter;
                            const matchesSearch = !recommendationFilter || rec.title.toLowerCase().includes(recommendationFilter.toLowerCase()) || (rec.description || '').toLowerCase().includes(recommendationFilter.toLowerCase());
                            return matchesStatus && matchesPriority && matchesAssignee && matchesSearch;
                          });
                          if (anyMatch) return null;
                          return <div className="text-center text-gray-400 italic py-8">No recommendations found for your filters.</div>;
                        })()}
                        {/* Add Recommendation Button */}
                        {/* <Button
                          size="sm"
                          className="rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold px-4 py-2 hover:from-blue-700 hover:to-pink-600 mb-4"
                          onClick={() => setShowAddRecommendationModal(true)}
                        >
                          <Plus className="w-4 h-4" /> Add Recommendation
                        </Button> */}
                      </div>
                    </TabsContent>
                    <TabsContent value="comments">
                      <div className="space-y-6 mt-4 max-w-2xl">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                          <h3 className="text-lg font-semibold">Discussion & Comments</h3>
                        </div>
                        {/* Comment List */}
                        <div className="space-y-4">
                          {rcaComments.length === 0 && <div className="text-gray-400 italic">No comments yet. Start the discussion!</div>}
                          {rcaComments.map(comment => (
                            <div key={comment.id} className="flex items-start gap-3 bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-2xl shadow p-4 border border-blue-100">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center font-bold text-blue-700 shadow text-lg">
                                {comment.user.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-blue-900">{comment.user}</span>
                                  <span className="text-xs text-gray-400">{new Date(comment.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="text-gray-700 text-sm mt-1">{comment.text}</div>
                              </div>
                              <button className="ml-2 text-xs text-red-500 hover:underline" onClick={() => handleDeleteComment(comment.id)}>Delete</button>
                            </div>
                          ))}
                        </div>
                        {/* Add Comment Form */}
                        <form className="flex gap-2 mt-4" onSubmit={e => { e.preventDefault(); handleAddComment(); }}>
                          <input
                            type="text"
                            className="flex-1 border rounded-full px-4 py-2 text-base shadow focus:ring-2 focus:ring-blue-200"
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            required
                          />
                          <Button type="submit" className="rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold px-6 py-2 hover:from-blue-700 hover:to-pink-600">Post</Button>
                        </form>
                      </div>
                    </TabsContent>
                    <TabsContent value="share">
                      <div className="space-y-6 mt-4 max-w-2xl">
                        <div className="flex items-center gap-2 mb-4">
                          <Paperclip className="w-5 h-5 text-purple-500" />
                          <h3 className="text-lg font-semibold">Share & Export Recommendations</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Export as CSV */}
                          <div className="bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-2xl shadow p-6 border border-blue-100 flex flex-col items-center">
                            <div className="flex items-center gap-2 mb-2"><FileText className="w-6 h-6 text-blue-500" /><span className="font-bold text-blue-700">Export as CSV</span></div>
                            <Button onClick={handleExportCSV} className="rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow font-bold px-6 py-2 hover:from-blue-700 hover:to-pink-600">Download CSV</Button>
                          </div>
                          {/* Export as JSON */}
                          <div className="bg-gradient-to-br from-pink-50 via-white to-blue-50 rounded-2xl shadow p-6 border border-pink-100 flex flex-col items-center">
                            <div className="flex items-center gap-2 mb-2"><FileText className="w-6 h-6 text-pink-500" /><span className="font-bold text-pink-700">Export as JSON</span></div>
                            <Button onClick={handleExportJSON} className="rounded-full bg-gradient-to-r from-pink-500 to-blue-600 text-white shadow font-bold px-6 py-2 hover:from-pink-600 hover:to-blue-700">Download JSON</Button>
                          </div>
                          {/* Share Link */}
                          <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 rounded-2xl shadow p-6 border border-purple-100 flex flex-col items-center col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-2"><Link className="w-6 h-6 text-purple-500" /><span className="font-bold text-purple-700">Share Link</span></div>
                            <div className="flex gap-2 w-full">
                              <input type="text" readOnly className="flex-1 border rounded-full px-4 py-2 text-base shadow bg-gray-50" value={shareLink} />
                              <Button onClick={handleCopyShareLink} className="rounded-full bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow font-bold px-6 py-2 hover:from-purple-600 hover:to-blue-700">Copy</Button>
                            </div>
                            {shareCopied && <div className="text-green-600 text-xs mt-2">Link copied!</div>}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="approval">
              {showReviewBanner && nextPhase === 'Closure' && activeTab === 'approval' && (
                <div className="w-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl shadow p-4 flex items-center justify-between mb-4">
                  <div className="text-green-800 font-semibold">Phase complete! Ready to advance to <b>{nextPhase}</b>.</div>
                  <Button className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white font-bold px-6 py-2" onClick={handleAdvancePhase}>
                    Review & Advance
                  </Button>
                </div>
              )}
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Summary Cards (25%) */}
                <div className="w-full md:w-1/6 flex flex-col gap-6">
                  {/* Add any additional summary cards you want to display in the approval tab */}
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-blue-50 via-white to-pink-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      <CardTitle className="text-xs font-semibold">Approval Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {isApproved && <span className="text-green-600">Approved</span>}
                        {isRejected && <span className="text-red-600">Rejected</span>}
                        {isPendingApproval && <span className="text-yellow-600">Pending</span>}
                      </div>
                      {selectedRCA?.approvedBy && (
                        <div className="text-xs text-gray-500 mt-2">By: {getUserName(selectedRCA.approvedBy)}</div>
                      )}
                      {selectedRCA?.approvedAt && (
                        <div className="text-xs text-gray-500">At: {new Date(selectedRCA.approvedAt).toLocaleString()}</div>
                      )}
                      {selectedRCA?.approvalComments && (
                        <div className="text-xs text-gray-500 mt-2">Comment: {selectedRCA.approvalComments}</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                {/* Right: Approval Actions (75%) */}
                <div className="w-full md:w-3/4 md:pl-6 flex flex-col gap-6">
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-green-50 via-white to-blue-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <CardTitle className="text-xs font-semibold">Approval Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canApprove ? (
                        <>
                          <Textarea
                            className="w-full mb-2"
                            placeholder="Add approval/rejection comment (optional)"
                            value={approvalComment}
                            onChange={e => setApprovalComment(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-4 mt-2">
                            <Button
                              size="sm"
                              className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white shadow font-bold px-6 py-2"
                              onClick={handleApproveRCA}
                              disabled={isApproved}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-full bg-gradient-to-r from-red-600 to-pink-500 text-white shadow font-bold px-6 py-2"
                              onClick={handleRejectRCA}
                              disabled={isRejected}
                              variant="destructive"
                            >
                              Reject
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-500 text-sm">Only managers or admins can approve or reject this RCA.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="closure">
              {showReviewBanner && nextPhase === 'Closure' && activeTab === 'closure' && (
                <div className="w-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl shadow p-4 flex items-center justify-between mb-4">
                  <div className="text-green-800 font-semibold">Phase complete! Ready to advance to <b>{nextPhase}</b>.</div>
                  <Button className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white font-bold px-6 py-2" onClick={handleAdvancePhase}>
                    Review & Advance
                  </Button>
                </div>
              )}
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Summary Cards (25%) */}
                <div className="w-full md:w-1/6 flex flex-col gap-6">
                  {/* Add any additional summary cards you want to display in the closure tab */}
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-blue-50 via-white to-pink-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      <CardTitle className="text-xs font-semibold">Closure Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {selectedRCA?.closureStatus === 'Closed'
                          ? <span className="text-green-600">Closed</span>
                          : <span className="text-yellow-600">In Closure</span>}
                      </div>
                      {selectedRCA?.closedBy && (
                        <div className="text-xs text-gray-500 mt-2">By: {getUserName(selectedRCA.closedBy)}</div>
                      )}
                      {selectedRCA?.closedAt && (
                        <div className="text-xs text-gray-500">At: {new Date(selectedRCA.closedAt).toLocaleString()}</div>
                      )}
                      {selectedRCA?.closureNotes && (
                        <div className="text-xs text-gray-500 mt-2">Notes: {selectedRCA.closureNotes}</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                {/* Right: Closure Actions (75%) */}
                <div className="w-full md:w-3/4 md:pl-6 flex flex-col gap-6">
                  <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-green-50 via-white to-blue-50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <CardTitle className="text-xs font-semibold">Closure Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 text-gray-700 text-sm">
                        <b>Approval Status:</b> {selectedRCA?.approvalStatus || 'Pending'}<br />
                        <b>Approved By:</b> {getUserName(selectedRCA?.approvedBy)}<br />
                        <b>Approved At:</b> {selectedRCA?.approvedAt ? new Date(selectedRCA.approvedAt).toLocaleString() : '-'}
                      </div>
                      <div className="mb-4 text-gray-700 text-sm">
                        <b>Recommendations:</b>
                        <ul className="list-disc ml-6">
                          {selectedRCA?.recommendations?.map(rec => (
                            <li key={rec.id}>{rec.title} - <span className="text-xs text-gray-500">{rec.status}</span></li>
                          ))}
                        </ul>
                      </div>
                      <Textarea
                        className="w-full mb-2"
                        placeholder="Add closure notes (optional)"
                        value={closureNotes}
                        onChange={e => setClosureNotes(e.target.value)}
                        rows={2}
                        disabled={isClosed}
                      />
                      <div className="flex gap-4 mt-2">
                        <Button
                          size="sm"
                          className="rounded-full bg-gradient-to-r from-green-600 to-blue-500 text-white shadow font-bold px-6 py-2"
                          onClick={handleCloseRCA}
                          disabled={!isClosureAllowed || isClosed}
                        >
                          Close RCA
                        </Button>
                        {!isClosureAllowed && (
                          <span className="text-red-500 text-xs mt-2">RCA must be approved before closure.</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            {/* Secondary/supporting tabs */}
            <TabsContent value="comments">
              <div className="space-y-6 mt-4 max-w-4xl">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">RCA Comments & Discussion</h3>
                </div>
                
                {/* Comment Type Filter */}
                <div className="flex items-center gap-4 mb-4">
                  <Label className="text-sm font-semibold">Filter by Type:</Label>
                  <Select value={commentType} onValueChange={(value: 'general' | 'investigation' | 'analysis' | 'recommendation' | 'implementation' | 'followup') => setCommentType(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="investigation">Investigation</SelectItem>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="recommendation">Recommendation</SelectItem>
                      <SelectItem value="implementation">Implementation</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Comment List */}
                <div className="space-y-4">
                  {publicComments.length === 0 && privateComments.length === 0 && (
                    <div className="text-center py-8 text-gray-400 italic">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No comments yet. Start the discussion!</p>
                    </div>
                  )}
                  
                  {/* Public Comments */}
                  {publicComments.map(comment => (
                    <div key={comment.id} className="flex items-start gap-3 bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-2xl shadow p-4 border border-blue-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center font-bold text-blue-700 shadow text-lg">
                        {comment.user.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-blue-900">{comment.user}</span>
                          <Badge className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">
                            {comment.type}
                          </Badge>
                          <Badge className="text-xs px-2 py-0.5 bg-green-100 text-green-700">
                            {comment.phase}
                          </Badge>
                          <span className="text-xs text-gray-400">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-gray-700 text-sm mb-2">{comment.text}</div>
                        {comment.mentions && comment.mentions.length > 0 && (
                          <div className="text-xs text-blue-600">
                            Mentions: {comment.mentions.map(m => `@${m}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newText = prompt('Edit comment:', comment.text);
                            if (newText && newText !== comment.text) {
                              handleEditComment(comment.id, newText);
                            }
                          }}
                          className="text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Private Comments (only show to author) */}
                  {privateComments.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Private Comments (Only visible to you)
                      </h4>
                      {privateComments.map(comment => (
                        <div key={comment.id} className="flex items-start gap-3 bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-2xl shadow p-4 border border-gray-200 mb-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center font-bold text-gray-700 shadow text-sm">
                            {comment.user.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">{comment.user}</span>
                              <Badge className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600">
                                {comment.type} (Private)
                              </Badge>
                              <span className="text-xs text-gray-400">{new Date(comment.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="text-gray-600 text-sm">{comment.text}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newText = prompt('Edit comment:', comment.text);
                                if (newText && newText !== comment.text) {
                                  handleEditComment(comment.id, newText);
                                }
                              }}
                              className="text-xs"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-xs"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Comment Form */}
                <div className="bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-2xl shadow p-6 border border-blue-100">
                  <h4 className="text-lg font-semibold text-blue-800 mb-4">Add New Comment</h4>
                  <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleAddComment(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-semibold">Comment Type</Label>
                        <Select value={commentType} onValueChange={(value: 'general' | 'investigation' | 'analysis' | 'recommendation' | 'implementation' | 'followup') => setCommentType(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="investigation">Investigation</SelectItem>
                            <SelectItem value="analysis">Analysis</SelectItem>
                            <SelectItem value="recommendation">Recommendation</SelectItem>
                            <SelectItem value="implementation">Implementation</SelectItem>
                            <SelectItem value="followup">Follow-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                        <input
                          type="checkbox"
                          id="privateComment"
                          checked={isPrivateComment}
                          onChange={e => setIsPrivateComment(e.target.checked)}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="privateComment" className="text-sm">Private comment (only visible to you)</Label>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Comment</Label>
                      <Textarea
                        className="mt-1 min-h-[100px]"
                        placeholder="Add your comment... Use @username to mention team members"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        required
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Tip: Use @username to mention team members. They will be notified.
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" className="bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white">
                        Post Comment
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="track">
              <div className="space-y-6 mt-4 max-w-4xl">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold">RCA Tracking & Analytics</h3>
                </div>

                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="text-sm text-blue-600 font-semibold">Days Active</div>
                          <div className="text-2xl font-bold text-blue-800">
                            {Math.ceil((new Date().getTime() - new Date(selectedRCA.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="text-sm text-green-600 font-semibold">Completion %</div>
                          <div className="text-2xl font-bold text-green-800">
                            {(() => {
                              const total = 6; // Total phases
                              const completed = STATUS_PHASES.indexOf(normalizeStatus(selectedRCA.status)) + 1;
                              return Math.round((completed / total) * 100);
                            })()}%
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        <div>
                          <div className="text-sm text-purple-600 font-semibold">Team Members</div>
                          <div className="text-2xl font-bold text-purple-800">
                            {new Set(selectedRCA.teamMemberIds).size}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-5 h-5 text-orange-600" />
                        <div>
                        <div className="text-sm text-orange-600 font-semibold">Evidence Items</div>
                        <div className="text-2xl font-bold text-orange-800">
                          {selectedRCA.evidence?.length || 0}
                        </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Phase Progress */}
                <Card className="bg-gradient-to-br from-blue-50 via-white to-pink-50 border-blue-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-500" />
                      Phase Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {STATUS_PHASES.map((phase, index) => {
                        const isCompleted = index < STATUS_PHASES.indexOf(normalizeStatus(selectedRCA.status));
                        const isCurrent = index === STATUS_PHASES.indexOf(normalizeStatus(selectedRCA.status));
                        const isUpcoming = index > STATUS_PHASES.indexOf(normalizeStatus(selectedRCA.status));
                        
                        return (
                          <div key={phase} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              isCompleted 
                                ? 'bg-green-500 text-white' 
                                : isCurrent 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-500'
                            }`}>
                              {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                            </div>
                            <div className="flex-1">
                              <div className={`font-semibold ${
                                isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-500'
                              }`}>
                                {phase}
                              </div>
                              <div className="text-xs text-gray-500">
                                {isCompleted && 'Completed'} 
                                {isCurrent && 'In Progress'} 
                                {isUpcoming && 'Upcoming'}
                              </div>
                            </div>
                            {isCurrent && (
                              <Badge className="bg-blue-100 text-blue-700">Current</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card className="bg-gradient-to-br from-green-50 via-white to-blue-50 border-green-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-green-500" />
                      Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* RCA Created */}
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 mt-2"></div>
                        <div>
                          <div className="font-semibold text-green-700">RCA Investigation Created</div>
                          <div className="text-sm text-gray-600">
                            {new Date(selectedRCA.createdAt).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            Investigation "{selectedRCA.title}" was initiated
                          </div>
                        </div>
                      </div>

                      {/* Last Updated */}
                      {selectedRCA.updatedAt !== selectedRCA.createdAt && (
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mt-2"></div>
                          <div>
                            <div className="font-semibold text-blue-700">Last Updated</div>
                            <div className="text-sm text-gray-600">
                              {new Date(selectedRCA.updatedAt).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              Investigation details were modified
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Comments Activity */}
                      {rcaComments.length > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-purple-500 mt-2"></div>
                          <div>
                            <div className="font-semibold text-purple-700">Discussion Activity</div>
                            <div className="text-sm text-gray-600">
                              {rcaComments.length} comment(s) added
                            </div>
                            <div className="text-sm text-gray-500">
                              Latest: {new Date(rcaComments[rcaComments.length - 1].timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Evidence Activity */}
                      {selectedRCA.evidence && selectedRCA.evidence.length > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-orange-500 mt-2"></div>
                          <div>
                            <div className="font-semibold text-orange-700">Evidence Collection</div>
                            <div className="text-sm text-gray-600">
                              {selectedRCA.evidence.length} evidence item(s) collected
                            </div>
                            <div className="text-sm text-gray-500">
                              Latest: {new Date(selectedRCA.evidence[selectedRCA.evidence.length - 1].createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recommendations Activity */}
                      {selectedRCA.recommendations && selectedRCA.recommendations.length > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-pink-500 mt-2"></div>
                          <div>
                            <div className="font-semibold text-pink-700">Recommendations</div>
                            <div className="text-sm text-gray-600">
                              {selectedRCA.recommendations.length} recommendation(s) created
                            </div>
                            <div className="text-sm text-gray-500">
                              {(selectedRCA.recommendations || []).filter(r => r.status === 'Completed').length} completed
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <Card className="bg-gradient-to-br from-pink-50 via-white to-blue-50 border-pink-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-pink-500" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm font-semibold text-gray-600 mb-2">Time to Completion</div>
                        <div className="text-2xl font-bold text-blue-800">
                          {selectedRCA.targetCloseDate ? (
                            (() => {
                              const targetDate = new Date(selectedRCA.targetCloseDate);
                              const now = new Date();
                              const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              return diffDays > 0 ? `${diffDays} days remaining` : `${Math.abs(diffDays)} days overdue`;
                            })()
                          ) : (
                            'No target date set'
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-600 mb-2">Team Engagement</div>
                        <div className="text-2xl font-bold text-green-800">
                          {Math.round((rcaComments.length / Math.max(new Set(selectedRCA.teamMemberIds).size, 1)) * 10) / 10} comments per member
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-600 mb-2">Evidence Quality</div>
                        <div className="text-2xl font-bold text-purple-800">
                          {selectedRCA.evidence && selectedRCA.evidence.length > 0 ? 
                            Math.round((selectedRCA.evidence.filter(e => e.verified).length / selectedRCA.evidence.length) * 100) 
                            : 0}% verified
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-600 mb-2">Recommendation Progress</div>
                        <div className="text-2xl font-bold text-orange-800">
                          {selectedRCA.recommendations && selectedRCA.recommendations.length > 0 ? 
                            Math.round((selectedRCA.recommendations.filter(r => r.status === 'Completed').length / selectedRCA.recommendations.length) * 100) 
                            : 0}% completed
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="export">
              <div className="space-y-6 mt-4 max-w-4xl">
                <div className="flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold">Export RCA Investigation</h3>
                </div>

                {/* Export Format Selection */}
                <Card className="bg-gradient-to-br from-purple-50 via-white to-blue-50 border-purple-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-500" />
                      Export Format
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <Select value={exportFormat} onValueChange={(value: 'pdf' | 'excel' | 'word' | 'csv') => setExportFormat(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF Report</SelectItem>
                          <SelectItem value="excel">Excel Workbook</SelectItem>
                          <SelectItem value="word">Word Document</SelectItem>
                          <SelectItem value="csv">CSV Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Export Options */}
                <Card className="bg-gradient-to-br from-blue-50 via-white to-pink-50 border-blue-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-500" />
                      Export Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeEvidence"
                          checked={exportOptions.includeEvidence}
                          onChange={e => setExportOptions(prev => ({ ...prev, includeEvidence: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="includeEvidence">Include Evidence</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeLogicTree"
                          checked={exportOptions.includeLogicTree}
                          onChange={e => setExportOptions(prev => ({ ...prev, includeLogicTree: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="includeLogicTree">Include Logic Tree</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeRecommendations"
                          checked={exportOptions.includeRecommendations}
                          onChange={e => setExportOptions(prev => ({ ...prev, includeRecommendations: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="includeRecommendations">Include Recommendations</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeComments"
                          checked={exportOptions.includeComments}
                          onChange={e => setExportOptions(prev => ({ ...prev, includeComments: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="includeComments">Include Comments</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeTimeline"
                          checked={exportOptions.includeTimeline}
                          onChange={e => setExportOptions(prev => ({ ...prev, includeTimeline: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="includeTimeline">Include Timeline</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeAttachments"
                          checked={exportOptions.includeAttachments}
                          onChange={e => setExportOptions(prev => ({ ...prev, includeAttachments: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <Label htmlFor="includeAttachments">Include Attachments</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Export Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="p-6 text-center">
                      <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <h4 className="font-semibold text-blue-800 mb-2">PDF Report</h4>
                      <p className="text-sm text-blue-600 mb-4">Professional RCA report with all sections</p>
                      <Button 
                        onClick={handleExportPDF}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Export PDF
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-6 text-center">
                      <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <h4 className="font-semibold text-green-800 mb-2">Excel Workbook</h4>
                      <p className="text-sm text-green-600 mb-4">Multi-sheet data export for analysis</p>
                      <Button 
                        onClick={handleExportExcel}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        Export Excel
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="p-6 text-center">
                      <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <h4 className="font-semibold text-purple-800 mb-2">CSV Data</h4>
                      <p className="text-sm text-purple-600 mb-4">Simple data export for recommendations</p>
                      <Button 
                        onClick={handleExportCSV}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Export CSV
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="p-6 text-center">
                      <Link className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                      <h4 className="font-semibold text-orange-800 mb-2">Share Link</h4>
                      <p className="text-sm text-orange-600 mb-4">Generate shareable link for collaboration</p>
                      <Button 
                        onClick={handleCopyShareLink}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        {shareCopied ? 'Copied!' : 'Copy Link'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Export Preview */}
                <Card className="bg-gradient-to-br from-gray-50 via-white to-gray-50 border-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-gray-500" />
                      Export Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="text-sm text-gray-600 space-y-2">
                        <div><strong>Format:</strong> {exportFormat.toUpperCase()}</div>
                        <div><strong>RCA Title:</strong> {selectedRCA.title}</div>
                        <div><strong>Status:</strong> {selectedRCA.status}</div>
                        <div><strong>Priority:</strong> {selectedRCA.priority}</div>
                        <div><strong>Team Lead:</strong> {getUserName(selectedRCA.teamLeadId)}</div>
                        <div><strong>Created:</strong> {new Date(selectedRCA.createdAt).toLocaleDateString()}</div>
                        <div><strong>Included Sections:</strong></div>
                        <ul className="list-disc list-inside ml-4 text-xs">
                          {exportOptions.includeEvidence && <li>Evidence ({selectedRCA.evidence?.length || 0} items)</li>}
                          {exportOptions.includeLogicTree && <li>Logic Tree ({selectedRCA.logicTree?.length || 0} nodes)</li>}
                          {exportOptions.includeRecommendations && <li>Recommendations ({selectedRCA.recommendations?.length || 0} items)</li>}
                          {exportOptions.includeComments && <li>Comments ({rcaComments.length} items)</li>}
                          {exportOptions.includeTimeline && <li>Activity Timeline</li>}
                          {exportOptions.includeAttachments && <li>Attachments</li>}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          {/* Edit RCA Modal */}
          {showEditRCAModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-blue-100 flex flex-col">
                <button className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-xl font-bold" onClick={() => setShowEditRCAModal(false)} aria-label="Close">&times;</button>
                <h2 className="text-xl font-bold text-blue-700 mb-4">Edit RCA</h2>
                <form onSubmit={async e => {
                  e.preventDefault();
                  try {
                    const updated = await masterDataService.updateRCA(selectedRCA.id, {
                      title: editRCAForm.title,
                      description: editRCAForm.description,
                      priority: editRCAForm.priority,
                      targetCloseDate: editRCAForm.targetCloseDate || undefined,
                    });
                    setSelectedRCA({ ...updated, logicTree: selectedRCA.logicTree });
                    setShowEditRCAModal(false);
                    toast({ title: 'Success', description: 'RCA updated.' });
                  } catch (err) {
                    toast({ title: 'Error', description: 'Failed to update RCA.', variant: 'destructive' });
                  }
                }} className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input value={editRCAForm.title} onChange={e => setEditRCAForm(f => ({ ...f, title: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={editRCAForm.description} onChange={e => setEditRCAForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <select className="w-full border rounded px-2 py-1" value={editRCAForm.priority} onChange={e => setEditRCAForm(f => ({ ...f, priority: e.target.value as any }))} required>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <Label>Target Close Date</Label>
                    <Input type="date" value={editRCAForm.targetCloseDate} onChange={e => setEditRCAForm(f => ({ ...f, targetCloseDate: e.target.value }))} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowEditRCAModal(false)} size="sm">Cancel</Button>
                    <Button type="submit" size="sm">Save</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Delete RCA Confirm Modal */}
          {showDeleteRCAConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs relative border border-red-100 flex flex-col items-center">
                <button className="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-xl font-bold" onClick={() => setShowDeleteRCAConfirm(false)} aria-label="Close">&times;</button>
                <h2 className="text-xl font-bold text-red-700 mb-4">Delete RCA?</h2>
                <p className="mb-4 text-center">Are you sure you want to delete this RCA investigation?</p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowDeleteRCAConfirm(false)} size="sm">Cancel</Button>
                  <Button type="button" variant="destructive" onClick={async () => {
                    try {
                      await masterDataService.deleteRCA(selectedRCA.id);
                      setShowDeleteRCAConfirm(false);
                      setSelectedRCA(null);
                      toast({ title: 'Deleted', description: 'RCA deleted.' });
                      loadData();
                    } catch (err) {
                      toast({ title: 'Error', description: 'Failed to delete RCA.', variant: 'destructive' });
                    }
                  }} size="sm">Delete</Button>
                </div>
              </div>
            </div>
          )}
          {/* Recommendation Edit Modal */}
          {showEditRecommendationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg relative border border-blue-100 flex flex-col">
                <button className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-xl font-bold" onClick={handleCancelEditRecommendation} aria-label="Close">&times;</button>
                <h2 className="text-xl font-bold text-blue-700 mb-4">Edit Recommendation</h2>
                <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSaveEditRecommendation(); }}>
                  <div>
                    <Label>Title</Label>
                    <Input value={editRecommendationForm?.title || ''} onChange={e => setEditRecommendationForm(f => ({ ...f, title: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={editRecommendationForm?.description || ''} onChange={e => setEditRecommendationForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <select className="w-full border rounded px-2 py-1" value={editRecommendationForm?.priority || 'Medium'} onChange={e => setEditRecommendationForm(f => ({ ...f, priority: e.target.value }))} required>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <Label>Assignee</Label>
                    <Select
                      value={editRecommendationForm?.assigneeId || ''}
                      onValueChange={value => setEditRecommendationForm(f => ({ ...f, assigneeId: value }))}
                    >
                      <SelectTrigger className="w-48 border rounded px-2 py-1 bg-white">
                        <SelectValue placeholder="Select Assignee" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {allUsers.length === 0 && (
                          <SelectItem value="" disabled>No users found</SelectItem>
                        )}
                        {allUsers.map(user => (
                          <SelectItem key={user.id} value={user.id} className="flex flex-col items-start">
                            <span className="font-semibold">{user.name}</span>
                            <span className="text-xs text-gray-500">{user.role || 'User'}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={editRecommendationForm?.dueDate || ''} onChange={e => setEditRecommendationForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Estimated Cost</Label>
                    <Input value={editRecommendationForm?.estimatedCost || ''} onChange={e => setEditRecommendationForm(f => ({ ...f, estimatedCost: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={editRecommendationForm?.status || 'Open'}
                      onChange={e => setEditRecommendationForm(f => ({ ...f, status: e.target.value }))}
                      required
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={handleCancelEditRecommendation} size="sm">Cancel</Button>
                    <Button type="submit" size="sm">Save</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-blue-100 flex flex-col">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-xl font-bold" onClick={() => { setShowCategoryModal(false); setEditingCategory(null); setCategoryInput(''); }} aria-label="Close">&times;</button>
            <h2 className="text-xl font-bold text-blue-700 mb-4">Manage Categories</h2>
            <div className="space-y-2">
              {evidenceCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2">
                  <span className="flex-1">{cat.name}</span>
                  <Button size="sm" variant="outline" onClick={() => handleEditCategory(cat)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(cat)}>Delete</Button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={categoryInput} onChange={e => setCategoryInput(e.target.value)} placeholder="New or updated category..." />
              <Button size="sm" onClick={handleAddCategory}>{editingCategory ? 'Update' : 'Add'}</Button>
            </div>
          </div>
        </div>
      )}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-green-100 flex flex-col">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-green-600 text-xl font-bold" onClick={() => { setShowLocationModal(false); setEditingLocation(null); setLocationInput(''); }} aria-label="Close">&times;</button>
            <h2 className="text-xl font-bold text-green-700 mb-4">Manage Locations</h2>
            <div className="space-y-2">
              {evidenceLocations.map(loc => (
                <div key={loc.id} className="flex items-center gap-2">
                  <span className="flex-1">{loc.name}</span>
                  <Button size="sm" variant="outline" onClick={() => handleEditLocation(loc)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteLocation(loc)}>Delete</Button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="New or updated location..." />
              <Button size="sm" onClick={handleAddLocation}>{editingLocation ? 'Update' : 'Add'}</Button>
            </div>
          </div>
        </div>
      )}
      {showEvidenceModal && currentEvidence && evidenceModalMode === 'view' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-100/80 via-white/90 to-pink-100/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-0 w-full max-w-2xl relative border border-blue-200 flex flex-col mx-auto my-12 max-h-[95vh] overflow-y-auto transition-all duration-300">
            <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-blue-100 rounded-t-3xl bg-gradient-to-r from-blue-50 to-pink-50">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${{
                  Parts: 'bg-blue-100 text-blue-700',
                  Paper: 'bg-yellow-100 text-yellow-700',
                  People: 'bg-green-100 text-green-700',
                  Place: 'bg-purple-100 text-purple-700',
                  Process: 'bg-pink-100 text-pink-700',
                }[currentEvidence.fiveP] || 'bg-gray-100 text-gray-700'} text-2xl shadow`}>
                  <FileText className="w-6 h-6" />
                </span>
                <h2 className="text-2xl font-extrabold text-blue-800 tracking-tight">Evidence Details</h2>
              </div>
              <button className="text-gray-400 hover:text-blue-600 text-3xl font-bold transition" onClick={() => setShowEvidenceModal(false)} aria-label="Close">&times;</button>
            </div>
            <div className="px-8 py-6 space-y-8">
              {/* Section: Evidence Details */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-blue-700 text-lg">Evidence Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Title</div>
                    <div className="text-base font-bold text-blue-900 mb-2">{currentEvidence.title}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Type</div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-semibold"><FileText className="w-4 h-4" /> {currentEvidence.type}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-500 font-semibold mb-1">Description</div>
                    <div className="text-sm mb-2 text-gray-700">{currentEvidence.description || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                </div>
              </div>
              {/* Section: Categorization & Task */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-5 h-5 text-pink-500" />
                  <span className="font-semibold text-pink-700 text-lg">Categorization & Task</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">5P Category</div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold align-middle ${{
                      Parts: 'bg-blue-100 text-blue-700',
                      Paper: 'bg-yellow-100 text-yellow-700',
                      People: 'bg-green-100 text-green-700',
                      Place: 'bg-purple-100 text-purple-700',
                      Process: 'bg-pink-100 text-pink-700',
                    }[currentEvidence.fiveP] || 'bg-gray-100 text-gray-700'}`}>{currentEvidence.fiveP || '-'}</span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Task</div>
                    <div className="text-sm mb-2">{currentEvidence.task || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Due Date</div>
                    <div className={`text-sm mb-2 ${currentEvidence.dueDate && currentEvidence.status !== 'completed' && new Date(currentEvidence.dueDate) < new Date() ? 'text-red-600 font-bold' : ''}`}>{currentEvidence.dueDate ? new Date(currentEvidence.dueDate).toLocaleDateString() : <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                </div>
              </div>
              {/* Section: Status & Meta */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-green-700 text-lg">Status & Meta</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Status</div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold align-middle ${currentEvidence.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{currentEvidence.status === 'completed' ? 'Completed' : 'Pending'}</span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Severity</div>
                    <div className="text-sm mb-2">{currentEvidence.severity || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Verified</div>
                    <div className="text-sm mb-2">{currentEvidence.verified ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              </div>
              {/* Section: Classification */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-purple-500" />
                  <span className="font-semibold text-purple-700 text-lg">Classification</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Category</div>
                    <div className="text-sm mb-2">{currentEvidence.category || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Location</div>
                    <div className="text-sm mb-2">{currentEvidence.location || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                </div>
              </div>
              {/* Section: Tags & Asset/Unit */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-blue-700 text-lg">Tags & Asset/Unit</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Tags</div>
                    <div className="text-sm mb-2">{(currentEvidence.tags || []).join(', ') || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Related Asset/Unit</div>
                    <div className="text-sm mb-2">{getAssetOrUnitName(currentEvidence.relatedAssetId) || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                </div>
              </div>
              {/* Section: Attachments & Timestamp */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                  <span className="font-semibold text-gray-700 text-lg">Attachments & Timestamp</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Attachments</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(currentEvidence.attachments) && currentEvidence.attachments.length > 0 && !(currentEvidence.attachments[0] instanceof File) ? currentEvidence.attachments.filter(isRCAAttachment).map((att, idx) => {
                        if (!isRCAAttachment(att)) return null;
                        const name = att.name;
                        const dataUrl = att.dataUrl;
                        const type = att.type;
                        return (
                          <a
                            key={idx}
                            href={dataUrl}
                            download={name}
                            className="inline-flex flex-col items-center gap-1 px-1 py-1 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:bg-blue-50 transition text-xs w-14 h-14 justify-center overflow-hidden group relative"
                            title={name}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {type === 'image/png' || type === 'image/jpeg' ? (
                              <img
                                src={dataUrl}
                                alt={name}
                                className="object-cover w-10 h-10 rounded-md border border-gray-100 group-hover:scale-110 transition-transform"
                              />
                            ) : type === 'video/mp4' ? (
                              <Video className="w-8 h-8 text-blue-600" />
                            ) : type === 'application/pdf' ? (
                              <FileText className="w-8 h-8 text-red-600" />
                            ) : (
                              <Paperclip className="w-8 h-8 text-gray-400" />
                            )}
                            <span className="text-[10px] text-gray-500 truncate w-12 text-center mt-1">{name}</span>
                          </a>
                        );
                      }) : null)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">Timestamp</div>
                    <div className="text-sm mb-2">{currentEvidence.timestamp || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                </div>
              </div>
              {/* Section: Time Series Data (if type is Time Series) */}
              {currentEvidence.type === 'Time Series' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-5 h-5 text-green-500" />
                    <span className="font-semibold text-green-700 text-lg">Time Series Data</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1">Provider</div>
                      <div className="text-sm mb-2">{currentEvidence.tsProvider || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1">Mode</div>
                      <div className="text-sm mb-2">{currentEvidence.tsMode || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1">Start Time</div>
                      <div className="text-sm mb-2">{currentEvidence.tsStart || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1">End Time</div>
                      <div className="text-sm mb-2">{currentEvidence.tsEnd || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1">Interval</div>
                      <div className="text-sm mb-2">{currentEvidence.tsInterval || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1">Summary Types</div>
                      <div className="text-sm mb-2">{currentEvidence.tsSummaryTypes || '-'}</div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Query Parameters</span>
                      <Button 
                        size="sm" 
                        onClick={() => handleExecuteTimeSeriesQuery(currentEvidence)}
                        disabled={timeSeriesLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {timeSeriesLoading ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Executing...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Execute Query
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div><strong>Streams:</strong> {currentEvidence.tsStreams?.length || 0} stream(s)</div>
                      <div><strong>Time Range:</strong> {currentEvidence.tsStart && currentEvidence.tsEnd ? `${new Date(currentEvidence.tsStart).toLocaleString()} - ${new Date(currentEvidence.tsEnd).toLocaleString()}` : 'Not specified'}</div>
                      <div><strong>Query Mode:</strong> {currentEvidence.tsMode || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-100 mt-8">
                <button className="rounded-full px-6 py-2 text-base border border-gray-300 bg-white hover:bg-gray-50 transition" onClick={() => setShowEvidenceModal(false)}>Close</button>
                <button className="rounded-full px-6 py-2 text-base bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white shadow-lg" onClick={() => { setEditEvidenceForm({ ...currentEvidence, tags: (currentEvidence.tags || []).join(', ') }); setEvidenceModalMode('edit'); }}>Edit</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Time Series Results Modal */}
      {showTimeSeriesResults && timeSeriesResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-100/80 via-white/90 to-pink-100/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-0 w-full max-w-6xl relative border border-blue-200 flex flex-col mx-auto my-12 max-h-[95vh] overflow-y-auto transition-all duration-300">
            <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-blue-100 rounded-t-3xl bg-gradient-to-r from-blue-50 to-pink-50">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700 text-2xl shadow"><BarChart3 className="w-6 h-6" /></span>
                <h2 className="text-2xl font-extrabold text-blue-800 tracking-tight">Time Series Results</h2>
              </div>
              <button className="text-gray-400 hover:text-blue-600 text-3xl font-bold transition" onClick={() => setShowTimeSeriesResults(false)} aria-label="Close">&times;</button>
            </div>
            <div className="px-8 py-6 space-y-8">
              {/* Time Series Chart */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-blue-700 text-lg">Chart Visualization</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <TimeSeriesChart results={timeSeriesResults?.streams || []} />
                </div>
              </div>
              
              {/* Time Series Table */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-blue-700 text-lg">Data Table</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <TimeSeriesTable results={timeSeriesResults?.streams || []} />
                </div>
              </div>
              
              {/* Export Options */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-blue-700 text-lg">Export Data</span>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportTimeSeriesCSV(timeSeriesResults)}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportTimeSeriesJSON(timeSeriesResults)}
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-100 mt-8">
                <Button variant="outline" onClick={() => setShowTimeSeriesResults(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEvidenceModal && (evidenceModalMode === 'add' || evidenceModalMode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-100/80 via-white/90 to-pink-100/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-0 w-full max-w-2xl relative border border-blue-200 flex flex-col mx-auto my-12 max-h-[95vh] overflow-y-auto transition-all duration-300">
            <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-blue-100 rounded-t-3xl bg-gradient-to-r from-blue-50 to-pink-50">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 text-2xl shadow"><Plus className="w-6 h-6" /></span>
                <h2 className="text-2xl font-extrabold text-blue-800 tracking-tight">{evidenceModalMode === 'add' ? 'Add Evidence' : 'Edit Evidence'}</h2>
              </div>
              <button className="text-gray-400 hover:text-blue-600 text-3xl font-bold transition" onClick={() => setShowEvidenceModal(false)} aria-label="Close">&times;</button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (evidenceModalMode === 'add') {
                await handleAddEvidenceSubmit();
              } else {
                await handleSaveEvidenceEdit();
              }
            }} className="px-8 py-6 space-y-8">
              {/* Section: Evidence Details */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-blue-700 text-lg">Evidence Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Title</Label>
                    <Input className="mt-1 focus:ring-2 focus:ring-blue-200" value={editEvidenceForm?.title || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, title: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-blue-200" value={editEvidenceForm?.type || 'Note'} onChange={e => setEditEvidenceForm(f => ({ ...f, type: e.target.value }))} required>
                      <option value="Photo">Photo</option>
                      <option value="Document">Document</option>
                      <option value="Video">Video</option>
                      <option value="Note">Note</option>
                      <option value="Time Series">Time Series</option>
                    </select>
                  </div>
                   <div className="md:col-span-2">
                    <Label>Description</Label>
                    <Textarea className="mt-1 focus:ring-2 focus:ring-blue-200" value={editEvidenceForm?.description || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              </div>
               {editEvidenceForm?.type === 'Time Series' && (
                 <div>
                   <div className="flex items-center gap-2 mb-2">
                     <FileText className="w-5 h-5 text-blue-500" />
                     <span className="font-semibold text-blue-700 text-lg">Time Series (Historian)</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                       <Label>Provider</Label>
                       <select className="w-full border rounded px-2 py-2 mt-1" value={editEvidenceForm?.tsProvider || 'pi'} onChange={e => setEditEvidenceForm(f => ({ ...f, tsProvider: e.target.value }))}>
                         <option value="pi">PI</option>
                       </select>
                     </div>
                     <div>
                       <Label>Mode</Label>
                       <select className="w-full border rounded px-2 py-2 mt-1" value={editEvidenceForm?.tsMode || 'interpolated'} onChange={e => setEditEvidenceForm(f => ({ ...f, tsMode: e.target.value }))}>
                         <option value="recorded">Recorded</option>
                         <option value="interpolated">Interpolated</option>
                         <option value="summary">Summary</option>
                         <option value="plot">Plot</option>
                       </select>
                     </div>
                     <div>
                       <Label>Interval</Label>
                       <Input className="mt-1" placeholder="e.g., 1m" value={editEvidenceForm?.tsInterval || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, tsInterval: e.target.value }))} />
                     </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                     <div>
                       <Label>Number of Intervals</Label>
                       <Input className="mt-1" type="number" placeholder="100" value={editEvidenceForm?.tsIntervals || 100} onChange={e => setEditEvidenceForm(f => ({ ...f, tsIntervals: parseInt(e.target.value) || 100 }))} />
                     </div>
                     <div>
                       <Label>Summary Types</Label>
                       <Input className="mt-1" placeholder="e.g., min,max,avg" value={editEvidenceForm?.tsSummaryTypes || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, tsSummaryTypes: e.target.value }))} />
                     </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                     <div>
                       <Label>Start (UTC ISO)</Label>
                       <div className="flex gap-2">
                         <Input className="mt-1 flex-1" value={editEvidenceForm?.tsStart || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, tsStart: e.target.value }))} />
                         <Button 
                           type="button" 
                           variant="outline" 
                           size="sm" 
                           onClick={() => setEditEvidenceForm(f => ({ ...f, tsStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }))}
                           className="mt-1"
                         >
                           24h ago
                         </Button>
                       </div>
                     </div>
                     <div>
                       <Label>End (UTC ISO)</Label>
                       <div className="flex gap-2">
                         <Input className="mt-1 flex-1" value={editEvidenceForm?.tsEnd || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, tsEnd: e.target.value }))} />
                         <Button 
                           type="button" 
                           variant="outline" 
                           size="sm" 
                           onClick={() => setEditEvidenceForm(f => ({ ...f, tsEnd: new Date().toISOString() }))}
                           className="mt-1"
                         >
                           Now
                         </Button>
                       </div>
                     </div>
                   </div>
                   <div className="mt-3">
                     <Label>Streams (from Historian tab)</Label>
                     <Input className="mt-1" placeholder="Optional note about streams" value={(editEvidenceForm?.tsStreamsNote)||''} onChange={e => setEditEvidenceForm(f => ({ ...f, tsStreamsNote: e.target.value }))} />
                     <div className="text-xs text-gray-500 mt-1">
                       <strong>Note:</strong> For now, manually specify stream information in the description or note field. 
                       You can get stream details from the Historian tab in the PI Integration page. 
                       Future versions will include a direct stream picker.
                     </div>
                   </div>
                 </div>
               )}
              {/* Section: Categorization & Task */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-5 h-5 text-pink-500" />
                  <span className="font-semibold text-pink-700 text-lg">Categorization & Task</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label>5P Category</Label>
                    <span className={`inline-block ml-2 px-2 py-0.5 rounded-full text-xs font-bold align-middle ${{
                      Parts: 'bg-blue-100 text-blue-700',
                      Paper: 'bg-yellow-100 text-yellow-700',
                      People: 'bg-green-100 text-green-700',
                      Place: 'bg-purple-100 text-purple-700',
                      Process: 'bg-pink-100 text-pink-700',
                    }[editEvidenceForm?.fiveP] || 'bg-gray-100 text-gray-700'}`}>{editEvidenceForm?.fiveP || '-'}</span>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-pink-200" value={editEvidenceForm?.fiveP || 'Parts'} onChange={e => setEditEvidenceForm(f => ({ ...f, fiveP: e.target.value }))} required>
                      <option value="Parts">Parts</option>
                      <option value="Paper">Paper</option>
                      <option value="People">People</option>
                      <option value="Place">Place</option>
                      <option value="Process">Process</option>
                    </select>
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" className="mt-1 focus:ring-2 focus:ring-pink-200" value={editEvidenceForm?.dueDate || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-2">
                  <Label>Task</Label>
                  <Textarea className="mt-1 focus:ring-2 focus:ring-pink-200 min-h-[96px]" value={editEvidenceForm?.task || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, task: e.target.value }))} />
                </div>
              </div>
              {/* Section: Status & Meta */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-green-700 text-lg">Status & Meta</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label>Status</Label>
                    <span className={`inline-block ml-2 px-2 py-0.5 rounded-full text-xs font-bold align-middle ${editEvidenceForm?.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{editEvidenceForm?.status === 'completed' ? 'Completed' : 'Pending'}</span>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-green-200" value={editEvidenceForm?.status || 'pending'} onChange={e => setEditEvidenceForm(f => ({ ...f, status: e.target.value }))} required>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-green-200" value={editEvidenceForm?.severity || 'Medium'} onChange={e => setEditEvidenceForm(f => ({ ...f, severity: e.target.value }))}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" className="accent-green-600 w-5 h-5" checked={!!editEvidenceForm?.verified} onChange={e => setEditEvidenceForm(f => ({ ...f, verified: e.target.checked }))} />
                    <Label className="ml-2">Verified</Label>
                  </div>
                </div>
              </div>
              {/* Section: Classification */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-purple-500" />
                  <span className="font-semibold text-purple-700 text-lg">Classification</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Category</Label>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-purple-200" value={editEvidenceForm?.category || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Select...</option>
                      {evidenceCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-purple-200" value={editEvidenceForm?.location || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, location: e.target.value }))}>
                      <option value="">Select...</option>
                      {evidenceLocations.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {/* Section: Tags & Asset/Unit */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-blue-700 text-lg">Tags & Asset/Unit</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Tags (comma separated)</Label>
                    <Input className="mt-1 focus:ring-2 focus:ring-blue-200" value={editEvidenceForm?.tags || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, tags: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Related Asset/Unit</Label>
                    <select className="w-full border rounded px-2 py-2 mt-1 focus:ring-2 focus:ring-blue-200" value={editEvidenceForm?.relatedAssetId || ''} onChange={e => setEditEvidenceForm(f => ({ ...f, relatedAssetId: e.target.value }))}>
                      <option value="">Select...</option>
                      {assets.map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.name}</option>
                      ))}
                      {units.map(unit => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {/* Section: Attachments */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                  <span className="font-semibold text-gray-700 text-lg">Attachments</span>
                </div>
                <input type="file" multiple className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition" onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  const attachments = (await Promise.all(files.map(fileToAttachmentObj))) as RCAAttachment[];
                  setEditEvidenceForm(f => ({ ...f, attachments }));
                }} />
                {/* Thumbnails Preview Grid */}
                <div className="flex flex-wrap gap-3 mt-4">
                  {(Array.isArray(editEvidenceForm?.attachments) && editEvidenceForm.attachments.length > 0 && !(editEvidenceForm.attachments[0] instanceof File) ? editEvidenceForm.attachments.filter(isRCAAttachment).map((att, idx) => {
                    if (!isRCAAttachment(att)) return null;
                    const name = att.name;
                    const dataUrl = att.dataUrl;
                    const type = att.type;
                    return (
                      <div key={idx} className="relative group w-20 h-20 rounded-xl shadow-md bg-gradient-to-br from-blue-50 to-pink-50 flex items-center justify-center overflow-hidden border border-gray-200 hover:shadow-xl transition-all">
                        {type === 'image/png' || type === 'image/jpeg' ? (
                          <img
                            src={dataUrl}
                            alt={name}
                            className="object-cover w-full h-full rounded-xl border border-white shadow-sm group-hover:scale-105 transition-transform"
                          />
                        ) : type === 'video/mp4' ? (
                          <video src={dataUrl} className="object-cover w-full h-full rounded-xl border border-white shadow-sm group-hover:scale-105 transition-transform" />
                        ) : type === 'application/pdf' ? (
                          <div className="flex flex-col items-center justify-center w-full h-full text-red-600">
                            <FileText className="w-8 h-8 mb-1" />
                            <span className="text-xs font-semibold text-center truncate w-16">{name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center w-full h-full text-gray-600">
                            <Paperclip className="w-8 h-8 mb-1" />
                            <span className="text-xs font-semibold text-center truncate w-16">{name}</span>
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          type="button"
                          className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 shadow hover:bg-red-500 hover:text-white text-gray-400 transition z-10"
                          title="Remove"
                          onClick={() => setEditEvidenceForm(f => ({ ...f, attachments: f.attachments.filter((_: any, i: number) => i !== idx) }))}
                        >
                          &times;
                        </button>
                      </div>
                    );
                  }) : null)}
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-100 mt-8">
                <Button type="button" variant="outline" className="rounded-full px-6 py-2 text-base" onClick={() => setShowEvidenceModal(false)} size="sm">Cancel</Button>
                <Button type="submit" className="rounded-full px-6 py-2 text-base bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white shadow-lg" size="sm">{evidenceModalMode === 'add' ? 'Add Evidence' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Create RCA Modal */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className={`bg-white rounded-xl shadow-2xl p-6 w-full ${similarRCAs.length > 0 ? 'max-w-6xl' : 'max-w-lg'} relative border border-blue-100 transition-all duration-300 max-h-[90vh] overflow-y-auto`}>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 text-2xl font-bold hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors" onClick={handleCloseCreateDialog} aria-label="Close">&times;</button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Start New RCA Investigation</h2>
                <p className="text-sm text-gray-500">Investigate and analyze root causes</p>
              </div>
            </div>
            <div className={`grid gap-6 ${similarRCAs.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Left Column - RCA Form */}
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); createRCA(); }}>
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border border-blue-100">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Investigation Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Title *</Label>
                      <Input 
                        value={rcaForm.title} 
                        onChange={e => setRcaForm(f => ({ ...f, title: e.target.value }))} 
                        required 
                        className="mt-1"
                        placeholder="Brief description of the issue"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <Textarea 
                        value={rcaForm.description} 
                        onChange={e => setRcaForm(f => ({ ...f, description: e.target.value }))} 
                        className="mt-1"
                        placeholder="Detailed description of the problem"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Priority *</Label>
                    <select className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-200" value={rcaForm.priority} onChange={e => setRcaForm(f => ({ ...f, priority: e.target.value as any }))} required>
                      <option value="Low">🟢 Low</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="High">🟠 High</option>
                      <option value="Critical">🔴 Critical</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Target Close Date</Label>
                    <Input type="date" value={rcaForm.targetCloseDate} onChange={e => setRcaForm(f => ({ ...f, targetCloseDate: e.target.value }))} className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Template *</Label>
                  <select className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-200" value={rcaForm.templateId} onChange={e => setRcaForm(f => ({ ...f, templateId: e.target.value }))} required>
                    <option value="">Select a template...</option>
                    {rcaTemplates.length === 0 && (
                      <option disabled>No templates available for this tenant</option>
                    )}
                    {rcaTemplates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                    ))}
                  </select>
                  {rcaTemplates.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">No templates found. Please contact your administrator to create RCA templates.</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">
                    Event {isFromStartRCA ? '(required)' : '(optional)'}
                  </Label>
                  {!isFromStartRCA && events.length > 5 && (
                    <Input 
                      type="text"
                      placeholder="🔍 Search events..."
                      value={eventSearchFilter}
                      onChange={e => setEventSearchFilter(e.target.value)}
                      className="mt-1 mb-2"
                    />
                  )}
                  <select 
                    className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-200 max-h-48 overflow-y-auto" 
                    value={rcaForm.eventId} 
                    onChange={e => setRcaForm(f => ({ ...f, eventId: e.target.value }))}
                    required={isFromStartRCA}
                    disabled={isFromStartRCA}
                    size={events.length > 5 ? 5 : undefined}
                  >
                    <option value="">{isFromStartRCA ? 'Select event...' : 'No event linked'}</option>
                    {events.length > 0 ? (
                      events
                        .filter(ev => 
                          eventSearchFilter === '' || 
                          ev.eventId?.toLowerCase().includes(eventSearchFilter.toLowerCase()) ||
                          ev.description?.toLowerCase().includes(eventSearchFilter.toLowerCase()) ||
                          ev.eventType?.toLowerCase().includes(eventSearchFilter.toLowerCase())
                        )
                        .map(ev => (
                          <option key={ev.id} value={ev.id}>
                            {ev.eventType ? `[${ev.eventType}] ` : ''}{ev.eventId} - {ev.description?.substring(0, 60)}{ev.description?.length > 60 ? '...' : ''}
                          </option>
                        ))
                    ) : (
                      <option value={rcaForm.eventId} disabled>
                        {rcaForm.eventId ? `Event ID: ${rcaForm.eventId}` : 'Loading events...'}
                      </option>
                    )}
                  </select>
                  {isFromStartRCA && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      This RCA is linked to the event you selected
                    </p>
                  )}
                  {eventSearchFilter && events.filter(ev => 
                    ev.eventId?.toLowerCase().includes(eventSearchFilter.toLowerCase()) ||
                    ev.description?.toLowerCase().includes(eventSearchFilter.toLowerCase()) ||
                    ev.eventType?.toLowerCase().includes(eventSearchFilter.toLowerCase())
                  ).length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No events match your search</p>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <Button type="button" variant="outline" onClick={handleCloseCreateDialog} size="sm">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Plus className="w-4 h-4 mr-1" />
                    Create Investigation
                  </Button>
                </div>
              </form>

              {/* Right Column - Similar RCAs */}
              {similarRCAs.length > 0 && showSimilarRCAs && (
                <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg border border-green-200 max-h-[70vh] overflow-y-auto">
                  <SimilarRCAs
                    matches={similarRCAs}
                    onApplyRecommendation={(recommendation) => {
                      console.log('📋 Recommendation will be available after RCA is created:', recommendation);
                      toast({ 
                        title: 'Note', 
                        description: 'Create the RCA first, then add recommendations from the detail view',
                      });
                    }}
                    onApplyEvidence={(evidenceType) => {
                      toast({ 
                        title: 'Suggestion', 
                        description: `Consider adding ${evidenceType} evidence after creating this RCA`,
                      });
                    }}
                    onMarkHelpful={(knowledgeId) => {
                      // Handled in component
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Dialog open={showManualEventModal} onOpenChange={setShowManualEventModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{manualEventMode === 'add' ? 'Add Manual Event' : 'Edit Manual Event'}</DialogTitle>
            <DialogDescription>Fill in the event details below.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={async e => {
            e.preventDefault();
            if (!manualEventForm.label.trim()) { setManualEventError('Label is required.'); return; }
            if (!manualEventForm.type) { setManualEventError('Type is required.'); return; }
            if (!manualEventForm.timestamp) { setManualEventError('Timestamp is required.'); return; }
            if (!manualEventForm.asset) { setManualEventError('Asset/Unit is required.'); return; }
            setManualEventError(null);
            let nodes = selectedRCA?.eventDiagram?.nodes || [];
            if (manualEventMode === 'add') {
              const newNode = {
                id: (Math.random() * 1e8).toFixed(0),
                data: { ...manualEventForm },
                position: { x: 100, y: 100 },
              };
              nodes = [...nodes, newNode];
            } else if (manualEventMode === 'edit') {
              nodes = nodes.map((n: any) =>
                n.id === manualEventForm.id
                  ? { ...n, data: { ...manualEventForm }, position: n.position || { x: 100, y: 100 } }
                  : n
              );
            }
            const updated = await masterDataService.updateRCA(selectedRCA.id, { eventDiagram: { ...selectedRCA?.eventDiagram, nodes: ensureNodePositions(nodes) } });
            setSelectedRCA({ ...updated, logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 ? flatListToTree(updated.logicTree as any[]) : [] });
            setShowManualEventModal(false);
          }}>
            {manualEventError && <div className="text-red-600 text-xs font-semibold mb-2">{manualEventError}</div>}
            <div>
              <Label>Label</Label>
              <Input value={manualEventForm.label} onChange={e => setManualEventForm(f => ({ ...f, label: e.target.value }))} required />
            </div>
            <div>
              <Label>Type</Label>
              <select className="w-full border rounded px-2 py-2 mt-1" value={manualEventForm.type} onChange={e => setManualEventForm(f => ({ ...f, type: e.target.value }))} required>
                <option value="Failure">Failure</option>
                <option value="Alarm">Alarm</option>
                <option value="Action">Action</option>
                <option value="Note">Note</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inspection">Inspection</option>
                <option value="Operator Action">Operator Action</option>
                <option value="Info">Info</option>
              </select>
            </div>
            <div>
              <Label>Timestamp</Label>
              <Input type="datetime-local" value={manualEventForm.timestamp} onChange={e => setManualEventForm(f => ({ ...f, timestamp: e.target.value }))} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={manualEventForm.description} onChange={e => setManualEventForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Asset/Unit</Label>
              <select className="w-full border rounded px-2 py-2 mt-1" value={manualEventForm.asset} onChange={e => setManualEventForm(f => ({ ...f, asset: e.target.value }))} required>
                <option value="">Select...</option>
                {assets.map(asset => <option key={asset.id} value={asset.name}>{asset.name}</option>)}
                {units.map(unit => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Severity</Label>
              <select className="w-full border rounded px-2 py-2 mt-1" value={manualEventForm.severity} onChange={e => setManualEventForm(f => ({ ...f, severity: e.target.value as 'Low' | 'Medium' | 'High' | 'Critical' }))} required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowManualEventModal(false)}>Cancel</Button>
              <Button type="submit">{manualEventMode === 'add' ? 'Add' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showLinkEvidenceModal} onOpenChange={setShowLinkEvidenceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Evidence to Event</DialogTitle>
            <DialogDescription>Select evidence items to link to this event.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={async e => {
            e.preventDefault();
            let updatedEvidence = (selectedRCA?.evidence || []).map(ev => {
              let nodeIds = Array.isArray(ev.nodeIds) ? [...ev.nodeIds] : [];
              if (linkEvidenceSelection.includes(ev.id)) {
                if (!nodeIds.includes(linkEvidenceEvent.id)) nodeIds.push(linkEvidenceEvent.id);
              } else {
                nodeIds = nodeIds.filter(id => id !== linkEvidenceEvent.id);
              }
              return { ...ev, nodeIds };
            });
            const updated = await masterDataService.updateRCA(selectedRCA.id, { evidence: updatedEvidence });
            setSelectedRCA({ ...updated, logicTree: Array.isArray(updated.logicTree) && updated.logicTree.length > 0 ? flatListToTree(updated.logicTree as any[]) : [] });
            setShowLinkEvidenceModal(false);
          }}>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {(selectedRCA?.evidence || []).length === 0 && <div className="text-gray-400 italic">No evidence available.</div>}
              {(selectedRCA?.evidence || []).map(ev => (
                <label key={ev.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkEvidenceSelection.includes(ev.id)}
                    onChange={e => {
                      setLinkEvidenceSelection(sel => e.target.checked ? [...sel, ev.id] : sel.filter(id => id !== ev.id));
                    }}
                  />
                  <span className="font-semibold text-sm">{ev.title}</span>
                  <span className="text-xs text-gray-500">({ev.type})</span>
                  {Array.isArray(ev.nodeIds) && ev.nodeIds.length > 0 && (
                    <span className="text-xs text-pink-600">Nodes: {ev.nodeIds.join(', ')}</span>
                  )}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowLinkEvidenceModal(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {showLogicTreeFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto p-8 flex flex-col">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 text-3xl font-bold transition" onClick={() => setShowLogicTreeFullscreen(false)} aria-label="Close"><X className="w-8 h-8" /></button>
            <h2 className="text-2xl font-extrabold text-blue-800 mb-6 flex items-center gap-2"><BarChart3 className="w-7 h-7 text-blue-500" /> Logic Tree</h2>
            <div className="space-y-6 max-w-4xl mx-auto">
              {selectedRCA.logicTree && selectedRCA.logicTree.length > 0 ? (
                <ul className="pl-0">
                  {selectedRCA.logicTree.map((node, idx) => (
                    <LogicTreeNodeInteractive
                      key={node.id || idx}
                      node={node}
                      depth={0}
                      onChange={updatedNode => handleLogicTreeNodeChange(node.id, updatedNode)}
                      onDelete={() => handleDeleteNode(idx)}
                      onAddChild={() => handleAddChildNode(idx)}
                      onEdit={updatedNode => handleLogicTreeNodeChange(node.id, updatedNode)}
                      evidence={selectedRCA.evidence}
                      onAttachEvidence={handleAttachEvidence}
                    />
                  ))}
                </ul>
              ) : (
                <div className="text-gray-400 italic">No logic tree nodes. Add a root node to start.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {showEventDiagramFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-8 flex flex-col">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-pink-600 text-3xl font-bold transition" onClick={() => setShowEventDiagramFullscreen(false)} aria-label="Close"><X className="w-8 h-8" /></button>
            <h2 className="text-2xl font-extrabold text-pink-800 mb-6 flex items-center gap-2"><BarChart3 className="w-7 h-7 text-pink-500" /> Event Diagram</h2>
            <div className="w-full h-[70vh]">
              <EventDiagram
                nodes={diagramNodes}
                edges={diagramEdges}
                assets={assets}
                units={units}
                onNodesChange={async nodes => {
                  setDiagramNodes(nodes);
                  await masterDataService.updateRCA(selectedRCA.id, {
                    eventDiagram: {
                      nodes,
                      edges: diagramEdges,
                    }
                  });
                  const updated = await masterDataService.getRCAs({ tenantId: selectedRCA.tenantId });
                  const newRCA = updated.find(r => r.id === selectedRCA.id);
                  if (newRCA) setSelectedRCA({ ...newRCA, logicTree: Array.isArray(newRCA.logicTree) && newRCA.logicTree.length > 0 ? flatListToTree(newRCA.logicTree as any[]) : [] });
                }}
                onEdgesChange={async edges => {
                  setDiagramEdges(edges);
                  await masterDataService.updateRCA(selectedRCA.id, {
                    eventDiagram: {
                      nodes: diagramNodes,
                      edges,
                    }
                  });
                  const updated = await masterDataService.getRCAs({ tenantId: selectedRCA.tenantId });
                  const newRCA = updated.find(r => r.id === selectedRCA.id);
                  if (newRCA) setSelectedRCA({ ...newRCA, logicTree: Array.isArray(newRCA.logicTree) && newRCA.logicTree.length > 0 ? flatListToTree(newRCA.logicTree as any[]) : [] });
                }}
                onAddEvent={() => {}}
                onEditEvent={() => {}}
                onDeleteEvent={() => {}}
                onConnect={conn => {}}
                filterNodeIds={diagramNodes.map(n => n.id)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Add Recommendation Modal */}
      {showAddRecommendationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg relative border border-blue-100 flex flex-col">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-xl font-bold" onClick={() => setShowAddRecommendationModal(false)} aria-label="Close">&times;</button>
            <h2 className="text-xl font-bold text-blue-700 mb-4">Add Recommendation</h2>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); addRecommendation(); setShowAddRecommendationModal(false); }}>
              <div>
                <Label>Title</Label>
                <Input placeholder="Title" value={recommendationForm.title} onChange={e => setRecommendationForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Description" value={recommendationForm.description} onChange={e => setRecommendationForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label>Priority</Label>
                <select className="w-full border rounded px-2 py-1" value={recommendationForm.priority} onChange={e => setRecommendationForm(f => ({ ...f, priority: e.target.value as any }))}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <Label>Assignee</Label>
                <Select
                  value={recommendationForm.assigneeId}
                  onValueChange={value => setRecommendationForm(f => ({ ...f, assigneeId: value }))}
                >
                  <SelectTrigger className="w-48 border rounded px-2 py-1 bg-white">
                    <SelectValue placeholder="Select Assignee" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {allUsers.length === 0 && (
                      <SelectItem value="" disabled>No users found</SelectItem>
                    )}
                    {allUsers.map(user => (
                      <SelectItem key={user.id} value={user.id} className="flex flex-col items-start">
                        <span className="font-semibold">{user.name}</span>
                        <span className="text-xs text-gray-500">{user.role || 'User'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={recommendationForm.dueDate} onChange={e => setRecommendationForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label>Estimated Cost</Label>
                <Input placeholder="Est. Cost" value={recommendationForm.estimatedCost} onChange={e => setRecommendationForm(f => ({ ...f, estimatedCost: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={recommendationForm.status || 'Open'}
                  onChange={e => setRecommendationForm(f => ({ ...f, status: e.target.value as 'Open' | 'In Progress' | 'Completed' | 'Cancelled' }))}
                  required
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddRecommendationModal(false)} size="sm">Cancel</Button>
                <Button type="submit" size="sm">Add</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
