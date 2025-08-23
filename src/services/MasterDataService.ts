import { storageService, BaseEntity } from './StorageService';

export interface Organization extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface Tenant extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  organizationId: string;
  isActive: boolean;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ImpactCode extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  category: 'Quality' | 'Availability' | 'Performance';
  costPerUnit?: number;
  costPerHour?: number;
  costBasis?: 'perUnit' | 'perHour';
  tenantId: string;
}

export interface OEECode extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  category: 'Planned' | 'Unplanned';
  impactType: 'Availability' | 'Performance' | 'Quality';
  tenantId: string;
}

export interface RCACauseCode extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  category: 'Equipment' | 'Process' | 'Material' | 'Personnel' | 'Environment' | 'Method';
  parentId?: string;
  tenantId: string;
}

export interface VerificationStatusCode extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  color: string;
  tenantId: string;
  items?: string[];
}

export interface Product extends BaseEntity {
  name: string;
  code: string;
  unitOfMeasure: string;
  description?: string;
  standardCost: number;
}

export interface Unit extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  capacity: number;
  unitOfMeasure: string;
  idealCycleTime?: number; // seconds per unit for OEE Performance
}

export interface Asset extends BaseEntity {
  name: string;
  code: string;
  unitId: string;
  description?: string;
  assetType: 'Equipment' | 'Instrument' | 'System';
  criticality: 'High' | 'Medium' | 'Low';
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Retired';
  tenantId: string;
}

export interface ProductionPlan extends BaseEntity {
  name: string;
  unitId: string;
  productId: string;
  plannedQuantity: number;
  toleranceLimit: number;
  startDate: string;
  endDate: string;
  tenantId: string;
  planBasis?: string;
  usefulProductionTime?: UsefulProductionTime;
  recurrence?: string;
  dataEntryFrequency?: string;
  status: 'Planned' | 'Active' | 'Completed' | 'Cancelled';
  actualQuantity?: number;
  // --- Shift/Crew fields ---
  shift?: string;
  crew?: string;
  // --- Planner Notes/Comments ---
  plannerNotes?: string;
  comments?: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: string;
    type: 'Note' | 'Comment' | 'Approval' | 'Rejection';
  }>;
  // --- Approval Workflow Fields ---
  approvalStatus: 'Draft' | 'Pending Review' | 'Pending Approval' | 'Approved' | 'Rejected';
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  // --- Custom Attributes ---
  customAttributes?: Record<string, any>;
  // --- Audit Trail ---
  auditTrail?: AuditTrailEntry[];
}

export interface UsefulProductionTime {
  [day: string]: { 
    start: string; 
    end: string; 
  };
}

export interface ProductionPlanTemplate extends BaseEntity {
  name: string;
  description?: string;
  unitId: string;
  productIds: string[];
  planBasis: string;
  startDate: string;
  endDate: string;
  recurrence?: string;
  tenantId: string;
  orgId?: string;
  version?: number;
  usefulProductionTime?: UsefulProductionTime;
  dataEntryFrequency?: string;
}

export interface ProductionEvent extends BaseEntity {
  eventId: string;
  planId?: string; // For Production Loss events
  unitId: string;
  assetId?: string;
  impactCodeId?: string;
  oeeCodeId?: string;
  description: string;
  startTime: string;
  endTime?: string;
  source: 'Manual' | 'Simulated PI' | 'CMMS' | 'PI';
  quantity?: number; // For Production Loss
  cost?: number;
  status: 'Open' | 'Coded' | 'RCA Required' | 'Closed' | 'Investigating' | 'In Progress' | 'Completed' | 'Cancelled';
  rcaId?: string;
  // Event type/category for tab segregation
  eventType: 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput';
  // IOW fields
  parameter?: string;
  value?: number;
  limit?: number;
  limitType?: 'High' | 'Low';
  breachDuration?: number;
  // SOL fields
  solType?: 'Safety' | 'Operational';
  // APM fields
  apmType?: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendedAction?: string;
  // Failure WO fields
  workOrderId?: string;
  failureMode?: string;
  defectiveQuantity?: number; // For OEE Quality calculation
  // --- Shift/Crew fields ---
  shift?: string;
  crew?: string;
  // --- Audit Trail ---
  auditTrail?: AuditTrailEntry[];
  // --- Loss Category for ProductionLoss events ---
  lossCategory?: string;
  // --- Operator/Recorder fields ---
  operatorName?: string;
  reasonCodeId?: string; // ISA-95 reason code for loss events
  // --- Duration for per-hour costing ---
  duration?: number;
}

export interface AuditTrailEntry {
  timestamp: string;
  userId: string;
  userName: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface ProductionLoss extends BaseEntity {
  planId: string;
  period: string;
  actual: number;
  shortRangePlan: number;
  losses: number;
  unaccountedLoss: number;
  action: 'Reconcile' | 'RCA Required' | 'Closed';
  tenantId: string;
}

export interface OEESummary extends BaseEntity {
  planId: string;
  availability: number; // percentage
  performance: number; // percentage
  quality: number; // percentage
  overallOEE: number; // calculated from the three above
  period: string;
  tenantId: string;
}

export interface LossCategory extends BaseEntity {
  reconcileFormId: string;
  categoryName: string; // 'Equipment Failure', 'Quality Issues', 'Setup Time', etc.
  lossAmount: number;
  impactCodeId: string;
  oeeCodeId: string;
  description: string;
  tenantId: string;
}

export interface ReconcileForm extends BaseEntity {
  lossId: string;
  totalLossAmount: number;
  categorizedLossAmount: number;
  unaccountedLossAmount: number;
  productionEvent: string;
  comment: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  categories: LossCategory[];
  tenantId: string;
}

export interface RCA extends BaseEntity {
  eventId: string;
  title: string;
  description: string;
  status: 'Draft' | 'In Progress' | 'Analysis' | 'Published' | 'Closed' | 'Definition' | 'Data Collection' | 'Recommendations' | 'Approval' | 'Closure';
  teamLeadId: string;
  teamMemberIds: string[];
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  targetCloseDate?: string;
  actualCloseDate?: string;
  rootCause?: string;
  recommendations: RCARecommendation[];
  logicTree?: LogicTreeNode[];
  evidence: RCAEvidence[];
  templateId?: string;
  teamCharter?: string;
  eventDiagram?: { nodes: any[]; edges: any[] };
  // --- Approval & Closure Workflow ---
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalComments?: string;
  closureStatus?: 'Pending' | 'Closed';
  closedBy?: string;
  closedAt?: string;
  closureNotes?: string;
  // --- Tracking & Performance Metrics ---
  preFailureRate?: number; // failures per month before RCA
  postFailureRate?: number; // failures per month after RCA
  failureCostPerIncident?: number; // cost per failure incident
  implementationCost?: number; // total cost to implement recommendations
  timeToResolution?: number; // days from start to resolution
  timeToImplementation?: number; // days from RCA completion to implementation
  effectivenessScore?: number; // 0-100 score based on metrics
  lastUpdated?: string; // last metrics update
  trackingNotes?: string; // notes about tracking progress
  // --- Timeline Tracking ---
  phaseTimeline?: {
    investigationStart?: string;
    analysisComplete?: string;
    recommendationsPublished?: string;
    implementationStart?: string;
    implementationComplete?: string;
    effectivenessReview?: string;
  };
  // --- ROI & Business Impact ---
  calculatedROI?: number; // calculated return on investment
  costSavings?: number; // total cost savings achieved
  downtimeReduction?: number; // percentage reduction in downtime
  productivityImprovement?: number; // percentage improvement in productivity
}

export interface RCARecommendation extends BaseEntity {
  rcaId: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  assigneeId: string;
  dueDate?: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
  cmmsWorkOrderId?: string;
  estimatedCost?: number;
  actualCost?: number;
}

export interface RCAEvidence extends BaseEntity {
  rcaId: string;
  title: string;
  description: string;
  type: 'Photo' | 'Document' | 'Time Series' | 'Note' | 'Video';
  fileName?: string;
  filePath?: string;
  collectedBy: string;
  collectedAt: string;
  nodeIds?: string[]; // many-to-many: can be attached to multiple logic tree nodes
  fileBlob?: Blob;
  // --- Enhanced fields ---
  category?: string;
  location?: string;
  timestamp?: string; // manual override
  relatedAssetId?: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  tags?: string[];
  verified?: boolean;
  // --- 5P's and task management fields ---
  fiveP?: 'Parts' | 'Paper' | 'People' | 'Place' | 'Process';
  task?: string;
  dueDate?: string;
  status?: 'pending' | 'completed';
  attachments?: File[];
  // --- Time Series (Historian) evidence fields ---
  tsProvider?: 'pi';
  tsStreams?: { id: string; name?: string; path?: string; units?: string }[];
  tsMode?: 'recorded' | 'interpolated' | 'summary' | 'plot';
  tsStart?: string;
  tsEnd?: string;
  tsInterval?: string;
  tsIntervals?: number;
  tsSummaryTypes?: string;
  tsStreamsNote?: string;
}

export interface LogicTreeNode extends BaseEntity {
  rcaId: string;
  parentId?: string;
  question: string;
  answer?: string;
  type: 'Root' | 'Why' | 'How' | 'Cause';
  verified: boolean;
  evidenceIds: string[];
  position: { x: number; y: number };
}

export interface AuditLog extends BaseEntity {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  organizationId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  assignedTo: string;
  assignedBy: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
  dueDate?: string;
  completedDate?: string;
  entityType?: string; // 'RCA', 'Event', 'Plan', etc.
  entityId?: string;
  organizationId: string;
  tenantId: string;
}

export interface RCATemplate extends BaseEntity {
  name: string;
  description?: string;
  category: string;
  logicTreeStructure: any; // JSON structure for logic tree
  verificationChecklist: string[];
  organizationId: string;
  tenantId: string;
}

export interface EvidenceCategory {
  id: string;
  name: string;
  tenantId: string;
  createdAt: string;
}

export interface EvidenceLocation {
  id: string;
  name: string;
  tenantId: string;
  createdAt: string;
}

export interface ReasonCode extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  tenantId: string;
}

export interface DashboardConfiguration extends BaseEntity {
  // OEE Configuration
  oee: {
    // OEE Component Weights (if you want to adjust the formula)
    availabilityWeight: number; // default: 1.0
    performanceWeight: number; // default: 1.0
    qualityWeight: number; // default: 1.0
    // OEE Targets
    targetOEE: number; // default: 85%
    targetAvailability: number; // default: 90%
    targetPerformance: number; // default: 95%
    targetQuality: number; // default: 99%
  };
  
  // Loss Configuration
  losses: {
    // Loss Value Calculation
    lossValuePerUnit: number; // default: 100 (dollars)
    // Loss Thresholds
    highLossThreshold: number; // default: 10% of planned
    criticalLossThreshold: number; // default: 20% of planned
    // Unaccounted Loss Defaults
    defaultUnaccountedLossPercentage: number; // default: 30%
    // Loss Categories (for reconciliation)
    defaultLossCategories: string[]; // default: ['Downtime', 'Breakdown', 'Setup', 'Quality', 'Other']
  };
  
  // Cost Configuration
  costs: {
    // Cost Calculation Methods
    costCalculationMethod: 'perUnit' | 'perHour' | 'fixed'; // default: 'perUnit'
    defaultCostPerUnit: number; // default: 50
    defaultCostPerHour: number; // default: 1000
    // Cost Thresholds
    highCostThreshold: number; // default: 10000
    criticalCostThreshold: number; // default: 50000
  };
  
  // Bottleneck Risk Configuration
  bottleneckRisk: {
    // Risk Factors and Weights
    lossWeight: number; // default: 0.4
    costWeight: number; // default: 0.3
    oeeWeight: number; // default: 0.3
    // Risk Thresholds
    lowRiskThreshold: number; // default: 0.3
    mediumRiskThreshold: number; // default: 0.6
    highRiskThreshold: number; // default: 0.8
  };
  
  // Display Configuration
  display: {
    // Metric Visibility
    showOEE: boolean; // default: true
    showLosses: boolean; // default: true
    showCosts: boolean; // default: true
    showCapacity: boolean; // default: true
    showActions: boolean; // default: true
    // Number Formatting
    decimalPlaces: number; // default: 1
    currencySymbol: string; // default: '$'
    numberFormat: 'en-US' | 'en-GB' | 'de-DE' | 'custom'; // default: 'en-US'
    // Color Themes
    theme: 'default' | 'high-contrast' | 'colorblind-friendly'; // default: 'default'
  };
  
  // Performance Configuration
  performance: {
    // Ideal Cycle Time Defaults
    defaultIdealCycleTime: number; // default: 6 (seconds)
    // Performance Calculation
    performanceCalculationMethod: 'cycleTime' | 'outputRate' | 'efficiency'; // default: 'cycleTime'
    // Performance Thresholds
    lowPerformanceThreshold: number; // default: 70%
    highPerformanceThreshold: number; // default: 95%
  };
  
  // Quality Configuration
  quality: {
    // Quality Calculation
    qualityCalculationMethod: 'defects' | 'rework' | 'scrap'; // default: 'defects'
    // Quality Thresholds
    lowQualityThreshold: number; // default: 95%
    highQualityThreshold: number; // default: 99.5%
  };
  
  // Availability Configuration
  availability: {
    // Availability Calculation
    availabilityCalculationMethod: 'uptime' | 'downtime' | 'scheduled'; // default: 'uptime'
    // Availability Thresholds
    lowAvailabilityThreshold: number; // default: 80%
    highAvailabilityThreshold: number; // default: 95%
  };
  
  // Tenant-specific settings
  tenantId: string;
  isActive: boolean; // default: true
  version: number; // for migration purposes
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export function getOEEComponentForEvent(event: ProductionEvent, impactCodes: ImpactCode[], oeeCodes: OEECode[]): 'Availability' | 'Performance' | 'Quality' | null {
  const impact = impactCodes.find(code => code.id === event.impactCodeId);
  if (impact?.category === 'Availability' || impact?.category === 'Performance' || impact?.category === 'Quality') {
    return impact.category;
  }
  const oee = oeeCodes.find(code => code.id === event.oeeCodeId);
  if (oee?.impactType === 'Availability' || oee?.impactType === 'Performance' || oee?.impactType === 'Quality') {
    return oee.impactType;
  }
  return null;
}

export class MasterDataService {
  // Organizations
  async createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    return await storageService.create<Organization>('organizations', data);
  }

  async getOrganizations(): Promise<Organization[]> {
    return await storageService.query<Organization>('organizations');
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    return await storageService.update<Organization>('organizations', id, updates);
  }

  async deleteOrganization(id: string): Promise<void> {
    return await storageService.delete('organizations', id);
  }

  // Tenants
  async createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    return await storageService.create<Tenant>('tenants', data);
  }

  async getTenants(filters?: { organizationId?: string }): Promise<Tenant[]> {
    return await storageService.query<Tenant>('tenants', filters);
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    return await storageService.update<Tenant>('tenants', id, updates);
  }

  async deleteTenant(id: string): Promise<void> {
    return await storageService.delete('tenants', id);
  }

  // Impact Codes
  async createImpactCode(data: Omit<ImpactCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImpactCode> {
    return await storageService.create<ImpactCode>('impactCodes', data);
  }

  async getImpactCodes(filters?: { tenantId?: string }): Promise<ImpactCode[]> {
    return await storageService.query<ImpactCode>('impactCodes', filters);
  }

  async updateImpactCode(id: string, updates: Partial<ImpactCode>): Promise<ImpactCode> {
    return await storageService.update<ImpactCode>('impactCodes', id, updates);
  }

  async deleteImpactCode(id: string): Promise<void> {
    return await storageService.delete('impactCodes', id);
  }

  // OEE Codes
  async createOEECode(data: Omit<OEECode, 'id' | 'createdAt' | 'updatedAt'>): Promise<OEECode> {
    return await storageService.create<OEECode>('oeeCodes', data);
  }

  async getOEECodes(filters?: { tenantId?: string }): Promise<OEECode[]> {
    return await storageService.query<OEECode>('oeeCodes', filters);
  }

  async updateOEECode(id: string, updates: Partial<OEECode>): Promise<OEECode> {
    return await storageService.update<OEECode>('oeeCodes', id, updates);
  }

  async deleteOEECode(id: string): Promise<void> {
    return await storageService.delete('oeeCodes', id);
  }

  // RCA Cause Codes
  async createRCACauseCode(data: Omit<RCACauseCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCACauseCode> {
    return await storageService.create<RCACauseCode>('rcaCauseCodes', data);
  }

  async getRCACauseCodes(filters?: { tenantId?: string; parentId?: string }): Promise<RCACauseCode[]> {
    return await storageService.query<RCACauseCode>('rcaCauseCodes', filters);
  }

  async updateRCACauseCode(id: string, updates: Partial<RCACauseCode>): Promise<RCACauseCode> {
    return await storageService.update<RCACauseCode>('rcaCauseCodes', id, updates);
  }

  async deleteRCACauseCode(id: string): Promise<void> {
    return await storageService.delete('rcaCauseCodes', id);
  }

  // Verification Status Codes
  async createVerificationStatusCode(data: Omit<VerificationStatusCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationStatusCode> {
    return storageService.create('verificationStatusCodes', data);
  }

  async getVerificationStatusCodes(filters?: { tenantId?: string }): Promise<VerificationStatusCode[]> {
    return await storageService.query<VerificationStatusCode>('verificationStatusCodes', filters);
  }

  async updateVerificationStatusCode(id: string, updates: Partial<VerificationStatusCode>): Promise<VerificationStatusCode> {
    return storageService.update('verificationStatusCodes', id, updates);
  }

  async deleteVerificationStatusCode(id: string): Promise<void> {
    return await storageService.delete('verificationStatusCodes', id);
  }

  // Assets
  async createAsset(data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    return await storageService.create<Asset>('assets', data);
  }

  async getAssets(filters?: { unitId?: string; tenantId?: string }): Promise<Asset[]> {
    return await storageService.query<Asset>('assets', filters);
  }

  async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
    return await storageService.update<Asset>('assets', id, updates);
  }

  async deleteAsset(id: string): Promise<void> {
    return await storageService.delete('assets', id);
  }

  // Audit Logs
  async createAuditLog(data: Omit<AuditLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuditLog> {
    return await storageService.create<AuditLog>('auditLogs', data);
  }

  async getAuditLogs(filters?: { tenantId?: string; userId?: string; entityType?: string }): Promise<AuditLog[]> {
    return await storageService.query<AuditLog>('auditLogs', filters);
  }

  // Tasks
  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    return await storageService.create<Task>('tasks', data);
  }

  async getTasks(filters?: { tenantId?: string; assignedTo?: string; status?: string }): Promise<Task[]> {
    return await storageService.query<Task>('tasks', filters);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return await storageService.update<Task>('tasks', id, updates);
  }

  async deleteTask(id: string): Promise<void> {
    return await storageService.delete('tasks', id);
  }

  // RCA Templates
  async createRCATemplate(data: Omit<RCATemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCATemplate> {
    return await storageService.create<RCATemplate>('rcaTemplates', data);
  }

  async getRCATemplates(filters?: { tenantId?: string; category?: string }): Promise<RCATemplate[]> {
    return await storageService.query<RCATemplate>('rcaTemplates', filters);
  }

  async updateRCATemplate(id: string, updates: Partial<RCATemplate>): Promise<RCATemplate> {
    return await storageService.update<RCATemplate>('rcaTemplates', id, updates);
  }

  async deleteRCATemplate(id: string): Promise<void> {
    return await storageService.delete('rcaTemplates', id);
  }

  // Products
  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    return await storageService.create<Product>('products', data);
  }

  async getProducts(filters?: { organizationId?: string }): Promise<Product[]> {
    return await storageService.query<Product>('products', filters);
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return await storageService.update<Product>('products', id, updates);
  }

  async deleteProduct(id: string): Promise<void> {
    return await storageService.delete('products', id);
  }

  // Units
  async createUnit(data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Unit> {
    return await storageService.create<Unit>('units', data);
  }

  async getUnits(filters?: { tenantId?: string }): Promise<Unit[]> {
    return await storageService.query<Unit>('units', filters);
  }

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    return await storageService.update<Unit>('units', id, updates);
  }

  async deleteUnit(id: string): Promise<void> {
    return await storageService.delete('units', id);
  }

  // Production Events
  async createProductionEvent(data: Omit<ProductionEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionEvent> {
    return await storageService.create<ProductionEvent>('productionEvents', data);
  }

  async getProductionEvents(filters?: { unitId?: string; tenantId?: string; status?: string }): Promise<ProductionEvent[]> {
    return await storageService.query<ProductionEvent>('productionEvents', filters);
  }

  async updateProductionEvent(id: string, updates: Partial<ProductionEvent>): Promise<ProductionEvent> {
    return await storageService.update<ProductionEvent>('productionEvents', id, updates);
  }

  async deleteProductionEvent(id: string): Promise<void> {
    return await storageService.delete('productionEvents', id);
  }

  // Production Losses
  async createProductionLoss(data: Omit<ProductionLoss, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionLoss> {
    return await storageService.create<ProductionLoss>('productionLosses', data);
  }

  async getProductionLosses(filters?: { planId?: string; period?: string; tenantId?: string }): Promise<ProductionLoss[]> {
    return await storageService.query<ProductionLoss>('productionLosses', filters);
  }

  async updateProductionLoss(id: string, updates: Partial<ProductionLoss>): Promise<ProductionLoss> {
    return await storageService.update<ProductionLoss>('productionLosses', id, updates);
  }

  async deleteProductionLoss(id: string): Promise<void> {
    return await storageService.delete('productionLosses', id);
  }

  // OEE Summaries
  async createOEESummary(data: Omit<OEESummary, 'id' | 'createdAt' | 'updatedAt'>): Promise<OEESummary> {
    return await storageService.create<OEESummary>('oeeSummaries', data);
  }

  async getOEESummaries(filters?: { planId?: string; period?: string; tenantId?: string }): Promise<OEESummary[]> {
    return await storageService.query<OEESummary>('oeeSummaries', filters);
  }

  async updateOEESummary(id: string, updates: Partial<OEESummary>): Promise<OEESummary> {
    return await storageService.update<OEESummary>('oeeSummaries', id, updates);
  }

  async deleteOEESummary(id: string): Promise<void> {
    return await storageService.delete('oeeSummaries', id);
  }

  // Loss Categories
  async createLossCategory(data: Omit<LossCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<LossCategory> {
    return await storageService.create<LossCategory>('lossCategories', data);
  }

  async getLossCategories(filters?: { reconcileFormId?: string; tenantId?: string }): Promise<LossCategory[]> {
    return await storageService.query<LossCategory>('lossCategories', filters);
  }

  async updateLossCategory(id: string, updates: Partial<LossCategory>): Promise<LossCategory> {
    return await storageService.update<LossCategory>('lossCategories', id, updates);
  }

  async deleteLossCategory(id: string): Promise<void> {
    return await storageService.delete('lossCategories', id);
  }

  // Reconcile Forms
  async createReconcileForm(data: Omit<ReconcileForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReconcileForm> {
    return await storageService.create<ReconcileForm>('reconcileForms', data);
  }

  async getReconcileForms(filters?: { lossId?: string; status?: string }): Promise<ReconcileForm[]> {
    return await storageService.query<ReconcileForm>('reconcileForms', filters);
  }

  async updateReconcileForm(id: string, updates: Partial<ReconcileForm>): Promise<ReconcileForm> {
    return await storageService.update<ReconcileForm>('reconcileForms', id, updates);
  }

  async deleteReconcileForm(id: string): Promise<void> {
    return await storageService.delete('reconcileForms', id);
  }

  // RCA
  async createRCA(data: Omit<RCA, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCA> {
    return await storageService.create<RCA>('rcas', data);
  }

  async getRCAs(filters?: { tenantId?: string; status?: string }): Promise<RCA[]> {
    return await storageService.query<RCA>('rcas', filters);
  }

  async updateRCA(id: string, updates: Partial<RCA>): Promise<RCA> {
    return await storageService.update<RCA>('rcas', id, updates);
  }

  async deleteRCA(id: string): Promise<void> {
    return await storageService.delete('rcas', id);
  }

  // Production Plan Templates
  async createProductionPlanTemplate(data: Omit<ProductionPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionPlanTemplate> {
    return await storageService.create<ProductionPlanTemplate>('productionPlanTemplates', data);
  }

  async getProductionPlanTemplates(filters?: { tenantId?: string; orgId?: string }): Promise<ProductionPlanTemplate[]> {
    return await storageService.query<ProductionPlanTemplate>('productionPlanTemplates', filters);
  }

  async updateProductionPlanTemplate(id: string, updates: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate> {
    return await storageService.update<ProductionPlanTemplate>('productionPlanTemplates', id, updates);
  }

  async deleteProductionPlanTemplate(id: string): Promise<void> {
    return await storageService.delete('productionPlanTemplates', id);
  }

  // Production Plans
  async createProductionPlan(data: Omit<ProductionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionPlan> {
    return await storageService.create<ProductionPlan>('productionPlans', data);
  }

  async getProductionPlans(filters?: { tenantId?: string; unitId?: string; status?: string }): Promise<ProductionPlan[]> {
    return await storageService.query<ProductionPlan>('productionPlans', filters);
  }

  async updateProductionPlan(id: string, updates: Partial<ProductionPlan>): Promise<ProductionPlan> {
    return await storageService.update<ProductionPlan>('productionPlans', id, updates);
  }

  async deleteProductionPlan(id: string): Promise<void> {
    return await storageService.delete('productionPlans', id);
  }

  /**
   * Find a plan for a given unit and event time.
   * @param unitId - The unit/machine/line identifier
   * @param timestamp - The event's start time (ISO string)
   * @param tenantId - Tenant context
   * @returns The matching plan, or undefined if not found (and logs a warning)
   */
  async findPlanForEvent(unitId: string, timestamp: string, tenantId?: string, event?: any): Promise<ProductionPlan | undefined> {
    const plans = await this.getProductionPlans({ unitId, tenantId });
    const eventTime = new Date(timestamp).getTime();
    // Match if eventTime is within plan's startDate and endDate (inclusive)
    const plan = plans.find(plan => {
      const start = new Date(plan.startDate).getTime();
      const end = new Date(plan.endDate).getTime();
      return eventTime >= start && eventTime <= end;
    });
    if (!plan) {
      // Log or flag for review
      const reason = plans.length === 0
        ? 'No plans found for this unit.'
        : 'Event time does not fall within any plan start/end date.';
      const suggestions = [
        'Check if the unitId is correct.',
        'Check if the event time is within any plan’s start and end date.',
        'Create a new plan for this unit and time if needed.',
        'Manually assign this event to a plan.'
      ];
      await this.createUnmappedEvent({
        event: event || { unitId, timestamp, tenantId },
        reason,
        suggestions
      });
      console.warn(`[Event Mapping] No plan found for unitId=${unitId} at time=${timestamp} (tenant=${tenantId || 'N/A'}) - ${reason}`);
    }
    return plan;
  }

  // --- Unmapped Events Persistent CRUD ---
  async createUnmappedEvent(data: Omit<any, 'id' | 'createdAt' | 'updatedAt'>): Promise<any> {
    return storageService.createUnmappedEvent(data);
  }

  async getUnmappedEvent(id: string): Promise<any | null> {
    return storageService.getUnmappedEvent(id);
  }

  async updateUnmappedEvent(id: string, updates: Partial<any>): Promise<any> {
    return storageService.updateUnmappedEvent(id, updates);
  }

  async deleteUnmappedEvent(id: string): Promise<void> {
    return storageService.deleteUnmappedEvent(id);
  }

  async getUnmappedEvents(filters?: { tenantId?: string; unitId?: string }): Promise<any[]> {
    return storageService.queryUnmappedEvents(filters);
  }

  // Simulate production events for all event types
  async simulateProductionEvents(unitId: string, count: number = 10, tenantId?: string): Promise<void> {
    const events: ProductionEvent[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      // Cycle through event types
      const eventTypes: ProductionEvent['eventType'][] = ['ProductionLoss', 'IOW', 'SOL', 'APM', 'FailureWO', 'ProductionOutput'];
      const eventType = eventTypes[i % eventTypes.length];
      const startTime = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + Math.random() * 2 * 60 * 60 * 1000);
      const baseEvent: Partial<ProductionEvent> = {
        eventId: `event_${Date.now()}_${i}`,
        unitId,
        assetId: undefined,
        description: '',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        source: 'Simulated PI',
        status: 'Open',
        tenantId: tenantId || 'default-tenant',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        eventType,
      };
      let event: ProductionEvent;
      let planId: string | undefined = undefined;
      // For ProductionOutput and ProductionLoss, try to find a matching plan
      if (['ProductionOutput', 'ProductionLoss'].includes(eventType)) {
        const plan = await this.findPlanForEvent(unitId, startTime.toISOString(), tenantId);
        planId = plan?.id;
      }
      switch (eventType) {
        case 'ProductionLoss':
          event = {
            ...baseEvent,
            planId,
            impactCodeId: 'impact_1',
            oeeCodeId: 'oee_1',
            description: 'Simulated production loss event',
            quantity: Math.floor(Math.random() * 100) + 1,
            cost: Math.floor(Math.random() * 1000) + 100,
            status: 'RCA Required',
            eventType: 'ProductionLoss',
          } as ProductionEvent;
          break;
        case 'ProductionOutput':
          event = {
            ...baseEvent,
            planId,
            description: 'Simulated production output event',
            quantity: Math.floor(Math.random() * 5000) + 1000,
            cost: 0,
            status: 'Completed',
            eventType: 'ProductionOutput',
          } as ProductionEvent;
          break;
        case 'IOW':
          event = {
            ...baseEvent,
            parameter: 'Pressure',
            value: 120 + Math.random() * 10,
            limit: 125,
            limitType: 'High',
            breachDuration: Math.floor(Math.random() * 60),
            description: 'IOW excursion event',
            status: 'Investigating',
            eventType: 'IOW',
          } as ProductionEvent;
          break;
        case 'SOL':
          event = {
            ...baseEvent,
            solType: Math.random() > 0.5 ? 'Safety' : 'Operational',
            parameter: 'Temperature',
            value: 80 + Math.random() * 10,
            limit: 85,
            limitType: 'High',
            breachDuration: Math.floor(Math.random() * 30),
            description: 'SOL breach event',
            status: 'Open',
            eventType: 'SOL',
          } as ProductionEvent;
          break;
        case 'APM':
          event = {
            ...baseEvent,
            apmType: 'Health',
            severity: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)] as any,
            description: 'APM asset health event',
            recommendedAction: 'Schedule maintenance',
            status: 'Open',
            eventType: 'APM',
          } as ProductionEvent;
          break;
        case 'FailureWO':
          event = {
            ...baseEvent,
            workOrderId: `WO_${1000 + i}`,
            failureMode: 'Bearing Failure',
            description: 'Failure work order event',
            cost: Math.floor(Math.random() * 2000) + 500,
            status: 'In Progress',
            eventType: 'FailureWO',
          } as ProductionEvent;
          break;
        default:
          event = {
            ...baseEvent,
            description: 'Generic event',
            status: 'Open',
            eventType: 'ProductionLoss',
          } as ProductionEvent;
      }
      events.push(event);
    }
    for (const event of events) {
      await this.createProductionEvent(event);
    }
  }

  // Initialize sample data for production dashboard
  async initializeSampleData(tenantId: string): Promise<void> {
    try {
      // Check if sample data already exists
      const existingImpactCodes = await this.getImpactCodes({ tenantId });
      const existingOEECodes = await this.getOEECodes({ tenantId });

      // Create sample Impact Codes if none exist
      if (existingImpactCodes.length === 0) {
        const sampleImpactCodes = [
          {
            code: 'IC001',
            name: 'Equipment Failure',
            description: 'Unplanned equipment breakdowns',
            category: 'Availability' as const,
            costPerHour: 5000,
            tenantId
          },
          {
            code: 'IC002',
            name: 'Setup Time',
            description: 'Time required for equipment setup and changeover',
            category: 'Availability' as const,
            costPerHour: 2000,
            tenantId
          },
          {
            code: 'IC003',
            name: 'Reduced Speed',
            description: 'Equipment operating below designed speed',
            category: 'Performance' as const,
            costPerHour: 3000,
            tenantId
          },
          {
            code: 'IC004',
            name: 'Quality Defects',
            description: 'Products that do not meet quality standards',
            category: 'Quality' as const,
            costPerHour: 4000,
            tenantId
          },
          {
            code: 'IC005',
            name: 'Material Shortage',
            description: 'Lack of required materials for production',
            category: 'Availability' as const,
            costPerHour: 2500,
            tenantId
          }
        ];

        for (const impactCode of sampleImpactCodes) {
          await this.createImpactCode(impactCode);
        }
      }

      // Create sample OEE Codes if none exist
      if (existingOEECodes.length === 0) {
        const sampleOEECodes = [
          {
            code: 'OEE001',
            name: 'Planned Maintenance',
            description: 'Scheduled maintenance activities',
            category: 'Planned' as const,
            impactType: 'Availability' as const,
            tenantId
          },
          {
            code: 'OEE002',
            name: 'Unplanned Downtime',
            description: 'Unexpected equipment failures',
            category: 'Unplanned' as const,
            impactType: 'Availability' as const,
            tenantId
          },
          {
            code: 'OEE003',
            name: 'Setup and Adjustment',
            description: 'Equipment setup and adjustment time',
            category: 'Planned' as const,
            impactType: 'Performance' as const,
            tenantId
          },
          {
            code: 'OEE004',
            name: 'Idling and Minor Stops',
            description: 'Short stops and idling periods',
            category: 'Unplanned' as const,
            impactType: 'Performance' as const,
            tenantId
          },
          {
            code: 'OEE005',
            name: 'Reduced Speed',
            description: 'Equipment operating below optimal speed',
            category: 'Unplanned' as const,
            impactType: 'Performance' as const,
            tenantId
          },
          {
            code: 'OEE006',
            name: 'Startup Rejects',
            description: 'Defects during startup phase',
            category: 'Unplanned' as const,
            impactType: 'Quality' as const,
            tenantId
          },
          {
            code: 'OEE007',
            name: 'Production Rejects',
            description: 'Defects during normal production',
            category: 'Unplanned' as const,
            impactType: 'Quality' as const,
            tenantId
          }
        ];

        for (const oeeCode of sampleOEECodes) {
          await this.createOEECode(oeeCode);
        }
      }

      // Create sample Reason Codes if none exist
      const existingReasonCodes = await this.getReasonCodes({ tenantId });
      if (existingReasonCodes.length === 0) {
        const sampleReasonCodes: Omit<ReasonCode, 'id' | 'createdAt' | 'updatedAt'>[] = [
          // Top-level
          { code: '100', name: 'Equipment Failure', description: 'Equipment-related failures', parentId: '', tenantId },
          { code: '200', name: 'Process Failure', description: 'Process-related failures', parentId: '', tenantId },
          { code: '300', name: 'Material Issues', description: 'Material-related issues', parentId: '', tenantId },
          { code: '400', name: 'Personnel Issues', description: 'Personnel-related issues', parentId: '', tenantId },
          { code: '500', name: 'Planned Downtime', description: 'Scheduled/planned downtime', parentId: '', tenantId },
          // Equipment Failure children
          { code: '110', name: 'Mechanical', description: 'Mechanical breakdowns', parentId: '100', tenantId },
          { code: '120', name: 'Electrical', description: 'Electrical failures', parentId: '100', tenantId },
          { code: '130', name: 'Instrumentation', description: 'Instrumentation/control failures', parentId: '100', tenantId },
          // Mechanical grandchildren
          { code: '111', name: 'Bearing Failure', description: 'Bearing-related failures', parentId: '110', tenantId },
          { code: '112', name: 'Gearbox Failure', description: 'Gearbox-related failures', parentId: '110', tenantId },
          { code: '113', name: 'Pump Failure', description: 'Pump breakdowns', parentId: '110', tenantId },
          { code: '114', name: 'Seal Failure', description: 'Seal or gasket failures', parentId: '110', tenantId },
          // Electrical grandchildren
          { code: '121', name: 'Motor Failure', description: 'Motor breakdowns', parentId: '120', tenantId },
          { code: '122', name: 'Power Supply', description: 'Power supply interruptions', parentId: '120', tenantId },
          { code: '123', name: 'Wiring Issue', description: 'Wiring or connection faults', parentId: '120', tenantId },
          // Instrumentation grandchildren
          { code: '131', name: 'Sensor Failure', description: 'Sensor or transmitter failures', parentId: '130', tenantId },
          { code: '132', name: 'PLC/Controller', description: 'PLC or controller faults', parentId: '130', tenantId },
          // Process Failure children
          { code: '210', name: 'Process Upset', description: 'Process upsets', parentId: '200', tenantId },
          { code: '220', name: 'Quality Deviation', description: 'Quality deviations', parentId: '200', tenantId },
          { code: '230', name: 'Capacity Loss', description: 'Capacity or throughput loss', parentId: '200', tenantId },
          // Material Issues children
          { code: '310', name: 'Wrong Material', description: 'Incorrect material used', parentId: '300', tenantId },
          { code: '320', name: 'Material Delay', description: 'Material delivery delay', parentId: '300', tenantId },
          { code: '330', name: 'Material Defect', description: 'Defective or contaminated material', parentId: '300', tenantId },
          // Personnel Issues children
          { code: '410', name: 'Operator Error', description: 'Operator mistakes', parentId: '400', tenantId },
          { code: '420', name: 'Staff Shortage', description: 'Not enough staff', parentId: '400', tenantId },
          { code: '430', name: 'Training Issue', description: 'Insufficient training', parentId: '400', tenantId },
          // Planned Downtime children
          { code: '510', name: 'Scheduled Maintenance', description: 'Planned maintenance', parentId: '500', tenantId },
          { code: '520', name: 'Changeover', description: 'Planned changeover', parentId: '500', tenantId },
          { code: '530', name: 'Cleaning', description: 'Scheduled cleaning', parentId: '500', tenantId },
          { code: '540', name: 'Break/Meeting', description: 'Operator breaks or meetings', parentId: '500', tenantId },
        ];
        for (const rc of sampleReasonCodes) {
          await this.createReasonCode(rc);
        }
      }
    } catch (error) {
      console.error('Failed to initialize sample data:', error);
    }
  }

  // Reason Codes CRUD
  async createReasonCode(data: Omit<ReasonCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReasonCode> {
    return await storageService.create<ReasonCode>('reasonCodes', data);
  }
  async getReasonCodes(filters?: { tenantId?: string }): Promise<ReasonCode[]> {
    return await storageService.query<ReasonCode>('reasonCodes', filters);
  }
  async updateReasonCode(id: string, updates: Partial<ReasonCode>): Promise<ReasonCode> {
    return await storageService.update<ReasonCode>('reasonCodes', id, updates);
  }
  async deleteReasonCode(id: string): Promise<void> {
    return await storageService.delete('reasonCodes', id);
  }

  // Dashboard Configuration Methods
  async getDashboardConfiguration(tenantId: string): Promise<DashboardConfiguration | null> {
    try {
      const configs = await storageService.query<DashboardConfiguration>('dashboardConfigurations', { tenantId });
      return configs.length > 0 ? configs[0] : null;
    } catch (error) {
      console.error('Failed to get dashboard configuration:', error);
      return null;
    }
  }

  async createDashboardConfiguration(config: Omit<DashboardConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardConfiguration> {
    try {
      return await storageService.create<DashboardConfiguration>('dashboardConfigurations', config);
    } catch (error) {
      console.error('Failed to create dashboard configuration:', error);
      throw error;
    }
  }

  async updateDashboardConfiguration(tenantId: string, updates: Partial<DashboardConfiguration>): Promise<DashboardConfiguration> {
    try {
      const existing = await this.getDashboardConfiguration(tenantId);
      if (!existing) {
        throw new Error('Dashboard configuration not found');
      }
      
      return await storageService.update<DashboardConfiguration>('dashboardConfigurations', existing.id, {
        ...updates,
        lastModifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update dashboard configuration:', error);
      throw error;
    }
  }

  getDefaultDashboardConfiguration(tenantId: string): Omit<DashboardConfiguration, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      oee: {
        availabilityWeight: 1.0,
        performanceWeight: 1.0,
        qualityWeight: 1.0,
        targetOEE: 85,
        targetAvailability: 90,
        targetPerformance: 95,
        targetQuality: 99,
      },
      losses: {
        lossValuePerUnit: 100,
        highLossThreshold: 10,
        criticalLossThreshold: 20,
        defaultUnaccountedLossPercentage: 30,
        defaultLossCategories: ['Downtime', 'Breakdown', 'Setup', 'Quality', 'Other'],
      },
      costs: {
        costCalculationMethod: 'perUnit',
        defaultCostPerUnit: 50,
        defaultCostPerHour: 1000,
        highCostThreshold: 10000,
        criticalCostThreshold: 50000,
      },
      bottleneckRisk: {
        lossWeight: 0.4,
        costWeight: 0.3,
        oeeWeight: 0.3,
        lowRiskThreshold: 0.3,
        mediumRiskThreshold: 0.6,
        highRiskThreshold: 0.8,
      },
      display: {
        showOEE: true,
        showLosses: true,
        showCosts: true,
        showCapacity: true,
        showActions: true,
        decimalPlaces: 1,
        currencySymbol: '$',
        numberFormat: 'en-US',
        theme: 'default',
      },
      performance: {
        defaultIdealCycleTime: 6,
        performanceCalculationMethod: 'cycleTime',
        lowPerformanceThreshold: 70,
        highPerformanceThreshold: 95,
      },
      quality: {
        qualityCalculationMethod: 'defects',
        lowQualityThreshold: 95,
        highQualityThreshold: 99.5,
      },
      availability: {
        availabilityCalculationMethod: 'uptime',
        lowAvailabilityThreshold: 80,
        highAvailabilityThreshold: 95,
      },
      tenantId,
      isActive: true,
      version: 1,
    };
  }

  async initializeDashboardConfiguration(tenantId: string): Promise<DashboardConfiguration> {
    try {
      const existing = await this.getDashboardConfiguration(tenantId);
      if (existing) {
        return existing;
      }
      
      const defaultConfig = this.getDefaultDashboardConfiguration(tenantId);
      return await this.createDashboardConfiguration(defaultConfig);
    } catch (error) {
      console.error('Failed to initialize dashboard configuration:', error);
      throw error;
    }
  }
}

export const masterDataService = new MasterDataService();
