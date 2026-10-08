/** Location, quality, provenance, source controls and retraction parts of the canonical envelope (spec §5.1). */
export const LOCATION_SCHEMA = {
  type: 'object',
  required: ['sourcePath'],
  additionalProperties: false,
  properties: {
    sourcePath: {
      type: 'string',
      description: 'Source asset path or identifier as delivered.',
    },
    sourceElementIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ancestor identifiers for mapping (e.g. AF element WebIds).',
    },
    unitId: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'Assigned by mapping, never guessed by the adapter.',
    },
    assetId: { type: ['string', 'null'], format: 'uuid' },
  },
} as const;

export const QUALITY_SCHEMA = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['good', 'uncertain', 'bad', 'missing'] },
    sourceFlags: { type: 'array', items: { type: 'string' } },
    reason: { type: ['string', 'null'] },
    degraded: {
      type: 'boolean',
      description: 'e.g. timestamp substituted by receive time (MQ03).',
    },
  },
} as const;

export const PROVENANCE_SCHEMA = {
  type: 'object',
  required: ['payloadHash', 'mappingVersion', 'correlationId'],
  additionalProperties: false,
  properties: {
    rawPayload: { description: 'Inline raw payload when <= 1 MiB.' },
    rawPayloadRef: {
      type: ['string', 'null'],
      description: 'Object-store reference when the payload is large (KF04).',
    },
    payloadHash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    sourceCursor: {
      type: ['object', 'null'],
      description: 'Adapter checkpoint context (window, page, offset).',
    },
    mappingVersion: { type: 'integer', minimum: 0 },
    correlationId: { type: 'string' },
    replayRunId: {
      type: ['string', 'null'],
      format: 'uuid',
      description:
        'Set on replays; the envelope keeps the original messageId and identity so intake links the delivery to the first one.',
    },
  },
} as const;

export const SOURCE_CONTROLS_SCHEMA = {
  type: 'object',
  description: 'Protocol-specific controls (section 5.1 last row).',
  additionalProperties: false,
  properties: {
    mqtt: {
      type: 'object',
      properties: {
        retained: { type: 'boolean' },
        duplicate: { type: 'boolean' },
        qos: { type: 'integer' },
        bootId: { type: ['string', 'null'] },
        sequence: { type: ['integer', 'null'] },
      },
    },
    kafka: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        partition: { type: 'integer' },
        offset: { type: 'integer' },
        key: { type: ['string', 'null'] },
        headers: { type: 'object' },
      },
    },
    pi: {
      type: 'object',
      properties: {
        webId: { type: 'string' },
        lastModified: { type: ['string', 'null'] },
        contentHash: { type: ['string', 'null'] },
        rawEndTime: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const RETRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  description: 'Details of a retraction (kind retraction / operation retract).',
  properties: {
    reason: { type: ['string', 'null'] },
    retractsRevision: { type: ['string', 'null'] },
    confirmedDeletion: {
      type: ['boolean', 'null'],
      description:
        'True when the source deletion was confirmed (PI06: completed inventory comparison plus a direct lookup); the source object becomes deleted_confirmed.',
    },
  },
} as const;
