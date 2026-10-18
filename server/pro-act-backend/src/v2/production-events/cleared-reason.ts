import {
  ClassificationBasis,
  CodeDrivenAxis,
} from '../../code-library/classification-basis';
import {
  classifyLegacyEventType,
  EventClassification,
} from '../../domain/events/event-classification';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { EventFacts } from '../../production-event/revisions/event-facts';

/** Axes a reason code fills that go back when the reason is cleared (the impact code stays: never replaced). */
const RELEASED_AXES = ['scheduleClass', 'oeeComponent'] as const;
type ReleasedAxis = (typeof RELEASED_AXES)[number] & CodeDrivenAxis;

const FROM_REASON = new Set(['code_rule', 'code_default']);

/** What clearing the reason undoes: the axes back to their value without it, the basis without them. */
export interface ClearedReason {
  classification: Partial<Pick<EventClassification, ReleasedAxis>>;
  columns: Pick<ProductionEvent, 'classificationBasis'>;
  /** fields whose user override (recorded when the reason filled them) is released */
  released: ReleasedAxis[];
}

const NOTHING: ClearedReason = {
  classification: {},
  columns: {},
  released: [],
};

/** The axis value without the reason: the source's fact, else the event type's default. */
function baselineOf(
  event: ProductionEvent,
  axis: ReleasedAxis,
  sourceFacts: EventFacts | null,
): string {
  const fact = sourceFacts?.[axis];
  return typeof fact === 'string'
    ? fact
    : classifyLegacyEventType(event.eventType)[axis];
}

/**
 * Marun E2E note B: clearing a reason drops the classification its code filled in (code rule or code
 * default in `classification_basis`) unless the request states that axis itself; values a person chose
 * (basis `user`) and rule defaults stay. Nothing changes when the reason is not cleared.
 */
export function clearedReason(
  locked: ProductionEvent,
  request: { reasonCodeId?: string | null } & Partial<
    Record<ReleasedAxis, string | undefined>
  >,
  sourceFacts: EventFacts | null,
): ClearedReason {
  if (request.reasonCodeId !== null || !locked.reasonCodeId) return NOTHING;
  const basis: ClassificationBasis = { ...(locked.classificationBasis ?? {}) };
  const released = RELEASED_AXES.filter(
    (axis) =>
      request[axis] === undefined && FROM_REASON.has(basis[axis]?.source ?? ''),
  );
  if (released.length === 0) return NOTHING;
  const classification: ClearedReason['classification'] = {};
  for (const axis of released) {
    Object.assign(classification, {
      [axis]: baselineOf(locked, axis, sourceFacts),
    });
    delete basis[axis];
  }
  return {
    classification,
    columns: {
      classificationBasis: Object.keys(basis).length > 0 ? basis : null,
    },
    released,
  };
}
