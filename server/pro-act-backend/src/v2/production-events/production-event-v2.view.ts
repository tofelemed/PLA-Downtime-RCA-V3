import {
  CodingState,
  ImpactMode,
  OeeComponent,
  PhysicalState,
  PhysicalType,
  RcaState,
  ScheduleClass,
  SourceKind,
} from '../../domain/events/event-classification';
import { ClassificationBasis } from '../../code-library/classification-basis';
import { durationSeconds } from '../../domain/time/interval-algebra';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { EventFacts } from '../../production-event/revisions/event-facts';
import { toDecimalString } from '../common/decimal-string.transformer';

export interface EventClassificationView {
  physicalType: PhysicalType;
  scheduleClass: ScheduleClass;
  oeeComponent: OeeComponent;
  impactMode: ImpactMode;
  /** decimal string 0..1 when `impactMode = fractional` */
  impactFraction: string | null;
}

export interface EventStatesView {
  physical: PhysicalState;
  coding: CodingState;
  rca: RcaState;
}

/**
 * v2 read model of a production event (spec §3.2/§3.3, DT11): half-open UTC interval, durations in
 * seconds, four classification axes, three state dimensions; money and quantities are decimal strings.
 */
export interface ProductionEventV2View {
  id: string;
  canonicalId: string;
  eventId: string | null;
  tenantId: string | null;
  unitId: string;
  assetId: string | null;
  planId: string | null;
  reasonCodeId: string | null;
  rcaId: string | null;
  /** legacy v1 type label */
  eventType: string | null;
  /** legacy v1 status label, maintained by the adapter */
  status: string | null;
  source: string | null;
  sourceKind: SourceKind;
  severity: string | null;
  description: string | null;
  startTime: string;
  endTime: string | null;
  isOpen: boolean;
  /** closed events: `end - start`; null while open */
  durationSeconds: number | null;
  /** seconds from start to `end`, or to `asOf` while open */
  elapsedSeconds: number;
  asOf: string;
  classification: EventClassificationView;
  /** where code-driven axes came from (code rule, code default, user; `overridesDefault` flags overrides) */
  classificationBasis: ClassificationBasis | null;
  impactCodeId: string | null;
  states: EventStatesView;
  quantity: string | null;
  quantityUom: string | null;
  cost: string | null;
  value: string | null;
  /** physical stop occurrence (KPI06): split children share it (plan 1.4) */
  occurrenceId: string;
  /** the event a merge replaced this one with (`states.physical = superseded`) */
  supersededByEventId: string | null;
  /** optimistic-concurrency revision; also sent as `ETag` on single reads */
  rowVersion: number;
  /** single reads only: what the source last said (ING06), null for events without a source revision */
  sourceFacts?: EventFacts | null;
  /** single reads only: fields where the user's value overrides the source value */
  overriddenFields?: string[];
}

export function toProductionEventV2View(
  event: ProductionEvent,
  asOf: Date,
): ProductionEventV2View {
  const interval = {
    start: new Date(event.startTime),
    end: event.endTime ? new Date(event.endTime) : null,
  };
  return {
    id: event.id,
    canonicalId: event.canonicalId ?? event.id,
    eventId: event.eventId ?? null,
    tenantId: event.tenantId ?? null,
    unitId: event.unitId,
    assetId: event.assetId ?? null,
    planId: event.planId ?? null,
    reasonCodeId: event.reasonCodeId ?? null,
    rcaId: event.rcaId ?? null,
    eventType: event.eventType ?? null,
    status: event.status ?? null,
    source: event.source ?? null,
    sourceKind: event.sourceKind,
    severity: event.severity ?? null,
    description: event.description ?? null,
    startTime: interval.start.toISOString(),
    endTime: interval.end?.toISOString() ?? null,
    isOpen: interval.end === null,
    durationSeconds: interval.end ? durationSeconds(interval) : null,
    elapsedSeconds: durationSeconds(interval, asOf) ?? 0,
    asOf: asOf.toISOString(),
    classification: {
      physicalType: event.physicalType,
      scheduleClass: event.scheduleClass,
      oeeComponent: event.oeeComponent,
      impactMode: event.impactMode,
      impactFraction: toDecimalString(event.impactFraction),
    },
    classificationBasis: event.classificationBasis ?? null,
    impactCodeId: event.impactCodeId ?? null,
    states: {
      physical: event.physicalState,
      coding: event.codingState,
      rca: event.rcaState,
    },
    quantity: toDecimalString(event.quantity),
    quantityUom: event.quantityUom ?? null,
    cost: toDecimalString(event.cost),
    value: toDecimalString(event.value),
    occurrenceId: event.occurrenceId ?? event.id,
    supersededByEventId: event.supersededByEventId ?? null,
    rowVersion: event.rowVersion,
  };
}
