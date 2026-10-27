import { UnprocessableEntityException } from '@nestjs/common';
import { DeclaredFigures } from '../domain/events/declared-figures';
import {
  classifyLegacyEventType,
  EventClassification,
  EventStates,
  sourceKindOf,
} from '../domain/events/event-classification';
import {
  assertNotInFuture,
  IntervalViolation,
  resolveInterval,
} from '../domain/events/event-interval.validation';
import {
  fromLegacyStatus,
  toLegacyStatus,
} from '../domain/events/legacy-status';
import { ProductionEvent } from './production-event.entity';
import {
  assertProductionLossValid,
  PRODUCTION_LOSS_AXES,
  resolveLossColumns,
} from './production-loss';

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
  /** SME D12: an uncoded stop under investigation; absent = the stored flag */
  investigationPending?: boolean;
  classification?: Partial<EventClassification>;
  /** declared mode: the stated quantity and figures of a `production_loss` event; absent = the stored ones */
  quantity?: string | number | null;
  declaredFigures?: DeclaredFigures | null;
}

/**
 * A downtime event whose impact the caller did not state stops the unit (SME Q5): `none` and `fractional`
 * must be chosen explicitly, so an event entered as downtime is never silently a no-loss event.
 */
function withStopDefault(
  classification: EventClassification,
  input: EventWriteInput,
): EventClassification {
  const stated = input.classification?.impactMode !== undefined;
  return classification.physicalType === 'downtime' && !stated
    ? { ...classification, impactMode: 'full_stop' }
    : classification;
}

/** A production loss is measured tonnes with no OEE component, whatever the caller or a code default states. */
function withLossAxes(
  classification: EventClassification,
): EventClassification {
  return classification.physicalType === 'production_loss'
    ? { ...classification, ...PRODUCTION_LOSS_AXES }
    : classification;
}

/** Interval-model fields for a new event. */
export function prepareCreate(input: EventWriteInput): IntervalModelFields {
  const classification = withLossAxes(
    withStopDefault(
      {
        ...classifyLegacyEventType(input.eventType),
        ...definedOnly(input.classification ?? {}),
      },
      input,
    ),
  );
  const interval = resolve(
    input.startTime,
    input.endTime,
    input.durationSeconds,
    classification,
  );
  if (classification.physicalType === 'production_loss') {
    assertProductionLossValid({
      endTime: interval.end,
      columns: resolveLossColumns(input),
    });
  }
  const states = fromLegacyStatus(input.status, {
    hasEnd: interval.end !== null,
    hasReasonCode: Boolean(input.reasonCodeId),
    hasRca: Boolean(input.rcaId),
  });
  return assemble(interval, classification, states, sourceKindOf(input.source));
}

/**
 * Interval-model fields after applying `input` to `existing`. A new legacy `status` is translated;
 * otherwise the stored states move forward with the row (an end closes it, an RCA links it) and the coding
 * state is recomputed from the merged data (`codingStateOf`): a stop without a reason is uncoded again,
 * unless its investigation is pending (Marun E2E, regression R1).
 */
export function prepareUpdate(
  existing: ProductionEvent,
  input: EventWriteInput,
): IntervalModelFields {
  // a production loss is declared, not derived from a legacy event type: its kind and axes stay
  const eventTypeChanged =
    existing.physicalType !== 'production_loss' &&
    input.eventType !== undefined &&
    input.eventType !== existing.eventType;
  const stated: EventClassification = {
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
  const becameDowntime =
    stated.physicalType === 'downtime' && existing.physicalType !== 'downtime';
  const classification = withLossAxes(
    becameDowntime ? withStopDefault(stated, input) : stated,
  );
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
  if (classification.physicalType === 'production_loss') {
    assertProductionLossValid({
      endTime: interval.end,
      columns: resolveLossColumns({
        quantity:
          input.quantity === undefined ? existing.quantity : input.quantity,
        declaredFigures:
          input.declaredFigures === undefined
            ? existing.declaredFigures
            : input.declaredFigures,
      }),
    });
  }
  const context = {
    hasEnd: interval.end !== null,
    hasReasonCode:
      input.reasonCodeId === undefined
        ? Boolean(existing.reasonCodeId)
        : Boolean(input.reasonCodeId),
    hasRca: Boolean(input.rcaId ?? existing.rcaId),
    reasonCleared:
      input.reasonCodeId === null && Boolean(existing.reasonCodeId),
    investigationPending:
      input.investigationPending ?? existing.investigationPending,
    isStop: classification.physicalType === 'downtime',
  };
  const states = input.status
    ? fromLegacyStatus(input.status, context)
    : advanceStates(existing, context);
  return assemble(
    interval,
    classification,
    states,
    keptSourceKind(existing, input),
  );
}

/**
 * The stored kind survives an update (a coded state-engine stop stays `derived`, an import stays
 * `imported`): the `source` label alone cannot tell them from a connected source. Only a changed `source`
 * re-derives it.
 */
function keptSourceKind(
  existing: ProductionEvent,
  input: EventWriteInput,
): ProductionEvent['sourceKind'] {
  const changed =
    input.source !== undefined && input.source !== existing.source;
  return changed ? sourceKindOf(input.source) : existing.sourceKind;
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

/** DT-09: 422 IN_FUTURE when a manual start or end lies beyond the clock allowance. */
export function assertWrittenNotInFuture(
  fields: Pick<IntervalModelFields, 'startTime' | 'endTime'>,
  now: Date,
): void {
  try {
    assertNotInFuture({ start: fields.startTime, end: fields.endTime }, now);
  } catch (error) {
    throw error instanceof IntervalViolation ? toUnprocessable(error) : error;
  }
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

interface StateContext {
  hasEnd: boolean;
  hasReasonCode: boolean;
  hasRca: boolean;
  /** the update clears the reason the event had */
  reasonCleared: boolean;
  investigationPending: boolean;
  /** the event is a stop after the update */
  isStop: boolean;
}

/**
 * The coding state follows the event's data on every write (Marun regression R1): a reason codes it (a
 * reviewed coding stays reviewed); a stop without a reason is uncoded unless its investigation is pending
 * (then the stored state stands). A non-stop event keeps its stored state unless its reason is cleared.
 */
function codingStateOf(
  existing: ProductionEvent,
  context: StateContext,
): EventStates['codingState'] {
  if (context.hasReasonCode) {
    return existing.codingState === 'reviewed' ? 'reviewed' : 'coded';
  }
  if (context.investigationPending) return existing.codingState;
  return context.reasonCleared || context.isStop
    ? 'uncoded'
    : existing.codingState;
}

function advanceStates(
  existing: ProductionEvent,
  context: StateContext,
): EventStates {
  const physicalState =
    existing.physicalState === 'retracted' ||
    existing.physicalState === 'superseded'
      ? existing.physicalState
      : context.hasEnd
        ? 'closed'
        : 'open';
  const codingState = codingStateOf(existing, context);
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
  sourceKind: ProductionEvent['sourceKind'],
): IntervalModelFields {
  return {
    startTime: interval.start,
    endTime: interval.end,
    ...classification,
    ...states,
    sourceKind,
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
