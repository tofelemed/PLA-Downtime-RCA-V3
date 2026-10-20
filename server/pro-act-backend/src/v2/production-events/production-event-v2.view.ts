import type { EventAccountingState } from './event-accounting-states';
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
import { isOpenEvent } from '../../domain/events/open-event';
import {
  ReasonWeight,
  storedReasonWeights,
} from '../../domain/events/reason-weights';
import { durationSeconds } from '../../domain/time/interval-algebra';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { EventFacts } from '../../production-event/revisions/event-facts';
import { ImpactBasis } from '../../domain/reliability/unit-impact';
import { toDecimalString } from '../common/decimal-string.transformer';

export interface EventClassificationView {
  physicalType: PhysicalType;
  scheduleClass: ScheduleClass;
  oeeComponent: OeeComponent;
  impactMode: ImpactMode;
  /** decimal string 0..1 when `impactMode = fractional` */
  impactFraction: string | null;
  /** plan 1.10: `stated` (manual override), `default`, `unit_rule` or `standby_takeover` */
  impactBasis: ImpactBasis;
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
  /** SME D3: unit / asset whose failure caused this stop; null = the event's own unit */
  originUnitId: string | null;
  originAssetId: string | null;
  /** SME D4: approved end of a planned stop's window */
  plannedEndTime: string | null;
  /** LA-08: products of a grade transition (null on every other event) */
  fromProductId: string | null;
  toProductId: string | null;
  /** SME E1: catalyst family / operating mode of a grade transition (null = not recorded) */
  catalystFamily: string | null;
  operatingMode: string | null;
  /** SME E6: stream the event happened on (null = whole unit) and lot an output belongs to */
  streamCode: string | null;
  lotCode: string | null;
  /** SME Q10: the stop this ramp-up / startup-quality event recovers from */
  recoveryOfEventId: string | null;
  /** SME E3: disposition of a quality_loss event's tonnes (downgrade / scrap / rework); null = none */
  dispositionClass: string | null;
  /** SME D8 / D11: failure detail (ISO 14224); null = not determined yet */
  failure: {
    mode: string | null;
    severity: string | null;
    maintainableItem: string | null;
    mechanism: string | null;
    cause: string | null;
    detectionMethod: string | null;
  };
  planId: string | null;
  reasonCodeId: string | null;
  /**
   * D-T5: the reasons the stop is split across, largest first (the first is `reasonCodeId`), 8-place
   * weights adding up to 1; null = `reasonCodeId` alone
   */
  reasonWeights: ReasonWeight[] | null;
  /** SME D12: explicitly under investigation (no specific reason yet) */
  investigationPending: boolean;
  /** SME D13: supervisor verification of the coding and maintenance validation of the failure detail */
  verification: {
    verifiedBy: string | null;
    verifiedAt: string | null;
    validatedBy: string | null;
    validatedAt: string | null;
  };
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
  /** still running: no end and not superseded or retracted (a split parent without an end is false) */
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
  /** list and single reads: SME D5 repeat-stop incident of the occurrence (`/v2/stop-incidents`); null = none */
  incidentId?: string | null;
  /**
   * list and single reads (owner 18 Oct 2026): workflow of the accounting of the periods the event overlaps
   * (`none` / `draft` / `in_review` / `stale` / `approved`; open work wins when they differ), shown next to
   * the coding state so every role reads the same server state
   */
  accountingState?: EventAccountingState;
  /** single reads only: what the source last said (ING06), null for events without a source revision */
  sourceFacts?: EventFacts | null;
  /** single reads only: fields where the user's value overrides the source value */
  overriddenFields?: string[];
  /**
   * single reads only (UX E-5): fields the event's source system owns — interval fields a non-manual event
   * refuses to change, and the columns whose user edit is recorded as a source override; empty for manual events
   */
  sourceOwnedFields?: string[];
}

const isoOrNull = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

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
    originUnitId: event.originUnitId ?? null,
    originAssetId: event.originAssetId ?? null,
    plannedEndTime: event.plannedEndTime
      ? new Date(event.plannedEndTime).toISOString()
      : null,
    fromProductId: event.fromProductId ?? null,
    toProductId: event.toProductId ?? null,
    catalystFamily: event.catalystFamily ?? null,
    operatingMode: event.operatingMode ?? null,
    streamCode: event.streamCode ?? null,
    lotCode: event.lotCode ?? null,
    recoveryOfEventId: event.recoveryOfEventId ?? null,
    dispositionClass: event.dispositionClass ?? null,
    failure: {
      mode: event.failureMode ?? null,
      severity: event.failureSeverity ?? null,
      maintainableItem: event.maintainableItem ?? null,
      mechanism: event.failureMechanism ?? null,
      cause: event.failureCause ?? null,
      detectionMethod: event.detectionMethod ?? null,
    },
    planId: event.planId ?? null,
    reasonCodeId: event.reasonCodeId ?? null,
    reasonWeights: storedReasonWeights(event.reasonWeights),
    investigationPending: event.investigationPending ?? false,
    verification: {
      verifiedBy: event.verifiedBy ?? null,
      verifiedAt: isoOrNull(event.verifiedAt),
      validatedBy: event.validatedBy ?? null,
      validatedAt: isoOrNull(event.validatedAt),
    },
    rcaId: event.rcaId ?? null,
    eventType: event.eventType ?? null,
    status: event.status ?? null,
    source: event.source ?? null,
    sourceKind: event.sourceKind,
    severity: event.severity ?? null,
    description: event.description ?? null,
    startTime: interval.start.toISOString(),
    endTime: interval.end?.toISOString() ?? null,
    isOpen: isOpenEvent(interval.end, event.physicalState),
    durationSeconds: interval.end ? durationSeconds(interval) : null,
    elapsedSeconds: durationSeconds(interval, asOf) ?? 0,
    asOf: asOf.toISOString(),
    classification: {
      physicalType: event.physicalType,
      scheduleClass: event.scheduleClass,
      oeeComponent: event.oeeComponent,
      impactMode: event.impactMode,
      impactFraction: toDecimalString(event.impactFraction),
      impactBasis: event.impactBasis ?? 'default',
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
