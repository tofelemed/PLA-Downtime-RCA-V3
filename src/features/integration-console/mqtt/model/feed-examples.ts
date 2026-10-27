import { defaultFields, type FeedPurpose } from './feed-templates';

/** The owner's sample messages (plans/MQTT_FEEDS.md, 26 Oct 2026), handed to OT as the expected shape. */
export const PLA_EXAMPLE_PAYLOAD: Readonly<Record<string, unknown>> = {
  event_type: 'PRODUCTION_LOSS_DETECTED',
  schema_version: '1.0',
  event_id: 'MARUN-HDPE-20261025',
  event_revision: 1,
  plant: 'MARUN_HDPE',
  production_date: '2026-10-25',
  period_start: '2026-10-25T00:00:00+03:30',
  period_end: '2026-10-26T00:00:00+03:30',
  plan: { source: 'PLANNING_SYSTEM_TBD', plan_id: 'PLAN-20261025', revision: 1, approved: true, planned_production_t: 240 },
  production: { actual_good_production_t: 208, shortfall_t: 32, measurement_quality: 'GOOD' },
  pi_source: { actual_tag: 'PI_TAG_TBD', event_frame_id: 'PI_EVENT_ID_TBD' },
  status: 'DETECTED',
};

export const DOWNTIME_EXAMPLE_PAYLOAD: Readonly<Record<string, unknown>> = {
  event_type: 'DOWNTIME',
  schema_version: '1.0',
  event_id: 'MARUN-HDPE-EXT1-20261025-0612',
  event_revision: 1,
  plant: 'MARUN_HDPE',
  unit: 'Extruder1',
  equipment: 'EXT1-Main',
  start_time: '2026-10-25T06:12:00+03:30',
  end_time: '2026-10-25T06:47:00+03:30',
  duration_min: 35,
  reason_code: 'MECH-GEARBOX',
  description: 'Gearbox high vibration trip',
  status: 'CLOSED',
  pi_source: { event_frame_id: 'PI_EVENT_ID_TBD' },
};

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const clone = (value: Readonly<Json>): Json => JSON.parse(JSON.stringify(value)) as Json;

function take(root: Json, path: string): unknown {
  const parts = path.split('.');
  const last = parts.pop() as string;
  let node: unknown = root;
  for (const part of parts) node = isObject(node) ? node[part] : undefined;
  if (!isObject(node) || !(last in node)) return undefined;
  const value = node[last];
  delete node[last];
  return value;
}

function put(root: Json, path: string, value: unknown): void {
  const parts = path.split('.');
  const last = parts.pop() as string;
  let node = root;
  for (const part of parts) {
    if (!isObject(node[part])) node[part] = {};
    node = node[part] as Json;
  }
  node[last] = value;
}

/**
 * The example message for a feed: the owner's sample, with each edited field moved from its template
 * path to the feed's path, so OT sees exactly what this feed reads.
 */
export function examplePayloadOf(purpose: FeedPurpose, fields: Readonly<Record<string, string>> = {}): Json {
  const example = clone(purpose === 'pla' ? PLA_EXAMPLE_PAYLOAD : DOWNTIME_EXAMPLE_PAYLOAD);
  const defaults = defaultFields(purpose);
  for (const [key, path] of Object.entries(fields)) {
    const from = defaults[key];
    if (!from || !path || path === from) continue;
    const value = take(example, from);
    if (value !== undefined) put(example, path, value);
  }
  return example;
}

export function examplePayloadText(purpose: FeedPurpose, fields?: Readonly<Record<string, string>>): string {
  return JSON.stringify(examplePayloadOf(purpose, fields), null, 2);
}
