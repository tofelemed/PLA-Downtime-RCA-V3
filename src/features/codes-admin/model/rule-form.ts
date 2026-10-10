import type {
  RuleActionDef,
  RuleConditionDef,
  RuleDefinitionDef,
  RuleKind,
  RuleOperator,
  RuleScalar,
  RulesSchemaView,
} from '@/api/v2/types/rules';

/** One condition as the builder edits it: pickers, and the value as typed text (lists comma-separated). */
export interface ConditionRow {
  key: string;
  field: string;
  op: RuleOperator | '';
  value: string;
}

export interface ActionRow {
  key: string;
  type: 'set' | 'flag';
  /** set: target field; flag: unused */
  field: string;
  /** set: the value; flag: the flag code */
  value: string;
}

export type ConditionList = 'all' | 'any';

/** Builder state of one rule draft; turned into the JSON definition only by `definitionOf`. */
export interface RuleDraft {
  kind: RuleKind;
  name: string;
  description: string;
  priority: string;
  all: ConditionRow[];
  any: ConditionRow[];
  actions: ActionRow[];
  /** a stored definition with nested groups, shown read-only (the builder edits one level) */
  nested: boolean;
}

let sequence = 0;
export const rowKey = (prefix: string): string => `${prefix}-${(sequence += 1)}`;

export const emptyCondition = (): ConditionRow => ({ key: rowKey('c'), field: '', op: '', value: '' });
export const emptyAction = (type: ActionRow['type'] = 'set'): ActionRow => ({ key: rowKey('a'), type, field: '', value: '' });

export function emptyDraft(kind: RuleKind = 'coding_default'): RuleDraft {
  return { kind, name: '', description: '', priority: '100', all: [emptyCondition()], any: [], actions: [emptyAction(kind === 'coding_default' || kind === 'status_derivation' ? 'set' : 'flag')], nested: false };
}

function typedValue(schema: RulesSchemaView, field: string, text: string): RuleScalar {
  const trimmed = text.trim();
  const type = schema.fields.find((entry) => entry.name === field)?.type;
  if (type === 'number' && trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function conditionOf(schema: RulesSchemaView, row: ConditionRow): RuleConditionDef {
  const op = row.op as RuleOperator;
  if (op === 'exists') return { field: row.field, op };
  if (op === 'in') {
    const values = row.value.split(',').map((part) => part.trim()).filter((part) => part !== '');
    return { field: row.field, op, value: values.map((part) => typedValue(schema, row.field, part)) };
  }
  return row.value.trim() === '' ? { field: row.field, op } : { field: row.field, op, value: typedValue(schema, row.field, row.value) };
}

const actionOf = (row: ActionRow): RuleActionDef => (row.type === 'flag' ? { flag: row.value.trim() } : { set: row.field, value: row.value.trim() });

/**
 * The JSON definition the server validates (nothing is pre-filtered: an incomplete row is sent as is
 * so the server's 422 field errors point at it, exactly as a save would).
 */
export function definitionOf(draft: RuleDraft, schema: RulesSchemaView): RuleDefinitionDef {
  const when: RuleDefinitionDef['when'] = {};
  if (draft.all.length > 0) when.all = draft.all.map((row) => conditionOf(schema, row));
  if (draft.any.length > 0) when.any = draft.any.map((row) => conditionOf(schema, row));
  return { when, then: draft.actions.map(actionOf) };
}

const isCondition = (member: unknown): member is RuleConditionDef =>
  typeof member === 'object' && member !== null && typeof (member as RuleConditionDef).field === 'string';

function rowOf(condition: RuleConditionDef): ConditionRow {
  const value = condition.value === undefined ? '' : Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value);
  return { key: rowKey('c'), field: condition.field, op: condition.op, value };
}

/** Builder state of a stored definition; nested groups mark the draft read-only. */
export function draftOf(base: Pick<RuleDraft, 'kind' | 'name' | 'description' | 'priority'>, definition: RuleDefinitionDef): RuleDraft {
  const members = [...(definition.when.all ?? []), ...(definition.when.any ?? [])];
  return {
    ...base,
    all: (definition.when.all ?? []).filter(isCondition).map(rowOf),
    any: (definition.when.any ?? []).filter(isCondition).map(rowOf),
    actions: definition.then.map((action) =>
      'flag' in action ? { key: rowKey('a'), type: 'flag', field: '', value: action.flag } : { key: rowKey('a'), type: 'set', field: action.set, value: action.value },
    ),
    nested: members.some((member) => !isCondition(member)),
  };
}

export interface RowErrors {
  /** row key → messages (conditions and actions) */
  rows: Record<string, string[]>;
  /** errors about the whole definition or a field the builder does not show as a row */
  general: string[];
}

const PATH = /^definition\.(when\.(all|any)\.(\d+)|then\.(\d+))(?:\.(\w+))?/;

/**
 * Places the API's 422 `fieldErrors` (`definition.when.all.0.op`, `definition.then.1.value`) on the
 * builder rows they name, so a live check and a refused save read the same.
 */
export function errorsByRow(draft: RuleDraft, fieldErrors: ReadonlyArray<{ field: string; message: string }>): RowErrors {
  const result: RowErrors = { rows: {}, general: [] };
  for (const error of fieldErrors) {
    const match = PATH.exec(error.field);
    const row = match
      ? match[2]
        ? draft[match[2] as ConditionList][Number(match[3])]
        : draft.actions[Number(match[4])]
      : undefined;
    const text = match?.[5] ? `${match[5]}: ${error.message}` : error.message;
    if (row) result.rows[row.key] = [...(result.rows[row.key] ?? []), text];
    else result.general.push(`${error.field.replace(/^definition\.?/, '') || 'definition'} ${error.message}`.trim());
  }
  return result;
}
