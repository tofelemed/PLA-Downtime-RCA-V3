import { StreamRunRecord } from '../../plant-model/entities/stream-run.entity';
import { UnitStream } from '../../plant-model/entities/unit-stream.entity';
import {
  decimalText,
  VersionFields,
  versionFields,
} from '../profiles/profile-v2.view';

/** One version of a unit stream (SME E6); decimals as strings (API03). */
export interface UnitStreamV2View extends VersionFields {
  id: string;
  unitId: string;
  code: string;
  name: string;
  capacityShare: string;
  notes: string | null;
}

export function toUnitStreamView(row: UnitStream): UnitStreamV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    code: row.code,
    name: row.name,
    capacityShare: decimalText(row.capacityShare),
    notes: row.notes,
    ...versionFields(row),
  };
}

/** One stream run (SME E6): the product a stream ran and the lot it made. */
export interface StreamRunV2View {
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

export function toStreamRunView(row: StreamRunRecord): StreamRunV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    streamCode: row.streamCode,
    productId: row.productId,
    lotCode: row.lotCode,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime ? row.endTime.toISOString() : null,
    notes: row.notes,
    createdBy: row.createdBy,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
