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

/** A route of the material-flow map (SME E2): `fromUnitId` feeds `toUnitId`, optionally through a buffer. */
export interface FlowRouteView extends VersionFields {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  routeRole: 'feed' | 'alternate';
  yieldFactor: string;
  bufferName: string | null;
  usableInventory: string | null;
  minOperatingLevel: string | null;
  maxOperatingLevel: string | null;
  inventoryUom: string | null;
  /** downstream draw from the buffer, inventory unit per hour */
  drawRatePerHour: string | null;
  notes: string | null;
}

/** A recorded level of a route's buffer (SME E2). */
export interface BufferLevelView {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  observedAt: string;
  level: string;
  uom: string;
  source: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}
