import type { ConnectionView } from '@/api/v2/types/integrations';
import { IDENTITY_STRATEGIES, PROFILE_KINDS, QUALITY_PROTOCOLS, TIME_UNITS, type IdentityStrategy, type ProfileKind } from './mqtt-form';
import { stateMapProblem } from './value-map-classify';
import { parseTopicTemplate } from './topic-rules';

/**
 * Payload profile editor draft (plan 1.8 step 5): what the panel edits after a connection exists —
 * topic template, field overrides, time and quality settings, value maps — saved as a JSON merge patch
 * of `endpointConfig.payloadProfile` (`PATCH /connections/{id}` `payloadProfilePatch`), so the
 * transport block and the topics are never touched.
 */
export interface MapRow {
  token: string;
  value: string;
}

export interface ProfileDraft {
  kind: ProfileKind;
  topicTemplate: string;
  schemaVersion: string;
  identityStrategy: '' | IdentityStrategy;
  fields: MapRow[];
  timeUnit: '' | (typeof TIME_UNITS)[number];
  maxFutureSkewSeconds: string;
  maxPastSeconds: string;
  onStale: '' | 'reject' | 'flag';
  qualityProtocol: '' | (typeof QUALITY_PROTOCOLS)[number];
  reasonUnmapped: '' | 'reject' | 'keep';
  stateMap: MapRow[];
  reasonMap: MapRow[];
}

/** Contract v1 field paths per profile kind (`message-fields.ts` FIELD_DEFAULTS), shown as placeholders. */
const COMMON_FIELDS = { eventTime: 'ts', sequence: 'seq', bootId: 'boot_id', source: 'source', quality: 'quality', site: 'site', tenant: 'tenant' };
export const FIELD_DEFAULTS: Record<ProfileKind, Record<string, string>> = {
  interval_event_json: {
    ...COMMON_FIELDS,
    eventId: 'event_id',
    revision: 'revision',
    operation: 'operation',
    template: 'template',
    elementPath: 'element_path',
    startTime: 'start_ts',
    endTime: 'end_ts',
    attributes: 'attributes',
    attributeUnits: 'attribute_units',
    reason: 'Reason Code',
  },
  measurement_json: { ...COMMON_FIELDS, signal: 'signal', value: 'value', unit: 'uom' },
  state_json: { ...COMMON_FIELDS, state: 'state', previous: 'previous' },
  availability: { ...COMMON_FIELDS, state: 'state', piConnected: 'pi_connected' },
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  (options as readonly string[]).includes(value as string) ? (value as T) : fallback;
const rowsOf = (value: unknown): MapRow[] =>
  Object.entries(record(value)).map(([token, entry]) => ({ token, value: text(entry) }));

export function profileDraftOf(connection: Pick<ConnectionView, 'endpointConfig'>): ProfileDraft {
  const profile = record(connection.endpointConfig.payloadProfile);
  const time = record(profile.time);
  const maps = record(profile.valueMaps);
  return {
    kind: oneOf(profile.kind, PROFILE_KINDS, 'interval_event_json'),
    topicTemplate: text(profile.topicTemplate),
    schemaVersion: text(profile.schemaVersion),
    identityStrategy: oneOf(profile.identityStrategy, ['', ...IDENTITY_STRATEGIES] as const, ''),
    fields: rowsOf(profile.fields),
    timeUnit: oneOf(time.unit, ['', ...TIME_UNITS] as const, ''),
    maxFutureSkewSeconds: text(time.maxFutureSkewSeconds),
    maxPastSeconds: text(time.maxPastSeconds),
    onStale: oneOf(time.onStale, ['', 'reject', 'flag'] as const, ''),
    qualityProtocol: oneOf(record(profile.quality).protocol, ['', ...QUALITY_PROTOCOLS] as const, ''),
    reasonUnmapped: oneOf(profile.reasonUnmapped, ['', 'reject', 'keep'] as const, ''),
    stateMap: rowsOf(maps.state),
    reasonMap: rowsOf(maps.reason),
  };
}

/** Rows as a map; blank tokens are dropped, the last duplicate wins (as JSON would). */
export function mapOfRows(rows: readonly MapRow[]): Record<string, string> {
  return Object.fromEntries(rows.filter((row) => row.token.trim() !== '').map((row) => [row.token.trim(), row.value.trim()]));
}

export type DraftErrors = Partial<Record<'topicTemplate' | 'fields' | 'maxFutureSkewSeconds' | 'maxPastSeconds' | 'stateMap' | 'reasonMap', string>>;

const FIELD_PATH = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;

function mapRowsProblem(rows: readonly MapRow[]): string | null {
  const empty = rows.find((row) => row.token.trim() !== '' && row.value.trim() === '');
  return empty ? `"${empty.token}" needs a mapped value (no silent default)` : null;
}

/** Client-side rules of the editor (the server re-validates the merged profile). */
export function profileDraftErrors(draft: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  const template = parseTopicTemplate(draft.topicTemplate.trim());
  if (typeof template === 'string') errors.topicTemplate = template;
  else if (draft.kind !== 'availability' && !template.captures.some((name) => name === 'machine' || name === 'unit')) {
    errors.topicTemplate = 'Must capture the equipment level as {machine} or {unit}';
  }
  const badField = draft.fields.find((row) => row.token.trim() !== '' && !FIELD_PATH.test(row.value.trim()));
  if (badField) errors.fields = `"${badField.token}" must be a dotted JSON path`;
  for (const key of ['maxFutureSkewSeconds', 'maxPastSeconds'] as const) {
    if (draft[key].trim() && !/^\d+$/.test(draft[key].trim())) errors[key] = 'Must be an integer >= 0';
  }
  const stateProblem = mapRowsProblem(draft.stateMap) ?? (draft.stateMap.length > 0 ? stateMapProblem(mapOfRows(draft.stateMap)) : null);
  if (stateProblem) errors.stateMap = stateProblem;
  const reasonProblem = mapRowsProblem(draft.reasonMap);
  if (reasonProblem) errors.reasonMap = reasonProblem;
  return errors;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** `{ key: value }` of the entries of `next` that differ from `stored`, with `null` for removed keys. */
function objectPatch(stored: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> | undefined {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(stored)) if (!(key in next)) patch[key] = null;
  for (const [key, value] of Object.entries(next)) if (!same(stored[key], value)) patch[key] = value;
  return Object.keys(patch).length > 0 ? patch : undefined;
}

function timeBlock(draft: ProfileDraft): Record<string, unknown> {
  const time: Record<string, unknown> = {};
  if (draft.timeUnit) time.unit = draft.timeUnit;
  if (draft.maxFutureSkewSeconds.trim()) time.maxFutureSkewSeconds = Number(draft.maxFutureSkewSeconds);
  if (draft.maxPastSeconds.trim()) time.maxPastSeconds = Number(draft.maxPastSeconds);
  if (draft.onStale) time.onStale = draft.onStale;
  return time;
}

/**
 * The merge patch (RFC 7396) that turns the stored profile into the draft; null when nothing changed.
 * Objects are patched key by key (`null` removes), scalars replaced, cleared blocks removed.
 */
export function profilePatchOf(connection: Pick<ConnectionView, 'endpointConfig'>, draft: ProfileDraft): Record<string, unknown> | null {
  const stored = record(connection.endpointConfig.payloadProfile);
  const patch: Record<string, unknown> = {};
  const scalar = (key: string, value: string) => {
    const next = value.trim() === '' ? undefined : value.trim();
    if (!same(stored[key], next)) patch[key] = next ?? null;
  };
  scalar('topicTemplate', draft.topicTemplate);
  scalar('schemaVersion', draft.schemaVersion);
  scalar('identityStrategy', draft.identityStrategy);
  scalar('reasonUnmapped', draft.reasonUnmapped);
  const nextFields = mapOfRows(draft.fields);
  const fields = objectPatch(record(stored.fields), nextFields);
  if (fields) patch.fields = Object.keys(nextFields).length > 0 ? fields : null;
  const time = timeBlock(draft);
  if (!same(record(stored.time), time)) patch.time = Object.keys(time).length > 0 ? objectPatch(record(stored.time), time) : null;
  const quality = draft.qualityProtocol ? { protocol: draft.qualityProtocol } : undefined;
  if (!same(stored.quality, quality)) patch.quality = quality ?? null;
  const maps = record(stored.valueMaps);
  const valueMaps: Record<string, unknown> = {};
  const state = objectPatch(record(maps.state), mapOfRows(draft.stateMap));
  if (state) valueMaps.state = draft.stateMap.length > 0 ? state : null;
  const reason = objectPatch(record(maps.reason), mapOfRows(draft.reasonMap));
  if (reason) valueMaps.reason = draft.reasonMap.length > 0 ? reason : null;
  if (Object.keys(valueMaps).length > 0) patch.valueMaps = valueMaps;
  return Object.keys(patch).length > 0 ? patch : null;
}
