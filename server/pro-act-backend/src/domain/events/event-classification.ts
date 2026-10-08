/**
 * The four independent classification axes of a production event (spec §3.2) and the three state
 * dimensions (DT11). Values are the Postgres enum labels of `production_events`.
 */
export const PHYSICAL_TYPES = [
  'downtime',
  'slowdown',
  'quality_loss',
  'production_output',
  'advisory',
] as const;
export type PhysicalType = (typeof PHYSICAL_TYPES)[number];

export const SCHEDULE_CLASSES = [
  'planned',
  'unplanned',
  'external',
  'unknown',
] as const;
export type ScheduleClass = (typeof SCHEDULE_CLASSES)[number];

export const OEE_COMPONENTS = [
  'availability',
  'performance',
  'quality',
  'idle',
  'none',
] as const;
export type OeeComponent = (typeof OEE_COMPONENTS)[number];

export const IMPACT_MODES = [
  'none',
  'full_stop',
  'fractional',
  'measured',
] as const;
export type ImpactMode = (typeof IMPACT_MODES)[number];

export const PHYSICAL_STATES = [
  'open',
  'closed',
  'superseded',
  'retracted',
] as const;
export type PhysicalState = (typeof PHYSICAL_STATES)[number];

export const CODING_STATES = ['uncoded', 'coded', 'reviewed'] as const;
export type CodingState = (typeof CODING_STATES)[number];

export const RCA_STATES = ['none', 'required', 'linked', 'completed'] as const;
export type RcaState = (typeof RCA_STATES)[number];

export const SOURCE_KINDS = [
  'manual',
  'source',
  'derived',
  'imported',
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface EventClassification {
  physicalType: PhysicalType;
  scheduleClass: ScheduleClass;
  oeeComponent: OeeComponent;
  impactMode: ImpactMode;
}

export interface EventStates {
  physicalState: PhysicalState;
  codingState: CodingState;
  rcaState: RcaState;
}

const ADVISORY: EventClassification = {
  physicalType: 'advisory',
  scheduleClass: 'unknown',
  oeeComponent: 'none',
  impactMode: 'none',
};

/** Legacy `event_type` → classification. Anything not listed is advisory (T42: never an automatic loss). */
const LEGACY_EVENT_TYPES: Readonly<Record<string, EventClassification>> = {
  ProductionLoss: {
    physicalType: 'downtime',
    scheduleClass: 'unknown',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
  },
  ProductionOutput: {
    physicalType: 'production_output',
    scheduleClass: 'unknown',
    oeeComponent: 'none',
    impactMode: 'none',
  },
};

/**
 * Default classification for a legacy event type (DT08 defaults; IOW, SOL, APM and FailureWO stay
 * advisory until a user or rule links them to a loss). The SQL backfill in migration
 * `EventIntervalModel` implements the same table; `event-classification.spec.ts` pins both.
 */
export function classifyLegacyEventType(
  eventType: string | null | undefined,
): EventClassification {
  return (eventType && LEGACY_EVENT_TYPES[eventType]) || ADVISORY;
}

/** `source` column → source kind: manual entry, a connector, or an unknown import. */
export function sourceKindOf(source: string | null | undefined): SourceKind {
  if (!source || source === 'Manual') {
    return 'manual';
  }
  return 'source';
}
