import type { RuleConditionDef, RuleDefinitionDef, RuleInnerGroupDef, RulesSchemaView } from '@/api/v2/types/rules';

export interface DiffLine {
  text: string;
  change: 'added' | 'removed' | 'same';
}

const isCondition = (member: RuleConditionDef | RuleInnerGroupDef): member is RuleConditionDef =>
  typeof (member as RuleConditionDef).field === 'string';

function conditionText(condition: RuleConditionDef, schema: RulesSchemaView | undefined): string {
  const field = schema?.fields.find((entry) => entry.name === condition.field)?.label ?? condition.field;
  const op = schema?.operators.find((entry) => entry.op === condition.op)?.label ?? condition.op;
  if (condition.value === undefined) return `${field} ${op}`;
  const value = Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value);
  return `${field} ${op} ${value}`;
}

function groupLines(list: 'all' | 'any', members: Array<RuleConditionDef | RuleInnerGroupDef>, schema?: RulesSchemaView): string[] {
  const label = list === 'all' ? 'all of' : 'any of';
  return members.flatMap((member) => {
    if (isCondition(member)) return [`when ${label}: ${conditionText(member, schema)}`];
    return (['all', 'any'] as const).flatMap((inner) =>
      (member[inner] ?? []).map((condition) => `when ${label}: (${inner} of) ${conditionText(condition, schema)}`),
    );
  });
}

/** A definition as readable lines (one per condition and action), labelled from the grammar schema. */
export function describeDefinition(definition: RuleDefinitionDef, schema?: RulesSchemaView): string[] {
  const actions = definition.then.map((action) => {
    if ('flag' in action) return `then flag ${action.flag}`;
    const target = schema?.kinds.flatMap((kind) => kind.sets).find((entry) => entry.field === action.set)?.label ?? action.set;
    return `then set ${target} = ${action.value}`;
  });
  return [
    ...groupLines('all', definition.when.all ?? [], schema),
    ...groupLines('any', definition.when.any ?? [], schema),
    ...actions,
  ];
}

/** Line diff of two definitions (previous version → this one); null previous = everything added. */
export function diffDefinitions(previous: RuleDefinitionDef | null, next: RuleDefinitionDef, schema?: RulesSchemaView): DiffLine[] {
  const after = describeDefinition(next, schema);
  if (!previous) return after.map((text) => ({ text, change: 'added' }));
  const before = describeDefinition(previous, schema);
  const removed = before.filter((line) => !after.includes(line)).map((text): DiffLine => ({ text, change: 'removed' }));
  const kept = after.map((text): DiffLine => ({ text, change: before.includes(text) ? 'same' : 'added' }));
  return [...removed, ...kept];
}
