import {
  PeriodFinding,
  SourceSegment,
} from '../../domain/actuals/period/period-actuals.types';
import { ActualsAdjustment } from '../../periods/entities/actuals-adjustment.entity';
import { ActualsJob } from '../../periods/entities/actuals-job.entity';
import { ActualsResult } from '../../periods/entities/actuals-result.entity';
import { ExternalProductionReport } from '../../periods/entities/external-production-report.entity';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import {
  PeriodWarning,
  ProductionPeriod,
} from '../../periods/entities/production-period.entity';
import { decimalView } from '../plans/plan-v2.view';

const iso = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

/** Authoritative summary of one slice (current actuals run). */
export interface SliceActualsV2View {
  gross: string | null;
  good: string | null;
  reject: string | null;
  reworkAccepted: string | null;
  uom: string | null;
  basis: string;
  method: string | null;
  coverageRatio: string | null;
  measuredQty: string | null;
  estimatedQty: string | null;
  qualityState: string;
}

export interface SliceActualsDetailV2View extends SliceActualsV2View {
  resultId: string;
  sourceSegments: SourceSegment[];
  exceptions: PeriodFinding[];
  coverage: ActualsResult['coverage'];
  adjustmentIds: string[];
  computedAt: string;
}

export interface PeriodSliceV2View {
  id: string;
  productId: string;
  profileId: string | null;
  planPeriodId: string | null;
  source: string;
  windowFrom: string;
  windowTo: string;
  campaignFrom: string | null;
  campaignTo: string | null;
  quantityUom: string | null;
  actualsPolicyId: string | null;
  actuals: SliceActualsV2View | null;
}

export interface PeriodV2View {
  id: string;
  unitId: string;
  shiftInstanceId: string | null;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string | null;
  isExcluded: boolean;
  exclusionKind: string | null;
  selectedPlanVersionId: string | null;
  stateReadiness: string;
  currentActualsRunId: string | null;
  warnings: PeriodWarning[];
  slices: PeriodSliceV2View[];
}

export interface PeriodDetailV2View extends Omit<PeriodV2View, 'slices'> {
  slices: Array<
    Omit<PeriodSliceV2View, 'actuals'> & {
      actuals: SliceActualsDetailV2View | null;
    }
  >;
  adjustments: AdjustmentV2View[];
}

export interface AdjustmentV2View {
  id: string;
  sliceId: string;
  periodId: string;
  unitId: string;
  kind: string;
  quantity: string | null;
  uom: string | null;
  basis: string;
  reason: string;
  evidenceRef: string;
  windowFrom: string | null;
  windowTo: string | null;
  authorId: string;
  state: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export function toSummary(result: ActualsResult): SliceActualsV2View {
  return {
    gross: decimalView(result.gross),
    good: decimalView(result.good),
    reject: decimalView(result.reject),
    reworkAccepted: decimalView(result.reworkAccepted),
    uom: result.uom,
    basis: result.basis,
    method: result.method,
    coverageRatio: decimalView(result.coverageRatio),
    measuredQty: decimalView(result.measuredQty),
    estimatedQty: decimalView(result.estimatedQty),
    qualityState: result.qualityState,
  };
}

export function toDetail(result: ActualsResult): SliceActualsDetailV2View {
  return {
    ...toSummary(result),
    resultId: result.id,
    sourceSegments: result.sourceSegments,
    exceptions: result.exceptions,
    coverage: result.coverage,
    adjustmentIds: result.adjustmentIds,
    computedAt: result.computedAt.toISOString(),
  };
}

export function toSliceView<T>(
  slice: PeriodProductSlice,
  actuals: T | null,
): Omit<PeriodSliceV2View, 'actuals'> & { actuals: T | null } {
  return {
    id: slice.id,
    productId: slice.productId,
    profileId: slice.profileId,
    planPeriodId: slice.planPeriodId,
    source: slice.source,
    windowFrom: slice.windowFrom.toISOString(),
    windowTo: slice.windowTo.toISOString(),
    campaignFrom: iso(slice.campaignFrom),
    campaignTo: iso(slice.campaignTo),
    quantityUom: slice.quantityUom,
    actualsPolicyId: slice.actualsPolicyId,
    actuals,
  };
}

export function toPeriodBase(
  period: ProductionPeriod,
): Omit<PeriodV2View, 'slices'> {
  return {
    id: period.id,
    unitId: period.unitId,
    shiftInstanceId: period.shiftInstanceId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    localDate: period.localDate,
    shiftName: period.shiftName,
    isExcluded: period.isExcluded,
    exclusionKind: period.exclusionKind,
    selectedPlanVersionId: period.selectedPlanVersionId,
    stateReadiness: period.stateReadiness,
    currentActualsRunId: period.currentActualsRunId,
    warnings: period.warnings,
  };
}

export function toAdjustmentView(
  adjustment: ActualsAdjustment,
): AdjustmentV2View {
  return {
    id: adjustment.id,
    sliceId: adjustment.sliceId,
    periodId: adjustment.periodId,
    unitId: adjustment.unitId,
    kind: adjustment.kind,
    quantity: decimalView(adjustment.quantity),
    uom: adjustment.uom,
    basis: adjustment.basis,
    reason: adjustment.reason,
    evidenceRef: adjustment.evidenceRef,
    windowFrom: iso(adjustment.windowFrom),
    windowTo: iso(adjustment.windowTo),
    authorId: adjustment.authorId,
    state: adjustment.state,
    decidedBy: adjustment.decidedBy,
    decidedAt: iso(adjustment.decidedAt),
    decisionReason: adjustment.decisionReason,
    createdAt: adjustment.createdAt.toISOString(),
  };
}

export interface ExternalReportV2View {
  id: string;
  externalReportId: string;
  externalRevision: string;
  siteId: string;
  localProductionDate: string;
  timezone: string;
  utcStart: string;
  utcEnd: string;
  basis: string;
  lines: ExternalProductionReport['lines'];
  sourceStatus: string;
  /** SME R13: source system, the status mapping version that decided eligibility, release time at source */
  sourceSystem: string;
  statusMappingId: string | null;
  certifiedEligible: boolean;
  approvedAtSource: string | null;
  evidenceRef: string | null;
  state: string;
  supersededById: string | null;
  importedAt: string;
  outcome?: string;
}

export function toReportView(
  report: ExternalProductionReport,
  outcome?: string,
): ExternalReportV2View {
  return {
    id: report.id,
    externalReportId: report.externalReportId,
    externalRevision: report.externalRevision,
    siteId: report.siteId,
    localProductionDate: report.localProductionDate,
    timezone: report.timezone,
    utcStart: report.utcStart.toISOString(),
    utcEnd: report.utcEnd.toISOString(),
    basis: report.basis,
    lines: report.lines,
    sourceStatus: report.sourceStatus,
    sourceSystem: report.sourceSystem,
    statusMappingId: report.statusMappingId,
    certifiedEligible: report.certifiedEligible,
    approvedAtSource: iso(report.approvedAtSource),
    evidenceRef: report.evidenceRef,
    state: report.state,
    supersededById: report.supersededById,
    importedAt: report.importedAt.toISOString(),
    ...(outcome ? { outcome } : {}),
  };
}

export interface ActualsJobV2View {
  id: string;
  kind: string;
  state: string;
  periodId: string | null;
  trigger: string;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
}

export function toActualsJobView(job: ActualsJob): ActualsJobV2View {
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    periodId: job.periodId,
    trigger: job.request.trigger,
    result: job.result,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    attempts: job.attempts,
    createdAt: job.createdAt.toISOString(),
    finishedAt: iso(job.finishedAt),
  };
}
