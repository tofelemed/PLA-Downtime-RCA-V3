import { httpClient } from './httpClient';
import type { RCADto, buildCreateRcaPayload, buildUpdateRcaPayload } from './rca-v1-payload';
import {
  ProductionPlan,
  ProductionPlanTemplate,
  ProductionEvent,
  ProductionLoss,
  OEESummary,
  LossCategory,
  ReconcileForm,
  UsefulProductionTime,
  AuditTrailEntry,
} from '../MasterDataService';

type Nullable<T> = T | null | undefined;

const parseJson = <T>(value: Nullable<string>, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON field', value, error);
    return fallback;
  }
};

const toISOString = (value: Nullable<string | Date>): string | undefined => {
  if (!value) return undefined;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

// Helper to convert date strings to ISO format (handles YYYY-MM-DD from HTML date inputs)
const toISODateString = (value: Nullable<string | Date>): string | undefined => {
  if (!value) return undefined;
  
  // If it's already a Date object, convert to ISO
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString();
  }
  
  // If it's a string, check the format
  const str = value.trim();
  if (!str) return undefined;
  
  // If it's already in ISO format (contains 'T' or ends with 'Z'), return as is
  if (str.includes('T') || str.endsWith('Z')) {
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }
  
  // If it's in YYYY-MM-DD format (from HTML date input), convert to ISO
  // Match YYYY-MM-DD pattern
  const dateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    // Create date at midnight UTC
    const date = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }
  
  // Try to parse as regular date string
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

// Helper to check if a string is a valid UUID
const isValidUUID = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  if (value === '' || value === 'null' || value === 'undefined') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

const sanitizePayload = <T extends Record<string, unknown>>(payload: T): T => {
  const cleaned: Record<string, unknown> = {};
  const uuidFields = ['organizationId', 'tenantId', 'unitId', 'productId', 'submittedBy', 'reviewedBy', 'approvedBy'];
  
  Object.entries(payload).forEach(([key, value]) => {
    // Skip undefined values (they shouldn't be sent)
    if (value === undefined) return;
    
    // For UUID fields, validate and skip if invalid
    if (uuidFields.includes(key)) {
      if (value === null || value === '' || !isValidUUID(value)) {
        return; // Skip invalid UUID values
      }
    }
    
    cleaned[key] = value;
  });
  return cleaned as T;
};

/* -------------------------------------------------------------------------- */
/*                                  Templates                                 */
/* -------------------------------------------------------------------------- */

export interface ProductionPlanTemplateDto {
  id: string;
  name: string;
  description?: string | null;
  unitId: string;
  productIds: string[];
  planBasis: string;
  startDate: string;
  endDate: string;
  recurrence?: string | null;
  tenantId: string;
  organizationId?: string | null;
  version?: number | null;
  usefulProductionTime?: string | null;
  dataEntryFrequency?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const mapProductionPlanTemplateDto = (
  dto: ProductionPlanTemplateDto,
): ProductionPlanTemplate => ({
  id: dto.id,
  name: dto.name,
  description: dto.description ?? undefined,
  unitId: dto.unitId,
  productIds: dto.productIds ?? [],
  planBasis: dto.planBasis,
  startDate: toISOString(dto.startDate) ?? '',
  endDate: toISOString(dto.endDate) ?? '',
  recurrence: dto.recurrence ?? undefined,
  tenantId: dto.tenantId,
  orgId: dto.organizationId ?? undefined,
  version: dto.version ?? undefined,
  usefulProductionTime: parseJson<UsefulProductionTime | undefined>(
    dto.usefulProductionTime,
    undefined,
  ),
  dataEntryFrequency: dto.dataEntryFrequency ?? undefined,
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

export const buildCreateProductionPlanTemplatePayload = (
  data: Omit<ProductionPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>,
) =>
  sanitizePayload({
    name: data.name,
    description: data.description ?? null,
    unitId: data.unitId,
    productIds: data.productIds ?? [],
    planBasis: data.planBasis,
    startDate: data.startDate,
    endDate: data.endDate,
    recurrence: data.recurrence ?? null,
    tenantId: data.tenantId,
    organizationId: data.orgId ?? null,
    version: data.version ?? null,
    usefulProductionTime: data.usefulProductionTime
      ? JSON.stringify(data.usefulProductionTime)
      : null,
    dataEntryFrequency: data.dataEntryFrequency ?? null,
  });

export const buildUpdateProductionPlanTemplatePayload = (
  data: Partial<ProductionPlanTemplate>,
) =>
  sanitizePayload({
    name: data.name,
    description: data.description ?? null,
    unitId: data.unitId,
    productIds: data.productIds,
    planBasis: data.planBasis,
    startDate: data.startDate,
    endDate: data.endDate,
    recurrence: data.recurrence ?? null,
    tenantId: data.tenantId,
    organizationId: data.orgId ?? null,
    version: data.version,
    usefulProductionTime: data.usefulProductionTime
      ? JSON.stringify(data.usefulProductionTime)
      : data.usefulProductionTime === undefined
        ? undefined
        : null,
    dataEntryFrequency: data.dataEntryFrequency ?? null,
  });

/* -------------------------------------------------------------------------- */
/*                                    Plan                                    */
/* -------------------------------------------------------------------------- */

export interface ProductionPlanDto {
  id: string;
  name: string;
  unitId: string;
  productId: string;
  plannedQuantity: number;
  toleranceLimit: number;
  startDate: string;
  endDate: string;
  tenantId: string;
  planBasis?: string | null;
  usefulProductionTime?: string | null;
  recurrence?: string | null;
  dataEntryFrequency?: string | null;
  status: string;
  actualQuantity?: number | null;
  shift?: string | null;
  crew?: string | null;
  plannerNotes?: string | null;
  comments?: string | null;
  approvalStatus: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  customAttributes?: string | null;
  auditTrail?: string | null;
  createdAt: string;
  updatedAt: string;
}

const parseComments = (
  value: Nullable<string>,
): ProductionPlan['comments'] | undefined => {
  const fallback: ProductionPlan['comments'] = undefined;
  return parseJson(value, fallback);
};

const parseAuditTrail = (
  value: Nullable<string>,
): AuditTrailEntry[] | undefined => parseJson(value, undefined);

const parseCustomAttributes = (
  value: Nullable<string>,
): Record<string, any> | undefined => parseJson(value, undefined);

export const mapProductionPlanDto = (dto: ProductionPlanDto): ProductionPlan => ({
  id: dto.id,
  name: dto.name,
  unitId: dto.unitId,
  productId: dto.productId,
  plannedQuantity: Number(dto.plannedQuantity ?? 0),
  toleranceLimit: Number(dto.toleranceLimit ?? 0),
  startDate: toISOString(dto.startDate) ?? '',
  endDate: toISOString(dto.endDate) ?? '',
  tenantId: dto.tenantId,
  planBasis: dto.planBasis ?? undefined,
  usefulProductionTime: parseJson<UsefulProductionTime | undefined>(
    dto.usefulProductionTime,
    undefined,
  ),
  recurrence: dto.recurrence ?? undefined,
  dataEntryFrequency: dto.dataEntryFrequency ?? undefined,
  status: dto.status as ProductionPlan['status'],
  actualQuantity:
    dto.actualQuantity === null || dto.actualQuantity === undefined
      ? undefined
      : Number(dto.actualQuantity),
  shift: dto.shift ?? undefined,
  crew: dto.crew ?? undefined,
  plannerNotes: dto.plannerNotes ?? undefined,
  comments: parseComments(dto.comments),
  approvalStatus: dto.approvalStatus as ProductionPlan['approvalStatus'],
  submittedBy: dto.submittedBy ?? undefined,
  submittedAt: toISOString(dto.submittedAt),
  reviewedBy: dto.reviewedBy ?? undefined,
  reviewedAt: toISOString(dto.reviewedAt),
  approvedBy: dto.approvedBy ?? undefined,
  approvedAt: toISOString(dto.approvedAt),
  rejectionReason: dto.rejectionReason ?? undefined,
  customAttributes: parseCustomAttributes(dto.customAttributes),
  auditTrail: parseAuditTrail(dto.auditTrail),
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

export const buildCreateProductionPlanPayload = (
  data: Omit<ProductionPlan, 'id' | 'createdAt' | 'updatedAt'>,
) => {
  const startDateISO = toISODateString(data.startDate);
  const endDateISO = toISODateString(data.endDate);
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildCreateProductionPlanPayload] Input dates:', {
      startDate: data.startDate,
      endDate: data.endDate,
      startDateISO,
      endDateISO,
    });
  }
  
  return sanitizePayload({
    name: data.name,
    unitId: data.unitId && isValidUUID(data.unitId) ? data.unitId : undefined,
    productId: data.productId && isValidUUID(data.productId) ? data.productId : undefined,
    plannedQuantity: data.plannedQuantity,
    toleranceLimit: data.toleranceLimit,
    startDate: startDateISO,
    endDate: endDateISO,
    tenantId: data.tenantId && isValidUUID(data.tenantId) ? data.tenantId : undefined,
    organizationId: data.organizationId && isValidUUID(data.organizationId) ? data.organizationId : undefined,
    planBasis: data.planBasis ?? null,
    usefulProductionTime: data.usefulProductionTime
      ? JSON.stringify(data.usefulProductionTime)
      : null,
    recurrence: data.recurrence ?? null,
    dataEntryFrequency: data.dataEntryFrequency ?? null,
    status: data.status,
    actualQuantity: data.actualQuantity ?? null,
    shift: data.shift ?? null,
    crew: data.crew ?? null,
    plannerNotes: data.plannerNotes ?? null,
    comments: data.comments ? JSON.stringify(data.comments) : null,
    approvalStatus: data.approvalStatus,
    submittedBy: data.submittedBy ?? null,
    submittedAt: data.submittedAt ?? null,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: data.reviewedAt ?? null,
    approvedBy: data.approvedBy ?? null,
    approvedAt: data.approvedAt ?? null,
    rejectionReason: data.rejectionReason ?? null,
    customAttributes: data.customAttributes
      ? JSON.stringify(data.customAttributes)
      : null,
    auditTrail: data.auditTrail ? JSON.stringify(data.auditTrail) : null,
  });
  };

export const buildUpdateProductionPlanPayload = (
  data: Partial<ProductionPlan>,
) =>
  sanitizePayload({
    name: data.name,
    unitId: data.unitId && isValidUUID(data.unitId) ? data.unitId : undefined,
    productId: data.productId && isValidUUID(data.productId) ? data.productId : undefined,
    plannedQuantity: data.plannedQuantity,
    toleranceLimit: data.toleranceLimit,
    startDate: data.startDate ? toISODateString(data.startDate) : undefined,
    endDate: data.endDate ? toISODateString(data.endDate) : undefined,
    tenantId: data.tenantId && isValidUUID(data.tenantId) ? data.tenantId : undefined,
    organizationId: data.organizationId && isValidUUID(data.organizationId) ? data.organizationId : undefined,
    planBasis: data.planBasis ?? null,
    usefulProductionTime:
      data.usefulProductionTime !== undefined
        ? data.usefulProductionTime
          ? JSON.stringify(data.usefulProductionTime)
          : null
        : undefined,
    recurrence: data.recurrence ?? null,
    dataEntryFrequency: data.dataEntryFrequency ?? null,
    status: data.status,
    actualQuantity: data.actualQuantity ?? null,
    shift: data.shift ?? null,
    crew: data.crew ?? null,
    plannerNotes: data.plannerNotes ?? null,
    comments:
      data.comments !== undefined
        ? data.comments
          ? JSON.stringify(data.comments)
          : null
        : undefined,
    approvalStatus: data.approvalStatus,
    submittedBy: data.submittedBy && isValidUUID(data.submittedBy) ? data.submittedBy : undefined,
    submittedAt: data.submittedAt ? toISODateString(data.submittedAt) : undefined,
    reviewedBy: data.reviewedBy && isValidUUID(data.reviewedBy) ? data.reviewedBy : undefined,
    reviewedAt: data.reviewedAt ? toISODateString(data.reviewedAt) : undefined,
    approvedBy: data.approvedBy && isValidUUID(data.approvedBy) ? data.approvedBy : undefined,
    approvedAt: data.approvedAt ? toISODateString(data.approvedAt) : undefined,
    rejectionReason: data.rejectionReason ?? null,
    customAttributes:
      data.customAttributes !== undefined
        ? data.customAttributes
          ? JSON.stringify(data.customAttributes)
          : null
        : undefined,
    auditTrail:
      data.auditTrail !== undefined
        ? data.auditTrail
          ? JSON.stringify(data.auditTrail)
          : null
        : undefined,
  });

/* -------------------------------------------------------------------------- */
/*                               Production Event                             */
/* -------------------------------------------------------------------------- */

export interface ProductionEventDto {
  id: string;
  eventId: string;
  planId?: string | null;
  unitId: string;
  assetId?: string | null;
  impactCodeId?: string | null;
  oeeCodeId?: string | null;
  description: string;
  startTime: string;
  endTime?: string | null;
  source: string;
  quantity?: number | null;
  cost?: number | null;
  status: string;
  rcaId?: string | null;
  eventType: string;
  parameter?: string | null;
  value?: number | null;
  limit?: number | null;
  limitType?: string | null;
  breachDuration?: number | null;
  solType?: string | null;
  apmType?: string | null;
  severity?: string | null;
  recommendedAction?: string | null;
  workOrderId?: string | null;
  failureMode?: string | null;
  defectiveQuantity?: number | null;
  shift?: string | null;
  crew?: string | null;
  auditTrail?: string | null;
  lossCategory?: string | null;
  operatorName?: string | null;
  reasonCodeId?: string | null;
  duration?: number | null;
  createdAt: string;
  updatedAt: string;
}

export const mapProductionEventDto = (dto: ProductionEventDto): ProductionEvent => ({
  id: dto.id,
  eventId: dto.eventId,
  planId: dto.planId ?? undefined,
  unitId: dto.unitId,
  assetId: dto.assetId ?? undefined,
  impactCodeId: dto.impactCodeId ?? undefined,
  oeeCodeId: dto.oeeCodeId ?? undefined,
  description: dto.description,
  startTime: toISOString(dto.startTime) ?? '',
  endTime: toISOString(dto.endTime),
  source: dto.source as ProductionEvent['source'],
  quantity: dto.quantity === null || dto.quantity === undefined ? undefined : Number(dto.quantity),
  cost: dto.cost === null || dto.cost === undefined ? undefined : Number(dto.cost),
  status: dto.status as ProductionEvent['status'],
  rcaId: dto.rcaId ?? undefined,
  eventType: dto.eventType as ProductionEvent['eventType'],
  parameter: dto.parameter ?? undefined,
  value: dto.value === null || dto.value === undefined ? undefined : Number(dto.value),
  limit: dto.limit === null || dto.limit === undefined ? undefined : Number(dto.limit),
  limitType: (dto.limitType ?? undefined) as ProductionEvent['limitType'],
  breachDuration:
    dto.breachDuration === null || dto.breachDuration === undefined
      ? undefined
      : Number(dto.breachDuration),
  solType: (dto.solType ?? undefined) as ProductionEvent['solType'],
  apmType: dto.apmType ?? undefined,
  severity: dto.severity as ProductionEvent['severity'] | undefined,
  recommendedAction: dto.recommendedAction ?? undefined,
  workOrderId: dto.workOrderId ?? undefined,
  failureMode: dto.failureMode ?? undefined,
  defectiveQuantity:
    dto.defectiveQuantity === null || dto.defectiveQuantity === undefined
      ? undefined
      : Number(dto.defectiveQuantity),
  shift: dto.shift ?? undefined,
  crew: dto.crew ?? undefined,
  auditTrail: parseAuditTrail(dto.auditTrail),
  lossCategory: dto.lossCategory ?? undefined,
  operatorName: dto.operatorName ?? undefined,
  reasonCodeId: dto.reasonCodeId ?? undefined,
  duration:
    dto.duration === null || dto.duration === undefined ? undefined : Number(dto.duration),
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

export const buildCreateProductionEventPayload = (
  data: Omit<ProductionEvent, 'id' | 'createdAt' | 'updatedAt'>,
) =>
  sanitizePayload({
    eventId: data.eventId,
    planId: data.planId ?? null,
    unitId: data.unitId,
    assetId: data.assetId ?? null,
    impactCodeId: data.impactCodeId ?? null,
    oeeCodeId: data.oeeCodeId ?? null,
    description: data.description,
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    source: data.source,
    quantity: data.quantity ?? null,
    cost: data.cost ?? null,
    status: data.status,
    rcaId: data.rcaId ?? null,
    eventType: data.eventType,
    parameter: data.parameter ?? null,
    value: data.value ?? null,
    limit: data.limit ?? null,
    limitType: data.limitType ?? null,
    breachDuration: data.breachDuration ?? null,
    solType: data.solType ?? null,
    apmType: data.apmType ?? null,
    severity: data.severity ?? null,
    recommendedAction: data.recommendedAction ?? null,
    workOrderId: data.workOrderId ?? null,
    failureMode: data.failureMode ?? null,
    defectiveQuantity: data.defectiveQuantity ?? null,
    shift: data.shift ?? null,
    crew: data.crew ?? null,
    lossCategory: data.lossCategory ?? null,
    operatorName: data.operatorName ?? null,
    reasonCodeId: data.reasonCodeId ?? null,
    duration: data.duration ?? null,
  });

export const buildUpdateProductionEventPayload = (
  data: Partial<ProductionEvent>,
) =>
  sanitizePayload({
    eventId: data.eventId,
    planId: data.planId ?? null,
    unitId: data.unitId,
    assetId: data.assetId ?? null,
    impactCodeId: data.impactCodeId ?? null,
    oeeCodeId: data.oeeCodeId ?? null,
    description: data.description,
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    source: data.source,
    quantity: data.quantity ?? null,
    cost: data.cost ?? null,
    status: data.status,
    rcaId: data.rcaId ?? null,
    eventType: data.eventType,
    parameter: data.parameter ?? null,
    value: data.value ?? null,
    limit: data.limit ?? null,
    limitType: data.limitType ?? null,
    breachDuration: data.breachDuration ?? null,
    solType: data.solType ?? null,
    apmType: data.apmType ?? null,
    severity: data.severity ?? null,
    recommendedAction: data.recommendedAction ?? null,
    workOrderId: data.workOrderId ?? null,
    failureMode: data.failureMode ?? null,
    defectiveQuantity: data.defectiveQuantity ?? null,
    shift: data.shift ?? null,
    crew: data.crew ?? null,
    lossCategory: data.lossCategory ?? null,
    operatorName: data.operatorName ?? null,
    reasonCodeId: data.reasonCodeId ?? null,
    duration: data.duration ?? null,
  });

/* -------------------------------------------------------------------------- */
/*                            Production Loss / OEE                           */
/* -------------------------------------------------------------------------- */

export interface ProductionLossDto {
  id: string;
  planId: string;
  period: string;
  actual: number;
  shortRangePlan: number;
  losses: number;
  unaccountedLoss: number;
  action: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export const mapProductionLossDto = (dto: ProductionLossDto): ProductionLoss => ({
  id: dto.id,
  planId: dto.planId,
  period: dto.period,
  actual: Number(dto.actual),
  shortRangePlan: Number(dto.shortRangePlan),
  losses: Number(dto.losses),
  unaccountedLoss: Number(dto.unaccountedLoss),
  action: dto.action as ProductionLoss['action'],
  tenantId: dto.tenantId,
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

export interface OEESummaryDto {
  id: string;
  planId: string;
  availability: number;
  performance: number;
  quality: number;
  overallOEE: number;
  period: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export const mapOEESummaryDto = (dto: OEESummaryDto): OEESummary => ({
  id: dto.id,
  planId: dto.planId,
  availability: Number(dto.availability),
  performance: Number(dto.performance),
  quality: Number(dto.quality),
  overallOEE: Number(dto.overallOEE),
  period: dto.period,
  tenantId: dto.tenantId,
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

/* -------------------------------------------------------------------------- */
/*                       Loss Categories & Reconcile Forms                    */
/* -------------------------------------------------------------------------- */

export interface LossCategoryDto {
  id: string;
  reconcileFormId: string;
  categoryName: string;
  lossAmount: number;
  impactCodeId: string;
  oeeCodeId: string;
  description: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export const mapLossCategoryDto = (dto: LossCategoryDto): LossCategory => ({
  id: dto.id,
  reconcileFormId: dto.reconcileFormId,
  categoryName: dto.categoryName,
  lossAmount: Number(dto.lossAmount),
  impactCodeId: dto.impactCodeId,
  oeeCodeId: dto.oeeCodeId,
  description: dto.description,
  tenantId: dto.tenantId,
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

export interface ReconcileFormDto {
  id: string;
  lossId: string;
  totalLossAmount: number;
  categorizedLossAmount: number;
  unaccountedLossAmount: number;
  productionEvent: string;
  comment: string;
  status: string;
  categories: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export const mapReconcileFormDto = (dto: ReconcileFormDto): ReconcileForm => ({
  id: dto.id,
  lossId: dto.lossId,
  totalLossAmount: Number(dto.totalLossAmount),
  categorizedLossAmount: Number(dto.categorizedLossAmount),
  unaccountedLossAmount: Number(dto.unaccountedLossAmount),
  productionEvent: dto.productionEvent,
  comment: dto.comment,
  status: dto.status as ReconcileForm['status'],
  categories: parseJson(dto.categories, [] as LossCategory[]),
  tenantId: dto.tenantId,
  createdAt: toISOString(dto.createdAt) ?? '',
  updatedAt: toISOString(dto.updatedAt) ?? '',
});

/* -------------------------------------------------------------------------- */
/*                                      RCA                                   */
/* -------------------------------------------------------------------------- */

export { buildCreateRcaPayload, buildUpdateRcaPayload, mapRcaDto } from './rca-v1-payload';
export type { RCADto } from './rca-v1-payload';

/* -------------------------------------------------------------------------- */
/*                                API METHODS                                 */
/* -------------------------------------------------------------------------- */

export const productionApi = {
  /* Templates */
  getProductionPlanTemplates(params?: { tenantId?: string }) {
    return httpClient.request<ProductionPlanTemplateDto[]>('production-plan-templates', {
      method: 'GET',
      query: params,
    });
  },

  getProductionPlanTemplate(id: string) {
    return httpClient.request<ProductionPlanTemplateDto>(`production-plan-templates/${id}`, {
      method: 'GET',
    });
  },

  createProductionPlanTemplate(payload: ReturnType<typeof buildCreateProductionPlanTemplatePayload>) {
    return httpClient.request<ProductionPlanTemplateDto>('production-plan-templates', {
      method: 'POST',
      body: payload,
    });
  },

  updateProductionPlanTemplate(
    id: string,
    payload: ReturnType<typeof buildUpdateProductionPlanTemplatePayload>,
  ) {
    return httpClient.request<ProductionPlanTemplateDto>(`production-plan-templates/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteProductionPlanTemplate(id: string) {
    return httpClient.request<void>(`production-plan-templates/${id}`, {
      method: 'DELETE',
    });
  },

  /* Plans */
  getProductionPlans(params?: { tenantId?: string; unitId?: string; status?: string }) {
    return httpClient.request<ProductionPlanDto[]>('production-plans', {
      method: 'GET',
      query: params,
    });
  },

  getProductionPlan(id: string) {
    return httpClient.request<ProductionPlanDto>(`production-plans/${id}`, {
      method: 'GET',
    });
  },

  createProductionPlan(payload: ReturnType<typeof buildCreateProductionPlanPayload>) {
    return httpClient.request<ProductionPlanDto>('production-plans', {
      method: 'POST',
      body: payload,
    });
  },

  updateProductionPlan(id: string, payload: ReturnType<typeof buildUpdateProductionPlanPayload>) {
    return httpClient.request<ProductionPlanDto>(`production-plans/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteProductionPlan(id: string) {
    return httpClient.request<void>(`production-plans/${id}`, {
      method: 'DELETE',
    });
  },

  /* Events */
  getProductionEvents(params?: { unitId?: string; tenantId?: string; status?: string }) {
    return httpClient.request<ProductionEventDto[]>('production-events', {
      method: 'GET',
      query: params,
    });
  },

  createProductionEvent(payload: ReturnType<typeof buildCreateProductionEventPayload>) {
    return httpClient.request<ProductionEventDto>('production-events', {
      method: 'POST',
      body: payload,
    });
  },

  updateProductionEvent(id: string, payload: ReturnType<typeof buildUpdateProductionEventPayload>) {
    return httpClient.request<ProductionEventDto>(`production-events/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteProductionEvent(id: string) {
    return httpClient.request<void>(`production-events/${id}`, {
      method: 'DELETE',
    });
  },

  /* Losses */
  getProductionLosses(params?: { planId?: string; tenantId?: string }) {
    return httpClient.request<ProductionLossDto[]>('production-losses', {
      method: 'GET',
      query: params,
    });
  },

  createProductionLoss(payload: Omit<ProductionLossDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<ProductionLossDto>('production-losses', {
      method: 'POST',
      body: payload,
    });
  },

  updateProductionLoss(id: string, payload: Partial<Omit<ProductionLossDto, 'id'>>) {
    return httpClient.request<ProductionLossDto>(`production-losses/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteProductionLoss(id: string) {
    return httpClient.request<void>(`production-losses/${id}`, {
      method: 'DELETE',
    });
  },

  /* OEE Summaries */
  getOeeSummaries(params?: { planId?: string; tenantId?: string; period?: string }) {
    return httpClient.request<OEESummaryDto[]>('oee-summaries', {
      method: 'GET',
      query: params,
    });
  },

  createOeeSummary(payload: Omit<OEESummaryDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<OEESummaryDto>('oee-summaries', {
      method: 'POST',
      body: payload,
    });
  },

  updateOeeSummary(id: string, payload: Partial<Omit<OEESummaryDto, 'id'>>) {
    return httpClient.request<OEESummaryDto>(`oee-summaries/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteOeeSummary(id: string) {
    return httpClient.request<void>(`oee-summaries/${id}`, {
      method: 'DELETE',
    });
  },

  /* Loss Categories */
  getLossCategories(params?: { reconcileFormId?: string; tenantId?: string }) {
    return httpClient.request<LossCategoryDto[]>('loss-categories', {
      method: 'GET',
      query: params,
    });
  },

  createLossCategory(payload: Omit<LossCategoryDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<LossCategoryDto>('loss-categories', {
      method: 'POST',
      body: payload,
    });
  },

  updateLossCategory(id: string, payload: Partial<Omit<LossCategoryDto, 'id'>>) {
    return httpClient.request<LossCategoryDto>(`loss-categories/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteLossCategory(id: string) {
    return httpClient.request<void>(`loss-categories/${id}`, {
      method: 'DELETE',
    });
  },

  /* Reconcile Forms */
  getReconcileForms(params?: { lossId?: string; status?: string }) {
    return httpClient.request<ReconcileFormDto[]>('reconcile-forms', {
      method: 'GET',
      query: params,
    });
  },

  createReconcileForm(payload: Omit<ReconcileFormDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<ReconcileFormDto>('reconcile-forms', {
      method: 'POST',
      body: payload,
    });
  },

  updateReconcileForm(id: string, payload: Partial<Omit<ReconcileFormDto, 'id'>>) {
    return httpClient.request<ReconcileFormDto>(`reconcile-forms/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteReconcileForm(id: string) {
    return httpClient.request<void>(`reconcile-forms/${id}`, {
      method: 'DELETE',
    });
  },

  /* RCA */
  getRcas(params?: { tenantId?: string; status?: string; priority?: string; teamLeadId?: string }) {
    return httpClient.request<RCADto[]>('rcas', {
      method: 'GET',
      query: params,
    });
  },

  getRca(id: string) {
    return httpClient.request<RCADto>(`rcas/${id}`, { method: 'GET' });
  },

  createRca(payload: ReturnType<typeof buildCreateRcaPayload>) {
    return httpClient.request<RCADto>('rcas', {
      method: 'POST',
      body: payload,
    });
  },

  updateRca(id: string, payload: ReturnType<typeof buildUpdateRcaPayload>) {
    return httpClient.request<RCADto>(`rcas/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteRca(id: string) {
    return httpClient.request<void>(`rcas/${id}`, {
      method: 'DELETE',
    });
  },
};


