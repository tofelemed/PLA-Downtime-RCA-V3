import type { RuleConditionDef, RuleDefinitionDef, RuleInnerGroupDef, RulesSchemaView } from '@/api/v2/types/rules';

export interface DiffLine {
  text: string;
  change: 'added' | 'removed' | 'same';
}

/** Display text of a stored value of `field` (a record id → its name); identity when not given. */
export type ValueText = (field: string, value: string) => string;

const identity: ValueText = (_field, value) => value;

const isCondition = (member: RuleConditionDef | RuleInnerGroupDef): member is RuleConditionDef =>
  typeof (member as RuleConditionDef).field === 'string';

function conditionText(condition: RuleConditionDef, schema: RulesSchemaView | undefined, valueText: ValueText): string {
  const field = schema?.fields.find((entry) => entry.name === condition.field)?.label ?? condition.field;
  const op = schema?.operators.find((entry) => entry.op === condition.op)?.label ?? condition.op;
  if (condition.value === undefined) return `${field} ${op}`;
  const values = Array.isArray(condition.value) ? condition.value : [condition.value];
  return `${field} ${op} ${values.map((value) => valueText(condition.field, String(value))).join(', ')}`;
}

function groupLines(list: 'all' | 'any', members: Array<RuleConditionDef | RuleInnerGroupDef>, schema: RulesSchemaView | undefined, valueText: ValueText): string[] {
  const label = list === 'all' ? 'all of' : 'any of';
  return members.flatMap((member) => {
    if (isCondition(member)) return [`when ${label}: ${conditionText(member, schema, valueText)}`];
    return (['all', 'any'] as const).flatMap((inner) =>
      (member[inner] ?? []).map((condition) => `when ${label}: (${inner} of) ${conditionText(condition, schema, valueText)}`),
    );
  });
}

/** A definition as readable lines (one per condition and action), labelled from the grammar schema. */
export function describeDefinition(definition: RuleDefinitionDef, schema?: RulesSchemaView, valueText: ValueText = identity): string[] {
  const actions = definition.then.map((action) => {
    if ('flag' in action) return `then flag ${action.flag}`;
    const target = schema?.kinds.flatMap((kind) => kind.sets).find((entry) => entry.field === action.set)?.label ?? action.set;
    return `then set ${target} = ${valueText(action.set, action.value)}`;
  });
  return [
    ...groupLines('all', definition.when.all ?? [], schema, valueText),
    ...groupLines('any', definition.when.any ?? [], schema, valueText),
    ...actions,
  ];
}

/** Line diff of two definitions (previous version → this one); null previous = everything added. */
export function diffDefinitions(previous: RuleDefinitionDef | null, next: RuleDefinitionDef, schema?: RulesSchemaView, valueText: ValueText = identity): DiffLine[] {
  const after = describeDefinition(next, schema, valueText);
  if (!previous) return after.map((text) => ({ text, change: 'added' }));
  const before = describeDefinition(previous, schema, valueText);
  const removed = before.filter((line) => !after.includes(line)).map((text): DiffLine => ({ text, change: 'removed' }));
  const kept = after.map((text): DiffLine => ({ text, change: before.includes(text) ? 'same' : 'added' }));
  return [...removed, ...kept];
}
