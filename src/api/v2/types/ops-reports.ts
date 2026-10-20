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
