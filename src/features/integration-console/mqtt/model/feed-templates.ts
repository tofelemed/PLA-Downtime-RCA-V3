/**
 * Field templates of the two MQTT feed purposes (plans/MQTT_FEEDS.md, "Template field paths"). Keys
 * are fixed; each path is where the value sits in the OT payload. A path equal to the default is not
 * stored (the server applies the template), so only edited paths travel.
 */
export type FeedPurpose = 'pla' | 'downtime';
export const FEED_PURPOSES: readonly FeedPurpose[] = ['pla', 'downtime'];

export interface FeedFieldTemplate {
  key: string;
  /** default dotted path in the payload; '' = not read unless set */
  path: string;
  required: boolean;
  label: string;
  help: string;
}

export const PLA_FIELD_TEMPLATE: readonly FeedFieldTemplate[] = [
  { key: 'eventId', path: 'event_id', required: true, label: 'Event id', help: 'Report identity.' },
  { key: 'revision', path: 'event_revision', required: false, label: 'Revision', help: 'Default 1. A later revision supersedes an earlier one.' },
  { key: 'productionDate', path: 'production_date', required: true, label: 'Production date', help: 'Plant production day, YYYY-MM-DD.' },
  { key: 'periodStart', path: 'period_start', required: true, label: 'Period start', help: 'ISO time with offset.' },
  { key: 'periodEnd', path: 'period_end', required: true, label: 'Period end', help: 'ISO time with offset.' },
  { key: 'actual', path: 'production.actual_good_production_t', required: true, label: 'Actual good production', help: 'Good production (t). Becomes the reported actual.' },
  { key: 'planned', path: 'plan.planned_production_t', required: false, label: 'OT planned', help: 'OT plan (t), kept for comparison. Target comes from the approved plan.' },
  { key: 'shortfall', path: 'production.shortfall_t', required: false, label: 'OT shortfall', help: 'OT shortfall (t), kept for comparison.' },
  { key: 'status', path: 'status', required: false, label: 'Status', help: 'Default REPORTED. Release is decided by the source status rules of source system MQTT.' },
  { key: 'quality', path: 'production.measurement_quality', required: false, label: 'Measurement quality', help: 'Kept with the report.' },
  { key: 'plant', path: 'plant', required: false, label: 'Plant', help: 'Kept with the report.' },
  { key: 'eventType', path: 'event_type', required: false, label: 'Event type', help: 'Kept with the report.' },
  { key: 'uom', path: '', required: false, label: 'Quantity unit', help: 'Default t (not read from the payload unless a path is set).' },
];

export const DOWNTIME_FIELD_TEMPLATE: readonly FeedFieldTemplate[] = [
  { key: 'eventId', path: 'event_id', required: true, label: 'Event id', help: 'Stop identity: the same id is the same stop.' },
  { key: 'revision', path: 'event_revision', required: false, label: 'Revision', help: 'A later revision revises the stop.' },
  { key: 'unit', path: 'unit', required: false, label: 'Unit code', help: 'Required unless Equipment names an asset of a unit. Matched to unit codes case-insensitively.' },
  { key: 'equipment', path: 'equipment', required: false, label: 'Equipment code', help: 'Asset code; its unit is used when no unit code matches.' },
  { key: 'start', path: 'start_time', required: true, label: 'Start', help: 'ISO time with offset.' },
  { key: 'end', path: 'end_time', required: false, label: 'End', help: 'Null or absent = ongoing.' },
  { key: 'duration', path: 'duration_min', required: false, label: 'Duration', help: 'In the duration unit; gives the end when End is absent and the stop is closed.' },
  { key: 'reason', path: 'reason_code', required: false, label: 'Reason', help: 'Reason code or name; an unknown one leaves the stop uncoded (unknown_code in quarantine).' },
  { key: 'description', path: 'description', required: false, label: 'Description', help: '' },
  { key: 'lostQuantity', path: 'lost_production_t', required: false, label: 'Lost quantity', help: 'Lost tonnes.' },
  { key: 'status', path: 'status', required: false, label: 'Status', help: '' },
  { key: 'plant', path: 'plant', required: false, label: 'Plant', help: '' },
  { key: 'eventType', path: 'event_type', required: false, label: 'Event type', help: '' },
];

export function templateOf(purpose: FeedPurpose): readonly FeedFieldTemplate[] {
  return purpose === 'pla' ? PLA_FIELD_TEMPLATE : DOWNTIME_FIELD_TEMPLATE;
}

/** Every template key with its default path (the editor's starting point). */
export function defaultFields(purpose: FeedPurpose): Record<string, string> {
  return Object.fromEntries(templateOf(purpose).map((field) => [field.key, field.path]));
}

export const FEED_PURPOSE_LABELS: Readonly<Record<FeedPurpose, string>> = {
  pla: 'PLA (daily production report)',
  downtime: 'Downtime (stops)',
};

/** Shown as placeholders only: the topic is OT's to confirm. */
export const FEED_TOPIC_PLACEHOLDERS: Readonly<Record<FeedPurpose, string>> = {
  pla: 'marun/hdpe/pla',
  downtime: 'marun/hdpe/downtime',
};
