/**
 * Checked copies of `contracts/domain-events/*.v1.schema.json` (JSON Schema 2020-12, spec §15.4, API05) so
 * the backend does not read files outside its build context at runtime. `domain-event-schemas.spec.ts`
 * fails when a copy and its published contract drift apart.
 */

const CONTRACT_BASE = 'https://proact.local/contracts/domain-events';
const UUID = { type: 'string', format: 'uuid' };
const NULLABLE_UUID = { type: ['string', 'null'], format: 'uuid' };
const SHA256 = { type: 'string', pattern: '^[0-9a-f]{64}$' };
const DATE_TIME = { type: 'string', format: 'date-time' };
const DECIMAL_PATTERN = '^-?[0-9]+(\\.[0-9]+)?$';
const DECIMAL = { type: 'string', pattern: DECIMAL_PATTERN };
const NULLABLE_DECIMAL = { type: ['string', 'null'], pattern: DECIMAL_PATTERN };

/** Fields every v1 domain message carries (spec §15.4). */
const ENVELOPE_PROPERTIES = {
  schemaVersion: { const: 1 },
  domainEventId: UUID,
  tenantId: UUID,
  entityType: { const: 'production_period' },
  entityId: UUID,
  entityRevision: { type: 'integer', minimum: 1 },
  occurredAt: DATE_TIME,
  correlationId: { type: ['string', 'null'], maxLength: 128 },
};

const REVISION_PROPERTIES = {
  periodId: UUID,
  revisionId: UUID,
  revision: { type: 'integer', minimum: 1 },
};

const PRODUCT_TOTALS = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sliceId',
    'productId',
    'uom',
    'target',
    'actual',
    'gap',
    'attributed',
    'toleranceAdjustment',
    'residual',
    'overAccounted',
    'overproduction',
  ],
  properties: {
    sliceId: UUID,
    productId: NULLABLE_UUID,
    uom: { type: ['string', 'null'] },
    target: NULLABLE_DECIMAL,
    actual: NULLABLE_DECIMAL,
    gap: NULLABLE_DECIMAL,
    attributed: DECIMAL,
    toleranceAdjustment: DECIMAL,
    residual: NULLABLE_DECIMAL,
    overAccounted: NULLABLE_DECIMAL,
    overproduction: NULLABLE_DECIMAL,
  },
};

const SLICE_QUALITY = {
  type: 'object',
  additionalProperties: false,
  required: ['sliceId', 'qualityState', 'coverageRatio'],
  properties: {
    sliceId: UUID,
    qualityState: { type: 'string' },
    coverageRatio: NULLABLE_DECIMAL,
  },
};

const POLICY_VERSION = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'version'],
  properties: {
    id: { type: 'string' },
    kind: { type: 'string' },
    version: { type: 'integer' },
  },
};

const VALUATION_TOTAL = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sliceId',
    'view',
    'currency',
    'amount',
    'status',
    'reasons',
    'unvaluedQuantity',
  ],
  properties: {
    sliceId: UUID,
    view: {
      enum: [
        'contribution_margin',
        'standard_cost',
        'cost_per_hour',
        'economic_impact',
        'independent_components',
      ],
    },
    currency: { type: 'string', pattern: '^[A-Z]{3}$' },
    amount: NULLABLE_DECIMAL,
    status: { enum: ['valued', 'unvalued', 'mixed'] },
    reasons: { type: 'array', items: { type: 'string' } },
    unvaluedQuantity: DECIMAL,
  },
};

/**
 * Valuation of the approved figures (plan 2.6, D08). Widened additively in v1: every payload valid before
 * (`unvalued`, `currency: null`, a reason) is still valid; valued payloads add the policy version, the
 * default view, the reporting currencies (IRR and USD) and per-slice totals per view and currency, whose
 * amount is null when unvalued or when no approved FX rate covers the date. `currency` stays null: values
 * are always in several currencies, named on each total.
 */
const VALUATION = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'currency', 'reason'],
  properties: {
    status: { enum: ['unvalued', 'valued', 'mixed'] },
    currency: { type: 'null' },
    reason: { type: ['string', 'null'], minLength: 1 },
    policyVersion: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'version'],
      properties: { id: NULLABLE_UUID, version: { type: ['integer', 'null'] } },
    },
    defaultView: { type: 'string' },
    currencies: {
      type: 'array',
      items: { type: 'string', pattern: '^[A-Z]{3}$' },
    },
    totals: { type: 'array', items: VALUATION_TOTAL },
  },
};

function messageSchema(
  name: string,
  description: string,
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const all = { ...ENVELOPE_PROPERTIES, ...REVISION_PROPERTIES, ...properties };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${CONTRACT_BASE}/${contractFileOf(name)}`,
    title: `${name} v1`,
    description,
    type: 'object',
    additionalProperties: false,
    required: Object.keys(all),
    properties: all,
  };
}

const APPROVAL_PROPERTIES = {
  unitId: UUID,
  utcStart: DATE_TIME,
  utcEnd: DATE_TIME,
  priorRevisionId: NULLABLE_UUID,
  snapshotId: UUID,
  snapshotHash: SHA256,
  submittedHash: SHA256,
  calculationRunId: NULLABLE_UUID,
  approvedBy: UUID,
  policyVersions: { type: 'array', items: POLICY_VERSION },
  products: { type: 'array', items: PRODUCT_TOTALS },
  quality: { type: 'array', items: SLICE_QUALITY },
  valuation: VALUATION,
};

export const DOMAIN_EVENT_SCHEMAS: Readonly<
  Record<string, Record<string, unknown>>
> = {
  PeriodSubmitted: messageSchema(
    'PeriodSubmitted',
    'A draft accounting revision of a production period was submitted for approval (plan 2.8, WF01).',
    {
      submittedHash: SHA256,
      calculationRunId: NULLABLE_UUID,
      submittedBy: NULLABLE_UUID,
    },
  ),
  PeriodApproved: messageSchema(
    'PeriodApproved',
    'An accounting revision of a production period was approved (WF03). Carries the approved per-product totals, actuals quality, unit of measure, policy versions and the prior revision, and their valuation per slice, view and reporting currency (plan 2.6, D08: IRR and USD; null amounts when unvalued or without an approved FX rate).',
    APPROVAL_PROPERTIES,
  ),
  PeriodRestated: messageSchema(
    'PeriodRestated',
    'An approved period was approved again with a new revision that supersedes the previously published one (WF04). Same content as PeriodApproved; priorRevisionId names the superseded revision.',
    APPROVAL_PROPERTIES,
  ),
};

/** Contract file name of a message type, e.g. `period-approved.v1.schema.json`. */
export function contractFileOf(type: string): string {
  const kebab = type.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  return `${kebab}.v1.schema.json`;
}
