import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  applyCodeDefaults,
  CodeDefaults,
} from '../code-library/classification-basis';
import {
  CodingState,
  OeeComponent,
  ScheduleClass,
} from '../domain/events/event-classification';
import { union } from '../domain/time/interval-algebra';
import { prepareUpdate } from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  AffectedWindow,
  BulkCodeItem,
  BulkCodes,
  BulkExclusion,
  BulkExclusionReason,
  CodingSnapshot,
} from './bulk-code.types';

export interface ClassifiedItems {
  eligible: Array<{ item: BulkCodeItem; event: ProductionEvent }>;
  exclusions: BulkExclusion[];
}

/** Stand-in end of running events while windows are merged (max JS date). */
const OPEN_END_MS = 8.64e15;

/**
 * DT10 preview rules: unknown or foreign ids, repeated ids, superseded or retracted events and stale
 * versions are excluded; everything else is eligible.
 */
export function classifyItems(
  items: readonly BulkCodeItem[],
  events: readonly ProductionEvent[],
): ClassifiedItems {
  const byId = new Map(events.map((event) => [event.id, event]));
  const seen = new Set<string>();
  const result: ClassifiedItems = { eligible: [], exclusions: [] };
  for (const item of items) {
    const event = byId.get(item.eventId);
    const exclusion = exclusionOf(item, event, seen);
    seen.add(item.eventId);
    if (exclusion) result.exclusions.push(exclusion);
    else result.eligible.push({ item, event: event as ProductionEvent });
  }
  return result;
}

function exclusionOf(
  item: BulkCodeItem,
  event: ProductionEvent | undefined,
  seen: ReadonlySet<string>,
): BulkExclusion | null {
  const { eventId } = item;
  if (seen.has(eventId)) return { eventId, reason: 'duplicate' };
  if (!event) return { eventId, reason: 'not_found' };
  if (
    event.physicalState === 'superseded' ||
    event.physicalState === 'retracted'
  ) {
    return { eventId, reason: event.physicalState };
  }
  if (event.rowVersion !== item.expectedVersion) {
    return {
      eventId,
      reason: 'stale_version',
      currentVersion: event.rowVersion,
    };
  }
  return null;
}

const REJECTIONS: ReadonlyArray<{
  reasons: readonly BulkExclusionReason[];
  code: string;
  message: string;
  exception: new (body: Record<string, unknown>) => Error;
}> = [
  {
    reasons: ['not_found'],
    code: 'NOT_FOUND',
    message: 'Some events were not found',
    exception: NotFoundException,
  },
  {
    reasons: ['superseded', 'retracted'],
    code: 'INVALID_STATE',
    message: 'Superseded or retracted events cannot be coded',
    exception: ConflictException,
  },
  {
    reasons: ['stale_version'],
    code: 'STALE_REVISION',
    message: 'Some events changed since they were read',
    exception: PreconditionFailedException,
  },
  {
    reasons: ['duplicate'],
    code: 'DUPLICATE_EVENT',
    message: 'An event is listed more than once',
    exception: UnprocessableEntityException,
  },
];

/**
 * A batch with exclusions is refused as a whole (atomic): 404 for unknown or foreign ids, 409 for
 * superseded/retracted events, 412 for stale versions, 422 for repeated ids (first match wins).
 */
export function rejectExclusions(exclusions: readonly BulkExclusion[]): void {
  for (const rejection of REJECTIONS) {
    const rows = exclusions.filter(({ reason }) =>
      rejection.reasons.includes(reason),
    );
    if (rows.length > 0) {
      throw new rejection.exception({
        code: rejection.code,
        message: rejection.message,
        details: { exclusions: rows },
      });
    }
  }
}

/** Columns of the bulk coding on one (locked) event, with the reason code's defaults applied. */
export function codingPatch(
  event: ProductionEvent,
  codes: BulkCodes,
  defaults: CodeDefaults,
): Partial<ProductionEvent> {
  const { values, basis } = applyCodeDefaults(defaults, {
    scheduleClass: codes.scheduleClass,
    oeeComponent: codes.oeeComponent,
  });
  const scheduleClass =
    codes.scheduleClass ?? (values.scheduleClass as ScheduleClass | undefined);
  const oeeComponent =
    codes.oeeComponent ?? (values.oeeComponent as OeeComponent | undefined);
  const columns = {
    ...prepareUpdate(event, {
      reasonCodeId: codes.reasonCodeId,
      classification: { scheduleClass, oeeComponent },
    }),
  } as Partial<ProductionEvent>;
  if (codes.reasonCodeId) {
    columns.reasonCodeId = codes.reasonCodeId;
    columns.classificationBasis = Object.keys(basis).length > 0 ? basis : null;
  }
  if (values.impactCodeId && !event.impactCodeId) {
    columns.impactCodeId = values.impactCodeId;
  }
  if (codes.assetId !== undefined) columns.assetId = codes.assetId;
  if (codes.investigationPending !== undefined) {
    columns.investigationPending = codes.investigationPending;
  }
  return columns;
}

export function codingSnapshot(
  event: Partial<ProductionEvent>,
): CodingSnapshot {
  return {
    reasonCodeId: event.reasonCodeId ?? null,
    assetId: event.assetId ?? null,
    investigationPending: event.investigationPending ?? false,
    impactCodeId: event.impactCodeId ?? null,
    scheduleClass: event.scheduleClass as ScheduleClass,
    oeeComponent: event.oeeComponent as OeeComponent,
    codingState: event.codingState as CodingState,
  };
}

/**
 * UX A-1: a bulk asset must belong to every event's unit (as `EventReferencesValidator.assertOwned` checks
 * for one event); 422 INVALID_REFERENCE naming the events of other units otherwise.
 */
export function assertAssetUnit(
  events: ReadonlyArray<Pick<ProductionEvent, 'id' | 'unitId'>>,
  asset: { unitId: string | null } | null,
): void {
  const foreign = events
    .filter((event) => !asset || event.unitId !== asset.unitId)
    .map((event) => event.id);
  if (foreign.length === 0) return;
  const message =
    'codes.assetId does not refer to equipment of every selected event’s unit';
  throw new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field: 'codes.assetId', message }],
    details: { eventIds: foreign.slice(0, 100) },
  });
}

/** Merged intervals per unit (period impact until Phase 2 periods exist); running → `to: null`. */
export function affectedWindows(
  events: readonly ProductionEvent[],
): AffectedWindow[] {
  const byUnit = new Map<string, ProductionEvent[]>();
  for (const event of events) {
    byUnit.set(event.unitId, [...(byUnit.get(event.unitId) ?? []), event]);
  }
  return [...byUnit].flatMap(([unitId, unitEvents]) =>
    union(
      unitEvents.map(({ startTime, endTime }) => ({
        start: new Date(startTime),
        end: endTime ? new Date(endTime) : new Date(OPEN_END_MS),
      })),
    ).map(({ start, end }) => ({
      unitId,
      from: start.toISOString(),
      to: end.getTime() === OPEN_END_MS ? null : end.toISOString(),
    })),
  );
}
