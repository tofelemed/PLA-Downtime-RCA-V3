import {
  CauseField,
  CauseValues,
} from '../../domain/events/stop-reconciliation';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { StopIncident } from '../../stop-events/entities/stop-incident.entity';
import { StopReconciliation } from '../../stop-events/entities/stop-reconciliation.entity';

/** The few event fields a duplicate or incident row shows. */
export interface StopEventSummaryView {
  id: string;
  sourceKind: string;
  source: string | null;
  assetId: string | null;
  reasonCodeId: string | null;
  startTime: string;
  endTime: string | null;
  /** closed: end − start; null while open */
  durationSeconds: number | null;
  physicalState: string;
  occurrenceId: string;
}

export interface StopReconciliationV2View {
  id: string;
  unitId: string;
  state: StopReconciliation['state'];
  mode: StopReconciliation['mode'];
  suggestionReason: StopReconciliation['suggestionReason'];
  startDeltaSeconds: number;
  endDeltaSeconds: number | null;
  toleranceSeconds: number;
  conflicts: CauseField[];
  copied: CauseValues;
  kept: StopEventSummaryView | null;
  evidence: StopEventSummaryView | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  rowVersion: number;
}

export interface StopIncidentV2View {
  id: string;
  unitId: string;
  assetId: string | null;
  reasonCodeId: string;
  startTime: string;
  endTime: string | null;
  stopCount: number;
  /** physical stopped seconds of the closed stops (not the incident envelope) */
  stoppedSeconds: number;
  /** envelope from the first start to the last end; null while open */
  envelopeSeconds: number | null;
  windowSeconds: number;
  /** live events of the incident's stops, in time order */
  stops: StopEventSummaryView[];
  /** occurrences people marked as a new failure inside the envelope */
  newFailureOccurrenceIds: string[];
}

const iso = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString() : null;

export function toEventSummary(event: ProductionEvent): StopEventSummaryView {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;
  return {
    id: event.id,
    sourceKind: event.sourceKind,
    source: event.source ?? null,
    assetId: event.assetId ?? null,
    reasonCodeId: event.reasonCodeId ?? null,
    startTime: start.toISOString(),
    endTime: end?.toISOString() ?? null,
    durationSeconds: end ? (end.getTime() - start.getTime()) / 1000 : null,
    physicalState: event.physicalState,
    occurrenceId: event.occurrenceId,
  };
}

export function toReconciliationView(
  row: StopReconciliation,
  events: ReadonlyMap<string, ProductionEvent>,
): StopReconciliationV2View {
  const summary = (id: string) => {
    const event = events.get(id);
    return event ? toEventSummary(event) : null;
  };
  return {
    id: row.id,
    unitId: row.unitId,
    state: row.state,
    mode: row.mode,
    suggestionReason: row.suggestionReason,
    startDeltaSeconds: Number(row.startDeltaSeconds),
    endDeltaSeconds:
      row.endDeltaSeconds === null ? null : Number(row.endDeltaSeconds),
    toleranceSeconds: row.toleranceSeconds,
    conflicts: row.conflicts,
    copied: row.copied,
    kept: summary(row.keptEventId),
    evidence: summary(row.evidenceEventId),
    decidedBy: row.decidedBy,
    decidedAt: iso(row.decidedAt),
    decisionReason: row.decisionReason,
    createdAt: new Date(row.createdAt).toISOString(),
    rowVersion: row.rowVersion,
  };
}

export function toIncidentView(
  row: StopIncident,
  stops: StopEventSummaryView[],
  newFailureOccurrenceIds: string[],
): StopIncidentV2View {
  const start = new Date(row.startTime);
  const end = row.endTime ? new Date(row.endTime) : null;
  return {
    id: row.id,
    unitId: row.unitId,
    assetId: row.assetId,
    reasonCodeId: row.reasonCodeId,
    startTime: start.toISOString(),
    endTime: end?.toISOString() ?? null,
    stopCount: row.stopCount,
    stoppedSeconds: Number(row.stoppedSeconds),
    envelopeSeconds: end ? (end.getTime() - start.getTime()) / 1000 : null,
    windowSeconds: row.windowSeconds,
    stops,
    newFailureOccurrenceIds,
  };
}
