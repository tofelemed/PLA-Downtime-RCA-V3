/** `values` of the canonical envelope (spec §5.1); part of `canonical-event.schema.ts`. */
export const VALUES_SCHEMA = {
  type: 'object',
  description:
    'Typed values. For interval events: template name and attributes; for measurements: a single sample.',
  additionalProperties: false,
  properties: {
    templateName: { type: ['string', 'null'] },
    attributes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'type'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'number',
              'string',
              'boolean',
              'digital',
              'duration',
              'timestamp',
            ],
          },
          value: {},
          digital: {
            type: 'object',
            required: ['name', 'value'],
            properties: {
              name: { type: 'string' },
              value: { type: 'integer' },
              isSystem: { type: 'boolean' },
            },
          },
          unit: { type: ['string', 'null'] },
          semanticType: {
            type: ['string', 'null'],
            enum: [
              'rate',
              'counter',
              'state',
              'quality',
              'level',
              'output_increment',
              'other',
              null,
            ],
          },
        },
      },
    },
    sample: {
      type: 'object',
      required: ['signalRef', 'value'],
      properties: {
        signalRef: { type: 'string' },
        value: {},
        unit: { type: ['string', 'null'] },
        semanticType: {
          type: 'string',
          enum: [
            'rate',
            'counter',
            'state',
            'quality',
            'level',
            'output_increment',
            'other',
          ],
        },
        sequence: { type: ['integer', 'null'] },
      },
      additionalProperties: false,
    },
    state: {
      type: 'object',
      required: ['stateRef', 'value'],
      additionalProperties: false,
      description: 'State observations (kind state, plan 1.10).',
      properties: {
        stateRef: { type: 'string', minLength: 1 },
        value: { type: ['string', 'number', 'boolean'] },
        previousValue: { type: ['string', 'number', 'boolean', 'null'] },
        sequence: { type: ['integer', 'null'] },
      },
    },
    output: {
      type: 'object',
      required: ['quantity'],
      additionalProperties: false,
      description: 'Production output of an output_event (plan 1.7).',
      properties: {
        quantity: { type: 'number' },
        unit: { type: ['string', 'null'] },
        productRef: { type: ['string', 'null'] },
        good: { type: ['boolean', 'null'] },
      },
    },
  },
} as const;
