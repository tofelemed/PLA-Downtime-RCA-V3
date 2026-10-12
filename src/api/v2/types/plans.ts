/**
 * Versioned production plans, previews and scenarios (backend `src/v2/plans/plan-v2.view.ts`, plan 2.3).
 * Targets and capacities are decimal strings; unlike quantity units are never added (`totals` per unit).
 */
export const PLAN_BASES = ['time', 'quantity', 'manual'] as const;
export type PlanBasis = (typeof PLAN_BASES)[number];

export const DISTRIBUTIONS = ['scheduled_capacity', 'explicit_weights', 'equal'] as const;
export type Distribution = (typeof DISTRIBUTIONS)[number];

export type ApprovalState = 'draft' | 'submitted' | 'approved' | 'superseded';
export type SliceStream = 'sequential' | 'independent' | 'shared';

export interface PlanWarning {
  code: string;
  at?: string;
  sliceKey?: string;
  detail?: string;
}

export interface GenerationFailure {
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface PlanSliceView {
  id: string;
  position: number;
  productId: string;
  profileId: string | null;
  campaignFrom: string | null;
  campaignTo: string | null;
  weight: string | null;
  target: string | null;
  stream: SliceStream;
  activeFrom: string;
  activeTo: string;
}

export interface PlanVersionView {
  id: string;
  planId: string;
  version: number;
  scenarioId: string;
  unitId: string;
  validFrom: string;
  validTo: string;
  basis: PlanBasis;
  headerTarget: string | null;
  targetSource: string;
  distribution: Distribution;
  approvalState: ApprovalState;
  /** author of the draft (separation of duties); optional until every server view carries it */
  createdBy?: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  supersedesVersionId: string | null;
  calendarVersionId: string | null;
  changeReason: string | null;
  manualTargets: Array<{ slicePosition: number; utcStart: string; target: string }> | null;
  periodsGeneratedAt: string | null;
  generationWarnings: PlanWarning[];
  generationError: GenerationFailure | null;
  /** present on single-version reads, absent in the history list */
  slices?: PlanSliceView[];
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanView {
  id: string;
  name: string;
  scenarioId: string | null;
  currentVersion: number | null;
  legacyId: string | null;
  recurrence: string | null;
  dataEntryFrequency: string | null;
  status: string | null;
  /** review of the open version: who submitted it, who returned it to its author and why */
  review?: PlanReviewView | null;
  version: PlanVersionView;
}

export interface PlanReviewView {
  submittedBy: string | null;
  submittedAt: string | null;
  returnedBy: string | null;
  returnedAt: string | null;
  returnReason: string | null;
}

export interface PlanPeriodView {
  id: string | null;
  sliceId: string;
  productId?: string;
  unitId: string;
  shiftInstanceId: string | null;
  calendarVersionId: string | null;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string;
  scheduledSeconds: number;
  target: string;
  planningCapacityQty: string | null;
  sustainedCapacityQty: string | null;
  quantityUom: string | null;
  profileId: string | null;
  planningRateVersionId: string | null;
  sustainedRateVersionId: string | null;
  isExcluded: boolean;
  exclusionKind: string | null;
}

export interface UomTotal {
  quantityUom: string | null;
  target: string;
}

export interface PlanPreviewView {
  version: number;
  distribution: Distribution;
  headerTarget: string | null;
  totals: UomTotal[];
  periods: PlanPeriodView[];
  warnings: PlanWarning[];
}

export interface PlanScenarioView {
  id: string;
  name: string;
  description: string | null;
  isAccountingBaseline: boolean;
  rowVersion: number;
  createdAt: string;
}

export interface PlanGenerationJobView {
  id: string;
  planId: string;
  planVersionId: string;
  version: number;
  state: 'queued' | 'running' | 'completed' | 'failed';
  result: { periods?: number; headerTarget?: string | null; [key: string]: unknown } | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** `details.conflicts[]` of 409 PLAN_OVERLAP. */
export interface PlanConflict {
  planId: string;
  version: number;
  productId: string;
  activeFrom: string;
  activeTo: string;
}

/** `GET /api/v2/products` item (backend `src/v2/products/product-v2.view.ts`, plan 3.4). */
export interface ProductView {
  id: string;
  code: string;
  name: string;
  uom: string | null;
  isActive: boolean;
}
