import type { VersionFields } from './profiles';

/**
 * Plant model (backend `src/v2/plant-model/*.view.ts`, SME E6): streams of a unit (parallel trains or
 * lines) and the products they run. Decimals are strings; instants ISO 8601 UTC; half-open intervals.
 */
export interface UnitStreamView extends VersionFields {
  id: string;
  unitId: string;
  code: string;
  name: string;
  /** share of the unit's rate the stream provides, (0, 1] */
  capacityShare: string;
  notes: string | null;
}

/** Which product a stream ran over `[startTime, endTime)` and the lot it made (null end = running). */
export interface StreamRunView {
  id: string;
  unitId: string;
  streamCode: string;
  productId: string;
  lotCode: string | null;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  createdBy: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}
