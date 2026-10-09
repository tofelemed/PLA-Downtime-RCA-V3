import type { ProductionEventFilters } from '@/api/v2/queries/production-events';

/** Enum values of the v2 list filters (backend `event-classification.ts`). */
export const PHYSICAL_TYPES = ['downtime', 'slowdown', 'quality_loss', 'production_output', 'advisory'] as const;
export const SCHEDULE_CLASSES = ['planned', 'unplanned', 'external', 'unknown'] as const;
export const OEE_COMPONENTS = ['availability', 'performance', 'quality', 'idle', 'none'] as const;
export const PHYSICAL_STATES = ['open', 'closed', 'superseded', 'retracted'] as const;
export const CODING_STATES = ['uncoded', 'coded', 'reviewed'] as const;
export const RCA_STATES = ['none', 'required', 'linked', 'completed'] as const;

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
  /** UTC window [from, to) */
  from: string | null;
  to: string | null;
  isOpen: OpenFilter;
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
    from: window.from,
    to: window.to,
    isOpen: 'any',
    windowLabel: window.label,
  };
}

const ARRAY_PARAMS = [
  'unitIds',
  'assetIds',
  'reasonIds',
  'physicalTypes',
  'scheduleClasses',
  'physicalStates',
  'codingStates',
  'rcaStates',
] as const;

/**
 * The v2 list query of a filter state: empty arrays and unset bounds are left out (no filter), arrays
 * are sorted so the same selection gives the same cache key, newest first. Never filtered in the browser.
 */
export function toEventQuery(state: EventFilterState, limit = PAGE_SIZE): ProductionEventFilters {
  const query: Record<string, unknown> = { limit, sort: '-startTime' };
  for (const name of ARRAY_PARAMS) {
    if (state[name].length > 0) query[name] = [...state[name]].sort();
  }
  if (state.from) query.from = state.from;
  if (state.to) query.to = state.to;
  if (state.isOpen !== 'any') query.isOpen = state.isOpen === 'open';
  return query as ProductionEventFilters;
}

/** Current stops (§16.2): open events of the same units, regardless of the list window. */
export function currentStopsQuery(state: EventFilterState): ProductionEventFilters {
  const query: Record<string, unknown> = { limit: 50, sort: '-startTime', isOpen: true, physicalStates: ['open'] };
  if (state.unitIds.length > 0) query.unitIds = [...state.unitIds].sort();
  return query as ProductionEventFilters;
}

const HOUR_MS = 3_600_000;

/** Preset windows ending now; the instant is taken when the user picks one, never on render. */
export const WINDOW_PRESETS = [
  { label: 'Last 8 h', hours: 8 },
  { label: 'Last 24 h', hours: 24 },
  { label: 'Last 7 days', hours: 24 * 7 },
  { label: 'Last 30 days', hours: 24 * 30 },
] as const;

export function presetWindow(hours: number, label: string, now: number): { from: string; to: string; label: string } {
  return { from: new Date(now - hours * HOUR_MS).toISOString(), to: new Date(now + HOUR_MS).toISOString(), label };
}
