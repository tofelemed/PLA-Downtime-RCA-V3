import { FeedSpec, validateFeeds } from './feeds/feed-profile';
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
  'feeds',
] as const;
export type PayloadProfileKind = (typeof PAYLOAD_PROFILE_KINDS)[number];
/** The contract-v1 kinds (a schema, a topic template, field defaults); `feeds` maps its own fields. */
export type ContractProfileKind = Exclude<PayloadProfileKind, 'feeds'>;
export const CONTRACT_PROFILE_KINDS = PAYLOAD_PROFILE_KINDS.filter(
  (kind): kind is ContractProfileKind => kind !== 'feeds',
);

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
/** What a timestamp older than `maxPastSeconds` does: reject (events) or flag `quality.degraded` (samples). */
export const STALE_HANDLING = ['reject', 'flag'] as const;
/** What an unmapped reason token does: reject (`UNMAPPED_VALUE`) or keep the raw token (event created uncoded). */
export const REASON_UNMAPPED = ['reject', 'keep'] as const;

/** Topic levels that identify the equipment; one of them must be captured by equipment profiles. */
export const EQUIPMENT_CAPTURES: readonly string[] = ['machine', 'unit'];
const PROFILES_WITHOUT_EQUIPMENT: ReadonlySet<PayloadProfileKind> = new Set([
  'availability',
  'feeds',
]);

export interface PayloadProfile {
  kind: PayloadProfileKind;
  /** contract-v1 kinds only; a feeds profile reads its topics from `feeds` */
  topicTemplate: string;
  /** `kind = 'feeds'`: PLA and downtime topics of one connection (plans/MQTT_FEEDS.md) */
  feeds?: FeedSpec[];
  schemaVersion?: string;
  fields?: Record<string, string>;
  time?: {
    unit?: (typeof TIME_UNITS)[number];
    maxFutureSkewSeconds?: number;
    maxPastSeconds?: number;
    onStale?: (typeof STALE_HANDLING)[number];
  };
  quality?: { protocol?: (typeof QUALITY_PROTOCOLS)[number] };
  identityStrategy?: (typeof IDENTITY_STRATEGIES)[number];
  valueMaps?: {
    state?: Record<string, string>;
    reason?: Record<string, string>;
  };
  reasonUnmapped?: (typeof REASON_UNMAPPED)[number];
  /** Expected claims checked against the topic captures / payload fields; never used as tenancy (MQ01). */
  tenancy?: {
    expectedSite?: string;
    expectedTenantClaim?: string;
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
  'reasonUnmapped',
  'tenancy',
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
  if (
    value.onStale !== undefined &&
    !(STALE_HANDLING as readonly unknown[]).includes(value.onStale)
  ) {
    problems.push(
      `payloadProfile.time.onStale: must be one of ${STALE_HANDLING.join(', ')}`,
    );
  }
}

function validateTenancy(value: unknown, problems: Problems): void {
  if (!isRecord(value)) {
    problems.push('payloadProfile.tenancy: must be an object');
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== 'expectedSite' && key !== 'expectedTenantClaim') {
      problems.push(`payloadProfile.tenancy.${key}: unknown setting`);
    } else if (typeof value[key] !== 'string' || value[key] === '') {
      problems.push(
        `payloadProfile.tenancy.${key}: must be a non-empty string`,
      );
    }
  }
}

/**
 * A state map that maps no token to a required state would quarantine every running or stopped
 * observation as `unmapped_value` (design §10: un-mapping a required state name is refused).
 */
export const REQUIRED_STATE_NAMES: readonly string[] = ['running', 'stopped'];

/** The problem with a state value map, or null: at least one token must map to running or stopped. */
export function stateMapProblem(map: unknown): string | null {
  if (!isRecord(map)) return null;
  const targets = Object.values(map).filter(
    (entry): entry is string => typeof entry === 'string',
  );
  if (targets.some((entry) => REQUIRED_STATE_NAMES.includes(entry))) {
    return null;
  }
  return `must map at least one token to ${REQUIRED_STATE_NAMES.join(' or ')}`;
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
  const stateProblem = stateMapProblem(value.state);
  if (stateProblem) {
    problems.push(`payloadProfile.valueMaps.state: ${stateProblem}`);
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
  if (profile.kind === 'feeds') return validateFeedsProfile(profile);
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
  if (
    profile.reasonUnmapped !== undefined &&
    !(REASON_UNMAPPED as readonly unknown[]).includes(profile.reasonUnmapped)
  ) {
    problems.push(
      `payloadProfile.reasonUnmapped: must be one of ${REASON_UNMAPPED.join(', ')}`,
    );
  }
  if (profile.tenancy !== undefined) validateTenancy(profile.tenancy, problems);
  return problems;
}

/** A feeds profile carries only its feeds (no template, identity or value maps). */
function validateFeedsProfile(profile: Record<string, unknown>): string[] {
  const unknown = Object.keys(profile)
    .filter((key) => key !== 'kind' && key !== 'feeds')
    .map((key) => `payloadProfile.${key}: not used by a feeds profile`);
  return [...unknown, ...validateFeeds(profile.feeds)];
}
