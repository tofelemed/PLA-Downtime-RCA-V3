import {
  LOCATION_SCHEMA,
  PROVENANCE_SCHEMA,
  QUALITY_SCHEMA,
  RETRACTION_SCHEMA,
  SOURCE_CONTROLS_SCHEMA,
} from './canonical-event-context.schema';
import { VALUES_SCHEMA } from './canonical-event-values.schema';

/**
 * Checked copy of `contracts/canonical-event.schema.json` (JSON Schema 2020-12, spec §5.1) so the
 * backend does not read files outside its build context at runtime. `canonical-event.schema.spec.ts`
 * fails when this copy and the published contract drift apart.
 */
export const CANONICAL_EVENT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://proact.local/contracts/canonical-event.schema.json',
  title: 'ProAct canonical ingestion envelope',
  description:
    'Versioned envelope every adapter (PI Web API, MQTT, Kafka, future OPC UA/imports) emits into the intake pipeline (spec section 5.1, FND01-FND04, ING01). Logical identity = tenantId + connectionId + sourceObjectId; delivery identity = tenantId + connectionId + messageId. Completed in plan 1.5; the backend validates every envelope against this file (src/intake/envelope/canonical-event.schema.ts is the checked copy).',
  type: 'object',
  required: [
    'schemaVersion',
    'messageId',
    'tenantId',
    'connectionId',
    'sourceType',
    'sourceObjectId',
    'operation',
    'kind',
    'observedAt',
    'receivedAt',
    'location',
    'quality',
    'provenance',
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: '1.0' },
    messageId: {
      type: 'string',
      minLength: 1,
      description:
        'Identifies one delivery (dedupe key with tenantId + connectionId).',
    },
    tenantId: {
      type: 'string',
      format: 'uuid',
      description:
        "Checked against the connector's authenticated binding; never grants access.",
    },
    connectionId: { type: 'string', format: 'uuid' },
    sourceType: {
      type: 'string',
      enum: [
        'pi_web_api',
        'mqtt',
        'kafka',
        'opc_ua',
        'rest_import',
        'file_import',
        'db_import',
        'manual',
      ],
    },
    sourceObjectId: {
      type: 'string',
      minLength: 1,
      description:
        'Stable identity of the source object (e.g. PI WebId, topic+device id). Logical identity = tenant + connection + sourceObjectId.',
    },
    sourceRevision: {
      type: ['string', 'null'],
      description:
        'Source version/revision when the source has one; otherwise null and contentHash is used.',
    },
    operation: {
      type: 'string',
      enum: ['observe', 'correct', 'retract'],
      description:
        'ING01: independent observation, correction of an earlier revision, or retraction (tombstone).',
    },
    kind: {
      type: 'string',
      enum: [
        'interval_event',
        'measurement',
        'state',
        'output_event',
        'retraction',
      ],
    },
    observedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Event time at the source (UTC).',
    },
    receivedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the connector received it (UTC).',
    },
    startTime: {
      type: 'string',
      format: 'date-time',
      description: 'Interval kinds only.',
    },
    endTime: {
      type: ['string', 'null'],
      format: 'date-time',
      description:
        'Null = open interval. Source sentinels (e.g. 9999-12-31) are normalised to null and kept in rawPayload.',
    },
    sourceTimezone: {
      type: ['string', 'null'],
      description: 'IANA zone if the source supplied local times.',
    },
    location: LOCATION_SCHEMA,
    values: VALUES_SCHEMA,
    quality: QUALITY_SCHEMA,
    provenance: PROVENANCE_SCHEMA,
    sourceControls: SOURCE_CONTROLS_SCHEMA,
    retraction: RETRACTION_SCHEMA,
  },
  allOf: [
    {
      if: {
        properties: { kind: { enum: ['interval_event', 'output_event'] } },
      },
      then: { required: ['startTime'] },
    },
    {
      if: { properties: { kind: { const: 'measurement' } } },
      then: {
        required: ['values'],
        properties: { values: { type: 'object', required: ['sample'] } },
      },
    },
    {
      if: { properties: { kind: { const: 'state' } } },
      then: {
        required: ['values'],
        properties: { values: { type: 'object', required: ['state'] } },
      },
    },
    {
      if: { properties: { kind: { const: 'retraction' } } },
      then: { properties: { operation: { const: 'retract' } } },
    },
    {
      if: { properties: { operation: { const: 'retract' } } },
      then: { required: ['sourceRevision'] },
    },
  ],
} as const;
