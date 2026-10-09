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
  stateReadiness: string;
  currentActualsRunId: string | null;
  warnings: PeriodWarningView[];
  slices: PeriodSliceView[];
}
