import {
  IMPACT_MODES,
  OEE_COMPONENTS,
  PHYSICAL_TYPES,
  SCHEDULE_CLASSES,
  SOURCE_KINDS,
} from '../../domain/events/event-classification';

/** Kinds of declarative rule (plan 3.8); only `coding_default` is applied to events in R1. */
export const RULE_KINDS = [
  'coding_default',
  'status_derivation',
  'rca_trigger_hint',
  'validation',
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const RULE_STATES = ['draft', 'active', 'retired'] as const;
export type RuleState = (typeof RULE_STATES)[number];

export const RULE_OPERATORS = [
  'eq',
  'neq',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists',
  'matches',
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/** How a field's value is typed: an enum, a number, free text, or the id of a tenant record. */
export type RuleFieldType = 'enum' | 'number' | 'text' | 'reference';

export interface RuleFieldSpec {
  name: string;
  label: string;
  type: RuleFieldType;
  values?: readonly string[];
  /** referenced records (reference fields): reason / impact code, unit, asset */
  references?: 'reason_code' | 'impact_code' | 'unit' | 'asset';
  operators: readonly RuleOperator[];
}

const EQUALITY: readonly RuleOperator[] = ['eq', 'neq', 'in', 'exists'];
const NUMERIC: readonly RuleOperator[] = [
  'eq',
  'neq',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists',
];
const TEXT: readonly RuleOperator[] = ['eq', 'neq', 'in', 'exists', 'matches'];

const enumField = (
  name: string,
  label: string,
  values: readonly string[],
): RuleFieldSpec => ({
  name,
  label,
  type: 'enum',
  values,
  operators: EQUALITY,
});

/** Allowlisted event facts a condition may read (NFR02); the order is the picker order. */
export const RULE_FIELDS: readonly RuleFieldSpec[] = [
  enumField('physicalType', 'Physical type', PHYSICAL_TYPES),
  enumField('scheduleClass', 'Schedule class', SCHEDULE_CLASSES),
  enumField('oeeComponent', 'OEE component', OEE_COMPONENTS),
  enumField('impactMode', 'Impact mode', IMPACT_MODES),
  enumField('sourceKind', 'Source kind', SOURCE_KINDS),
  {
    name: 'eventType',
    label: 'Event type (legacy)',
    type: 'text',
    operators: TEXT,
  },
  { name: 'source', label: 'Source system', type: 'text', operators: TEXT },
  {
    name: 'durationSeconds',
    label: 'Duration (seconds)',
    type: 'number',
    operators: NUMERIC,
  },
  {
    name: 'reasonCodeId',
    label: 'Reason code',
    type: 'reference',
    references: 'reason_code',
    operators: EQUALITY,
  },
  {
    name: 'impactCodeId',
    label: 'Impact code',
    type: 'reference',
    references: 'impact_code',
    operators: EQUALITY,
  },
  {
    name: 'unitId',
    label: 'Unit',
    type: 'reference',
    references: 'unit',
    operators: EQUALITY,
  },
  {
    name: 'assetId',
    label: 'Asset',
    type: 'reference',
    references: 'asset',
    operators: EQUALITY,
  },
];

/** Status labels a `status_derivation` rule may set (v1 display states, plan 1.1). */
export const STATUS_LABELS = [
  'Open',
  'Coded',
  'RCA Required',
  'Investigating',
  'In Progress',
  'Completed',
  'Closed',
] as const;

export interface RuleSetTarget {
  field: 'scheduleClass' | 'oeeComponent' | 'impactCodeId' | 'statusLabel';
  label: string;
  values?: readonly string[];
  references?: 'impact_code';
}

const SET_TARGETS: Readonly<Record<RuleSetTarget['field'], RuleSetTarget>> = {
  scheduleClass: {
    field: 'scheduleClass',
    label: 'Schedule class',
    values: SCHEDULE_CLASSES,
  },
  oeeComponent: {
    field: 'oeeComponent',
    label: 'OEE component',
    values: OEE_COMPONENTS,
  },
  impactCodeId: {
    field: 'impactCodeId',
    label: 'Impact code',
    references: 'impact_code',
  },
  statusLabel: {
    field: 'statusLabel',
    label: 'Status label',
    values: STATUS_LABELS,
  },
};

export interface RuleKindSpec {
  kind: RuleKind;
  label: string;
  /** fields a `set` action may write for this kind (empty: none) */
  sets: readonly RuleSetTarget[];
  /** whether `flag` actions are allowed */
  flags: boolean;
  /** what consumes the rule in R1 */
  appliedBy: string;
}

export const RULE_KIND_SPECS: Readonly<Record<RuleKind, RuleKindSpec>> = {
  coding_default: {
    kind: 'coding_default',
    label: 'Coding default',
    sets: [
      SET_TARGETS.scheduleClass,
      SET_TARGETS.oeeComponent,
      SET_TARGETS.impactCodeId,
    ],
    flags: false,
    appliedBy:
      'v2 event create: fills schedule class, OEE component and impact code the user and the reason code left open',
  },
  status_derivation: {
    kind: 'status_derivation',
    label: 'Status label (display)',
    sets: [SET_TARGETS.statusLabel],
    flags: false,
    appliedBy:
      'stored, validated and simulated; display consumers follow with the state engine (1.10)',
  },
  rca_trigger_hint: {
    kind: 'rca_trigger_hint',
    label: 'RCA trigger hint',
    sets: [],
    flags: true,
    appliedBy:
      'stored, validated and simulated; consumed by the RCA trigger service (3.9)',
  },
  validation: {
    kind: 'validation',
    label: 'Validation flag',
    sets: [],
    flags: true,
    appliedBy:
      'stored, validated and simulated; consumed by the state engine and review queue (1.10)',
  },
};

/** Grammar limits (NFR02 bounded execution cost). */
export const RULE_LIMITS = {
  maxConditions: 20,
  maxDepth: 2,
  maxActions: 10,
  maxListValues: 50,
  maxGlobLength: 100,
  stepBudget: 10_000,
} as const;

export const GRAMMAR_VERSION = 1;

export function fieldSpec(name: string): RuleFieldSpec | undefined {
  return RULE_FIELDS.find((field) => field.name === name);
}

export function isRuleKind(value: string): value is RuleKind {
  return (RULE_KINDS as readonly string[]).includes(value);
}
