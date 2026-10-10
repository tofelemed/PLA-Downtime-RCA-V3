import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import {
  fieldSpec,
  RULE_KIND_SPECS,
  RULE_LIMITS,
  RuleFieldSpec,
  RuleKind,
} from './rule-catalog';
import { RULE_DEFINITION_SCHEMA } from './rule-definition.schema';
import {
  isCondition,
  isSetAction,
  RuleAction,
  RuleCondition,
  RuleDefinition,
  RuleMember,
  RuleScalar,
} from './rule-definition';

/** One rejected part of a definition, in the API's `fieldErrors` shape (`definition.when.all.0.op`). */
export interface RuleFieldError {
  field: string;
  message: string;
}

export type RuleValidation =
  | { valid: true; definition: RuleDefinition; conditionCount: number }
  | { valid: false; fieldErrors: RuleFieldError[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROOT = 'definition';

let compiled: ValidateFunction<RuleDefinition> | null = null;

function schemaValidator(): ValidateFunction<RuleDefinition> {
  if (compiled) return compiled;
  // `required` inside if/then names properties declared in the branch schemas, hence strictRequired off
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
  });
  compiled = ajv.compile<RuleDefinition>(RULE_DEFINITION_SCHEMA);
  return compiled;
}

const pathOf = (pointer: string) =>
  [ROOT, ...pointer.split('/').filter(Boolean)].join('.');

/** One message per path: the most specific ajv error (anyOf / if branches repeat themselves). */
function schemaErrors(errors: ErrorObject[]): RuleFieldError[] {
  const byPath = new Map<string, string>();
  for (const error of errors) {
    if (error.keyword === 'if' || error.keyword === 'anyOf') continue;
    const extra =
      error.keyword === 'additionalProperties'
        ? ` (${String(error.params.additionalProperty)})`
        : '';
    const allowed =
      error.keyword === 'enum'
        ? `: ${(error.params.allowedValues as unknown[]).join(', ')}`
        : '';
    const path = pathOf(error.instancePath);
    if (!byPath.has(path))
      byPath.set(path, `${error.message ?? error.keyword}${extra}${allowed}`);
  }
  if (byPath.size === 0) byPath.set(ROOT, 'is not a valid rule definition');
  return [...byPath].map(([field, message]) => ({ field, message }));
}

function valueError(spec: RuleFieldSpec, value: RuleScalar): string | null {
  if (spec.type === 'number')
    return typeof value === 'number' && Number.isFinite(value)
      ? null
      : 'must be a number';
  if (typeof value !== 'string') return 'must be text';
  if (spec.type === 'enum' && !spec.values?.includes(value))
    return `must be one of: ${spec.values?.join(', ')}`;
  if (spec.type === 'reference' && !UUID.test(value))
    return 'must be the id of a record of the tenant';
  return null;
}

function conditionErrors(
  condition: RuleCondition,
  path: string,
): RuleFieldError[] {
  const spec = fieldSpec(condition.field);
  if (!spec)
    return [{ field: `${path}.field`, message: 'is not an allowlisted field' }];
  if (!spec.operators.includes(condition.op)) {
    return [
      {
        field: `${path}.op`,
        message: `is not allowed for ${spec.label} (allowed: ${spec.operators.join(', ')})`,
      },
    ];
  }
  const value = condition.value;
  if (condition.op === 'exists') {
    return value === undefined
      ? []
      : [{ field: `${path}.value`, message: 'must be empty for "exists"' }];
  }
  if (value === undefined)
    return [{ field: `${path}.value`, message: 'is required' }];
  if ((condition.op === 'in') !== Array.isArray(value)) {
    return [
      {
        field: `${path}.value`,
        message:
          condition.op === 'in'
            ? 'must be a list for "in"'
            : 'must be a single value',
      },
    ];
  }
  if (
    condition.op === 'matches' &&
    String(value).length > RULE_LIMITS.maxGlobLength
  ) {
    return [
      {
        field: `${path}.value`,
        message: `pattern longer than ${RULE_LIMITS.maxGlobLength} characters`,
      },
    ];
  }
  const values = Array.isArray(value) ? value : [value];
  const problem = values
    .map((entry) => valueError(spec, entry))
    .find((message) => message !== null);
  return problem ? [{ field: `${path}.value`, message: problem }] : [];
}

function memberErrors(member: RuleMember, path: string): RuleFieldError[] {
  if (isCondition(member)) return conditionErrors(member, path);
  return (['all', 'any'] as const).flatMap((list) =>
    (member[list] ?? []).flatMap((condition, index) =>
      conditionErrors(condition, `${path}.${list}.${index}`),
    ),
  );
}

function actionErrors(kind: RuleKind, actions: RuleAction[]): RuleFieldError[] {
  const spec = RULE_KIND_SPECS[kind];
  const seen = new Set<string>();
  return actions.flatMap((action, index): RuleFieldError[] => {
    const path = `${ROOT}.then.${index}`;
    if (!isSetAction(action)) {
      return spec.flags
        ? []
        : [
            {
              field: `${path}.flag`,
              message: `${spec.label} rules cannot raise flags`,
            },
          ];
    }
    const target = spec.sets.find((entry) => entry.field === action.set);
    if (!target)
      return [
        {
          field: `${path}.set`,
          message: `${spec.label} rules cannot set ${action.set}`,
        },
      ];
    if (seen.has(action.set))
      return [{ field: `${path}.set`, message: `${action.set} is set twice` }];
    seen.add(action.set);
    if (target.values && !target.values.includes(action.value)) {
      return [
        {
          field: `${path}.value`,
          message: `must be one of: ${target.values.join(', ')}`,
        },
      ];
    }
    if (target.references && !UUID.test(action.value))
      return [
        { field: `${path}.value`, message: 'must be the id of an impact code' },
      ];
    return [];
  });
}

function countConditions(definition: RuleDefinition): number {
  const members = [
    ...(definition.when.all ?? []),
    ...(definition.when.any ?? []),
  ];
  return members.reduce(
    (total, member) =>
      total +
      (isCondition(member)
        ? 1
        : (member.all?.length ?? 0) + (member.any?.length ?? 0)),
    0,
  );
}

/**
 * Validates a rule definition for a kind (plan 3.8, NFR02): the JSON schema first (shape, allowlists,
 * depth), then operator-per-type, value types, the total condition budget and the actions the kind
 * allows. References to tenant records are checked by the service (422 INVALID_REFERENCE).
 */
export function validateRuleDefinition(
  kind: RuleKind,
  candidate: unknown,
): RuleValidation {
  const validate = schemaValidator();
  if (!validate(candidate))
    return { valid: false, fieldErrors: schemaErrors(validate.errors ?? []) };
  const definition = candidate;
  const conditionCount = countConditions(definition);
  const errors: RuleFieldError[] = [];
  if (conditionCount > RULE_LIMITS.maxConditions) {
    errors.push({
      field: `${ROOT}.when`,
      message: `has ${conditionCount} conditions; at most ${RULE_LIMITS.maxConditions} are allowed`,
    });
  }
  for (const list of ['all', 'any'] as const) {
    (definition.when[list] ?? []).forEach((member, index) =>
      errors.push(...memberErrors(member, `${ROOT}.when.${list}.${index}`)),
    );
  }
  errors.push(...actionErrors(kind, definition.then));
  return errors.length > 0
    ? { valid: false, fieldErrors: errors }
    : { valid: true, definition, conditionCount };
}
