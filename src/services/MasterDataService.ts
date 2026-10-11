import type { BaseEntity } from './StorageService';
import { masterDataApi, RCATemplateDto } from './api/masterDataApi';
import { taskApi, TaskDto } from './api/taskApi';
import { unmappedEventApi, UnmappedEventDto, mapUnmappedEventDto } from './api/unmappedEventApi';
import { dashboardApi, DashboardConfigurationDto, DashboardConfigurationPayload } from './api/dashboardApi';
import {
  productionApi,
  mapProductionPlanTemplateDto,
  mapProductionPlanDto,
  mapProductionEventDto,
  mapProductionLossDto,
  mapOEESummaryDto,
  mapLossCategoryDto,
  mapReconcileFormDto,
  mapRcaDto,
  buildCreateProductionPlanTemplatePayload,
  buildUpdateProductionPlanTemplatePayload,
  buildCreateProductionPlanPayload,
  buildUpdateProductionPlanPayload,
  buildCreateProductionEventPayload,
  buildUpdateProductionEventPayload,
  buildCreateRcaPayload,
  buildUpdateRcaPayload,
} from './api/productionApi';

const sanitize = <T extends Record<string, unknown>>(payload: T): T => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    cleaned[key] = value;
  });
  return cleaned as T;
};

export interface Organization extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
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
  timezone?: string;
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
  capacity?: number;
  unitOfMeasure?: string;
  idealCycleTime?: number; // seconds per unit for OEE Performance
}

export interface Asset extends BaseEntity {
  name: string;
  code: string;
  unitId: string;
  description?: string;
  /** Free text on the backend; the forms offer Equipment, Instrument, System, Tool, Vehicle, Building, Other. */
  assetType: string;
  /** High | Medium | Low */
  criticality: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  /** Active | Inactive | Maintenance | Retired | Offline */
  status: string;
  location?: string;
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
  productionEventId?: string; // Link to production event
  productionEvent?: string; // Event description for display
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
  /** Backend id (same as `id`). */
  remoteId?: string;
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
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceLocation {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReasonCode extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  category?: string;
  tenantId: string;
}

export interface DashboardConfiguration extends BaseEntity {
  remoteId?: string;
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
  private parseDashboardSection<T>(value: string | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn('Failed to parse dashboard configuration section', error);
      return fallback;
    }
  }

  private mapDashboardDto(dto: DashboardConfigurationDto): DashboardConfiguration {
    const defaults = this.getDefaultDashboardConfiguration(dto.tenantId);
    return {
      id: dto.id,
      remoteId: dto.id,
      tenantId: dto.tenantId,
      isActive: dto.isActive,
      version: dto.version,
      lastModifiedBy: dto.lastModifiedBy ?? undefined,
      lastModifiedAt: dto.lastModifiedAt ?? undefined,
      oee: this.parseDashboardSection(dto.oee, defaults.oee),
      losses: this.parseDashboardSection(dto.losses, defaults.losses),
      costs: this.parseDashboardSection(dto.costs, defaults.costs),
      bottleneckRisk: this.parseDashboardSection(dto.bottleneckRisk, defaults.bottleneckRisk),
      display: this.parseDashboardSection(dto.display, defaults.display),
      performance: this.parseDashboardSection(dto.performance, defaults.performance),
      quality: this.parseDashboardSection(dto.quality, defaults.quality),
      availability: this.parseDashboardSection(dto.availability, defaults.availability),
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
    };
  }

  private buildDashboardPayload(config: DashboardConfiguration): DashboardConfigurationPayload {
    const stringify = (value: unknown) => (value !== undefined ? JSON.stringify(value) : undefined);
    return sanitize<DashboardConfigurationPayload>({
      tenantId: config.tenantId,
      oee: stringify(config.oee),
      losses: stringify(config.losses),
      costs: stringify(config.costs),
      bottleneckRisk: stringify(config.bottleneckRisk),
      display: stringify(config.display),
      performance: stringify(config.performance),
      quality: stringify(config.quality),
      availability: stringify(config.availability),
      isActive: config.isActive,
      version: config.version,
      lastModifiedBy: config.lastModifiedBy,
      lastModifiedAt: config.lastModifiedAt,
    });
  }


  private normalizeRCATemplate(template: any): RCATemplate {
    if (!template) {
      throw new Error('Invalid RCA template');
    }

    let parsedLogicTree = template.logicTreeStructure;
    if (typeof parsedLogicTree === 'string') {
      try {
        parsedLogicTree = JSON.parse(parsedLogicTree);
      } catch (error) {
        console.warn('Failed to parse logicTreeStructure for RCA template:', error);
        parsedLogicTree = {};
      }
    } else if (!parsedLogicTree) {
      parsedLogicTree = {};
    }

    let verificationChecklist: string[] = [];
    if (Array.isArray(template.verificationChecklist)) {
      verificationChecklist = template.verificationChecklist;
    } else if (typeof template.verificationChecklist === 'string') {
      verificationChecklist = template.verificationChecklist
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }

    return {
      ...template,
      logicTreeStructure: parsedLogicTree,
      verificationChecklist,
    };
  }

  // Organizations
  async createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const payload = { ...data, isActive: data.isActive ?? true };
    const { address, contactEmail, contactPhone, ...apiPayload } = payload;
    return await masterDataApi.createOrganization(apiPayload);
  }

  async getOrganizations(filters?: Record<string, unknown>): Promise<Organization[]> {
    const result = await masterDataApi.getOrganizations();
    if (!filters || Object.keys(filters).length === 0) {
      return result;
    }
    return result.filter((org) =>
      Object.entries(filters).every(([key, value]) => (org as any)[key] === value),
    );
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const { address, contactEmail, contactPhone, ...apiUpdates } = updates;
    return await masterDataApi.updateOrganization(id, apiUpdates);
  }

  async deleteOrganization(id: string): Promise<void> {
    await masterDataApi.deleteOrganization(id);
  }

  // Tenants
  async createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const payload = { ...data, isActive: data.isActive ?? true };
    const { timezone, ...apiPayload } = payload as Tenant & { timezone?: string };
    return await masterDataApi.createTenant(apiPayload);
  }

  async getTenants(filters?: { organizationId?: string }): Promise<Tenant[]> {
    return await masterDataApi.getTenants(filters);
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    const { timezone, ...apiUpdates } = updates as Partial<Tenant> & { timezone?: string };
    return await masterDataApi.updateTenant(id, apiUpdates);
  }

  async deleteTenant(id: string): Promise<void> {
    await masterDataApi.deleteTenant(id);
  }

  // Impact Codes
  async createImpactCode(data: Omit<ImpactCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImpactCode> {
    return await masterDataApi.createImpactCode(data);
  }

  async getImpactCodes(filters?: { tenantId?: string }): Promise<ImpactCode[]> {
    return await masterDataApi.getImpactCodes(filters);
  }

  async updateImpactCode(id: string, updates: Partial<ImpactCode>): Promise<ImpactCode> {
    return await masterDataApi.updateImpactCode(id, updates);
  }

  async deleteImpactCode(id: string): Promise<void> {
    await masterDataApi.deleteImpactCode(id);
  }

  // OEE Codes
  async createOEECode(data: Omit<OEECode, 'id' | 'createdAt' | 'updatedAt'>): Promise<OEECode> {
    return await masterDataApi.createOEECode(data);
  }

  async getOEECodes(filters?: { tenantId?: string }): Promise<OEECode[]> {
    return await masterDataApi.getOEECodes(filters);
  }

  async updateOEECode(id: string, updates: Partial<OEECode>): Promise<OEECode> {
    return await masterDataApi.updateOEECode(id, updates);
  }

  async deleteOEECode(id: string): Promise<void> {
    await masterDataApi.deleteOEECode(id);
  }

  // RCA Cause Codes
  async createRCACauseCode(data: Omit<RCACauseCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCACauseCode> {
    const payload = {
      ...data,
      parentId: data.parentId || undefined,
    };
    return await masterDataApi.createRCACauseCode(payload);
  }

  async getRCACauseCodes(filters?: { tenantId?: string; parentId?: string; root?: boolean }): Promise<RCACauseCode[]> {
    return await masterDataApi.getRCACauseCodes(filters);
  }

  async updateRCACauseCode(id: string, updates: Partial<RCACauseCode>): Promise<RCACauseCode> {
    const payload = {
      ...updates,
      parentId:
        updates.parentId === undefined || updates.parentId === ''
          ? undefined
          : updates.parentId,
    };
    return await masterDataApi.updateRCACauseCode(id, payload);
  }

  async deleteRCACauseCode(id: string): Promise<void> {
    await masterDataApi.deleteRCACauseCode(id);
  }

  // Verification Status Codes
  async createVerificationStatusCode(data: Omit<VerificationStatusCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationStatusCode> {
    return await masterDataApi.createVerificationStatusCode(data);
  }

  async getVerificationStatusCodes(filters?: { tenantId?: string }): Promise<VerificationStatusCode[]> {
    return await masterDataApi.getVerificationStatusCodes(filters);
  }

  async updateVerificationStatusCode(id: string, updates: Partial<VerificationStatusCode>): Promise<VerificationStatusCode> {
    return await masterDataApi.updateVerificationStatusCode(id, updates);
  }

  async deleteVerificationStatusCode(id: string): Promise<void> {
    await masterDataApi.deleteVerificationStatusCode(id);
  }

  // Evidence Categories
  async createEvidenceCategory(data: Omit<EvidenceCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<EvidenceCategory> {
    const payload: Omit<EvidenceCategory, 'id' | 'createdAt' | 'updatedAt'> = {
      ...data,
      description: data.description || undefined,
    };
    return await masterDataApi.createEvidenceCategory(payload);
  }

  async getEvidenceCategories(filters?: { tenantId?: string }): Promise<EvidenceCategory[]> {
    return await masterDataApi.getEvidenceCategories(filters);
  }

  async updateEvidenceCategory(id: string, updates: Partial<EvidenceCategory>): Promise<EvidenceCategory> {
    const payload: Partial<EvidenceCategory> = {
      ...updates,
      description: updates.description || undefined,
    };
    return await masterDataApi.updateEvidenceCategory(id, payload);
  }

  async deleteEvidenceCategory(id: string): Promise<void> {
    await masterDataApi.deleteEvidenceCategory(id);
  }

  // Evidence Locations
  async createEvidenceLocation(data: Omit<EvidenceLocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<EvidenceLocation> {
    const payload: Omit<EvidenceLocation, 'id' | 'createdAt' | 'updatedAt'> = {
      ...data,
      description: data.description || undefined,
    };
    return await masterDataApi.createEvidenceLocation(payload);
  }

  async getEvidenceLocations(filters?: { tenantId?: string }): Promise<EvidenceLocation[]> {
    return await masterDataApi.getEvidenceLocations(filters);
  }

  async updateEvidenceLocation(id: string, updates: Partial<EvidenceLocation>): Promise<EvidenceLocation> {
    const payload: Partial<EvidenceLocation> = {
      ...updates,
      description: updates.description || undefined,
    };
    return await masterDataApi.updateEvidenceLocation(id, payload);
  }

  async deleteEvidenceLocation(id: string): Promise<void> {
    await masterDataApi.deleteEvidenceLocation(id);
  }

  // Assets
  /** `tenantId` is optional: the backend create DTO accepts an asset without one. */
  async createAsset(data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'> & { tenantId?: string }): Promise<Asset> {
    const payload: Partial<Asset> = {
      ...data,
      assetType: data.assetType ?? 'Equipment',
      criticality: data.criticality ?? 'Medium',
      status: data.status ?? 'Active',
    };
    return await masterDataApi.createAsset(payload);
  }

  async getAssets(filters?: { unitId?: string; tenantId?: string }): Promise<Asset[]> {
    const assets = await masterDataApi.getAssets(filters);
    if (!filters) return assets;
    return assets.filter(asset => {
      if (filters.unitId && asset.unitId !== filters.unitId) return false;
      if (filters.tenantId && asset.tenantId !== filters.tenantId) return false;
      return true;
    });
  }

  async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
    return await masterDataApi.updateAsset(id, updates);
  }

  async deleteAsset(id: string): Promise<void> {
    await masterDataApi.deleteAsset(id);
  }

  // Audit Logs - Note: Use AuditService instead of these methods
  // These methods are deprecated and will be removed in a future version
  async createAuditLog(data: Omit<AuditLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuditLog> {
    throw new Error('createAuditLog is deprecated. Use AuditService.createLog instead.');
  }

  async getAuditLogs(filters?: { tenantId?: string; userId?: string; entityType?: string }): Promise<AuditLog[]> {
    throw new Error('getAuditLogs is deprecated. Use AuditService.getAuditLogs instead.');
  }

  // Tasks
  private mapTaskDto(dto: TaskDto): Task {
    return {
      id: dto.id,
      remoteId: dto.id,
      title: dto.title,
      description: dto.description,
      assignedTo: dto.assignedTo,
      assignedBy: dto.assignedBy,
      priority: dto.priority as 'Low' | 'Medium' | 'High' | 'Critical',
      status: dto.status as 'Open' | 'In Progress' | 'Completed' | 'Cancelled',
      dueDate: dto.dueDate,
      completedDate: dto.completedDate,
      entityType: dto.entityType,
      entityId: dto.entityId,
      organizationId: dto.organizationId,
      tenantId: dto.tenantId,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
    };
  }

  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const payload = {
      title: data.title,
      description: data.description,
      assignedTo: data.assignedTo,
      assignedBy: data.assignedBy,
      priority: data.priority,
      status: data.status,
      dueDate: data.dueDate,
      completedDate: data.completedDate,
      entityType: data.entityType,
      entityId: data.entityId,
      organizationId: data.organizationId,
      tenantId: data.tenantId,
    };
    const dto = await taskApi.create(payload);
    return this.mapTaskDto(dto);
  }

  async getTasks(filters?: { tenantId?: string; assignedTo?: string; status?: string }): Promise<Task[]> {
    const dtos = await taskApi.list(filters);
    return dtos.map(dto => this.mapTaskDto(dto));
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const payload: any = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.assignedTo !== undefined) payload.assignedTo = updates.assignedTo;
    if (updates.assignedBy !== undefined) payload.assignedBy = updates.assignedBy;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.dueDate !== undefined) payload.dueDate = updates.dueDate;
    if (updates.completedDate !== undefined) payload.completedDate = updates.completedDate;
    if (updates.entityType !== undefined) payload.entityType = updates.entityType;
    if (updates.entityId !== undefined) payload.entityId = updates.entityId;
    
    const dto = await taskApi.update(id, payload);
    return this.mapTaskDto(dto);
  }

  async deleteTask(id: string): Promise<void> {
    await taskApi.delete(id);
  }

  // RCA Templates
  async createRCATemplate(data: Omit<RCATemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCATemplate> {
    const payload: Partial<RCATemplateDto> = {
      ...data,
      logicTreeStructure: data.logicTreeStructure ?? {},
    };
    const created = await masterDataApi.createRCATemplate(payload);
    return this.normalizeRCATemplate(created);
  }

  async getRCATemplates(filters?: { tenantId?: string; category?: string; organizationId?: string }): Promise<RCATemplate[]> {
    const templates = await masterDataApi.getRCATemplates(filters);
    return templates.map(template => this.normalizeRCATemplate(template));
  }

  async updateRCATemplate(id: string, updates: Partial<RCATemplate>): Promise<RCATemplate> {
    const payload: Partial<RCATemplateDto> = {
      ...updates,
      ...(updates.logicTreeStructure !== undefined && {
        logicTreeStructure: updates.logicTreeStructure ?? {},
      }),
    };
    const updated = await masterDataApi.updateRCATemplate(id, payload);
    return this.normalizeRCATemplate(updated);
  }

  async deleteRCATemplate(id: string): Promise<void> {
    await masterDataApi.deleteRCATemplate(id);
  }

  // Products
  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    return await masterDataApi.createProduct(data);
  }

  async getProducts(filters?: { organizationId?: string }): Promise<Product[]> {
    return await masterDataApi.getProducts(filters);
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return await masterDataApi.updateProduct(id, updates);
  }

  async deleteProduct(id: string): Promise<void> {
    await masterDataApi.deleteProduct(id);
  }

  // Units
  async createUnit(data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Unit> {
    const payload = {
      ...data,
      capacity: data.capacity ?? 0,
      unitOfMeasure: data.unitOfMeasure ?? 'units',
    };
    return await masterDataApi.createUnit(payload);
  }

  async getUnits(filters?: { tenantId?: string }): Promise<Unit[]> {
    return await masterDataApi.getUnits(filters);
  }

  async getUnit(id: string): Promise<Unit> {
    return await masterDataApi.getUnit(id);
  }

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    return await masterDataApi.updateUnit(id, updates);
  }

  async deleteUnit(id: string): Promise<void> {
    await masterDataApi.deleteUnit(id);
  }

  // Production Events
  async createProductionEvent(data: Omit<ProductionEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionEvent> {
    const payload = buildCreateProductionEventPayload(data);
    const dto = await productionApi.createProductionEvent(payload);
    return mapProductionEventDto(dto);
  }

  async getProductionEvents(filters?: { unitId?: string; tenantId?: string; status?: string }): Promise<ProductionEvent[]> {
    const dtos = await productionApi.getProductionEvents(filters);
    return dtos.map(mapProductionEventDto);
  }

  async updateProductionEvent(id: string, updates: Partial<ProductionEvent>): Promise<ProductionEvent> {
    const payload = buildUpdateProductionEventPayload(updates);
    const dto = await productionApi.updateProductionEvent(id, payload);
    return mapProductionEventDto(dto);
  }

  async deleteProductionEvent(id: string): Promise<void> {
    await productionApi.deleteProductionEvent(id);
  }

  // Production Losses
  async createProductionLoss(data: Omit<ProductionLoss, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionLoss> {
    const payload = {
      planId: data.planId,
      period: data.period,
      actual: data.actual,
      shortRangePlan: data.shortRangePlan,
      losses: data.losses,
      unaccountedLoss: data.unaccountedLoss,
      action: data.action,
      tenantId: data.tenantId,
    };
    const dto = await productionApi.createProductionLoss(payload);
    return mapProductionLossDto(dto);
  }

  async getProductionLosses(filters?: { planId?: string; period?: string; tenantId?: string }): Promise<ProductionLoss[]> {
    const dtos = await productionApi.getProductionLosses({ planId: filters?.planId, tenantId: filters?.tenantId });
    const filtered = filters?.period
      ? dtos.filter((dto) => dto.period === filters.period)
      : dtos;
    return filtered.map(mapProductionLossDto);
  }

  async updateProductionLoss(id: string, updates: Partial<ProductionLoss>): Promise<ProductionLoss> {
    const payload = sanitize({
      planId: updates.planId,
      period: updates.period,
      actual: updates.actual,
      shortRangePlan: updates.shortRangePlan,
      losses: updates.losses,
      unaccountedLoss: updates.unaccountedLoss,
      action: updates.action,
      tenantId: updates.tenantId,
    });
    const dto = await productionApi.updateProductionLoss(id, payload);
    return mapProductionLossDto(dto);
  }

  async deleteProductionLoss(id: string): Promise<void> {
    await productionApi.deleteProductionLoss(id);
  }

  // OEE Summaries
  async createOEESummary(data: Omit<OEESummary, 'id' | 'createdAt' | 'updatedAt'>): Promise<OEESummary> {
    const payload = {
      planId: data.planId,
      availability: data.availability,
      performance: data.performance,
      quality: data.quality,
      overallOEE: data.overallOEE,
      period: data.period,
      tenantId: data.tenantId,
    };
    const dto = await productionApi.createOeeSummary(payload);
    return mapOEESummaryDto(dto);
  }

  async getOEESummaries(filters?: { planId?: string; period?: string; tenantId?: string }): Promise<OEESummary[]> {
    const dtos = await productionApi.getOeeSummaries({
      planId: filters?.planId,
      tenantId: filters?.tenantId,
      period: filters?.period,
    });
    return dtos.map(mapOEESummaryDto);
  }

  async updateOEESummary(id: string, updates: Partial<OEESummary>): Promise<OEESummary> {
    const payload = sanitize({
      planId: updates.planId,
      availability: updates.availability,
      performance: updates.performance,
      quality: updates.quality,
      overallOEE: updates.overallOEE,
      period: updates.period,
      tenantId: updates.tenantId,
    });
    const dto = await productionApi.updateOeeSummary(id, payload);
    return mapOEESummaryDto(dto);
  }

  async deleteOEESummary(id: string): Promise<void> {
    await productionApi.deleteOeeSummary(id);
  }

  // Loss Categories
  async createLossCategory(data: Omit<LossCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<LossCategory> {
    const payload = {
      reconcileFormId: data.reconcileFormId,
      categoryName: data.categoryName,
      lossAmount: data.lossAmount,
      impactCodeId: data.impactCodeId,
      oeeCodeId: data.oeeCodeId,
      description: data.description,
      tenantId: data.tenantId,
    };
    const dto = await productionApi.createLossCategory(payload);
    return mapLossCategoryDto(dto);
  }

  async getLossCategories(filters?: { reconcileFormId?: string; tenantId?: string }): Promise<LossCategory[]> {
    const dtos = await productionApi.getLossCategories(filters);
    return dtos.map(mapLossCategoryDto);
  }

  async updateLossCategory(id: string, updates: Partial<LossCategory>): Promise<LossCategory> {
    const payload = sanitize({
      reconcileFormId: updates.reconcileFormId,
      categoryName: updates.categoryName,
      lossAmount: updates.lossAmount,
      impactCodeId: updates.impactCodeId,
      oeeCodeId: updates.oeeCodeId,
      description: updates.description,
      tenantId: updates.tenantId,
    });
    const dto = await productionApi.updateLossCategory(id, payload);
    return mapLossCategoryDto(dto);
  }

  async deleteLossCategory(id: string): Promise<void> {
    await productionApi.deleteLossCategory(id);
  }

  // Reconcile Forms
  async createReconcileForm(data: Omit<ReconcileForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReconcileForm> {
    const payload = {
      lossId: data.lossId,
      totalLossAmount: data.totalLossAmount,
      categorizedLossAmount: data.categorizedLossAmount,
      unaccountedLossAmount: data.unaccountedLossAmount,
      productionEvent: data.productionEvent,
      comment: data.comment,
      status: data.status,
      categories: JSON.stringify(data.categories ?? []),
      tenantId: data.tenantId,
    };
    const dto = await productionApi.createReconcileForm(payload);
    return mapReconcileFormDto(dto);
  }

  async getReconcileForms(filters?: { lossId?: string; status?: string }): Promise<ReconcileForm[]> {
    const dtos = await productionApi.getReconcileForms(filters);
    return dtos.map(mapReconcileFormDto);
  }

  async updateReconcileForm(id: string, updates: Partial<ReconcileForm>): Promise<ReconcileForm> {
    const payload = sanitize({
      lossId: updates.lossId,
      totalLossAmount: updates.totalLossAmount,
      categorizedLossAmount: updates.categorizedLossAmount,
      unaccountedLossAmount: updates.unaccountedLossAmount,
      productionEvent: updates.productionEvent,
      comment: updates.comment,
      status: updates.status,
      categories:
        updates.categories !== undefined ? JSON.stringify(updates.categories ?? []) : undefined,
      tenantId: updates.tenantId,
    });
    const dto = await productionApi.updateReconcileForm(id, payload);
    return mapReconcileFormDto(dto);
  }

  async deleteReconcileForm(id: string): Promise<void> {
    await productionApi.deleteReconcileForm(id);
  }

  // RCA
  async createRCA(data: Omit<RCA, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCA> {
    const payload = buildCreateRcaPayload(data);
    const dto = await productionApi.createRca(payload);
    return mapRcaDto(dto);
  }

  async getRCAs(filters?: { tenantId?: string; status?: string }): Promise<RCA[]> {
    const dtos = await productionApi.getRcas(filters);
    return dtos.map(mapRcaDto);
  }

  async updateRCA(id: string, updates: Partial<RCA>): Promise<RCA> {
    const payload = buildUpdateRcaPayload(updates);
    const dto = await productionApi.updateRca(id, payload);
    return mapRcaDto(dto);
  }

  async deleteRCA(id: string): Promise<void> {
    await productionApi.deleteRca(id);
  }

  // Production Plan Templates
  async createProductionPlanTemplate(data: Omit<ProductionPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionPlanTemplate> {
    const payload = buildCreateProductionPlanTemplatePayload(data);
    const dto = await productionApi.createProductionPlanTemplate(payload);
    return mapProductionPlanTemplateDto(dto);
  }

  async getProductionPlanTemplates(filters?: { tenantId?: string; orgId?: string }): Promise<ProductionPlanTemplate[]> {
    const dtos = await productionApi.getProductionPlanTemplates({ tenantId: filters?.tenantId });
    return dtos.map(mapProductionPlanTemplateDto);
  }

  async updateProductionPlanTemplate(id: string, updates: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate> {
    const payload = buildUpdateProductionPlanTemplatePayload(updates);
    const dto = await productionApi.updateProductionPlanTemplate(id, payload);
    return mapProductionPlanTemplateDto(dto);
  }

  async deleteProductionPlanTemplate(id: string): Promise<void> {
    await productionApi.deleteProductionPlanTemplate(id);
  }

  // Production Plans
  async createProductionPlan(data: Omit<ProductionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionPlan> {
    const payload = buildCreateProductionPlanPayload(data);
    const dto = await productionApi.createProductionPlan(payload);
    return mapProductionPlanDto(dto);
  }

  async getProductionPlans(filters?: { tenantId?: string; unitId?: string; status?: string }): Promise<ProductionPlan[]> {
    const dtos = await productionApi.getProductionPlans(filters);
    return dtos.map(mapProductionPlanDto);
  }

  async updateProductionPlan(id: string, updates: Partial<ProductionPlan>): Promise<ProductionPlan> {
    const payload = buildUpdateProductionPlanPayload(updates);
    const dto = await productionApi.updateProductionPlan(id, payload);
    return mapProductionPlanDto(dto);
  }

  async deleteProductionPlan(id: string): Promise<void> {
    await productionApi.deleteProductionPlan(id);
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
    const payload = {
      tenantId: data.tenantId || data.event?.tenantId,
      organizationId: data.organizationId,
      unitId: data.unitId || data.event?.unitId,
      eventName: data.eventName || data.event?.name || data.event?.description,
      eventType: data.eventType || data.event?.eventType,
      startTime: data.startTime || data.event?.startTime,
      endTime: data.endTime || data.event?.endTime,
      sourceSystem: data.sourceSystem || data.event?.source || 'PI',
      sourceId: data.sourceId || data.event?.eventId || data.event?.id,
      reason: data.reason,
      suggestions: data.suggestions,
      event: data.event,
    };
    const dto = await unmappedEventApi.create(payload);
    return mapUnmappedEventDto(dto);
  }

  async getUnmappedEvent(id: string): Promise<any | null> {
    const dto = await unmappedEventApi.get(id);
    return mapUnmappedEventDto(dto);
  }

  async updateUnmappedEvent(id: string, updates: Partial<any>): Promise<any> {
    const dto = await unmappedEventApi.update(id, updates);
    return mapUnmappedEventDto(dto);
  }

  async deleteUnmappedEvent(id: string): Promise<void> {
    await unmappedEventApi.delete(id);
  }

  async getUnmappedEvents(filters?: { tenantId?: string; unitId?: string }): Promise<any[]> {
    const dtos = await unmappedEventApi.list(filters);
    return dtos.map(mapUnmappedEventDto);
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
        const sampleReasonCodes: Array<
          Omit<ReasonCode, 'id' | 'createdAt' | 'updatedAt' | 'parentId'> & { parentCode?: string }
        > = [
          // Top-level
          { code: '100', name: 'Equipment Failure', description: 'Equipment-related failures', tenantId },
          { code: '200', name: 'Process Failure', description: 'Process-related failures', tenantId },
          { code: '300', name: 'Material Issues', description: 'Material-related issues', tenantId },
          { code: '400', name: 'Personnel Issues', description: 'Personnel-related issues', tenantId },
          { code: '500', name: 'Planned Downtime', description: 'Scheduled/planned downtime', tenantId },
          // Equipment Failure children
          { code: '110', name: 'Mechanical', description: 'Mechanical breakdowns', tenantId, parentCode: '100' },
          { code: '120', name: 'Electrical', description: 'Electrical failures', tenantId, parentCode: '100' },
          { code: '130', name: 'Instrumentation', description: 'Instrumentation/control failures', tenantId, parentCode: '100' },
          // Mechanical grandchildren
          { code: '111', name: 'Bearing Failure', description: 'Bearing-related failures', tenantId, parentCode: '110' },
          { code: '112', name: 'Gearbox Failure', description: 'Gearbox-related failures', tenantId, parentCode: '110' },
          { code: '113', name: 'Pump Failure', description: 'Pump breakdowns', tenantId, parentCode: '110' },
          { code: '114', name: 'Seal Failure', description: 'Seal or gasket failures', tenantId, parentCode: '110' },
          // Electrical grandchildren
          { code: '121', name: 'Motor Failure', description: 'Motor breakdowns', tenantId, parentCode: '120' },
          { code: '122', name: 'Power Supply', description: 'Power supply interruptions', tenantId, parentCode: '120' },
          { code: '123', name: 'Wiring Issue', description: 'Wiring or connection faults', tenantId, parentCode: '120' },
          // Instrumentation grandchildren
          { code: '131', name: 'Sensor Failure', description: 'Sensor or transmitter failures', tenantId, parentCode: '130' },
          { code: '132', name: 'PLC/Controller', description: 'PLC or controller faults', tenantId, parentCode: '130' },
          // Process Failure children
          { code: '210', name: 'Process Upset', description: 'Process upsets', tenantId, parentCode: '200' },
          { code: '220', name: 'Quality Deviation', description: 'Quality deviations', tenantId, parentCode: '200' },
          { code: '230', name: 'Capacity Loss', description: 'Capacity or throughput loss', tenantId, parentCode: '200' },
          // Material Issues children
          { code: '310', name: 'Wrong Material', description: 'Incorrect material used', tenantId, parentCode: '300' },
          { code: '320', name: 'Material Delay', description: 'Material delivery delay', tenantId, parentCode: '300' },
          { code: '330', name: 'Material Defect', description: 'Defective or contaminated material', tenantId, parentCode: '300' },
          // Personnel Issues children
          { code: '410', name: 'Operator Error', description: 'Operator mistakes', tenantId, parentCode: '400' },
          { code: '420', name: 'Staff Shortage', description: 'Not enough staff', tenantId, parentCode: '400' },
          { code: '430', name: 'Training Issue', description: 'Insufficient training', tenantId, parentCode: '400' },
          // Planned Downtime children
          { code: '510', name: 'Scheduled Maintenance', description: 'Planned maintenance', tenantId, parentCode: '500' },
          { code: '520', name: 'Changeover', description: 'Planned changeover', tenantId, parentCode: '500' },
          { code: '530', name: 'Cleaning', description: 'Scheduled cleaning', tenantId, parentCode: '500' },
          { code: '540', name: 'Break/Meeting', description: 'Operator breaks or meetings', tenantId, parentCode: '500' },
        ];

        const reasonIdByCode = new Map<string, string>();

        for (const rc of sampleReasonCodes) {
          const { parentCode, ...rest } = rc;
          const parentId = parentCode ? reasonIdByCode.get(parentCode) : undefined;

          const created = await this.createReasonCode({
            ...rest,
            parentId,
          });

          reasonIdByCode.set(rc.code, created?.id ?? rc.code);
        }
      }
    } catch (error) {
      console.error('Failed to initialize sample data:', error);
    }
  }

  // Reason Codes CRUD
  async createReasonCode(data: Omit<ReasonCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReasonCode> {
    const payload = {
      ...data,
      parentId: data.parentId || undefined,
    };
    return await masterDataApi.createReasonCode(payload);
  }
  async getReasonCodes(filters?: { tenantId?: string }): Promise<ReasonCode[]> {
    return await masterDataApi.getReasonCodes(filters);
  }
  async updateReasonCode(id: string, updates: Partial<ReasonCode>): Promise<ReasonCode> {
    const payload = {
      ...updates,
      parentId:
        updates.parentId === undefined || updates.parentId === ''
          ? undefined
          : updates.parentId,
    };
    return await masterDataApi.updateReasonCode(id, payload);
  }
  async deleteReasonCode(id: string): Promise<void> {
    await masterDataApi.deleteReasonCode(id);
  }

  // Dashboard Configuration Methods
  async getDashboardConfiguration(tenantId: string): Promise<DashboardConfiguration | null> {
    const configs = await dashboardApi.list({ tenantId, active: true });
    if (configs.length > 0) {
      return this.mapDashboardDto(configs[0]);
    }
    return null;
  }

  async createDashboardConfiguration(config: Omit<DashboardConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardConfiguration> {
    const payloadConfig: DashboardConfiguration = {
      ...(config as DashboardConfiguration),
      tenantId: config.tenantId,
      isActive: config.isActive ?? true,
      version: config.version ?? 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dto = await dashboardApi.create(this.buildDashboardPayload(payloadConfig));
    return this.mapDashboardDto(dto);
  }

  async updateDashboardConfiguration(tenantId: string, updates: Partial<DashboardConfiguration>): Promise<DashboardConfiguration> {
    const existing = await this.getDashboardConfiguration(tenantId);
    if (!existing) {
      throw new Error('Dashboard configuration not found');
    }

    const merged: DashboardConfiguration = {
      ...existing,
      ...updates,
      tenantId,
      lastModifiedAt: updates.lastModifiedAt ?? new Date().toISOString(),
    };

    const dto = await dashboardApi.update(existing.remoteId ?? existing.id, this.buildDashboardPayload(merged));
    return this.mapDashboardDto(dto);
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
