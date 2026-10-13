import { HOUR_MS, rollingWindow } from '@/api/v2/queries/time-window';
import type { ProductionEventFilters } from '@/api/v2/queries/production-events';

/** Enum values of the v2 list filters (backend `event-classification.ts`). */
export const PHYSICAL_TYPES = ['downtime', 'slowdown', 'quality_loss', 'production_output', 'advisory'] as const;
export const SCHEDULE_CLASSES = ['planned', 'unplanned', 'external', 'unknown'] as const;
export const OEE_COMPONENTS = ['availability', 'performance', 'quality', 'idle', 'none'] as const;
export const PHYSICAL_STATES = ['open', 'closed', 'superseded', 'retracted'] as const;
export const CODING_STATES = ['uncoded', 'coded', 'reviewed'] as const;
export const RCA_STATES = ['none', 'required', 'linked', 'completed'] as const;
/** v1 event families (the v1 Event Hub tabs), filtered with the v2 `eventTypes` parameter. */
export const EVENT_TYPES = ['ProductionLoss', 'IOW', 'SOL', 'APM', 'FailureWO', 'ProductionOutput'] as const;
export const SOURCE_KINDS = ['manual', 'source', 'derived', 'imported'] as const;
export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export type OpenFilter = 'any' | 'open' | 'closed';

/** What the filter bar holds; every field maps 1:1 to a v2 query parameter (plan 3.2 step 1). */
export interface EventFilterState {
  unitIds: string[];
  assetIds: string[];
  reasonIds: string[];
  physicalTypes: string[];
  scheduleClasses: string[];
  physicalStates: string[];
  codingStates: string[];
  rcaStates: string[];
  eventTypes: string[];
  sourceKinds: string[];
  severities: string[];
  /** free text over description and source event id (server side, 2+ characters) */
  q: string;
  /** UTC window [from, to) */
  from: string | null;
  to: string | null;
  isOpen: OpenFilter;
  /** only stops overlapping another stop of the same asset (DT-04, server rule) */
  possibleDuplicate: boolean;
  /** label of the chosen window ("Last 24 h", a shift name); display only */
  windowLabel: string;
}

/** Superseded and retracted rows are history (DT11): hidden unless the user asks for them. */
export const DEFAULT_PHYSICAL_STATES = ['open', 'closed'];

export const PAGE_SIZE = 100;

export function defaultFilters(window: { from: string; to: string; label: string }): EventFilterState {
  return {
    unitIds: [],
    assetIds: [],
    reasonIds: [],
    physicalTypes: [],
    scheduleClasses: [],
    physicalStates: [...DEFAULT_PHYSICAL_STATES],
    codingStates: [],
    rcaStates: [],
    eventTypes: [],
    sourceKinds: [],
    severities: [],
    q: '',
    from: window.from,
    to: window.to,
    isOpen: 'any',
    possibleDuplicate: false,
    windowLabel: window.label,
  };
}

export const ARRAY_PARAMS = [
  'unitIds',
  'assetIds',
  'reasonIds',
  'physicalTypes',
  'scheduleClasses',
  'physicalStates',
  'codingStates',
  'rcaStates',
  'eventTypes',
  'sourceKinds',
  'severities',
] as const;
export type ArrayFilter = (typeof ARRAY_PARAMS)[number];

/**
 * The v2 list query of a filter state: empty arrays and unset bounds are left out (no filter), arrays
 * are sorted so the same selection gives the same cache key, newest first. Never filtered in the browser.
 */
export function toEventQuery(state: EventFilterState, limit = PAGE_SIZE): ProductionEventFilters {
  const query: Record<string, unknown> = { limit, sort: '-startTime' };
  for (const name of ARRAY_PARAMS) {
    if (state[name].length > 0) query[name] = [...state[name]].sort();
  }
  if (state.q.trim().length >= MIN_SEARCH) query.q = state.q.trim();
  if (state.from) query.from = state.from;
  if (state.to) query.to = state.to;
  if (state.isOpen !== 'any') query.isOpen = state.isOpen === 'open';
  if (state.possibleDuplicate) query.possibleDuplicate = true;
  return query as ProductionEventFilters;
}

/**
 * FE-07 "To code": the stops of the same units and window that still need a reason (open or ended,
 * uncoded); every other narrowing is dropped so nothing uncoded hides behind an old filter.
 */
export function toCodeFilters(state: EventFilterState): EventFilterState {
  const window = { from: state.from ?? '', to: state.to ?? '', label: state.windowLabel };
  return {
    ...defaultFilters(window),
    from: state.from,
    to: state.to,
    unitIds: [...state.unitIds],
    physicalTypes: ['downtime'],
    codingStates: ['uncoded'],
  };
}

/** Shortest free-text search the server accepts. */
export const MIN_SEARCH = 2;

/** Current stops (§16.2): open events of the same units, regardless of the list window. */
export function currentStopsQuery(state: EventFilterState): ProductionEventFilters {
  const query: Record<string, unknown> = { limit: 50, sort: '-startTime', isOpen: true, physicalStates: ['open'] };
  if (state.unitIds.length > 0) query.unitIds = [...state.unitIds].sort();
  return query as ProductionEventFilters;
}

/** Preset windows ending now; the instant is taken when the user picks one, never on render. */
export const WINDOW_PRESETS = [
  { label: 'Last 8 h', hours: 8 },
  { label: 'Last 24 h', hours: 24 },
  { label: 'Last 7 days', hours: 24 * 7 },
  { label: 'Last 30 days', hours: 24 * 30 },
] as const;

/**
 * A preset window: `hours` back from `now`, ending one hour after it (stops starting in the next hour
 * stay listed), with minute-stable bounds so a revisit hits the cache.
 */
export function presetWindow(hours: number, label: string, now: number): { from: string; to: string; label: string } {
  const window = rollingWindow((hours + 1) * HOUR_MS, now + HOUR_MS);
  return { ...window, label };
}
