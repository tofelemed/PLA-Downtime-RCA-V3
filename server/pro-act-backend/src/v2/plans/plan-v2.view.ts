import { formatDec, toDec } from '../../domain/actuals/decimal';
import {
  GeneratedPeriod,
  GenerationResult,
  PlanWarning,
  UomTotal,
} from '../../domain/plans/plan.types';
import { ProductionPlan } from '../../production-plan/production-plan.entity';
import {
  GenerationJobResult,
  PlanGenerationJob,
} from '../../plans/entities/plan-generation-job.entity';
import { PlanProductSlice } from '../../plans/entities/plan-product-slice.entity';
import { PlanScenario } from '../../plans/entities/plan-scenario.entity';
import {
  GenerationFailure,
  PlanVersion,
  StoredManualTarget,
} from '../../plans/entities/plan-version.entity';

const iso = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

/** Stored decimals in one canonical form ("100", not "100.00000000"), whatever the driver returned. */
export function decimalView(value: string | null): string | null {
  const parsed = toDec(value);
  return parsed === null ? null : formatDec(parsed);
}

export interface PlanSliceV2View {
  id: string;
  position: number;
  productId: string;
  profileId: string | null;
  campaignFrom: string | null;
  campaignTo: string | null;
  weight: string | null;
  target: string | null;
  stream: string;
  activeFrom: string;
  activeTo: string;
}

export interface PlanVersionV2View {
  id: string;
  planId: string;
  version: number;
  scenarioId: string;
  unitId: string;
  validFrom: string;
  validTo: string;
  basis: string;
  headerTarget: string | null;
  targetSource: string;
  distribution: string;
  approvalState: string;
  /** the version's author (its creator): requires another approver unless SuperAdmin (403 SEPARATION_OF_DUTIES) */
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  supersedesVersionId: string | null;
  calendarVersionId: string | null;
  changeReason: string | null;
  manualTargets: StoredManualTarget[] | null;
  periodsGeneratedAt: string | null;
  generationWarnings: PlanWarning[];
  generationError: GenerationFailure | null;
  slices?: PlanSliceV2View[];
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanV2View {
  id: string;
  name: string;
  scenarioId: string | null;
  currentVersion: number | null;
  legacyId: string | null;
  /** v1 header fields kept for the legacy screens */
  recurrence: string | null;
  dataEntryFrequency: string | null;
  status: string | null;
  /** review of the open version: who submitted it, and who returned it to its author and why */
  review: PlanReviewV2View;
  version: PlanVersionV2View;
}

export interface PlanReviewV2View {
  submittedBy: string | null;
  submittedAt: string | null;
  returnedBy: string | null;
  returnedAt: string | null;
  returnReason: string | null;
}

/** The plan header's review columns (written from the identity by the review commands). */
function reviewOf(plan: ProductionPlan): PlanReviewV2View {
  const returned = Boolean(plan.rejectionReason);
  return {
    submittedBy: plan.submittedBy ?? null,
    submittedAt: iso(plan.submittedAt),
    returnedBy: returned ? (plan.reviewedBy ?? null) : null,
    returnedAt: returned ? iso(plan.reviewedAt) : null,
    returnReason: plan.rejectionReason ?? null,
  };
}

export interface PlanPeriodV2View {
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

export interface PlanPreviewV2View {
  version: number;
  distribution: string;
  headerTarget: string | null;
  /** Σ target per quantity unit; unlike units are never added (PLAN05) */
  totals: UomTotal[];
  periods: PlanPeriodV2View[];
  warnings: PlanWarning[];
}

export interface PlanScenarioV2View {
  id: string;
  name: string;
  description: string | null;
  isAccountingBaseline: boolean;
  rowVersion: number;
  createdAt: string;
}

export interface PlanGenerationJobV2View {
  id: string;
  planId: string;
  planVersionId: string;
  version: number;
  state: string;
  result: GenerationJobResult | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export function toSliceView(slice: PlanProductSlice): PlanSliceV2View {
  return {
    id: slice.id,
    position: slice.position,
    productId: slice.productId,
    profileId: slice.profileId,
    campaignFrom: iso(slice.campaignFrom),
    campaignTo: iso(slice.campaignTo),
    weight: decimalView(slice.weight),
    target: decimalView(slice.target),
    stream: slice.stream,
    activeFrom: slice.activeFrom.toISOString(),
    activeTo: slice.activeTo.toISOString(),
  };
}

export function toVersionView(
  version: PlanVersion,
  slices?: readonly PlanProductSlice[],
): PlanVersionV2View {
  return {
    id: version.id,
    planId: version.planId,
    version: version.version,
    scenarioId: version.scenarioId,
    unitId: version.unitId,
    validFrom: version.validFrom.toISOString(),
    validTo: version.validTo.toISOString(),
    basis: version.basis,
    headerTarget: decimalView(version.headerTarget),
    targetSource: version.targetSource,
    distribution: version.distribution,
    approvalState: version.approvalState,
    createdBy: version.createdBy,
    approvedBy: version.approvedBy,
    approvedAt: iso(version.approvedAt),
    supersedesVersionId: version.supersedesVersionId,
    calendarVersionId: version.calendarVersionId,
    changeReason: version.changeReason,
    manualTargets: version.manualTargets,
    periodsGeneratedAt: iso(version.periodsGeneratedAt),
    generationWarnings: version.generationWarnings ?? [],
    generationError: version.generationError,
    ...(slices ? { slices: slices.map(toSliceView) } : {}),
    rowVersion: version.rowVersion,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

export function toPlanView(
  plan: ProductionPlan,
  version: PlanVersion,
  slices?: readonly PlanProductSlice[],
): PlanV2View {
  return {
    id: plan.id,
    name: plan.name,
    scenarioId: plan.scenarioId ?? null,
    currentVersion: plan.currentVersion ?? null,
    legacyId: plan.legacyId ?? null,
    recurrence: plan.recurrence ?? null,
    dataEntryFrequency: plan.dataEntryFrequency ?? null,
    status: plan.status ?? null,
    review: reviewOf(plan),
    version: toVersionView(version, slices),
  };
}

function previewPeriod(
  period: GeneratedPeriod,
  unitId: string,
): PlanPeriodV2View {
  return {
    id: null,
    sliceId: period.sliceKey,
    productId: period.productId,
    unitId,
    shiftInstanceId: period.leaf.shiftInstanceId,
    calendarVersionId: period.leaf.calendarVersionId,
    utcStart: period.leaf.start.toISOString(),
    utcEnd: period.leaf.end.toISOString(),
    localDate: period.leaf.localDate,
    shiftName: period.leaf.shiftName,
    scheduledSeconds: period.scheduledSeconds,
    target: period.target,
    planningCapacityQty: period.planningCapacity,
    sustainedCapacityQty: period.sustainedCapacity,
    quantityUom: period.rates.quantityUom,
    profileId: period.rates.profileId,
    planningRateVersionId: period.rates.planning?.id ?? null,
    sustainedRateVersionId: period.rates.sustained?.id ?? null,
    isExcluded: period.leaf.isExcluded,
    exclusionKind: period.leaf.exclusionKind,
  };
}

export function toPreviewView(
  version: PlanVersion,
  distribution: string,
  result: GenerationResult,
): PlanPreviewV2View {
  return {
    version: version.version,
    distribution,
    headerTarget: result.headerTarget,
    totals: result.totals,
    periods: result.periods.map((period) =>
      previewPeriod(period, version.unitId),
    ),
    warnings: result.warnings,
  };
}

export function toScenarioView(scenario: PlanScenario): PlanScenarioV2View {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    isAccountingBaseline: scenario.isAccountingBaseline,
    rowVersion: scenario.rowVersion,
    createdAt: scenario.createdAt.toISOString(),
  };
}

export function toJobView(job: PlanGenerationJob): PlanGenerationJobV2View {
  return {
    id: job.id,
    planId: job.planId,
    planVersionId: job.planVersionId,
    version: job.request.version,
    state: job.state,
    result: job.result,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    finishedAt: iso(job.finishedAt),
  };
}
