import { BufferLevelRecord } from '../../plant-model/entities/buffer-level.entity';
import { PlantFlowRoute } from '../../plant-model/entities/plant-flow-route.entity';
import {
  decimalText,
  VersionFields,
  versionFields,
} from '../profiles/profile-v2.view';

const decimalOrNull = (value: string | null) =>
  value === null ? null : decimalText(value);

/** One version of a material-flow route (SME E2); decimals as strings (API03). */
export interface FlowRouteV2View extends VersionFields {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  routeRole: string;
  yieldFactor: string;
  bufferName: string | null;
  usableInventory: string | null;
  minOperatingLevel: string | null;
  maxOperatingLevel: string | null;
  inventoryUom: string | null;
  drawRatePerHour: string | null;
  notes: string | null;
}

export function toFlowRouteView(row: PlantFlowRoute): FlowRouteV2View {
  return {
    id: row.id,
    fromUnitId: row.fromUnitId,
    toUnitId: row.toUnitId,
    routeRole: row.routeRole,
    yieldFactor: decimalText(row.yieldFactor),
    bufferName: row.bufferName,
    usableInventory: decimalOrNull(row.usableInventory),
    minOperatingLevel: decimalOrNull(row.minOperatingLevel),
    maxOperatingLevel: decimalOrNull(row.maxOperatingLevel),
    inventoryUom: row.inventoryUom,
    drawRatePerHour: decimalOrNull(row.drawRatePerHour),
    notes: row.notes,
    ...versionFields(row),
  };
}

/** One recorded buffer level (SME E2). */
export interface BufferLevelV2View {
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

export function toBufferLevelView(row: BufferLevelRecord): BufferLevelV2View {
  return {
    id: row.id,
    fromUnitId: row.fromUnitId,
    toUnitId: row.toUnitId,
    observedAt: row.observedAt.toISOString(),
    level: decimalText(row.level),
    uom: row.uom,
    source: row.source,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
