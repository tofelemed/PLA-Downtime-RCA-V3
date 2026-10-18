/** Period views (backend `src/v2/periods/period-v2.view.ts`); quantities are decimal strings. */
export interface SliceActualsView {
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
  /** SME E3 class breakdown; null / absent = no disposition or rework acceptance recorded */
  qualityClasses?: QualityClassesView | null;
  /** SME E7: a lower-ranked source or the approved estimate gave the actuals; null / absent = the top rank */
  substitution?: SourceSubstitutionView | null;
}

/** A ranked measurement source (backend `period-actuals.types.ts` RankedSourceRef). */
export interface RankedSourceView {
  rank: number;
  /** calibrated_primary | redundant_measurement | reconciled_record | approved_estimate; null = older version */
  sourceClass: string | null;
  source: string;
  boundary: string | null;
}

/** SME E7 substitution flag of a slice (server-decided). */
export interface SourceSubstitutionView {
  used: RankedSourceView & { label: string };
  replaced: RankedSourceView;
  /** primary_missing | primary_stale | primary_bad_quality | no_measured_source */
  reason: string;
  crossBoundary: { fromBoundary: string | null; lagSeconds: number; evidenceRef: string } | null;
}

/** SME E3: quantities of a slice by product disposition (backend `quality-classes.ts`), decimal strings. */
export interface QualityClassesView {
  firstPassGood: string | null;
  wideSpec: string;
  downgrade: string;
  transitionOffGrade: string;
  scrap: string;
  rework: string;
  unclassified: string | null;
  recovered: string;
  reprocessedInput: string;
  dispositionIds: string[];
}

/** A lot disposition or recovery movement (`/v2/lot-dispositions`). */
export interface LotDispositionView {
  id: string;
  unitId: string;
  productId: string;
  lotCode: string;
  dispositionClass: string;
  quantity: string;
  uom: string;
  productionStart: string;
  productionEnd: string;
  labReleasedAt: string | null;
  recoveryOfId: string | null;
  remeasured: boolean;
  productionEventId: string | null;
  supersedesId: string | null;
  reason: string | null;
  evidenceRef: string | null;
  state: string;
  authorId: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  supersededAt: string | null;
  createdAt: string;
  rowVersion: number;
}

export interface PeriodSliceView {
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
  actuals: SliceActualsView | null;
}

export interface PeriodWarningView {
  code: string;
  message?: string;
}

export interface ProductionPeriodView {
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
  /** plan of the selected plan version (null = none selected); absent on older servers */
  planId?: string | null;
  stateReadiness: string;
  currentActualsRunId: string | null;
  warnings: PeriodWarningView[];
  slices: PeriodSliceView[];
}

export interface SourceSegmentView {
  source: string;
  from: string;
  to: string;
  quantity: string | null;
  method: string;
  quality: 'measured' | 'estimated' | 'excluded' | 'missing';
}

export interface PeriodFindingView {
  code: string;
  severity: 'problem' | 'info';
  from?: string;
  to?: string;
  detail?: Record<string, unknown>;
}

export interface SliceActualsDetailView extends SliceActualsView {
  resultId: string;
  sourceSegments: SourceSegmentView[];
  exceptions: PeriodFindingView[];
  adjustmentIds: string[];
  computedAt: string;
}

export interface PeriodAdjustmentView {
  id: string;
  sliceId: string;
  kind: string;
  quantity: string | null;
  uom: string | null;
  basis: string;
  reason: string;
  evidenceRef: string;
  state: string;
  authorId: string;
  decidedBy: string | null;
}

/** `GET /production-periods/{id}` (data of the analytics envelope): slices with actuals provenance. */
export interface PeriodDetailView extends Omit<ProductionPeriodView, 'slices'> {
  slices: Array<Omit<PeriodSliceView, 'actuals'> & { actuals: SliceActualsDetailView | null }>;
  adjustments: PeriodAdjustmentView[];
}
