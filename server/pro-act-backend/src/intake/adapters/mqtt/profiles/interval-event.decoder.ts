import { EnvelopeAttribute } from '../../../envelope/canonical-envelope';
import {
  decodeFailure,
  DecodeFailure,
  DecodeInput,
  DecodeResult,
  ProfileDecoder,
} from '../decode-result';
import { PickedMessage, pickMessage } from '../decode-stages';
import { buildEnvelope, EnvelopeParts } from '../envelope-base';
import { eventSourceObjectId, messageIdFor, revisionOf } from '../identity';
import { digitalOf } from '../message-fields';
import { PayloadProfile } from '../payload-profile';
import { parseRfc3339 } from '../time-rules';
import { mapReason } from '../value-maps';
import { decodeTiming, failureOf, isFailure } from './profile-support';

/**
 * Contract §3.1 events → `kind = interval_event` (design §5, integration plan WP2 table): one message
 * per event-frame change. `upsert` is an observation of the event's current version (start, end null
 * while open, template, attributes by name); `delete` is a retraction of it. Identity: message
 * `<event_id>:<revision>`, source object `<equipment>:<event_id>`, revision ordered by `ts`.
 */
const KIND = 'interval_event_json';
const YEAR_9000 = Date.UTC(9000, 0, 1);

export const intervalEventDecoder: ProfileDecoder = {
  kind: KIND,
  decode(input: DecodeInput): DecodeResult {
    const picked = pickMessage(input, KIND);
    if (isFailure(picked)) return picked;
    const timing = decodeTiming(input, picked, KIND);
    if (isFailure(timing)) return timing;
    const profile = input.connection.config.payloadProfile;
    const eventId = picked.fields.string('eventId') ?? '';
    const revision = revisionOf(picked.fields.get('revision'));
    const identity = messageIdFor(profile.identityStrategy ?? 'event_id', {
      equipment: picked.equipment,
      bootId: timing.common.bootId,
      seq: timing.common.seq,
      eventId,
      revision,
      payloadHash: picked.hash,
      eventTime: timing.observedAt,
    });
    if (!identity.ok) return failureOf(identity, picked.rawRef);
    const base = {
      messageId: identity.messageId,
      sourceObjectId: eventSourceObjectId(picked.equipment, eventId),
      sourceRevision: revision,
      observedAt: timing.observedAt,
      quality: timing.quality,
      controls: { eventId, revision },
    };
    const parts =
      picked.fields.get('operation') === 'delete'
        ? deletion(input, base, revision)
        : upsert(input, picked, profile, base);
    if (isFailure(parts)) return parts;
    return {
      ok: true,
      envelope: buildEnvelope(input, picked, timing.common, parts),
    };
  },
};

type BaseParts = Pick<
  EnvelopeParts,
  | 'messageId'
  | 'sourceObjectId'
  | 'sourceRevision'
  | 'observedAt'
  | 'quality'
  | 'controls'
>;

/** `operation: delete` → retraction of the event (handled by `RetractionHandler`). */
function deletion(
  input: DecodeInput,
  base: BaseParts,
  revision: string | null,
): EnvelopeParts {
  return {
    ...base,
    operation: 'retract',
    kind: 'retraction',
    sourcePath: input.topic,
    retraction: {
      reason: 'deleted at the source (operation delete)',
      retractsRevision: revision,
    },
  };
}

function upsert(
  input: DecodeInput,
  picked: PickedMessage,
  profile: PayloadProfile,
  base: BaseParts,
): EnvelopeParts | DecodeFailure {
  const interval = intervalOf(picked);
  if (isFailure(interval)) return interval;
  const attributes = attributesOf(picked, profile);
  if (isFailure(attributes)) return attributes;
  return {
    ...base,
    operation: 'observe',
    kind: 'interval_event',
    startTime: interval.startTime,
    endTime: interval.endTime,
    sourcePath: picked.fields.string('elementPath') ?? input.topic,
    values: {
      templateName: picked.fields.string('template'),
      attributes,
    },
  };
}

/** Half-open `[start_ts, end_ts)`; `end_ts` null while open, never the 9999 sentinel, never before the start. */
function intervalOf(
  picked: PickedMessage,
): { startTime: string; endTime: string | null } | DecodeFailure {
  const start = parseRfc3339(picked.fields.get('startTime'));
  if (!start.ok) {
    return decodeFailure(
      'SCHEMA_INVALID',
      `start_ts: ${start.detail}`,
      picked.rawRef,
    );
  }
  const rawEnd = picked.fields.get('endTime');
  if (rawEnd === undefined || rawEnd === null) {
    return { startTime: start.at.toISOString(), endTime: null };
  }
  const end = parseRfc3339(rawEnd);
  if (!end.ok) {
    return decodeFailure(
      'SCHEMA_INVALID',
      `end_ts: ${end.detail}`,
      picked.rawRef,
    );
  }
  if (end.at.getTime() >= YEAR_9000) {
    return decodeFailure(
      'SCHEMA_INVALID',
      'end_ts: the PI open-frame sentinel is not allowed; send null while open',
      picked.rawRef,
    );
  }
  if (end.at.getTime() < start.at.getTime()) {
    return decodeFailure(
      'SCHEMA_INVALID',
      'end_ts is before start_ts',
      picked.rawRef,
    );
  }
  return { startTime: start.at.toISOString(), endTime: end.at.toISOString() };
}

/** `attributes{}` by name → typed envelope attributes; the reason attribute goes through `valueMaps.reason`. */
function attributesOf(
  picked: PickedMessage,
  profile: PayloadProfile,
): EnvelopeAttribute[] | DecodeFailure {
  const raw = picked.fields.get('attributes');
  const units = picked.fields.get('attributeUnits');
  if (typeof raw !== 'object' || raw === null) return [];
  const reasonName = picked.fields.pathOf('reason');
  const result: EnvelopeAttribute[] = [];
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const unit = unitOf(units, name);
    if (name === reasonName && profile.valueMaps?.reason) {
      const mapped = mapReason(profile, value);
      if (!mapped.ok) return failureOf(mapped, picked.rawRef);
      result.push({ name, type: 'string', value: mapped.value, unit });
      continue;
    }
    result.push(attributeOf(name, value, unit));
  }
  return result;
}

function attributeOf(
  name: string,
  value: unknown,
  unit: string | null,
): EnvelopeAttribute {
  const digital = digitalOf(value);
  if (digital) return { name, type: 'digital', digital, unit };
  const type: EnvelopeAttribute['type'] =
    typeof value === 'number'
      ? 'number'
      : typeof value === 'boolean'
        ? 'boolean'
        : 'string';
  return { name, type, value: value ?? null, unit };
}

function unitOf(units: unknown, name: string): string | null {
  if (typeof units !== 'object' || units === null) return null;
  const unit = (units as Record<string, unknown>)[name];
  return typeof unit === 'string' && unit.length > 0 ? unit : null;
}
