import type { KpiAggregateView, ReliabilityRowView } from './reports';

/** Operating report views R1–R12 (backend `src/v2/ops-reports/`); every quantity is a decimal string. */
export interface ProductionRowView {
  /** `total`, the plant day / week / month, or the unit id */
  key: string;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  uom: string | null;
  capacity: string | null;
  target: string | null;
  actual: string | null;
  gross: string | null;
  good: string | null;
  prime: string | null;
  wideSpec: string | null;
  downgrade: string | null;
  transitionOffGrade: string | null;
  scrap: string | null;
  rework: string | null;
  unclassified: string | null;
  recovered: string | null;
  /** downgrade + transition off-grade + scrap + rework + unclassified (server sum) */
  offGrade: string | null;
  primeYield: string | null;
  planAttainment: string | null;
  slices: number;
  completeSlices: number;
}

export interface ProductionByProductView {
  groupBy: 'total' | 'day' | 'week' | 'month' | 'unit';
  rows: ProductionRowView[];
  calculationRunIds: string[];
}

export interface EventStatusRowView {
  physicalType: string;
  events: number;
  open: number;
  uncoded: number;
  coded: number;
  verified: number;
  seconds: string;
  uncodedSeconds: string;
  oldestUncodedEnd: string | null;
}

export interface EventStatusView {
  rows: EventStatusRowView[];
  asOf: string;
}

export interface ShiftInstanceView {
  unitId: string;
  unitName: string | null;
  crewName: string | null;
  from: string;
  to: string;
  excluded: boolean;
}

export interface HandoverEventView {
  id: string;
  unitId: string;
  unitName: string | null;
  physicalType: string;
  open: boolean;
  codingState: string;
  verified: boolean;
  start: string;
  end: string | null;
  seconds: string | null;
  reason: string | null;
  asset: string | null;
  fromProduct: string | null;
  toProduct: string | null;
  description: string | null;
}

export interface ShiftNoteView {
  id: string;
  unitId: string;
  localDate: string;
  shiftName: string;
  body: string;
  createdAt: string;
  createdBy: string | null;
  authorName: string | null;
}

export interface ShiftHandoverView {
  localDate: string;
  shiftName: string;
  from: string | null;
  to: string | null;
  instances: ShiftInstanceView[];
  production: ProductionRowView[];
  eventStatus: EventStatusRowView[];
  events: HandoverEventView[];
  eventsTruncated: boolean;
  notes: ShiftNoteView[];
  calculationRunIds: string[];
}

export interface RestatementRowView {
  periodId: string;
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string | null;
  revision: number;
  approvedAt: string | null;
  afterClose: boolean;
  treatment: string | null;
  postingDate: string | null;
  uom: string | null;
  goodBefore: string | null;
  goodAfter: string | null;
  goodDelta: string | null;
}

export interface RestatementsView {
  rows: RestatementRowView[];
  truncated: boolean;
}

export interface DispositionGroupView {
  dispositionClass: string;
  state: string;
  productId: string | null;
  productCode: string | null;
  uom: string;
  lots: number;
  quantity: string;
}

export interface QualityDispositionsView {
  groups: DispositionGroupView[];
  pending: number;
  oldestPendingAt: string | null;
}

export interface TransitionRowView {
  eventId: string;
  unitId: string;
  unitName: string | null;
  start: string;
  end: string | null;
  seconds: string | null;
  fromProductId: string | null;
  fromProduct: string | null;
  toProductId: string | null;
  toProduct: string | null;
  catalystFamily: string | null;
  operatingMode: string | null;
  standardId: string | null;
  referenceSeconds: string | null;
  referenceOffgrade: string | null;
  excessSeconds: string | null;
  uom: string | null;
  allowanceLoss: string | null;
  excessLoss: string | null;
  offGrade: string | null;
  noStandard: boolean;
  calculated: boolean;
}

export interface TransitionPairView {
  fromProductId: string | null;
  fromProduct: string | null;
  toProductId: string | null;
  toProduct: string | null;
  transitions: number;
  ended: number;
  meanSeconds: string | null;
  bestSeconds: string | null;
  worstSeconds: string | null;
  withStandard: number;
  overStandard: number;
  meanExcessSeconds: string | null;
}

export interface TransitionPerformanceView {
  transitions: TransitionRowView[];
  truncated: boolean;
  pairs: TransitionPairView[];
}

export interface ReliabilityMonthView {
  month: string;
  row: ReliabilityRowView;
}

export interface ReliabilitySeriesView {
  unitId: string;
  assetId: string | null;
  label: string | null;
  months: ReliabilityMonthView[];
  fallingMtbf: boolean;
}

export interface ReliabilityTrendView {
  months: string[];
  units: ReliabilitySeriesView[];
  assets: ReliabilitySeriesView[];
  failureDefinition: string;
  calculationRunIds: string[];
}

export type Quadrant = 'chronic' | 'sporadic' | 'major' | 'minor';

export interface ChronicRowView {
  key: string | null;
  label: string | null;
  stops: string;
  seconds: string;
  meanSeconds: string | null;
  quadrant: Quadrant | null;
}

export interface ChronicSporadicView {
  groupBy: 'reason' | 'asset';
  rows: ChronicRowView[];
  truncated: boolean;
  medianStops: string | null;
  medianMeanSeconds: string | null;
  calculationRunIds: string[];
}

export interface RateLossMonthView {
  month: string;
  equivalentDowntime: KpiAggregateView;
  performance: KpiAggregateView;
}

export interface RateLossView {
  months: RateLossMonthView[];
  total: { equivalentDowntime: KpiAggregateView; performance: KpiAggregateView };
  calculationRunIds: string[];
}

export interface ComplianceRowView {
  key: string | null;
  label: string | null;
  stops: number;
  coded: number;
  verified: number;
  medianDelaySeconds: string | null;
  p90DelaySeconds: string | null;
  codedDowntimeRatio: KpiAggregateView;
  stateCoverage: KpiAggregateView;
}

export interface CodingComplianceView {
  byCrew: ComplianceRowView[];
  byShift: ComplianceRowView[];
  calculationRunIds: string[];
}

export interface CountView {
  key: string;
  count: number;
}

export interface RcaActionTrackerView {
  openCases: { total: number; overdue: number; byStatus: CountView[]; byAge: CountView[] };
  openActions: { total: number; byDue: CountView[]; byAge: CountView[] };
  closedActions: { done: number; withDueDate: number; onTime: number; late: number; onTimeRate: string | null };
  closedCases: { closed: number; meanDaysToClose: string | null };
  asOf: string;
}
