import { topicFiltersOverlap } from './topic-filter';

/**
 * Payload profile of an MQTT connection (plan 1.8 design §3 / §5, integration plan WP3 step 2): which
 * decoder reads the messages and how topic captures, fields, time, quality and identity are read.
 * Only the shape is validated here; the decoders arrive with step 2.
 */
export const PAYLOAD_PROFILE_KINDS = [
  'interval_event_json',
  'measurement_json',
  'state_json',
  'availability',
] as const;
export type PayloadProfileKind = (typeof PAYLOAD_PROFILE_KINDS)[number];

export const TIME_UNITS = ['auto', 'ms', 's', 'iso'] as const;
export const QUALITY_PROTOCOLS = [
  'STRING_ENUM',
  'OPC_DA',
  'OPC_UA',
  'SPARKPLUG',
  'PI',
  'NONE',
] as const;
export const IDENTITY_STRATEGIES = [
  'seq_boot',
  'event_id',
  'payload_hash',
] as const;

/** Topic levels that identify the equipment; one of them must be captured by equipment profiles. */
export const EQUIPMENT_CAPTURES: readonly string[] = ['machine', 'unit'];
const PROFILES_WITHOUT_EQUIPMENT: ReadonlySet<PayloadProfileKind> = new Set([
  'availability',
]);

export interface PayloadProfile {
  kind: PayloadProfileKind;
  topicTemplate: string;
  schemaVersion?: string;
  fields?: Record<string, string>;
  time?: {
    unit?: (typeof TIME_UNITS)[number];
    maxFutureSkewSeconds?: number;
    maxPastSeconds?: number;
  };
  quality?: { protocol?: (typeof QUALITY_PROTOCOLS)[number] };
  identityStrategy?: (typeof IDENTITY_STRATEGIES)[number];
  valueMaps?: {
    state?: Record<string, string>;
    reason?: Record<string, string>;
  };
}

const CAPTURE = /^\{([a-z][A-Za-z0-9_]*)\}$/;
const FIELD_PATH = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  'kind',
  'topicTemplate',
  'schemaVersion',
  'fields',
  'time',
  'quality',
  'identityStrategy',
  'valueMaps',
]);

type Problems = string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Capture names of a topic template, or the problem with it. */
export function parseTopicTemplate(
  template: unknown,
): { captures: string[]; filter: string } | string {
  if (typeof template !== 'string' || template.length === 0) {
    return 'must be a non-empty topic template';
  }
  const captures: string[] = [];
  const levels: string[] = [];
  for (const level of template.split('/')) {
    const capture = CAPTURE.exec(level);
    if (capture) {
      if (captures.includes(capture[1])) {
        return `captures {${capture[1]}} more than once`;
      }
      captures.push(capture[1]);
      levels.push('+');
      continue;
    }
    if (/[+#{}]/.test(level) || level.length === 0) {
      return `level "${level}" must be a literal or a {capture}`;
    }
    levels.push(level);
  }
  return { captures, filter: levels.join('/') };
}

function validateTemplate(
  profile: Record<string, unknown>,
  kind: PayloadProfileKind | null,
  topics: readonly string[],
  problems: Problems,
): void {
  const parsed = parseTopicTemplate(profile.topicTemplate);
  if (typeof parsed === 'string') {
    problems.push(`payloadProfile.topicTemplate: ${parsed}`);
    return;
  }
  if (
    kind &&
    !PROFILES_WITHOUT_EQUIPMENT.has(kind) &&
    !parsed.captures.some((name) => EQUIPMENT_CAPTURES.includes(name))
  ) {
    problems.push(
      `payloadProfile.topicTemplate: must capture the equipment level as {${EQUIPMENT_CAPTURES.join('} or {')}} for ${kind}`,
    );
  }
  if (
    topics.length > 0 &&
    !topics.some((filter) => topicFiltersOverlap(filter, parsed.filter))
  ) {
    problems.push(
      'payloadProfile.topicTemplate: no topic filter of mqtt.topics can match this template',
    );
  }
}

function validateStringMap(
  value: unknown,
  path: string,
  problems: Problems,
  pattern?: RegExp,
): void {
  if (!isRecord(value)) {
    problems.push(`${path}: must be an object of strings`);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' || entry.length === 0) {
      problems.push(`${path}.${key}: must be a non-empty string`);
    } else if (pattern && !pattern.test(entry)) {
      problems.push(`${path}.${key}: must be a dotted JSON path`);
    }
  }
}

function validateTime(value: unknown, problems: Problems): void {
  if (!isRecord(value)) {
    problems.push('payloadProfile.time: must be an object');
    return;
  }
  if (
    value.unit !== undefined &&
    !(TIME_UNITS as readonly unknown[]).includes(value.unit)
  ) {
    problems.push(
      `payloadProfile.time.unit: must be one of ${TIME_UNITS.join(', ')}`,
    );
  }
  for (const key of ['maxFutureSkewSeconds', 'maxPastSeconds'] as const) {
    if (value[key] !== undefined && !isNonNegativeInt(value[key])) {
      problems.push(`payloadProfile.time.${key}: must be an integer >= 0`);
    }
  }
}

function validateValueMaps(value: unknown, problems: Problems): void {
  if (!isRecord(value)) {
    problems.push('payloadProfile.valueMaps: must be an object');
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== 'state' && key !== 'reason') {
      problems.push(`payloadProfile.valueMaps.${key}: unknown value map`);
      continue;
    }
    validateStringMap(value[key], `payloadProfile.valueMaps.${key}`, problems);
  }
}

/**
 * Problems of a payload profile (`<path>: <message>` each; empty = valid). `topics` are the connection's
 * topic filters: at least one must be able to match the template.
 */
export function validatePayloadProfile(
  profile: unknown,
  topics: readonly string[],
): string[] {
  if (!isRecord(profile)) return ['payloadProfile: required object'];
  const problems: Problems = [];
  for (const key of Object.keys(profile)) {
    if (!KNOWN_KEYS.has(key))
      problems.push(`payloadProfile.${key}: unknown setting`);
  }
  const kind = (PAYLOAD_PROFILE_KINDS as readonly unknown[]).includes(
    profile.kind,
  )
    ? (profile.kind as PayloadProfileKind)
    : null;
  if (!kind) {
    problems.push(
      `payloadProfile.kind: must be one of ${PAYLOAD_PROFILE_KINDS.join(', ')}`,
    );
  }
  validateTemplate(profile, kind, topics, problems);
  if (
    profile.schemaVersion !== undefined &&
    typeof profile.schemaVersion !== 'string'
  ) {
    problems.push('payloadProfile.schemaVersion: must be a string');
  }
  if (profile.fields !== undefined) {
    validateStringMap(
      profile.fields,
      'payloadProfile.fields',
      problems,
      FIELD_PATH,
    );
  }
  if (profile.time !== undefined) validateTime(profile.time, problems);
  if (profile.quality !== undefined) {
    const protocol = isRecord(profile.quality)
      ? profile.quality.protocol
      : undefined;
    if (
      !isRecord(profile.quality) ||
      (protocol !== undefined &&
        !(QUALITY_PROTOCOLS as readonly unknown[]).includes(protocol))
    ) {
      problems.push(
        `payloadProfile.quality.protocol: must be one of ${QUALITY_PROTOCOLS.join(', ')}`,
      );
    }
  }
  if (
    profile.identityStrategy !== undefined &&
    !(IDENTITY_STRATEGIES as readonly unknown[]).includes(
      profile.identityStrategy,
    )
  ) {
    problems.push(
      `payloadProfile.identityStrategy: must be one of ${IDENTITY_STRATEGIES.join(', ')}`,
    );
  }
  if (profile.valueMaps !== undefined)
    validateValueMaps(profile.valueMaps, problems);
  return problems;
}
