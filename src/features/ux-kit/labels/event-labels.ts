import type { components } from '@/api/v2/schema';
import type { BulkExclusionReason, BulkJobState } from '@/api/v2/types/event-operations';
import type { ReviewItemState } from '@/api/v2/types/events';

/**
 * Labels of production-event enums (spec §3.2 classification axes, DT11 state dimensions). The single
 * source of the state wording: `event-hub/model/event-states.ts` adds only tones. The API sends these as strings: show them with `labelOf(MAP, value)`.
 */
type EventDto = components['schemas']['CreateProductionEventV2Dto'];
export type PhysicalType = NonNullable<EventDto['physicalType']>;
export type ScheduleClass = NonNullable<EventDto['scheduleClass']>;
export type OeeComponent = NonNullable<EventDto['oeeComponent']>;
export type ImpactMode = NonNullable<EventDto['impactMode']>;

/** Backend `domain/events/event-classification.ts`. */
export type PhysicalState = 'open' | 'closed' | 'superseded' | 'retracted';
export type CodingState = 'uncoded' | 'coded' | 'reviewed';
export type EventRcaState = 'none' | 'required' | 'linked' | 'completed';
export type SourceKind = 'manual' | 'source' | 'derived' | 'imported';
/** Backend `production-event/revisions/event-revision.entity.ts`. */
export type RevisionKind = 'source' | 'user' | 'system' | 'retraction';
export type ActorKind = 'user' | 'connector' | 'system';

export const PHYSICAL_STATE_LABELS: Readonly<Record<PhysicalState, string>> = {
  open: 'Ongoing',
  closed: 'Ended',
  superseded: 'Superseded',
  retracted: 'Retracted',
};

export const CODING_STATE_LABELS: Readonly<Record<CodingState, string>> = {
  uncoded: 'Uncoded',
  coded: 'Coded',
  reviewed: 'Reviewed',
};

/** An event's investigation state in the glossary's words (QA L10: "investigation", never "RCA" on screen). */
export const EVENT_RCA_STATE_LABELS: Readonly<Record<EventRcaState, string>> = {
  none: 'No investigation',
  required: 'Investigation recommended',
  linked: 'Investigation linked',
  completed: 'Investigation completed',
};

/** Event kind (physical type). */
export const PHYSICAL_TYPE_LABELS: Readonly<Record<PhysicalType, string>> = {
  downtime: 'Downtime',
  slowdown: 'Slowdown',
  quality_loss: 'Quality loss',
  production_output: 'Production output',
  advisory: 'Advisory',
  grade_transition: 'Grade transition',
  production_loss: 'Production loss',
};

export const SCHEDULE_CLASS_LABELS: Readonly<Record<ScheduleClass, string>> = {
  planned: 'Planned',
  unplanned: 'Unplanned',
  external: 'External',
  unknown: 'Not classified',
};

export const OEE_COMPONENT_LABELS: Readonly<Record<OeeComponent, string>> = {
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  idle: 'Idle',
  none: 'No OEE impact',
};

export const IMPACT_MODE_LABELS: Readonly<Record<ImpactMode, string>> = {
  none: 'No impact',
  full_stop: 'Full stop',
  fractional: 'Partial (fraction of rate)',
  measured: 'Measured',
};

export const SOURCE_KIND_LABELS: Readonly<Record<SourceKind, string>> = {
  manual: 'Entered manually',
  source: 'From a connected source',
  derived: 'Derived',
  imported: 'Imported',
};

export const REVISION_KIND_LABELS: Readonly<Record<RevisionKind, string>> = {
  source: 'Source update',
  user: 'User change',
  system: 'System change',
  retraction: 'Retraction',
};

export const ACTOR_KIND_LABELS: Readonly<Record<ActorKind, string>> = {
  user: 'User',
  connector: 'Connector',
  system: 'System',
};

export const REVIEW_ITEM_STATE_LABELS: Readonly<Record<ReviewItemState, string>> = {
  open: 'Open',
  kept_override: 'Kept the manual value',
  accepted_source: 'Accepted the source value',
  dismissed: 'Dismissed',
};

export const BULK_JOB_STATE_LABELS: Readonly<Record<BulkJobState, string>> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  partial: 'Partly completed',
  failed: 'Failed',
};

export const BULK_EXCLUSION_LABELS: Readonly<Record<BulkExclusionReason, string>> = {
  not_found: 'Not found',
  duplicate: 'Listed twice',
  superseded: 'Replaced by a newer event',
  retracted: 'Retracted',
  stale_version: 'Changed by someone else',
};

/** Field names of an event (revision facts, overridden fields, review items). */
export const EVENT_FIELD_LABELS: Readonly<Record<string, string>> = {
  unitId: 'Unit',
  assetId: 'Asset',
  planId: 'Plan',
  reasonCodeId: 'Reason',
  impactCodeId: 'Impact code',
  oeeCodeId: 'OEE code',
  rcaId: 'Investigation',
  eventType: 'Event type',
  apmType: 'Event type',
  startTime: 'Start',
  endTime: 'End',
  durationSeconds: 'Duration',
  breachDuration: 'Breach duration',
  physicalType: 'Event kind',
  scheduleClass: 'Schedule class',
  oeeComponent: 'OEE component',
  impactMode: 'Impact',
  impactFraction: 'Impact fraction',
  codingState: 'Coding state',
  physicalState: 'Physical state',
  rcaState: 'RCA state',
  quantity: 'Quantity',
  quantityUom: 'Quantity unit',
  severity: 'Event severity',
  description: 'Description',
  comment: 'Comment',
  status: 'Status',
  source: 'Source',
  sourceKind: 'Source type',
};

/** Glossary (docs/GLOSSARY.md): a downtime event is a "stop"; the generic record of any kind is an "event". */
export type EventNoun = 'stop' | 'event';

export function eventNoun(physicalType: string | null | undefined): EventNoun {
  return physicalType === 'downtime' ? 'stop' : 'event';
}

/** "stop" only when every listed event is a downtime stop; a mixed or empty list is "event". */
export function eventNounOfAll(physicalTypes: ReadonlyArray<string | null | undefined>): EventNoun {
  return physicalTypes.length > 0 && physicalTypes.every((type) => type === 'downtime') ? 'stop' : 'event';
}

export function capitalizedNoun(noun: EventNoun): 'Stop' | 'Event' {
  return noun === 'stop' ? 'Stop' : 'Event';
}
