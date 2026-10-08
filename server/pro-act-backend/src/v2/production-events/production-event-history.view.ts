import {
  ImpactMode,
  OeeComponent,
  ScheduleClass,
} from '../../domain/events/event-classification';
import { EventCoding } from '../../production-event/revisions/event-coding.entity';
import { EventFacts } from '../../production-event/revisions/event-facts';
import {
  EventReviewItem,
  ReviewItemKind,
  ReviewItemState,
} from '../../production-event/revisions/event-review-item.entity';
import {
  ActorKind,
  EventRevision,
  RevisionKind,
} from '../../production-event/revisions/event-revision.entity';
import { toDecimalString } from '../common/decimal-string.transformer';
import { EventRelationView } from './event-operation.view';

/** One immutable revision of an event (spec §14.2 `event_revisions`). */
export interface EventRevisionView {
  id: string;
  revision: number;
  kind: RevisionKind;
  sourceFacts: EventFacts | null;
  effectiveFacts: EventFacts;
  changeReason: string | null;
  actorId: string | null;
  actorKind: ActorKind;
  sourceRevision: string | null;
  createdAt: string;
}

/** One coding revision (spec §14.2 `event_coding`): who coded what, old/new values, override provenance. */
export interface EventCodingView {
  id: string;
  revision: number;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  oeeCodeId: string | null;
  scheduleClass: ScheduleClass;
  oeeComponent: OeeComponent;
  impactMode: ImpactMode;
  impactFraction: string | null;
  comment: string | null;
  isOverride: boolean;
  overridesSourceRevision: number | null;
  oldValues: EventFacts;
  newValues: EventFacts;
  reason: string | null;
  authorId: string | null;
  createdAt: string;
}

/** A decision owed on an event (spec §5.3). */
export interface EventReviewItemView {
  id: string;
  eventId: string;
  kind: ReviewItemKind;
  field: string | null;
  sourceRevisionId: string | null;
  codingRevisionId: string | null;
  state: ReviewItemState;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** `GET /api/v2/production-events/{id}/revisions` */
export interface ProductionEventHistoryView {
  revisions: EventRevisionView[];
  coding: EventCodingView[];
  reviewItems: EventReviewItemView[];
  /** lineage where the event is either end (split/merge, plan 1.4) */
  relations: EventRelationView[];
}

export function toEventRevisionView(row: EventRevision): EventRevisionView {
  return {
    id: row.id,
    revision: row.revision,
    kind: row.kind,
    sourceFacts: row.sourceFacts ?? null,
    effectiveFacts: row.effectiveFacts,
    changeReason: row.changeReason ?? null,
    actorId: row.actorId ?? null,
    actorKind: row.actorKind,
    sourceRevision: row.sourceRevision ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function toEventCodingView(row: EventCoding): EventCodingView {
  return {
    id: row.id,
    revision: row.revision,
    reasonCodeId: row.reasonCodeId ?? null,
    impactCodeId: row.impactCodeId ?? null,
    oeeCodeId: row.oeeCodeId ?? null,
    scheduleClass: row.scheduleClass,
    oeeComponent: row.oeeComponent,
    impactMode: row.impactMode,
    impactFraction: toDecimalString(row.impactFraction),
    comment: row.comment ?? null,
    isOverride: row.isOverride,
    overridesSourceRevision: row.overridesSourceRevision ?? null,
    oldValues: row.oldValues,
    newValues: row.newValues,
    reason: row.reason ?? null,
    authorId: row.authorId ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function toEventReviewItemView(
  row: EventReviewItem,
): EventReviewItemView {
  return {
    id: row.id,
    eventId: row.eventId,
    kind: row.kind,
    field: row.field ?? null,
    sourceRevisionId: row.sourceRevisionId ?? null,
    codingRevisionId: row.codingRevisionId ?? null,
    state: row.state,
    resolvedBy: row.resolvedBy ?? null,
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
