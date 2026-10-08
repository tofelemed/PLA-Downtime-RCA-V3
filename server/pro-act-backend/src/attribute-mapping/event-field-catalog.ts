import { FieldRule, FieldValueType } from './field-rule';

/**
 * The event field catalog (spec ING04): every event field a source attribute may be mapped to, its
 * accepted rule types, and the default rules per PI template. The mapping UI and the backend validation
 * use this one list; `contracts/event-field-catalog.json` at the repository root is the published copy
 * and `event-field-catalog.spec.ts` fails when the two (or the event fact sets) drift apart.
 */
export interface CatalogField {
  name: string;
  types: FieldValueType[];
  /** `column`: a production_events column; `source_fact`: kept in the source revision only */
  storedAs: 'column' | 'source_fact';
  /** code fields: the id the value is resolved to (exact code or name, never substrings) */
  resolvesTo?: 'reasonCodeId' | 'impactCodeId' | 'oeeCodeId';
  /** templates that may map the field; '*' = all */
  templates: string[];
  description: string;
}

export interface CatalogTemplate {
  name: string;
  eventType: string;
  defaultRules: FieldRule[];
}

export interface EventFieldCatalog {
  version: number;
  noTemplateKey: string;
  fields: CatalogField[];
  templates: CatalogTemplate[];
}

export const NO_TEMPLATE_KEY = '*NoTemplate*';

const ALL = ['*'];
const field = (
  name: string,
  types: FieldValueType[],
  description: string,
  extra: Partial<CatalogField> = {},
): CatalogField => ({
  name,
  types,
  storedAs: 'column',
  templates: ALL,
  description,
  ...extra,
});
const fact = (
  name: string,
  types: FieldValueType[],
  description: string,
  resolvesTo?: CatalogField['resolvesTo'],
): CatalogField =>
  field(name, types, description, {
    storedAs: 'source_fact',
    ...(resolvesTo ? { resolvesTo } : {}),
  });
const rule = (
  sourceAttr: string,
  targetField: string,
  type: FieldValueType,
  extra: Partial<FieldRule> = {},
): FieldRule => ({ sourceAttr, targetField, type, ...extra });

const DESCRIPTION = rule('Description', 'description', 'string');
const SEVERITY = rule('Severity', 'severity', 'string');

export const EVENT_FIELD_CATALOG: EventFieldCatalog = {
  version: 1,
  noTemplateKey: NO_TEMPLATE_KEY,
  fields: [
    field('description', ['string'], 'Free text of the event'),
    field('quantity', ['number'], 'Lost or produced quantity'),
    field('cost', ['number'], 'Cost supplied by the source'),
    field('value', ['number'], 'Measured value (IOW)'),
    field('severity', ['string'], 'Severity label'),
    field('parameter', ['string'], 'Process parameter (IOW)'),
    field('limit', ['number'], 'Limit value (IOW)'),
    field('limitType', ['string'], 'Limit type (IOW)'),
    field('breachDuration', ['number'], 'Breach duration as delivered (IOW)'),
    field('solType', ['string'], 'Safe operating limit type'),
    field('apmType', ['string'], 'APM alert type'),
    field('recommendedAction', ['string'], 'Recommended action'),
    field('workOrderId', ['string'], 'Work order reference'),
    field('failureMode', ['string'], 'Failure mode'),
    field('defectiveQuantity', ['number'], 'Scrap / defective quantity'),
    field('shift', ['string'], 'Shift label'),
    field('crew', ['string'], 'Crew label'),
    field('lossCategory', ['string'], 'Loss category as delivered'),
    field('operatorName', ['string'], 'Operator name'),
    fact(
      'reason',
      ['digital', 'string'],
      'Reason as delivered',
      'reasonCodeId',
    ),
    fact(
      'impactCode',
      ['digital', 'string'],
      'Impact code as delivered',
      'impactCodeId',
    ),
    fact(
      'oeeCode',
      ['digital', 'string'],
      'OEE code as delivered',
      'oeeCodeId',
    ),
    fact(
      'suppliedDurationSeconds',
      ['duration'],
      'Duration supplied by the source; the timestamps stay authoritative',
    ),
  ],
  templates: [
    {
      name: 'Production Loss',
      eventType: 'ProductionLoss',
      defaultRules: [
        DESCRIPTION,
        rule('ReasonCode', 'reason', 'digital'),
        rule('OEECode', 'oeeCode', 'digital'),
        rule('ImpactCode', 'impactCode', 'digital'),
        rule('Quantity', 'quantity', 'number'),
        rule('Cost', 'cost', 'number'),
        rule('Shift', 'shift', 'string'),
        rule('Crew', 'crew', 'string'),
        rule('Duration', 'suppliedDurationSeconds', 'duration', {
          unit: 'minutes',
        }),
        rule('LossCategory', 'lossCategory', 'string'),
        rule('OperatorName', 'operatorName', 'string'),
      ],
    },
    {
      name: 'IOW Deviation',
      eventType: 'IOW',
      defaultRules: [
        rule('Parameter', 'parameter', 'string'),
        rule('Value', 'value', 'number'),
        rule('Limit', 'limit', 'number'),
        rule('LimitType', 'limitType', 'string'),
        rule('BreachDuration', 'breachDuration', 'number'),
        rule('RecommendedAction', 'recommendedAction', 'string'),
        DESCRIPTION,
        SEVERITY,
      ],
    },
    {
      name: 'SOL Violation',
      eventType: 'SOL',
      defaultRules: [
        rule('SolType', 'solType', 'string'),
        DESCRIPTION,
        SEVERITY,
      ],
    },
    {
      name: 'APM Alert',
      eventType: 'APM',
      defaultRules: [
        rule('FailureMode', 'failureMode', 'string'),
        rule('RecommendedAction', 'recommendedAction', 'string'),
        rule('APMType', 'apmType', 'string'),
        SEVERITY,
        DESCRIPTION,
      ],
    },
    {
      name: 'Failure WO',
      eventType: 'FailureWO',
      defaultRules: [
        rule('WorkOrderId', 'workOrderId', 'string'),
        rule('FailureMode', 'failureMode', 'string'),
        DESCRIPTION,
      ],
    },
    {
      name: 'Production Output',
      eventType: 'ProductionOutput',
      defaultRules: [
        rule('GoodQty', 'quantity', 'number', { aliases: ['Quantity'] }),
        rule('ScrapQty', 'defectiveQuantity', 'number'),
        DESCRIPTION,
      ],
    },
    {
      name: NO_TEMPLATE_KEY,
      eventType: 'ProductionLoss',
      defaultRules: [
        DESCRIPTION,
        rule('Quantity', 'quantity', 'number'),
        rule('Cost', 'cost', 'number'),
      ],
    },
  ],
};

export function catalogField(name: string): CatalogField | undefined {
  return EVENT_FIELD_CATALOG.fields.find((entry) => entry.name === name);
}

export function catalogTemplate(name: string): CatalogTemplate | undefined {
  return EVENT_FIELD_CATALOG.templates.find((entry) => entry.name === name);
}
