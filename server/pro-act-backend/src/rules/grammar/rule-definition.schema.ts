/**
 * Checked copy of `contracts/rules/rule-definition.schema.json` (JSON Schema 2020-12, plan 3.8, NFR02) so
 * the backend never reads files outside its build context at runtime; `rule-grammar.spec.ts` fails when
 * the copy and the published contract drift apart. The schema fixes the shape (allowlisted fields and
 * operators, at most two levels of groups, bounded lists); `rule-validator.ts` adds the checks JSON Schema
 * cannot express (operator per field type, value types, total condition count, actions per rule kind).
 */
export const RULE_DEFINITION_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://proact.local/contracts/rules/rule-definition.schema.json',
  title: 'Declarative admin rule definition',
  description:
    'Body of one version of a declarative rule (plan 3.8, spec NFR02 and section 16.2 AdminPanel). A rule is data, never code: `when` is a group of conditions over allowlisted event fields with allowlisted operators (at most two levels of groups, at most 20 conditions), `then` lists actions (`set` an allowlisted field to a value, or raise a `flag`). The server validates every definition against this schema and evaluates it with a pure interpreter under a step budget (src/rules/grammar/rule-interpreter.ts); no function strings, expressions or regular expressions are accepted.',
  type: 'object',
  required: ['when', 'then'],
  additionalProperties: false,
  properties: {
    when: { $ref: '#/$defs/group' },
    then: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: { $ref: '#/$defs/action' },
    },
  },
  $defs: {
    field: {
      type: 'string',
      enum: [
        'physicalType',
        'scheduleClass',
        'oeeComponent',
        'impactMode',
        'sourceKind',
        'eventType',
        'source',
        'durationSeconds',
        'reasonCodeId',
        'impactCodeId',
        'unitId',
        'assetId',
      ],
      description:
        'Allowlisted event facts (GET /api/v2/rules/schema lists their types and operators).',
    },
    operator: {
      type: 'string',
      enum: ['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte', 'exists', 'matches'],
    },
    scalar: {
      anyOf: [
        { type: 'string', minLength: 1, maxLength: 200 },
        { type: 'number' },
        { type: 'boolean' },
      ],
    },
    condition: {
      type: 'object',
      required: ['field', 'op'],
      additionalProperties: false,
      properties: {
        field: { $ref: '#/$defs/field' },
        op: { $ref: '#/$defs/operator' },
        value: {
          anyOf: [
            { $ref: '#/$defs/scalar' },
            {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: { $ref: '#/$defs/scalar' },
            },
          ],
        },
      },
    },
    innerGroup: {
      type: 'object',
      minProperties: 1,
      additionalProperties: false,
      properties: {
        all: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: { $ref: '#/$defs/condition' },
        },
        any: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: { $ref: '#/$defs/condition' },
        },
      },
    },
    member: {
      type: 'object',
      if: { required: ['field'] },
      then: { $ref: '#/$defs/condition' },
      else: { $ref: '#/$defs/innerGroup' },
    },
    group: {
      type: 'object',
      minProperties: 1,
      additionalProperties: false,
      properties: {
        all: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: { $ref: '#/$defs/member' },
        },
        any: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: { $ref: '#/$defs/member' },
        },
      },
    },
    setAction: {
      type: 'object',
      required: ['set', 'value'],
      additionalProperties: false,
      properties: {
        set: {
          type: 'string',
          enum: [
            'scheduleClass',
            'oeeComponent',
            'impactCodeId',
            'statusLabel',
          ],
        },
        value: { type: 'string', minLength: 1, maxLength: 64 },
      },
    },
    flagAction: {
      type: 'object',
      required: ['flag'],
      additionalProperties: false,
      properties: {
        flag: { type: 'string', pattern: '^[a-z][a-z0-9_]{0,39}$' },
      },
    },
    action: {
      type: 'object',
      if: { required: ['set'] },
      then: { $ref: '#/$defs/setAction' },
      else: { $ref: '#/$defs/flagAction' },
    },
  },
} as const;
