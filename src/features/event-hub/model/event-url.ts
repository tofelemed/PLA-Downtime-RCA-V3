import {
  ARRAY_PARAMS,
  DEFAULT_PHYSICAL_STATES,
  defaultFilters,
  presetWindow,
  WINDOW_PRESETS,
  type ArrayFilter,
  type EventFilterState,
  type OpenFilter,
} from './event-filters';

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
};

/** `states=all`: the user cleared the state filter (superseded and retracted rows included). */
const ALL_STATES = 'all';

export const DEFAULT_WINDOW_PRESET = WINDOW_PRESETS[1];

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));
const listOf = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

function openFilterOf(value: string | null): OpenFilter {
  return value === 'open' || value === 'closed' ? value : 'any';
}

function windowOf(params: URLSearchParams, now: number) {
  const from = params.get('from');
  const to = params.get('to');
  if (isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to)) {
    return { from, to, label: params.get('window') ?? 'Custom window' };
  }
  return presetWindow(DEFAULT_WINDOW_PRESET.hours, DEFAULT_WINDOW_PRESET.label, now);
}

/** Filters of the Event Hub list from its URL; a missing window is the default preset ending `now`. */
export function parseEventFilters(params: URLSearchParams, now: number): EventFilterState {
  const state = defaultFilters(windowOf(params, now));
  for (const field of ARRAY_PARAMS) {
    const raw = params.get(PARAM_NAMES[field]);
    if (field === 'physicalStates') state.physicalStates = raw === ALL_STATES ? [] : raw ? listOf(raw) : [...DEFAULT_PHYSICAL_STATES];
    else state[field] = listOf(raw);
  }
  state.isOpen = openFilterOf(params.get('open'));
  state.q = params.get('q') ?? '';
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

/** The URL form of the filters: the window always, other filters only when they differ from the default. */
export function toEventSearchParams(state: EventFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  params.set('window', state.windowLabel);
  setArrays(params, state);
  if (state.isOpen !== 'any') params.set('open', state.isOpen);
  if (state.q.trim()) params.set('q', state.q.trim());
  return params;
}
