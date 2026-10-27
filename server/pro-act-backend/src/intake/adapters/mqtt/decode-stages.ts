import { createHash } from 'crypto';
import { payloadHash } from '../../envelope/envelope-validator';
import {
  describeViolations,
  validateMqttMessage,
} from './contracts/mqtt-message-validator';
import { SUPPORTED_SCHEMA_VERSIONS } from './contracts/mqtt-message-schemas';
import {
  decodeFailure,
  DecodeFailure,
  DecodeInput,
  DecodeRawRef,
} from './decode-result';
import { MessageFields } from './message-fields';
import { ContractProfileKind, PayloadProfile } from './payload-profile';
import { topicMatchesFilter } from './topic-filter';
import {
  compileTopicTemplate,
  equipmentOf,
  matchTopicTemplate,
} from './topic-template';

/**
 * The stages every profile shares before a field is interpreted (design §4.2 stages 2 and 4, in this
 * order): topic allowlist, size, JSON object, `schema_version`, topic template, contract schema,
 * tenancy claims. Each failure is typed; the host quarantines it and still acknowledges the packet.
 */
export interface PickedMessage {
  json: Record<string, unknown>;
  /** `payloadHash` of the parsed object (canonical JSON, key order independent) */
  hash: string;
  bytes: number;
  captures: Record<string, string>;
  /** the equipment capture, or the topic when the profile captures none */
  equipment: string;
  fields: MessageFields;
  rawRef: DecodeRawRef;
}

/** A packet that passed the transport stages: allowed topic, size limit, a JSON object. */
export interface ParsedPacket {
  json: Record<string, unknown>;
  hash: string;
  rawRef: DecodeRawRef;
}

/** Stages 1–3 only (topic allowlist, size, JSON object): profiles without a contract schema (feeds). */
export function parsePacket(input: DecodeInput): ParsedPacket | DecodeFailure {
  const { config } = input.connection;
  const rawRef = rawRefOf(input);
  if (
    !isAllowed(input.topic, config.mqtt.topics, config.mqtt.availabilityTopic)
  ) {
    return decodeFailure(
      'TOPIC_NOT_ALLOWED',
      `topic ${input.topic} matches no configured topic filter`,
      rawRef,
    );
  }
  if (input.payload.length > config.mqtt.maxMessageBytes) {
    return decodeFailure(
      'TOO_LARGE',
      `payload is ${input.payload.length} bytes (limit ${config.mqtt.maxMessageBytes})`,
      rawRef,
    );
  }
  const json = parseObject(input.payload);
  if (typeof json === 'string') return decodeFailure('NOT_JSON', json, rawRef);
  rawRef.json = json;
  return { json, hash: payloadHash(json), rawRef };
}

export function pickMessage(
  input: DecodeInput,
  kind: ContractProfileKind,
): PickedMessage | DecodeFailure {
  const { config } = input.connection;
  const rawRef = rawRefOf(input);
  if (
    !isAllowed(input.topic, config.mqtt.topics, config.mqtt.availabilityTopic)
  ) {
    return decodeFailure(
      'TOPIC_NOT_ALLOWED',
      `topic ${input.topic} matches no configured topic filter`,
      rawRef,
    );
  }
  if (input.payload.length > config.mqtt.maxMessageBytes) {
    return decodeFailure(
      'TOO_LARGE',
      `payload is ${input.payload.length} bytes (limit ${config.mqtt.maxMessageBytes})`,
      rawRef,
    );
  }
  const json = parseObject(input.payload);
  if (typeof json === 'string') return decodeFailure('NOT_JSON', json, rawRef);
  rawRef.json = json;
  const profile = config.payloadProfile;
  const version = versionProblem(json, profile);
  if (version) return decodeFailure('UNSUPPORTED_VERSION', version, rawRef);
  const shape = matchShape(
    input.topic,
    kind,
    profile,
    config.mqtt.availabilityTopic,
  );
  if (typeof shape === 'string')
    return decodeFailure('TOPIC_SHAPE', shape, rawRef);
  const violations = validateMqttMessage(kind, json);
  if (violations.length > 0) {
    return decodeFailure(
      'SCHEMA_INVALID',
      describeViolations(violations),
      rawRef,
    );
  }
  const fields = new MessageFields(kind, profile, json);
  const mismatch = claimMismatch(profile, shape, fields);
  if (mismatch) return decodeFailure('IDENTITY_MISMATCH', mismatch, rawRef);
  return {
    json,
    hash: payloadHash(json),
    bytes: input.payload.length,
    captures: shape,
    equipment: equipmentOf(shape) ?? input.topic,
    fields,
    rawRef,
  };
}

function rawRefOf(input: DecodeInput): DecodeRawRef {
  return {
    topic: input.topic,
    bytes: input.payload.length,
    payloadHash: `sha256:${createHash('sha256').update(input.payload).digest('hex')}`,
  };
}

/** Defence in depth: the broker ACL is not trusted alone (design stage 2). */
function isAllowed(
  topic: string,
  filters: readonly string[],
  availabilityTopic: string | undefined,
): boolean {
  const all = availabilityTopic ? [...filters, availabilityTopic] : filters;
  return all.some((filter) => topicMatchesFilter(topic, filter));
}

/** The parsed JSON object, or the problem (not UTF-8 JSON, or not an object). */
function parseObject(payload: Buffer): Record<string, unknown> | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString('utf8'));
  } catch (error: unknown) {
    return `payload is not JSON: ${error instanceof Error ? error.message : 'parse error'}`;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return `payload must be a JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`;
  }
  return parsed as Record<string, unknown>;
}

function versionProblem(
  json: Record<string, unknown>,
  profile: PayloadProfile,
): string | null {
  const version = json.schema_version;
  if (typeof version !== 'string') return 'schema_version is missing';
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
    return `schema_version ${version} is not supported (${SUPPORTED_SCHEMA_VERSIONS.join(', ')})`;
  }
  if (profile.schemaVersion && profile.schemaVersion !== version) {
    return `schema_version ${version} differs from the profile's ${profile.schemaVersion}`;
  }
  return null;
}

/**
 * Captures of the topic under the profile template; the availability topic of a non-availability
 * profile is checked against the `availabilityTopic` filter instead (it captures nothing).
 */
function matchShape(
  topic: string,
  kind: ContractProfileKind,
  profile: PayloadProfile,
  availabilityTopic: string | undefined,
): Record<string, string> | string {
  if (kind === 'availability' && profile.kind !== 'availability') {
    return availabilityTopic && topicMatchesFilter(topic, availabilityTopic)
      ? {}
      : `topic ${topic} is not the availability topic`;
  }
  const compiled = compileTopicTemplate(profile.topicTemplate, kind);
  if (typeof compiled === 'string') {
    return `topicTemplate misconfigured: ${compiled}`;
  }
  const match = matchTopicTemplate(compiled, topic);
  return match.ok ? match.captures : match.detail;
}

/**
 * Stage 4: a site / tenant claim in the topic captures or the payload is compared with the
 * connection's expectation and never used (MQ01). No claim present = nothing to contradict.
 */
function claimMismatch(
  profile: PayloadProfile,
  captures: Record<string, string>,
  fields: MessageFields,
): string | null {
  const expected = profile.tenancy;
  if (!expected) return null;
  const checks: Array<[string, string | undefined, string]> = [
    ['site', expected.expectedSite, 'site'],
    ['tenant', expected.expectedTenantClaim, 'tenant'],
  ];
  for (const [capture, wanted, field] of checks) {
    if (wanted === undefined) continue;
    const claims = [captures[capture], fields.get(field)].filter(
      (claim): claim is string => typeof claim === 'string',
    );
    const other = claims.find((claim) => claim !== wanted);
    if (other !== undefined) {
      return `${capture} claim "${other}" differs from the connection's expected ${capture} "${wanted}"`;
    }
  }
  return null;
}
