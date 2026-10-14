import { StandbyMetrics } from '../../domain/reliability/standby-metrics';
import { StandbyEquipment } from '../../reliability/entities/standby-equipment.entity';
import { StandbyRecord } from '../../reliability/entities/standby-record.entity';
import { toIso } from './reliability-v2-common';

export interface StandbyEquipmentV2View {
  id: string;
  assetId: string;
  unitId: string;
  evaluation: StandbyEquipment['evaluation'];
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  rowVersion: number;
}

export interface StandbyRecordV2View {
  id: string;
  assetId: string;
  unitId: string;
  kind: StandbyRecord['recordKind'];
  startedAt: string;
  endedAt: string | null;
  outcome: StandbyRecord['outcome'];
  eventId: string | null;
  externalRef: string | null;
  notes: string | null;
}

/** `GET /v2/standby-equipment/metrics` item: SME D9 measures of one registered standby asset. */
export interface StandbyMetricsV2View extends StandbyMetrics {
  assetId: string;
  unitId: string;
  evaluation: StandbyEquipment['evaluation'];
}

export interface StandbyImportV2View {
  total: number;
  created: number;
  updated: number;
}

export function toStandbyEquipmentView(
  row: StandbyEquipment,
): StandbyEquipmentV2View {
  return {
    id: row.id,
    assetId: row.assetId,
    unitId: row.unitId,
    evaluation: row.evaluation,
    notes: row.notes,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: toIso(row.effectiveTo),
    rowVersion: row.rowVersion,
  };
}

export function toStandbyRecordView(row: StandbyRecord): StandbyRecordV2View {
  return {
    id: row.id,
    assetId: row.assetId,
    unitId: row.unitId,
    kind: row.recordKind,
    startedAt: row.startedAt.toISOString(),
    endedAt: toIso(row.endedAt),
    outcome: row.outcome,
    eventId: row.eventId,
    externalRef: row.externalRef,
    notes: row.notes,
  };
}
