import { UnprocessableEntityException } from '@nestjs/common';
import {
  classifyLegacyEventType,
  EventClassification,
  EventStates,
  sourceKindOf,
} from '../domain/events/event-classification';
import {
  IntervalViolation,
  resolveInterval,
} from '../domain/events/event-interval.validation';
import {
  fromLegacyStatus,
  toLegacyStatus,
} from '../domain/events/legacy-status';
import { ProductionEvent } from './production-event.entity';

/** Fields the interval model owns; v1 and v2 writes both go through this module (DT08, DT11). */
export type IntervalModelFields = Pick<
  ProductionEvent,
  | 'startTime'
  | 'physicalType'
  | 'scheduleClass'
  | 'oeeComponent'
  | 'impactMode'
  | 'physicalState'
  | 'codingState'
  | 'rcaState'
  | 'sourceKind'
> & {
  endTime: Date | null;
  status: string;
  duration: number | null;
};

export interface EventWriteInput {
  startTime?: string | Date;
  endTime?: string | Date | null;
  durationSeconds?: number | null;
  eventType?: string | null;
  status?: string | null;
  source?: string | null;
  reasonCodeId?: string | null;
  rcaId?: string | null;
  classification?: Partial<EventClassification>;
}

/** Interval-model fields for a new event. */
export function prepareCreate(input: EventWriteInput): IntervalModelFields {
  const classification = {
    ...classifyLegacyEventType(input.eventType),
    ...definedOnly(input.classification ?? {}),
  };
  const interval = resolve(
    input.startTime,
    input.endTime,
    input.durationSeconds,
    classification,
  );
  const states = fromLegacyStatus(input.status, {
    hasEnd: interval.end !== null,
    hasReasonCode: Boolean(input.reasonCodeId),
    hasRca: Boolean(input.rcaId),
  });
  return assemble(interval, classification, states, input.source);
}

/**
 * Interval-model fields after applying `input` to `existing`. A new legacy `status` is translated;
 * otherwise the stored states move forward with the row (an end closes it, a reason codes it, an RCA
 * links it) and are never reset.
 */
export function prepareUpdate(
  existing: ProductionEvent,
  input: EventWriteInput,
): IntervalModelFields {
  const eventTypeChanged =
    input.eventType !== undefined && input.eventType !== existing.eventType;
  const classification: EventClassification = {
    ...(eventTypeChanged
      ? classifyLegacyEventType(input.eventType)
      : {
          physicalType: existing.physicalType,
          scheduleClass: existing.scheduleClass,
          oeeComponent: existing.oeeComponent,
          impactMode: existing.impactMode,
        }),
    ...definedOnly(input.classification ?? {}),
  };
  const end =
    input.endTime !== undefined || input.durationSeconds !== undefined
      ? input.endTime
      : existing.endTime;
  const interval = resolve(
    input.startTime ?? existing.startTime,
    end,
    input.durationSeconds,
    classification,
  );
  const context = {
    hasEnd: interval.end !== null,
    hasReasonCode: Boolean(input.reasonCodeId ?? existing.reasonCodeId),
    hasRca: Boolean(input.rcaId ?? existing.rcaId),
  };
  const states = input.status
    ? fromLegacyStatus(input.status, context)
    : advanceStates(existing, context);
  return assemble(
    interval,
    classification,
    states,
    input.source ?? existing.source,
  );
}

/** An RCA was opened for the event (auto-create): RCA required unless the event was already reviewed. */
export function markRcaRequired(
  existing: ProductionEvent,
): Pick<ProductionEvent, 'rcaState' | 'status'> {
  const rcaState =
    existing.codingState === 'reviewed' ? existing.rcaState : 'required';
  return {
    rcaState,
    status: toLegacyStatus({
      physicalState: existing.physicalState,
      codingState: existing.codingState,
      rcaState,
    }),
  };
}

/** 422 with the violation code and the offending field (API03 envelope). */
export function toUnprocessable(
  violation: IntervalViolation,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: violation.code,
    message: [violation.message],
    fieldErrors: [{ field: violation.field, message: violation.message }],
  });
}

function resolve(
  start: string | Date | undefined,
  end: string | Date | null | undefined,
  durationSeconds: number | null | undefined,
  classification: EventClassification,
): { start: Date; end: Date | null } {
  try {
    return resolveInterval({
      start: toDate(start) ?? new Date(Number.NaN),
      end: toDate(end),
      durationSeconds,
      physicalType: classification.physicalType,
    });
  } catch (error) {
    throw error instanceof IntervalViolation ? toUnprocessable(error) : error;
  }
}

function advanceStates(
  existing: ProductionEvent,
  context: { hasEnd: boolean; hasReasonCode: boolean; hasRca: boolean },
): EventStates {
  const physicalState =
    existing.physicalState === 'retracted' ||
    existing.physicalState === 'superseded'
      ? existing.physicalState
      : context.hasEnd
        ? 'closed'
        : 'open';
  const codingState =
    existing.codingState === 'uncoded' && context.hasReasonCode
      ? 'coded'
      : existing.codingState;
  const rcaState =
    existing.rcaState === 'none' && context.hasRca
      ? 'linked'
      : existing.rcaState;
  return { physicalState, codingState, rcaState };
}

function assemble(
  interval: { start: Date; end: Date | null },
  classification: EventClassification,
  states: EventStates,
  source: string | null | undefined,
): IntervalModelFields {
  return {
    startTime: interval.start,
    endTime: interval.end,
    ...classification,
    ...states,
    sourceKind: sourceKindOf(source),
    status: toLegacyStatus(states),
    duration: legacyMinutes(interval),
  };
}

/** v1 `duration` column: minutes, 2 decimals, derived from the interval (B8). */
function legacyMinutes(interval: {
  start: Date;
  end: Date | null;
}): number | null {
  if (!interval.end) return null;
  return (
    Math.round((interval.end.getTime() - interval.start.getTime()) / 600) / 100
  );
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  return value instanceof Date ? value : new Date(value);
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
