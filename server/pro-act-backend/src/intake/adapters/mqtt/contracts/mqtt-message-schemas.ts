import { ContractProfileKind } from '../payload-profile';

/**
 * Checked copies of `contracts/mqtt/*.v1.schema.json` (JSON Schema 2020-12, OT contract §3) so the
 * backend does not read files outside its build context at runtime. `mqtt-message-schemas.spec.ts`
 * fails when a copy and its published contract drift apart. One schema per payload profile kind.
 */
const CONTRACT_BASE = 'https://proact.local/contracts/mqtt';

/** RFC 3339 with an explicit offset or `Z` (contract §3: never local time, never epoch integers). */
export const RFC3339_PATTERN =
  '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$';
/** RFC 3339 and before the year 9000: the PI open-frame sentinel (9999-12-31) is never accepted. */
const BEFORE_YEAR_9000_PATTERN =
  '^[0-8][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$';

const TIMESTAMP = {
  type: 'string',
  format: 'date-time',
  pattern: RFC3339_PATTERN,
  description:
    'RFC 3339 with explicit offset or Z; source time, never publish time.',
};

/** PI value flags (contract §3.4) or a string token for bridged systems (STRING_ENUM decoder). */
const QUALITY = {
  description:
    'PI value flags (good / questionable / substituted / annotated) or a string token of another convention; omit only when the source has no quality concept. Missing is never treated as good.',
  anyOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        good: { type: 'boolean' },
        questionable: { type: 'boolean' },
        substituted: { type: 'boolean' },
        annotated: { type: 'boolean' },
      },
    },
    { type: 'string', minLength: 1, maxLength: 64 },
  ],
};

/** `{ name, value }` of an enumeration set (PI digital state). */
const DIGITAL_STATE = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 256 },
    value: { type: 'integer' },
  },
};

/** Fields every contract message carries (contract §3, common rules). */
const COMMON_PROPERTIES = {
  schema_version: { type: 'string', const: '1.0' },
  ts: TIMESTAMP,
  seq: {
    type: 'integer',
    minimum: 0,
    description:
      'Monotonic per publisher session; restarts at 0 with every boot_id.',
  },
  boot_id: {
    type: 'string',
    minLength: 1,
    maxLength: 128,
    description:
      'Changes on every publisher (re)start; boot_id + seq is the delivery identity.',
  },
  source: { type: 'string', minLength: 1, maxLength: 128 },
  quality: QUALITY,
};

export const INTERVAL_EVENT_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${CONTRACT_BASE}/interval-event.v1.schema.json`,
  title: 'Pro-Act MQTT interval event v1',
  description:
    'One message per event frame change on …/events (OT contract §3.1): creation (open or closed), update (end time set, attribute changed) or deletion. event_id + revision make a message idempotent; end_ts is null while the event is open and never the PI 9999 sentinel.',
  type: 'object',
  additionalProperties: false,
  required: [
    'schema_version',
    'event_id',
    'revision',
    'operation',
    'ts',
    'seq',
    'boot_id',
  ],
  properties: {
    ...COMMON_PROPERTIES,
    event_id: {
      type: 'string',
      minLength: 1,
      maxLength: 256,
      description:
        'Stable for the life of the event: PI Event Frame ID or WebId, or an RFC 9562 UUID.',
    },
    revision: {
      type: ['string', 'integer'],
      minLength: 1,
      maxLength: 64,
      minimum: 0,
      description:
        'Changes on every update: EF LastModified (RFC 3339) or an integer version.',
    },
    operation: { type: 'string', enum: ['upsert', 'delete'] },
    template: { type: 'string', minLength: 1, maxLength: 256 },
    element_path: {
      type: 'string',
      minLength: 1,
      maxLength: 1024,
      description: 'AF path of the primary referenced element.',
    },
    start_ts: TIMESTAMP,
    end_ts: {
      type: ['string', 'null'],
      format: 'date-time',
      pattern: BEFORE_YEAR_9000_PATTERN,
      description: 'Null while open; never the PI 9999 sentinel.',
    },
    attributes: {
      type: 'object',
      description:
        'EF attribute values by attribute name, exactly as named in the template.',
      additionalProperties: {
        anyOf: [
          { type: 'number' },
          { type: 'string', maxLength: 4096 },
          { type: 'boolean' },
          { type: 'null' },
          { ...DIGITAL_STATE, required: ['name', 'value'] },
        ],
      },
    },
    attribute_units: {
      type: 'object',
      additionalProperties: { type: 'string', maxLength: 32 },
    },
  },
  allOf: [
    {
      if: { properties: { operation: { const: 'upsert' } } },
      then: { required: ['template', 'element_path', 'start_ts'] },
    },
  ],
} as const;

export const MEASUREMENT_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${CONTRACT_BASE}/measurement.v1.schema.json`,
  title: 'Pro-Act MQTT measurement v1',
  description:
    'One sample of a counter, rate or level on …/measurements/{attribute} (OT contract §3.2). value is a number, a boolean or a digital state { name, value }; uom is the PI UOM abbreviation.',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'signal', 'value', 'ts', 'seq', 'boot_id'],
  properties: {
    ...COMMON_PROPERTIES,
    signal: {
      type: 'string',
      minLength: 1,
      maxLength: 512,
      description:
        'Stable id of the PI point / AF attribute (WebId or full AF attribute path).',
    },
    value: {
      anyOf: [
        { type: 'number' },
        { type: 'boolean' },
        { ...DIGITAL_STATE, required: ['name', 'value'] },
      ],
    },
    uom: { type: 'string', maxLength: 32 },
  },
} as const;

export const STATE_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${CONTRACT_BASE}/state.v1.schema.json`,
  title: 'Pro-Act MQTT run state v1',
  description:
    'The current run state of a unit on …/state, published retained (OT contract §3.3, optional). A retained state is stored state, never a new transition; the vocabulary is mapped per connection.',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'state', 'ts', 'seq', 'boot_id'],
  properties: {
    ...COMMON_PROPERTIES,
    state: DIGITAL_STATE,
    previous: { anyOf: [DIGITAL_STATE, { type: 'null' }] },
  },
} as const;

export const AVAILABILITY_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${CONTRACT_BASE}/availability.v1.schema.json`,
  title: 'Pro-Act MQTT gateway availability v1',
  description:
    'Publisher liveness on …/gateway/availability (OT contract §3.5): retained ONLINE on connect, OFFLINE as the Last Will and on clean shutdown. seq is optional because a Last Will is registered before any sequence exists.',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'state', 'ts', 'boot_id'],
  properties: {
    ...COMMON_PROPERTIES,
    state: { type: 'string', enum: ['ONLINE', 'OFFLINE'] },
    pi_connected: {
      type: 'boolean',
      description:
        'Whether the gateway itself can reach PI; false marks the source degraded.',
    },
  },
} as const;

/** The contract schema of each payload profile kind. */
export const MQTT_MESSAGE_SCHEMAS = {
  interval_event_json: INTERVAL_EVENT_V1_SCHEMA,
  measurement_json: MEASUREMENT_V1_SCHEMA,
  state_json: STATE_V1_SCHEMA,
  availability: AVAILABILITY_V1_SCHEMA,
} as const satisfies Record<ContractProfileKind, object>;

/** The schema versions a decoder accepts for a profile kind (contract §3: `schema_version`). */
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = ['1.0'];

const CONTRACT_FILES: Record<ContractProfileKind, string> = {
  interval_event_json: 'interval-event.v1.schema.json',
  measurement_json: 'measurement.v1.schema.json',
  state_json: 'state.v1.schema.json',
  availability: 'availability.v1.schema.json',
};

/** File name of the published contract of a profile kind under `contracts/mqtt/`. */
export function contractFileOf(kind: ContractProfileKind): string {
  return CONTRACT_FILES[kind];
}
