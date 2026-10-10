import { RuleOperator } from './rule-catalog';

/** TypeScript shape of `contracts/rules/rule-definition.schema.json` (validated before use). */
export type RuleScalar = string | number | boolean;

export interface RuleCondition {
  field: string;
  op: RuleOperator;
  value?: RuleScalar | RuleScalar[];
}

export interface RuleInnerGroup {
  all?: RuleCondition[];
  any?: RuleCondition[];
}

export type RuleMember = RuleCondition | RuleInnerGroup;

export interface RuleGroup {
  all?: RuleMember[];
  any?: RuleMember[];
}

export interface RuleSetAction {
  set: 'scheduleClass' | 'oeeComponent' | 'impactCodeId' | 'statusLabel';
  value: string;
}

export interface RuleFlagAction {
  flag: string;
}

export type RuleAction = RuleSetAction | RuleFlagAction;

export interface RuleDefinition {
  when: RuleGroup;
  then: RuleAction[];
}

/** Facts of one event a rule reads (allowlisted names only; absent = null). */
export type RuleFacts = Readonly<
  Record<string, string | number | null | undefined>
>;

export function isCondition(member: RuleMember): member is RuleCondition {
  return typeof (member as RuleCondition).field === 'string';
}

export function isSetAction(action: RuleAction): action is RuleSetAction {
  return typeof (action as RuleSetAction).set === 'string';
}

/** Every condition of a definition, in order (groups flattened). */
export function conditionsOf(definition: RuleDefinition): RuleCondition[] {
  const members = [
    ...(definition.when.all ?? []),
    ...(definition.when.any ?? []),
  ];
  return members.flatMap((member) =>
    isCondition(member)
      ? [member]
      : [...(member.all ?? []), ...(member.any ?? [])],
  );
}
