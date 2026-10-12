import type { ErrorMessage } from './error-message';

/** Refusals of the event operations (split, merge, close, retract) and the event export (Event Hub). */
export const EVENT_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  SPLIT_OUTSIDE_INTERVAL: { title: 'The split time is outside the event', text: 'Pick a time between the start and the end of the event.' },
  MERGE_DIFFERENT_UNITS: { title: 'Only events of one unit can be merged', text: 'Select events of the same unit.' },
  MERGE_INCOMPATIBLE_CLASSIFICATION: { title: 'These events have different types or schedule classes', text: 'Tick “Merge different types” to keep the earliest event’s classification.' },
  MERGE_GAP_EXCEEDED: { title: 'The events are too far apart', text: 'Allow a larger gap, or merge fewer events.' },
  MERGE_CODING_CONFLICT: { title: 'The events are coded differently', text: 'Code them the same way first, then merge.' },
  CLOSE_END_BEFORE_START: { title: 'The end is before the start', text: 'Pick an end after the start of the stop.' },
  CLOSE_END_IN_FUTURE: { title: 'The end is in the future', text: 'Pick an end up to now.' },
  END_BEFORE_START: { title: 'The end is before the start', text: 'Change the start or the end so the end comes later.' },
  EXPORT_TOO_LARGE: { title: 'Too many events to export', text: 'Narrow the window or the filters and export again.' },
};
