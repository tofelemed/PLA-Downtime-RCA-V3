import {
  ARRAY_PARAMS,
  DEFAULT_PHYSICAL_STATES,
  defaultFilters,
  presetWindow,
  type ArrayFilter,
  type EventFilterState,
  isEventSort,
  type FilterWindow,
  type OpenFilter,
} from './event-filters';
import { relativeWindowOf } from './relative-window';
import { DEFAULT_WINDOW_PRESET, type WindowPreset } from './window-preference';

/** Short URL names of the list filters (shareable, bookmarkable links of the Event Hub). */
const PARAM_NAMES: Readonly<Record<ArrayFilter, string>> = {
  unitIds: 'units',
  assetIds: 'assets',
  reasonIds: 'reasons',
  physicalTypes: 'kinds',
  scheduleClasses: 'classes',
  physicalStates: 'states',
  codingStates: 'coding',
  rcaStates: 'rca',
  eventTypes: 'types',
  sourceKinds: 'sources',
  severities: 'severity',
  verificationStates: 'verified',
};

/** `states=all`: the user cleared the state filter (superseded and retracted rows included). */
const ALL_STATES = 'all';

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));
const listOf = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** `minDuration=<seconds>`: a positive whole number of seconds, else no filter. */
function minDurationOf(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function openFilterOf(value: string | null): OpenFilter {
  return value === 'open' || value === 'closed' ? value : 'any';
}

/** True when the URL holds explicit bounds (a custom range, a shift, or a link written before A-5). */
export function hasAbsoluteWindow(params: URLSearchParams): boolean {
  const from = params.get('from');
  const to = params.get('to');
  return isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to);
}

/** True when the URL names its window (explicit bounds or a rolling key); otherwise the default applies. */
export function hasWindowParams(params: URLSearchParams): boolean {
  return hasAbsoluteWindow(params) || relativeWindowOf(params.get('window')) !== null;
}

function windowOf(params: URLSearchParams, now: number, preset: WindowPreset): FilterWindow {
  const name = params.get('window');
  if (hasAbsoluteWindow(params)) {
    return { from: params.get('from') ?? '', to: params.get('to') ?? '', label: relativeWindowOf(name)?.label ?? name ?? 'Custom window' };
  }
  const relative = relativeWindowOf(name) ?? preset;
  return { ...presetWindow(relative.hours, relative.label, now), relative: relative.key };
}

/**
 * Filters of the Event Hub list from its URL. A rolling window (`window=24h`) and a missing window — the
 * `preset` (the user's remembered choice, else the last 7 days) — are resolved at `now`; explicit
 * `from` / `to` stay as they are.
 */
export function parseEventFilters(params: URLSearchParams, now: number, preset: WindowPreset = DEFAULT_WINDOW_PRESET): EventFilterState {
  const state = defaultFilters(windowOf(params, now, preset));
  for (const field of ARRAY_PARAMS) {
    const raw = params.get(PARAM_NAMES[field]);
    if (field === 'physicalStates') state.physicalStates = raw === ALL_STATES ? [] : raw ? listOf(raw) : [...DEFAULT_PHYSICAL_STATES];
    else state[field] = listOf(raw);
  }
  state.isOpen = openFilterOf(params.get('open'));
  state.possibleDuplicate = params.get('duplicates') === '1';
  state.possibleRepeat = params.get('repeats') === '1';
  state.q = params.get('q') ?? '';
  state.minDurationSeconds = minDurationOf(params.get('minDuration'));
  const sort = params.get('sort');
  state.sort = isEventSort(sort) ? sort : 'newest';
  return state;
}

function setArrays(params: URLSearchParams, state: EventFilterState): void {
  for (const field of ARRAY_PARAMS) {
    const values = state[field];
    if (field === 'physicalStates') {
      if (values.length === 0) params.set(PARAM_NAMES[field], ALL_STATES);
      else if (!sameList(values, DEFAULT_PHYSICAL_STATES)) params.set(PARAM_NAMES[field], [...values].sort().join(','));
    } else if (values.length > 0) {
      params.set(PARAM_NAMES[field], [...values].sort().join(','));
    }
  }
}

/**
 * The URL form of the filters: the window always (a rolling one as its key only, never frozen bounds),
 * other filters only when they differ from the default.
 */
export function toEventSearchParams(state: EventFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.relativeWindow) {
    params.set('window', state.relativeWindow);
  } else {
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    params.set('window', state.windowLabel);
  }
  setArrays(params, state);
  if (state.isOpen !== 'any') params.set('open', state.isOpen);
  if (state.possibleDuplicate) params.set('duplicates', '1');
  if (state.possibleRepeat) params.set('repeats', '1');
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.minDurationSeconds !== null) params.set('minDuration', String(state.minDurationSeconds));
  if (state.sort !== 'newest') params.set('sort', state.sort);
  return params;
}
