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
