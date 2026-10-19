import { HOUR_MS } from '@/api/v2/queries/time-window';
import type { EventSelectionQuery, ProductionEventFilters } from '@/api/v2/queries/production-events';
import { displayEnd, RELATIVE_WINDOWS, resolveRelativeWindow, type RelativeWindow, type RelativeWindowKey } from './relative-window';

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
/** E-7: supervisor verification of a stop's coding (SME D13); maintenance validation is not part of it. */
export const VERIFICATION_STATES = ['verified', 'not_verified'] as const;

export type OpenFilter = 'any' | 'open' | 'closed';
/** E-1: one order of the list at a time — by start (newest / oldest first) or by duration (longest / shortest first). */
export type EventSort = 'newest' | 'oldest' | 'longest' | 'shortest';

/** The v2 `sort` of each order; a running stop sorts as the longest (server rule, DECISIONS 2026-10-18). */
export const EVENT_SORT_PARAMS: Readonly<Record<EventSort, 'startTime' | '-startTime' | 'durationSeconds' | '-durationSeconds'>> = {
  newest: '-startTime',
  oldest: 'startTime',
  longest: '-durationSeconds',
  shortest: 'durationSeconds',
};

export function isEventSort(value: string | null): value is EventSort {
  return value !== null && Object.prototype.hasOwnProperty.call(EVENT_SORT_PARAMS, value);
}

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
  /** E-7: verified / not_verified (supervisor verification of the coding) */
  verificationStates: string[];
  /** free text over description and source event id (server side, 2+ characters) */
  q: string;
  /** UTC window [from, to) */
  from: string | null;
  to: string | null;
  isOpen: OpenFilter;
  /** only stops overlapping another stop of the same asset (DT-04, server rule) */
  possibleDuplicate: boolean;
  /** only stops restarting soon after a same-asset, same-reason stop (SME D5, server rule) */
  possibleRepeat: boolean;
  /** E-1: only events lasting at least this many seconds (running ones by elapsed time, server rule); null = any */
  minDurationSeconds: number | null;
  /** label of the chosen window ("Last 24 h", a shift name); display only */
  windowLabel: string;
  /** A-5: a rolling window kept relative (`from` / `to` resolved from now); null = explicit bounds */
  relativeWindow: RelativeWindowKey | null;
  sort: EventSort;
}

/** Superseded and retracted rows are history (DT11): hidden unless the user asks for them. */
export const DEFAULT_PHYSICAL_STATES = ['open', 'closed'];

/** A list window: resolved bounds, its label and, for a rolling window, its key. */
export interface FilterWindow {
  from: string;
  to: string;
  label: string;
  relative?: RelativeWindowKey | null;
}

export function defaultFilters(window: FilterWindow): EventFilterState {
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
    verificationStates: [],
    q: '',
    from: window.from,
    to: window.to,
    isOpen: 'any',
    possibleDuplicate: false,
    possibleRepeat: false,
    minDurationSeconds: null,
    windowLabel: window.label,
    relativeWindow: window.relative ?? null,
    sort: 'newest',
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
  'verificationStates',
] as const;
export type ArrayFilter = (typeof ARRAY_PARAMS)[number];

/**
 * The v2 list query of a filter state: empty arrays and unset bounds are left out (no filter), arrays
 * are sorted so the same selection gives the same cache key, in the one order the user chose (newest
 * first by default). Never filtered in the browser.
 */
export function toEventQuery(state: EventFilterState): ProductionEventFilters {
  const query: Record<string, unknown> = { sort: EVENT_SORT_PARAMS[state.sort] };
  for (const name of ARRAY_PARAMS) {
    if (state[name].length > 0) query[name] = [...state[name]].sort();
  }
  if (state.q.trim().length >= MIN_SEARCH) query.q = state.q.trim();
  if (state.from) query.from = state.from;
  if (state.to) query.to = state.to;
  if (state.isOpen !== 'any') query.isOpen = state.isOpen === 'open';
  if (state.possibleDuplicate) query.possibleDuplicate = true;
  if (state.possibleRepeat) query.possibleRepeat = true;
  if (state.minDurationSeconds !== null) query.minDurationSeconds = state.minDurationSeconds;
  return query as ProductionEventFilters;
}

/**
 * FE-07 "To code": the stops of the same units and window that still need a reason (open or ended,
 * uncoded); every other narrowing is dropped so nothing uncoded hides behind an old filter.
 */
export function toCodeFilters(state: EventFilterState): EventFilterState {
  const window = { from: state.from ?? '', to: state.to ?? '', label: state.windowLabel, relative: state.relativeWindow };
  return {
    ...defaultFilters(window),
    from: state.from,
    to: state.to,
    sort: state.sort,
    unitIds: [...state.unitIds],
    physicalTypes: ['downtime'],
    codingStates: ['uncoded'],
  };
}

/** True when the list shows exactly the "To code" preset (same server query), e.g. for its empty text. */
export function isToCodeFilters(state: EventFilterState): boolean {
  return JSON.stringify(toEventQuery(toCodeFilters(state))) === JSON.stringify(toEventQuery(state));
}

/**
 * SME D13 "all matching": the same server filters as the list, without paging or sort, for the selection
 * snapshot; null without a window (the snapshot needs one).
 */
export function selectionQuery(state: EventFilterState): EventSelectionQuery | null {
  if (!state.from || !state.to) return null;
  const { limit: _limit, sort: _sort, ...filters } = toEventQuery(state);
  return { ...filters, from: state.from, to: state.to } as EventSelectionQuery;
}

/** Shortest free-text search the server accepts. */
export const MIN_SEARCH = 2;

/** Current stops (§16.2): open events of the same units, regardless of the list window. */
export function currentStopsQuery(state: EventFilterState): ProductionEventFilters {
  const query: Record<string, unknown> = { limit: 50, sort: '-startTime', isOpen: true, physicalStates: ['open'] };
  if (state.unitIds.length > 0) query.unitIds = [...state.unitIds].sort();
  return query as ProductionEventFilters;
}

/** Rolling windows of the Event Hub (A-5: kept relative, resolved when the list fetches). */
const EVENT_WINDOW_KEYS: readonly RelativeWindowKey[] = ['8h', '24h', '7d', '30d'];
export const WINDOW_PRESETS: readonly RelativeWindow[] = RELATIVE_WINDOWS.filter((entry) => EVENT_WINDOW_KEYS.includes(entry.key));

/** The list window ends this far after now, so stops starting before the next re-resolve stay listed. */
export const EVENT_WINDOW_LOOKAHEAD_MS = HOUR_MS;

/**
 * A preset window: `hours` back from `now`, ending one hour after it (stops starting in the next hour
 * stay listed), with minute-stable bounds so a revisit hits the cache.
 */
export function presetWindow(hours: number, label: string, now: number): { from: string; to: string; label: string } {
  return { ...resolveRelativeWindow({ hours }, now, EVENT_WINDOW_LOOKAHEAD_MS), label };
}

/** The window as shown to people: a rolling window ends at its resolve instant (the look-ahead is internal). */
export function shownWindow(state: EventFilterState): { label: string; from: string | null; to: string | null; relative: boolean } {
  const to = state.relativeWindow && state.from && state.to ? displayEnd({ from: state.from, to: state.to }, EVENT_WINDOW_LOOKAHEAD_MS) : state.to;
  return { label: state.windowLabel, from: state.from, to, relative: state.relativeWindow !== null };
}

/** E-1: the order a sortable header chooses — its first order when another column sorts, else its other order. */
export function nextSortOf(current: EventSort, orders: readonly [EventSort, EventSort]): EventSort {
  return current === orders[0] ? orders[1] : orders[0];
}
